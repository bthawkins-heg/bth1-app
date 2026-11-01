// Store behaviour that protects data: undo can't erase later edits, unreadable saves are kept.
import { describe, it, expect, vi, beforeEach } from 'vitest';

function fakeStorage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), keys: () => [...m.keys()], m };
}

describe('store safety', () => {
  beforeEach(() => { vi.resetModules(); });

  it('undo after a later non-undoable change does nothing (never erases the later change)', async () => {
    vi.stubGlobal('localStorage', fakeStorage());
    const store = await import('../src/lib/store');
    store.update((d) => { d.goals.calories = 3000; }, 'Targets saved');
    store.update((d) => { d.profile.name = 'Later edit'; }); // e.g. typing in a field
    store.undo();
    expect(store.getState().profile.name).toBe('Later edit');
    expect(store.getState().goals.calories).toBe(3000);
  });

  it('undo still reverts the most recent undoable change', async () => {
    vi.stubGlobal('localStorage', fakeStorage());
    const store = await import('../src/lib/store');
    const before = store.getState().goals.calories;
    store.update((d) => { d.goals.calories = 1234; }, 'Targets saved');
    store.undo();
    expect(store.getState().goals.calories).toBe(before);
  });

  it('keeps unreadable saved data under a backup key instead of overwriting it', async () => {
    const ls = fakeStorage({ 'fuel-app-state-v1': '{not json' });
    vi.stubGlobal('localStorage', ls);
    const store = await import('../src/lib/store');
    expect(store.loadProblem).toMatch(/^fuel-app-state-v1-unreadable-/);
    expect(ls.getItem(store.loadProblem!)).toBe('{not json');
  });
});
