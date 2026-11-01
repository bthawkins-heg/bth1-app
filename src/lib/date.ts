// Local-date helpers using YYYY-MM-DD strings (no timezone drift).
export function iso(d: Date): string {
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export function parse(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function today(): string { return iso(new Date()); }
export function addDays(s: string, n: number): string {
  const d = parse(s); d.setDate(d.getDate() + n); return iso(d);
}
export function weekday(s: string): number { return parse(s).getDay(); }
export function diffDays(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);
}
export function startOfWeek(s: string, weekStartsOn: 0 | 1 = 0): string {
  const wd = weekday(s);
  const back = (wd - weekStartsOn + 7) % 7;
  return addDays(s, -back);
}
export function range(start: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDays(start, i));
}
export const WD_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function fmtDate(s: string, opts: { weekday?: boolean } = {}): string {
  const d = parse(s);
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return opts.weekday ? `${WD_SHORT[d.getDay()]}, ${base}` : base;
}
export function relDay(s: string): string {
  const t = today();
  const n = diffDays(t, s);
  if (n === 0) return 'Today';
  if (n === -1) return 'Yesterday';
  if (n === 1) return 'Tomorrow';
  return fmtDate(s, { weekday: true });
}
export function fmtTime(hhmm?: string): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}
export function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function fmtDuration(sec: number | null | undefined): string {
  if (sec == null || !isFinite(sec)) return '–';
  const s = Math.round(sec);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}
export function parseDuration(txt: string): number | null {
  const t = txt.trim();
  if (!t) return null;
  const parts = t.split(':').map((x) => Number(x));
  if (parts.some((x) => isNaN(x))) return null;
  if (parts.length === 1) return parts[0] * 60; // minutes
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}
