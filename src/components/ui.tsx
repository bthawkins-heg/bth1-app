import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Unit, Verification } from '../lib/types';

export function Icon({ name, size = 22, color = 'currentColor' }: { name: string; size?: number; color?: string }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'today': return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case 'training': return <svg {...p}><path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" /></svg>;
    case 'cart': return <svg {...p}><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2.5 3h3l2.4 12.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.2L21 7H6.2" /></svg>;
    case 'progress': return <svg {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></svg>;
    case 'settings': return <svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
    case 'check': return <svg {...p} strokeWidth={3}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
    case 'plus': return <svg {...p}><path d="M12 5v14M5 12h14" /></svg>;
    case 'minus': return <svg {...p}><path d="M5 12h14" /></svg>;
    case 'x': return <svg {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
    case 'left': return <svg {...p}><path d="M15 5l-7 7 7 7" /></svg>;
    case 'right': return <svg {...p}><path d="M9 5l7 7-7 7" /></svg>;
    case 'up': return <svg {...p}><path d="M6 15l6-6 6 6" /></svg>;
    case 'down': return <svg {...p}><path d="M6 9l6 6 6-6" /></svg>;
    case 'copy': return <svg {...p}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>;
    case 'cal': return <svg {...p}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>;
    case 'trash': return <svg {...p}><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V4h6v3" /></svg>;
    case 'swap': return <svg {...p}><path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" /></svg>;
    case 'pill': return <svg {...p}><rect x="3" y="8" width="18" height="8" rx="4" /><path d="M12 8v8" /></svg>;
    case 'run': return <svg {...p}><circle cx="14" cy="4.5" r="1.8" /><path d="M8 21l3-6 3 2 1 4M6 12l3-3 4 1 2 3 3 1" /></svg>;
    case 'share': return <svg {...p}><path d="M12 3v13M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></svg>;
    case 'edit': return <svg {...p}><path d="M4 20h4L19 9l-4-4L4 16v4z" /></svg>;
    case 'clock': return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case 'info': return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>;
    default: return null;
  }
}

export function Check({ on, partial, onClick, lg, label }: { on: boolean; partial?: boolean; onClick?: () => void; lg?: boolean; label?: string }) {
  return (
    <button className={`check ${on ? 'on' : ''} ${partial && !on ? 'partial' : ''} ${lg ? 'lg' : ''}`} onClick={(e) => { e.stopPropagation(); onClick?.(); }} aria-label={label} aria-pressed={on} role="checkbox" aria-checked={on}>
      <Icon name="check" size={lg ? 18 : 15} color="var(--check-ink)" />
    </button>
  );
}

export function Ring({ value, max, size = 132, stroke = 12, color = 'var(--cal)', planned }: { value: number; max: number; size?: number; stroke?: number; color?: string; planned?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  const ppct = planned != null ? Math.max(0, Math.min(1, planned / max)) : 0;
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--card2)" strokeWidth={stroke} fill="none" />
      {planned != null && <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeOpacity={0.22} strokeWidth={stroke} fill="none" strokeDasharray={`${c * ppct} ${c}`} strokeLinecap="round" />}
      <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={`${c * pct} ${c}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray .6s cubic-bezier(.2,.8,.2,1)' }} />
    </svg>
  );
}

export function Bar({ value, max, color, planned }: { value: number; max: number; color: string; planned?: number }) {
  const w = (x: number) => `${Math.max(0, Math.min(100, (x / Math.max(1, max)) * 100))}%`;
  return (
    <div className="bar">
      {planned != null && <i className="planned" style={{ width: w(planned), background: color }} />}
      <i style={{ width: w(value), background: color }} />
    </div>
  );
}

export function Sheet({ open, onClose, title, children, full, right }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; full?: boolean; right?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  if (!open) return null;
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className={`sheet ${full ? 'full' : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="sheet-grab" />
        <div className="sheet-head">
          <button className="btn ghost sm" onClick={onClose} style={{ minWidth: 64, justifyContent: 'flex-start' }}>Close</button>
          <div className="sheet-title ellipsis">{title}</div>
          <div style={{ minWidth: 64, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => <button key={o.value} role="tab" aria-selected={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  );
}

/** Numeric input that keeps a local string while typing so decimals and blanks work naturally. */
export function NumInput({ value, onChange, className = 'input', placeholder, step, ariaLabel, inputMode = 'decimal' }: { value: number | null | undefined; onChange: (v: number | null) => void; className?: string; placeholder?: string; step?: number; ariaLabel?: string; inputMode?: 'decimal' | 'numeric' }) {
  const [txt, setTxt] = useState(value == null ? '' : String(value));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) { last.current = value; setTxt(value == null ? '' : String(value)); }
  }, [value]);
  return (
    <input className={className} type="text" inputMode={inputMode} value={txt} placeholder={placeholder} step={step} aria-label={ariaLabel}
      onChange={(e) => {
        const t = e.target.value.replace(',', '.');
        setTxt(t);
        if (t.trim() === '') { last.current = null; onChange(null); return; }
        const n = Number(t);
        if (!isNaN(n)) { last.current = n; onChange(n); }
      }} />
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, ariaLabel }: { value: number; onChange: (v: number) => void; step?: number; min?: number; ariaLabel?: string }) {
  return (
    <div className="stepper">
      <button aria-label="decrease" onClick={() => onChange(Math.max(min, Math.round((value - step) * 100) / 100))}>−</button>
      <NumInput value={value} onChange={(v) => v != null && onChange(Math.max(min, v))} className="" ariaLabel={ariaLabel} />
      <button aria-label="increase" onClick={() => onChange(Math.round((value + step) * 100) / 100)}>+</button>
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button className={`switch ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />;
}

export const VER_LABEL: Record<Verification, string> = {
  label: 'Label', 'retailer-label': 'Retailer label', database: 'USDA ref', estimate: 'Estimate', user: 'Custom',
};
export function VerBadge({ v }: { v: Verification }) { return <span className={`badge ${v}`}>{VER_LABEL[v]}</span>; }

export function UnitSelect({ value, units, onChange, sm }: { value: Unit; units: Unit[]; onChange: (u: Unit) => void; sm?: boolean }) {
  return (
    <select className={`select ${sm ? 'sm' : ''}`} value={value} onChange={(e) => onChange(e.target.value as Unit)} aria-label="unit">
      {units.map((u) => <option key={u} value={u}>{u}</option>)}
    </select>
  );
}

export function Field({ label, children, group }: { label: string; children: ReactNode; group?: boolean }) {
  // `group` renders a plain container for chip/button groups so tapping the caption never presses the first button
  if (group) return <div className="field" role="group" aria-label={label}><span>{label}</span>{children}</div>;
  return <label className="field"><span>{label}</span>{children}</label>;
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return <div className="empty"><div className="e-icon">{icon}</div><div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{title}</div><div className="small">{children}</div></div>;
}

// ---------- Charts (SVG, no dependencies) ----------
export interface Series { name: string; color: string; points: { x: number; y: number }[]; dashed?: boolean; dots?: boolean; width?: number }

export function LineChart({ series, height = 180, xLabels, yFmt = (v) => String(Math.round(v)), hLines = [] }: {
  series: Series[]; height?: number; xLabels?: { x: number; label: string }[]; yFmt?: (v: number) => string; hLines?: { y: number; color: string; label: string }[];
}) {
  const W = 340, H = height, padL = 36, padR = 10, padT = 10, padB = 22;
  const all = series.flatMap((s) => s.points);
  if (!all.length) return <div className="muted small center" style={{ padding: 24 }}>No data yet</div>;
  const ys = all.map((p) => p.y).concat(hLines.map((h) => h.y));
  let ymin = Math.min(...ys), ymax = Math.max(...ys);
  if (ymin === ymax) { ymin -= 1; ymax += 1; }
  const pad = (ymax - ymin) * 0.12; ymin -= pad; ymax += pad;
  const xs = all.map((p) => p.x);
  let xmin = Math.min(...xs), xmax = Math.max(...xs);
  if (xmin === xmax) { xmin -= 1; xmax += 1; }
  const X = (x: number) => padL + ((x - xmin) / (xmax - xmin)) * (W - padL - padR);
  const Y = (y: number) => padT + (1 - (y - ymin) / (ymax - ymin)) * (H - padT - padB);
  const ticks = [0, 0.5, 1].map((t) => ymin + pad + t * (ymax - ymin - 2 * pad));
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={Y(t)} y2={Y(t)} stroke="var(--grid)" />
          <text x={padL - 6} y={Y(t) + 4} fill="var(--sub)" fontSize="10" textAnchor="end">{yFmt(t)}</text>
        </g>
      ))}
      {hLines.map((h, i) => (
        <g key={'h' + i}>
          <line x1={padL} x2={W - padR} y1={Y(h.y)} y2={Y(h.y)} stroke={h.color} strokeDasharray="4 4" strokeOpacity=".7" />
          <text x={W - padR} y={Y(h.y) - 4} fill={h.color} fontSize="10" textAnchor="end">{h.label}</text>
        </g>
      ))}
      {series.map((s) => {
        const pts = [...s.points].sort((a, b) => a.x - b.x);
        const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
        return (
          <g key={s.name}>
            {pts.length > 1 && <path d={d} fill="none" stroke={s.color} strokeWidth={s.width ?? 2.5} strokeDasharray={s.dashed ? '5 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />}
            {(s.dots || pts.length === 1) && pts.map((p, i) => <circle key={i} cx={X(p.x)} cy={Y(p.y)} r={3} fill={s.color} />)}
          </g>
        );
      })}
      {xLabels?.map((l, i) => {
        // keep edge labels inside the chart (a centred "Oct 31" at the right edge was cut to "Oct 3")
        const anchor = l.x <= xmin ? 'start' : l.x >= xmax ? 'end' : 'middle';
        return <text key={i} x={anchor === 'end' ? W - padR : X(l.x)} y={H - 6} fill="var(--sub)" fontSize="10" textAnchor={anchor}>{l.label}</text>;
      })}
    </svg>
  );
}

export function BarChart({ bars, height = 150, target, color = 'var(--accent)', yFmt = (v) => String(Math.round(v)) }: {
  bars: { label: string; value: number; secondary?: number; color?: string }[]; height?: number; target?: number; color?: string; yFmt?: (v: number) => string;
}) {
  const W = 340, H = height, padL = 36, padB = 20, padT = 8;
  const max = Math.max(1, target ?? 0, ...bars.map((b) => Math.max(b.value, b.secondary ?? 0))) * 1.1;
  const bw = (W - padL - 6) / Math.max(1, bars.length);
  const Y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
      {[0, 0.5, 1].map((t, i) => (
        <g key={i}><line x1={padL} x2={W} y1={Y(max / 1.1 * t)} y2={Y(max / 1.1 * t)} stroke="var(--grid)" />
          <text x={padL - 6} y={Y(max / 1.1 * t) + 4} fill="var(--sub)" fontSize="10" textAnchor="end">{yFmt(max / 1.1 * t)}</text></g>
      ))}
      {bars.map((b, i) => {
        const w = Math.min(bw * 0.64, 34), x = padL + i * bw + (bw - w) / 2;
        return (
          <g key={i}>
            {b.secondary != null && <rect x={x} y={Y(b.secondary)} width={w} height={Math.max(0, H - padB - Y(b.secondary))} rx={4} fill={b.color ?? color} opacity={0.22} />}
            <rect x={x} y={Y(b.value)} width={w} height={Math.max(0, H - padB - Y(b.value))} rx={4} fill={b.color ?? color} />
            <text x={x + w / 2} y={H - 5} fill="var(--sub)" fontSize="9.5" textAnchor="middle">{b.label}</text>
          </g>
        );
      })}
      {target != null && <line x1={padL} x2={W} y1={Y(target)} y2={Y(target)} stroke="var(--ink)" strokeOpacity=".5" strokeDasharray="4 4" />}
    </svg>
  );
}

/** Small in-page confirm dialog (window.confirm is blocked in some embeds). */
export function useConfirm() {
  const [state, setState] = useState<{ text: string; resolve: (v: boolean) => void } | null>(null);
  const ask = (text: string) => new Promise<boolean>((resolve) => setState({ text, resolve }));
  const node = state ? (
    <Sheet open onClose={() => { state.resolve(false); setState(null); }} title="Are you sure?">
      <p style={{ marginTop: 4 }}>{state.text}</p>
      <div className="grid2">
        <button className="btn secondary" onClick={() => { state.resolve(false); setState(null); }}>Cancel</button>
        <button className="btn danger" onClick={() => { state.resolve(true); setState(null); }}>Confirm</button>
      </div>
    </Sheet>
  ) : null;
  return { ask, node };
}

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}
