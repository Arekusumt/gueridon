/**
 * Pricing psychology engine.
 *
 * Deterministic rules that turn the matrix + Omnes + market benchmarks into
 * concrete per-item price recommendations, each carrying machine-readable
 * reason codes and an i18n rationale. Research backing: left-digit effect
 * (Thomas & Morwitz 2005), round-price fluency for hedonic/premium contexts
 * (Wadhwa & Zhang 2015), currency-cue effects (Yang, Kimes & Sessarego 2009)
 * — see content/bibliography.
 */

import type {
  MarketBenchmark,
  MatrixGroup,
  MenuItem,
  Positioning,
  PriceReason,
  PriceRecommendation,
} from "./types";
import { round2 } from "./utils";

/** Largest single-step increase we will ever recommend. */
const MAX_RAISE_PCT = 0.08;
/** Largest single-step decrease we will ever recommend. */
const MAX_CUT_PCT = 0.12;
/** Deltas below this are noise — hold instead. */
const MIN_MEANINGFUL_PCT = 0.02;

export function analyzeEndings(prices: number[]): Record<string, number> {
  const hist: Record<string, number> = {};
  for (const p of prices) {
    const cents = Math.round((p % 1) * 100);
    const key =
      cents === 0 ? ".00" : cents === 50 ? ".50" : cents === 90 ? ".90" : cents === 95 ? ".95" : cents === 99 ? ".99" : "other";
    hist[key] = (hist[key] ?? 0) + 1;
  }
  return hist;
}

/**
 * Snap a target price to the psychological grid for the positioning:
 *  - premium: whole or half euros (round-number fluency for hedonic buys)
 *  - mid:     .50 / .95
 *  - value:   .95 / .90 (charm endings, left-digit aware)
 */
export function snapToPsychological(target: number, positioning: Positioning): number {
  if (target <= 0) return target;
  if (positioning === "premium") {
    return Math.round(target * 2) / 2;
  }
  const floor = Math.floor(target);
  const candidates = (
    positioning === "mid"
      ? [floor - 0.5, floor - 0.05, floor + 0.5, floor + 0.95]
      : [floor - 0.1, floor - 0.05, floor + 0.9, floor + 0.95]
  ).filter((c) => c > 0);
  if (candidates.length === 0) return round2(target);
  let best = candidates[0];
  for (const c of candidates) {
    if (Math.abs(c - target) < Math.abs(best - target)) best = c;
  }
  return round2(best);
}

/** True when a price sits just past a left-digit boundary (e.g. 10.20). */
export function awkwardLeftDigit(price: number): boolean {
  const frac = price % 1;
  return price >= 2 && frac > 0 && frac <= 0.25;
}

export interface RecommendInput {
  groups: MatrixGroup[];
  positioning: Positioning;
  /** Optional market comparables, matched per item by the caller. */
  market?: Map<string, MarketBenchmark>;
}

export function recommendPrices(input: RecommendInput): PriceRecommendation[] {
  const out: PriceRecommendation[] = [];

  for (const group of input.groups) {
    const prices = group.items.map((c) => c.item.price);
    const cheapest = Math.min(...prices);
    // Dispersion guard: no recommendation may push dearest beyond 3× cheapest.
    const ceiling = cheapest * 3;

    for (const ci of group.items) {
      const { item, classification } = ci;
      const bench = input.market?.get(item.id) ?? null;
      const reasons: PriceReason[] = [];
      let target = item.price;
      let rationaleKey = "pricing.hold";
      let params: Record<string, string | number> = {};

      if (classification === "star" && bench && item.price < bench.typical) {
        target = Math.min(item.price * (1 + MAX_RAISE_PCT), bench.typical);
        reasons.push("STAR_UNDERPRICED");
        rationaleKey = "pricing.starUnderpriced";
        params = { typical: bench.typical };
      } else if (classification === "puzzle" && bench && item.price > bench.high) {
        target = Math.max(item.price * (1 - MAX_CUT_PCT), bench.typical);
        reasons.push("PUZZLE_OVERPRICED");
        rationaleKey = "pricing.puzzleOverpriced";
        params = { high: bench.high };
      } else if (
        classification === "plowhorse" &&
        ci.contributionMargin != null &&
        group.cmThreshold != null &&
        ci.contributionMargin < group.cmThreshold
      ) {
        // Small, quiet increase: plowhorses are price-sensitive traffic dishes.
        target = item.price * 1.03;
        reasons.push("PLOWHORSE_MARGIN");
        rationaleKey = "pricing.plowhorseMargin";
      } else if (classification === "dog") {
        reasons.push("DOG_FLAG");
        rationaleKey = "pricing.dogFlag";
      }

      // Ending hygiene applies even when the base price holds.
      if (reasons.length === 0 || reasons[0] === "DOG_FLAG") {
        if (awkwardLeftDigit(item.price) && input.positioning !== "premium") {
          target = item.price; // snap below the boundary, no real change in value
          const snapped = snapToPsychological(Math.floor(item.price) - 0.01, input.positioning);
          if (snapped > 0 && Math.abs(snapped - item.price) / item.price <= 0.05) {
            target = snapped;
            reasons.push("LEFT_DIGIT_FIX");
            rationaleKey = "pricing.leftDigitFix";
          }
        }
      }

      let suggested = snapToPsychological(target, input.positioning);
      if (suggested !== item.price && reasons.length === 0) {
        // Pure ending alignment (e.g. 9.20 → 8.95 handled above; 9.37 → 9.50).
        if (Math.abs(suggested - item.price) / item.price <= 0.04) {
          reasons.push("ENDING_STYLE");
          rationaleKey = "pricing.endingStyle";
        } else {
          suggested = item.price;
        }
      }

      // Never breach Omnes dispersion on the way up.
      if (suggested > ceiling && suggested > item.price) {
        suggested = round2(Math.min(suggested, Math.max(item.price, ceiling)));
        reasons.push("DISPERSION_GUARD");
      }

      const deltaPct = item.price > 0 ? (suggested - item.price) / item.price : 0;
      const meaningful = Math.abs(deltaPct) >= MIN_MEANINGFUL_PCT;
      const endingOnly = reasons.includes("LEFT_DIGIT_FIX") || reasons.includes("ENDING_STYLE");

      if (!meaningful && !endingOnly && !reasons.includes("DOG_FLAG")) {
        out.push({
          itemId: item.id,
          current: item.price,
          suggested: item.price,
          deltaPct: 0,
          reasons: ["HOLD"],
          rationale: { key: "pricing.hold" },
        });
        continue;
      }

      out.push({
        itemId: item.id,
        current: item.price,
        suggested: reasons.includes("DOG_FLAG") && reasons.length === 1 ? item.price : round2(suggested),
        deltaPct: round2(deltaPct * 100),
        reasons: reasons.length > 0 ? reasons : ["HOLD"],
        rationale: { key: rationaleKey, params },
      });
    }
  }

  return out;
}

/** Categories lacking a high anchor get a flag (opportunity, not a price change). */
export function anchorOpportunities(groups: MatrixGroup[]): string[] {
  const flagged: string[] = [];
  for (const group of groups) {
    if (group.items.length < 4) continue;
    const prices = group.items.map((c) => c.item.price).sort((a, b) => b - a);
    const [top, second] = prices;
    // A healthy anchor sits clearly above the pack; if the top two prices are
    // within 10 % of each other and the band is flat, there is no anchor.
    if (top <= second * 1.1) flagged.push(group.category);
  }
  return flagged;
}

export { type MenuItem };
