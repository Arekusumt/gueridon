"use client";

import { useState } from "react";
import { awkwardLeftDigit, snapToPsychological } from "@/lib/engine";
import type { Positioning } from "@/lib/engine";
import { InfoDot } from "@/components/InfoDot";
import type { Locale } from "@/lib/i18n";

const T = {
  en: {
    title: "Snap a price to its psychology",
    positioningInfo:
      "How your house wants to be read. Value: charm endings (.95/.90) keep the first digit low — the digit people actually read. Mid: .50/.95. Premium: whole and half euros — round numbers feel confident in pleasure purchases, per Wadhwa & Zhang (2015).",
    positioning: { value: "Value", mid: "Mid", premium: "Premium" },
    raw: "Raw price",
    snapped: "On the grid",
    awkward: "sits just past a left digit — money left on the table of perception",
    premiumNote: "Premium rounds: whole and half euros read as confidence, not carelessness.",
    charmNote: "Charm endings keep the left digit low — the digit people actually read.",
  },
  es: {
    title: "Ajusta un precio a su psicología",
    positioningInfo:
      "Cómo quiere leerse tu casa. Económico: terminaciones charm (,95/,90) mantienen bajo el primer dígito — el que la gente lee de verdad. Medio: ,50/,95. Premium: euros enteros y medios — los números redondos transmiten seguridad en compras de placer, según Wadhwa & Zhang (2015).",
    positioning: { value: "Económico", mid: "Medio", premium: "Premium" },
    raw: "Precio bruto",
    snapped: "En la parrilla",
    awkward: "queda justo pasado el dígito izquierdo — percepción regalada",
    premiumNote: "El premium redondea: enteros y medios euros leen como seguridad, no como descuido.",
    charmNote: "Las terminaciones charm mantienen bajo el dígito izquierdo — el que la gente lee de verdad.",
  },
} as const;

export function EndingsWidget({ locale }: { locale: Locale }) {
  const t = T[locale];
  const [price, setPrice] = useState(10.2);
  const [pos, setPos] = useState<Positioning>("mid");

  const snapped = snapToPsychological(price, pos);
  const awkward = awkwardLeftDigit(price);

  return (
    <figure className="border border-ink/20 bg-paper-deep/60 p-6 sm:p-8 my-10">
      <figcaption className="eyebrow text-ink-soft mb-5">
        {t.title}
        <InfoDot label={t.title} text={t.positioningInfo} />
      </figcaption>
      <div
        className="flex gap-1 font-mono text-xs uppercase tracking-widest mb-6"
        role="radiogroup"
        aria-label={t.title}
      >
        {(Object.keys(t.positioning) as Positioning[]).map((p) => (
          <button
            key={p}
            role="radio"
            aria-checked={pos === p}
            onClick={() => setPos(p)}
            className={`px-3 py-2 border transition-colors ${
              pos === p
                ? "bg-cover text-paper border-cover"
                : "border-ink/25 text-ink-soft hover:border-cover"
            }`}
          >
            {t.positioning[p]}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="font-mono text-xs uppercase tracking-widest text-ink-soft">
          {t.raw} · <span className="lining">€{price.toFixed(2)}</span>
        </span>
        <input
          type="range"
          min={4}
          max={32}
          step={0.05}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="w-full accent-(--color-cover) mt-2"
        />
      </label>
      <div className="mt-6 flex items-baseline gap-6" aria-live="polite">
        <span className="font-mono lining text-2xl line-through decoration-claret/60 text-ink-soft">
          {price.toFixed(2)}
        </span>
        <span className="display lining text-5xl text-cover">{snapped.toFixed(2)}</span>
      </div>
      <p className="text-sm text-ink-soft mt-4 leading-snug">
        {awkward && pos !== "premium" ? `€${price.toFixed(2)} ${t.awkward}. ` : ""}
        {pos === "premium" ? t.premiumNote : t.charmNote}
      </p>
    </figure>
  );
}
