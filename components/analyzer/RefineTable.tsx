"use client";

import { useState } from "react";
import type { MenuItem } from "@/lib/engine";
import { slugifyName } from "@/lib/sales";
import type { KnownNumbers } from "./AnalyzerApp";

/**
 * Post-run editable table: real units sold + food cost per item, then re-fire.
 * Values are keyed by item id AND dish-name slug so they survive an id drift
 * when a photo menu is re-parsed in live mode.
 */
export function RefineTable({
  items,
  labels,
  onApply,
}: {
  items: MenuItem[];
  labels: { item: string; units: string; cost: string; apply: string };
  onApply: (known: KnownNumbers) => void;
}) {
  const [units, setUnits] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      items.filter((i) => i.unitsSold != null).map((i) => [i.id, String(i.unitsSold)]),
    ),
  );
  const [costs, setCosts] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.filter((i) => i.cost != null).map((i) => [i.id, String(i.cost)])),
  );

  const parse = (raw: string | undefined) => {
    const s = (raw ?? "").trim().replace(",", ".");
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const hasAny = items.some((it) => parse(units[it.id]) != null || parse(costs[it.id]) != null);

  const apply = () => {
    const known: KnownNumbers = { sales: {}, costs: {} };
    for (const it of items) {
      const u = parse(units[it.id]);
      if (u != null) known.sales[it.id] = known.sales[slugifyName(it.name)] = u;
      const c = parse(costs[it.id]);
      if (c != null && c > 0) known.costs[it.id] = known.costs[slugifyName(it.name)] = c;
    }
    onApply(known);
  };

  const inputCls =
    "w-24 bg-paper-deep/40 border border-ink/25 px-2 py-1.5 text-sm font-mono lining text-right focus:border-cover";

  return (
    <div>
      <div className="overflow-x-auto max-h-96 overflow-y-auto border border-ink/15">
        <table className="w-full text-sm border-collapse min-w-[420px]">
          <thead className="sticky top-0 bg-paper">
            <tr className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-ink-soft text-left">
              <th className="py-2 px-3 font-normal">{labels.item}</th>
              <th className="py-2 px-3 font-normal text-right">{labels.units}</th>
              <th className="py-2 px-3 font-normal text-right">{labels.cost}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-ink/10">
                <td className="py-2 px-3">
                  {it.name}
                  <span className="block font-mono text-[0.6rem] uppercase tracking-wider text-ink-soft">
                    {it.category}
                  </span>
                </td>
                <td className="py-2 px-3 text-right">
                  <input
                    inputMode="numeric"
                    aria-label={`${labels.units} — ${it.name}`}
                    value={units[it.id] ?? ""}
                    onChange={(e) => setUnits((prev) => ({ ...prev, [it.id]: e.target.value }))}
                    className={inputCls}
                  />
                </td>
                <td className="py-2 px-3 text-right">
                  <input
                    inputMode="decimal"
                    aria-label={`${labels.cost} — ${it.name}`}
                    value={costs[it.id] ?? ""}
                    onChange={(e) => setCosts((prev) => ({ ...prev, [it.id]: e.target.value }))}
                    className={inputCls}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={apply}
        disabled={!hasAny}
        className="mt-4 font-mono text-[0.62rem] tracking-[0.2em] uppercase border border-cover text-cover px-4 py-2.5 hover:bg-cover hover:text-paper transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {labels.apply}
      </button>
    </div>
  );
}
