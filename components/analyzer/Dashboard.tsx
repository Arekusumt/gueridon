"use client";

import { useMemo, useState } from "react";
import { MenuLine } from "@/components/MenuLine";
import { UI, type Locale } from "@/lib/i18n";
import type { AnalysisResult } from "@/lib/pipeline/types";
import { MatrixPlot } from "./MatrixPlot";
import { RedesignCarta } from "./RedesignCarta";
import { Simulator } from "./Simulator";

function fill(template: string, params?: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params?.[k] ?? `{${k}}`));
}

export function Dashboard({
  locale,
  result,
  onReset,
}: {
  locale: Locale;
  result: AnalysisResult;
  onReset: () => void;
}) {
  const t = UI[locale].analyzer;
  const [printCarta, setPrintCarta] = useState(false);

  const moves = useMemo(
    () => result.pricing.filter((r) => r.suggested !== r.current),
    [result.pricing],
  );
  const held = result.pricing.length - moves.length;
  const itemById = useMemo(() => new Map(result.items.map((i) => [i.id, i])), [result.items]);
  const rewrites = result.doctor.findings.filter((f) => f.rewrite);

  if (printCarta) {
    return (
      <RedesignCarta
        locale={locale}
        result={result}
        onDone={() => setPrintCarta(false)}
        autoPrint
      />
    );
  }

  return (
    <div className="mt-10">
      {/* — Header: the score — */}
      <div className="grid sm:grid-cols-[auto_1fr_auto] gap-8 items-center border border-ink/20 bg-paper-deep/40 p-6 sm:p-8">
        <ScoreDial score={result.score.total} label={t.score} />
        <div>
          <p className="display text-2xl text-cover">
            {result.profile.name}{" "}
            <span className="text-ink-soft text-lg">· {result.profile.location}</span>
          </p>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ink-soft mt-2">
            {result.items.length} items · {t.modeLabels[result.meta.mode]} ·{" "}
            {result.meta.dataQuality !== "actual" ? t.estimated : "real data"}
          </p>
          <div className="mt-4 space-y-1.5 max-w-sm text-sm">
            {(Object.keys(t.subscores) as Array<keyof typeof t.subscores>).map((k) => {
              const v = result.score.subscores[k];
              return (
                <MenuLine
                  key={k}
                  label={t.subscores[k]}
                  value={v == null ? "—" : `${Math.round(v)}`}
                />
              );
            })}
          </div>
        </div>
        <div className="no-print flex flex-col gap-2 self-start">
          <button
            onClick={() => window.print()}
            className="font-mono text-[0.62rem] tracking-[0.2em] uppercase border border-cover text-cover px-4 py-2.5 hover:bg-cover hover:text-paper transition-colors"
          >
            {t.report}
          </button>
          <button
            onClick={onReset}
            className="font-mono text-[0.62rem] tracking-[0.2em] uppercase text-ink-soft hover:text-cover px-4 py-2"
          >
            ← {t.title}
          </button>
        </div>
      </div>

      {/* — Maître d's note — */}
      <section className="mt-12 max-w-2xl">
        <h2 className="eyebrow text-gilt mb-4">{t.summary}</h2>
        {result.summary.map((p, i) => (
          <p key={i} className="mb-4">{p}</p>
        ))}
        <div className="border border-ink/20 bg-paper-deep/50 px-6 py-5 space-y-3 mt-6">
          {result.quickWins.map((w, i) => (
            <MenuLine key={i} label={w} value={String(i + 1).padStart(2, "0")} />
          ))}
        </div>
      </section>

      {/* — The matrix — */}
      <section className="mt-14">
        <h2 className="eyebrow text-gilt mb-2">{t.matrixTitle}</h2>
        <p className="text-sm text-ink-soft mb-6 max-w-lg">{t.matrixHint}</p>
        <MatrixPlot locale={locale} matrix={result.matrix} />
        {result.meta.dataQuality !== "actual" ? (
          <p className="text-xs text-ink-soft mt-3 max-w-lg">{t.estCostNote}</p>
        ) : null}
      </section>

      {/* — Price moves — */}
      <section className="mt-14">
        <h2 className="eyebrow text-gilt mb-6">{t.pricingTitle}</h2>
        {moves.length === 0 ? (
          <p className="text-ink-soft">{t.holdAll}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[540px]">
              <thead>
                <tr className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-ink-soft text-left">
                  <th className="py-2 pr-4 font-normal">{t.pricingCols.item}</th>
                  <th className="py-2 pr-4 font-normal text-right">{t.pricingCols.current}</th>
                  <th className="py-2 pr-4 font-normal text-right">{t.pricingCols.suggested}</th>
                  <th className="py-2 font-normal">{t.pricingCols.why}</th>
                </tr>
              </thead>
              <tbody>
                {moves.map((r) => {
                  const item = itemById.get(r.itemId);
                  return (
                    <tr key={r.itemId} className="border-t border-ink/10 align-baseline">
                      <td className="py-2.5 pr-4">
                        {item?.name}
                        <span className="block font-mono text-[0.6rem] uppercase tracking-wider text-ink-soft">
                          {item?.category}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono lining text-ink-soft">
                        {r.current.toFixed(2)}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono lining">
                        <span className={r.suggested > r.current ? "text-herb" : "text-claret"}>
                          {r.suggested.toFixed(2)}
                        </span>
                        <span className="text-[0.65rem] text-ink-soft ml-1.5">
                          {r.deltaPct > 0 ? "+" : ""}
                          {r.deltaPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span
                          title={fill(
                            t.rationales[r.rationale.key as keyof typeof t.rationales] ??
                              r.rationale.key,
                            r.rationale.params,
                          )}
                        >
                          {r.reasons.map((reason) => (
                            <span
                              key={reason}
                              className="inline-block font-mono text-[0.6rem] uppercase tracking-wider border border-ink/25 text-ink-soft px-1.5 py-0.5 mr-1.5 mb-1"
                            >
                              {t.reasonChips[reason]}
                            </span>
                          ))}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {held > 0 ? (
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ink-soft mt-4">
            + {held} {t.moreHeld}
          </p>
        ) : null}
      </section>

      {/* — Compliance — */}
      <section className="mt-14 max-w-2xl">
        <h2 className="eyebrow text-gilt mb-6">{t.complianceTitle}</h2>
        <div className="space-y-4">
          {result.compliance.map((f) => (
            <div
              key={f.code}
              className={`border-l-2 pl-4 py-1 ${
                f.severity === "required"
                  ? "border-claret"
                  : f.severity === "warning"
                    ? "border-gilt"
                    : "border-ink/25"
              }`}
            >
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-ink-soft mb-1">
                {f.severity} · {f.code.replaceAll("_", " ")}
              </p>
              <p className="text-sm">
                {t.complianceMsgs[f.messageKey as keyof typeof t.complianceMsgs] ?? f.messageKey}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* — Copy doctor — */}
      {rewrites.length > 0 ? (
        <section className="mt-14 max-w-2xl">
          <h2 className="eyebrow text-gilt mb-6">{t.copyTitle}</h2>
          <div className="space-y-6">
            {rewrites.slice(0, 8).map((f) => {
              const item = itemById.get(f.itemId);
              return (
                <div key={f.itemId} className="border border-ink/15 p-5">
                  <p className="display text-lg text-cover">{item?.name}</p>
                  <p className="text-sm text-ink-soft mt-2">
                    <span className="font-mono text-[0.6rem] uppercase tracking-widest mr-2">
                      {t.before}
                    </span>
                    {item?.description ? (
                      <span className="line-through decoration-claret/40">{item.description}</span>
                    ) : (
                      <em>—</em>
                    )}
                  </p>
                  <p className="text-sm mt-1.5">
                    <span className="font-mono text-[0.6rem] uppercase tracking-widest mr-2 text-herb">
                      {t.after}
                    </span>
                    {f.rewrite}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* — What-if — */}
      <section className="mt-14 max-w-2xl no-print">
        <h2 className="eyebrow text-gilt mb-2">{t.simulator}</h2>
        <p className="text-sm text-ink-soft mb-6">{t.simulatorHint}</p>
        <Simulator locale={locale} result={result} />
      </section>

      {/* — The redesign — */}
      <section className="mt-14">
        <div className="no-print">
          <h2 className="eyebrow text-gilt mb-2">{t.redesign}</h2>
          <p className="text-sm text-ink-soft mb-6 max-w-lg">{t.redesignHint}</p>
          <button
            onClick={() => setPrintCarta(true)}
            className="font-mono text-[0.62rem] tracking-[0.2em] uppercase border border-cover text-cover px-4 py-2.5 hover:bg-cover hover:text-paper transition-colors mb-8"
          >
            {t.print}
          </button>
        </div>
        <RedesignCarta locale={locale} result={result} />
      </section>

      <p className="text-xs text-ink-soft mt-16 max-w-lg">{t.disclaimer}</p>
    </div>
  );
}

function ScoreDial({ score, label }: { score: number; label: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const filled = (score / 100) * c;
  return (
    <figure className="text-center">
      <svg
        width="132"
        height="132"
        viewBox="0 0 132 132"
        role="img"
        aria-label={`${label}: ${score}/100`}
      >
        <circle
          cx="66"
          cy="66"
          r={r}
          fill="none"
          stroke="var(--color-ink)"
          strokeOpacity="0.12"
          strokeWidth="5"
        />
        <circle
          cx="66"
          cy="66"
          r={r}
          fill="none"
          stroke={
            score >= 70
              ? "var(--color-herb)"
              : score >= 45
                ? "var(--color-gilt)"
                : "var(--color-claret)"
          }
          strokeWidth="5"
          strokeDasharray={`${filled} ${c - filled}`}
          strokeLinecap="butt"
          transform="rotate(-90 66 66)"
        />
        <text
          x="66"
          y="63"
          textAnchor="middle"
          className="lining"
          fontSize="34"
          fontFamily="var(--font-display)"
          fill="var(--color-ink)"
        >
          {score}
        </text>
        <text
          x="66"
          y="84"
          textAnchor="middle"
          fontSize="9"
          fontFamily="var(--font-mono)"
          letterSpacing="2"
          fill="var(--color-ink-soft)"
        >
          / 100
        </text>
      </svg>
      <figcaption className="eyebrow text-ink-soft mt-1">{label}</figcaption>
    </figure>
  );
}
