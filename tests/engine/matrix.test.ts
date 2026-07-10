import { describe, expect, it } from "vitest";
import { buildMatrix } from "@/lib/engine";
import type { MenuItem } from "@/lib/engine";

const mains: MenuItem[] = [
  // 4-item category crafted so each lands in a different quadrant.
  // Equal share = 25 %, popularity cutoff = 17.5 %.
  { id: "star", name: "Ribeye", category: "mains", price: 20, cost: 8, unitsSold: 100 },
  { id: "plow", name: "Burger", category: "mains", price: 10, cost: 6, unitsSold: 120 },
  { id: "puzzle", name: "Lobster", category: "mains", price: 30, cost: 12, unitsSold: 20 },
  { id: "dog", name: "Tripe", category: "mains", price: 9, cost: 6, unitsSold: 10 },
];

describe("buildMatrix (actual data)", () => {
  const result = buildMatrix(mains);
  const group = result.groups[0];
  const byId = Object.fromEntries(group.items.map((c) => [c.item.id, c]));

  it("classifies each quadrant", () => {
    expect(byId.star.classification).toBe("star");
    expect(byId.plow.classification).toBe("plowhorse");
    expect(byId.puzzle.classification).toBe("puzzle");
    expect(byId.dog.classification).toBe("dog");
  });

  it("uses the demand-weighted CM threshold", () => {
    // totalCM = 12*100 + 4*120 + 18*20 + 3*10 = 2070; units = 250 → 8.28
    expect(group.cmThreshold).toBeCloseTo(8.28, 2);
  });

  it("reports actual mode", () => {
    expect(result.mode).toBe("actual");
    expect(byId.star.dataQuality).toBe("actual");
  });
});

describe("buildMatrix (heuristic data)", () => {
  it("classifies from estimates and flags the mode", () => {
    const items: MenuItem[] = [
      { id: "a", name: "A", category: "c", price: 12, estimatedCost: 4, estimatedPopularity: 0.6 },
      { id: "b", name: "B", category: "c", price: 11, estimatedCost: 6, estimatedPopularity: 0.1 },
    ];
    const result = buildMatrix(items);
    expect(result.mode).toBe("heuristic");
    const a = result.groups[0].items.find((c) => c.item.id === "a")!;
    expect(a.classification).toBe("star");
    expect(a.dataQuality).toBe("estimated");
  });
});

describe("buildMatrix (degenerate cases)", () => {
  it("leaves single-item categories unclassified", () => {
    const result = buildMatrix([
      { id: "solo", name: "Solo", category: "specials", price: 15, cost: 5, unitsSold: 50 },
    ]);
    expect(result.groups[0].items[0].classification).toBeNull();
    expect(result.groups[0].notes).toContain("single-item-category");
  });

  it("marks items without any cost/sales signal as insufficient", () => {
    const result = buildMatrix([
      { id: "x", name: "X", category: "c", price: 10 },
      { id: "y", name: "Y", category: "c", price: 12 },
    ]);
    for (const ci of result.groups[0].items) {
      expect(ci.classification).toBeNull();
      expect(ci.dataQuality).toBe("insufficient");
    }
  });
});
