/**
 * Omnes' price-structure rules, per category.
 *
 * Formulations vary across hospitality literature; we implement the three
 * checks that survive contact with most sources (see content/bibliography):
 *
 *  1. Dispersion — the dearest item should not exceed ~3× the cheapest.
 *  2. Bands — split the price range into three equal bands; the middle band
 *     should hold at least as many items as the two outer bands combined.
 *  3. Price/demand — mean offered price vs sales-weighted mean price paid;
 *     a menu priced above what guests actually choose (ratio > 1) is pushing.
 *     Skipped without sales data.
 */

import type { MenuItem, OmnesReport } from "./types";
import { groupBy, mean, round2 } from "./utils";

const DISPERSION_LIMIT = 3;
/** Healthy offered/demanded window; below = underselling, above = pushing. */
const PRICE_DEMAND_RANGE: readonly [number, number] = [0.85, 1.0];

export function omnesReport(items: MenuItem[]): OmnesReport[] {
  const reports: OmnesReport[] = [];

  for (const [category, catItems] of groupBy(items, (i) => i.category)) {
    const notes: string[] = [];
    const prices = catItems.map((i) => i.price);
    const cheapest = Math.min(...prices);
    const dearest = Math.max(...prices);
    const tooSmall = catItems.length < 3;
    if (tooSmall) notes.push("small-category");

    const ratio = cheapest > 0 ? round2(dearest / cheapest) : null;
    const dispersion = {
      cheapest,
      dearest,
      ratio,
      limit: DISPERSION_LIMIT,
      pass: tooSmall || ratio == null ? null : ratio <= DISPERSION_LIMIT,
    };

    // Bands: three equal slices of [cheapest, dearest].
    const span = dearest - cheapest;
    const low: string[] = [];
    const middle: string[] = [];
    const high: string[] = [];
    if (span > 0) {
      for (const item of catItems) {
        const t = (item.price - cheapest) / span;
        if (t < 1 / 3) low.push(item.id);
        else if (t <= 2 / 3) middle.push(item.id);
        else high.push(item.id);
      }
    } else {
      middle.push(...catItems.map((i) => i.id));
      notes.push("uniform-prices");
    }
    const bands = {
      low,
      middle,
      high,
      pass: tooSmall || span === 0 ? null : middle.length >= low.length + high.length,
    };

    const offeredMean = round2(mean(prices));
    const withSales = catItems.filter((i) => i.unitsSold != null && i.unitsSold > 0);
    let demandedMean: number | null = null;
    if (withSales.length >= 2 && withSales.length >= catItems.length / 2) {
      const units = withSales.reduce((a, i) => a + i.unitsSold!, 0);
      demandedMean = round2(
        withSales.reduce((a, i) => a + i.price * i.unitsSold!, 0) / units,
      );
    } else if (withSales.length > 0) {
      notes.push("partial-sales-data");
    }
    const pdRatio =
      demandedMean != null && demandedMean > 0
        ? round2(offeredMean / demandedMean)
        : null;
    const priceDemand = {
      offeredMean,
      demandedMean,
      ratio: pdRatio,
      pass:
        pdRatio == null
          ? null
          : pdRatio >= PRICE_DEMAND_RANGE[0] && pdRatio <= PRICE_DEMAND_RANGE[1],
    };

    reports.push({
      category,
      itemCount: catItems.length,
      dispersion,
      bands,
      priceDemand,
      notes,
    });
  }

  return reports;
}
