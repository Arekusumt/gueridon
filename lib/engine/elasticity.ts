/**
 * What-if price simulator — constant-elasticity demand model.
 *
 *   Q1 = Q0 · (P1 / P0)^(−e)
 *
 * The defaults below are directional industry heuristics, NOT estimates from
 * the restaurant's own data; the UI exposes elasticity as a slider and labels
 * every output as a scenario, never a forecast.
 */

import { round2 } from "./utils";

export const DEFAULT_ELASTICITY: Record<string, number> = {
  drinks: 0.8, // habitual purchases, relatively insensitive
  mains: 1.1,
  starters: 1.2,
  desserts: 1.3, // impulse purchases, most sensitive
  default: 1.0,
};

export interface SimulationInput {
  price: number;
  newPrice: number;
  unitsSold: number;
  /** Food cost per unit; 0 when unknown (then margin equals revenue). */
  cost?: number;
  elasticity: number;
}

export interface SimulationResult {
  units0: number;
  units1: number;
  revenue0: number;
  revenue1: number;
  margin0: number;
  margin1: number;
  revenueDeltaPct: number;
  marginDeltaPct: number;
}

export function simulatePriceChange(input: SimulationInput): SimulationResult {
  const { price, newPrice, unitsSold, elasticity } = input;
  if (price <= 0 || newPrice <= 0 || unitsSold < 0 || elasticity < 0) {
    throw new RangeError("simulatePriceChange: inputs must be positive");
  }
  const cost = input.cost ?? 0;

  const units1 = unitsSold * Math.pow(newPrice / price, -elasticity);
  const revenue0 = price * unitsSold;
  const revenue1 = newPrice * units1;
  const margin0 = (price - cost) * unitsSold;
  const margin1 = (newPrice - cost) * units1;

  return {
    units0: unitsSold,
    units1: round2(units1),
    revenue0: round2(revenue0),
    revenue1: round2(revenue1),
    margin0: round2(margin0),
    margin1: round2(margin1),
    revenueDeltaPct: revenue0 > 0 ? round2(((revenue1 - revenue0) / revenue0) * 100) : 0,
    marginDeltaPct: margin0 > 0 ? round2(((margin1 - margin0) / margin0) * 100) : 0,
  };
}
