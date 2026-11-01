import { useEffect, useState } from 'react';
import type { RunType, SessionExercise, WorkoutSession } from '../lib/types';
import { useApp, update } from '../lib/store';
import * as A from '../lib/actions';
import { fmtDuration, parseDuration, relDay } from '../lib/date';
import { exerciseHistory, isWeightPR, paceSecPerUnit, runSessions, sessionVolume, speedPerHour, typeName, isRunType } from '../lib/training';
import { kmTo, toKm } from '../lib/units';
import { r0 } from '../lib/nutrition';
import { Check, Field, Icon, NumInput, Sheet, useConfirm } from '../components/ui';

export default function SessionLogger({ id, onClose }: { id: string; onClose: () => void }) {
  const state = useApp((s) => s);
  const s = state.sessions.find((x) => x.id === id);
  const [rest, setRest] = useState<{ end: number; total: number } | null>(null);
  const [exName, setExName] = useState('');
  const { ask, node } = useConfirm();
  if (!s) return null;
  const done = s.status === 'completed';
  const mut = (fn: (x: WorkoutSession) => void) => update((d) => { const x = d.sessions.find((y) => y.id === id); if (x) fn(x); });

  return (
    <Sheet open onClose={onClose} full title={s.name}
      right={done ? <span className="chip" style={{ background: 'rgba(48,209,88,.16)', color: 'var(--green)' }}>Done</span> : <button className="btn sm green" onClick={() => { update((d) => A.finishSession(d, id), 'Workout saved'); onClose(); }}>Finish</button>}>
      <div className="small muted" style={{ marginBottom: 12 }}>{relDay(s.date)} · {typeName(s)}{s.exercises.length ? ` · ${r0(sessionVolume(s)).toLocaleString()} lb volume` : ''}</div>

      {s.run && <RunLogger s={s} mut={mut} />}

      {s.exercises.map((ex) => (
        <ExerciseCard key={ex.id} s={s} ex={ex} onSetDone={(sec) => sec > 0 && setRest({ end: Date.now() + sec * 1000, total: sec })} />
      ))}

      {!isRunType(s.type) || s.exercises.length > 0 ? (
        <div className="row" style={{ marginBottom: 12 }}>
          <input className="input grow" value={exName} onChange={(e) => setExName(e.target.value)} placeholder="Add exercise" aria-label="Add exercise to session" />
          <button className="btn" disabled={!exName.trim()} onClick={() => { update((d) => A.addSessionExercise(d, id, exName.trim())); setExName(''); }}>Add</button>
        </div>
      ) : (
        <button className="btn secondary block" style={{ marginBottom: 12 }} onClick={() => update((d) => A.addSessionExercise(d, id, 'Strides', 1, '6'))}>+ Add drills / exercises</button>
      )}

      <Field label="Session notes"><textarea className="input" value={s.notes ?? ''} onChange={(e) => mut((x) => { x.notes = e.target.value; })} placeholder="How did it feel?" /></Field>
      {!done
        ? <button className="btn green block" onClick={() => { update((d) => A.finishSession(d, id), 'Workout saved'); onClose(); }}>Finish workout</button>
        : <button className="btn secondary block" onClick={onClose}>Done editing</button>}
      <button className="btn danger block" style={{ marginTop: 10 }} onClick={async () => { if (await ask('Delete this workout log? This cannot be undone.')) { update((d) => A.deleteSession(d, id)); onClose(); } }}>Delete log</button>
      {rest && <RestTimer rest={rest} onDone={() => setRest(null)} onAdd={(n) => setRest({ end: rest.end + n * 1000, total: rest.total + n })} />}
      {node}
    </Sheet>
  );
}

function ExerciseCard({ s, ex, onSetDone }: { s: WorkoutSession; ex: SessionExercise; onSetDone: (restSec: number) => void }) {
  const state = useApp((x) => x);
  const hist = exerciseHistory(state, ex.name, s.id).filter((h) => h.date <= s.date);
  const prev = hist[hist.length - 1];
  const best = hist.length ? Math.max(...hist.map((h) => h.topWeight)) : 0;
  const allDone = ex.sets.length > 0 && ex.sets.every((x) => x.done);
  return (
    <div className="card" data-testid="session-exercise">
      <div className="row between" style={{ marginBottom: 4 }}>
        <div className="card-title">{ex.name}</div>
        {allDone && <span className="badge label">Complete</span>}
      </div>
      <div className="small muted">
        Plan: {ex.planned.sets} × {ex.planned.reps}{ex.planned.weight ? ` @ ${ex.planned.weight} lb` : ''} · rest {fmtDuration(ex.planned.restSec)}
      </div>
      <div className="small muted" style={{ marginBottom: 10 }}>
        {prev ? <>Last ({relDay(prev.date)}): {prev.sets.map((x) => `${x.weight}×${x.reps}`).join(', ')}{best ? ` · Best ${best} lb` : ''}</> : 'No previous log for this exercise'}
      </div>
      {ex.notes && <div className="small" style={{ marginBottom: 8 }}>📝 {ex.notes}</div>}
      <div className="set-grid" style={{ marginBottom: 6 }}>
        <div className="h">Set</div><div className="h">Prev</div><div className="h">lb</div><div className="h">Reps</div><div className="h">✓</div>
      </div>
      {ex.sets.map((st, i) => {
        const pv = prev?.sets[i];
        const pr = st.done && isWeightPR(state, ex.name, st.weight, s.id);
        return (
          <div key={st.id} className={`set-grid ${st.done ? 'set-row-done' : ''}`} style={{ marginBottom: 6 }}>
            <div className="set-num">{i + 1}</div>
            <div className="prev">{pv ? `${pv.weight}×${pv.reps}` : '–'}{pr && <div className="badge label" style={{ marginTop: 2 }}>PR</div>}</div>
            <NumInput className="input" value={st.weight} onChange={(v) => update((d) => A.updateSet(d, s.id, ex.id, st.id, { weight: v }))} ariaLabel={`${ex.name} set ${i + 1} weight`} />
            <NumInput className="input" value={st.reps} onChange={(v) => update((d) => A.updateSet(d, s.id, ex.id, st.id, { reps: v == null ? null : Math.round(v) }))} inputMode="numeric" ariaLabel={`${ex.name} set ${i + 1} reps`} />
            <Check on={st.done} onClick={() => { update((d) => A.updateSet(d, s.id, ex.id, st.id, { done: !st.done })); if (!st.done) onSetDone(ex.planned.restSec); }} label={`Complete ${ex.name} set ${i + 1}`} />
          </div>
        );
      })}
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn ghost sm" onClick={() => update((d) => A.addSet(d, s.id, ex.id))}><Icon name="plus" size={16} />Add set</button>
        {ex.sets.length > 0 && <button className="btn ghost sm" style={{ color: 'var(--sub)' }} onClick={() => update((d) => A.removeSet(d, s.id, ex.id, ex.sets[ex.sets.length - 1].id))}>Remove last</button>}
        <div className="grow" />
        <button className="btn ghost sm" style={{ color: 'var(--red)' }} onClick={() => update((d) => { const x = d.sessions.find((y) => y.id === s.id)!; x.exercises = x.exercises.filter((e) => e.id !== ex.id); }, `Removed ${ex.name}`)}>Remove</button>
      </div>
      <input className="input sm" style={{ marginTop: 6 }} value={ex.notes ?? ''} placeholder="Notes" aria-label={`${ex.name} notes`}
        onChange={(e) => update((d) => { const x = d.sessions.find((y) => y.id === s.id)!.exercises.find((y) => y.id === ex.id)!; x.notes = e.target.value; })} />
    </div>
  );
}

function RunLogger({ s, mut }: { s: WorkoutSession; mut: (fn: (x: WorkoutSession) => void) => void }) {
  const state = useApp((x) => x);
  const unit = state.prefs.distanceUnit;
  const run = s.run!;
  const [dur, setDur] = useState(run.durationSec ? fmtDuration(run.durationSec) : '');
  const pace = paceSecPerUnit(run, unit);
  const speed = speedPerHour(run, unit);
  const prev = runSessions(state).filter((x) => x.id !== s.id && x.run!.runType === run.runType && x.date <= s.date).pop();
  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 10 }}><Icon name="run" size={20} />Run</div>
      <div className="grid2">
        <Field label="Run type">
          <select className="select" value={run.runType} onChange={(e) => mut((x) => { x.run!.runType = e.target.value as RunType; })}>
            {['easy', 'long', 'tempo', 'intervals', 'recovery', 'race', 'other'].map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Where">
          <select className="select" value={run.environment} onChange={(e) => mut((x) => { x.run!.environment = e.target.value as 'outdoor' | 'treadmill'; })}>
            <option value="outdoor">Outdoor</option><option value="treadmill">Treadmill</option>
          </select>
        </Field>
        <Field label={`Distance (${unit})`}>
          <NumInput value={run.distanceKm != null ? +kmTo(unit, run.distanceKm).toFixed(2) : null} onChange={(v) => mut((x) => { x.run!.distanceKm = v == null ? null : toKm(unit, v); })} ariaLabel="Distance" />
        </Field>
        <Field label="Time (h:mm:ss or mm:ss)">
          <input className="input" inputMode="numeric" value={dur} placeholder="mm:ss" aria-label="Duration"
            onChange={(e) => { setDur(e.target.value); const sec = parseDuration(e.target.value); mut((x) => { x.run!.durationSec = sec; }); }} />
        </Field>
        {run.environment === 'treadmill' && <Field label="Incline (%)"><NumInput value={run.incline} onChange={(v) => mut((x) => { x.run!.incline = v; })} ariaLabel="Incline" /></Field>}
        <Field label="Effort (RPE 1–10)"><NumInput value={run.rpe} onChange={(v) => mut((x) => { x.run!.rpe = v == null ? null : Math.max(1, Math.min(10, Math.round(v))); })} inputMode="numeric" ariaLabel="RPE" /></Field>
      </div>
      <div className="tiles">
        <div className="tile"><div className="k">Pace</div><div className="v num" data-testid="run-pace">{pace ? fmtDuration(pace) : '–'}<small>/{unit}</small></div></div>
        <div className="tile"><div className="k">Speed</div><div className="v num">{speed ? speed.toFixed(1) : '–'}<small> {unit}/h</small></div></div>
        <div className="tile"><div className="k">Prev {run.runType}</div><div className="v num" style={{ fontSize: 15 }}>{prev ? `${kmTo(unit, prev.run!.distanceKm!).toFixed(1)} ${unit}` : '–'}<small>{prev && paceSecPerUnit(prev.run!, unit) ? ` ${fmtDuration(paceSecPerUnit(prev.run!, unit))}` : ''}</small></div></div>
      </div>
      {run.segments.length > 0 && (
        <>
          <div className="cat-head">Intervals</div>
          {run.segments.map((seg, i) => (
            <div key={seg.id} className="row" style={{ padding: '6px 0' }}>
              <Check on={seg.done} onClick={() => mut((x) => { x.run!.segments[i].done = !seg.done; })} label={`Segment ${seg.label}`} />
              <div className="grow small">
                <b>{seg.repeats > 1 ? `${seg.repeats} × ` : ''}{seg.label}</b>
                <div className="muted">
                  {[seg.workSec ? `work ${fmtDuration(seg.workSec)}` : '', seg.workDist ? `work ${kmTo(unit, seg.workDist).toFixed(2)} ${unit}` : '',
                    seg.recoverySec ? `recover ${fmtDuration(seg.recoverySec)}` : '', seg.recoveryDist ? `recover ${kmTo(unit, seg.recoveryDist).toFixed(2)} ${unit}` : '', seg.note ?? ''].filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function RestTimer({ rest, onDone, onAdd }: { rest: { end: number; total: number }; onDone: () => void; onAdd: (n: number) => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  const left = Math.max(0, Math.round((rest.end - now) / 1000));
  useEffect(() => {
    if (left === 0) {
      try { navigator.vibrate?.(200); } catch { /* not supported */ }
      const t = setTimeout(onDone, 1500);
      return () => clearTimeout(t);
    }
  }, [left, onDone]);
  return (
    <div className="rest-timer" role="timer" aria-label="Rest timer">
      <span className="small muted">Rest</span>
      <span className="t">{left === 0 ? 'Go!' : fmtDuration(left)}</span>
      <button className="btn secondary sm" onClick={() => onAdd(15)}>+15s</button>
      <button className="btn sm" onClick={onDone}>Skip</button>
    </div>
  );
}
