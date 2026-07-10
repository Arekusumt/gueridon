/**
 * Pipeline orchestrator. An async generator so the API route can stream each
 * stage over SSE and the UI can show the "agentic view" live.
 */

import { menuScore } from "@/lib/engine";
import type { LlmBackend } from "./llm";
import {
  competitorStage,
  doctorStage,
  engineStages,
  estimateStage,
  normalizeStage,
  parseStage,
  reportStage,
} from "./stages";
import type { AnalysisResult, AnalyzeInput, PipelineEvent } from "./types";

async function timed<T>(fn: () => Promise<T> | T): Promise<{ value: T; ms: number }> {
  const t0 = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - t0) };
}

export async function* runPipeline(
  input: AnalyzeInput,
  backend: LlmBackend,
): AsyncGenerator<PipelineEvent, AnalysisResult> {
  yield { stage: "parse", status: "start" };
  const parse = await timed(() => parseStage(input, backend));
  yield {
    stage: "parse",
    status: "done",
    ms: parse.ms,
    detail: `${parse.value.items.length} items read`,
  };

  yield { stage: "normalize", status: "start" };
  const norm = await timed(() => normalizeStage(parse.value, input));
  yield {
    stage: "normalize",
    status: "done",
    ms: norm.ms,
    detail: `${norm.value.items.length} priced items${norm.value.skipped ? `, ${norm.value.skipped} skipped (no price)` : ""}`,
  };
  if (norm.value.items.length === 0) throw new Error("NO_PRICED_ITEMS");

  yield { stage: "estimate", status: "start" };
  const est = await timed(() => estimateStage(norm.value.items, backend));
  const estimatedCount = est.value.filter((i) => i.cost == null).length;
  yield {
    stage: "estimate",
    status: "done",
    ms: est.ms,
    detail: estimatedCount > 0 ? `${estimatedCount} items on estimated costs` : "real costs provided",
  };

  yield { stage: "competitors", status: "start" };
  const comp = await timed(() => competitorStage(est.value, input));
  yield {
    stage: "competitors",
    status: "done",
    ms: comp.ms,
    detail: `${comp.value.benchmarks.size} items benchmarked${comp.value.competitorItems ? ` (+${comp.value.competitorItems} competitor prices)` : ""}`,
  };

  yield { stage: "pricing", status: "start" };
  const eng = await timed(() =>
    engineStages(est.value, input, comp.value.benchmarks, parse.value.allergenInfoPresent),
  );
  const moves = eng.value.pricing.filter((r) => r.suggested !== r.current).length;
  yield { stage: "pricing", status: "done", ms: eng.ms, detail: `${moves} price moves recommended` };

  yield { stage: "doctor", status: "start" };
  const stars = eng.value.matrix.groups
    .flatMap((g) => g.items)
    .filter((c) => c.classification === "star" || c.classification === "puzzle")
    .map((c) => c.item.id);
  const doctor = await timed(() => doctorStage(est.value, backend, stars.slice(0, 12)));
  yield { stage: "doctor", status: "done", ms: doctor.ms, detail: `copy score ${doctor.value.copyScore}/100` };

  yield { stage: "compliance", status: "start" };
  const required = eng.value.compliance.filter((f) => f.severity === "required").length;
  yield {
    stage: "compliance",
    status: "done",
    ms: 0,
    detail: required > 0 ? `${required} required fix${required === 1 ? "" : "es"}` : "no blockers",
  };

  const score = menuScore({
    matrix: eng.value.matrix,
    omnes: eng.value.omnes,
    pricing: eng.value.pricing,
    compliance: eng.value.compliance,
    copyScore: doctor.value.copyScore,
  });

  yield { stage: "report", status: "start" };
  const report = await timed(() =>
    reportStage(
      {
        items: est.value,
        matrix: eng.value.matrix,
        omnes: eng.value.omnes,
        pricing: eng.value.pricing,
        compliance: eng.value.compliance,
        doctor: doctor.value,
        score,
        locale: input.profile.locale,
      },
      backend,
    ),
  );
  yield { stage: "report", status: "done", ms: report.ms, detail: `score ${score.total}/100` };

  return {
    profile: input.profile,
    items: est.value,
    matrix: eng.value.matrix,
    omnes: eng.value.omnes,
    pricing: eng.value.pricing,
    benchmarks: [...comp.value.benchmarks.entries()],
    compliance: eng.value.compliance,
    doctor: doctor.value,
    score,
    summary: report.value.summary,
    quickWins: report.value.quickWins,
    meta: {
      generatedAt: new Date().toISOString(),
      mode: backend.name === "anthropic" ? "live" : "fixture",
      dataQuality: eng.value.matrix.mode,
    },
  };
}
