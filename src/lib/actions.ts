// Pure state mutations. The UI calls these through store.update(draft => ...), and the tests call them directly.
import type {
  AppState, DayLog, DayMeal, Goals, MealItem, ScheduleEntry, TemplateExercise, Unit, WorkoutSession, WorkoutTemplate,
} from './types';
import { buildDayFromPlan, findFood, foodNutrients, makeDayItem, newId, planSignature, ZERO } from './nutrition';
import { sessionFromTemplate } from './training';
import { convert } from './units';
import { addDays, today } from './date';

// ---------------- Days / logging ----------------
export function ensureDay(d: AppState, date: string): DayLog {
  if (!d.days[date]) d.days[date] = buildDayFromPlan(d, date);
  return d.days[date];
}

function findMeal(d: AppState, date: string, mealId: string): DayMeal {
  const m = ensureDay(d, date).meals.find((x) => x.id === mealId || x.mealId === mealId);
  if (!m) throw new Error('meal not found');
  return m;
}

export function setItemConsumed(d: AppState, date: string, mealId: string, itemId: string, consumed: boolean) {
  const item = findMeal(d, date, mealId).items.find((i) => i.id === itemId);
  if (!item) return;
  item.consumed = consumed; // boolean, so tapping twice can never double-count
  item.consumedAt = consumed ? new Date().toISOString() : undefined;
}

export function toggleItem(d: AppState, date: string, mealId: string, itemId: string) {
  const item = findMeal(d, date, mealId).items.find((i) => i.id === itemId);
  if (item) setItemConsumed(d, date, mealId, itemId, !item.consumed);
}

export function setMealConsumed(d: AppState, date: string, mealId: string, consumed: boolean) {
  const meal = findMeal(d, date, mealId);
  for (const i of meal.items) {
    if (i.consumed === consumed) continue;
    i.consumed = consumed;
    i.consumedAt = consumed ? new Date().toISOString() : undefined;
  }
}

function recompute(d: AppState, item: { foodId: string; qty: number; unit: Unit; n: typeof ZERO }) {
  const f = findFood(d, item.foodId);
  item.n = f ? (foodNutrients(f, item.qty, item.unit) ?? { ...ZERO }) : { ...ZERO };
}

export function editPortion(d: AppState, date: string, mealId: string, itemId: string, qty: number, unit: Unit) {
  const item = findMeal(d, date, mealId).items.find((i) => i.id === itemId);
  if (!item) return;
  item.qty = qty; item.unit = unit;
  recompute(d, item);
}

/** Pick a unit/qty for a new food that keeps the same amount when possible. */
function carryAmount(d: AppState, foodId: string, qty: number, unit: Unit): { qty: number; unit: Unit } {
  const f = findFood(d, foodId);
  if (!f) return { qty, unit };
  if (foodNutrients(f, qty, unit)) return { qty, unit };
  if (convert(qty, unit, f.servingUnit) != null) return { qty: convert(qty, unit, f.servingUnit)!, unit: f.servingUnit };
  return { qty: f.servingSize, unit: f.servingUnit };
}

export function swapDayItem(d: AppState, date: string, mealId: string, itemId: string, foodId: string) {
  const meal = findMeal(d, date, mealId);
  const idx = meal.items.findIndex((i) => i.id === itemId);
  if (idx < 0) return;
  const old = meal.items[idx];
  const amt = carryAmount(d, foodId, old.qty, old.unit);
  const alts = old.alternatives?.includes(foodId) ? old.alternatives : [...(old.alternatives ?? [old.foodId]), foodId];
  const next = makeDayItem(d, { foodId, qty: amt.qty, unit: amt.unit, alternatives: alts });
  next.consumed = old.consumed; next.consumedAt = old.consumedAt;
  meal.items[idx] = next;
}

export function addDayItem(d: AppState, date: string, mealId: string, foodId: string, qty: number, unit: Unit, consumed = false) {
  const meal = findMeal(d, date, mealId);
  const it = makeDayItem(d, { foodId, qty, unit });
  it.consumed = consumed;
  if (consumed) it.consumedAt = new Date().toISOString();
  meal.items.push(it);
  return it.id;
}

export function removeDayItem(d: AppState, date: string, mealId: string, itemId: string) {
  const meal = findMeal(d, date, mealId);
  meal.items = meal.items.filter((i) => i.id !== itemId);
}

export function addDayMeal(d: AppState, date: string, name: string, emoji = '🍽️'): string {
  const id = newId('dm');
  ensureDay(d, date).meals.push({ id, name, emoji, items: [] });
  return id;
}

export function removeDayMeal(d: AppState, date: string, mealId: string) {
  const day = ensureDay(d, date);
  day.meals = day.meals.filter((m) => m.id !== mealId);
}

export function moveDayMeal(d: AppState, date: string, mealId: string, dir: -1 | 1) {
  const day = ensureDay(d, date);
  const i = day.meals.findIndex((m) => m.id === mealId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= day.meals.length) return;
  [day.meals[i], day.meals[j]] = [day.meals[j], day.meals[i]];
}

export function setDayMealTime(d: AppState, date: string, mealId: string, time: string | undefined) {
  findMeal(d, date, mealId).time = time || undefined;
}

/** Copy every meal and food from one day onto another as a fresh, un-logged plan. */
export function copyDay(d: AppState, from: string, to: string) {
  const src = d.days[from] ?? buildDayFromPlan(d, from);
  d.days[to] = {
    date: to, planId: src.planId, planSig: 'copied',
    meals: src.meals.map((m) => ({
      ...structuredClone(m), id: newId('dm'),
      items: m.items.map((i) => ({ ...structuredClone(i), id: newId('di'), consumed: false, consumedAt: undefined })),
    })),
    supplements: {},
  };
}

/** Rebuild a day from the current plan, keeping what was already logged as eaten. */
export function resyncDay(d: AppState, date: string) {
  const old = d.days[date];
  const fresh = buildDayFromPlan(d, date);
  if (old) {
    fresh.supplements = old.supplements;
    for (const m of fresh.meals) {
      const om = old.meals.find((x) => x.mealId && x.mealId === m.mealId);
      if (!om) continue;
      for (const it of m.items) {
        const oi = om.items.find((x) => x.foodId === it.foodId && x.consumed);
        if (oi) { it.consumed = true; it.consumedAt = oi.consumedAt; it.qty = oi.qty; it.unit = oi.unit; it.n = oi.n; }
      }
      // keep consumed items that are no longer in the plan so history is never lost
      for (const oi of om.items) if (oi.consumed && !m.items.some((x) => x.foodId === oi.foodId)) m.items.push(oi);
    }
    for (const om of old.meals) {
      if (!fresh.meals.some((m) => m.mealId && m.mealId === om.mealId) && om.items.some((i) => i.consumed)) {
        fresh.meals.push({ ...om, items: om.items.filter((i) => i.consumed) });
      }
    }
  }
  d.days[date] = fresh;
}

export function dayIsStale(d: AppState, date: string): boolean {
  const day = d.days[date];
  return !!day && day.planSig !== 'copied' && day.planSig !== 'custom' && day.planSig !== planSignature(d, date);
}

export function toggleSupplement(d: AppState, date: string, supId: string) {
  const day = ensureDay(d, date);
  day.supplements[supId] = !day.supplements[supId];
}

// ---------------- Templates: meals & plans ----------------
export function addMealTemplate(d: AppState, name: string, emoji = '🍽️'): string {
  const id = newId('m');
  d.meals.push({ id, name, emoji, items: [] });
  return id;
}

export function addTemplateItem(d: AppState, mealId: string, foodId: string, qty: number, unit: Unit): string {
  const m = d.meals.find((x) => x.id === mealId)!;
  const item: MealItem = { id: newId('mi'), foodId, qty, unit };
  m.items.push(item);
  return item.id;
}

export function updateTemplateItem(d: AppState, mealId: string, itemId: string, patch: Partial<MealItem>) {
  const m = d.meals.find((x) => x.id === mealId);
  const it = m?.items.find((i) => i.id === itemId);
  if (it) Object.assign(it, patch);
}

export function removeTemplateItem(d: AppState, mealId: string, itemId: string) {
  const m = d.meals.find((x) => x.id === mealId);
  if (m) m.items = m.items.filter((i) => i.id !== itemId);
}

export function moveInArray<T>(arr: T[], i: number, dir: -1 | 1) {
  const j = i + dir;
  if (i < 0 || j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

/** Swap a food in a meal template (e.g. pineapple → cranberry), keeping the amount. */
export function swapTemplateItem(d: AppState, mealId: string, itemId: string, foodId: string) {
  const m = d.meals.find((x) => x.id === mealId);
  const it = m?.items.find((i) => i.id === itemId);
  if (!it) return;
  const amt = carryAmount(d, foodId, it.qty, it.unit);
  if (!(it.alternatives ?? []).includes(it.foodId)) it.alternatives = [...(it.alternatives ?? []), it.foodId];
  it.foodId = foodId; it.qty = amt.qty; it.unit = amt.unit;
}

export function deleteMealTemplate(d: AppState, mealId: string) {
  d.meals = d.meals.filter((m) => m.id !== mealId);
  for (const p of d.plans) p.slots = p.slots.filter((s) => s.mealId !== mealId);
}

export function addPlan(d: AppState, name: string, copyFrom?: string): string {
  const id = newId('plan');
  const src = d.plans.find((p) => p.id === copyFrom);
  d.plans.push({ id, name, slots: src ? src.slots.map((s) => ({ ...s, id: newId('slot') })) : [] });
  return id;
}

export function deletePlan(d: AppState, planId: string) {
  if (d.plans.length <= 1) return;
  d.plans = d.plans.filter((p) => p.id !== planId);
  const fallback = d.plans[0].id;
  for (const k of Object.keys(d.schedule.weekdays)) if (d.schedule.weekdays[+k] === planId) d.schedule.weekdays[+k] = fallback;
  for (const k of Object.keys(d.schedule.overrides)) if (d.schedule.overrides[k] === planId) delete d.schedule.overrides[k];
}

// ---------------- Goals / weight ----------------
export function setGoals(d: AppState, goals: Goals, note?: string) {
  d.goals = { ...goals };
  const t = today();
  d.goalHistory = d.goalHistory.filter((g) => g.date !== t);
  d.goalHistory.push({ date: t, goals: { ...goals }, note });
  d.goalHistory.sort((a, b) => a.date.localeCompare(b.date));
}

export function addWeight(d: AppState, date: string, lb: number) {
  d.weights = d.weights.filter((w) => w.date !== date);
  d.weights.push({ date, lb });
  d.weights.sort((a, b) => a.date.localeCompare(b.date));
}

export function deleteWeight(d: AppState, date: string) { d.weights = d.weights.filter((w) => w.date !== date); }

// ---------------- Training: templates ----------------
export function createTemplate(d: AppState, t: Omit<WorkoutTemplate, 'id'>): string {
  const id = newId('wt');
  d.templates.push({ ...structuredClone(t), id });
  return id;
}

export function updateTemplate(d: AppState, t: WorkoutTemplate) {
  const i = d.templates.findIndex((x) => x.id === t.id);
  if (i >= 0) d.templates[i] = structuredClone(t);
}

export function duplicateTemplate(d: AppState, id: string): string | undefined {
  const t = d.templates.find((x) => x.id === id);
  if (!t) return;
  const copy = structuredClone(t);
  copy.id = newId('wt');
  copy.name = `${t.name} (copy)`;
  copy.exercises = copy.exercises.map((e) => ({ ...e, id: newId('te') }));
  d.templates.push(copy);
  return copy.id;
}

export function deleteTemplate(d: AppState, id: string) {
  // History keeps its own copy, so deleting a template never touches completed sessions.
  d.templates = d.templates.filter((t) => t.id !== id);
  d.scheduleEntries = d.scheduleEntries.filter((e) => e.templateId !== id);
}

export function newExercise(name: string, sets = 3, reps = '8-10', restSec = 90, weight?: number): TemplateExercise {
  return { id: newId('te'), name, sets, reps, restSec, weight };
}

// ---------------- Training: schedule ----------------
export function addScheduleEntry(d: AppState, e: Omit<ScheduleEntry, 'id'>): string {
  const id = newId('se');
  d.scheduleEntries.push({ ...e, id });
  return id;
}

export function removeScheduleEntry(d: AppState, id: string) {
  d.scheduleEntries = d.scheduleEntries.filter((e) => e.id !== id);
  for (const k of Object.keys(d.exceptions)) if (k.startsWith(id + '@')) delete d.exceptions[k];
}

/** End a repeating entry from a date onward (keeps past occurrences intact). */
export function endScheduleEntry(d: AppState, id: string, lastDate: string) {
  const e = d.scheduleEntries.find((x) => x.id === id);
  if (e) e.endDate = lastDate;
}

export function skipOccurrence(d: AppState, key: string, skipped = true) {
  d.exceptions[key] = { ...(d.exceptions[key] ?? {}), skipped };
}

export function moveOccurrence(d: AppState, key: string, toDate: string) {
  const [entryId, orig] = key.split('@');
  const e = d.scheduleEntries.find((x) => x.id === entryId);
  if (e?.kind === 'once') { e.date = toDate; delete d.exceptions[key]; return; }
  d.exceptions[key] = { ...(d.exceptions[key] ?? {}), movedTo: toDate === orig ? undefined : toDate, skipped: false };
}

// ---------------- Training: sessions ----------------
export function startSession(d: AppState, templateId: string, date: string, occurrenceKey?: string): string {
  const existing = d.sessions.find((s) => occurrenceKey && s.occurrenceKey === occurrenceKey);
  if (existing) return existing.id;
  const t = d.templates.find((x) => x.id === templateId);
  if (!t) throw new Error('template not found');
  const id = newId('ws');
  d.sessions.push(sessionFromTemplate(d, t, date, id, occurrenceKey));
  return id;
}

export function startBlankSession(d: AppState, date: string, name: string, type: WorkoutSession['type']): string {
  const id = newId('ws');
  d.sessions.push({
    id, date, name, type, status: 'in-progress', startedAt: new Date().toISOString(), exercises: [],
    run: type === 'run-outdoor' || type === 'run-treadmill' || type === 'intervals'
      ? { runType: type === 'intervals' ? 'intervals' : 'easy', environment: type === 'run-treadmill' ? 'treadmill' : 'outdoor', distanceKm: null, durationSec: null, incline: null, rpe: null, segments: [] }
      : undefined,
  });
  return id;
}

export function getSession(d: AppState, id: string) { return d.sessions.find((s) => s.id === id); }

export function updateSet(d: AppState, sessionId: string, exId: string, setId: string, patch: Partial<{ reps: number | null; weight: number | null; done: boolean }>) {
  const ex = getSession(d, sessionId)?.exercises.find((e) => e.id === exId);
  const set = ex?.sets.find((s) => s.id === setId);
  if (set) Object.assign(set, patch);
}

export function addSet(d: AppState, sessionId: string, exId: string) {
  const ex = getSession(d, sessionId)?.exercises.find((e) => e.id === exId);
  if (!ex) return;
  const last = ex.sets[ex.sets.length - 1];
  ex.sets.push({ id: newId('set'), reps: last?.reps ?? null, weight: last?.weight ?? null, done: false });
}

export function removeSet(d: AppState, sessionId: string, exId: string, setId: string) {
  const ex = getSession(d, sessionId)?.exercises.find((e) => e.id === exId);
  if (ex) ex.sets = ex.sets.filter((s) => s.id !== setId);
}

export function addSessionExercise(d: AppState, sessionId: string, name: string, sets = 3, reps = '8') {
  const s = getSession(d, sessionId);
  if (!s) return;
  const id = newId('se');
  s.exercises.push({
    id, name, planned: { sets, reps, restSec: 90 },
    sets: Array.from({ length: sets }, () => ({ id: newId('set'), reps: Number(reps) || null, weight: null, done: false })),
  });
}

export function finishSession(d: AppState, id: string) {
  const s = getSession(d, id);
  if (!s) return;
  s.status = 'completed';
  s.finishedAt = new Date().toISOString();
}

export function deleteSession(d: AppState, id: string) { d.sessions = d.sessions.filter((s) => s.id !== id); }

// ---------------- Groceries / prep ----------------
export function setPantry(d: AppState, key: string, amount: number) {
  if (amount > 0) d.pantry[key] = amount; else delete d.pantry[key];
}
/** A shopping-list checkmark lasts this many days, so last week's trip doesn't hide this week's items. */
export const CHECK_DAYS = 3;
export function groceryIsChecked(s: Pick<AppState, 'groceryChecked'>, key: string, on: string = today()): boolean {
  const v = s.groceryChecked[key];
  return !!v && v <= on && v > addDays(on, -CHECK_DAYS);
}
export function toggleGrocery(d: AppState, key: string, on: string = today()) {
  if (groceryIsChecked(d, key, on)) delete d.groceryChecked[key]; else d.groceryChecked[key] = on;
}

export function togglePrepStep(d: AppState, date: string, step: string) {
  const r = (d.prep[date] ??= { date, done: {}, completed: false });
  r.done[step] = !r.done[step];
}
export function setPrepComplete(d: AppState, date: string, completed: boolean) {
  const r = (d.prep[date] ??= { date, done: {}, completed: false });
  r.completed = completed;
}
