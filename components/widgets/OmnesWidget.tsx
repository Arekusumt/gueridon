"use client";

import { useMemo, useState } from "react";
import { omnesReport } from "@/lib/engine";
import { InfoDot } from "@/components/InfoDot";
import type { Locale } from "@/lib/i18n";

const T = {
  en: {
    title: "Audit a category — Omnes' rules, live",
    hint: "One price per line. This runs the exact engine the analyzer uses.",
    ratio: "Dispersion (dearest ÷ cheapest)",
    ratioInfo:
      "Most expensive dish divided by the cheapest, within one section. Past ~3× the section reads incoherent — the eye flees to the extremes and the middle stops selling.",
    bands: "Middle band holds the majority",
    bandsInfo:
      "Cut the section's price range into three equal bands. The middle band should hold at least as many dishes as both ends combined — it's where you want most choices (and most guests) to land.",
    pass: "sound",
    fail: "broken",
    na: "n/a",
  },
  es: {
    title: "Audita una categoría — reglas de Omnes, en vivo",
    hint: "Un precio por línea. Esto ejecuta el mismo motor que usa el analizador.",
    ratio: "Dispersión (más caro ÷ más barato)",
    ratioInfo:
      "El plato más caro dividido por el más barato, dentro de una sección. Pasado ~3× la sección lee incoherente — el ojo huye a los extremos y el medio deja de vender.",
    bands: "La banda media tiene mayoría",
    bandsInfo:
      "Corta el rango de precios de la sección en tres bandas iguales. La banda media debería reunir al menos tantos platos como los dos extremos juntos — es donde quieres que caigan la mayoría de elecciones (y de clientes).",
    pass: "sana",
    fail: "rota",
    na: "n/d",
  },
} as const;

export function OmnesWidget({ locale }: { locale: Locale }) {
  const t = T[locale];
  const [raw, setRaw] = useState("9.50\n12.00\n13.50\n14.00\n16.50\n32.00");

  const report = useMemo(() => {
    const prices = raw
      .split(/\r?\n/)
      .map((l) => Number(l.trim().replace(",", ".")))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (prices.length < 2) return null;
    return omnesReport(
      prices.map((price, i) => ({ id: String(i), name: `#${i}`, category: "c", price })),
    )[0];
  }, [raw]);

  const verdict = (pass: boolean | null) =>
    pass == null ? t.na : pass ? t.pass : t.fail;
  const tone = (pass: boolean | null) =>
    pass == null ? "text-ink-soft" : pass ? "text-herb" : "text-claret";

  return (
    <figure className="border border-ink/20 bg-paper-deep/60 p-6 sm:p-8 my-10">
      <figcaption className="eyebrow text-ink-soft mb-5">{t.title}</figcaption>
      <div className="grid sm:grid-cols-[minmax(8rem,12rem)_1fr] gap-6">
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={6}
          aria-label="Prices"
          className="font-mono lining text-sm bg-paper border border-ink/25 p-3 w-full resize-y focus:border-cover"
        />
        <div className="space-y-4 text-base" aria-live="polite">
          <div className="menuline">
            <span>
              {t.ratio}
              <InfoDot label={t.ratio} text={t.ratioInfo} />
            </span>
            <span className="dots" aria-hidden="true" />
            <span className={`font-mono lining ${tone(report?.dispersion.pass ?? null)}`}>
              {report?.dispersion.ratio ?? "—"}× · {verdict(report?.dispersion.pass ?? null)}
            </span>
          </div>
          <div className="menuline">
            <span>
              {t.bands}
              <InfoDot label={t.bands} text={t.bandsInfo} />
            </span>
            <span className="dots" aria-hidden="true" />
            <span className={`font-mono lining ${tone(report?.bands.pass ?? null)}`}>
              {report ? `${report.bands.middle.length}/${report.itemCount}` : "—"} ·{" "}
              {verdict(report?.bands.pass ?? null)}
            </span>
          </div>
          <p className="text-xs text-ink-soft/80 font-mono leading-relaxed pt-2">
            <a href={`/${locale}/analyze`} className="underline decoration-gilt/60 hover:text-cover">
              {t.hint}
            </a>
          </p>
        </div>
      </div>
    </figure>
  );
}
