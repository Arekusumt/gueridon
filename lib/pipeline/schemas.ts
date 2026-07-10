/**
 * Zod schemas for everything that crosses the LLM trust boundary.
 * LLM output is data, not truth: parse, validate, clamp.
 */

import { z } from "zod";

export const ParsedItemSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.string().min(1).max(60),
  description: z.string().max(400).nullish(),
  price: z.number().positive().max(10_000).nullish(),
});

export const ParsedMenuSchema = z.object({
  items: z.array(ParsedItemSchema).min(1).max(400),
  allergenInfoPresent: z.boolean(),
  notes: z.array(z.string()).default([]),
});
export type ParsedMenu = z.infer<typeof ParsedMenuSchema>;

export const EstimateSchema = z.object({
  estimates: z.array(
    z.object({
      id: z.string(),
      /** Estimated food-cost share of price, 0.05–0.9. */
      costShare: z.number().min(0.05).max(0.9),
      /** Relative popularity within its category, 0–1. */
      popularity: z.number().min(0).max(1),
    }),
  ),
});
export type Estimates = z.infer<typeof EstimateSchema>;

export const BenchmarkMatchSchema = z.object({
  matches: z.array(
    z.object({
      id: z.string(),
      /** Market-dataset category key, or null when nothing fits. */
      marketKey: z.string().nullable(),
    }),
  ),
});
export type BenchmarkMatches = z.infer<typeof BenchmarkMatchSchema>;

export const DoctorSchema = z.object({
  copyScore: z.number().min(0).max(100),
  findings: z.array(
    z.object({
      id: z.string(),
      issue: z.enum(["bare", "generic", "overlong", "good"]),
      rewrite: z.string().max(300).nullish(),
    }),
  ),
  structure: z.array(z.string()).max(12),
});

export const ReportSchema = z.object({
  summary: z.array(z.string().max(700)).min(2).max(6),
  quickWins: z.array(z.string().max(200)).min(3).max(7),
});

const UploadedFileSchema = z.object({
  data: z.string().max(5_500_000), // ~4 MB binary per file
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
});

/** What the browser is allowed to send us. Sizes are hard trust-boundary caps. */
export const AnalyzeRequestSchema = z.object({
  profile: z.object({
    name: z.string().min(1).max(80),
    location: z.string().min(1).max(120),
    cuisine: z.string().min(1).max(60),
    positioning: z.enum(["value", "mid", "premium"]),
    region: z.object({
      country: z.enum(["ES", "other"]),
      catalonia: z.boolean().optional(),
    }),
    marketZone: z
      .enum(["barcelona", "tarragona", "reus", "salou-la-pineda"])
      .nullish(),
    locale: z.enum(["en", "es"]),
  }),
  menuText: z.string().max(30_000).optional(),
  images: z.array(UploadedFileSchema).max(4).optional(),
  competitorTexts: z.array(z.string().max(20_000)).max(5).optional(),
  competitorImages: z.array(UploadedFileSchema).max(4).optional(),
  knownCosts: z.record(z.string(), z.number().positive().max(10_000)).optional(),
  knownSales: z.record(z.string(), z.number().min(0).max(1_000_000)).optional(),
});

/** Strip markdown fences and parse the first JSON object in an LLM reply. */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("LLM reply contained no JSON object");
  return JSON.parse(cleaned.slice(start, end + 1));
}
