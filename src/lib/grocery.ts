import type { AppState, Food, GroceryCategory, Unit } from './types';
import { getDay } from './nutrition';
import { convert, toServings } from './units';
import { range } from './date';
import { supplementDueOn } from './supplements';

export interface GroceryLine {
  key: string; // foodId or sup:<id>
  name: string;
  brand: string;
  category: GroceryCategory;
  required: { qty: number; unit: Unit | string }[]; // amounts as eaten (per unit)
  needQty: number; // in purchase unit
  needUnit: Unit | string;
  conversionLabel?: string;
  onHand: number;
  toBuy: number;
  packages: number;
  packageLabel?: string;
  packageSize?: number;
  cost?: number;
  usedIn: string[];
  estimate: boolean;
}

/** Amount of `food` eaten as `qty unit`, expressed in the food's purchase unit. */
export function toPurchaseUnits(food: Food, qty: number, unit: Unit): number | null {
  const p = food.purchase;
  if (!p) return null;
  if (p.conversion) {
    let base = convert(qty, unit, p.conversion.fromUnit);
    if (base == null) {
      // go through label servings
      const s = toServings(food, qty, unit);
      if (s == null) return null;
      base = convert(s * food.servingSize, food.servingUnit, p.conversion.fromUnit);
      if (base == null) return null;
    }
    return base * p.conversion.factor;
  }
  const direct = convert(qty, unit, p.unit);
  if (direct != null) return direct;
  const s = toServings(food, qty, unit);
  if (s == null) return null;
  if (p.unit === 'serving') return s;
  return convert(s * food.servingSize, food.servingUnit, p.unit);
}

export function generateGroceries(state: AppState, start: string, days: number): GroceryLine[] {
  const lines = new Map<string, GroceryLine>();
  const dates = range(start, days);
  for (const date of dates) {
    const day = getDay(state, date);
    for (const meal of day.meals) {
      for (const item of meal.items) {
        const food = state.foods.find((f) => f.id === item.foodId);
        if (!food) continue;
        let line = lines.get(food.id);
        if (!line) {
          line = {
            key: food.id, name: food.flavor ? `${food.name} (${food.flavor})` : food.name, brand: food.brand, category: food.category,
            required: [], needQty: 0, needUnit: food.purchase?.unit ?? item.unit,
            conversionLabel: food.purchase?.conversion?.label, onHand: 0, toBuy: 0, packages: 0,
            packageLabel: food.purchase?.packageLabel, packageSize: food.purchase?.packageSize, usedIn: [],
            estimate: !!food.purchase?.conversion,
          };
          lines.set(food.id, line);
        }
        const req = line.required.find((r) => r.unit === item.unit);
        if (req) req.qty += item.qty; else line.required.push({ qty: item.qty, unit: item.unit });
        const pu = toPurchaseUnits(food, item.qty, item.unit);
        if (pu != null) line.needQty += pu;
        else if (!food.purchase) { line.needUnit = item.unit; line.needQty += item.qty; }
        if (!line.usedIn.includes(meal.name)) line.usedIn.push(meal.name);
      }
    }
  }
  // supplements that are scheduled during the period
  for (const s of state.supplements) {
    if (!s.active) continue;
    const count = dates.filter((d) => supplementDueOn(state, s, d)).length;
    if (!count) continue;
    lines.set('sup:' + s.id, {
      key: 'sup:' + s.id, name: s.name, brand: s.brand, category: 'Supplements',
      required: [{ qty: count, unit: 'serving' }], needQty: count, needUnit: 'serving', onHand: 0, toBuy: 0, packages: 0,
      packageLabel: s.servingsPerContainer ? `container (${s.servingsPerContainer} servings)` : undefined,
      packageSize: s.servingsPerContainer, usedIn: ['Supplements'], estimate: false,
    });
  }
  for (const line of lines.values()) {
    line.onHand = state.pantry[line.key] ?? 0;
    line.toBuy = Math.max(0, line.needQty - line.onHand);
    line.packages = line.packageSize ? Math.ceil(line.toBuy / line.packageSize - 1e-9) : 0;
    const food = state.foods.find((f) => f.id === line.key);
    if (food?.purchase?.pricePerPackage != null && line.packageSize) line.cost = line.packages * food.purchase.pricePerPackage;
  }
  const order: GroceryCategory[] = ['Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery', 'Pantry', 'Snacks', 'Beverages', 'Supplements', 'Other'];
  return [...lines.values()].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.name.localeCompare(b.name));
}

export function groceryText(lines: GroceryLine[], checked: Record<string, boolean>, fmt: (n: number) => string): string {
  const out: string[] = [];
  let cat = '';
  for (const l of lines) {
    if (l.toBuy <= 0) continue;
    if (l.category !== cat) { cat = l.category; out.push('', cat.toUpperCase()); }
    const pkg = l.packages && l.packageLabel ? ` → ${l.packages} × ${l.packageLabel}` : '';
    out.push(`${checked[l.key] ? '☑' : '☐'} ${l.brand !== 'Generic' ? l.brand + ' ' : ''}${l.name}: ${fmt(l.toBuy)} ${l.needUnit}${pkg}`);
  }
  return out.join('\n').trim();
}
