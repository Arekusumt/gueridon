import type { Metadata } from "next";
import { EB_Garamond, IBM_Plex_Mono, Marcellus } from "next/font/google";
import { notFound } from "next/navigation";
import { isLocale, LOCALES } from "@/lib/i18n";
import "../globals.css";

const marcellus = Marcellus({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-marcellus",
  display: "swap",
});
// Only the display face is preloaded: it renders the LCP hero. Body and mono
// swap in a beat later over metric-compatible fallbacks (no CLS, faster LCP).
const garamond = EB_Garamond({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-garamond",
  display: "swap",
  preload: false,
});
const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
  display: "swap",
  preload: false,
});

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: "Gueridon — the science of the menu",
  description:
    "Menu engineering, explained with verified research and applied by an analyzer that shows its reasoning: the matrix, price architecture, copy and compliance.",
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html
      lang={locale}
      className={`${marcellus.variable} ${garamond.variable} ${plexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
