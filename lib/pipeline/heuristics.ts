/**
 * Deterministic priors used when the restaurateur gives us no cost/sales data.
 *
 * Directional hospitality rules of thumb (typical food-cost shares by dish
 * family, popularity priors with a menu-position decay), NOT measurements.
 * Every number derived from them is flagged `estimated` end to end. In live
 * mode the LLM refines these within schema bounds; in fixture/demo mode they
 * are used as-is.
 */

const COST_SHARE_RULES: Array<[RegExp, number]> = [
  [/steak|solomillo|entrec|ribeye|t-?bone|chulet|fillet|sirloin/i, 0.42],
  [/salmon|lubina|dorada|cod\b|hake|merluza|seafood|marisco|prawn|gamba|lobster|bogavante|fish/i, 0.38],
  [/wine|vino|cava|champagne|rioja/i, 0.35],
  [/burger|hamburgues/i, 0.32],
  [/breakfast|desayuno|brunch|eggs|huevos/i, 0.3],
  [/beer|cerveza|pint|caña|draught|lager|stout|ale\b|cider|sidra/i, 0.28],
  [/salad|ensalada/i, 0.28],
  [/dessert|postre|cake|tarta|ice\s?cream|helado|brownie|pancake|crepe|milkshake/i, 0.25],
  [/pizza/i, 0.25],
  [/pasta|spaghetti|espagueti|carbonara|lasagn|lasañ|macarr|penne/i, 0.22],
  [/cocktail|c[oó]ctel|gin|vodka|rum|ron\b|whisk|tequila|shot|bomb|liquor|licor|brandy|spritz/i, 0.18],
  [/coffee|caf[eé]|espresso|cappuccino|latte|tea\b|infusi/i, 0.15],
  [/soft|refresco|soda|cola|fanta|sprite|juice|zumo|water|agua|tonic/i, 0.15],
];

const DRINK_CATEGORY = /drink|bebida|bar\b|coffee|caf[eé]|beer|cerveza|wine|vino|cocktail|spirit|shot|bomb|milkshake|draught|bottle/i;

export function costShareFor(name: string, category: string): number {
  const hay = `${name} ${category}`;
  for (const [re, share] of COST_SHARE_RULES) {
    if (re.test(hay)) return share;
  }
  return DRINK_CATEGORY.test(category) ? 0.22 : 0.3;
}

const POPULAR = /burger|hamburgues|margherita|pepperoni|carbonara|bravas|fish\s*&?\s*chips|nachos|guinness|lager|estrella|coca|cola|caf[eé] con leche|espresso|cheesecake|brownie|mojito|gin\s*tonic|sangria|sangría|croquetas|calamares/i;
const NICHE = /tripe|callos|snail|caracol|oyster|ostra|liver|hígado|higado|kidney|tofu|vegan\s|sin gluten|decaf|descafeinado|amaretto|vermouth|vermut|sherry|jerez|grappa|absinthe/i;

/**
 * Popularity prior in 0..1, only meaningful relative to the same category.
 * Base by name, then a mild decay by menu position (earlier items sell more —
 * position effects are real but modest; see bibliography: scanning research).
 */
export function popularityFor(name: string, indexInCategory: number, categorySize: number): number {
  const base = POPULAR.test(name) ? 0.8 : NICHE.test(name) ? 0.25 : 0.5;
  if (categorySize <= 1) return base;
  const decay = 0.2 * (indexInCategory / (categorySize - 1));
  return Math.max(0.05, base * (1 - decay));
}
