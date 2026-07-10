/**
 * Legal compliance checks for menus sold in Spain (with Catalonia extras).
 *
 * These are informational pre-checks, not legal advice; every finding points
 * at the law behind it (lawRef = bibliography id). Exact article numbers are
 * kept in the bibliography entry, which is verified against primary sources.
 */

import type { ComplianceFinding, MenuItem, Region } from "./types";

/** The 14 allergens of mandatory declaration — Regulation (EU) 1169/2011, Annex II. */
export const EU_ALLERGENS: ReadonlyArray<{ id: string; en: string; es: string }> = [
  { id: "gluten", en: "Cereals containing gluten", es: "Cereales con gluten" },
  { id: "crustaceans", en: "Crustaceans", es: "Crustáceos" },
  { id: "eggs", en: "Eggs", es: "Huevos" },
  { id: "fish", en: "Fish", es: "Pescado" },
  { id: "peanuts", en: "Peanuts", es: "Cacahuetes" },
  { id: "soybeans", en: "Soybeans", es: "Soja" },
  { id: "milk", en: "Milk (incl. lactose)", es: "Leche (incl. lactosa)" },
  { id: "nuts", en: "Tree nuts", es: "Frutos de cáscara" },
  { id: "celery", en: "Celery", es: "Apio" },
  { id: "mustard", en: "Mustard", es: "Mostaza" },
  { id: "sesame", en: "Sesame seeds", es: "Granos de sésamo" },
  { id: "sulphites", en: "Sulphur dioxide & sulphites", es: "Dióxido de azufre y sulfitos" },
  { id: "lupin", en: "Lupin", es: "Altramuces" },
  { id: "molluscs", en: "Molluscs", es: "Moluscos" },
];

export const ALLERGEN_DECLARATION_HINTS =
  /al[eé]rgen|allergen|allergy|intoleran|1169\/2011/i;

/** Drink promotions banned in Catalonia (Llei 20/1985) & risky elsewhere. */
const ALCOHOL_PROMO_PATTERN =
  /happy\s*hour|2\s*x\s*1|dos\s+por\s+uno|3\s*x\s*2|barra\s+libre|open\s+bar|free\s+(shots?|drinks?|beer|round)|chupitos?\s+gratis|ronda\s+gratis|copa\s+gratis|bebida\s+gratis/i;

export interface ComplianceInput {
  items: MenuItem[];
  /** Any free text found on the menu outside item lines (footers, banners). */
  rawText?: string;
  /** True if the parser saw an allergen declaration anywhere on the menu. */
  allergenInfoPresent?: boolean;
}

export function auditCompliance(input: ComplianceInput, region: Region): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [];
  const haystacks: Array<{ id: string | null; text: string }> = [
    ...input.items.map((i) => ({
      id: i.id,
      text: `${i.name} ${i.description ?? ""}`,
    })),
    { id: null, text: input.rawText ?? "" },
  ];

  const declared =
    input.allergenInfoPresent ||
    haystacks.some((h) => ALLERGEN_DECLARATION_HINTS.test(h.text));
  if (!declared && region.country === "ES") {
    findings.push({
      code: "ALLERGENS_MISSING",
      severity: "required",
      lawRef: "eu-1169-2011",
      itemIds: [],
      messageKey: "compliance.allergensMissing",
    });
  }

  const promoHits = haystacks.filter((h) => ALCOHOL_PROMO_PATTERN.test(h.text));
  if (promoHits.length > 0) {
    findings.push({
      code: "ALCOHOL_PROMO",
      severity: region.catalonia ? "required" : "warning",
      lawRef: "cat-llei-20-1985",
      itemIds: promoHits.map((h) => h.id).filter((id): id is string => id != null),
      messageKey: region.catalonia
        ? "compliance.alcoholPromoCatalonia"
        : "compliance.alcoholPromoGeneric",
    });
  }

  if (region.country === "ES") {
    findings.push({
      code: "TAP_WATER_INFO",
      severity: "info",
      lawRef: "es-ley-7-2022",
      itemIds: [],
      messageKey: "compliance.tapWater",
    });
    findings.push({
      code: "VAT_DISCLOSURE_INFO",
      severity: "info",
      lawRef: "es-vat-menu",
      itemIds: [],
      messageKey: "compliance.vatDisclosure",
    });
  }

  return findings;
}
