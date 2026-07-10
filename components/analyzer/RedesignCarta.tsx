"use client";

import { useEffect, useMemo, useState } from "react";
import { UI, type Locale } from "@/lib/i18n";
import type { AnalysisResult } from "@/lib/pipeline/types";
import type { MatrixClass } from "@/lib/engine";

const STYLES = {
  hunter: { bg: "#f5f1e6", ink: "#1c241b", accent: "#b28d42", head: "#24372b" },
  ink: { bg: "#f7f5ef", ink: "#171717", accent: "#8a8172", head: "#171717" },
  claret: { bg: "#f8f2ea", ink: "#2a1518", accent: "#a4761f", head: "#6e1f2a" },
  navy: { bg: "#f4f3ec", ink: "#111a26", accent: "#9a7b3f", head: "#15243a" },
} as const;
type StyleKey = keyof typeof STYLES;

const CLASS_RANK: Record<MatrixClass, number> = { star: 0, puzzle: 1, plowhorse: 2, dog: 3 };

const T = {
  en: { style: "House style", retire: "Retire the dogs", retired: "dishes retired from the card", back: "Back" },
  es: { style: "Estilo de la casa", retire: "Jubilar los perros", retired: "platos retirados de la carta", back: "Volver" },
} as const;

function sentenceCase(s: string): string {
  if (s !== s.toUpperCase()) return s;
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function RedesignCarta({
  locale,
  result,
  autoPrint = false,
  onDone,
}: {
  locale: Locale;
  result: AnalysisResult;
  autoPrint?: boolean;
  onDone?: () => void;
}) {
  const t = UI[locale].analyzer;
  const tt = T[locale];
  const [styleKey, setStyleKey] = useState<StyleKey>("hunter");
  const [retireDogs, setRetireDogs] = useState(true);
  const s = STYLES[styleKey];

  useEffect(() => {
    if (!autoPrint) return;
    const done = () => onDone?.();
    window.addEventListener("afterprint", done);
    const id = window.setTimeout(() => window.print(), 150);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("afterprint", done);
    };
  }, [autoPrint, onDone]);

  const { sections, retired } = useMemo(() => {
    const priceById = new Map(result.pricing.map((r) => [r.itemId, r.suggested]));
    const classById = new Map<string, MatrixClass | null>();
    for (const g of result.matrix.groups)
      for (const ci of g.items) classById.set(ci.item.id, ci.classification);
    const rewriteById = new Map(
      result.doctor.findings.filter((f) => f.rewrite).map((f) => [f.itemId, f.rewrite!]),
    );

    const byCategory = new Map<string, typeof result.items>();
    for (const it of result.items) {
      const arr = byCategory.get(it.category) ?? [];
      arr.push(it);
      byCategory.set(it.category, arr);
    }

    let retired = 0;
    const sections = [...byCategory.entries()].map(([category, items]) => {
      const kept = items.filter((i) => {
        const isDog = classById.get(i.id) === "dog";
        if (isDog && retireDogs) {
          retired++;
          return false;
        }
        return true;
      });
      kept.sort((a, b) => {
        const ra = CLASS_RANK[classById.get(a.id) ?? "plowhorse"] ?? 2;
        const rb = CLASS_RANK[classById.get(b.id) ?? "plowhorse"] ?? 2;
        if (ra !== rb) return ra - rb;
        return b.price - a.price;
      });
      return {
        category,
        items: kept.map((i) => ({
          name: i.name,
          description: rewriteById.get(i.id) ?? (i.description ? sentenceCase(i.description) : null),
          price: priceById.get(i.id) ?? i.price,
          star: classById.get(i.id) === "star",
        })),
      };
    });
    return { sections: sections.filter((s) => s.items.length > 0), retired };
  }, [result, retireDogs]);

  return (
    <div>
      <div className="no-print flex flex-wrap items-center gap-5 mb-6">
        <div className="flex gap-1" role="radiogroup" aria-label={tt.style}>
          {(Object.keys(STYLES) as StyleKey[]).map((k) => (
            <button
              key={k}
              role="radio"
              aria-checked={styleKey === k}
              onClick={() => setStyleKey(k)}
              title={k}
              className={`w-8 h-8 border-2 transition-transform ${styleKey === k ? "scale-110 border-ink" : "border-ink/20"}`}
              style={{ background: `linear-gradient(135deg, ${STYLES[k].head} 50%, ${STYLES[k].bg} 50%)` }}
            />
          ))}
        </div>
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-ink-soft" title={t.redesignBrand.fromMenu}>
          {t.redesignBrand.declared}
        </span>
        <label className="flex items-center gap-2 text-sm text-ink-soft cursor-pointer">
          <input
            type="checkbox"
            checked={retireDogs}
            onChange={(e) => setRetireDogs(e.target.checked)}
            className="accent-(--color-cover)"
          />
          {tt.retire}
        </label>
        {autoPrint ? (
          <button onClick={onDone} className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-ink-soft hover:text-cover">
            ← {tt.back}
          </button>
        ) : null}
      </div>

      <div
        className="print-carta mx-auto max-w-xl px-8 sm:px-12 py-12 border"
        style={{ background: s.bg, color: s.ink, borderColor: `${s.accent}66` }}
      >
        <header className="text-center mb-10">
          <p className="eyebrow" style={{ color: s.accent }}>
            {result.profile.location}
          </p>
          <h2 className="display text-4xl tracking-[0.08em] mt-2" style={{ color: s.head }}>
            {result.profile.name}
          </h2>
          <div className="w-24 mx-auto mt-5" style={{ borderTop: `1px solid ${s.accent}`, boxShadow: `0 3px 0 -2px ${s.accent}88` }} />
        </header>

        {sections.map((sec) => (
          <section key={sec.category} className="mb-8" style={{ breakInside: "avoid" }}>
            <h3
              className="display text-xl tracking-[0.14em] uppercase text-center mb-4"
              style={{ color: s.head }}
            >
              {sec.category}
            </h3>
            <div className="space-y-3.5">
              {sec.items.map((it, i) => (
                <div key={i}>
                  <div className="menuline text-[1.02rem]">
                    <span className="font-medium">
                      {it.name}
                      {it.star ? (
                        <span aria-hidden="true" style={{ color: s.accent }}>
                          {" "}
                          ✦
                        </span>
                      ) : null}
                    </span>
                    <span className="dots" aria-hidden="true" />
                    {/* No currency sign, per Yang, Kimes & Sessarego (2009). */}
                    <span className="lining font-mono">{it.price.toFixed(2).replace(".", ",")}</span>
                  </div>
                  {it.description ? (
                    <p className="text-sm mt-0.5 opacity-75 italic pr-14">{it.description}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ))}

        <footer className="text-center mt-12 pt-6" style={{ borderTop: `1px solid ${s.accent}55` }}>
          <p className="font-mono text-[0.55rem] tracking-[0.25em] uppercase opacity-60">
            {locale === "es"
              ? "IVA incluido · alérgenos: pregunte al personal · agua del grifo gratuita"
              : "VAT included · allergens: ask our staff · free tap water available"}
          </p>
        </footer>
      </div>

      {retired > 0 ? (
        <p className="no-print font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ink-soft mt-4 text-center">
          {retired} {tt.retired}
        </p>
      ) : null}
    </div>
  );
}
