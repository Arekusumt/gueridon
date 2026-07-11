# Build-night report — 2026-07-10

## What got built (one night, one repo, published)

**Gueridon** — https://gueridon.vercel.app — public repo `Arekusumt/gueridon`.
Editorial luxury-typography site (EN/ES) explaining menu engineering with 28 verified
citations + a working analyzer (matrix, price moves, copy doctor, compliance, what-if,
menu redesign with print), demo'd on the real Waterfront printed menus.

## Decisions taken during the run

- **Name: Gueridon** — hospitality term (tableside trolley), zero software collisions,
  `gueridon.vercel.app` free. Shortlist + rationale in `docs/decisions.md`.
- **No Anthropic API key existed on the machine** → shipped demo + deterministic +
  BYO-key modes; live mode activates the moment `ANTHROPIC_API_KEY` lands in Vercel env.
  Consequence: the night spent **0.00 € in API** (see LEDGER.md).
- **Session limit pause**: the content-writer subagent died on the session cap
  (~4 a.m.); the editorial was written in the main session after the 6:50 reset.
- **Waterfront allergen check neutralised in the demo**: the photographed cartas are
  partial crops and the venue's site shows no allergen note on fetchable pages — the
  demo does not publish an unverifiable compliance claim about a real venue (comment in
  `scripts/build-demo.ts`). Real analyses assess it normally.

## Quality gates (all passed)

| Gate | Result |
|---|---|
| vitest | 36/36 green (engine + pipeline E2E in fixture mode) |
| ESLint / build | clean |
| Playwright E2E | 4/4 — demo flow, ES locale, deep-scroll paint, mobile 360px no-overflow |
| Lighthouse mobile (localhost) | Perf 87 · A11y 100 (gates 85/95) |
| Lighthouse mobile (**production**) | **Perf 89 · A11y 100 · BP 100 · SEO 100 · CLS 0** |
| E2E against production URL | 4/4 green |
| CRO pass (optimitzador-conversio rubric) | Home ~90, Analyzer ~89 after fixes (✦ house-recommendation CTA on cover, risk micro-copy at CTA band, demo as primary button, widget→analyzer link) |

Bugs the tests caught during the night (all fixed): sub-1€ prices could snap negative;
missing engine re-export silently `undefined` at runtime; two-line menu items unparsed;
`runDemo` without error handling could hang on a stale chunk.

## Publication note

The `gh` OAuth token lacks the `workflow` scope, so a push containing
`.github/workflows/ci.yml` was rejected by GitHub. Resolution without rewriting
anything published: the full 6-commit build narrative lives on local branch
`dev-night`; `main` (pushed) is a single clean release commit without `.github`.
**Morning step:** `gh auth refresh -h github.com -s workflow` (interactive, 1 min),
then `git add .github && git commit -m "ci: lint + test + build on push" && git push`
— CI goes live as a normal commit.

## Known debt (honest)

- Rate limiting is a signed-cookie per-visitor cap — evadable by clearing cookies. The
  real backstop is the spend limit on the Anthropic console (see checklist). Upgrade
  path: Upstash/KV global counter (comment in `lib/pipeline/ratelimit.ts`).
- "Keep my menu's look" redesign branding (vision-extracted palette) is stubbed pending
  live mode; the four house styles work.
- ~~Per-item real cost/sales entry has engine + API support but no UI yet~~ Done
  2026-07-11: sales-CSV dropzone with period/season picker (`lib/sales.ts`) + post-run
  refine table (`RefineTable.tsx`); rows match menu items by dish-name slug.
- LCP ~3.7s on throttled mobile is the Marcellus swap on the hero; acceptable, could
  subset further.
- Demo matrix runs in estimated mode → classifications cluster toward stars/plowhorses;
  labelled honestly in-product.

## Morning checklist — Alex

- [ ] **Set a spend limit on the Anthropic console** (console.anthropic.com) — the hard cap.
- [ ] Review the live site + repo (tone, PII, errors): https://gueridon.vercel.app
- [ ] `gh auth refresh -h github.com -s workflow` → commit + push `.github/` (CI on).
- [ ] Optional: `vercel env add ANTHROPIC_API_KEY` + redeploy → live photo analysis on.
- [ ] Optional: `vercel env add GUERIDON_RL_SECRET` (any long random string).
- [ ] Decide on a custom domain (now on gueridon.vercel.app).
- [ ] Add the repo to CV / SEGUIMENT.md (4th public repo).
- [ ] Decide whether "menu audit" becomes a hostelería lead magnet (analyzer already
      speaks Spanish and knows Tarragona/Reus/Salou/Barcelona benchmarks).
