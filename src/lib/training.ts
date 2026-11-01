import type { AppState, Occurrence, ScheduleEntry, SessionExercise, WorkoutSession, WorkoutTemplate, WorkoutType, RunLog } from './types';
import { addDays, diffDays, range, startOfWeek, weekday } from './date';

export const TYPE_LABEL: Record<WorkoutType, string> = {
  strength: 'Strength', hypertrophy: 'Hypertrophy', 'run-outdoor': 'Outdoor run', 'run-treadmill': 'Treadmill run',
  intervals: 'Intervals', recovery: 'Recovery', mobility: 'Mobility', custom: 'Custom',
};
export const TYPE_COLOR: Record<WorkoutType, string> = {
  strength: '#ff6b3d', hypertrophy: '#ff3d71', 'run-outdoor': '#30d158', 'run-treadmill': '#34c7a5',
  intervals: '#ffd60a', recovery: '#64d2ff', mobility: '#bf5af2', custom: '#8e8e93',
};
export const isRunType = (t: WorkoutType) => t === 'run-outdoor' || t === 'run-treadmill' || t === 'intervals';
export const isLiftType = (t: WorkoutType) => t === 'strength' || t === 'hypertrophy';

export function typeName(t: { type: WorkoutType; customType?: string }): string {
  return t.type === 'custom' && t.customType ? t.customType : TYPE_LABEL[t.type];
}

function entryActive(state: AppState, e: ScheduleEntry): boolean {
  if (!e.programId) return true;
  const p = state.programs.find((x) => x.id === e.programId);
  if (!p || p.paused) return false;
  return e.programId === state.activeProgramId;
}

/** Original (un-moved) dates an entry falls on between start and end inclusive. */
export function entryDates(e: ScheduleEntry, start: string, end: string): string[] {
  if (e.kind === 'once') return e.date && e.date >= start && e.date <= end ? [e.date] : [];
  const out: string[] = [];
  const from = start > e.startDate ? start : e.startDate;
  const to = e.endDate && e.endDate < end ? e.endDate : end;
  if (from > to) return out;
  const every = Math.max(1, e.everyWeeks ?? 1);
  const anchor = startOfWeek(e.startDate);
  for (const d of range(from, diffDays(from, to) + 1)) {
    if (!(e.weekdays ?? []).includes(weekday(d))) continue;
    const weeks = Math.floor(diffDays(anchor, startOfWeek(d)) / 7);
    if (weeks % every === 0) out.push(d);
  }
  return out;
}

export function occurrencesInRange(state: AppState, start: string, end: string): Occurrence[] {
  const PAD = 45; // allow occurrences moved in from outside the window
  const out: Occurrence[] = [];
  for (const e of state.scheduleEntries) {
    if (!entryActive(state, e)) continue;
    for (const od of entryDates(e, addDays(start, -PAD), addDays(end, PAD))) {
      const key = `${e.id}@${od}`;
      const ex = state.exceptions[key];
      const date = ex?.movedTo ?? od;
      if (date < start || date > end) continue;
      const session = state.sessions.find((s) => s.occurrenceKey === key && s.status === 'completed');
      out.push({
        key, entryId: e.id, templateId: e.templateId, date, originalDate: od,
        status: session ? 'done' : ex?.skipped ? 'skipped' : 'planned', sessionId: session?.id,
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}

export function occurrencesOn(state: AppState, date: string): Occurrence[] {
  return occurrencesInRange(state, date, date);
}

// ---------- Strength analytics ----------
const norm = (s: string) => s.trim().toLowerCase();

export function e1rm(weight: number, reps: number): number {
  if (!weight || !reps) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30); // Epley
}

export function completedSessions(state: AppState): WorkoutSession[] {
  return state.sessions.filter((s) => s.status === 'completed').sort((a, b) => a.date.localeCompare(b.date) || a.startedAt.localeCompare(b.startedAt));
}

export function exerciseHistory(state: AppState, name: string, excludeSessionId?: string) {
  const out: { date: string; sessionId: string; sets: { reps: number; weight: number }[]; topWeight: number; bestE1rm: number; volume: number }[] = [];
  for (const s of completedSessions(state)) {
    if (s.id === excludeSessionId) continue;
    for (const ex of s.exercises) {
      if (norm(ex.name) !== norm(name)) continue;
      const sets = ex.sets.filter((x) => x.done && x.reps != null).map((x) => ({ reps: x.reps ?? 0, weight: x.weight ?? 0 }));
      if (!sets.length) continue;
      out.push({
        date: s.date, sessionId: s.id, sets,
        topWeight: Math.max(...sets.map((x) => x.weight)),
        bestE1rm: Math.max(...sets.map((x) => e1rm(x.weight, x.reps))),
        volume: sets.reduce((a, x) => a + x.weight * x.reps, 0),
      });
    }
  }
  return out;
}

export function lastPerformance(state: AppState, name: string, excludeSessionId?: string) {
  const h = exerciseHistory(state, name, excludeSessionId);
  return h[h.length - 1];
}

export function lastWeight(state: AppState, name: string, excludeSessionId?: string): number | undefined {
  const last = lastPerformance(state, name, excludeSessionId);
  if (!last) return undefined;
  const w = last.sets.map((s) => s.weight).filter((w) => w > 0);
  return w.length ? w[w.length - 1] : undefined;
}

export interface PR { name: string; heaviest: number; heaviestDate: string; bestE1rm: number; e1rmDate: string; sessions: number }

export function personalRecords(state: AppState): PR[] {
  const names = new Map<string, string>();
  for (const s of completedSessions(state)) for (const e of s.exercises) names.set(norm(e.name), e.name);
  const out: PR[] = [];
  for (const name of names.values()) {
    const h = exerciseHistory(state, name);
    if (!h.length) continue;
    let heaviest = 0, hd = '', best = 0, bd = '';
    for (const x of h) {
      if (x.topWeight > heaviest) { heaviest = x.topWeight; hd = x.date; }
      if (x.bestE1rm > best) { best = x.bestE1rm; bd = x.date; }
    }
    out.push({ name, heaviest, heaviestDate: hd, bestE1rm: best, e1rmDate: bd, sessions: h.length });
  }
  return out.sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
}

export function sessionVolume(s: WorkoutSession): number {
  return s.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).reduce((b, x) => b + (x.reps ?? 0) * (x.weight ?? 0), 0), 0);
}

/** Is this set a new heaviest weight for the exercise compared to all earlier completed sessions? */
export function isWeightPR(state: AppState, name: string, weight: number | null, sessionId: string): boolean {
  if (!weight) return false;
  const h = exerciseHistory(state, name, sessionId);
  if (!h.length) return false;
  return weight > Math.max(...h.map((x) => x.topWeight));
}

// ---------- Running ----------
export function paceSecPerUnit(run: RunLog, unit: 'mi' | 'km'): number | null {
  if (!run.distanceKm || !run.durationSec) return null;
  const d = unit === 'km' ? run.distanceKm : run.distanceKm / 1.609344;
  return run.durationSec / d;
}
export function speedPerHour(run: RunLog, unit: 'mi' | 'km'): number | null {
  const p = paceSecPerUnit(run, unit);
  return p ? 3600 / p : null;
}

export function runSessions(state: AppState): WorkoutSession[] {
  return completedSessions(state).filter((s) => s.run && s.run.distanceKm);
}

// ---------- Session creation ----------
export function sessionFromTemplate(state: AppState, t: WorkoutTemplate, date: string, id: string, occurrenceKey?: string): WorkoutSession {
  const exercises: SessionExercise[] = t.exercises.map((e, i) => {
    const remembered = lastWeight(state, e.name);
    const w = remembered ?? e.weight ?? null; // remembered last weight, never auto-increased
    return {
      id: `${id}-e${i}`, name: e.name,
      planned: { sets: e.sets, reps: e.reps, weight: e.weight, restSec: e.restSec },
      sets: Array.from({ length: Math.max(1, e.sets) }, (_, k) => ({ id: `${id}-e${i}-s${k}`, reps: firstRep(e.reps), weight: w, done: false })),
      notes: e.notes,
    };
  });
  const run: RunLog | undefined = t.run ? {
    runType: t.run.runType, environment: t.run.environment,
    distanceKm: t.run.distance ?? null, durationSec: t.run.durationMin ? t.run.durationMin * 60 : null,
    incline: t.run.incline ?? null, rpe: null,
    segments: t.run.segments.map((s) => ({ ...s, done: false })),
  } : undefined;
  return {
    id, date, occurrenceKey, templateId: t.id, name: t.name, type: t.type, customType: t.customType,
    status: 'in-progress', startedAt: new Date().toISOString(), exercises, run, notes: '',
  };
}

function firstRep(r: string): number | null {
  const m = /\d+/.exec(r);
  return m ? Number(m[0]) : null;
}

/** Weekly consistency: completed vs scheduled (non-rest) per week. */
export function weeklyConsistency(state: AppState, weeks: number, endDate: string) {
  const out: { week: string; planned: number; done: number }[] = [];
  const thisWeek = startOfWeek(endDate, state.prefs.weekStartsOn);
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addDays(thisWeek, -7 * i);
    const we = addDays(ws, 6);
    const occ = occurrencesInRange(state, ws, we).filter((o) => o.templateId !== 'rest');
    const done = state.sessions.filter((s) => s.status === 'completed' && s.date >= ws && s.date <= we).length;
    out.push({ week: ws, planned: occ.length, done });
  }
  return out;
}
