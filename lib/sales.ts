/**
 * Sales-data CSV: the bridge between the restaurateur's books (a POS export,
 * a spreadsheet) and the engine's measured mode. Pure and client-safe — the
 * browser parses the file, the user picks the season, and the aggregated
 * numbers travel as maps keyed by dish-name slug; normalizeStage matches
 * them to menu items server-side with the same slug.
 *
 * Accepted shape (headers in EN or ES, order free, extra columns ignored):
 *   dish/plato, units/unidades, cost/coste, period/periodo|temporada
 * Headerless files are read positionally: dish, units[, cost[, period]].
 */

export interface SalesRow {
  dish: string;
  units: number | null;
  cost: number | null;
  period: string | null;
}

export interface SalesFile {
  rows: SalesRow[];
  /** Distinct period labels in file order. Empty = no period column. */
  periods: string[];
}

/** Same normalization the pipeline uses for item ids — one slug, both sides. */
export function slugifyName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const HEADERS = {
  dish: /^(plat|dish|item|art[ií]c|product[oe]|nombre|nom$|name|concepto)/i,
  units:
    /^(unidades|unitats|units?\b|uds?\b|ventas?|vendidos?|venuts?|sold|sales|qty|quantit|cantidad|pedidos|orders|raciones)/i,
  cost: /^(coste?s?\b|costo|cost\b|food.?cost|escandallo)/i,
  period:
    /^(per[ií]od|temporada|season|mes$|month|fecha|date|trimestre|quarter|semana|week|a[ñn]o|any$|year)/i,
};

/** Minimal quote-aware CSV field splitter ("" escapes a quote). */
function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === sep && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** "4,20", "€ 4.20", "1.250,50" → number. Single , or . reads as decimal. */
function parseNum(raw: string): number | null {
  let s = raw.replace(/[€\s]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    // Both present: the later one is the decimal mark, the other thousands.
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma !== -1) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function countSep(line: string, sep: string): number {
  let n = 0;
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === sep && !quoted) n++;
  }
  return n;
}

export function parseSalesCsv(text: string): SalesFile {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { rows: [], periods: [] };

  const sep = [";", "\t", ","].reduce((a, b) =>
    countSep(lines[0], b) > countSep(lines[0], a) ? b : a,
  );
  const first = splitLine(lines[0], sep);
  const mapped = {
    dish: first.findIndex((c) => HEADERS.dish.test(c)),
    units: first.findIndex((c) => HEADERS.units.test(c)),
    cost: first.findIndex((c) => HEADERS.cost.test(c)),
    period: first.findIndex((c) => HEADERS.period.test(c)),
  };

  let cols = mapped;
  let startAt = 1;
  if (mapped.dish === -1 || (mapped.units === -1 && mapped.cost === -1)) {
    // No recognisable header → positional; keep row 1 if it already holds data.
    cols = { dish: 0, units: 1, cost: 2, period: 3 };
    startAt = parseNum(first[1] ?? "") != null ? 0 : 1;
  }

  const rows: SalesRow[] = [];
  const periods: string[] = [];
  for (const line of lines.slice(startAt)) {
    const cells = splitLine(line, sep);
    const dish = cells[cols.dish] ?? "";
    if (!slugifyName(dish)) continue;
    const units = cols.units === -1 ? null : parseNum(cells[cols.units] ?? "");
    const cost = cols.cost === -1 ? null : parseNum(cells[cols.cost] ?? "");
    if (units == null && cost == null) continue;
    const period = cols.period === -1 ? null : cells[cols.period]?.trim() || null;
    if (period && !periods.includes(period)) periods.push(period);
    rows.push({ dish, units, cost, period });
  }
  return { rows, periods };
}

/**
 * Collapse rows into per-dish maps for the analyze request. `selectedPeriods`
 * null/undefined = every row; otherwise only rows whose period is selected
 * (rows without a period always count). Units sum across rows; cost is the
 * units-weighted mean (plain mean when a row has no units).
 */
export function aggregateSales(
  rows: SalesRow[],
  selectedPeriods?: ReadonlySet<string> | null,
): { sales: Record<string, number>; costs: Record<string, number>; dishes: number } {
  type Acc = {
    units: number;
    hasUnits: boolean;
    costTimesUnits: number;
    unitsWithCost: number;
    costSum: number;
    costN: number;
  };
  const acc = new Map<string, Acc>();
  for (const r of rows) {
    if (selectedPeriods && r.period && !selectedPeriods.has(r.period)) continue;
    const key = slugifyName(r.dish);
    const a =
      acc.get(key) ??
      { units: 0, hasUnits: false, costTimesUnits: 0, unitsWithCost: 0, costSum: 0, costN: 0 };
    if (r.units != null) {
      a.units += r.units;
      a.hasUnits = true;
    }
    if (r.cost != null) {
      if (r.units != null && r.units > 0) {
        a.costTimesUnits += r.cost * r.units;
        a.unitsWithCost += r.units;
      } else {
        a.costSum += r.cost;
        a.costN++;
      }
    }
    acc.set(key, a);
  }

  const sales: Record<string, number> = {};
  const costs: Record<string, number> = {};
  for (const [key, a] of acc) {
    if (a.hasUnits) sales[key] = Math.round(a.units * 100) / 100;
    const cost =
      a.unitsWithCost > 0
        ? a.costTimesUnits / a.unitsWithCost
        : a.costN > 0
          ? a.costSum / a.costN
          : null;
    if (cost != null && cost > 0) costs[key] = Math.round(cost * 100) / 100;
  }
  return { sales, costs, dishes: acc.size };
}
