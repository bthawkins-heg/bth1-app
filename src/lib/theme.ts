// Applies the chosen color theme to the page. 'system' follows the phone's Light/Dark setting.
export type Theme = 'light' | 'dark' | 'system';
let current: Theme = 'light';
const mq = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: dark)') : undefined;

export function applyTheme(t: Theme) {
  current = t;
  const resolved = t === 'system' ? (mq?.matches ? 'dark' : 'light') : t;
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', resolved === 'dark' ? '#000000' : '#f2f2f7');
}
mq?.addEventListener?.('change', () => { if (current === 'system') applyTheme('system'); });
