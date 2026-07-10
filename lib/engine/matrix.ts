/**
 * Menu-engineering matrix — Kasavana & Smith (1982).
 *
 * Items compete within their own category. For each category:
 *   popularity share  = units / total units
 *   popularity cutoff = 70 % of an equal share (0.7 / n)   [K&S rule]
 *   CM per item       = price − cost
 *   CM cutoff         = demand-weighted mean CM of the category
 *
 *   high pop  + high CM → star        (protect, feature)
 *   high pop  + low CM  → plowhorse   (raise margin carefully)
 *   low pop   + high CM → puzzle      (promote, reposition)
 *   low pop   + low CM  → dog         (rework or remove)
 *
 * Heuristic mode: when unitsSold / cost are missing, estimatedPopularity and
 * estimatedCost stand in and every affected item is flagged `estimated` so the
 * UI can be honest about data quality.
 */

import type {
  ClassifiedItem,
  DataQuality,
  MatrixClass,
  MatrixGroup,
  MatrixResult,
  MenuItem,
} from "./types";
import { groupBy } from "./utils";

const POPULARITY_FACTOR = 0.7;

interface Signals {
  units: number | null;
  cost: number | null;
  quality: DataQuality;
}

function signalsFor(item: MenuItem): Signals {
  const hasUnits = item.unitsSold != null && item.unitsSold >= 0;
  const hasCost = item.cost != null && item.cost >= 0;
  const estUnits = item.estimatedPopularity != null && item.estimatedPopularity >= 0;
  const estCost = item.estimatedCost != null && item.estimatedCost >= 0;

  const units = hasUnits ? item.unitsSold! : estUnits ? item.estimatedPopularity! : null;
  const cost = hasCost ? item.cost! : estCost ? item.estimatedCost! : null;

  let quality: DataQuality;
  if (hasUnits && hasCost) quality = "actual";
  else if (units != null && cost != null) quality = hasUnits || hasCost ? "partial" : "estimated";
  else quality = "insufficient";

  return { units, cost, quality };
}

function classify(
  popularityShare: number,
  cm: number,
  popularityThreshold: number,
  cmThreshold: number,
): MatrixClass {
  const popular = popularityShare >= popularityThreshold;
  const profitable = cm >= cmThreshold;
  if (popular && profitable) return "star";
  if (popular) return "plowhorse";
  if (profitable) return "puzzle";
  return "dog";
}

export function buildMatrix(items: MenuItem[]): MatrixResult {
  const groups: MatrixGroup[] = [];
  let sawActual = false;
  let sawEstimated = false;

  for (const [category, catItems] of groupBy(items, (i) => i.category)) {
    const notes: string[] = [];
    const signals = catItems.map((item) => ({ item, s: signalsFor(item) }));
    const usable = signals.filter(({ s }) => s.units != null && s.cost != null);

    const popularityThreshold =
      catItems.length > 0 ? POPULARITY_FACTOR / catItems.length : 0;

    if (catItems.length < 2 || usable.length < 2) {
      // A one-item category (or no data) has nothing to compete against.
      if (catItems.length < 2) notes.push("single-item-category");
      else notes.push("insufficient-data");
      groups.push({
        category,
        popularityThreshold,
        cmThreshold: null,
        items: signals.map(({ item, s }) => ({
          item,
          contributionMargin: s.cost != null ? item.price - s.cost : null,
          popularityShare: null,
          classification: null,
          dataQuality: s.quality === "actual" ? "actual" : "insufficient",
        })),
        notes,
      });
      continue;
    }

    const totalUnits = usable.reduce((a, { s }) => a + s.units!, 0);
    if (totalUnits <= 0) {
      notes.push("zero-demand");
    }

    // Demand-weighted mean CM (K&S: total CM earned / total units sold).
    const totalCm = usable.reduce(
      (a, { item, s }) => a + (item.price - s.cost!) * s.units!,
      0,
    );
    const cmThreshold = totalUnits > 0 ? totalCm / totalUnits : null;

    const classified: ClassifiedItem[] = signals.map(({ item, s }) => {
      const cm = s.cost != null ? item.price - s.cost : null;
      const share =
        s.units != null && totalUnits > 0 ? s.units / totalUnits : null;
      const canClassify = cm != null && share != null && cmThreshold != null;
      if (s.quality === "actual") sawActual = true;
      if (s.quality === "estimated" || s.quality === "partial") sawEstimated = true;
      return {
        item,
        contributionMargin: cm,
        popularityShare: share,
        classification: canClassify
          ? classify(share, cm, popularityThreshold, cmThreshold)
          : null,
        dataQuality: canClassify ? s.quality : "insufficient",
      };
    });

    groups.push({ category, popularityThreshold, cmThreshold, items: classified, notes });
  }

  const mode: MatrixResult["mode"] =
    sawActual && sawEstimated ? "mixed" : sawEstimated ? "heuristic" : "actual";

  return { mode, groups };
}
