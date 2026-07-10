/**
 * LLM access layer with two backends:
 *
 *  - "anthropic": real Claude calls. Cheap fast model for extraction work,
 *    a stronger model only where prose quality pays for itself.
 *  - "fixture": deterministic canned replies so the whole pipeline can run,
 *    be tested, and be demoed with zero API cost and zero keys.
 *
 * Backend selection: explicit per-request key (BYO) → server env key →
 * fixture. Keys are used per-request and never logged or stored.
 */

import Anthropic from "@anthropic-ai/sdk";

export type LlmRole = "parser" | "estimator" | "doctor" | "writer";

const MODEL: Record<LlmRole, string> = {
  parser: process.env.GUERIDON_MODEL_FAST ?? "claude-haiku-4-5-20251001",
  estimator: process.env.GUERIDON_MODEL_FAST ?? "claude-haiku-4-5-20251001",
  doctor: process.env.GUERIDON_MODEL_SMART ?? "claude-sonnet-5",
  writer: process.env.GUERIDON_MODEL_SMART ?? "claude-sonnet-5",
};

const MAX_TOKENS: Record<LlmRole, number> = {
  parser: 8_000,
  estimator: 4_000,
  doctor: 3_000,
  writer: 1_500,
};

export interface LlmImage {
  data: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
}

export interface LlmRequest {
  role: LlmRole;
  system: string;
  prompt: string;
  images?: LlmImage[];
}

export interface LlmBackend {
  name: "anthropic" | "fixture";
  complete(req: LlmRequest): Promise<string>;
}

export function anthropicBackend(apiKey: string): LlmBackend {
  const client = new Anthropic({ apiKey });
  return {
    name: "anthropic",
    async complete(req) {
      const content: Anthropic.ContentBlockParam[] = [
        ...(req.images ?? []).map(
          (img): Anthropic.ImageBlockParam => ({
            type: "image",
            source: { type: "base64", media_type: img.mediaType, data: img.data },
          }),
        ),
        { type: "text", text: req.prompt },
      ];
      const res = await client.messages.create({
        model: MODEL[req.role],
        max_tokens: MAX_TOKENS[req.role],
        system: req.system,
        messages: [{ role: "user", content }],
      });
      return res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
    },
  };
}

export function fixtureBackend(
  fixtures: (req: LlmRequest) => string,
): LlmBackend {
  return {
    name: "fixture",
    async complete(req) {
      return fixtures(req);
    },
  };
}

/** Resolve the backend for a request. `byoKey` comes from the client, per-request. */
export function resolveBackend(
  byoKey: string | null,
  fixtures: (req: LlmRequest) => string,
): LlmBackend {
  const key = byoKey?.trim() || process.env.ANTHROPIC_API_KEY;
  if (key) return anthropicBackend(key);
  return fixtureBackend(fixtures);
}
