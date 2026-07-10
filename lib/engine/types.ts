/**
 * Core domain types for the Gueridon menu-engineering engine.
 *
 * Everything in lib/engine is pure and deterministic: no I/O, no LLM calls.
 * The agentic pipeline (lib/pipeline) feeds it data and renders its output.
 */

export interface MenuItem {
  id: string;
  name: string;
  /** Competing set the item belongs to (menu section: mains, cocktails…). */
  category: string;
  /** Current menu price, VAT included, in `currency`. */
  price: number;
  description?: string | null;
  /** Actual food cost per serving, if the restaurateur knows it. */
  cost?: number | null;
  /** Units sold over the analysis period, if known. */
  unitsSold?: number | null;
  /**
   * Relative popularity estimate in 0..1 used when unitsSold is missing
   * (heuristic mode). Only compared within the same category.
   */
  estimatedPopularity?: number | null;
  /** Estimated food cost used when cost is missing (heuristic mode). */
  estimatedCost?: number | null;
}

export type MatrixClass = "star" | "plowhorse" | "puzzle" | "dog";

export type DataQuality = "actual" | "estimated" | "partial" | "insufficient";

export interface ClassifiedItem {
  item: MenuItem;
  /** price − cost (actual or estimated), null when no cost signal at all. */
  contributionMargin: number | null;
  /** Share of the category's demand attributed to this item, 0..1. */
  popularityShare: number | null;
  classification: MatrixClass | null;
  dataQuality: DataQuality;
}

export interface MatrixGroup {
  category: string;
  /** Kasavana & Smith: 70 % of an equal share (0.7 / n). */
  popularityThreshold: number;
  /** Demand-weighted mean contribution margin of the category. */
  cmThreshold: number | null;
  items: ClassifiedItem[];
  notes: string[];
}

export interface MatrixResult {
  /** Whether classifications rest on real data, estimates, or a mix. */
  mode: "actual" | "heuristic" | "mixed";
  groups: MatrixGroup[];
}

export interface OmnesBand {
  /** Item ids per price band (thirds of the category price range). */
  low: string[];
  middle: string[];
  high: string[];
  /** Omnes: middle band should hold at least as many items as both extremes. */
  pass: boolean | null;
}

export interface OmnesReport {
  category: string;
  itemCount: number;
  dispersion: {
    cheapest: number;
    dearest: number;
    ratio: number | null;
    /** Common formulation of Omnes' first rule: dearest ≤ 3 × cheapest. */
    limit: number;
    pass: boolean | null;
  };
  bands: OmnesBand;
  priceDemand: {
    /** Simple mean of offered prices. */
    offeredMean: number;
    /** Sales-weighted mean price actually paid; null without sales data. */
    demandedMean: number | null;
    /** offeredMean / demandedMean; healthy ≈ 0.85–1.0. */
    ratio: number | null;
    pass: boolean | null;
  };
  notes: string[];
}

export type Positioning = "value" | "mid" | "premium";

export interface MarketBenchmark {
  /** Free-form key the pipeline matches items against ("burger", "pinta"…). */
  itemKey: string;
  low: number;
  typical: number;
  high: number;
  source?: string;
}

export type PriceReason =
  | "STAR_UNDERPRICED"
  | "PUZZLE_OVERPRICED"
  | "PLOWHORSE_MARGIN"
  | "DOG_FLAG"
  | "LEFT_DIGIT_FIX"
  | "ENDING_STYLE"
  | "DISPERSION_GUARD"
  | "ANCHOR_OPPORTUNITY"
  | "HOLD";

export interface PriceRecommendation {
  itemId: string;
  current: number;
  /** Suggested price; equals `current` when the advice is to hold. */
  suggested: number;
  deltaPct: number;
  reasons: PriceReason[];
  /** i18n key + params so the UI can render the rationale in EN/ES. */
  rationale: { key: string; params?: Record<string, string | number> };
}

export type ComplianceSeverity = "required" | "warning" | "info";

export interface ComplianceFinding {
  code:
    | "ALLERGENS_MISSING"
    | "ALCOHOL_PROMO"
    | "TAP_WATER_INFO"
    | "VAT_DISCLOSURE_INFO";
  severity: ComplianceSeverity;
  /** Bibliography id of the law backing the finding (content/bibliography). */
  lawRef: string;
  /** Item ids that triggered the finding, empty for menu-wide findings. */
  itemIds: string[];
  /** i18n key for the human explanation. */
  messageKey: string;
}

export interface Region {
  country: "ES" | "other";
  catalonia?: boolean;
}

export interface MenuScore {
  /** 0–100. */
  total: number;
  subscores: {
    matrix: number;
    omnes: number;
    pricing: number;
    compliance: number;
    copy: number | null;
  };
  notes: string[];
}
