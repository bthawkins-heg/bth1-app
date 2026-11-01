import type { AppState } from './types';
import { seedState } from './seed';
import { migrateSupplement } from './supplements';

/** Fill any fields missing from older saved states so new features never crash on old data. */
export function migrate(raw: Partial<AppState>): AppState {
  const base = seedState();
  const s = { ...base, ...raw } as AppState;
  s.prefs = { ...base.prefs, ...(raw.prefs ?? {}) };
  s.profile = { ...base.profile, ...(raw.profile ?? {}) };
  s.schedule = { weekdays: { ...base.schedule.weekdays, ...(raw.schedule?.weekdays ?? {}) }, overrides: { ...(raw.schedule?.overrides ?? {}) } };
  for (const k of ['days', 'pantry', 'groceryChecked', 'exceptions', 'prep'] as const) (s as unknown as Record<string, unknown>)[k] ??= {};
  for (const k of ['foods', 'meals', 'plans', 'supplements', 'programs', 'templates', 'scheduleEntries', 'sessions', 'weights', 'goalHistory'] as const) (s as unknown as Record<string, unknown>)[k] ??= [];
  s.supplements = s.supplements.map(migrateSupplement);
  // v2: seeded foods learn how they're sold (raw beef, dry rice) without touching anything the user edited
  for (const f of s.foods) {
    const seed = base.foods.find((x) => x.id === f.id);
    if (seed?.purchase?.buyAs && f.purchase && !f.purchase.buyAs) { f.purchase.buyAs = seed.purchase.buyAs; f.purchase.packageLabel = seed.purchase.packageLabel; }
  }
  s.version = 2;
  return s;
}
