import editorialJson from "@/content/editorial.json";
import bibliographyJson from "@/content/research/bibliography.json";
import type { Locale } from "./i18n";

export interface Localized {
  en: string;
  es: string;
}

export type Block =
  | { type: "p"; en: string; es: string; cites?: string[] }
  | { type: "menuline"; label: Localized; value: string; cite?: string }
  | { type: "pull"; en: string; es: string };

export interface EditorialSection {
  id: string;
  course: Localized;
  title: Localized;
  lede: Localized;
  blocks: Block[];
}

export interface BibliographyEntry {
  id: string;
  authors: string;
  year: number | string;
  title: string;
  publication: string;
  finding: string;
  citable_stat: string | null;
  confidence: "verified" | "secondary";
  url: string;
  topic: string;
}

export const EDITORIAL = (editorialJson as { sections: EditorialSection[] }).sections;
export const BIBLIOGRAPHY = bibliographyJson as BibliographyEntry[];

const BIB_INDEX = new Map(BIBLIOGRAPHY.map((b) => [b.id, b]));

export function bib(id: string): BibliographyEntry | undefined {
  return BIB_INDEX.get(id);
}

/** 1-based citation number in bibliography order, for superscript markers. */
export function citeNumber(id: string): number | null {
  const i = BIBLIOGRAPHY.findIndex((b) => b.id === id);
  return i === -1 ? null : i + 1;
}

export function pick(l: Localized | { en: string; es: string }, locale: Locale): string {
  return locale === "es" ? l.es : l.en;
}
