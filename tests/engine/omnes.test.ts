import { describe, expect, it } from "vitest";
import { omnesReport } from "@/lib/engine";
import type { MenuItem } from "@/lib/engine";

function item(id: string, price: number, unitsSold?: number): MenuItem {
  return { id, name: id, category: "mains", price, unitsSold };
}

describe("omnesReport", () => {
  it("fails dispersion beyond 3x and passes within", () => {
    const bad = omnesReport([item("a", 5), item("b", 10), item("c", 21)])[0];
    expect(bad.dispersion.ratio).toBeCloseTo(4.2, 2);
    expect(bad.dispersion.pass).toBe(false);

    const good = omnesReport([item("a", 8), item("b", 14), item("c", 20)])[0];
    expect(good.dispersion.pass).toBe(true);
  });

  it("wants the middle band at least as full as the extremes", () => {
    // Range 10–22, bands: [10,14) [14,18] (18,22]
    const balanced = omnesReport([
      item("a", 10), item("b", 15), item("c", 16), item("d", 22),
    ])[0];
    expect(balanced.bands.pass).toBe(true);
    expect(balanced.bands.middle).toEqual(["b", "c"]);

    const barbell = omnesReport([
      item("a", 10), item("b", 10.5), item("c", 21), item("d", 22),
    ])[0];
    expect(barbell.bands.pass).toBe(false);
  });

  it("computes offered/demanded ratio from sales", () => {
    // Guests overwhelmingly buy the cheap dish → menu prices above demand.
    const r = omnesReport([
      item("cheap", 10, 90),
      item("mid", 16, 10),
      item("dear", 24, 0),
    ])[0];
    expect(r.priceDemand.demandedMean).toBeCloseTo(10.6, 1);
    expect(r.priceDemand.ratio).toBeGreaterThan(1);
    expect(r.priceDemand.pass).toBe(false);
  });

  it("skips price/demand without sales data", () => {
    const r = omnesReport([item("a", 10), item("b", 12), item("c", 14)])[0];
    expect(r.priceDemand.demandedMean).toBeNull();
    expect(r.priceDemand.pass).toBeNull();
  });

  it("flags small categories instead of judging them", () => {
    const r = omnesReport([item("a", 5), item("b", 30)])[0];
    expect(r.dispersion.pass).toBeNull();
    expect(r.notes).toContain("small-category");
  });
});
