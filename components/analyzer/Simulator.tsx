"use client";

import { useMemo, useState } from "react";
import { DEFAULT_ELASTICITY, simulatePriceChange } from "@/lib/engine";
import { InfoDot } from "@/components/InfoDot";
import { MenuLine } from "@/components/MenuLine";
import { UI, type Locale } from "@/lib/i18n";
import type { AnalysisResult } from "@/lib/pipeline/types";

export function Simulator({ locale, result }: { locale: Locale; result: AnalysisResult }) {
  const t = UI[locale].analyzer;
  const candidates = useMemo(
    () => result.items.filter((i) => (i.cost ?? i.estimatedCost) != null),
    [result.items],
  );
  const [itemId, setItemId] = useState(candidates[0]?.id ?? "");
  const item = candidates.find((i) => i.id === itemId) ?? candidates[0];
  const [elasticity, setElasticity] = useState(DEFAULT_ELASTICITY.default);
  const [newPrice, setNewPrice] = useState<number | null>(null);

  if (!item) return null;

  const hasRealUnits = item.unitsSold != null && item.unitsSold > 0;
  // Without real sales we simulate on an index of 100 units — outputs then
  // only make sense as percentages, which is what we show prominently.
  const units = hasRealUnits ? item.unitsSold! : 100;
  const cost = item.cost ?? item.estimatedCost ?? 0;
  const p1 = newPrice ?? item.price;

  const sim =
    p1 > 0
      ? simulatePriceChange({ price: item.price, newPrice: p1, unitsSold: units, cost, elasticity })
      : null;

  const pct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
  const tone = (v: number) => (v > 0 ? "text-herb" : v < 0 ? "text-claret" : "text-ink-soft");

  return (
    <div className="border border-ink/20 bg-paper-deep/40 p-6">
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <label className="block">
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ink-soft">{t.simItem}</span>
          <select
            value={item.id}
            onChange={(e) => {
              setItemId(e.target.value);
              setNewPrice(null);
            }}
            className="mt-1 w-full bg-paper border border-ink/25 px-3 py-2.5 text-sm focus:border-cover"
          >
            {candidates.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} — {i.price.toFixed(2)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ink-soft">
            {t.simElasticity} · <span className="lining">{elasticity.toFixed(2)}</span>
            <InfoDot label={t.simElasticity} text={t.info.elasticity} />
          </span>
          <input
            type="range"
            min={0.2}
            max={2}
            step={0.05}
            value={elasticity}
            onChange={(e) => setElasticity(Number(e.target.value))}
            className="w-full accent-(--color-cover) mt-3"
          />
        </label>
      </div>
      <label className="block mb-6">
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ink-soft">
          {t.simNewPrice} · <span className="lining">€{p1.toFixed(2)}</span>
          <span className="text-ink-soft/70"> (€{item.price.toFixed(2)})</span>
          <InfoDot label={t.simNewPrice} text={t.info.newPrice} />
        </span>
        <input
          type="range"
          min={Math.max(0.5, item.price * 0.7)}
          max={item.price * 1.3}
          step={0.05}
          value={p1}
          onChange={(e) => setNewPrice(Number(e.target.value))}
          className="w-full accent-(--color-cover) mt-3"
        />
      </label>
      {sim ? (
        <div className="space-y-2 max-w-sm" aria-live="polite">
          <MenuLine
            label={t.simRevenue}
            value={<span className={tone(sim.revenueDeltaPct)}>{pct(sim.revenueDeltaPct)}</span>}
            sub={hasRealUnits ? `€${sim.revenue0.toFixed(0)} → €${sim.revenue1.toFixed(0)}` : undefined}
          />
          <MenuLine
            label={t.simMargin}
            value={<span className={tone(sim.marginDeltaPct)}>{pct(sim.marginDeltaPct)}</span>}
            sub={hasRealUnits ? `€${sim.margin0.toFixed(0)} → €${sim.margin1.toFixed(0)}` : undefined}
          />
        </div>
      ) : null}
    </div>
  );
}
