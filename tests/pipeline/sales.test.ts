import { describe, expect, it } from "vitest";
import { fixtureBackend } from "@/lib/pipeline/llm";
import { runPipeline } from "@/lib/pipeline/run";
import { normalizeStage, textParse } from "@/lib/pipeline/stages";
import type { AnalyzeInput } from "@/lib/pipeline/types";
import { aggregateSales, parseSalesCsv, slugifyName } from "@/lib/sales";

const MENU = `
MAINS
Fish & Chips ..... 13.50
Cheese Burger ..... 12.90

DRINKS
Guinness Pint ..... 5.50
`;

const PROFILE: AnalyzeInput["profile"] = {
  name: "Test Pub",
  location: "La Pineda",
  cuisine: "pub",
  positioning: "mid",
  region: { country: "ES", catalonia: true },
  marketZone: null,
  locale: "en",
};

const fixture = fixtureBackend(() => {
  throw new Error("fixture path should be fully deterministic");
});

describe("parseSalesCsv", () => {
  it("reads English headers with commas and quoted dish names", () => {
    const { rows, periods } = parseSalesCsv(
      'dish,units sold,food cost,period\n"Fish & Chips",210,4.20,summer\nCheese Burger,150,3.90,summer\n',
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ dish: "Fish & Chips", units: 210, cost: 4.2, period: "summer" });
    expect(periods).toEqual(["summer"]);
  });

  it("reads Spanish headers, semicolons, decimal commas and seasons", () => {
    const { rows, periods } = parseSalesCsv(
      "plato;unidades;coste;temporada\nFish & Chips;120;4,35;invierno\nFish & Chips;210;4,20;verano\nGuinness Pint;900;1,10;verano\n",
    );
    expect(rows).toHaveLength(3);
    expect(rows[0].cost).toBe(4.35);
    expect(periods).toEqual(["invierno", "verano"]);
  });

  it("falls back to positional columns when there is no header", () => {
    const { rows, periods } = parseSalesCsv("Fish & Chips,210,4.20\nCheese Burger,150\n");
    expect(rows).toHaveLength(2);
    expect(rows[0].units).toBe(210);
    expect(rows[1].cost).toBeNull();
    expect(periods).toEqual([]);
  });

  it("returns nothing for files with no usable numbers", () => {
    expect(parseSalesCsv("hello\nworld").rows).toHaveLength(0);
    expect(parseSalesCsv("").rows).toHaveLength(0);
  });
});

describe("aggregateSales", () => {
  const rows = parseSalesCsv(
    "plato;unidades;coste;temporada\nFish & Chips;120;4,50;invierno\nFish & Chips;240;4,20;verano\nGuinness Pint;900;;verano\n",
  ).rows;

  it("sums units and weights cost by units across selected periods", () => {
    const all = aggregateSales(rows, null);
    expect(all.sales[slugifyName("Fish & Chips")]).toBe(360);
    // (4.50·120 + 4.20·240) / 360 = 4.30
    expect(all.costs[slugifyName("Fish & Chips")]).toBe(4.3);
    expect(all.dishes).toBe(2);
  });

  it("filters by season", () => {
    const summer = aggregateSales(rows, new Set(["verano"]));
    expect(summer.sales[slugifyName("Fish & Chips")]).toBe(240);
    expect(summer.costs[slugifyName("Fish & Chips")]).toBe(4.2);
    expect(summer.sales[slugifyName("Guinness Pint")]).toBe(900);
  });
});

describe("known numbers reach the engine", () => {
  it("normalizeStage matches by dish-name slug as well as by id", () => {
    const parsed = textParse(MENU);
    const input: AnalyzeInput = {
      profile: PROFILE,
      menuText: MENU,
      knownSales: { [slugifyName("Fish & Chips")]: 360, "mains-cheese-burger": 150 },
      knownCosts: { [slugifyName("Fish & Chips")]: 4.3 },
    };
    const { items } = normalizeStage(parsed, input);
    const fish = items.find((i) => i.name === "Fish & Chips")!;
    expect(fish.unitsSold).toBe(360);
    expect(fish.cost).toBe(4.3);
    expect(items.find((i) => i.name === "Cheese Burger")!.unitsSold).toBe(150);
  });

  it("full sales+cost data flips the analysis to measured mode", async () => {
    const names = textParse(MENU).items.map((i) => i.name);
    const input: AnalyzeInput = {
      profile: PROFILE,
      menuText: MENU,
      knownSales: Object.fromEntries(names.map((n, i) => [slugifyName(n), 100 + i * 50])),
      knownCosts: Object.fromEntries(names.map((n) => [slugifyName(n), 3])),
    };
    const gen = runPipeline(input, fixture);
    let n = await gen.next();
    while (!n.done) n = await gen.next();
    expect(n.value.meta.dataQuality).toBe("actual");
    expect(n.value.items.every((i) => i.unitsSold != null && i.cost != null)).toBe(true);
  });
});
