import type {
  ComplianceFinding,
  MarketBenchmark,
  MatrixResult,
  MenuItem,
  MenuScore,
  OmnesReport,
  Positioning,
  PriceRecommendation,
  Region,
} from "@/lib/engine";

export type StageId =
  | "parse"
  | "normalize"
  | "estimate"
  | "competitors"
  | "pricing"
  | "doctor"
  | "compliance"
  | "report";

export interface PipelineEvent {
  stage: StageId;
  status: "start" | "done" | "error";
  /** Short human-readable detail for the live agentic view. */
  detail?: string;
  /** Milliseconds spent in the stage (on "done"). */
  ms?: number;
}

export interface RestaurantProfile {
  name: string;
  location: string;
  cuisine: string;
  positioning: Positioning;
  region: Region;
  /** Market dataset zone id, e.g. "tarragona"; null to skip benchmarks. */
  marketZone?: string | null;
  locale: "en" | "es";
}

export interface AnalyzeInput {
  profile: RestaurantProfile;
  /** Raw menu text (pasted). Either this or images must be present. */
  menuText?: string;
  /** Menu photos as base64 data (no data: prefix) + media type. */
  images?: Array<{ data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" }>;
  /** Competitor menus, pasted as raw text blocks. */
  competitorTexts?: string[];
  /** Optional per-item sales/cost the user typed in after parsing. */
  knownCosts?: Record<string, number>;
  knownSales?: Record<string, number>;
}

export interface CopyFinding {
  itemId: string;
  issue: "bare" | "generic" | "overlong" | "good";
  rewrite?: string | null;
}

export interface DoctorResult {
  /** 0–100 quality of menu copy overall. */
  copyScore: number;
  findings: CopyFinding[];
  /** Structural observations (category sizes, ordering…). */
  structure: string[];
}

export interface AnalysisResult {
  profile: RestaurantProfile;
  items: MenuItem[];
  matrix: MatrixResult;
  omnes: OmnesReport[];
  pricing: PriceRecommendation[];
  benchmarks: Array<[string, MarketBenchmark]>;
  compliance: ComplianceFinding[];
  doctor: DoctorResult;
  score: MenuScore;
  /** Executive summary paragraphs in the requested locale. */
  summary: string[];
  quickWins: string[];
  meta: {
    generatedAt: string;
    mode: "live" | "fixture" | "demo";
    dataQuality: MatrixResult["mode"];
  };
}
