import type { Food, Unit } from './types';

export const MASS: Partial<Record<Unit, number>> = { g: 1, oz: 28.349523, lb: 453.59237 };
export const VOLUME: Partial<Record<Unit, number>> = {
  ml: 1, tsp: 4.928922, tbsp: 14.786765, 'fl oz': 29.573530, cup: 236.588237,
};
export const COUNT_UNITS: Unit[] = ['each', 'serving', 'scoop', 'bottle', 'slice'];
export const ALL_UNITS: Unit[] = ['each', 'serving', 'scoop', 'bottle', 'slice', 'g', 'oz', 'lb', 'ml', 'fl oz', 'cup', 'tbsp', 'tsp'];

export function dimension(u: Unit): 'mass' | 'volume' | 'count' {
  if (u in MASS) return 'mass';
  if (u in VOLUME) return 'volume';
  return 'count';
}

/** Convert a quantity within the same dimension. Returns null if not convertible. */
export function convert(qty: number, from: Unit, to: Unit): number | null {
  if (from === to) return qty;
  const df = dimension(from), dt = dimension(to);
  if (df !== dt) return null;
  if (df === 'mass') return (qty * MASS[from]!) / MASS[to]!;
  if (df === 'volume') return (qty * VOLUME[from]!) / VOLUME[to]!;
  return null; // count units only equal themselves
}

/**
 * How many label servings is `qty unit` of this food?
 * Handles same-dimension conversion, 'serving' as 1 label serving, and mass<->volume via
 * gramsPerServing / mlPerServing when the label provides them.
 */
export function toServings(food: Food, qty: number, unit: Unit): number | null {
  if (unit === 'serving') return qty;
  const direct = convert(qty, unit, food.servingUnit);
  if (direct != null) return direct / food.servingSize;
  const d = dimension(unit);
  if (d === 'mass' && food.gramsPerServing) return (convert(qty, unit, 'g')!) / food.gramsPerServing;
  if (d === 'volume' && food.mlPerServing) return (convert(qty, unit, 'ml')!) / food.mlPerServing;
  return null;
}

/** Units a food can be measured in given its label data. */
export function unitsFor(food: Food): Unit[] {
  const out = new Set<Unit>([food.servingUnit, 'serving']);
  const d = dimension(food.servingUnit);
  const add = (dim: 'mass' | 'volume') =>
    (dim === 'mass' ? ['g', 'oz', 'lb'] : ['ml', 'fl oz', 'cup', 'tbsp', 'tsp']).forEach((u) => out.add(u as Unit));
  if (d !== 'count') add(d);
  if (food.gramsPerServing) add('mass');
  if (food.mlPerServing) add('volume');
  return [...out];
}

export function fmtQty(n: number): string {
  if (!isFinite(n)) return '–';
  const r = Math.round(n * 100) / 100;
  // pretty fractions for common cooking amounts
  const whole = Math.floor(r);
  const frac = Math.round((r - whole) * 100) / 100;
  const map: Record<string, string> = { '0.25': '¼', '0.5': '½', '0.75': '¾', '0.33': '⅓', '0.67': '⅔' };
  if (frac === 0) return String(whole);
  if (map[String(frac)]) return (whole ? whole : '') + map[String(frac)];
  return String(r);
}

export function plural(unit: Unit, qty: number): string {
  if (unit === 'each') return '';
  if (qty === 1) return unit;
  if (unit === 'serving' || unit === 'scoop' || unit === 'bottle' || unit === 'slice' || unit === 'cup') return unit + 's';
  return unit;
}

export function fmtAmount(qty: number, unit: Unit): string {
  const p = plural(unit, qty);
  return p ? `${fmtQty(qty)} ${p}` : fmtQty(qty);
}

export const KM_PER_MI = 1.609344;
export function kmTo(unit: 'mi' | 'km', km: number) { return unit === 'km' ? km : km / KM_PER_MI; }
export function toKm(unit: 'mi' | 'km', v: number) { return unit === 'km' ? v : v * KM_PER_MI; }
