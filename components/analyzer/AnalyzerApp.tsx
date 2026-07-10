"use client";

import { useCallback, useRef, useState } from "react";
import { UI, type Locale } from "@/lib/i18n";
import type { Positioning } from "@/lib/engine";
import type { AnalysisResult, PipelineEvent, StageId } from "@/lib/pipeline/types";
import { Dashboard } from "./Dashboard";

const STAGES: StageId[] = [
  "parse",
  "normalize",
  "estimate",
  "competitors",
  "pricing",
  "doctor",
  "compliance",
  "report",
];

type Phase = "form" | "running" | "done";

async function filesToImages(files: FileList | null) {
  if (!files) return [];
  const out: Array<{ data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" }> = [];
  for (const file of Array.from(files).slice(0, 4)) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) continue;
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    out.push({
      data: dataUrl.split(",")[1],
      mediaType: file.type as "image/jpeg" | "image/png" | "image/webp",
    });
  }
  return out;
}

export function AnalyzerApp({ locale }: { locale: Locale }) {
  const t = UI[locale].analyzer;
  const [phase, setPhase] = useState<Phase>("form");
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [menuText, setMenuText] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [positioning, setPositioning] = useState<Positioning>("mid");
  const [zone, setZone] = useState<string>("");
  const [catalonia, setCatalonia] = useState(true);
  const [competitors, setCompetitors] = useState("");
  const [byoKey, setByoKey] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const errorText = useCallback(
    (code: string) => {
      if (code === "RATE_LIMITED") return t.rateLimited;
      if (code === "PHOTO_NEEDS_LIVE") return t.photoNeedsLive;
      return t.empty;
    },
    [t],
  );

  const runDemo = useCallback(async () => {
    setPhase("running");
    setError(null);
    setEvents([]);
    try {
      const data = (
        locale === "es"
          ? await import("@/data/demo/waterfront-analysis.es.json")
          : await import("@/data/demo/waterfront-analysis.en.json")
      ).default as unknown as AnalysisResult;
      // Honest replay: precomputed result, staged for the rail.
      const script: PipelineEvent[] = STAGES.flatMap((stage): PipelineEvent[] => [
        { stage, status: "start" },
        { stage, status: "done", detail: undefined, ms: undefined },
      ]);
      for (const ev of script) {
        setEvents((prev) => [...prev, ev]);
        await new Promise((r) => setTimeout(r, ev.status === "done" ? 260 : 90));
      }
      setResult(data);
      setPhase("done");
    } catch {
      setError(t.empty);
      setPhase("form");
    }
  }, [locale, t.empty]);

  const run = useCallback(async () => {
    setPhase("running");
    setError(null);
    setEvents([]);
    setResult(null);
    try {
      const images = await filesToImages(fileRef.current?.files ?? null);
      const body = {
        profile: {
          name: name || "—",
          location: location || "—",
          cuisine: cuisine || "—",
          positioning,
          region: { country: "ES" as const, catalonia },
          marketZone: zone || null,
          locale,
        },
        menuText: menuText.trim() || undefined,
        images: images.length ? images : undefined,
        competitorTexts: competitors.trim()
          ? competitors.split(/^---+$/m).map((s) => s.trim()).filter(Boolean).slice(0, 5)
          : undefined,
      };
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(byoKey.trim() ? { "x-byo-key": byoKey.trim() } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "PIPELINE_ERROR" }));
        throw new Error(j.error ?? "PIPELINE_ERROR");
      }
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const evLine = frame.match(/^event: (.+)$/m)?.[1];
          const dataLine = frame.match(/^data: (.+)$/m)?.[1];
          if (!evLine || !dataLine) continue;
          const data = JSON.parse(dataLine);
          if (evLine === "stage") setEvents((prev) => [...prev, data as PipelineEvent]);
          else if (evLine === "result") {
            setResult(data as AnalysisResult);
            setPhase("done");
          } else if (evLine === "error") throw new Error(data.code);
        }
      }
      setPhase((p) => (p === "running" ? "form" : p));
    } catch (e) {
      setError(errorText(e instanceof Error ? e.message : "PIPELINE_ERROR"));
      setPhase("form");
    }
  }, [byoKey, catalonia, competitors, cuisine, errorText, locale, location, menuText, name, positioning, zone]);

  const canRun = menuText.trim().length > 0 || (fileRef.current?.files?.length ?? 0) > 0;

  if (phase === "done" && result) {
    return (
      <div>
        <StageRail t={t} events={events} compact />
        <Dashboard locale={locale} result={result} onReset={() => { setPhase("form"); setResult(null); setEvents([]); }} />
      </div>
    );
  }

  if (phase === "running") {
    return <StageRail t={t} events={events} />;
  }

  return (
    <div className="mt-10 grid lg:grid-cols-[1.2fr_1fr] gap-10 no-print">
      {/* — Step 1: the menu — */}
      <section>
        <h2 className="eyebrow text-gilt mb-4">1 · {t.stepMenu}</h2>
        <p className="text-sm text-ink-soft mb-3">{t.menuHint}</p>
        <textarea
          value={menuText}
          onChange={(e) => setMenuText(e.target.value)}
          rows={14}
          aria-label={t.pasteLabel}
          placeholder={"STARTERS\nPatatas Bravas\ncrispy potatoes, smoked aioli ... 6,50\n…"}
          className="w-full font-mono text-sm bg-paper-deep/40 border border-ink/25 p-4 focus:border-cover resize-y"
        />
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="font-mono text-xs text-ink-soft cursor-pointer hover:text-cover">
            {t.photosLabel}:{" "}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="text-xs" />
          </label>
        </div>
        <div className="mt-6 border-t border-ink/15 pt-5">
          <button
            onClick={runDemo}
            className="font-mono text-xs tracking-[0.2em] uppercase bg-cover text-paper px-5 py-3 hover:bg-cover-deep transition-colors"
          >
            {t.demoBtn} ✦
          </button>
          <p className="text-xs text-ink-soft mt-2 max-w-sm">{t.demoNote}</p>
        </div>
      </section>

      {/* — Steps 2-3: the house & the market — */}
      <section className="space-y-8">
        <div>
          <h2 className="eyebrow text-gilt mb-4">2 · {t.stepHouse}</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.name} value={name} onChange={setName} />
            <Field label={t.location} value={location} onChange={setLocation} />
            <Field label={t.cuisine} value={cuisine} onChange={setCuisine} />
            <label className="block">
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ink-soft">{t.positioning}</span>
              <select
                value={positioning}
                onChange={(e) => setPositioning(e.target.value as Positioning)}
                className="mt-1 w-full bg-paper-deep/40 border border-ink/25 px-3 py-2.5 text-sm font-mono focus:border-cover"
              >
                {(["value", "mid", "premium"] as const).map((p) => (
                  <option key={p} value={p}>{t.positioningOpts[p]}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div>
          <h2 className="eyebrow text-gilt mb-4">3 · {t.stepMarket}</h2>
          <label className="block">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ink-soft">{t.zone}</span>
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="mt-1 w-full bg-paper-deep/40 border border-ink/25 px-3 py-2.5 text-sm font-mono focus:border-cover"
            >
              <option value="">{t.zoneNone}</option>
              <option value="tarragona">Tarragona</option>
              <option value="reus">Reus</option>
              <option value="salou-la-pineda">Salou · La Pineda</option>
              <option value="barcelona">Barcelona</option>
            </select>
          </label>
          <label className="flex items-center gap-2 mt-3 text-sm text-ink-soft cursor-pointer">
            <input type="checkbox" checked={catalonia} onChange={(e) => setCatalonia(e.target.checked)} className="accent-(--color-cover)" />
            {t.catalonia}
          </label>
          <label className="block mt-4">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ink-soft">{t.competitors}</span>
            <textarea
              value={competitors}
              onChange={(e) => setCompetitors(e.target.value)}
              rows={4}
              placeholder={"Competitor A…\n---\nCompetitor B…"}
              className="mt-1 w-full font-mono text-xs bg-paper-deep/40 border border-ink/25 p-3 focus:border-cover resize-y"
            />
            <span className="text-xs text-ink-soft">{t.competitorsHint}</span>
          </label>
        </div>
        <div className="border-t border-ink/15 pt-5">
          <label className="block mb-4">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ink-soft">{t.byoLabel}</span>
            <input
              type="password"
              value={byoKey}
              onChange={(e) => setByoKey(e.target.value)}
              autoComplete="off"
              className="mt-1 w-full font-mono text-sm bg-paper-deep/40 border border-ink/25 px-3 py-2.5 focus:border-cover"
            />
            <span className="text-xs text-ink-soft">{t.byoHint}</span>
          </label>
          {error ? <p className="text-claret text-sm mb-3" role="alert">{error}</p> : null}
          <button
            onClick={run}
            disabled={!canRun}
            className="w-full bg-cover text-paper font-mono text-xs tracking-[0.25em] uppercase px-6 py-4 hover:bg-cover-deep transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t.run}
          </button>
          <p className="text-xs text-ink-soft mt-3">{t.disclaimer}</p>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ink-soft">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-paper-deep/40 border border-ink/25 px-3 py-2.5 text-sm focus:border-cover"
      />
    </label>
  );
}

/** The agentic view: the brigade working the pass, stage by stage. */
function StageRail({
  t,
  events,
  compact = false,
}: {
  t: (typeof UI)["en"]["analyzer"];
  events: PipelineEvent[];
  compact?: boolean;
}) {
  const state = new Map<StageId, PipelineEvent>();
  for (const e of events) {
    const cur = state.get(e.stage);
    if (!cur || e.status !== "start") state.set(e.stage, e);
  }
  if (compact) {
    const totalMs = events.filter((e) => e.ms != null).reduce((a, e) => a + (e.ms ?? 0), 0);
    return (
      <p className="no-print font-mono text-[0.65rem] tracking-[0.2em] uppercase text-ink-soft mt-8">
        {STAGES.map((s) => (state.get(s)?.status === "done" ? "●" : "○")).join(" ")} ·{" "}
        {totalMs > 0 ? `${totalMs} ms` : "—"}
      </p>
    );
  }
  return (
    <div className="mt-14 max-w-md mx-auto" aria-live="polite">
      <p className="eyebrow text-gilt text-center mb-8">{t.running}</p>
      <ol className="space-y-4">
        {STAGES.map((stage) => {
          const ev = state.get(stage);
          const status = ev?.status ?? "pending";
          return (
            <li key={stage} className="menuline text-base">
              <span className={status === "pending" ? "text-ink-soft/50" : ""}>
                <span
                  className={`inline-block w-4 font-mono ${
                    status === "done" ? "text-herb" : status === "start" ? "text-gilt animate-pulse" : "text-ink-soft/40"
                  }`}
                >
                  {status === "done" ? "●" : status === "start" ? "◐" : "○"}
                </span>{" "}
                {t.stages[stage]}
              </span>
              <span className="dots" aria-hidden="true" />
              <span className="font-mono lining text-xs text-ink-soft">
                {status === "done" ? (ev?.detail ?? `${ev?.ms ?? 0} ms`) : status === "start" ? "…" : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
