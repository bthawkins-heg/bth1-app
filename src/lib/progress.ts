import type { WeightEntry } from './types';
import { addDays, diffDays } from './date';

export function sortedWeights(w: WeightEntry[]): WeightEntry[] {
  return [...w].sort((a, b) => a.date.localeCompare(b.date));
}

/** 7-day trailing average for each weigh-in date (uses entries within the 7 days ending that date). */
export function rollingAverage(w: WeightEntry[], window = 7): { date: string; avg: number }[] {
  const s = sortedWeights(w);
  return s.map((e) => {
    const from = addDays(e.date, -(window - 1));
    const inWin = s.filter((x) => x.date >= from && x.date <= e.date);
    return { date: e.date, avg: inWin.reduce((a, x) => a + x.lb, 0) / inWin.length };
  });
}

/** Least-squares slope of weight over the last `days` days, in lb per week. Null if too little data. */
export function weeklyRate(w: WeightEntry[], days = 14, minEntries = 4): number | null {
  const s = sortedWeights(w);
  if (!s.length) return null;
  const end = s[s.length - 1].date;
  const pts = s.filter((x) => diffDays(x.date, end) < days);
  if (pts.length < minEntries) return null;
  const xs = pts.map((p) => diffDays(pts[0].date, p.date));
  const ys = pts.map((p) => p.lb);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0;
  xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; });
  if (den === 0) return null;
  return (num / den) * 7;
}

export interface CalorieSuggestion { ready: boolean; reason: string; rate?: number; delta?: number; target?: { low: number; high: number } }

/**
 * After ≥14 days spanned with ≥10 weigh-ins, compare the trend to a lean-bulk target
 * (0.25–0.5% of body weight per week) and suggest a change. Never applied automatically.
 */
export function calorieSuggestion(w: WeightEntry[]): CalorieSuggestion {
  const s = sortedWeights(w);
  if (s.length < 2) return { ready: false, reason: 'Log morning weigh-ins for 14 days to unlock a calorie suggestion.' };
  const span = diffDays(s[0].date, s[s.length - 1].date) + 1;
  const recent = s.filter((x) => diffDays(x.date, s[s.length - 1].date) < 14);
  if (span < 14 || recent.length < 10) {
    return { ready: false, reason: `Need 14 days with at least 10 weigh-ins (you have ${recent.length} weigh-ins over ${Math.min(span, 14)} days).` };
  }
  const rate = weeklyRate(s, 14, 10)!;
  const bw = recent.reduce((a, x) => a + x.lb, 0) / recent.length;
  const low = bw * 0.0025, high = bw * 0.005;
  const mid = (low + high) / 2;
  // ~3,500 kcal per lb of body-weight change is a rough rule of thumb; per day = 500 × lb/week.
  let delta = Math.round(((mid - rate) * 500) / 50) * 50;
  delta = Math.max(-300, Math.min(300, delta));
  if (rate >= low && rate <= high) {
    return { ready: true, rate, delta: 0, target: { low, high }, reason: 'Your trend is inside the lean-bulk range. No change suggested.' };
  }
  return {
    ready: true, rate, delta, target: { low, high },
    reason: rate < low
      ? `You're gaining slower than ${low.toFixed(2)}–${high.toFixed(2)} lb/week. Consider adding about ${delta} kcal/day.`
      : `You're gaining faster than ${low.toFixed(2)}–${high.toFixed(2)} lb/week. Consider about ${Math.abs(delta)} kcal/day less.`,
  };
}
