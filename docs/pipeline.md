# The agentic pipeline, stage by stage

Companion to the README's architecture section. Everything here is verifiable in
`lib/pipeline/` and `lib/engine/`; nothing below is aspirational.

The design rule, restated: **every number the app reports comes from the deterministic
engine; the LLM only does what math can't** — read a photo, refine an estimate within
schema bounds, audit copy, write prose. The LLM *calls into* the engine's world; it
never overrides it.

## Stages

`runPipeline` (`lib/pipeline/run.ts`) is an async generator: each stage yields
`start`/`done` events that the API route streams over SSE, so the UI shows the
pipeline working live with real per-stage timings.

| Stage | What it does | LLM involvement | Deterministic fallback |
|---|---|---|---|
| `parse` | menu → structured items | Claude reads photos/PDFs; also messy pasted text | layout-aware text parser (`textParse`) handles the two layouts covering most real menus |
| `normalize` | ids, dedupe, drop unpriced items | none | — (pure) |
| `estimate` | food-cost share + relative popularity per item | refines estimates *within schema bounds* (cost share clamped 0.05–0.9) | documented priors in `heuristics.ts`, always labelled *estimated* |
| `competitors` | benchmark items against market prices | reads competitor menu photos/PDFs | zone dataset (`data/market/`) + text-parsed competitor menus; unreadable files are skipped, never fatal |
| `pricing` | Kasavana–Smith matrix, Omnes rules, price moves with reason codes | **none — engine only** | — (pure, `lib/engine`) |
| `doctor` | copy audit + rewrites | audits and rewrites descriptions (never inventing ingredients) | regex-based audit: bare / generic / overlong classification |
| `compliance` | EU 1169/2011, Catalan drink-promo and tap-water checks | **none — engine only** | — (pure) |
| `report` | executive summary + quick wins | writes prose from engine numbers only ("never invent figures") | templated EN/ES summary from the same numbers |

If an LLM refinement stage throws — bad JSON, schema violation, API error — the
pipeline catches and returns the deterministic result. That is why the whole product
runs, and is E2E-tested, with zero API calls.

## The trust boundary

`lib/pipeline/schemas.ts` opens with the policy: *"LLM output is data, not truth:
parse, validate, clamp."*

- Every LLM reply crosses a **zod schema** before touching the engine: item counts,
  string lengths, price ranges, cost-share bounds, enum-only issue codes.
- `extractJson` strips markdown fences and parses exactly one JSON object; anything
  else throws (and the fallback takes over).
- The **browser input** is a trust boundary too: `AnalyzeRequestSchema` caps text at
  30k chars, files at 4 per request and ~4 MB each, with an allowlist of media types.

## Model routing

`lib/pipeline/llm.ts` maps roles to models: extraction work (`parser`, `estimator`)
runs on a cheap fast model, prose (`doctor`, `writer`) on a stronger one — overridable
via `GUERIDON_MODEL_FAST` / `GUERIDON_MODEL_SMART`.

Backend selection per request: **BYO key → server env key → fixture.** Keys are used
server-side per request, never stored, never logged. The `fixture` backend returns
canned replies so the pipeline is testable offline.

## SSE events

Each event is `{ stage, status: "start" | "done", ms?, detail? }` — `detail` is a
human-readable line ("14 items read", "3 price moves recommended") rendered by the
live pipeline view. The generator's return value is the full `AnalysisResult`,
tagged with `mode: "live" | "fixture"` and the data-quality mode of the matrix
(`actual` vs `estimated`), which the UI surfaces honestly.

## Known limits

- The signed-cookie rate limit is per-visitor and evadable by clearing cookies; the
  hard backstop is the spend cap on the API console. Upgrade path documented in
  `lib/pipeline/ratelimit.ts`.
- Estimated mode clusters classifications toward stars/plowhorses — labelled in-product.
