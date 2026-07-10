"use client";

import { useMemo, useState } from "react";
import type { MatrixResult } from "@/lib/engine";
import type { Locale } from "@/lib/i18n";

const T = {
  en: {
    all: "All categories",
    x: "popularity ÷ cutoff",
    y: "margin ÷ cutoff",
    quads: { star: "Stars", plowhorse: "Plowhorses", puzzle: "Puzzles", dog: "Dogs" },
  },
  es: {
    all: "Todas las categorías",
    x: "popularidad ÷ corte",
    y: "margen ÷ corte",
    quads: { star: "Estrellas", plowhorse: "Caballos", puzzle: "Puzzles", dog: "Perros" },
  },
} as const;

const COLOR: Record<string, string> = {
  star: "var(--color-gilt)",
  plowhorse: "var(--color-herb)",
  puzzle: "var(--color-cover)",
  dog: "var(--color-claret)",
};

const W = 640;
const H = 400;
const PAD = 42;

/**
 * One scatter for every category: axes are normalised to each category's own
 * cutoffs (value ÷ cutoff), so the quadrant boundary is 1.0 on both axes and
 * items from different categories are comparable without lying.
 */
export function MatrixPlot({ locale, matrix }: { locale: Locale; matrix: MatrixResult }) {
  const t = T[locale];
  const [cat, setCat] = useState("");

  const points = useMemo(() => {
    const out: Array<{ x: number; y: number; name: string; cls: string; cat: string }> = [];
    for (const g of matrix.groups) {
      if (cat && g.category !== cat) continue;
      for (const ci of g.items) {
        if (!ci.classification || ci.popularityShare == null || ci.contributionMargin == null || g.cmThreshold == null)
          continue;
        out.push({
          x: Math.min(3.5, ci.popularityShare / g.popularityThreshold),
          y: Math.max(-0.4, Math.min(3.2, g.cmThreshold > 0 ? ci.contributionMargin / g.cmThreshold : 1)),
          name: ci.item.name,
          cls: ci.classification,
          cat: g.category,
        });
      }
    }
    return out;
  }, [matrix, cat]);

  const cats = matrix.groups.filter((g) => g.items.some((i) => i.classification)).map((g) => g.category);
  const sx = (x: number) => PAD + (x / 3.5) * (W - PAD * 2);
  const sy = (y: number) => H - PAD - ((y + 0.4) / 3.6) * (H - PAD * 2);

  return (
    <div>
      {cats.length > 1 ? (
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          aria-label={t.all}
          className="no-print mb-4 bg-paper-deep/40 border border-ink/25 px-3 py-2 text-sm font-mono focus:border-cover"
        >
          <option value="">{t.all}</option>
          {cats.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      ) : null}
      <div className="overflow-x-auto border border-ink/20 bg-paper-deep/30">
        <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[540px] w-full" role="img" aria-label="Menu engineering matrix">
          {/* quadrant shading */}
          <rect x={sx(1)} y={PAD} width={W - PAD - sx(1)} height={sy(1) - PAD} fill="var(--color-gilt)" opacity="0.07" />
          <rect x={PAD} y={sy(1)} width={sx(1) - PAD} height={H - PAD - sy(1)} fill="var(--color-claret)" opacity="0.06" />
          {/* cutoff lines at 1.0 */}
          <line x1={sx(1)} y1={PAD} x2={sx(1)} y2={H - PAD} stroke="var(--color-ink)" strokeOpacity="0.35" strokeDasharray="4 4" />
          <line x1={PAD} y1={sy(1)} x2={W - PAD} y2={sy(1)} stroke="var(--color-ink)" strokeOpacity="0.35" strokeDasharray="4 4" />
          {/* frame */}
          <rect x={PAD} y={PAD} width={W - PAD * 2} height={H - PAD * 2} fill="none" stroke="var(--color-ink)" strokeOpacity="0.25" />
          {/* quadrant labels */}
          <text x={W - PAD - 8} y={PAD + 16} textAnchor="end" fontSize="11" fontFamily="var(--font-mono)" letterSpacing="1.5" fill="var(--color-gilt)">
            {t.quads.star.toUpperCase()}
          </text>
          <text x={PAD + 8} y={PAD + 16} fontSize="11" fontFamily="var(--font-mono)" letterSpacing="1.5" fill="var(--color-cover)" opacity="0.8">
            {t.quads.puzzle.toUpperCase()}
          </text>
          <text x={W - PAD - 8} y={H - PAD - 8} textAnchor="end" fontSize="11" fontFamily="var(--font-mono)" letterSpacing="1.5" fill="var(--color-herb)">
            {t.quads.plowhorse.toUpperCase()}
          </text>
          <text x={PAD + 8} y={H - PAD - 8} fontSize="11" fontFamily="var(--font-mono)" letterSpacing="1.5" fill="var(--color-claret)">
            {t.quads.dog.toUpperCase()}
          </text>
          {/* axes labels */}
          <text x={W / 2} y={H - 10} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-ink-soft)">
            {t.x} →
          </text>
          <text x={14} y={H / 2} fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-ink-soft)" transform={`rotate(-90 14 ${H / 2})`} textAnchor="middle">
            {t.y} →
          </text>
          {/* points */}
          {points.map((p, i) => (
            <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="5" fill={COLOR[p.cls]} fillOpacity="0.75" stroke="var(--color-paper)" strokeWidth="1">
              <title>{`${p.name} (${p.cat})`}</title>
            </circle>
          ))}
        </svg>
      </div>
    </div>
  );
}
