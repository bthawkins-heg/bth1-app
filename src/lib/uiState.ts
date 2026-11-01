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

// The current local date, kept fresh when the app is reopened after midnight (Home Screen apps resume, they don't reload).
let todayStr = '';
const dayLs = new Set<() => void>();
function refreshToday() {
  const d = new Date();
  const t = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (t !== todayStr) { todayStr = t; dayLs.forEach((l) => l()); }
}
refreshToday();
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', refreshToday);
  window.addEventListener('focus', refreshToday);
  setInterval(refreshToday, 60_000);
}
export function useToday(): string {
  return useSyncExternalStore((l) => { dayLs.add(l); return () => dayLs.delete(l); }, () => todayStr, () => todayStr);
}
