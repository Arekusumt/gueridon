/**
 * Pipeline stages. Design rule: every number the app reports comes from the
 * deterministic engine; the LLM only reads menus, refines estimates within
 * schema bounds, audits copy, and writes prose. Each stage degrades
 * gracefully to a deterministic path when no LLM is available.
 */

import {
  ALLERGEN_DECLARATION_HINTS,
  auditCompliance,
  buildMatrix,
  omnesReport,
  recommendPrices,
} from "@/lib/engine";
import type {
  ComplianceFinding,
  MarketBenchmark,
  MatrixResult,
  MenuItem,
  MenuScore,
  OmnesReport,
  PriceRecommendation,
} from "@/lib/engine";
import { costShareFor, popularityFor } from "./heuristics";
import type { LlmBackend } from "./llm";
import { marketKeyFor, zoneBenchmarks } from "./market";
import {
  DoctorSchema,
  EstimateSchema,
  extractJson,
  ParsedMenuSchema,
  type ParsedMenu,
} from "./schemas";
import type { AnalyzeInput, DoctorResult } from "./types";
import { round2 } from "@/lib/engine/utils";

// ---------------------------------------------------------------- parse ----

const PRICE_AT_END = /^(.{2,90}?)[\s.·…—-]*(?:€\s*)?(\d{1,3}(?:[.,]\d{1,2})?)\s*€?\s*$/;

/**
 * Deterministic parser for pasted menu text. Handles the two layouts that
 * cover most real menus:
 *   "Name …… 12,50"                          (single line)
 *   "Name" ⏎ "description of the dish … 12,50"  (name above, price below)
 * ALL-CAPS lines are section headers. Best-effort by design — live mode
 * hands messy layouts to the LLM instead.
 */
export function textParse(raw: string): ParsedMenu {
  const items: ParsedMenu["items"] = [];
  let category = "Menu";
  let lastItem: ParsedMenu["items"][number] | null = null;
  let pendingName: string | null = null;
  const lowercaseStart = /^[a-zà-öø-ÿ(]/;

  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) {
      lastItem = null;
      pendingName = null;
      continue;
    }

    const m = t.match(PRICE_AT_END);
    if (m) {
      const price = Number(m[2].replace(",", "."));
      const label = m[1].trim();
      if (price > 0 && price < 1000 && label.length >= 2) {
        if (pendingName && lowercaseStart.test(label)) {
          // Previous line was the dish name; this line is description + price.
          lastItem = { name: pendingName, category, description: label, price };
        } else {
          lastItem = { name: label, category, description: null, price };
        }
        items.push(lastItem);
        pendingName = null;
        continue;
      }
    }

    const isCapsHeader =
      t.length <= 42 && t === t.toUpperCase() && /[A-ZÀ-Ú]/.test(t);
    if (isCapsHeader) {
      category = t.replace(/[:.]+$/, "");
      lastItem = null;
      pendingName = null;
    } else if (lastItem && lowercaseStart.test(t)) {
      // Wrapped description continuing the previous item.
      lastItem.description = lastItem.description ? `${lastItem.description} ${t}` : t;
    } else if (t.length <= 60) {
      // Could be a dish name (price on next line) or a Title-Case header;
      // two name-ish lines in a row → the first one was a header.
      if (pendingName) category = pendingName.replace(/[:.]+$/, "");
      pendingName = t;
      lastItem = null;
    } else {
      lastItem = null; // long prose (footer, legal note) — ignore
    }
  }

  return {
    items,
    allergenInfoPresent: ALLERGEN_DECLARATION_HINTS.test(raw),
    notes: [],
  };
}

const PARSER_SYSTEM = `You digitise restaurant menus. Extract every legible item.
Return ONLY JSON: {"items":[{"name","category","description","price"}],"allergenInfoPresent":bool,"notes":[]}.
Rules: never invent items or prices — omit what you cannot read and mention it in notes;
keep the menu's original language; price is a number without currency symbol; category is
the menu section heading the item appears under.`;

export async function parseStage(
  input: AnalyzeInput,
  backend: LlmBackend,
): Promise<ParsedMenu> {
  if (input.images && input.images.length > 0) {
    if (backend.name !== "anthropic") {
      throw new Error("PHOTO_NEEDS_LIVE"); // surfaced to UI as a friendly hint
    }
    const reply = await backend.complete({
      role: "parser",
      system: PARSER_SYSTEM,
      prompt: "Digitise these menu photos into the JSON format.",
      images: input.images,
    });
    return ParsedMenuSchema.parse(extractJson(reply));
  }

  const text = input.menuText?.trim();
  if (!text) throw new Error("EMPTY_INPUT");

  const deterministic = textParse(text);
  if (deterministic.items.length >= 3 || backend.name !== "anthropic") {
    if (deterministic.items.length === 0) throw new Error("UNPARSEABLE_TEXT");
    return deterministic;
  }
  // Messy text + live backend: let the LLM read it.
  const reply = await backend.complete({
    role: "parser",
    system: PARSER_SYSTEM,
    prompt: `Digitise this menu text into the JSON format:\n\n${text.slice(0, 20_000)}`,
  });
  return ParsedMenuSchema.parse(extractJson(reply));
}

// ------------------------------------------------------------ normalize ----

export function normalizeStage(parsed: ParsedMenu, input: AnalyzeInput): {
  items: MenuItem[];
  skipped: number;
} {
  const items: MenuItem[] = [];
  let skipped = 0;
  const seen = new Set<string>();

  parsed.items.forEach((p, i) => {
    if (p.price == null) {
      skipped++;
      return;
    }
    let id = `${p.category}-${p.name}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    if (!id || seen.has(id)) id = `${id || "item"}-${i}`;
    seen.add(id);
    items.push({
      id,
      name: p.name,
      category: p.category,
      description: p.description ?? null,
      price: p.price,
      cost: input.knownCosts?.[id] ?? null,
      unitsSold: input.knownSales?.[id] ?? null,
    });
  });

  return { items, skipped };
}

// ------------------------------------------------------------- estimate ----

const ESTIMATOR_SYSTEM = `You estimate food-cost shares and relative popularity for menu items,
as directional priors for menu engineering. Return ONLY JSON:
{"estimates":[{"id","costShare":0.05-0.9,"popularity":0-1}]}.
costShare = typical ingredient cost / menu price for that dish family in Spain.
popularity is relative within the item's own category. Be conservative.`;

export async function estimateStage(
  items: MenuItem[],
  backend: LlmBackend,
): Promise<MenuItem[]> {
  // Deterministic priors first — they are also the fallback and the clamp.
  const byCategory = new Map<string, MenuItem[]>();
  for (const it of items) {
    const arr = byCategory.get(it.category) ?? [];
    arr.push(it);
    byCategory.set(it.category, arr);
  }
  const withPriors = items.map((it) => {
    const cat = byCategory.get(it.category)!;
    const idx = cat.indexOf(it);
    return {
      ...it,
      estimatedCost: it.cost ?? round2(it.price * costShareFor(it.name, it.category)),
      estimatedPopularity: it.unitsSold ?? popularityFor(it.name, idx, cat.length),
    } as MenuItem;
  });

  const needsEstimate = withPriors.filter((i) => i.cost == null || i.unitsSold == null);
  if (backend.name !== "anthropic" || needsEstimate.length === 0) return withPriors;

  try {
    const listing = needsEstimate
      .map((i) => `${i.id} | ${i.name} | ${i.category} | ${i.price}€`)
      .slice(0, 250)
      .join("\n");
    const reply = await backend.complete({
      role: "estimator",
      system: ESTIMATOR_SYSTEM,
      prompt: `Restaurant menu items (id | name | category | price):\n${listing}`,
    });
    const parsed = EstimateSchema.parse(extractJson(reply));
    const byId = new Map(parsed.estimates.map((e) => [e.id, e]));
    return withPriors.map((it) => {
      const e = byId.get(it.id);
      if (!e) return it;
      return {
        ...it,
        estimatedCost: it.cost ?? round2(it.price * e.costShare),
        estimatedPopularity: it.unitsSold ?? e.popularity,
      };
    });
  } catch {
    return withPriors; // LLM refinement is optional by design
  }
}

// ---------------------------------------------------------- competitors ----

export function competitorStage(
  items: MenuItem[],
  input: AnalyzeInput,
): { benchmarks: Map<string, MarketBenchmark>; competitorItems: number } {
  const zone = input.profile.marketZone ? zoneBenchmarks(input.profile.marketZone) : new Map<string, MarketBenchmark>();

  // Competitor menus the user pasted beat the generic zone dataset.
  const prices = new Map<string, number[]>();
  let competitorItems = 0;
  for (const text of input.competitorTexts ?? []) {
    for (const p of textParse(text).items) {
      if (p.price == null) continue;
      const key = marketKeyFor(p);
      if (!key) continue;
      competitorItems++;
      const arr = prices.get(key) ?? [];
      arr.push(p.price);
      prices.set(key, arr);
    }
  }
  const merged = new Map(zone);
  for (const [key, arr] of prices) {
    if (arr.length < 3) continue; // too thin to overrule the dataset
    const sorted = [...arr].sort((a, b) => a - b);
    merged.set(key, {
      itemKey: key,
      low: sorted[0],
      typical: sorted[Math.floor(sorted.length / 2)],
      high: sorted[sorted.length - 1],
      source: `competitor menus provided by user (${arr.length} prices)`,
    });
  }

  // Item-level map for the pricing engine.
  const perItem = new Map<string, MarketBenchmark>();
  for (const it of items) {
    const key = marketKeyFor(it);
    if (!key) continue;
    const bench = merged.get(key);
    if (bench) perItem.set(it.id, bench);
  }
  return { benchmarks: perItem, competitorItems };
}

// --------------------------------------------------------------- doctor ----

const GENERIC_WORDS = /delicious|tasty|amazing|best|rico|deliciosa?|buenísim|increíble|great|nice/i;
const SENSORY_WORDS = /crisp|crunch|smoked|ahumad|caramel|slow|braised|tender|jugos|melos|crujiente|trufa|truffle|wood-?fired|charred|glazed|velvety|sizzl/i;

/** Deterministic copy audit; the live LLM path adds rewrites on top. */
export function deterministicDoctor(items: MenuItem[]): DoctorResult {
  const findings: DoctorResult["findings"] = [];
  let good = 0;
  for (const it of items) {
    const d = it.description?.trim() ?? "";
    if (!d) findings.push({ itemId: it.id, issue: "bare", rewrite: null });
    else if (d.length > 220) findings.push({ itemId: it.id, issue: "overlong", rewrite: null });
    else if (GENERIC_WORDS.test(d) && !SENSORY_WORDS.test(d))
      findings.push({ itemId: it.id, issue: "generic", rewrite: null });
    else {
      findings.push({ itemId: it.id, issue: "good", rewrite: null });
      good++;
    }
  }
  const structure: string[] = [];
  const byCategory = new Map<string, number>();
  for (const it of items) byCategory.set(it.category, (byCategory.get(it.category) ?? 0) + 1);
  for (const [cat, n] of byCategory) {
    if (n > 12) structure.push(`category-too-long:${cat}:${n}`);
  }
  const copyScore = items.length > 0 ? Math.round((good / items.length) * 100) : 0;
  return { copyScore, findings, structure };
}

const DOCTOR_SYSTEM = `You are a menu-copy doctor. Audit descriptions for selling power
(descriptive, sensory, honest language sells measurably better than bare or generic copy).
Return ONLY JSON: {"copyScore":0-100,"findings":[{"id","issue":"bare|generic|overlong|good","rewrite":string|null}],"structure":[strings]}.
Rewrites: only for items worth fixing, max 160 chars, same language as the item, sensory and
specific, NEVER invent ingredients not implied by the name/description.`;

export async function doctorStage(
  items: MenuItem[],
  backend: LlmBackend,
  focusIds: string[],
): Promise<DoctorResult> {
  const deterministic = deterministicDoctor(items);
  if (backend.name !== "anthropic") return deterministic;
  try {
    const listing = items
      .slice(0, 200)
      .map((i) => `${i.id} | ${i.name} | ${i.description ?? "—"}`)
      .join("\n");
    const reply = await backend.complete({
      role: "doctor",
      system: DOCTOR_SYSTEM,
      prompt: `Menu items (id | name | description). Prioritise rewrites for these ids: ${focusIds.join(", ") || "none"}.\n\n${listing}`,
    });
    const parsed = DoctorSchema.parse(extractJson(reply));
    return {
      copyScore: parsed.copyScore,
      findings: parsed.findings.map((f) => ({
        itemId: f.id,
        issue: f.issue,
        rewrite: f.rewrite ?? null,
      })),
      structure: parsed.structure,
    };
  } catch {
    return deterministic;
  }
}

// --------------------------------------------------------------- report ----

interface ReportParts {
  items: MenuItem[];
  matrix: MatrixResult;
  omnes: OmnesReport[];
  pricing: PriceRecommendation[];
  compliance: ComplianceFinding[];
  doctor: DoctorResult;
  score: MenuScore;
  locale: "en" | "es";
}

/** Template summary from engine numbers — fixture/demo path and LLM fallback. */
export function deterministicReport(p: ReportParts): { summary: string[]; quickWins: string[] } {
  const counts = { star: 0, plowhorse: 0, puzzle: 0, dog: 0 };
  for (const g of p.matrix.groups)
    for (const ci of g.items) if (ci.classification) counts[ci.classification]++;
  const moves = p.pricing.filter((r) => r.suggested !== r.current).length;
  const required = p.compliance.filter((f) => f.severity === "required").length;
  const dispersionFails = p.omnes.filter((o) => o.dispersion.pass === false).length;

  const en = {
    summary: [
      `Overall menu score: ${p.score.total}/100. Of ${p.items.length} priced items, ${counts.star} classify as stars, ${counts.plowhorse} as plowhorses, ${counts.puzzle} as puzzles and ${counts.dog} as dogs${p.matrix.mode !== "actual" ? " (estimated mode — based on documented priors, not your sales data)" : ""}.`,
      `Price architecture: ${dispersionFails === 0 ? "price dispersion is within Omnes' 3× guideline in every category" : `${dispersionFails} categor${dispersionFails === 1 ? "y breaks" : "ies break"} Omnes' 3× dispersion guideline`}. ${moves} price adjustments are recommended, each tied to an explicit rule.`,
      `Copy quality scores ${p.doctor.copyScore}/100. ${required > 0 ? `⚠ ${required} legal requirement${required === 1 ? " is" : "s are"} unmet — see compliance.` : "No blocking compliance issues were detected."}`,
    ],
    quickWins: [
      counts.dog > 0 ? `Rework or retire the ${counts.dog} dog item${counts.dog === 1 ? "" : "s"} — they occupy space without earning it.` : `Feature your ${counts.star} star items more prominently (top of category, boxed).`,
      moves > 0 ? `Apply the ${moves} recommended price moves — all are small, rule-based and reversible.` : "Prices are broadly sound; revisit after the next cost review.",
      p.doctor.copyScore < 70 ? "Rewrite bare/generic descriptions with sensory, specific language — measured uplift in the literature is meaningful." : "Keep descriptions sensory and specific.",
      required > 0 ? "Fix the compliance findings before anything else — they carry fine risk." : "Add a visible allergen note to every menu format you print.",
    ],
  };

  const es = {
    summary: [
      `Puntuación global de la carta: ${p.score.total}/100. De ${p.items.length} referencias con precio, ${counts.star} son estrellas, ${counts.plowhorse} caballos de tiro, ${counts.puzzle} puzzles y ${counts.dog} perros${p.matrix.mode !== "actual" ? " (modo estimado — según priors documentados, no tus ventas reales)" : ""}.`,
      `Arquitectura de precios: ${dispersionFails === 0 ? "la dispersión respeta la regla del 3× de Omnes en todas las categorías" : `${dispersionFails} categoría${dispersionFails === 1 ? " rompe" : "s rompen"} la regla del 3× de Omnes`}. Se recomiendan ${moves} ajustes de precio, cada uno ligado a una regla explícita.`,
      `La calidad del copy puntúa ${p.doctor.copyScore}/100. ${required > 0 ? `⚠ Hay ${required} requisito${required === 1 ? "" : "s"} legal${required === 1 ? "" : "es"} sin cumplir — ver compliance.` : "No se detectaron problemas legales bloqueantes."}`,
    ],
    quickWins: [
      counts.dog > 0 ? `Reformula o retira los ${counts.dog} platos "perro" — ocupan carta sin ganársela.` : `Destaca más tus ${counts.star} platos estrella (arriba de su sección, recuadrados).`,
      moves > 0 ? `Aplica los ${moves} ajustes de precio recomendados — pequeños, con regla y reversibles.` : "Los precios están razonablemente bien; revisa tras el próximo cambio de costes.",
      p.doctor.copyScore < 70 ? "Reescribe las descripciones vacías o genéricas con lenguaje sensorial y específico." : "Mantén descripciones sensoriales y específicas.",
      required > 0 ? "Corrige los avisos de compliance antes que nada — llevan riesgo de multa." : "Añade una nota de alérgenos visible en todos los formatos de la carta.",
    ],
  };

  return p.locale === "es" ? es : en;
}

const WRITER_SYSTEM = `You write the executive summary of a menu-engineering report for a
restaurant owner. Plain, concrete, numbers-first, no hype. Return ONLY JSON:
{"summary":[2-4 paragraphs],"quickWins":[3-6 one-line actions]}. Write in the language requested.
Use ONLY the numbers provided — never invent figures.`;

export async function reportStage(
  parts: ReportParts,
  backend: LlmBackend,
): Promise<{ summary: string[]; quickWins: string[] }> {
  const deterministic = deterministicReport(parts);
  if (backend.name !== "anthropic") return deterministic;
  try {
    const { ReportSchema } = await import("./schemas");
    const reply = await backend.complete({
      role: "writer",
      system: WRITER_SYSTEM,
      prompt: `Language: ${parts.locale}. Facts (JSON): ${JSON.stringify({
        score: parts.score,
        matrixMode: parts.matrix.mode,
        deterministicDraft: deterministic,
        complianceCodes: parts.compliance.map((c) => ({ code: c.code, severity: c.severity })),
      })}`,
    });
    return ReportSchema.parse(extractJson(reply));
  } catch {
    return deterministic;
  }
}

// ------------------------------------------------------------ pure glue ----

export function engineStages(
  items: MenuItem[],
  input: AnalyzeInput,
  benchmarks: Map<string, MarketBenchmark>,
  allergenInfoPresent: boolean,
) {
  const matrix = buildMatrix(items);
  const omnes = omnesReport(items);
  const pricing = recommendPrices({
    groups: matrix.groups,
    positioning: input.profile.positioning,
    market: benchmarks,
  });
  const compliance = auditCompliance(
    { items, rawText: input.menuText ?? "", allergenInfoPresent },
    input.profile.region,
  );
  return { matrix, omnes, pricing, compliance };
}
