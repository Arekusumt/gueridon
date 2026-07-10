import { describe, expect, it } from "vitest";
import { fixtureBackend } from "@/lib/pipeline/llm";
import { checkRateLimit } from "@/lib/pipeline/ratelimit";
import { runPipeline } from "@/lib/pipeline/run";
import { textParse } from "@/lib/pipeline/stages";
import type { AnalyzeInput, PipelineEvent } from "@/lib/pipeline/types";

const MENU = `
STARTERS
Garlic Bread ..... 4.50
Patatas Bravas
crispy potatoes, smoked paprika aioli ..... 6.50
Nachos Grande ..... 9.95

MAINS
Cheese Burger
double smashed patty, aged cheddar ..... 12.90
Fish & Chips ..... 13.50
Tripe Stew ..... 9.00
Ribeye Steak 300g ..... 24.50

DRINKS
Guinness Pint ..... 5.50
Coca-Cola ..... 2.50
Gin Tonic ..... 8.00

Allergen information available on request.
`;

const INPUT: AnalyzeInput = {
  profile: {
    name: "Test Pub",
    location: "La Pineda",
    cuisine: "pub",
    positioning: "mid",
    region: { country: "ES", catalonia: true },
    marketZone: "tarragona",
    locale: "en",
  },
  menuText: MENU,
};

const fixture = fixtureBackend(() => {
  throw new Error("fixture path should be fully deterministic");
});

describe("textParse", () => {
  it("reads items, sections, descriptions and prices", () => {
    const parsed = textParse(MENU);
    expect(parsed.items.length).toBe(10);
    const bravas = parsed.items.find((i) => i.name === "Patatas Bravas")!;
    expect(bravas.price).toBe(6.5);
    expect(bravas.category).toBe("STARTERS");
    expect(bravas.description).toMatch(/aioli/);
    expect(parsed.allergenInfoPresent).toBe(true);
  });

  it("handles comma decimals and euro signs", () => {
    const parsed = textParse("CARTA\nCroquetas caseras ... 7,50 €\nCaña 2,20");
    expect(parsed.items.map((i) => i.price)).toEqual([7.5, 2.2]);
  });
});

describe("runPipeline (fixture mode, end to end)", () => {
  it("produces a full analysis with zero LLM calls", async () => {
    const events: PipelineEvent[] = [];
    const gen = runPipeline(INPUT, fixture);
    let next = await gen.next();
    while (!next.done) {
      events.push(next.value);
      next = await gen.next();
    }
    const result = next.value;

    // All 8 stages ran, in order, with start+done pairs.
    const stages = [...new Set(events.map((e) => e.stage))];
    expect(stages).toEqual([
      "parse", "normalize", "estimate", "competitors",
      "pricing", "doctor", "compliance", "report",
    ]);
    expect(events.every((e) => e.status !== "error")).toBe(true);

    expect(result.items).toHaveLength(10);
    expect(result.meta.mode).toBe("fixture");
    expect(result.meta.dataQuality).toBe("heuristic");
    expect(result.score.total).toBeGreaterThanOrEqual(0);
    expect(result.score.total).toBeLessThanOrEqual(100);
    expect(result.summary.length).toBeGreaterThanOrEqual(2);
    expect(result.quickWins.length).toBeGreaterThanOrEqual(3);

    // Benchmarks matched against the Tarragona dataset.
    expect(result.benchmarks.length).toBeGreaterThan(5);

    // Compliance: allergens declared → no required allergen finding.
    expect(result.compliance.some((f) => f.code === "ALLERGENS_MISSING")).toBe(false);
  });

  it("rejects photo input without a live backend", async () => {
    const gen = runPipeline(
      { ...INPUT, menuText: undefined, images: [{ data: "x", mediaType: "image/jpeg" }] },
      fixture,
    );
    await expect(async () => {
      let n = await gen.next();
      while (!n.done) n = await gen.next();
    }).rejects.toThrow("PHOTO_NEEDS_LIVE");
  });

  it("localises the report in Spanish", async () => {
    const gen = runPipeline(
      { ...INPUT, profile: { ...INPUT.profile, locale: "es" } },
      fixture,
    );
    let n = await gen.next();
    while (!n.done) n = await gen.next();
    expect(n.value.summary[0]).toMatch(/Puntuación global/);
  });
});

describe("checkRateLimit", () => {
  it("allows three per day then blocks, with tamper-proof cookies", () => {
    let cookie: string | undefined;
    for (let i = 0; i < 3; i++) {
      const r = checkRateLimit(cookie);
      expect(r.allowed).toBe(true);
      cookie = r.cookie;
    }
    expect(checkRateLimit(cookie).allowed).toBe(false);
    // Tampering with the count resets nothing — signature fails, so it
    // behaves like a fresh visitor (documented ponytail trade-off).
    const [day] = cookie!.split(":");
    expect(checkRateLimit(`${day}:0:badsig`).allowed).toBe(true);
  });
});
