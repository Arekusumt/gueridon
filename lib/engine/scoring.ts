/**
 * Global menu score (0–100), a deterministic weighted blend:
 *
 *   matrix     30  — share of demand in stars/puzzles; dogs drag it down
 *   omnes      20  — share of price-structure checks passed
 *   pricing    20  — share of items needing no correction
 *   compliance 15  — required failures are heavily penalised
 *   copy       15  — supplied by the LLM audit (0–100); when absent, the
 *                    remaining weights are re-normalised so the score stays fair
 */

import type {
  ComplianceFinding,
  MatrixResult,
  MenuScore,
  OmnesReport,
  PriceRecommendation,
} from "./types";
import { round2 } from "./utils";

const WEIGHTS = { matrix: 30, omnes: 20, pricing: 20, compliance: 15, copy: 15 };

function matrixSubscore(matrix: MatrixResult, notes: string[]): number {
  let good = 0;
  let bad = 0;
  let classified = 0;
  for (const g of matrix.groups) {
    for (const ci of g.items) {
      if (!ci.classification) continue;
      classified++;
      if (ci.classification === "star") good += 1;
      else if (ci.classification === "puzzle" || ci.classification === "plowhorse") good += 0.5;
      else bad += 1;
    }
  }
  if (classified === 0) {
    notes.push("matrix-unscored");
    return 50; // neutral when nothing could be classified
  }
  return (good / classified) * 100 - (bad / classified) * 20;
}

function omnesSubscore(reports: OmnesReport[], notes: string[]): number {
  let checks = 0;
  let passed = 0;
  for (const r of reports) {
    for (const pass of [r.dispersion.pass, r.bands.pass, r.priceDemand.pass]) {
      if (pass == null) continue;
      checks++;
      if (pass) passed++;
    }
  }
  if (checks === 0) {
    notes.push("omnes-unscored");
    return 50;
  }
  return (passed / checks) * 100;
}

function pricingSubscore(recs: PriceRecommendation[]): number {
  if (recs.length === 0) return 50;
  const clean = recs.filter((r) => r.reasons.length === 1 && r.reasons[0] === "HOLD").length;
  return (clean / recs.length) * 100;
}

function complianceSubscore(findings: ComplianceFinding[]): number {
  let score = 100;
  for (const f of findings) {
    if (f.severity === "required") score -= 50;
    else if (f.severity === "warning") score -= 20;
    // info findings are reminders, not penalties
  }
  return Math.max(0, score);
}

export function menuScore(parts: {
  matrix: MatrixResult;
  omnes: OmnesReport[];
  pricing: PriceRecommendation[];
  compliance: ComplianceFinding[];
  copyScore?: number | null;
}): MenuScore {
  const notes: string[] = [];
  const subs = {
    matrix: Math.max(0, Math.min(100, matrixSubscore(parts.matrix, notes))),
    omnes: omnesSubscore(parts.omnes, notes),
    pricing: pricingSubscore(parts.pricing),
    compliance: complianceSubscore(parts.compliance),
    copy: parts.copyScore ?? null,
  };

  const entries: Array<[keyof typeof WEIGHTS, number]> = [
    ["matrix", subs.matrix],
    ["omnes", subs.omnes],
    ["pricing", subs.pricing],
    ["compliance", subs.compliance],
  ];
  if (subs.copy != null) entries.push(["copy", subs.copy]);
  else notes.push("copy-unscored");

  const totalWeight = entries.reduce((a, [k]) => a + WEIGHTS[k], 0);
  const total = entries.reduce((a, [k, v]) => a + v * (WEIGHTS[k] / totalWeight), 0);

  return {
    total: Math.round(total),
    subscores: {
      matrix: round2(subs.matrix),
      omnes: round2(subs.omnes),
      pricing: round2(subs.pricing),
      compliance: round2(subs.compliance),
      copy: subs.copy != null ? round2(subs.copy) : null,
    },
    notes,
  };
}
