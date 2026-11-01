import type { AppState, DayItem, DayLog, DayMeal, DayPlan, Food, MealItem, Nutrients, Unit } from './types';
import { toServings } from './units';
import { weekday } from './date';

export const ZERO: Nutrients = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 };

export function scale(nu: Nutrients, k: number): Nutrients {
  return {
    calories: nu.calories * k, protein: nu.protein * k, carbs: nu.carbs * k, fat: nu.fat * k, fiber: nu.fiber * k,
    sugar: nu.sugar == null ? null : nu.sugar * k,
  };
}

export function add(a: Nutrients, b: Nutrients): Nutrients {
  return {
    calories: a.calories + b.calories, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber, sugar: a.sugar == null || b.sugar == null ? (a.sugar ?? b.sugar) : a.sugar + b.sugar,
  };
}

export function sum(list: Nutrients[]): Nutrients { return list.reduce(add, { ...ZERO }); }

/** Nutrition for `qty unit` of a food, computed from the per-serving label values. Null if the unit cannot be converted. */
export function foodNutrients(food: Food, qty: number, unit: Unit): Nutrients | null {
  const s = toServings(food, qty, unit);
  if (s == null || !isFinite(s)) return null;
  return scale(food.nutrients, s);
}

export function foodLabel(f: Food): string {
  return f.flavor ? `${f.name} · ${f.flavor}` : f.name;
}

export function findFood(state: Pick<AppState, 'foods'>, id: string): Food | undefined {
  return state.foods.find((f) => f.id === id);
}

export function itemNutrients(state: Pick<AppState, 'foods'>, item: MealItem): Nutrients {
  const f = findFood(state, item.foodId);
  if (!f) return { ...ZERO };
  return foodNutrients(f, item.qty, item.unit) ?? { ...ZERO };
}

export function mealNutrients(state: Pick<AppState, 'foods' | 'meals'>, mealId: string): Nutrients {
  const m = state.meals.find((x) => x.id === mealId);
  if (!m) return { ...ZERO };
  return sum(m.items.map((i) => itemNutrients(state, i)));
}

export function planForDate(state: Pick<AppState, 'plans' | 'schedule'>, date: string): DayPlan | undefined {
  const id = state.schedule.overrides[date] ?? state.schedule.weekdays[weekday(date)];
  return state.plans.find((p) => p.id === id);
}

let uid = 0;
export function newId(prefix = 'id'): string {
  uid = (uid + 1) % 1e6;
  return `${prefix}-${Date.now().toString(36)}-${uid.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function makeDayItem(state: Pick<AppState, 'foods'>, item: { foodId: string; qty: number; unit: Unit; alternatives?: string[] }, id?: string): DayItem {
  const f = findFood(state, item.foodId);
  return {
    id: id ?? newId('di'), foodId: item.foodId, name: f ? foodLabel(f) : 'Unknown food', brand: f?.brand ?? '',
    qty: item.qty, unit: item.unit, alternatives: item.alternatives,
    n: f ? (foodNutrients(f, item.qty, item.unit) ?? { ...ZERO }) : { ...ZERO },
    verification: f?.verification ?? 'user', consumed: false,
  };
}

/** A signature of everything in the plan for a date that affects the generated day. */
export function planSignature(state: Pick<AppState, 'plans' | 'schedule' | 'meals' | 'foods'>, date: string): string {
  const plan = planForDate(state, date);
  if (!plan) return 'none';
  return JSON.stringify(plan.slots.map((s) => {
    const m = state.meals.find((x) => x.id === s.mealId);
    return [s.mealId, s.time, m?.name, m?.items.map((i) => {
      const f = findFood(state, i.foodId);
      return [i.foodId, i.qty, i.unit, f?.nutrients, f?.servingSize, f?.servingUnit];
    })];
  }));
}

/** Build a fresh day from the plan scheduled for that date. */
export function buildDayFromPlan(state: AppState, date: string): DayLog {
  const plan = planForDate(state, date);
  const meals: DayMeal[] = (plan?.slots ?? []).flatMap((slot) => {
    const m = state.meals.find((x) => x.id === slot.mealId);
    if (!m) return [];
    return [{
      // deterministic ids so an un-saved (generated) day and its saved copy agree
      id: `${date}:${slot.id}`, mealId: m.id, name: m.name, emoji: m.emoji, time: slot.time,
      items: m.items.map((i) => makeDayItem(state, i, `${date}:${slot.id}:${i.id}`)),
    }];
  });
  return { date, planId: plan?.id, planSig: planSignature(state, date), meals, supplements: {} };
}

/** The day as stored, or as it would be generated from the plan (not persisted until touched). */
export function getDay(state: AppState, date: string): DayLog {
  return state.days[date] ?? buildDayFromPlan(state, date);
}

export interface DayTotals { planned: Nutrients; consumed: Nutrients; remaining: Nutrients }

export function dayTotals(day: DayLog, goals: { calories: number; protein: number; carbs: number; fat: number }): DayTotals {
  const all = day.meals.flatMap((m) => m.items);
  const planned = sum(all.map((i) => i.n));
  const consumed = sum(all.filter((i) => i.consumed).map((i) => i.n));
  const remaining: Nutrients = {
    calories: goals.calories - consumed.calories, protein: goals.protein - consumed.protein,
    carbs: goals.carbs - consumed.carbs, fat: goals.fat - consumed.fat, fiber: 0, sugar: null,
  };
  return { planned, consumed, remaining };
}

export function mealTotals(meal: DayMeal): { planned: Nutrients; consumed: Nutrients } {
  return { planned: sum(meal.items.map((i) => i.n)), consumed: sum(meal.items.filter((i) => i.consumed).map((i) => i.n)) };
}

export const r0 = (x: number) => Math.round(x);
export const r1 = (x: number) => Math.round(x * 10) / 10;
