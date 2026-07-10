/**
 * Precomputes the demo analysis (EN + ES) from the real Waterfront menus.
 * Run: npx tsx scripts/build-demo.ts
 *
 * Uses the exact same pipeline stages as the API, in fixture mode, so the
 * demo shown to visitors is a genuine product of the deterministic engine.
 */

import fs from "node:fs";
import path from "node:path";
import { menuScore, type MenuItem } from "../lib/engine";
import { fixtureBackend } from "../lib/pipeline/llm";
import {
  competitorStage,
  deterministicDoctor,
  deterministicReport,
  engineStages,
  estimateStage,
} from "../lib/pipeline/stages";
import type { AnalysisResult, AnalyzeInput, RestaurantProfile } from "../lib/pipeline/types";

const root = path.resolve(__dirname, "..");
const menu = JSON.parse(fs.readFileSync(path.join(root, "data/demo/waterfront-menu.json"), "utf8"));
const overlay = JSON.parse(fs.readFileSync(path.join(root, "data/demo/waterfront-overlay.json"), "utf8"));

// Lines on the printed menu that are notes, not dishes.
const NOT_A_DISH = /you can change any dish/i;

const items: MenuItem[] = [];
const seen = new Set<string>();
for (const section of menu.sections) {
  for (const it of section.items) {
    if (it.price == null || NOT_A_DISH.test(it.name)) continue;
    let id = `${section.name}-${it.name}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    if (seen.has(id)) id = `${id}-${items.length}`;
    seen.add(id);
    items.push({
      id,
      name: it.name,
      category: section.name,
      description: it.description ?? null,
      price: it.price,
    });
  }
}

const fixture = fixtureBackend(() => {
  throw new Error("demo build must stay deterministic");
});

async function build(locale: "en" | "es") {
  const profile: RestaurantProfile = {
    name: menu.restaurant.name,
    location: menu.restaurant.location,
    cuisine: menu.restaurant.cuisine,
    positioning: "mid",
    region: { country: "ES", catalonia: true },
    marketZone: "salou-la-pineda",
    locale,
  };
  const input: AnalyzeInput = { profile, menuText: "" };

  const estimated = await estimateStage(items, fixture);
  const comp = await competitorStage(estimated, input, fixture);
  // Allergen declaration is NOT assessable from the photographed cartas (they
  // are partial crops), so the demo neutralises this check rather than publish
  // an unverifiable claim about a real venue. Real analyses assess it normally.
  const eng = engineStages(estimated, input, comp.benchmarks, true);

  const doctor = deterministicDoctor(estimated);
  for (const f of doctor.findings) {
    const item = estimated.find((i) => i.id === f.itemId);
    const rewrite = item ? overlay.rewrites[item.name] : undefined;
    if (rewrite) f.rewrite = rewrite;
  }
  doctor.structure.push(...overlay.structureNotes);

  const score = menuScore({
    matrix: eng.matrix,
    omnes: eng.omnes,
    pricing: eng.pricing,
    compliance: eng.compliance,
    copyScore: doctor.copyScore,
  });

  const report = deterministicReport({
    items: estimated,
    matrix: eng.matrix,
    omnes: eng.omnes,
    pricing: eng.pricing,
    compliance: eng.compliance,
    doctor,
    score,
    locale,
  });

  const result: AnalysisResult = {
    profile,
    items: estimated,
    matrix: eng.matrix,
    omnes: eng.omnes,
    pricing: eng.pricing,
    benchmarks: [...comp.benchmarks.entries()],
    compliance: eng.compliance,
    doctor,
    score,
    summary: report.summary,
    quickWins: report.quickWins,
    meta: {
      generatedAt: new Date().toISOString(),
      mode: "demo",
      dataQuality: eng.matrix.mode,
    },
  };

  const out = path.join(root, `data/demo/waterfront-analysis.${locale}.json`);
  fs.writeFileSync(out, JSON.stringify(result, null, 1));
  console.log(
    `${locale}: score ${score.total}/100 · ${items.length} items · ` +
      `${eng.pricing.filter((r) => r.suggested !== r.current).length} price moves · wrote ${path.basename(out)}`,
  );
}

(async () => {
  await build("en");
  await build("es");
})();
