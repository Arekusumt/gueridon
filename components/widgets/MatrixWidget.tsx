"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";

const T = {
  en: {
    title: "Classify a dish",
    hint: "Category of 8 dishes → popularity cutoff is 70% of an equal share (8.75%). Margin cutoff here: €7.00.",
    popularity: "Popularity share",
    margin: "Contribution margin",
    verdicts: {
      star: ["Star", "Protect it. Feature it. Never discount it."],
      plowhorse: ["Plowhorse", "Loved but thin. Engineer the cost or nudge the price — quietly."],
      puzzle: ["Puzzle", "Profitable but ignored. Rename, reposition, let a server sell it."],
      dog: ["Dog", "Neither loved nor profitable. Rework it or retire it."],
    },
  },
  es: {
    title: "Clasifica un plato",
    hint: "Categoría de 8 platos → el corte de popularidad es el 70% de la cuota equitativa (8,75%). Corte de margen aquí: 7,00 €.",
    popularity: "Cuota de popularidad",
    margin: "Margen de contribución",
    verdicts: {
      star: ["Estrella", "Protégelo. Destácalo. No lo rebajes jamás."],
      plowhorse: ["Caballo de tiro", "Querido pero justo de margen. Ingeniería de coste o subida discreta."],
      puzzle: ["Puzzle", "Rentable pero ignorado. Renómbralo, recolócalo, que el camarero lo venda."],
      dog: ["Perro", "Ni querido ni rentable. Reformúlalo o jubílalo."],
    },
  },
} as const;

const POP_CUTOFF = 8.75; // 0.7 / 8 dishes
const CM_CUTOFF = 7;

export function MatrixWidget({ locale }: { locale: Locale }) {
  const t = T[locale];
  const [pop, setPop] = useState(14);
  const [cm, setCm] = useState(9);

  const cls =
    pop >= POP_CUTOFF && cm >= CM_CUTOFF
      ? "star"
      : pop >= POP_CUTOFF
        ? "plowhorse"
        : cm >= CM_CUTOFF
          ? "puzzle"
          : "dog";
  const [name, advice] = t.verdicts[cls];
  const tone =
    cls === "star"
      ? "text-gilt"
      : cls === "dog"
        ? "text-claret"
        : cls === "plowhorse"
          ? "text-herb"
          : "text-ink";

  return (
    <figure className="border border-ink/20 bg-paper-deep/60 p-6 sm:p-8 my-10">
      <figcaption className="eyebrow text-ink-soft mb-5">{t.title}</figcaption>
      <div className="grid sm:grid-cols-[1fr_auto] gap-8 items-center">
        <div className="space-y-6">
          <label className="block">
            <span className="font-mono text-xs uppercase tracking-widest text-ink-soft">
              {t.popularity} · <span className="lining">{pop.toFixed(1)}%</span>
            </span>
            <input
              type="range"
              min={1}
              max={30}
              step={0.5}
              value={pop}
              onChange={(e) => setPop(Number(e.target.value))}
              className="w-full accent-(--color-cover) mt-2"
            />
          </label>
          <label className="block">
            <span className="font-mono text-xs uppercase tracking-widest text-ink-soft">
              {t.margin} · <span className="lining">€{cm.toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={16}
              step={0.25}
              value={cm}
              onChange={(e) => setCm(Number(e.target.value))}
              className="w-full accent-(--color-cover) mt-2"
            />
          </label>
        </div>
        <div className="text-center sm:w-56" aria-live="polite">
          <div className={`display text-4xl ${tone}`}>{name}</div>
          <p className="text-sm text-ink-soft mt-2 leading-snug">{advice}</p>
        </div>
      </div>
      <p className="text-xs text-ink-soft/80 mt-6 font-mono leading-relaxed">{t.hint}</p>
    </figure>
  );
}
