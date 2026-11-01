import { useState } from 'react';
import type { IntervalSegment, Occurrence, RunType, ScheduleEntry, WorkoutTemplate, WorkoutType } from '../lib/types';
import { useApp, update } from '../lib/store';
import * as A from '../lib/actions';
import { newId, r0 } from '../lib/nutrition';
import { addDays, fmtDate, fmtDuration, MONTHS_LONG, parse, range, relDay, startOfWeek, today, WD_SHORT } from '../lib/date';
import { occurrencesInRange, TYPE_COLOR, TYPE_LABEL, typeName, isRunType, isLiftType, completedSessions, sessionVolume, paceSecPerUnit } from '../lib/training';
import { kmTo, toKm } from '../lib/units';
import { setUI } from '../lib/uiState';
import { Empty, Field, Icon, NumInput, Segmented, Sheet, Switch, useConfirm } from '../components/ui';

type View = 'calendar' | 'workouts' | 'history';

export default function Training() {
  const [view, setView] = useState<View>('calendar');
  return (
    <div>
      <div className="screen-head"><div><h1 className="large-title">Training</h1><div className="subtitle">Plan, log and review</div></div></div>
      <Segmented value={view} onChange={setView} options={[{ value: 'calendar', label: 'Calendar' }, { value: 'workouts', label: 'Workouts' }, { value: 'history', label: 'History' }]} />
      {view === 'calendar' && <CalendarView />}
      {view === 'workouts' && <WorkoutsView />}
      {view === 'history' && <HistoryView />}
    </div>
  );
}

// ---------------------------------------------------------------- Calendar
function CalendarView() {
  const state = useApp((s) => s);
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const [anchor, setAnchor] = useState(today());
  const [addFor, setAddFor] = useState<string | null>(null);
  const [occ, setOcc] = useState<Occurrence | null>(null);
  const [progSheet, setProgSheet] = useState(false);
  const ws = state.prefs.weekStartsOn;

  const weekStart = startOfWeek(anchor, ws);
  const monthFirst = anchor.slice(0, 7) + '-01';
  const gridStart = startOfWeek(monthFirst, ws);
  const days = mode === 'week' ? range(weekStart, 7) : range(gridStart, 42);
  const occs = occurrencesInRange(state, days[0], days[days.length - 1]);
  const on = (d: string) => occs.filter((o) => o.date === d);
  const active = state.programs.find((p) => p.id === state.activeProgramId);
  const shift = (n: number) => {
    if (mode === 'week') setAnchor(addDays(anchor, 7 * n));
    else { const d = parse(monthFirst); d.setMonth(d.getMonth() + n); setAnchor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`); }
  };
  const tplOf = (id: string) => state.templates.find((t) => t.id === id);

  return (
    <div>
      <button className="card row" style={{ width: '100%', textAlign: 'left' }} onClick={() => setProgSheet(true)}>
        <div className="grow">
          <div className="tiny muted" style={{ fontWeight: 700, textTransform: 'uppercase' }}>Active program</div>
          <div className="card-title">{active?.name ?? 'None'}{active?.paused && <span className="chip" style={{ height: 22, fontSize: 11, background: 'rgba(255,159,10,.18)', color: 'var(--orange)' }}>Paused</span>}</div>
        </div>
        <span className="link">Manage</span>
      </button>

      <div className="row between" style={{ margin: '4px 0 10px' }}>
        <div className="row">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous"><Icon name="left" size={18} /></button>
          <b>{mode === 'week' ? `${fmtDate(days[0])} – ${fmtDate(days[6])}` : `${MONTHS_LONG[parse(monthFirst).getMonth()]} ${parse(monthFirst).getFullYear()}`}</b>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Next"><Icon name="right" size={18} /></button>
        </div>
        <div className="chips">
          <button className={`chip ${mode === 'week' ? 'active' : ''}`} onClick={() => setMode('week')}>Week</button>
          <button className={`chip ${mode === 'month' ? 'active' : ''}`} onClick={() => setMode('month')}>Month</button>
        </div>
      </div>

      {state.templates.length === 0 && (
        <div className="banner"><Icon name="info" size={18} /><div className="grow small">Create a workout first in the Workouts tab, then schedule it here.</div></div>
      )}

      {mode === 'week' ? (
        <div className="card tight">
          {days.map((d) => (
            <div key={d} className="cal-day">
              <div className={`cal-date ${d === today() ? 'today' : ''}`}><div className="wd">{WD_SHORT[parse(d).getDay()]}</div><div className="dn">{parse(d).getDate()}</div></div>
              <div className="grow stack" style={{ minWidth: 0 }}>
                {on(d).map((o) => <OccPill key={o.key} o={o} tpl={tplOf(o.templateId)} onClick={() => setOcc(o)} />)}
                {!on(d).length && <div className="small muted" style={{ paddingTop: 10 }}>—</div>}
              </div>
              <button className="icon-btn" onClick={() => setAddFor(d)} aria-label={`Add workout on ${fmtDate(d)}`}><Icon name="plus" size={18} /></button>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="month">
            {days.slice(0, 7).map((d) => <div key={d} className="mh">{WD_SHORT[parse(d).getDay()]}</div>)}
            {days.map((d) => (
              <button key={d} className={`mc ${d.slice(0, 7) !== monthFirst.slice(0, 7) ? 'out' : ''} ${d === today() ? 'today' : ''}`} onClick={() => { setAnchor(d); setMode('week'); }}>
                <span className="d">{parse(d).getDate()}</span>
                <span className="mdots">{on(d).map((o) => <i key={o.key} style={{ background: o.templateId === 'rest' ? '#636366' : TYPE_COLOR[tplOf(o.templateId)?.type ?? 'custom'], opacity: o.status === 'skipped' ? .3 : 1 }} />)}</span>
              </button>
            ))}
          </div>
          <div className="small muted center" style={{ marginTop: 8 }}>Tap a day to open its week.</div>
        </>
      )}

      {addFor && <ScheduleSheet date={addFor} onClose={() => setAddFor(null)} />}
      {occ && <OccurrenceSheet o={occ} onClose={() => setOcc(null)} />}
      {progSheet && <ProgramsSheet onClose={() => setProgSheet(false)} />}
    </div>
  );
}

function OccPill({ o, tpl, onClick }: { o: Occurrence; tpl?: WorkoutTemplate; onClick: () => void }) {
  if (o.templateId === 'rest') return <button className={`wk-pill ${o.status}`} onClick={onClick}><span className="bar-l" style={{ background: '#636366' }} /><span className="wk-name">Rest day</span></button>;
  return (
    <button className={`wk-pill ${o.status}`} onClick={onClick}>
      <span className="bar-l" style={{ background: TYPE_COLOR[tpl?.type ?? 'custom'] }} />
      <span className="grow" style={{ minWidth: 0 }}>
        <div className="wk-name ellipsis">{tpl?.name ?? 'Deleted workout'}</div>
        <div className="tiny muted">{tpl ? typeName(tpl) : ''}{o.originalDate !== o.date ? ` · moved from ${fmtDate(o.originalDate)}` : ''}</div>
      </span>
    </button>
  );
}

function ScheduleSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const state = useApp((s) => s);
  const [templateId, setTemplateId] = useState(state.templates[0]?.id ?? 'rest');
  const [kind, setKind] = useState<'once' | 'weekly'>('once');
  const [weekdays, setWeekdays] = useState<number[]>([parse(date).getDay()]);
  const [every, setEvery] = useState(1);
  const [end, setEnd] = useState('');
  const [programId, setProgramId] = useState(state.activeProgramId ?? '');
  const save = () => {
    const e: Omit<ScheduleEntry, 'id'> = kind === 'once'
      ? { templateId, kind, date, startDate: date, programId: programId || undefined }
      : { templateId, kind, weekdays, everyWeeks: every, startDate: date, endDate: end || undefined, programId: programId || undefined };
    update((d) => { A.addScheduleEntry(d, e); }, 'Added to calendar');
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={`Schedule · ${fmtDate(date, { weekday: true })}`}>
      <Field label="Workout">
        <select className="select" value={templateId} onChange={(e) => setTemplateId(e.target.value)} aria-label="Workout">
          {state.templates.filter((t) => !t.archived).map((t) => <option key={t.id} value={t.id}>{t.name} · {typeName(t)}</option>)}
          <option value="rest">Rest day</option>
        </select>
      </Field>
      <Field group label="Repeat">
        <div className="chips">
          <button className={`chip ${kind === 'once' ? 'active' : ''}`} onClick={() => setKind('once')}>Just this day</button>
          <button className={`chip ${kind === 'weekly' ? 'active' : ''}`} onClick={() => setKind('weekly')}>Weekly</button>
        </div>
      </Field>
      {kind === 'weekly' && (
        <>
          <Field group label="On days">
            <div className="chips" style={{ flexWrap: 'wrap' }}>
              {WD_SHORT.map((w, i) => <button key={w} className={`chip ${weekdays.includes(i) ? 'active' : ''}`} onClick={() => setWeekdays(weekdays.includes(i) ? weekdays.filter((x) => x !== i) : [...weekdays, i])}>{w}</button>)}
            </div>
          </Field>
          <div className="grid2">
            <Field label="Every">
              <select className="select" value={every} onChange={(e) => setEvery(+e.target.value)}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n === 1 ? 'week' : `${n} weeks`}</option>)}</select>
            </Field>
            <Field label="Until (optional)"><input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          </div>
        </>
      )}
      <Field label="Program">
        <select className="select" value={programId} onChange={(e) => setProgramId(e.target.value)}>
          <option value="">No program (always shown)</option>
          {state.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <button className="btn block" disabled={kind === 'weekly' && !weekdays.length} onClick={save}>Add to calendar</button>
    </Sheet>
  );
}

function OccurrenceSheet({ o, onClose }: { o: Occurrence; onClose: () => void }) {
  const state = useApp((s) => s);
  const entry = state.scheduleEntries.find((e) => e.id === o.entryId);
  const tpl = state.templates.find((t) => t.id === o.templateId);
  const [moveTo, setMoveTo] = useState(o.date);
  const { ask, node } = useConfirm();
  const inProg = state.sessions.find((s) => s.occurrenceKey === o.key);
  return (
    <Sheet open onClose={onClose} title={o.templateId === 'rest' ? 'Rest day' : tpl?.name ?? 'Workout'}>
      <div className="muted small" style={{ marginBottom: 12 }}>
        {relDay(o.date)} · {entry?.kind === 'weekly' ? `Repeats ${entry.weekdays!.map((w) => WD_SHORT[w]).join(', ')}${(entry.everyWeeks ?? 1) > 1 ? ` every ${entry.everyWeeks} weeks` : ''}` : 'One time'}
      </div>
      {o.templateId !== 'rest' && tpl && o.status !== 'skipped' && (
        <button className="btn green block" onClick={() => {
          let id = '';
          update((d) => { id = A.startSession(d, o.templateId, o.date, o.key); });
          onClose(); setUI({ sessionId: id });
        }}>{o.status === 'done' ? 'View log' : inProg ? 'Continue workout' : 'Start workout'}</button>
      )}
      <div className="cat-head">Reschedule</div>
      <div className="row">
        <input className="input grow" type="date" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} aria-label="Move to date" />
        <button className="btn secondary" disabled={!moveTo || moveTo === o.date} onClick={() => { update((d) => A.moveOccurrence(d, o.key, moveTo), `Moved to ${fmtDate(moveTo)}`); onClose(); }}>Move</button>
      </div>
      <div className="grid2" style={{ marginTop: 12 }}>
        <button className="btn secondary" onClick={() => { update((d) => A.moveOccurrence(d, o.key, addDays(o.date, 1)), 'Moved to next day'); onClose(); }}>Push 1 day</button>
        {o.status === 'skipped'
          ? <button className="btn secondary" onClick={() => { update((d) => A.skipOccurrence(d, o.key, false), 'Restored'); onClose(); }}>Unskip</button>
          : <button className="btn secondary" onClick={() => { update((d) => A.skipOccurrence(d, o.key, true), 'Skipped'); onClose(); }}>Skip this one</button>}
      </div>
      <div className="cat-head">Series</div>
      {entry?.kind === 'weekly' && (
        <button className="btn secondary block" style={{ marginBottom: 10 }} onClick={() => { update((d) => A.endScheduleEntry(d, entry.id, addDays(o.date, -1)), 'Stopped repeating from this day'); onClose(); }}>Stop repeating from this day</button>
      )}
      <button className="btn danger block" onClick={async () => {
        if (await ask(entry?.kind === 'weekly' ? 'Remove every occurrence of this repeating workout? Completed logs are kept.' : 'Remove this workout from the calendar? Completed logs are kept.')) {
          update((d) => A.removeScheduleEntry(d, o.entryId), 'Removed from calendar'); onClose();
        }
      }}>{entry?.kind === 'weekly' ? 'Delete whole series' : 'Remove from calendar'}</button>
      {node}
    </Sheet>
  );
}

function ProgramsSheet({ onClose }: { onClose: () => void }) {
  const state = useApp((s) => s);
  const [name, setName] = useState('');
  return (
    <Sheet open onClose={onClose} title="Programs">
      <p className="small muted" style={{ marginTop: 0 }}>Only the active program’s scheduled workouts show on the calendar. Pause a program to hide it without deleting anything.</p>
      <div className="list">
        {state.programs.map((p) => (
          <div key={p.id} className="list-row">
            <button className={`check ${state.activeProgramId === p.id ? 'on' : ''}`} onClick={() => update((d) => { d.activeProgramId = p.id; }, `Switched to ${p.name}`)} aria-label={`Activate ${p.name}`}><Icon name="check" size={15} color="var(--check-ink)" /></button>
            <input className="input sm grow" value={p.name} onChange={(e) => update((d) => { d.programs.find((x) => x.id === p.id)!.name = e.target.value; })} aria-label="Program name" />
            <span className="tiny muted">Paused</span>
            <Switch on={p.paused} onChange={(v) => update((d) => { d.programs.find((x) => x.id === p.id)!.paused = v; }, v ? `Paused ${p.name}` : `Resumed ${p.name}`)} label="Pause" />
          </div>
        ))}
      </div>
      <div className="row">
        <input className="input grow" placeholder="New program name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn" disabled={!name.trim()} onClick={() => { update((d) => { d.programs.push({ id: newId('prog'), name: name.trim(), paused: false }); }); setName(''); }}>Add</button>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- Workouts (templates)
function WorkoutsView() {
  const state = useApp((s) => s);
  const [edit, setEdit] = useState<WorkoutTemplate | null>(null);
  const [quick, setQuick] = useState(false);
  const blank = (): WorkoutTemplate => ({ id: '', name: '', type: 'strength', exercises: [], color: TYPE_COLOR.strength, programId: state.activeProgramId });
  const list = state.templates.filter((t) => !t.archived);
  return (
    <div>
      <div className="grid2" style={{ marginBottom: 12 }}>
        <button className="btn" onClick={() => setEdit(blank())}><Icon name="plus" size={18} />New workout</button>
        <button className="btn secondary" onClick={() => setQuick(true)}>Log without plan</button>
      </div>
      {!list.length && <div className="card"><Empty icon="🏋️" title="No workouts yet">Build your own lifting, running, interval, recovery or mobility workouts. Nothing is preloaded.</Empty></div>}
      {list.map((t) => (
        <button key={t.id} className="card" style={{ width: '100%', textAlign: 'left', display: 'block' }} onClick={() => setEdit(structuredClone(t))}>
          <div className="row">
            <div style={{ width: 6, alignSelf: 'stretch', borderRadius: 3, background: TYPE_COLOR[t.type] }} />
            <div className="grow">
              <div className="card-title">{t.name}</div>
              <div className="small muted">{typeName(t)}{t.programId ? ` · ${state.programs.find((p) => p.id === t.programId)?.name ?? ''}` : ''}</div>
              {t.exercises.length > 0 && <div className="small" style={{ marginTop: 6 }}>{t.exercises.map((e) => e.name).join(' · ')}</div>}
              {t.run && <div className="small" style={{ marginTop: 6 }}>{t.run.runType} run{t.run.distance ? ` · ${kmTo(state.prefs.distanceUnit, t.run.distance).toFixed(2)} ${state.prefs.distanceUnit}` : ''}{t.run.segments.length ? ` · ${t.run.segments.length} interval block${t.run.segments.length > 1 ? 's' : ''}` : ''}</div>}
            </div>
            <span className="chev">›</span>
          </div>
        </button>
      ))}
      {edit && <TemplateBuilder initial={edit} onClose={() => setEdit(null)} />}
      {quick && <QuickLogSheet onClose={() => setQuick(false)} />}
    </div>
  );
}

const TYPES: WorkoutType[] = ['strength', 'hypertrophy', 'run-outdoor', 'run-treadmill', 'intervals', 'recovery', 'mobility', 'custom'];
const RUN_TYPES: RunType[] = ['easy', 'long', 'tempo', 'intervals', 'recovery', 'race', 'other'];

export function TemplateBuilder({ initial, onClose }: { initial: WorkoutTemplate; onClose: () => void }) {
  const state = useApp((s) => s);
  const unit = state.prefs.distanceUnit;
  const [t, setT] = useState<WorkoutTemplate>(initial);
  const [exName, setExName] = useState('');
  const { ask, node } = useConfirm();
  const isNew = !initial.id;
  const set = (p: Partial<WorkoutTemplate>) => setT((x) => ({ ...x, ...p }));
  const setEx = (i: number, p: Partial<WorkoutTemplate['exercises'][number]>) => setT((x) => ({ ...x, exercises: x.exercises.map((e, k) => (k === i ? { ...e, ...p } : e)) }));
  const run = t.run ?? { runType: t.type === 'intervals' ? 'intervals' : 'easy', environment: t.type === 'run-treadmill' ? 'treadmill' : 'outdoor', segments: [] };
  const setRun = (p: Partial<NonNullable<WorkoutTemplate['run']>>) => set({ run: { ...run, ...p } as NonNullable<WorkoutTemplate['run']> });
  const setSeg = (i: number, p: Partial<IntervalSegment>) => setRun({ segments: run.segments.map((s, k) => (k === i ? { ...s, ...p } : s)) });
  const known = Array.from(new Set(completedSessions(state).flatMap((s) => s.exercises.map((e) => e.name)).concat(state.templates.flatMap((x) => x.exercises.map((e) => e.name)))));

  const addEx = () => {
    if (!exName.trim()) return;
    set({ exercises: [...t.exercises, A.newExercise(exName.trim(), 3, '8-10', 90)] });
    setExName('');
  };
  const save = () => {
    const out: WorkoutTemplate = { ...t, name: t.name.trim() || TYPE_LABEL[t.type], color: TYPE_COLOR[t.type], run: isRunType(t.type) ? run as WorkoutTemplate['run'] : t.run };
    update((d) => { if (isNew) A.createTemplate(d, out); else A.updateTemplate(d, out); }, isNew ? 'Workout created' : 'Workout saved');
    onClose();
  };
  const showRun = isRunType(t.type) || !!t.run;
  // Don't lose a half-built workout to a stray tap on Close.
  const dirty = JSON.stringify(t) !== JSON.stringify(initial) || !!exName.trim();
  const tryClose = async () => { if (!dirty || await ask('Discard your changes to this workout?')) onClose(); };
  return (
    <Sheet open onClose={tryClose} title={isNew ? 'New workout' : 'Edit workout'} full right={<button className="btn sm" onClick={save}>Save</button>}>
      <Field label="Name"><input className="input" value={t.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Upper A, Long run" aria-label="Workout name" /></Field>
      <Field group label="Type">
        <div className="chips" style={{ flexWrap: 'wrap' }}>
          {TYPES.map((ty) => <button key={ty} className={`chip ${t.type === ty ? 'active' : ''}`} onClick={() => set({ type: ty })}>{TYPE_LABEL[ty]}</button>)}
        </div>
      </Field>
      {t.type === 'custom' && <Field label="Custom type name"><input className="input" value={t.customType ?? ''} onChange={(e) => set({ customType: e.target.value })} placeholder="e.g. Yoga, Sports" /></Field>}
      <Field label="Program">
        <select className="select" value={t.programId ?? ''} onChange={(e) => set({ programId: e.target.value || undefined })}>
          <option value="">None</option>
          {state.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>

      {showRun && (
        <>
          <div className="cat-head">Run plan</div>
          <div className="grid2">
            <Field label="Run type">
              <select className="select" value={run.runType} onChange={(e) => setRun({ runType: e.target.value as RunType })}>{RUN_TYPES.map((r) => <option key={r}>{r}</option>)}</select>
            </Field>
            <Field label="Where">
              <select className="select" value={run.environment} onChange={(e) => setRun({ environment: e.target.value as 'outdoor' | 'treadmill' })}><option value="outdoor">Outdoor</option><option value="treadmill">Treadmill</option></select>
            </Field>
            <Field label={`Distance (${unit})`}><NumInput value={run.distance != null ? +kmTo(unit, run.distance).toFixed(2) : null} onChange={(v) => setRun({ distance: v == null ? undefined : toKm(unit, v) })} /></Field>
            <Field label="Duration (min)"><NumInput value={run.durationMin} onChange={(v) => setRun({ durationMin: v ?? undefined })} /></Field>
            {run.environment === 'treadmill' && <Field label="Incline (%)"><NumInput value={run.incline} onChange={(v) => setRun({ incline: v ?? undefined })} /></Field>}
          </div>
          <div className="cat-head">Interval segments</div>
          {run.segments.map((s, i) => (
            <div key={s.id} className="card">
              <div className="row between" style={{ marginBottom: 8 }}>
                <input className="input sm grow" value={s.label} onChange={(e) => setSeg(i, { label: e.target.value })} aria-label="Segment label" />
                <button className="icon-btn" onClick={() => setRun({ segments: run.segments.filter((_, k) => k !== i) })} aria-label="Remove segment"><Icon name="trash" size={16} /></button>
              </div>
              <div className="grid3">
                <Field label="Repeats"><NumInput className="input sm" value={s.repeats} onChange={(v) => setSeg(i, { repeats: v ?? 1 })} /></Field>
                <Field label="Work (sec)"><NumInput className="input sm" value={s.workSec} onChange={(v) => setSeg(i, { workSec: v ?? undefined })} /></Field>
                <Field label={`Work (${unit})`}><NumInput className="input sm" value={s.workDist != null ? +kmTo(unit, s.workDist).toFixed(3) : null} onChange={(v) => setSeg(i, { workDist: v == null ? undefined : toKm(unit, v) })} /></Field>
                <Field label="Recover (sec)"><NumInput className="input sm" value={s.recoverySec} onChange={(v) => setSeg(i, { recoverySec: v ?? undefined })} /></Field>
                <Field label={`Recover (${unit})`}><NumInput className="input sm" value={s.recoveryDist != null ? +kmTo(unit, s.recoveryDist).toFixed(3) : null} onChange={(v) => setSeg(i, { recoveryDist: v == null ? undefined : toKm(unit, v) })} /></Field>
                <Field label="Target / note"><input className="input sm" value={s.note ?? ''} onChange={(e) => setSeg(i, { note: e.target.value })} placeholder="pace, effort" /></Field>
              </div>
            </div>
          ))}
          <button className="btn secondary block" onClick={() => setRun({ segments: [...run.segments, { id: newId('seg'), label: run.segments.length ? `Block ${run.segments.length + 1}` : 'Warm-up', repeats: 1 }] })}><Icon name="plus" size={16} />Add segment</button>
        </>
      )}

      {(!isRunType(t.type) || t.exercises.length > 0) && (
        <>
          <div className="cat-head">Exercises</div>
          {t.exercises.map((e, i) => (
            <div key={e.id} className="card" data-testid="builder-exercise">
              <div className="row" style={{ marginBottom: 8 }}>
                <input className="input sm grow" value={e.name} onChange={(ev) => setEx(i, { name: ev.target.value })} aria-label="Exercise name" style={{ fontWeight: 700 }} />
                <button className="icon-btn" onClick={() => { const ex = [...t.exercises]; A.moveInArray(ex, i, -1); set({ exercises: ex }); }} aria-label="Move up"><Icon name="up" size={16} /></button>
                <button className="icon-btn" onClick={() => { const ex = [...t.exercises]; A.moveInArray(ex, i, 1); set({ exercises: ex }); }} aria-label="Move down"><Icon name="down" size={16} /></button>
                <button className="icon-btn" onClick={() => set({ exercises: t.exercises.filter((_, k) => k !== i) })} aria-label={`Remove ${e.name}`}><Icon name="trash" size={16} /></button>
              </div>
              <div className="grid4">
                <Field label="Sets"><NumInput className="input sm" value={e.sets} onChange={(v) => setEx(i, { sets: Math.max(1, Math.round(v ?? 1)) })} inputMode="numeric" ariaLabel="Sets" /></Field>
                <Field label="Reps"><input className="input sm" value={e.reps} onChange={(ev) => setEx(i, { reps: ev.target.value })} placeholder="8-10" aria-label="Reps" /></Field>
                <Field label="Weight"><NumInput className="input sm" value={e.weight} onChange={(v) => setEx(i, { weight: v ?? undefined })} placeholder="lb" ariaLabel="Weight" /></Field>
                <Field label="Rest s"><NumInput className="input sm" value={e.restSec} onChange={(v) => setEx(i, { restSec: v ?? 0 })} inputMode="numeric" ariaLabel="Rest seconds" /></Field>
              </div>
              <input className="input sm" value={e.notes ?? ''} onChange={(ev) => setEx(i, { notes: ev.target.value })} placeholder="Notes (tempo, cues, setup)" aria-label="Exercise notes" />
            </div>
          ))}
          <div className="row">
            <input className="input grow" list="known-ex" value={exName} onChange={(e) => setExName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addEx()} placeholder={isLiftType(t.type) ? 'Add exercise (e.g. Bench Press)' : 'Add exercise / drill'} aria-label="New exercise" />
            <datalist id="known-ex">{known.map((k) => <option key={k} value={k} />)}</datalist>
            <button className="btn" onClick={addEx} disabled={!exName.trim()}>Add</button>
          </div>
        </>
      )}
      <Field label="Workout notes"><textarea className="input" value={t.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} style={{ marginTop: 12 }} /></Field>
      <button className="btn block" onClick={save}>Save workout</button>
      {!isNew && (
        <div className="grid2" style={{ marginTop: 12 }}>
          <button className="btn secondary" onClick={() => { update((d) => { A.duplicateTemplate(d, t.id); }, 'Duplicated'); onClose(); }}><Icon name="copy" size={16} />Duplicate</button>
          <button className="btn danger" onClick={async () => { if (await ask('Delete this workout and remove it from the calendar? Your completed logs stay in history.')) { update((d) => A.deleteTemplate(d, t.id), 'Workout deleted'); onClose(); } }}>Delete</button>
        </div>
      )}
      {node}
    </Sheet>
  );
}

function QuickLogSheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<WorkoutType>('strength');
  const [date, setDate] = useState(today());
  return (
    <Sheet open onClose={onClose} title="Log a workout">
      <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Easy run" /></Field>
      <Field group label="Type"><div className="chips" style={{ flexWrap: 'wrap' }}>{TYPES.map((ty) => <button key={ty} className={`chip ${type === ty ? 'active' : ''}`} onClick={() => setType(ty)}>{TYPE_LABEL[ty]}</button>)}</div></Field>
      <Field label="Date"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <button className="btn block" onClick={() => { let id = ''; update((d) => { id = A.startBlankSession(d, date, name.trim() || TYPE_LABEL[type], type); }); onClose(); setUI({ sessionId: id }); }}>Start logging</button>
    </Sheet>
  );
}

// ---------------------------------------------------------------- History
function HistoryView() {
  const state = useApp((s) => s);
  const unit = state.prefs.distanceUnit;
  const sessions = [...state.sessions].sort((a, b) => b.date.localeCompare(a.date) || b.startedAt.localeCompare(a.startedAt));
  if (!sessions.length) return <div className="card"><Empty icon="📈" title="No workouts logged yet">Start a scheduled workout or tap “Log without plan”.</Empty></div>;
  return (
    <div className="list">
      {sessions.map((s) => {
        const pace = s.run ? paceSecPerUnit(s.run, unit) : null;
        return (
          <button key={s.id} className="list-row" onClick={() => setUI({ sessionId: s.id })}>
            <div style={{ width: 6, alignSelf: 'stretch', borderRadius: 3, background: TYPE_COLOR[s.type] }} />
            <div className="grow">
              <div className="food-name">{s.name} {s.status === 'in-progress' && <span className="badge estimate">In progress</span>}</div>
              <div className="food-sub">{relDay(s.date)} · {typeName(s)}</div>
              <div className="food-sub num">
                {s.exercises.length > 0 && `${s.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0)} sets · ${r0(sessionVolume(s)).toLocaleString()} lb volume`}
                {s.run?.distanceKm ? `${s.exercises.length ? ' · ' : ''}${kmTo(unit, s.run.distanceKm).toFixed(2)} ${unit} · ${fmtDuration(s.run.durationSec)}${pace ? ` · ${fmtDuration(pace)}/${unit}` : ''}` : ''}
              </div>
            </div>
            <span className="chev">›</span>
          </button>
        );
      })}
    </div>
  );
}
