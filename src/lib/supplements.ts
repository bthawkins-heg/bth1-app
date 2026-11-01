import type { AppState, Supplement } from './types';
import { weekday } from './date';
import { occurrencesOn } from './training';

export function isTrainingDay(state: AppState, date: string): boolean {
  return occurrencesOn(state, date).some((o) => o.templateId !== 'rest' && o.status !== 'skipped');
}

/** Is this supplement part of the day's checklist? Optional ones never are (they're available, not expected). */
export function supplementDueOn(state: AppState, s: Supplement, date: string): boolean {
  if (!s.active || s.group === 'optional') return false;
  switch (s.frequency) {
    case 'daily': return true;
    case 'days': return (s.days ?? []).includes(weekday(date));
    case 'training': return isTrainingDay(state, date);
    case 'rest': return !isTrainingDay(state, date);
    default: return false;
  }
}

export const FREQ_LABEL: Record<'daily' | 'training' | 'rest' | 'days', string> = {
  daily: 'Every day', training: 'Training days', rest: 'Rest days', days: 'Specific days',
};

export const GROUPS: { id: Supplement['group']; label: string }[] = [
  { id: 'daily', label: 'Daily' }, { id: 'pre', label: 'Pre-workout' }, { id: 'post', label: 'Post-workout' }, { id: 'optional', label: 'Optional' },
];

/** Short schedule note, or '' when it simply shows every day (no repetitive labels). */
export function scheduleNote(s: Supplement): string {
  if (s.frequency === 'training') return 'training days';
  if (s.frequency === 'rest') return 'rest days';
  if (s.frequency === 'days') return (s.days ?? []).map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ');
  return '';
}

/** Fold v1 supplements (frequency + pre/post flags) into groups. */
export function migrateSupplement(s: Supplement): Supplement {
  const out = { ...s };
  if (!out.group) {
    out.group = s.preWorkout ? 'pre' : s.postWorkout ? 'post' : (s.frequency === 'unset' || s.frequency === 'as-needed') ? 'optional' : 'daily';
  }
  if (out.frequency === 'unset' || out.frequency === 'as-needed') out.frequency = 'daily';
  delete out.preWorkout; delete out.postWorkout;
  return out;
}

export interface Overlap { key: 'creatine' | 'vitaminD' | 'stimulant'; label: string; items: Supplement[] }

/** Flags when more than one supplement you take on a given day shares an ingredient class. Informational only. */
export function overlaps(list: Supplement[]): Overlap[] {
  const defs: { key: Overlap['key']; label: string }[] = [
    { key: 'creatine', label: 'Creatine' }, { key: 'vitaminD', label: 'Vitamin D' }, { key: 'stimulant', label: 'Stimulants / caffeine' },
  ];
  return defs.map((d) => ({ ...d, items: list.filter((s) => s.active && s.tags[d.key]) })).filter((o) => o.items.length > 1);
}
