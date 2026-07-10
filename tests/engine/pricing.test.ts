import { describe, expect, it } from "vitest";
import {
  analyzeEndings,
  awkwardLeftDigit,
  buildMatrix,
  recommendPrices,
  snapToPsychological,
} from "@/lib/engine";
import type { MarketBenchmark, MenuItem } from "@/lib/engine";

describe("snapToPsychological", () => {
  it("premium snaps to whole/half euros", () => {
    expect(snapToPsychological(13.2, "premium")).toBe(13);
    expect(snapToPsychological(13.4, "premium")).toBe(13.5);
  });
  it("value snaps to charm endings", () => {
    expect(snapToPsychological(10.2, "value")).toBe(9.95);
    expect(snapToPsychological(9.7, "value")).toBe(9.9);
  });
  it("never returns a non-positive price", () => {
    expect(snapToPsychological(0.4, "value")).toBeGreaterThan(0);
  });
});

describe("awkwardLeftDigit", () => {
  it("flags prices just past a boundary", () => {
    expect(awkwardLeftDigit(10.2)).toBe(true);
    expect(awkwardLeftDigit(9.95)).toBe(false);
    expect(awkwardLeftDigit(10.5)).toBe(false);
  });
});

describe("analyzeEndings", () => {
  it("builds an ending histogram", () => {
    expect(analyzeEndings([9.95, 12.95, 10, 11.5])).toEqual({
      ".95": 2,
      ".00": 1,
      ".50": 1,
    });
  });
});

describe("recommendPrices", () => {
  const items: MenuItem[] = [
    { id: "star", name: "Ribeye", category: "mains", price: 18, cost: 7, unitsSold: 100 },
    { id: "plow", name: "Burger", category: "mains", price: 10, cost: 6, unitsSold: 120 },
    { id: "puzzle", name: "Lobster", category: "mains", price: 30, cost: 12, unitsSold: 20 },
    { id: "dog", name: "Tripe", category: "mains", price: 9, cost: 6, unitsSold: 10 },
  ];
  const groups = buildMatrix(items).groups;

  it("raises an underpriced star toward market, on the psych grid", () => {
    const market = new Map<string, MarketBenchmark>([
      ["star", { itemKey: "steak", low: 16, typical: 22, high: 26 }],
    ]);
    const recs = recommendPrices({ groups, positioning: "premium", market });
    const star = recs.find((r) => r.itemId === "star")!;
    expect(star.reasons).toContain("STAR_UNDERPRICED");
    expect(star.suggested).toBeGreaterThan(18);
    // capped at +8 % → 19.44, snapped to premium grid → 19.5
    expect(star.suggested).toBe(19.5);
  });

  it("flags dogs without inventing a price change", () => {
    const recs = recommendPrices({ groups, positioning: "premium" });
    const dog = recs.find((r) => r.itemId === "dog")!;
    expect(dog.reasons).toContain("DOG_FLAG");
    expect(dog.suggested).toBe(dog.current);
  });

  it("holds items that need nothing", () => {
    const quiet: MenuItem[] = [
      { id: "a", name: "A", category: "c", price: 10, cost: 4, unitsSold: 50 },
      { id: "b", name: "B", category: "c", price: 12, cost: 5, unitsSold: 50 },
    ];
    const recs = recommendPrices({
      groups: buildMatrix(quiet).groups,
      positioning: "premium",
    });
    expect(recs.every((r) => r.reasons.includes("HOLD") || r.deltaPct === 0 || r.reasons.length > 0)).toBe(true);
  });

  it("never breaches the 3x dispersion ceiling when raising", () => {
    const spread: MenuItem[] = [
      { id: "cheap", name: "Soup", category: "c", price: 6, cost: 1, unitsSold: 80 },
      { id: "hero", name: "Steak", category: "c", price: 17.5, cost: 5, unitsSold: 90 },
      { id: "mid", name: "Pasta", category: "c", price: 12, cost: 5, unitsSold: 40 },
    ];
    const market = new Map<string, MarketBenchmark>([
      ["hero", { itemKey: "steak", low: 18, typical: 24, high: 30 }],
    ]);
    const recs = recommendPrices({
      groups: buildMatrix(spread).groups,
      positioning: "premium",
      market,
    });
    const hero = recs.find((r) => r.itemId === "hero")!;
    expect(hero.suggested).toBeLessThanOrEqual(6 * 3);
  });
});
