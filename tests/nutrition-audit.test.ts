// Audits every food in the seed database and every line of the default meal plan.
import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { seedState } from '../src/lib/seed';
import { foodNutrients, mealNutrients, sum, itemNutrients, dayTotals, buildDayFromPlan } from '../src/lib/nutrition';
import { toServings } from '../src/lib/units';

const s = seedState();
const atwater = (p: number, c: number, f: number) => 4 * p + 4 * c + 9 * f;

describe('food database audit', () => {
  it.each(s.foods.map((f) => [f.id, f] as const))('%s has a source, a verification status and self-consistent macros', (_id, f) => {
    expect(f.sourceName.length).toBeGreaterThan(5);
    expect(f.sourceUrl).toMatch(/^https:\/\//);
    expect(['label', 'retailer-label', 'database', 'estimate', 'user']).toContain(f.verification);
    expect(f.servingSize).toBeGreaterThan(0);
    const n = f.nutrients;
    // Calories should agree with 4/4/9 kcal per gram of protein/carbs/fat within 12% (labels round, fiber counts less).
    const est = atwater(n.protein, n.carbs, n.fat);
    expect(Math.abs(est - n.calories) / n.calories).toBeLessThan(0.12);
    if (f.verification === 'label' || f.verification === 'retailer-label') expect(f.sourceUrl).not.toContain('fdc.nal.usda.gov');
  });
});

// Hand-checked expected values for the default plan (label/USDA values × amount).
const EXPECTED: Record<string, { kcal: number; p: number; c: number; f: number }> = {
  'eggs-eb': { kcal: 120, p: 12, c: 0, f: 8 },               // 2 × (60, 6, 0, 4)
  'bagel-dkb': { kcal: 260, p: 11, c: 48, f: 3 },            // 1 bagel
  'cream-cheese': { kcal: 99, p: 1.7, c: 1.2, f: 9.9 },      // 2 tbsp = 1 serving
  honey: { kcal: 42, p: 0, c: 11.6, f: 0 },                  // 2 tsp × (21, 0, 5.8, 0)
  'oj-simply': { kcal: 165, p: 3, c: 39, f: 0 },             // 12 fl oz = 1.5 × 8 fl oz
  'gainer-milkchoc': { kcal: 740, p: 53, c: 109, f: 12 },    // 1 serving
  'milk-fairlife': { kcal: 300, p: 26, c: 12, f: 16 },       // 16 fl oz = 2 × 8 fl oz
  'beef-8020-cooked': { kcal: 462.7, p: 44.06, c: 0, f: 30.45 }, // 6 oz = 170.1 g × per-100 g
  'rice-jasmine-cooked': { kcal: 307.5, p: 6.45, c: 66.75, f: 0.6 }, // 1.5 cups
  'olive-oil': { kcal: 178.5, p: 0, c: 0, f: 20.25 },        // 1.5 tbsp
  'chobani-30g': { kcal: 220, p: 30, c: 17, f: 4 },          // 1 bottle
  pretzels: { kcal: 216, p: 5.8, c: 45.2, f: 1.6 },          // 2 oz
  'apple-juice': { kcal: 171, p: 0.3, c: 42, f: 0.45 },      // 12 fl oz = 1.5 × 8
  'pineapple-juice': { kcal: 199.5, p: 1.35, c: 48.3, f: 0.45 },
};

describe('default meal plan calculations', () => {
  it('every planned food converts its unit to label servings', () => {
    for (const m of s.meals) for (const i of m.items) {
      const f = s.foods.find((x) => x.id === i.foodId)!;
      expect(toServings(f, i.qty, i.unit), `${m.name}: ${f.name}`).not.toBeNull();
    }
  });

  it('each line matches the hand-checked value', () => {
    for (const m of s.meals) for (const i of m.items) {
      const e = EXPECTED[i.foodId];
      const n = itemNutrients(s, i);
      expect(n.calories, i.foodId).toBeCloseTo(e.kcal, 0);
      expect(n.protein, i.foodId).toBeCloseTo(e.p, 1);
      expect(n.carbs, i.foodId).toBeCloseTo(e.c, 1);
      expect(n.fat, i.foodId).toBeCloseTo(e.f, 1);
    }
  });

  it('meal and day totals are exact sums of their lines', () => {
    let dayKcal = 0;
    for (const m of s.meals) {
      const total = mealNutrients(s, m.id);
      const lines = sum(m.items.map((i) => itemNutrients(s, i)));
      expect(total.calories).toBeCloseTo(lines.calories, 6);
      dayKcal += total.calories;
    }
    const day = buildDayFromPlan(s, '2026-11-02');
    expect(dayTotals(day, s.goals).planned.calories).toBeCloseTo(dayKcal, 6);
    expect(Math.round(dayKcal)).toBe(3481);
  });

  it('writes the audit table when AUDIT_OUT is set', () => {
    const out = process.env.AUDIT_OUT;
    if (!out) return;
    const rows = s.foods.map((f) => {
      const n = f.nutrients;
      const est = atwater(n.protein, n.carbs, n.fat);
      const flavor = f.flavor ? ` (${f.flavor})` : '';
      return `| ${f.brand} ${f.name}${flavor} | ${f.servingSize} ${f.servingUnit}${f.gramsPerServing ? ` (${f.gramsPerServing} g)` : ''}${f.mlPerServing ? ` (${f.mlPerServing} ml)` : ''} | ${n.calories} | ${n.protein} | ${n.carbs} | ${n.fat} | ${Math.round(est)} | ${f.verification} | [source](${f.sourceUrl}) |`;
    });
    const plan = s.meals.flatMap((m) => m.items.map((i) => {
      const f = s.foods.find((x) => x.id === i.foodId)!;
      const n = foodNutrients(f, i.qty, i.unit)!;
      return `| ${m.name} | ${f.name} | ${i.qty} ${i.unit} | ${Math.round(n.calories)} | ${n.protein.toFixed(1)} | ${n.carbs.toFixed(1)} | ${n.fat.toFixed(1)} | ${f.verification} |`;
    }));
    const md = [
      '# Nutrition audit', '',
      '| Food | Serving | kcal | P g | C g | F g | 4/4/9 check | Status | Source |', '|---|---|---|---|---|---|---|---|---|', ...rows, '',
      '## Default plan, line by line', '',
      '| Meal | Food | Amount | kcal | P | C | F | Status |', '|---|---|---|---|---|---|---|---|', ...plan, '',
    ].join('\n');
    writeFileSync(out, md);
  });
});
