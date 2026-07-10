import Link from "next/link";
import { notFound } from "next/navigation";
import { MenuLine } from "@/components/MenuLine";
import { Reveal } from "@/components/Reveal";
import { EndingsWidget } from "@/components/widgets/EndingsWidget";
import { MatrixWidget } from "@/components/widgets/MatrixWidget";
import { OmnesWidget } from "@/components/widgets/OmnesWidget";
import { BIBLIOGRAPHY, citeNumber, EDITORIAL, pick } from "@/lib/content";
import { isLocale, UI, type Locale } from "@/lib/i18n";

function Cites({ ids }: { ids?: string[] }) {
  if (!ids || ids.length === 0) return null;
  return (
    <sup className="font-mono text-[0.62em] text-gilt ml-0.5">
      {ids.map((id, i) => {
        const n = citeNumber(id);
        if (n == null) return null;
        return (
          <a key={id} href="#receipts" className="hover:text-cover">
            {i > 0 ? " " : ""}
            {n}
          </a>
        );
      })}
    </sup>
  );
}

function SectionWidgets({ id, locale }: { id: string; locale: Locale }) {
  if (id === "matrix") return <MatrixWidget locale={locale} />;
  if (id === "pricing")
    return (
      <>
        <EndingsWidget locale={locale} />
        <OmnesWidget locale={locale} />
      </>
    );
  return null;
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = UI[locale];
  const other: Locale = locale === "en" ? "es" : "en";

  return (
    <main>
      {/* ————— The cover ————— */}
      <header className="cover-bg text-gilt-bright min-h-svh p-4 sm:p-6 flex">
        <div className="cover-frame flex-1 flex flex-col items-center justify-between text-center px-6 py-10 relative">
          <div className="w-full flex items-center justify-between font-mono text-[0.65rem] tracking-[0.3em] uppercase text-gilt">
            <span>Est. MMXXVI</span>
            <Link href={`/${other}`} className="hover:text-paper transition-colors">
              {locale === "en" ? "EN · es" : "en · ES"}
            </Link>
          </div>

          <div className="max-w-3xl w-full">
            <p className="eyebrow text-gilt mb-8">menu engineering</p>
            <h1 className="display text-[clamp(3rem,12vw,7.5rem)] tracking-[0.12em] text-gilt-bright">
              GUERIDON
            </h1>
            <div className="rule-double w-40 mx-auto mt-8 mb-7" />
            <p className="italic text-paper/90 text-xl sm:text-2xl">{t.tagline}</p>

            <nav className="max-w-xs mx-auto mt-14 space-y-3 text-paper/85 text-base" aria-label="Index">
              <a href="#essay" className="block hover:text-gilt-bright transition-colors">
                <MenuLine label={t.nav.essay} value="I" />
              </a>
              {/* The house recommendation: the one line a menu marks with a star. */}
              <Link
                href={`/${locale}/analyze`}
                className="block text-gilt-bright hover:text-paper transition-colors"
              >
                <MenuLine
                  label={
                    <>
                      {t.nav.analyze} <span aria-hidden="true">✦</span>
                    </>
                  }
                  value="II"
                />
              </Link>
              <a href="#receipts" className="block hover:text-gilt-bright transition-colors">
                <MenuLine label={t.nav.receipts} value="III" />
              </a>
            </nav>
          </div>

          <a
            href="#essay"
            className="font-mono text-[0.65rem] tracking-[0.3em] uppercase text-gilt hover:text-paper transition-colors"
          >
            {t.open} ↓
          </a>
        </div>
      </header>

      {/* ————— The essay ————— */}
      <div id="essay" className="max-w-2xl mx-auto px-5 sm:px-8">
        {EDITORIAL.map((section, si) => (
          <Reveal as="section" key={section.id} className="py-16 sm:py-20 border-b border-ink/10">
            <article id={section.id}>
              <p className="eyebrow text-gilt">{pick(section.course, locale)}</p>
              <h2 className="display text-4xl sm:text-5xl mt-3 text-cover">
                {pick(section.title, locale)}
              </h2>
              <p className="italic text-xl text-ink-soft mt-5">{pick(section.lede, locale)}</p>
              <div className="mt-8 space-y-6">
                {(() => {
                  let menulineRun: React.ReactNode[] = [];
                  const out: React.ReactNode[] = [];
                  let pIndex = 0;
                  const flush = (key: string) => {
                    if (menulineRun.length === 0) return;
                    out.push(
                      <div
                        key={key}
                        className="border border-ink/20 bg-paper-deep/50 px-6 py-5 space-y-3 my-8"
                      >
                        {menulineRun}
                      </div>,
                    );
                    menulineRun = [];
                  };
                  section.blocks.forEach((block, bi) => {
                    if (block.type === "menuline") {
                      menulineRun.push(
                        <MenuLine
                          key={bi}
                          label={
                            <>
                              {pick(block.label, locale)}
                              {block.cite ? <Cites ids={[block.cite]} /> : null}
                            </>
                          }
                          value={block.value}
                        />,
                      );
                      return;
                    }
                    flush(`ml-${bi}`);
                    if (block.type === "p") {
                      out.push(
                        <p key={bi} className={pIndex === 0 && si > 0 ? "dropcap" : undefined}>
                          {block.en && pick(block, locale)}
                          <Cites ids={block.cites} />
                        </p>,
                      );
                      pIndex++;
                    } else if (block.type === "pull") {
                      out.push(
                        <blockquote key={bi} className="my-10 text-center">
                          <div className="rule-double w-16 mx-auto mb-6" />
                          <p className="display text-2xl sm:text-[1.7rem] leading-snug text-cover italic-none">
                            {pick(block, locale)}
                          </p>
                        </blockquote>,
                      );
                    }
                  });
                  flush("ml-end");
                  return out;
                })()}
              </div>
              <SectionWidgets id={section.id} locale={locale} />
            </article>
          </Reveal>
        ))}
      </div>

      {/* ————— CTA: the pass ————— */}
      <Reveal as="section" className="cover-bg text-paper my-20">
        <div className="max-w-2xl mx-auto px-5 sm:px-8 py-20 text-center">
          <p className="eyebrow text-gilt mb-6">II</p>
          <h2 className="display text-4xl sm:text-5xl text-gilt-bright">{t.analyzeCta}</h2>
          <p className="text-paper/80 mt-5 max-w-md mx-auto">{t.analyzeCtaSub}</p>
          <Link
            href={`/${locale}/analyze`}
            className="inline-block mt-9 bg-paper text-ink font-mono text-xs tracking-[0.25em] uppercase px-8 py-4 hover:bg-gilt-bright transition-colors"
          >
            {t.nav.analyze} →
          </Link>
          <p className="font-mono text-[0.62rem] tracking-[0.2em] uppercase text-paper/60 mt-4">
            {t.ctaRisk}
          </p>
        </div>
      </Reveal>

      {/* ————— The receipts ————— */}
      <Reveal as="section" className="max-w-2xl mx-auto px-5 sm:px-8 pb-24">
        <article id="receipts">
          <p className="eyebrow text-gilt">III</p>
          <h2 className="display text-4xl sm:text-5xl mt-3 text-cover">{t.receipts.title}</h2>
          <p className="italic text-xl text-ink-soft mt-5 mb-10">{t.receipts.lede}</p>
          <ol className="space-y-5">
            {BIBLIOGRAPHY.map((b, i) => (
              <li key={b.id} id={`cite-${b.id}`}>
                <MenuLine
                  label={
                    <span>
                      <span className="font-mono text-xs text-gilt mr-2 lining">{i + 1}</span>
                      {b.authors} ({b.year})
                      {b.confidence === "secondary" ? (
                        <span className="font-mono text-[0.6rem] uppercase tracking-widest text-ink-soft ml-2">
                          {locale === "es" ? "doctrina del oficio" : "trade doctrine"}
                        </span>
                      ) : null}
                    </span>
                  }
                  value={
                    <a
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-gilt/50 hover:decoration-gilt"
                    >
                      {b.citable_stat && b.citable_stat.length <= 28 ? b.citable_stat : "→"}
                    </a>
                  }
                  sub={
                    <>
                      <cite className="not-italic italic">{b.title}</cite>, {b.publication}.{" "}
                      {b.finding}
                      {b.citable_stat && b.citable_stat.length > 28 ? ` — ${b.citable_stat}` : null}
                    </>
                  }
                />
              </li>
            ))}
          </ol>
        </article>
      </Reveal>

      {/* ————— Footer ————— */}
      <footer className="bg-cover-deep text-paper/70 text-sm">
        <div className="max-w-2xl mx-auto px-5 sm:px-8 py-12 space-y-3">
          <div className="rule-double w-16 mb-8" />
          <p>
            {t.footer.built} ·{" "}
            <a
              href="https://github.com/Arekusumt/gueridon"
              className="text-gilt-bright underline decoration-gilt/60 hover:text-paper transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>{" "}
            ·{" "}
            <a
              href="https://gradiangrowth.com"
              className="text-gilt-bright underline decoration-gilt/60 hover:text-paper transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Gradian
            </a>
          </p>
          <p>{t.footer.demoCredit}</p>
          <p className="font-mono text-xs tracking-wider text-paper/75">{t.footer.license}</p>
        </div>
      </footer>
    </main>
  );
}
