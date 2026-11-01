import type { AppState, Unit } from './types';
import { addDays, weekday } from './date';
import { getDay } from './nutrition';
import { toPurchaseUnits } from './grocery';

export interface PrepBatch {
  date: string;
  coversDays: string[];
  items: { foodId: string; name: string; cookedQty: number; unit: Unit; buyQty: number | null; buyUnit?: string; buyLabel?: string; buyAs?: string; perDay: number }[];
  portions: number;
}

/** Next prep date on or after `from`. */
export function nextPrepDate(state: AppState, from: string): string | null {
  const days = state.prefs.prepDays;
  if (!days.length) return null;
  for (let i = 0; i < 7; i++) {
    const d = addDays(from, i);
    if (days.includes(weekday(d))) return d;
  }
  return null;
}

/** The days a prep session on `date` covers: until the day before the next prep day. */
export function coverage(state: AppState, date: string): string[] {
  const out = [date];
  for (let i = 1; i < 7; i++) {
    const d = addDays(date, i);
    if (state.prefs.prepDays.includes(weekday(d))) break;
    out.push(d);
  }
  return out;
}

export function prepBatch(state: AppState, date: string): PrepBatch {
  const days = coverage(state, date);
  const agg = new Map<string, PrepBatch['items'][number]>();
  let portions = 0;
  for (const d of days) {
    const day = getDay(state, d);
    let dayHasPrep = false;
    for (const m of day.meals) for (const it of m.items) {
      const f = state.foods.find((x) => x.id === it.foodId);
      if (!f?.prepable) continue;
      dayHasPrep = true;
      const key = `${f.id}|${it.unit}`;
      const cur = agg.get(key) ?? { foodId: f.id, name: f.name, cookedQty: 0, unit: it.unit, buyQty: 0, buyUnit: f.purchase?.conversion ? f.purchase.unit : undefined, buyLabel: f.purchase?.conversion?.label, buyAs: f.purchase?.buyAs, perDay: it.qty };
      cur.cookedQty += it.qty;
      const b = toPurchaseUnits(f, it.qty, it.unit);
      cur.buyQty = cur.buyQty != null && b != null ? cur.buyQty + b : null;
      agg.set(key, cur);
    }
    if (dayHasPrep) portions++;
  }
  return { date, coversDays: days, items: [...agg.values()], portions };
}

export const PREP_STEPS: { id: string; text: string; match?: RegExp }[] = [
  { id: 'rice', match: /rice/i, text: 'Rinse rice until the water runs mostly clear, then cook the dry rice (rice cooker or stovetop).' },
  { id: 'beef', match: /beef/i, text: 'Brown the ground beef fully in a large pan, breaking it up. Cook to an internal 160°F (71°C).' },
  { id: 'drain', match: /beef/i, text: 'Drain excess fat if you like (it lowers cooked-weight fat; nutrition uses USDA pan-browned values).' },
  { id: 'weigh', text: 'Weigh each cooked food so portions are accurate.' },
  { id: 'portion', text: 'Portion into containers: one per day, using the per-day amounts below.' },
  { id: 'cool', text: 'Cool and refrigerate within 2 hours of cooking.' },
  { id: 'label', text: 'Label containers with the date. Freeze any portion you won\'t eat within 3–4 days.' },
];

export const STORAGE_TIPS = [
  'Refrigerate cooked beef and rice within 2 hours; eat refrigerated portions within 3–4 days (USDA FSIS leftovers guidance).',
  'Freeze portions for day 4+ and thaw overnight in the fridge.',
  'Reheat to 165°F (74°C) until steaming. Add the olive oil after reheating.',
  'Cooked rice should be cooled quickly (spread it out) before refrigerating.',
];

/** Checklist steps that apply to the foods actually in this batch (no beef steps if the plan has no beef). */
export function stepsFor(b: PrepBatch) {
  return PREP_STEPS.filter((s) => !s.match || b.items.some((i) => s.match!.test(i.name)));
}
