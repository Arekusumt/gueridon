import { describe, expect, it } from "vitest";
import { auditCompliance, EU_ALLERGENS } from "@/lib/engine";
import type { MenuItem } from "@/lib/engine";

const items: MenuItem[] = [
  { id: "1", name: "Fish & Chips", category: "mains", price: 12.5 },
  { id: "2", name: "Guinness", category: "drinks", price: 5 },
];

describe("auditCompliance", () => {
  it("lists exactly the 14 EU allergens", () => {
    expect(EU_ALLERGENS).toHaveLength(14);
  });

  it("requires allergen declaration in Spain when absent", () => {
    const findings = auditCompliance({ items }, { country: "ES" });
    expect(findings.some((f) => f.code === "ALLERGENS_MISSING" && f.severity === "required")).toBe(true);
  });

  it("accepts an allergen note anywhere on the menu", () => {
    const findings = auditCompliance(
      { items, rawText: "Información de alérgenos disponible: pregunte al personal" },
      { country: "ES" },
    );
    expect(findings.some((f) => f.code === "ALLERGENS_MISSING")).toBe(false);
  });

  it("treats alcohol promos as required-fix in Catalonia, warning elsewhere", () => {
    const promo: MenuItem[] = [
      ...items,
      { id: "3", name: "Happy Hour 2x1 cocktails", category: "drinks", price: 8 },
    ];
    const cat = auditCompliance({ items: promo, allergenInfoPresent: true }, { country: "ES", catalonia: true });
    const promoCat = cat.find((f) => f.code === "ALCOHOL_PROMO")!;
    expect(promoCat.severity).toBe("required");
    expect(promoCat.itemIds).toEqual(["3"]);

    const madrid = auditCompliance({ items: promo, allergenInfoPresent: true }, { country: "ES" });
    expect(madrid.find((f) => f.code === "ALCOHOL_PROMO")!.severity).toBe("warning");
  });

  it("emits only info reminders for a clean Spanish menu", () => {
    const findings = auditCompliance({ items, allergenInfoPresent: true }, { country: "ES" });
    expect(findings.every((f) => f.severity === "info")).toBe(true);
  });
});
