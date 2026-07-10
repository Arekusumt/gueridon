# Decisions log

## 2026-07-10 · Name: **Gueridon**

The guéridon is the wheeled table used for tableside service in fine dining —
the piece of furniture that "justifies higher menu prices" through theatre.
A menu-engineering tool could not ask for a better patron.

Shortlist considered (10):

| Candidate | Verdict |
|---|---|
| **Gueridon** | ✅ chosen — deep hospitality term, luxury connotation, short, no software collision found, `gueridon.vercel.app` free |
| Menu Atelier | "Atelier" heavily used by software companies (ERP, beauty, agencies) |
| Couvert | cover-charge connotation in PT/BR; several restaurants share the name |
| The Menu Engineer | literal, SEO-friendly, zero poetry |
| Menurgy | invented and unique, but reads tech, not luxury |
| Omnes | on-topic (pricing rules) but collides with Omnes Education/Capital |
| Mise | collides with the well-known `mise` dev tool — bad for a dev audience |
| Carta Studio | "Carta" is a cap-table unicorn |
| Prix Fixe | charming but two words + prior art in games |
| Alacarta | RTVE Play "a la carta" collision in Spain |

Finalists: Gueridon · Menu Atelier · Couvert.

## 2026-07-10 · Architecture

- **Deterministic core (`lib/engine`)** — matrix, Omnes, pricing psychology,
  compliance, elasticity, scoring: pure TypeScript, fully unit-tested. No LLM
  involvement in any number the app reports.
- **Agentic shell (`lib/pipeline`)** — Claude does what math can't: read a menu
  photo, estimate costs, audit copy, write prose. Each stage streams progress
  over SSE so the UI can show the pipeline working live.
- Rationale: LLM-as-parser + deterministic-analysis is auditable and testable;
  LLM-as-oracle is neither.

## 2026-07-10 · Production API posture

No Anthropic API key was available at build night. The app ships with:
1. **Demo mode** (default): precomputed analysis of a real menu (The Waterfront
   Irish Pub, published with owner permission).
2. **Live mode**: enabled when `ANTHROPIC_API_KEY` is set in the environment;
   guarded by a global daily cap + per-visitor limit.
3. **BYO key**: visitors may paste their own key (used server-side per-request,
   never stored).
