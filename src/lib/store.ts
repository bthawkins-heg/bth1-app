import { useSyncExternalStore } from 'react';
import type { AppState } from './types';
import { seedState } from './seed';
import { migrate } from './migrate';

const LS_KEY = 'fuel-app-state-v1';

type Listener = () => void;
/** Set when saved data could not be read; the raw text is kept under a backup key so nothing is overwritten. */
export let loadProblem: string | null = null;
let state: AppState = load();
const listeners = new Set<Listener>();
const undoStack: { label: string; state: AppState }[] = [];

export type SyncStatus = 'device' | 'syncing' | 'synced' | 'offline' | 'error';
let syncStatus: SyncStatus = 'device';
const syncListeners = new Set<Listener>();
function setSync(s: SyncStatus) { syncStatus = s; syncListeners.forEach((l) => l()); }

function load(): AppState {
  let raw: string | null = null;
  try { raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_KEY) : null; } catch { return seedState(); }
  if (!raw) return seedState();
  try {
    return migrate(JSON.parse(raw));
  } catch {
    // Never silently replace unreadable data: park it under its own key first.
    const key = `${LS_KEY}-unreadable-${Date.now()}`;
    try { localStorage.setItem(key, raw); } catch { /* full */ }
    loadProblem = key;
    return seedState();
  }
}

function saveLocal() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

export function getState(): AppState { return state; }

export function subscribe(l: Listener) { listeners.add(l); return () => listeners.delete(l); }

function emit() { listeners.forEach((l) => l()); }

/** Apply a mutation to a copy of the state. Pass `undo` to make the change undoable from the toast. */
export function update(fn: (draft: AppState) => void, undo?: string) {
  const prev = state;
  const draft = structuredClone(state);
  fn(draft);
  draft.updatedAt = Date.now();
  if (undo) {
    undoStack.push({ label: undo, state: prev });
    if (undoStack.length > 30) undoStack.shift();
    showToast(undo, true);
  } else if (undoStack.length) {
    // Undo restores a whole earlier snapshot, so after any other change it would also erase that change.
    undoStack.length = 0;
    if (toast?.canUndo) { toast = { ...toast, canUndo: false }; toastListeners.forEach((l) => l()); }
  }
  state = draft;
  saveLocal();
  emit();
  scheduleRemote();
}

export function undo() {
  const last = undoStack.pop();
  if (!last) return;
  state = { ...last.state, updatedAt: Date.now() };
  saveLocal();
  emit();
  scheduleRemote();
  showToast('Undone', false);
}

export function replaceState(next: AppState, persistRemote = true) {
  state = migrate(next);
  if (persistRemote) state.updatedAt = Date.now();
  saveLocal();
  emit();
  if (persistRemote) scheduleRemote();
}

// Another window/tab of the app saved: pick up its data instead of later overwriting it.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== LS_KEY || !e.newValue) return;
    try {
      const next = migrate(JSON.parse(e.newValue));
      if (next.updatedAt >= state.updatedAt) { state = next; undoStack.length = 0; emit(); }
    } catch { /* ignore */ }
  });
  // Ask the browser not to evict this app's storage under pressure (best effort).
  try { navigator.storage?.persist?.(); } catch { /* unsupported */ }
}

export function resetAll() { undoStack.length = 0; replaceState(seedState()); }

export function useApp<T>(sel: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state), () => sel(state));
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore((l) => { syncListeners.add(l); return () => syncListeners.delete(l); }, () => syncStatus, () => syncStatus);
}

// ---------- Toast ----------
export interface Toast { id: number; text: string; canUndo: boolean }
let toast: Toast | null = null;
const toastListeners = new Set<Listener>();
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function showToast(text: string, canUndo = false) {
  toast = { id: Date.now(), text, canUndo };
  toastListeners.forEach((l) => l());
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast = null; toastListeners.forEach((l) => l()); }, 4000);
}
export function dismissToast() { toast = null; toastListeners.forEach((l) => l()); }
export function useToast(): Toast | null {
  return useSyncExternalStore((l) => { toastListeners.add(l); return () => toastListeners.delete(l); }, () => toast, () => toast);
}

// ---------- Remote sync (Claude artifact per-user storage) ----------
/* The page may run inside a Claude artifact, where `window.claude.use('db')` gives a private
   per-user document store. Elsewhere (local dev, tests) it is absent and the app is device-only. */
interface DocSnap { id: string; exists: boolean; data(): Record<string, unknown> | undefined }
interface DocRef { set(d: Record<string, unknown>): Promise<void>; get(): Promise<DocSnap> }
interface Coll { doc(id: string): DocRef; get(): Promise<{ docs: DocSnap[] }> }
interface DB { collection(p: string): Coll }

let coll: Coll | null = null;
const lastWritten = new Map<string, string>();
let remoteTimer: ReturnType<typeof setTimeout> | undefined;
let writing = false;
let pending = false;

/** Split state into documents well under the 256 KiB per-document limit. */
export function shardState(s: AppState): Record<string, string> {
  const { days, sessions, ...core } = s;
  const out: Record<string, string> = {};
  const byMonth = <T>(rec: Record<string, T>, prefix: string) => {
    const g: Record<string, Record<string, T>> = {};
    for (const [k, v] of Object.entries(rec)) (g[`${prefix}-${k.slice(0, 7)}`] ??= {})[k] = v;
    for (const [k, v] of Object.entries(g)) out[k] = JSON.stringify(v);
  };
  byMonth(days, 'days');
  byMonth(Object.fromEntries(sessions.map((x) => [`${x.date}|${x.id}`, x])), 'sessions');
  out.core = JSON.stringify(core);
  return out;
}

export function unshard(docs: Record<string, string>): AppState | null {
  if (!docs.core) return null;
  const core = JSON.parse(docs.core);
  const days: AppState['days'] = {};
  const sessions: AppState['sessions'] = [];
  for (const [k, v] of Object.entries(docs)) {
    if (k.startsWith('days-')) Object.assign(days, JSON.parse(v));
    if (k.startsWith('sessions-')) sessions.push(...Object.values(JSON.parse(v) as Record<string, AppState['sessions'][number]>));
  }
  return { ...core, days, sessions };
}

function scheduleRemote() {
  if (!coll) return;
  clearTimeout(remoteTimer);
  remoteTimer = setTimeout(flushRemote, 1200);
}

async function flushRemote() {
  if (!coll) return;
  if (writing) { pending = true; return; }
  writing = true;
  setSync('syncing');
  try {
    const shards = shardState(state);
    const stamp = state.updatedAt;
    // core last so its stamp marks a complete write
    const keys = Object.keys(shards).filter((k) => k !== 'core').concat('core');
    for (const k of keys) {
      if (lastWritten.get(k) === shards[k]) continue;
      await coll.doc(k).set({ json: shards[k], updatedAt: stamp });
      lastWritten.set(k, shards[k]);
    }
    setSync('synced');
  } catch {
    setSync(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error');
  } finally {
    writing = false;
    if (pending) { pending = false; scheduleRemote(); }
  }
}

export async function initRemote() {
  const w = window as unknown as { claude?: { use(n: string): Promise<unknown> } };
  if (!w.claude?.use) return;
  try {
    const db = (await w.claude.use('db')) as DB | null;
    const user = (await w.claude.use('user')) as { id(): Promise<string | null> } | null;
    if (!db || !user) return;
    const id = await user.id();
    if (!id) return;
    setSync('syncing');
    const c = db.collection(`data/users/${id}`);
    const snap = await Promise.race([
      c.get(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000)),
    ]);
    const docs: Record<string, string> = {};
    let remoteStamp = 0;
    for (const d of snap.docs) {
      const body = d.data();
      if (!body || typeof body.json !== 'string') continue;
      docs[d.id] = body.json;
      lastWritten.set(d.id, body.json);
      if (d.id === 'core') remoteStamp = Number(body.updatedAt) || 0;
    }
    coll = c;
    const remote = unshard(docs);
    if (remote && remoteStamp > state.updatedAt) {
      state = migrate(remote);
      state.updatedAt = remoteStamp;
      saveLocal();
      emit();
      setSync('synced');
    } else {
      await flushRemote();
    }
    window.addEventListener('online', () => scheduleRemote());
  } catch {
    setSync('error');
  }
}

/** For tests. */
export function __setState(s: AppState) { state = s; undoStack.length = 0; }
