import type { AppState, Supplement } from './types';
import { weekday } from './date';
import { occurrencesOn } from './training';

export function isTrainingDay(state: AppState, date: string): boolean {
  return occurrencesOn(state, date).some((o) => o.templateId !== 'rest' && o.status !== 'skipped');
}

export function supplementDueOn(state: AppState, s: Supplement, date: string): boolean {
  if (!s.active) return false;
  switch (s.frequency) {
    case 'daily': return true;
    case 'days': return (s.days ?? []).includes(weekday(date));
    case 'training': return isTrainingDay(state, date);
    case 'rest': return !isTrainingDay(state, date);
    default: return false;
  }
}

export const FREQ_LABEL: Record<Supplement['frequency'], string> = {
  unset: 'Not scheduled', daily: 'Every day', training: 'Training days', rest: 'Rest days', days: 'Specific days', 'as-needed': 'As needed',
};

export interface Overlap { key: 'creatine' | 'vitaminD' | 'stimulant'; label: string; items: Supplement[] }

/** Flags when more than one supplement you take on a given day shares an ingredient class. Informational only. */
export function overlaps(list: Supplement[]): Overlap[] {
  const defs: { key: Overlap['key']; label: string }[] = [
    { key: 'creatine', label: 'Creatine' }, { key: 'vitaminD', label: 'Vitamin D' }, { key: 'stimulant', label: 'Stimulants / caffeine' },
  ];
  return defs.map((d) => ({ ...d, items: list.filter((s) => s.active && s.tags[d.key]) })).filter((o) => o.items.length > 1);
}
