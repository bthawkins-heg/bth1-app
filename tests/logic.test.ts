import { describe, it, expect, beforeEach } from 'vitest';
import { seedState } from '../src/lib/seed';
import * as A from '../src/lib/actions';
import { dayTotals, getDay, foodNutrients, mealNutrients, planForDate } from '../src/lib/nutrition';
import { generateGroceries } from '../src/lib/grocery';
import { occurrencesInRange, occurrencesOn, personalRecords, lastWeight, exerciseHistory, paceSecPerUnit, sessionVolume } from '../src/lib/training';
import { rollingAverage, weeklyRate, calorieSuggestion } from '../src/lib/progress';
import { supplementDueOn, overlaps } from '../src/lib/supplements';
import { prepBatch, coverage } from '../src/lib/prep';
import { shardState, unshard } from '../src/lib/store';
import { migrate } from '../src/lib/migrate';
import { addDays } from '../src/lib/date';
import type { AppState } from '../src/lib/types';

const D = '2026-11-02'; // a Monday
let s: AppState;
beforeEach(() => { s = seedState(); s.profile.startDate = D; });

const meal = (st: AppState, name: string) => A.ensureDay(st, D).meals.find((m) => m.name === name)!;

describe('nutrition calculations', () => {
  it('computes each food from label values with unit conversion', () => {
    const f = s.foods.find((x) => x.id === 'milk-fairlife')!;
    expect(foodNutrients(f, 16, 'fl oz')!.calories).toBe(300);
    const beef = s.foods.find((x) => x.id === 'beef-8020-cooked')!;
    expect(foodNutrients(beef, 6, 'oz')!.calories).toBeCloseTo(462.7, 0);
    const oj = s.foods.find((x) => x.id === 'oj-simply')!;
    expect(foodNutrients(oj, 12, 'fl oz')!.calories).toBe(165);
    const cc = s.foods.find((x) => x.id === 'cream-cheese')!;
    expect(foodNutrients(cc, 29, 'g')!.calories).toBeCloseTo(99, 5); // mass->volume via grams per serving
  });

  it('meal totals are sums of foods, not hardcoded estimates', () => {
    const b = mealNutrients(s, 'm-breakfast');
    expect(b.calories).toBeCloseTo(120 + 260 + 99 + 42 + 165, 5);
    const dinner = mealNutrients(s, 'm-dinner');
    expect(dinner.calories).toBeGreaterThan(900);
  });

  it('planned vs consumed vs remaining are separate', () => {
    const t = dayTotals(getDay(s, D), s.goals);
    expect(t.consumed.calories).toBe(0);
    expect(t.planned.calories).toBeGreaterThan(3000);
    expect(t.remaining.calories).toBe(3400);
  });
});

describe('food logging', () => {
  it('logs an individual food', () => {
    const m = meal(s, 'Breakfast');
    A.setItemConsumed(s, D, m.id, m.items[0].id, true);
    expect(dayTotals(s.days[D], s.goals).consumed.calories).toBe(120);
  });

  it('logs a whole meal and prevents double counting', () => {
    const m = meal(s, 'Breakfast');
    A.setItemConsumed(s, D, m.id, m.items[0].id, true);
    A.setMealConsumed(s, D, m.id, true);
    A.setMealConsumed(s, D, m.id, true);
    A.setItemConsumed(s, D, m.id, m.items[0].id, true);
    const c = dayTotals(s.days[D], s.goals).consumed.calories;
    expect(c).toBeCloseTo(686, 5);
  });

  it('un-logging a meal removes it from totals', () => {
    const m = meal(s, 'Dinner');
    A.setMealConsumed(s, D, m.id, true);
    A.setMealConsumed(s, D, m.id, false);
    expect(dayTotals(s.days[D], s.goals).consumed.calories).toBe(0);
  });

  it('edits a portion and recalculates', () => {
    const m = meal(s, 'Dinner');
    const beef = m.items.find((i) => i.foodId === 'beef-8020-cooked')!;
    A.editPortion(s, D, m.id, beef.id, 8, 'oz');
    expect(s.days[D].meals.find((x) => x.id === m.id)!.items.find((i) => i.id === beef.id)!.n.calories).toBeCloseTo(617, 0);
  });

  it('swaps juice and keeps the amount', () => {
    const m = meal(s, 'Snacks & Drinks');
    const pine = m.items.find((i) => i.foodId === 'pineapple-juice')!;
    A.swapDayItem(s, D, m.id, pine.id, 'cranberry-cocktail');
    const now = s.days[D].meals.find((x) => x.id === m.id)!.items.find((i) => i.foodId === 'cranberry-cocktail')!;
    expect(now.qty).toBe(12);
    expect(now.unit).toBe('fl oz');
    expect(now.n.calories).toBeCloseTo(165, 5);
  });

  it('copies yesterday as an un-logged plan', () => {
    const y = addDays(D, -1);
    const ym = A.ensureDay(s, y).meals[0];
    A.setMealConsumed(s, y, ym.id, true);
    A.copyDay(s, y, D);
    expect(s.days[D].meals.length).toBe(4);
    expect(s.days[D].meals.flatMap((m) => m.items).every((i) => !i.consumed)).toBe(true);
  });

  it('history is frozen when a food or template changes', () => {
    const m = meal(s, 'Breakfast');
    A.setMealConsumed(s, D, m.id, true);
    const before = dayTotals(s.days[D], s.goals).consumed.calories;
    s.foods.find((f) => f.id === 'eggs-eb')!.nutrients.calories = 999;
    A.updateTemplateItem(s, 'm-breakfast', s.meals[0].items[0].id, { qty: 5 });
    expect(dayTotals(s.days[D], s.goals).consumed.calories).toBe(before);
    expect(A.dayIsStale(s, D)).toBe(true);
    A.resyncDay(s, D);
    // consumed items kept as logged
    expect(dayTotals(s.days[D], s.goals).consumed.calories).toBe(before);
  });

  it('adds a custom food', () => {
    s.foods.push({ ...s.foods[0], id: 'custom-banana', brand: 'Generic', name: 'Banana', verification: 'user', nutrients: { calories: 105, protein: 1.3, carbs: 27, fat: 0.4, fiber: 3.1, sugar: 14 } });
    const m = meal(s, 'Snacks & Drinks');
    A.addDayItem(s, D, m.id, 'custom-banana', 1, 'each', true);
    expect(dayTotals(s.days[D], s.goals).consumed.calories).toBe(105);
  });
});

describe('meal scheduling', () => {
  it('uses different plans for different days and date overrides', () => {
    const pid = A.addPlan(s, 'Training day', 'plan-standard');
    s.schedule.weekdays[2] = pid; // Tuesday
    expect(planForDate(s, addDays(D, 1))!.id).toBe(pid);
    expect(planForDate(s, D)!.id).toBe('plan-standard');
    s.schedule.overrides[D] = pid;
    expect(planForDate(s, D)!.id).toBe(pid);
  });

  it('reorders meals and sets optional times', () => {
    const first = meal(s, 'Breakfast');
    A.moveDayMeal(s, D, first.id, 1);
    expect(s.days[D].meals[1].name).toBe('Breakfast');
    A.setDayMealTime(s, D, first.id, '08:30');
    expect(s.days[D].meals[1].time).toBe('08:30');
    // seed has no fixed times
    expect(s.plans[0].slots.every((x) => !x.time)).toBe(true);
  });
});

describe('grocery list', () => {
  it('matches the 7-day requirements', () => {
    const g = generateGroceries(s, D, 7);
    const by = (k: string) => g.find((l) => l.key === k)!;
    expect(by('eggs-eb').needQty).toBe(14); expect(by('eggs-eb').packages).toBe(1);
    expect(by('bagel-dkb').needQty).toBe(7); expect(by('bagel-dkb').packages).toBe(2);
    expect(by('cream-cheese').needQty).toBeCloseTo(14);
    expect(by('honey').needQty).toBeCloseTo(14);
    expect(by('oj-simply').needQty).toBeCloseTo(84);
    expect(by('gainer-milkchoc').needQty).toBe(7);
    expect(by('milk-fairlife').needQty).toBeCloseTo(112);
    expect(by('beef-8020-cooked').needQty).toBeCloseTo(42 / 0.7 / 16); // ≈3.75 lb raw
    expect(by('beef-8020-cooked').packages).toBe(4);
    expect(by('rice-jasmine-cooked').needQty).toBeCloseTo(3.5); // dry cups
    expect(by('olive-oil').needQty).toBeCloseTo(10.5);
    expect(by('chobani-30g').needQty).toBe(7);
    expect(by('pretzels').needQty).toBeCloseTo(14);
    expect(by('apple-juice').needQty).toBeCloseTo(84);
    expect(by('pineapple-juice').needQty).toBeCloseTo(84);
    expect(by('sup:sup-greens').needQty).toBe(7);
    expect(by('sup:sup-metamucil').needQty).toBe(7);
  });

  it('dedupes the same ingredient across meals and updates when the plan changes', () => {
    // put apple juice in breakfast too: still one line
    const b = s.meals.find((m) => m.id === 'm-breakfast')!;
    A.swapTemplateItem(s, 'm-breakfast', b.items.find((i) => i.foodId === 'oj-simply')!.id, 'apple-juice');
    const g = generateGroceries(s, D, 7);
    expect(g.filter((l) => l.key === 'apple-juice').length).toBe(1);
    expect(g.find((l) => l.key === 'apple-juice')!.needQty).toBeCloseTo(168);
    expect(g.find((l) => l.key === 'oj-simply')).toBeUndefined();
  });

  it('subtracts pantry and scales with shopping duration', () => {
    A.setPantry(s, 'eggs-eb', 6);
    const g = generateGroceries(s, D, 14);
    const eggs = g.find((l) => l.key === 'eggs-eb')!;
    expect(eggs.needQty).toBe(28);
    expect(eggs.toBuy).toBe(22);
    expect(eggs.packages).toBe(2);
  });
});

describe('training', () => {
  const tmpl = (st: AppState) => A.createTemplate(st, {
    name: 'Upper A', type: 'strength', color: '#f00',
    exercises: [A.newExercise('Bench Press', 3, '5', 120, 135), A.newExercise('Row', 3, '8-10', 90)],
  });

  it('creates a workout, adds/removes/reorders exercises', () => {
    const id = tmpl(s);
    const t = s.templates.find((x) => x.id === id)!;
    t.exercises.push(A.newExercise('Curl'));
    A.moveInArray(t.exercises, 2, -1);
    expect(t.exercises.map((e) => e.name)).toEqual(['Bench Press', 'Curl', 'Row']);
    t.exercises = t.exercises.filter((e) => e.name !== 'Curl');
    expect(t.exercises.length).toBe(2);
    const dup = A.duplicateTemplate(s, id)!;
    expect(s.templates.find((x) => x.id === dup)!.name).toBe('Upper A (copy)');
  });

  it('schedules weekly, skips, and reschedules', () => {
    const id = tmpl(s);
    const e = A.addScheduleEntry(s, { templateId: id, kind: 'weekly', weekdays: [1, 4], startDate: D, everyWeeks: 1, programId: 'prog-main' });
    const occ = occurrencesInRange(s, D, addDays(D, 13));
    expect(occ.length).toBe(4);
    A.skipOccurrence(s, occ[0].key);
    expect(occurrencesOn(s, D)[0].status).toBe('skipped');
    A.moveOccurrence(s, occ[1].key, addDays(D, 2));
    expect(occurrencesOn(s, addDays(D, 2)).length).toBe(1);
    expect(occurrencesOn(s, addDays(D, 3)).length).toBe(0);
    // pausing the program hides it
    s.programs[0].paused = true;
    expect(occurrencesInRange(s, D, addDays(D, 13)).length).toBe(0);
    s.programs[0].paused = false;
    // switching program hides entries of the other program
    s.programs.push({ id: 'p2', name: 'Run block', paused: false });
    s.activeProgramId = 'p2';
    expect(occurrencesInRange(s, D, addDays(D, 13)).length).toBe(0);
    s.activeProgramId = 'prog-main';
    A.removeScheduleEntry(s, e);
    expect(occurrencesInRange(s, D, addDays(D, 13)).length).toBe(0);
  });

  it('supports every-other-week and multiple workouts per day', () => {
    const id = tmpl(s);
    A.addScheduleEntry(s, { templateId: id, kind: 'weekly', weekdays: [1], startDate: D, everyWeeks: 2 });
    A.addScheduleEntry(s, { templateId: id, kind: 'once', date: D, startDate: D });
    expect(occurrencesOn(s, D).length).toBe(2);
    expect(occurrencesOn(s, addDays(D, 7)).length).toBe(0);
    expect(occurrencesOn(s, addDays(D, 14)).length).toBe(1);
  });

  it('logs strength sets, remembers last weight, never auto-increases, tracks PRs', () => {
    const id = tmpl(s);
    const s1 = A.startSession(s, id, D);
    const sess = A.getSession(s, s1)!;
    expect(sess.exercises[0].sets[0].weight).toBe(135);
    for (const st of sess.exercises[0].sets) A.updateSet(s, s1, sess.exercises[0].id, st.id, { weight: 145, reps: 5, done: true });
    A.finishSession(s, s1);
    expect(lastWeight(s, 'Bench Press')).toBe(145);
    const s2 = A.startSession(s, id, addDays(D, 3));
    expect(A.getSession(s, s2)!.exercises[0].sets[0].weight).toBe(145); // remembered, not increased
    expect(sessionVolume(A.getSession(s, s1)!)).toBe(145 * 5 * 3);
    const pr = personalRecords(s).find((p) => p.name === 'Bench Press')!;
    expect(pr.heaviest).toBe(145);
    expect(exerciseHistory(s, 'bench press').length).toBe(1);
  });

  it('template edits never change history', () => {
    const id = tmpl(s);
    const sid = A.startSession(s, id, D);
    A.finishSession(s, sid);
    const t = s.templates.find((x) => x.id === id)!;
    t.name = 'Renamed'; t.exercises[0].name = 'Incline Bench';
    A.deleteTemplate(s, id);
    const sess = A.getSession(s, sid)!;
    expect(sess.name).toBe('Upper A');
    expect(sess.exercises[0].name).toBe('Bench Press');
  });

  it('logs runs with pace and interval segments', () => {
    const id = A.createTemplate(s, {
      name: 'Track 6x400', type: 'intervals', color: '#ff0', exercises: [],
      run: { runType: 'intervals', environment: 'outdoor', segments: [{ id: 'a', label: '400m', repeats: 6, workDist: 0.4, recoverySec: 90 }] },
    });
    const sid = A.startSession(s, id, D);
    const sess = A.getSession(s, sid)!;
    expect(sess.run!.segments[0].repeats).toBe(6);
    sess.run!.distanceKm = 5; sess.run!.durationSec = 25 * 60;
    expect(paceSecPerUnit(sess.run!, 'km')).toBe(300);
    expect(paceSecPerUnit(sess.run!, 'mi')).toBeCloseTo(482.8, 1);
  });
});

describe('supplements', () => {
  it('does not assume daily except where configured', () => {
    const due = s.supplements.filter((x) => supplementDueOn(s, x, D)).map((x) => x.id);
    expect(due).toEqual(['sup-greens', 'sup-metamucil']);
  });
  it('training-day supplements follow the workout calendar', () => {
    const sup = s.supplements.find((x) => x.id === 'sup-creatine')!;
    sup.group = 'pre'; sup.frequency = 'training';
    expect(supplementDueOn(s, sup, D)).toBe(false);
    const id = A.createTemplate(s, { name: 'Run', type: 'run-outdoor', color: '#0f0', exercises: [] });
    A.addScheduleEntry(s, { templateId: id, kind: 'once', date: D, startDate: D });
    expect(supplementDueOn(s, sup, D)).toBe(true);
  });
  it('optional supplements are never counted as due, and v1 data migrates into groups', () => {
    expect(s.supplements.filter((x) => x.group === 'optional').every((x) => !supplementDueOn(s, x, D))).toBe(true);
    const v1 = { ...s.supplements[2], group: undefined, frequency: 'unset', preWorkout: false, postWorkout: false } as unknown as AppState['supplements'][number];
    const v1pre = { ...s.supplements[3], group: undefined, frequency: 'training', preWorkout: true } as unknown as AppState['supplements'][number];
    const m = migrate({ supplements: [v1, v1pre] } as Partial<AppState>);
    expect(m.supplements[0].group).toBe('optional');
    expect(m.supplements[0].frequency).toBe('daily');
    expect(m.supplements[1].group).toBe('pre');
    expect(m.supplements[1].frequency).toBe('training');
  });
  it('tracks completion and flags overlaps', () => {
    A.toggleSupplement(s, D, 'sup-greens');
    expect(s.days[D].supplements['sup-greens']).toBe(true);
    expect(overlaps(s.supplements).map((o) => o.key)).toContain('vitaminD');
  });
});

describe('progress', () => {
  it('rolling average and weekly rate', () => {
    for (let i = 0; i < 14; i++) A.addWeight(s, addDays(D, i), 145 + i * 0.1);
    const ra = rollingAverage(s.weights);
    expect(ra[6].avg).toBeCloseTo(145.3, 5);
    expect(weeklyRate(s.weights)!).toBeCloseTo(0.7, 5);
    const sug = calorieSuggestion(s.weights);
    expect(sug.ready).toBe(true);
  });
  it('needs 14 days before suggesting', () => {
    for (let i = 0; i < 5; i++) A.addWeight(s, addDays(D, i), 145);
    expect(calorieSuggestion(s.weights).ready).toBe(false);
  });
  it('suggests more calories when gaining too slowly and never applies it', () => {
    for (let i = 0; i < 14; i++) A.addWeight(s, addDays(D, i), 145);
    const sug = calorieSuggestion(s.weights);
    expect(sug.delta).toBeGreaterThan(0);
    expect(s.goals.calories).toBe(3400);
  });
  it('same-day weight replaces', () => {
    A.addWeight(s, D, 145); A.addWeight(s, D, 146);
    expect(s.weights.length).toBe(1);
  });
});

describe('meal prep', () => {
  it('Sunday batch covers Sun–Tue, Wednesday covers Wed–Sat', () => {
    const sun = addDays(D, -1);
    expect(coverage(s, sun).length).toBe(3);
    expect(coverage(s, addDays(sun, 3)).length).toBe(4);
    const b = prepBatch(s, sun);
    const beef = b.items.find((i) => i.foodId === 'beef-8020-cooked')!;
    expect(beef.cookedQty).toBe(18);
    expect(b.portions).toBe(3);
  });
});

describe('persistence', () => {
  it('shards and restores state losslessly', () => {
    const m = meal(s, 'Breakfast');
    A.setMealConsumed(s, D, m.id, true);
    const id = A.createTemplate(s, { name: 'X', type: 'mobility', color: '#fff', exercises: [] });
    A.finishSession(s, A.startSession(s, id, D));
    const back = unshard(shardState(s))!;
    expect(back.days[D].meals[0].items[0].consumed).toBe(true);
    expect(back.sessions.length).toBe(1);
    expect(migrate(JSON.parse(JSON.stringify(back)))).toEqual(migrate(s));
  });
  it('migrates partial old data', () => {
    const m = migrate({ goals: { calories: 3000, protein: 1, carbs: 1, fat: 1 } } as Partial<AppState>);
    expect(m.goals.calories).toBe(3000);
    expect(m.foods.length).toBeGreaterThan(10);
  });
});

describe('audit fixes', () => {
  it('grocery checkmarks expire after a few days so last week’s trip does not hide this week’s items', () => {
    const s = seedState();
    A.toggleGrocery(s, 'eggs-eb', '2026-11-01');
    expect(A.groceryIsChecked(s, 'eggs-eb', '2026-11-01')).toBe(true);
    expect(A.groceryIsChecked(s, 'eggs-eb', '2026-11-03')).toBe(true);
    expect(A.groceryIsChecked(s, 'eggs-eb', '2026-11-04')).toBe(false);
    // ticking again after expiry checks it, not unchecks it
    A.toggleGrocery(s, 'eggs-eb', '2026-11-08');
    expect(A.groceryIsChecked(s, 'eggs-eb', '2026-11-08')).toBe(true);
    A.toggleGrocery(s, 'eggs-eb', '2026-11-08');
    expect(A.groceryIsChecked(s, 'eggs-eb', '2026-11-08')).toBe(false);
  });

  it('migrates old true/false grocery checkmarks', () => {
    const old = { ...seedState(), groceryChecked: { 'eggs-eb': true, milk: false } } as unknown as AppState;
    const m = migrate(old);
    expect(typeof m.groceryChecked['eggs-eb']).toBe('string');
    expect(m.groceryChecked.milk).toBeUndefined();
    expect(m.version).toBe(3);
  });
});
