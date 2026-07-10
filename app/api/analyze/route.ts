/**
 * POST /api/analyze — runs the pipeline, streaming stage events as SSE:
 *   event: stage   data: PipelineEvent
 *   event: result  data: AnalysisResult
 *   event: error   data: { code }
 *
 * Backend selection: `x-byo-key` header (per-request, never stored/logged)
 * → server ANTHROPIC_API_KEY (rate-limited per visitor) → fixture mode.
 */

import { NextRequest } from "next/server";
import { resolveBackend } from "@/lib/pipeline/llm";
import { checkRateLimit } from "@/lib/pipeline/ratelimit";
import { runPipeline } from "@/lib/pipeline/run";
import { AnalyzeRequestSchema } from "@/lib/pipeline/schemas";
import type { AnalyzeInput } from "@/lib/pipeline/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const RL_COOKIE = "gueridon-rl";

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  let input: AnalyzeInput;
  try {
    input = AnalyzeRequestSchema.parse(await req.json()) as AnalyzeInput;
  } catch {
    return Response.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  const byoKey = req.headers.get("x-byo-key");
  const usingServerKey = !byoKey && !!process.env.ANTHROPIC_API_KEY;

  let rlCookie: string | null = null;
  if (usingServerKey) {
    const rl = checkRateLimit(req.cookies.get(RL_COOKIE)?.value);
    if (!rl.allowed) {
      return Response.json({ error: "RATE_LIMITED" }, { status: 429 });
    }
    rlCookie = rl.cookie;
  }

  // Fixture fallback needs no canned prompts: every stage has a deterministic
  // path, so the fixture function should never actually be called.
  const backend = resolveBackend(byoKey, () => {
    throw new Error("FIXTURE_PATH_MISSING");
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        const gen = runPipeline(input, backend);
        let next = await gen.next();
        while (!next.done) {
          controller.enqueue(enc.encode(sse("stage", next.value)));
          next = await gen.next();
        }
        controller.enqueue(enc.encode(sse("result", next.value)));
      } catch (err) {
        const code = err instanceof Error ? err.message : "PIPELINE_ERROR";
        controller.enqueue(enc.encode(sse("error", { code })));
      } finally {
        controller.close();
      }
    },
  });

  const headers = new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  if (rlCookie) {
    headers.append(
      "Set-Cookie",
      `${RL_COOKIE}=${rlCookie}; Path=/api/analyze; Max-Age=93600; HttpOnly; SameSite=Strict; Secure`,
    );
  }
  return new Response(stream, { headers });
}
