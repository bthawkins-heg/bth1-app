import { useSyncExternalStore } from 'react';

export type Tab = 'today' | 'training' | 'groceries' | 'progress' | 'settings';
interface UI { tab: Tab; sessionId: string | null; date: string | null }

const TABS: Tab[] = ['today', 'training', 'groceries', 'progress', 'settings'];
function tabFromHash(): Tab {
  const h = (typeof location !== 'undefined' ? location.hash.slice(1) : '') as Tab;
  return TABS.includes(h) ? h : 'today';
}

let ui: UI = { tab: tabFromHash(), sessionId: null, date: null };
const ls = new Set<() => void>();
export function setUI(p: Partial<UI>) {
  ui = { ...ui, ...p };
  if (p.tab) {
    try { if (location.hash.slice(1) !== p.tab) history.replaceState(null, '', '#' + p.tab); } catch { /* sandboxed */ }
    window.scrollTo({ top: 0 });
  }
  ls.forEach((l) => l());
}
export function useUI(): UI {
  return useSyncExternalStore((l) => { ls.add(l); return () => ls.delete(l); }, () => ui, () => ui);
}
if (typeof window !== 'undefined') window.addEventListener('hashchange', () => { const t = tabFromHash(); if (t !== ui.tab) setUI({ tab: t }); });
