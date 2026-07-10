import Link from "next/link";
import { notFound } from "next/navigation";
import { AnalyzerApp } from "@/components/analyzer/AnalyzerApp";
import { isLocale, UI, type Locale } from "@/lib/i18n";

export default async function AnalyzePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = UI[locale];
  const other: Locale = locale === "en" ? "es" : "en";

  return (
    <main className="min-h-svh">
      <header className="no-print sticky top-0 z-20 bg-paper/95 backdrop-blur-sm border-b border-ink/15">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-4 flex items-baseline justify-between gap-4">
          <Link href={`/${locale}`} className="display tracking-[0.18em] text-cover hover:text-gilt transition-colors">
            GUERIDON
          </Link>
          <div className="flex items-baseline gap-6 font-mono text-[0.65rem] tracking-[0.25em] uppercase">
            <span className="text-ink-soft hidden sm:inline">{t.analyzer.title}</span>
            <Link href={`/${other}/analyze`} className="text-ink-soft hover:text-cover transition-colors">
              {locale === "en" ? "EN · es" : "en · ES"}
            </Link>
          </div>
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <div className="no-print max-w-2xl">
          <p className="eyebrow text-gilt">II</p>
          <h1 className="display text-4xl sm:text-5xl mt-3 text-cover">{t.analyzer.title}</h1>
          <p className="italic text-xl text-ink-soft mt-4">{t.analyzer.lede}</p>
        </div>
        <AnalyzerApp locale={locale} />
      </div>
    </main>
  );
}
