/**
 * Market benchmark loading + deterministic item→benchmark matching.
 * Dataset provenance lives inside each JSON (sources + disclaimer).
 */

import type { MarketBenchmark, MenuItem } from "@/lib/engine";
import barcelona from "@/data/market/barcelona.json";
import reus from "@/data/market/reus.json";
import salou from "@/data/market/salou-la-pineda.json";
import tarragona from "@/data/market/tarragona.json";

export interface MarketZone {
  zone: string;
  currency: string;
  as_of: string;
  disclaimer: string;
  categories: Array<{
    item: string;
    low: number;
    typical: number;
    high: number;
    source: string;
    source_url?: string;
    note?: string;
  }>;
  sources: Array<{ name: string; url: string }>;
}

export const MARKET_ZONES: Record<string, MarketZone> = {
  barcelona: barcelona as MarketZone,
  tarragona: tarragona as MarketZone,
  reus: reus as MarketZone,
  "salou-la-pineda": salou as MarketZone,
};

/** Stable keys for dataset categories, matched by label substring. */
const KEY_BY_LABEL: Array<[RegExp, string]> = [
  [/caña/i, "cana"],
  [/pinta|0,5/i, "pinta"],
  [/copa de vino/i, "vino"],
  [/gin-?tonic|cóctel/i, "cocktail"],
  [/refresco/i, "refresco"],
  [/café/i, "cafe"],
  [/menú del día/i, "menu-del-dia"],
  [/hamburguesa/i, "burger"],
  [/pizza/i, "pizza"],
  [/pasta/i, "pasta"],
  [/tapa/i, "tapa"],
  [/entrante/i, "starter"],
  [/carne/i, "meat-main"],
  [/pescado/i, "fish-main"],
  [/arroz|paella/i, "rice"],
  [/postre/i, "dessert"],
];

function keyForLabel(label: string): string | null {
  for (const [re, key] of KEY_BY_LABEL) if (re.test(label)) return key;
  return null;
}

export function zoneBenchmarks(zoneId: string): Map<string, MarketBenchmark> {
  const zone = MARKET_ZONES[zoneId];
  const out = new Map<string, MarketBenchmark>();
  if (!zone) return out;
  for (const c of zone.categories) {
    const key = keyForLabel(c.item);
    if (!key) continue;
    out.set(key, {
      itemKey: key,
      low: c.low,
      typical: c.typical,
      high: c.high,
      source: c.source,
    });
  }
  return out;
}

/** Deterministic menu-item → market-key matcher (EN/ES keywords). */
const ITEM_KEY_RULES: Array<[RegExp, string]> = [
  [/burger|hamburgues/i, "burger"],
  [/pizza/i, "pizza"],
  [/pasta|spaghetti|espagueti|carbonara|lasagn|lasañ|macarr|penne/i, "pasta"],
  [/paella|arroz|risotto/i, "rice"],
  [/menú del día|menu del dia/i, "menu-del-dia"],
  [/pint|0\.5l|half litre|jarra/i, "pinta"],
  [/caña|small beer/i, "cana"],
  [/beer|cerveza|lager|stout|ale\b|guinness|cider|sidra/i, "pinta"],
  [/gin|cocktail|c[oó]ctel|mojito|margarita|daiquiri|spritz|negroni/i, "cocktail"],
  [/wine|vino|rioja|cava/i, "vino"],
  [/coffee|caf[eé]|espresso|cappuccino|latte/i, "cafe"],
  [/soft|refresco|cola|fanta|sprite|juice|zumo|tonic|water|agua/i, "refresco"],
  [/dessert|postre|cake|tarta|helado|ice\s?cream|brownie|cheesecake/i, "dessert"],
  [/tapa|ración|racion|bravas|croquetas|nachos|wings|calamares/i, "tapa"],
  [/starter|entrante|appetizer|soup|sopa|salad|ensalada/i, "starter"],
  [/steak|solomillo|entrec|chulet|t-?bone|fillet|pork|cerdo|chicken|pollo|lamb|cordero|meat|carne|ribs|costillas/i, "meat-main"],
  [/fish|pescado|salmon|lubina|dorada|cod\b|hake|merluza|tuna|atún|atun|seafood|marisco/i, "fish-main"],
];

export function marketKeyFor(item: Pick<MenuItem, "name" | "category">): string | null {
  const hay = `${item.name} ${item.category}`;
  for (const [re, key] of ITEM_KEY_RULES) if (re.test(hay)) return key;
  return null;
}
