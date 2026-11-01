import { useState } from 'react';
import { useApp, update } from '../lib/store';
import * as A from '../lib/actions';
import { calorieSuggestion, rollingAverage, sortedWeights, weeklyRate } from '../lib/progress';
import { addDays, diffDays, fmtDate, fmtDuration, parse, range, today, WD_SHORT } from '../lib/date';
import { dayTotals, r0 } from '../lib/nutrition';
import { exerciseHistory, paceSecPerUnit, personalRecords, runSessions, weeklyConsistency, completedSessions } from '../lib/training';
import { kmTo } from '../lib/units';
import { BarChart, Empty, Field, Icon, LineChart, NumInput, Sheet, useConfirm } from '../components/ui';

export default function Progress() {
  const p = useApp((s) => s.profile);
  const needsSetup = !p.startWeight || !p.goalWeight;
  return (
    <div>
      <div className="screen-head"><div><h1 className="large-title">Progress</h1><div className="subtitle">{needsSetup ? 'Set your goal to begin' : `Toward ${p.goalWeight} lb`}</div></div></div>
      {needsSetup ? <SetupCard /> : <WeightSection />}
      <NutritionSection />
      <StrengthSection />
      <RunningSection />
      <ConsistencySection />
    </div>
  );
}

function WeightSection() {
  const state = useApp((s) => s);
  const [lb, setLb] = useState<number | null>(null);
  const [date, setDate] = useState(today());
  const [all, setAll] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const { ask, node } = useConfirm();
  const ws = sortedWeights(state.weights);
  const p = state.profile;
  const current = ws.length ? ws[ws.length - 1].lb : p.startWeight;
  const ra = rollingAverage(ws);
  const avg = ra.length ? ra[ra.length - 1].avg : null;
  const rate = weeklyRate(ws);
  const gained = current - p.startWeight;
  const togo = p.goalWeight - current;
  const span = p.goalWeight - p.startWeight;
  const pct = span ? Math.max(0, Math.min(1, gained / span)) : 0;
  const sug = calorieSuggestion(ws);
  const x0 = ws.length ? parse(ws[0].date).getTime() : 0;
  const X = (d: string) => (parse(d).getTime() - x0) / 86400000;
  const eta = rate && rate > 0 ? Math.ceil(togo / rate) : null;

  return (
    <>
      <div className="section-title">Body weight</div>
      <div className="card">
        <div className="row between" style={{ alignItems: 'flex-end' }}>
          <div>
            <div className="tiny muted" style={{ fontWeight: 700, textTransform: 'uppercase' }}>Current</div>
            <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em' }} className="num" data-testid="current-weight">{current.toFixed(1)}<span style={{ fontSize: 18, color: 'var(--sub)' }}> lb</span></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="small muted">Goal {p.goalWeight} lb</div>
            <div className="small" style={{ color: gained >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{gained >= 0 ? `+${gained.toFixed(1)} lb gained` : `${Math.abs(gained).toFixed(1)} lb lost`} since start</div>
          </div>
        </div>
        <div className="bar" style={{ height: 10, margin: '12px 0 4px' }}><i style={{ width: `${pct * 100}%`, background: 'linear-gradient(90deg, #30d158, #64d2ff)' }} /></div>
        <div className="row between tiny muted num"><span>Start {p.startWeight} lb</span><span>{togo > 0 ? `${togo.toFixed(1)} lb to go` : 'Goal reached!'}</span></div>
        <div className="tiles" style={{ marginTop: 12 }}>
          <div className="tile"><div className="k">7-day avg</div><div className="v num">{avg ? avg.toFixed(1) : '–'}</div></div>
          <div className="tile"><div className="k">Weekly rate</div><div className="v num" data-testid="weekly-rate">{rate != null ? `${rate >= 0 ? '+' : ''}${rate.toFixed(2)}` : '–'}<small> lb</small></div></div>
          <div className="tile"><div className="k">ETA</div><div className="v num">{eta && eta < 520 ? `${eta}` : '–'}<small> wk</small></div></div>
        </div>
        <div style={{ marginTop: 14 }}>
          <LineChart height={190}
            series={[
              { name: 'Weigh-ins', color: 'rgba(100,210,255,.55)', points: ws.map((w) => ({ x: X(w.date), y: w.lb })), dots: true, width: 1.5 },
              { name: '7-day avg', color: '#30d158', points: ra.map((r) => ({ x: X(r.date), y: r.avg })), width: 3 },
            ]}
            hLines={ws.length ? [{ y: p.goalWeight, color: '#ff9f0a', label: `Goal ${p.goalWeight}` }] : []}
            xLabels={ws.length > 1 ? [ws[0], ws[ws.length - 1]].map((w) => ({ x: X(w.date), label: fmtDate(w.date) })) : undefined}
            yFmt={(v) => v.toFixed(0)} />
          <div className="legend"><span><i style={{ background: '#64d2ff' }} />Morning weigh-in</span><span><i style={{ background: '#30d158' }} />7-day average</span></div>
        </div>
        <div className="hr" />
        <div className="grid2">
          <Field label="Morning weight (lb)"><NumInput value={lb} onChange={setLb} placeholder={current.toFixed(1)} ariaLabel="Morning weight" /></Field>
          <Field label="Date"><input className="input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} aria-label="Weigh-in date" /></Field>
        </div>
        {ws.some((w) => w.date === date) && <div className="tiny muted" style={{ margin: '-4px 4px 8px' }}>You already logged {ws.find((w) => w.date === date)!.lb} lb for {fmtDate(date)}; saving replaces it.</div>}
        <button className="btn block" disabled={!lb || lb < 50 || lb > 500 || date > today()} onClick={() => { update((d) => A.addWeight(d, date, lb!), `Logged ${lb} lb`); setLb(null); }}>Log weight</button>
        {ws.length > 0 && <button className="btn ghost sm" style={{ marginTop: 8, paddingLeft: 0 }} onClick={() => setAll(true)}>All weigh-ins ({ws.length})</button>}
      </div>

      <div className="card" data-testid="calorie-suggestion">
        <div className="card-title" style={{ marginBottom: 6 }}>Calorie check-in</div>
        <div className="small">{sug.reason}</div>
        {sug.ready && sug.delta !== 0 && sug.delta != null && (
          <>
            <div className="small muted" style={{ marginTop: 6 }}>Suggested target: {(state.goals.calories + sug.delta).toLocaleString()} kcal (now {state.goals.calories.toLocaleString()}). Nothing changes unless you approve it.</div>
            <button className="btn secondary sm" style={{ marginTop: 10 }} onClick={() => setApplyOpen(true)}>Review change</button>
          </>
        )}
      </div>

      {all && (
        <Sheet open onClose={() => setAll(false)} title="Weigh-ins">
          <div className="list">
            {[...ws].reverse().map((w) => (
              <div key={w.date} className="list-row">
                <div className="grow"><div className="food-name">{fmtDate(w.date, { weekday: true })}</div></div>
                <b className="num">{w.lb.toFixed(1)} lb</b>
                <button className="icon-btn" aria-label="Delete weigh-in" onClick={async () => { if (await ask(`Delete the ${fmtDate(w.date)} weigh-in?`)) update((d) => A.deleteWeight(d, w.date), 'Weigh-in deleted'); }}><Icon name="trash" size={16} /></button>
              </div>
            ))}
          </div>
          {node}
        </Sheet>
      )}
      {applyOpen && sug.delta != null && (
        <Sheet open onClose={() => setApplyOpen(false)} title="Change calorie target?">
          <p className="small">Change daily calories from {state.goals.calories} to <b>{state.goals.calories + sug.delta}</b> kcal. Adjust carbs by {Math.round(sug.delta / 4)} g to match. Protein and fat stay the same.</p>
          <div className="grid2">
            <button className="btn secondary" onClick={() => setApplyOpen(false)}>Not now</button>
            <button className="btn" onClick={() => { update((d) => A.setGoals(d, { ...d.goals, calories: d.goals.calories + sug.delta!, carbs: d.goals.carbs + Math.round(sug.delta! / 4) }, 'Trend-based adjustment'), 'Targets updated'); setApplyOpen(false); }}>Apply</button>
          </div>
        </Sheet>
      )}
    </>
  );
}

function NutritionSection() {
  const state = useApp((s) => s);
  const days = range(addDays(today(), -13), 14);
  const bars = days.map((d) => {
    const day = state.days[d];
    const c = day ? dayTotals(day, state.goals).consumed : null;
    return { label: WD_SHORT[parse(d).getDay()][0], value: c?.calories ?? 0, protein: c?.protein ?? 0, date: d };
  });
  const logged = bars.filter((b) => b.value > 0);
  const avgCal = logged.length ? logged.reduce((a, b) => a + b.value, 0) / logged.length : 0;
  const avgP = logged.length ? logged.reduce((a, b) => a + b.protein, 0) / logged.length : 0;
  return (
    <>
      <div className="section-title">Nutrition <small>last 14 days</small></div>
      <div className="card">
        <div className="tiles" style={{ marginBottom: 12 }}>
          <div className="tile"><div className="k">Avg kcal</div><div className="v num">{logged.length ? r0(avgCal).toLocaleString() : '–'}</div></div>
          <div className="tile"><div className="k">Avg protein</div><div className="v num">{logged.length ? r0(avgP) : '–'}<small>g</small></div></div>
          <div className="tile"><div className="k">Days logged</div><div className="v num">{logged.length}<small>/14</small></div></div>
        </div>
        <BarChart bars={bars.map((b) => ({ label: b.label, value: b.value, color: b.value >= state.goals.calories * 0.95 ? '#30d158' : '#ff9f0a' }))} target={state.goals.calories} yFmt={(v) => `${(v / 1000).toFixed(1)}k`} />
        <div className="legend"><span><i style={{ background: '#30d158' }} />≥95% of target</span><span><i style={{ background: '#ff9f0a' }} />Under</span><span><i style={{ background: '#fff' }} />Target</span></div>
        <div className="cat-head">Calorie target history</div>
        {[...state.goalHistory].reverse().map((g) => (
          <div key={g.date} className="row between small" style={{ padding: '4px 0' }}>
            <span>{fmtDate(g.date)}{g.note ? <span className="muted"> · {g.note}</span> : ''}</span>
            <b className="num">{g.goals.calories} kcal · {g.goals.protein}P/{g.goals.carbs}C/{g.goals.fat}F</b>
          </div>
        ))}
      </div>
    </>
  );
}

function StrengthSection() {
  const state = useApp((s) => s);
  const prs = personalRecords(state);
  const [sel, setSel] = useState<string | null>(null);
  const name = sel ?? prs[0]?.name;
  const hist = name ? exerciseHistory(state, name) : [];
  const x0 = hist.length ? parse(hist[0].date).getTime() : 0;
  const X = (d: string) => (parse(d).getTime() - x0) / 86400000;
  return (
    <>
      <div className="section-title">Strength</div>
      {!prs.length ? <div className="card"><Empty icon="🏋️" title="No lifts logged yet">Personal records and charts appear after your first logged strength workout.</Empty></div> : (
        <div className="card">
          <div className="chips" style={{ marginBottom: 12 }}>{prs.map((p) => <button key={p.name} className={`chip ${p.name === name ? 'active' : ''}`} onClick={() => setSel(p.name)}>{p.name}</button>)}</div>
          <LineChart series={[
            { name: 'Top set', color: '#ff6b3d', points: hist.map((h) => ({ x: X(h.date), y: h.topWeight })), dots: true },
            { name: 'Est. 1RM', color: '#bf5af2', points: hist.map((h) => ({ x: X(h.date), y: h.bestE1rm })), dashed: true },
          ]} xLabels={hist.length > 1 ? [hist[0], hist[hist.length - 1]].map((h) => ({ x: X(h.date), label: fmtDate(h.date) })) : undefined} />
          <div className="legend"><span><i style={{ background: '#ff6b3d' }} />Top set (lb)</span><span><i style={{ background: '#bf5af2' }} />Estimated 1RM</span></div>
          <div className="cat-head">Personal records</div>
          {prs.map((p) => (
            <div key={p.name} className="row between small" style={{ padding: '5px 0' }}>
              <span><b>{p.name}</b> <span className="muted">· {p.sessions} session{p.sessions === 1 ? '' : 's'}</span></span>
              <span className="num"><b>{p.heaviest} lb</b> <span className="muted">· e1RM {r0(p.bestE1rm)}</span></span>
            </div>
          ))}
          <div className="tiny muted" style={{ marginTop: 6 }}>Estimated 1RM uses the Epley formula. The app never raises your planned weights on its own.</div>
        </div>
      )}
    </>
  );
}

function RunningSection() {
  const state = useApp((s) => s);
  const unit = state.prefs.distanceUnit;
  const runs = runSessions(state);
  const x0 = runs.length ? parse(runs[0].date).getTime() : 0;
  const X = (d: string) => (parse(d).getTime() - x0) / 86400000;
  const last30 = runs.filter((r) => diffDays(r.date, today()) < 30);
  const dist30 = last30.reduce((a, r) => a + kmTo(unit, r.run!.distanceKm!), 0);
  const paces = runs.map((r) => ({ x: X(r.date), y: (paceSecPerUnit(r.run!, unit) ?? 0) / 60 })).filter((p) => p.y > 0);
  const longest = runs.reduce((a, r) => Math.max(a, kmTo(unit, r.run!.distanceKm!)), 0);
  return (
    <>
      <div className="section-title">Running</div>
      {!runs.length ? <div className="card"><Empty icon="🏃" title="No runs logged yet">Log an outdoor, treadmill or interval run to see pace and distance trends.</Empty></div> : (
        <div className="card">
          <div className="tiles" style={{ marginBottom: 12 }}>
            <div className="tile"><div className="k">30-day</div><div className="v num">{dist30.toFixed(1)}<small> {unit}</small></div></div>
            <div className="tile"><div className="k">Runs</div><div className="v num">{runs.length}</div></div>
            <div className="tile"><div className="k">Longest</div><div className="v num">{longest.toFixed(1)}<small> {unit}</small></div></div>
          </div>
          <LineChart series={[{ name: 'Pace', color: '#30d158', points: paces, dots: true }]} yFmt={(v) => fmtDuration(v * 60)}
            xLabels={runs.length > 1 ? [runs[0], runs[runs.length - 1]].map((r) => ({ x: X(r.date), label: fmtDate(r.date) })) : undefined} />
          <div className="legend"><span><i style={{ background: '#30d158' }} />Average pace (min/{unit}, lower is faster)</span></div>
          <div style={{ marginTop: 10 }}>
            <BarChart height={120} bars={runs.slice(-12).map((r) => ({ label: fmtDate(r.date).split(' ')[1], value: kmTo(unit, r.run!.distanceKm!), color: '#34c7a5' }))} yFmt={(v) => v.toFixed(1)} />
            <div className="legend"><span><i style={{ background: '#34c7a5' }} />Distance per run ({unit})</span></div>
          </div>
        </div>
      )}
    </>
  );
}

function ConsistencySection() {
  const state = useApp((s) => s);
  const weeks = weeklyConsistency(state, 8, today());
  const total = completedSessions(state).length;
  return (
    <>
      <div className="section-title">Workout consistency</div>
      <div className="card">
        <BarChart height={130} bars={weeks.map((w) => ({ label: fmtDate(w.week).split(' ')[1], value: w.done, secondary: w.planned, color: '#0a84ff' }))} yFmt={(v) => v.toFixed(0)} />
        <div className="legend"><span><i style={{ background: '#0a84ff' }} />Completed</span><span><i style={{ background: 'rgba(10,132,255,.3)' }} />Scheduled</span><span>{total} workouts total</span></div>
      </div>
    </>
  );
}

function SetupCard() {
  const p = useApp((s) => s.profile);
  const [start, setStart] = useState<number | null>(p.startWeight || null);
  const [goal, setGoal] = useState<number | null>(p.goalWeight || null);
  const [name, setName] = useState(p.name);
  return (
    <div className="card" data-testid="profile-setup">
      <div className="card-title" style={{ marginBottom: 6 }}>Set up your weight goal</div>
      <div className="small muted" style={{ marginBottom: 12 }}>Saved only on this device.</div>
      <Field label="Name (optional)"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <div className="grid2">
        <Field label="Starting weight (lb)"><NumInput value={start} onChange={setStart} ariaLabel="Starting weight" /></Field>
        <Field label="Goal weight (lb)"><NumInput value={goal} onChange={setGoal} ariaLabel="Goal weight" /></Field>
      </div>
      <button className="btn block" disabled={!start || !goal} onClick={() => update((d) => { d.profile = { ...d.profile, name, startWeight: start!, goalWeight: goal! }; }, 'Goal saved')}>Save</button>
    </div>
  );
}
