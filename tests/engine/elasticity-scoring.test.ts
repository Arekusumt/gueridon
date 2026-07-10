import { describe, expect, it } from "vitest";
import {
  auditCompliance,
  buildMatrix,
  menuScore,
  omnesReport,
  recommendPrices,
  simulatePriceChange,
} from "@/lib/engine";
import type { MenuItem } from "@/lib/engine";

describe("simulatePriceChange", () => {
  it("keeps revenue flat at unit elasticity", () => {
    const r = simulatePriceChange({ price: 10, newPrice: 12, unitsSold: 100, elasticity: 1 });
    expect(r.revenue1).toBeCloseTo(r.revenue0, 2);
  });

  it("grows margin on inelastic items when price rises", () => {
    const r = simulatePriceChange({ price: 5, newPrice: 5.5, unitsSold: 200, cost: 1, elasticity: 0.8 });
    expect(r.marginDeltaPct).toBeGreaterThan(0);
  });

  it("rejects nonsense inputs", () => {
    expect(() => simulatePriceChange({ price: 0, newPrice: 5, unitsSold: 10, elasticity: 1 })).toThrow(RangeError);
    expect(() => simulatePriceChange({ price: 5, newPrice: 5, unitsSold: 10, elasticity: -1 })).toThrow(RangeError);
  });
});

describe("menuScore", () => {
  const healthy: MenuItem[] = [
    { id: "a", name: "A", category: "mains", price: 14, cost: 4, unitsSold: 90 },
    { id: "b", name: "B", category: "mains", price: 16, cost: 5, unitsSold: 80 },
    { id: "c", name: "C", category: "mains", price: 19, cost: 6, unitsSold: 70 },
  ];

  function scoreFor(items: MenuItem[], allergens: boolean) {
    const matrix = buildMatrix(items);
    const omnes = omnesReport(items);
    const pricing = recommendPrices({ groups: matrix.groups, positioning: "mid" });
    const compliance = auditCompliance({ items, allergenInfoPresent: allergens }, { country: "ES" });
    return menuScore({ matrix, omnes, pricing, compliance });
  }

  it("scores a healthy menu above a non-compliant one", () => {
    const good = scoreFor(healthy, true);
    const bad = scoreFor(healthy, false);
    expect(good.total).toBeGreaterThan(bad.total);
    expect(bad.subscores.compliance).toBeLessThanOrEqual(50);
  });

  it("stays in 0..100 and renormalises without a copy score", () => {
    const s = scoreFor(healthy, true);
    expect(s.total).toBeGreaterThanOrEqual(0);
    expect(s.total).toBeLessThanOrEqual(100);
    expect(s.subscores.copy).toBeNull();
    expect(s.notes).toContain("copy-unscored");
  });
});
