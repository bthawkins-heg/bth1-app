import { useMemo, useState } from 'react';
import type { DayItem, DayMeal, Unit } from '../lib/types';
import { useApp, update, getState } from '../lib/store';
import * as A from '../lib/actions';
import { dayTotals, getDay, mealTotals, r0, r1, foodLabel, foodNutrients, planSignature } from '../lib/nutrition';
import { addDays, fmtDate, fmtTime, nowHHMM, range, relDay, startOfWeek, today, WD_SHORT, parse, MONTHS_LONG } from '../lib/date';
import { fmtAmount, unitsFor } from '../lib/units';
import { supplementDueOn, GROUPS, scheduleNote } from '../lib/supplements';
import { occurrencesOn, typeName, TYPE_COLOR } from '../lib/training';
import { setUI, useToday } from '../lib/uiState';
import { Bar, Check, Empty, Field, Icon, Ring, Sheet, Stepper, Switch, UnitSelect, useConfirm, VerBadge } from '../components/ui';
import FoodPicker from '../components/FoodPicker';

export default function Today() {
  const state = useApp((s) => s);
  const now = useToday();
  // null = follow the current day, so an app left open overnight shows the new day when reopened
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked ?? now;
  const setDate = (d: string) => setPicked(d === today() ? null : d);
  const { ask, node: confirmNode } = useConfirm();
  const [itemSheet, setItemSheet] = useState<{ meal: DayMeal; item: DayItem } | null>(null);
  const [mealSheet, setMealSheet] = useState<DayMeal | null>(null);
  const [addTo, setAddTo] = useState<string | null>(null);
  const [histOpen, setHistOpen] = useState(false);
  const [newMeal, setNewMeal] = useState(false);

  const day = getDay(state, date);
  const t = dayTotals(day, state.goals);
  const g = state.goals;
  const stale = A.dayIsStale(state, date);
  const isToday = date === today();
  const week = range(startOfWeek(date, state.prefs.weekStartsOn), 7);

  // Meals not fully logged. On today, a meal with a set time that has already passed moves after upcoming timed meals.
  const remaining = useMemo(() => {
    const open = day.meals.filter((m) => m.items.some((i) => !i.consumed));
    if (!isToday) return open;
    const now = nowHHMM();
    const later = open.filter((m) => !m.time || m.time >= now);
    return [...later, ...open.filter((m) => m.time && m.time < now)];
  }, [day, isToday]);

  const logItem = (meal: DayMeal, item: DayItem) =>
    update((d) => A.toggleItem(d, date, meal.id, item.id), item.consumed ? `Unlogged ${item.name}` : `Logged ${item.name}`);
  const logMeal = (meal: DayMeal, on: boolean) =>
    update((d) => A.setMealConsumed(d, date, meal.id, on), on ? `Logged ${meal.name}` : `Unlogged ${meal.name}`);

  const occ = occurrencesOn(state, date);

  return (
    <div>
      <div className="screen-head">
        <div>
          <h1 className="large-title">{relDay(date)}</h1>
          <div className="subtitle">{fmtDate(date, { weekday: true })}{!isToday && <> · <button className="link" onClick={() => setDate(today())}>Jump to today</button></>}</div>
        </div>
        <div className="row">
          <button className="icon-btn" onClick={() => setDate(addDays(date, -7))} aria-label="Previous week"><Icon name="left" size={18} /></button>
          <button className="icon-btn" onClick={() => setHistOpen(true)} aria-label="History"><Icon name="cal" size={18} /></button>
          <button className="icon-btn" onClick={() => setDate(addDays(date, 7))} aria-label="Next week"><Icon name="right" size={18} /></button>
        </div>
      </div>

      <div className="week" role="tablist" aria-label="Week">
        {week.map((d) => {
          const logged = state.days[d]?.meals.some((m) => m.items.some((i) => i.consumed));
          return (
            <button key={d} className={`${d === date ? 'sel' : ''} ${d === today() ? 'today' : ''}`} onClick={() => setDate(d)} aria-label={fmtDate(d, { weekday: true })}>
              <span className="wd">{WD_SHORT[parse(d).getDay()][0]}</span>
              <span className="dn">{parse(d).getDate()}</span>
              <span className={`pip ${logged ? 'on' : ''}`} />
            </button>
          );
        })}
      </div>

      {/* Hero: calories + macros */}
      <section className="card hero" aria-label="Nutrition summary">
        <div className="hero-top">
          <div className="ring-wrap">
            <Ring value={t.consumed.calories} max={g.calories} planned={t.planned.calories} />
            <div className="ring-center">
              <div>
                <div className="big num" data-testid="kcal-consumed">{r0(t.consumed.calories).toLocaleString()}</div>
                <div className="tiny muted">of {g.calories.toLocaleString()} kcal</div>
              </div>
            </div>
          </div>
          <div className="kcal-stats">
            <div className="kcal-stat">
              <div className="label">{t.remaining.calories >= 0 ? 'Remaining' : 'Over target'}</div>
              <div className="value num" data-testid="kcal-remaining">{Math.abs(r0(t.remaining.calories)).toLocaleString()} <small>kcal</small></div>
            </div>
            <div className="kcal-stat">
              <div className="label">Planned</div>
              <div className="value num" data-testid="kcal-planned">{r0(t.planned.calories).toLocaleString()} <small>kcal</small></div>
            </div>
          </div>
        </div>
        <Macro name="Protein" color="var(--protein)" consumed={t.consumed.protein} planned={t.planned.protein} goal={g.protein} />
        <Macro name="Carbs" color="var(--carbs)" consumed={t.consumed.carbs} planned={t.planned.carbs} goal={g.carbs} />
        <Macro name="Fat" color="var(--fat)" consumed={t.consumed.fat} planned={t.planned.fat} goal={g.fat} />
        <Macro name="Fiber" color="var(--fiber)" consumed={t.consumed.fiber} planned={t.planned.fiber} goal={g.fiber} />
        <div className="legend" style={{ marginTop: 12 }}>
          <span><i style={{ background: 'var(--ink)' }} />Eaten</span><span><i style={{ background: 'var(--ink)', opacity: .3 }} />Planned</span>
          <span>Targets are goals, not limits</span>
        </div>
      </section>

      {stale && (
        <div className="banner">
          <Icon name="info" size={18} />
          <div className="grow small">Your meal plan changed since this day was started.</div>
          <button className="btn sm" onClick={() => update((d) => A.resyncDay(d, date), 'Updated day from plan')}>Update</button>
        </div>
      )}
      {/* Coming up: remaining meals in order (times only if you set them) */}
      <div className="section-title">Coming up <small>{remaining.length ? `${remaining.length} meal${remaining.length > 1 ? 's' : ''} left` : 'all logged'}</small></div>
      <div className="list" data-testid="coming-up">
        {remaining.map((m, i) => {
          const mt = mealTotals(m);
          const eaten = m.items.filter((x) => x.consumed).length;
          return (
            <button key={m.id} className="list-row" onClick={() => document.getElementById(`meal-${m.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              <span className="meal-emoji" style={{ width: 34, height: 34, fontSize: 18 }}>{m.emoji}</span>
              <div className="grow">
                <div className="food-name">{i === 0 && isToday ? <span style={{ color: 'var(--green)' }}>Next · </span> : ''}{m.name}</div>
                <div className="food-sub num">{m.time ? fmtTime(m.time) : 'No set time'} · {eaten}/{m.items.length} foods logged</div>
              </div>
              <div className="food-kcal num">{r0(mt.planned.calories - mt.consumed.calories)}<small>kcal left</small></div>
            </button>
          );
        })}
        {!remaining.length && <div className="empty small">{day.meals.length ? 'Every planned food is logged. 🎉' : 'No meals planned.'}</div>}
      </div>

      {/* Workout */}
      <div className="section-title">Workout <button className="link" onClick={() => setUI({ tab: 'training' })}>Plan</button></div>
      {occ.length === 0 ? (
        <div className="card"><div className="row"><div className="grow muted small">Nothing scheduled{isToday ? ' today' : ''}.</div>
          <button className="btn sm secondary" onClick={() => setUI({ tab: 'training' })}>Schedule</button></div></div>
      ) : occ.map((o) => {
        if (o.templateId === 'rest') return <div key={o.key} className="card row"><span style={{ fontSize: 22 }}>😴</span><div className="grow"><b>Rest day</b></div></div>;
        const tpl = state.templates.find((x) => x.id === o.templateId);
        if (!tpl) return null;
        const inProg = state.sessions.find((s) => s.occurrenceKey === o.key && s.status === 'in-progress');
        return (
          <div key={o.key} className="card" data-testid="today-workout">
            <div className="row">
              <div style={{ width: 6, alignSelf: 'stretch', borderRadius: 3, background: TYPE_COLOR[tpl.type] }} />
              <div className="grow">
                <div className="card-title">{tpl.name}</div>
                <div className="small muted">{typeName(tpl)}{tpl.exercises.length ? ` · ${tpl.exercises.length} exercises` : ''}{o.status === 'skipped' ? ' · skipped' : ''}</div>
              </div>
              {o.status === 'done' ? <span className="chip" style={{ background: 'rgba(48,209,88,.16)', color: 'var(--green)' }}>Done ✓</span>
                : o.status === 'skipped' ? null
                  : <button className="btn sm green" onClick={() => {
                    let id = '';
                    update((d) => { id = A.startSession(d, o.templateId, date, o.key); });
                    setUI({ sessionId: id });
                  }}>{inProg ? 'Continue' : 'Start'}</button>}
            </div>
          </div>
        );
      })}

      <div className="section-title">Meals <small>{day.meals.length} planned</small></div>
      {day.meals.length === 0 && <div className="card"><Empty icon="🍽️" title="No meals planned">Add a meal or set a plan for this weekday in Settings.</Empty></div>}
      {day.meals.map((meal) => (
        <MealCard key={meal.id} meal={meal}
          onToggle={(item) => logItem(meal, item)}
          onLogAll={(on) => logMeal(meal, on)}
          onItem={(item) => setItemSheet({ meal, item })}
          onHead={() => setMealSheet(meal)}
          onAdd={() => setAddTo(meal.id)} />
      ))}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn secondary sm grow" onClick={() => setNewMeal(true)}><Icon name="plus" size={16} />Add meal</button>
        <button className="btn secondary sm grow" onClick={async () => {
          const logged = day.meals.some((m) => m.items.some((i) => i.consumed));
          if (logged && !(await ask(`Replace this day's meals with ${relDay(addDays(date, -1)).toLowerCase()}'s? Foods you already logged here will be removed (you can undo right after).`))) return;
          update((d) => A.copyDay(d, addDays(date, -1), date), `Copied ${relDay(addDays(date, -1)).toLowerCase()}'s meals`);
        }}><Icon name="copy" size={16} />Copy previous day</button>
      </div>

      <SupplementsSection date={date} />
      {confirmNode}

      {itemSheet && <ItemSheet date={date} meal={itemSheet.meal} item={itemSheet.item} onClose={() => setItemSheet(null)} />}
      {mealSheet && <MealSheet date={date} meal={mealSheet} onClose={() => setMealSheet(null)} />}
      <FoodPicker open={!!addTo} onClose={() => setAddTo(null)} showLogToggle title="Add food"
        onPick={(foodId, qty, unit, logNow) => {
          const mid = addTo!;
          update((d) => { A.addDayItem(d, date, mid, foodId, qty, unit, logNow); }, logNow ? 'Added and logged food' : 'Added food');
        }} />
      {histOpen && <HistorySheet onPick={(d) => { setDate(d); setHistOpen(false); }} onClose={() => setHistOpen(false)} selected={date} />}
      {newMeal && <NewMealSheet onClose={() => setNewMeal(false)} onSave={(name) => { update((d) => { A.addDayMeal(d, date, name); }, `Added ${name}`); setNewMeal(false); }} />}
    </div>
  );
}

/** Tiny inline marker so estimates stand out from label-verified values. */
function SourceTag({ v }: { v: DayItem['verification'] }) {
  const map = { label: ['✓ label', 'var(--green)'], 'retailer-label': ['retailer label', 'var(--c-retailer)'], database: ['USDA ref', 'var(--c-db)'], estimate: ['estimate', 'var(--orange)'], user: ['custom', 'var(--c-user)'] } as const;
  const [t, c] = map[v];
  return <span style={{ color: c, fontWeight: 600 }}>· {t}</span>;
}

function Macro({ name, color, consumed, planned, goal }: { name: string; color: string; consumed: number; planned: number; goal?: number }) {
  return (
    <div className="macro" data-testid={`macro-${name.toLowerCase()}`}>
      <div className="macro-head">
        <div className="macro-name"><span className="dot" style={{ background: color }} />{name}</div>
        <div className="macro-val num"><b>{r0(consumed)}</b>{goal ? ` / ${goal}g` : 'g'} <span className="tiny">· plan {r0(planned)}g</span></div>
      </div>
      <Bar value={consumed} max={goal ?? Math.max(planned, 1)} planned={planned} color={color} />
    </div>
  );
}

function MealCard({ meal, onToggle, onLogAll, onItem, onHead, onAdd }: {
  meal: DayMeal; onToggle: (i: DayItem) => void; onLogAll: (on: boolean) => void; onItem: (i: DayItem) => void; onHead: () => void; onAdd: () => void;
}) {
  const mt = mealTotals(meal);
  const allDone = meal.items.length > 0 && meal.items.every((i) => i.consumed);
  const some = meal.items.some((i) => i.consumed);
  return (
    <section className="card tight" id={`meal-${meal.id}`} style={{ scrollMarginTop: 12 }} aria-label={meal.name} data-testid={`meal-${meal.name}`}>
      <div className="meal-head">
        <button className="meal-emoji" onClick={onHead} aria-label={`${meal.name} options`}>{meal.emoji}</button>
        <button className="grow" style={{ textAlign: 'left' }} onClick={onHead}>
          <div className="row" style={{ gap: 8 }}>
            <span className="meal-name">{meal.name}</span>
            {meal.time && <span className="chip" style={{ height: 22, fontSize: 11 }}>{fmtTime(meal.time)}</span>}
          </div>
          <div className="meal-macros num">
            <span><b style={{ color: 'var(--text)' }}>{r0(mt.planned.calories)}</b> kcal</span>
            <span><b style={{ color: 'var(--protein)' }}>P</b> {r0(mt.planned.protein)}g</span>
            <span><b style={{ color: 'var(--carbs)' }}>C</b> {r0(mt.planned.carbs)}g</span>
            <span><b style={{ color: 'var(--fat)' }}>F</b> {r0(mt.planned.fat)}g</span>
          </div>
        </button>
        <Check lg on={allDone} partial={some} onClick={() => onLogAll(!allDone)} label={`Log entire ${meal.name}`} />
      </div>
      {meal.items.map((it) => (
        <div key={it.id} className={`food-row ${it.consumed ? 'done' : ''}`}>
          <Check on={it.consumed} onClick={() => onToggle(it)} label={`Log ${it.name}`} />
          <button className="food-main" onClick={() => onItem(it)}>
            <div className="food-name">{it.name}</div>
            <div className="food-sub">{fmtAmount(it.qty, it.unit)} · {it.brand} <SourceTag v={it.verification} /></div>
          </button>
          <button className="food-kcal num" onClick={() => onItem(it)}>
            {r0(it.n.calories)}
            <small>{r0(it.n.protein)}P · {r0(it.n.carbs)}C · {r0(it.n.fat)}F</small>
          </button>
        </div>
      ))}
      <div className="meal-foot">
        <span className="small muted num">{some ? `${r0(mt.consumed.calories)} of ${r0(mt.planned.calories)} kcal eaten` : 'Not logged yet'}</span>
        <button className="btn ghost sm" onClick={onAdd}><Icon name="plus" size={16} />Food</button>
      </div>
    </section>
  );
}

function ItemSheet({ date, meal, item, onClose }: { date: string; meal: DayMeal; item: DayItem; onClose: () => void }) {
  const state = getState();
  const food = state.foods.find((f) => f.id === item.foodId);
  const [qty, setQty] = useState(item.qty);
  const [unit, setUnit] = useState<Unit>(item.unit);
  const [applyToPlan, setApplyToPlan] = useState(false);
  const preview = food ? foodNutrients(food, qty, unit) : null;
  const alts = (item.alternatives ?? []).filter((id) => id !== item.foodId).map((id) => state.foods.find((f) => f.id === id)).filter(Boolean);
  const tplItem = meal.mealId ? state.meals.find((m) => m.id === meal.mealId)?.items.find((i) => item.id.endsWith(':' + i.id)) : undefined;

  const save = () => {
    update((d) => {
      A.editPortion(d, date, meal.id, item.id, qty, unit);
      if (applyToPlan && tplItem && meal.mealId) A.updateTemplateItem(d, meal.mealId, tplItem.id, { qty, unit });
      if (applyToPlan) { const day = d.days[date]; if (day) { day.planSig = planSignature(d, date); } }
    }, `Updated ${item.name}`);
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={item.name}>
      <div className="row" style={{ marginBottom: 12 }}>
        <span className="muted small grow">{item.brand}</span>
        <VerBadge v={food?.verification ?? item.verification} />
      </div>
      <div className="grid2">
        <Field label="Portion"><Stepper value={qty} onChange={setQty} step={unit === 'g' ? 10 : 0.5} ariaLabel="portion" /></Field>
        <Field label="Unit">{food ? <UnitSelect value={unit} units={unitsFor(food)} onChange={setUnit} /> : <div className="input">{unit}</div>}</Field>
      </div>
      <div className="card">
        {preview ? (
          <div className="grid4 center num">
            <div><div className="tiny muted">kcal</div><b>{r0(preview.calories)}</b></div>
            <div><div className="tiny muted">Protein</div><b>{r1(preview.protein)}g</b></div>
            <div><div className="tiny muted">Carbs</div><b>{r1(preview.carbs)}g</b></div>
            <div><div className="tiny muted">Fat</div><b>{r1(preview.fat)}g</b></div>
          </div>
        ) : <div className="muted small">Can’t convert this unit for this food.</div>}
        {preview && <div className="tiny muted center" style={{ marginTop: 8 }}>Fiber {r1(preview.fiber)}g{preview.sugar != null ? ` · Sugar ${r1(preview.sugar)}g` : ''}</div>}
      </div>
      {tplItem && (
        <div className="row between card"><span className="small">Also change the {meal.name} plan</span><Switch on={applyToPlan} onChange={setApplyToPlan} label="Apply to plan" /></div>
      )}
      <button className="btn block" disabled={!preview || qty <= 0} onClick={save}>Save portion</button>

      {alts.length > 0 && (
        <>
          <div className="cat-head">Swap for</div>
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            {alts.map((f) => (
              <button key={f!.id} className="chip" onClick={() => {
                update((d) => {
                  A.swapDayItem(d, date, meal.id, item.id, f!.id);
                  if (applyToPlan && tplItem && meal.mealId) { A.swapTemplateItem(d, meal.mealId, tplItem.id, f!.id); const day = d.days[date]; if (day) day.planSig = planSignature(d, date); }
                }, `Swapped to ${foodLabel(f!)}`);
                onClose();
              }}><Icon name="swap" size={14} />{foodLabel(f!)}</button>
            ))}
          </div>
          {tplItem && <div className="tiny muted" style={{ marginTop: 6 }}>Turn on “Also change the plan” above to make the swap permanent.</div>}
        </>
      )}
      {food && (
        <div className="small muted" style={{ marginTop: 16 }}>
          <div><b>Source:</b> {food.sourceName}{food.sourceUrl && <> · <a href={food.sourceUrl} target="_blank" rel="noreferrer">link</a></>}</div>
          {food.notes && <div style={{ marginTop: 4 }}>{food.notes}</div>}
        </div>
      )}
      <button className="btn danger block" style={{ marginTop: 16 }} onClick={() => { update((d) => A.removeDayItem(d, date, meal.id, item.id), `Removed ${item.name}`); onClose(); }}>Remove from this day</button>
    </Sheet>
  );
}

function MealSheet({ date, meal, onClose }: { date: string; meal: DayMeal; onClose: () => void }) {
  const [time, setTime] = useState(meal.time ?? '');
  return (
    <Sheet open onClose={onClose} title={meal.name}>
      <Field label="Time (optional)">
        <div className="row">
          <input className="input grow" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Meal time" />
          {time && <button className="btn secondary sm" onClick={() => setTime('')}>Clear</button>}
        </div>
      </Field>
      <button className="btn block" onClick={() => { update((d) => A.setDayMealTime(d, date, meal.id, time || undefined), 'Meal time updated'); onClose(); }}>Save time</button>
      <div className="grid2" style={{ marginTop: 12 }}>
        <button className="btn secondary" onClick={() => { update((d) => A.moveDayMeal(d, date, meal.id, -1), `Moved ${meal.name} earlier`); onClose(); }}><Icon name="up" size={18} />Earlier</button>
        <button className="btn secondary" onClick={() => { update((d) => A.moveDayMeal(d, date, meal.id, 1), `Moved ${meal.name} later`); onClose(); }}><Icon name="down" size={18} />Later</button>
      </div>
      <div className="grid2" style={{ marginTop: 12 }}>
        <button className="btn secondary" onClick={() => { update((d) => A.setMealConsumed(d, date, meal.id, true), `Logged ${meal.name}`); onClose(); }}>Log all</button>
        <button className="btn secondary" onClick={() => { update((d) => A.setMealConsumed(d, date, meal.id, false), `Unlogged ${meal.name}`); onClose(); }}>Unlog all</button>
      </div>
      <p className="small muted">Times and order here apply to this day only. Set recurring times in Settings → Meal plans.</p>
      <button className="btn danger block" onClick={() => { update((d) => A.removeDayMeal(d, date, meal.id), `Removed ${meal.name}`); onClose(); }}>Remove meal from this day</button>
    </Sheet>
  );
}

function NewMealSheet({ onClose, onSave }: { onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <Sheet open onClose={onClose} title="Add meal">
      <Field label="Meal name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Post-workout snack" autoFocus /></Field>
      <button className="btn block" disabled={!name.trim()} onClick={() => onSave(name.trim())}>Add meal</button>
    </Sheet>
  );
}

function HistorySheet({ onPick, onClose, selected }: { onPick: (d: string) => void; onClose: () => void; selected: string }) {
  const state = useApp((s) => s);
  const [month, setMonth] = useState(selected.slice(0, 7));
  const first = month + '-01';
  const start = startOfWeek(first, state.prefs.weekStartsOn);
  const cells = range(start, 42);
  const [y, m] = month.split('-').map(Number);
  const shift = (n: number) => { const d = new Date(y, m - 1 + n, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); };
  const logged = Object.values(state.days).filter((d) => d.meals.some((x) => x.items.some((i) => i.consumed))).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Sheet open onClose={onClose} title="History" full>
      <div className="row between" style={{ marginBottom: 10 }}>
        <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month"><Icon name="left" size={18} /></button>
        <b>{MONTHS_LONG[m - 1]} {y}</b>
        <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month"><Icon name="right" size={18} /></button>
      </div>
      <div className="month">
        {range(start, 7).map((d) => <div key={d} className="mh">{WD_SHORT[parse(d).getDay()]}</div>)}
        {cells.map((d) => {
          const dl = state.days[d];
          const c = dl ? dayTotals(dl, state.goals).consumed.calories : 0;
          return (
            <button key={d} className={`mc ${d.slice(0, 7) !== month ? 'out' : ''} ${d === selected ? 'sel' : ''} ${d === today() ? 'today' : ''}`} onClick={() => onPick(d)}>
              <span className="d">{parse(d).getDate()}</span>
              {c > 0 && <span className="tiny num" style={{ color: c >= state.goals.calories * 0.9 ? 'var(--green)' : 'var(--orange)' }}>{(c / 1000).toFixed(1)}k</span>}
            </button>
          );
        })}
      </div>
      <div className="cat-head">Logged days</div>
      <div className="list">
        {logged.slice(0, 60).map((d) => {
          const tt = dayTotals(d, state.goals);
          return (
            <button key={d.date} className="list-row" onClick={() => onPick(d.date)}>
              <div className="grow"><div className="food-name">{relDay(d.date)}</div>
                <div className="food-sub num">{r0(tt.consumed.protein)}P · {r0(tt.consumed.carbs)}C · {r0(tt.consumed.fat)}F</div></div>
              <div className="food-kcal num">{r0(tt.consumed.calories).toLocaleString()}<small>kcal</small></div>
            </button>
          );
        })}
        {!logged.length && <div className="empty small">No logged days yet.</div>}
      </div>
    </Sheet>
  );
}

function SupplementsSection({ date }: { date: string }) {
  const state = useApp((s) => s);
  const day = getDay(state, date);
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('sup-open') === '1'; } catch { return false; } });
  const toggleOpen = () => { const v = !open; setOpen(v); try { localStorage.setItem('sup-open', v ? '1' : '0'); } catch { /* ignore */ } };
  const due = state.supplements.filter((s) => supplementDueOn(state, s, date));
  const optional = state.supplements.filter((s) => s.active && s.group === 'optional');
  const taken = due.filter((s) => day.supplements[s.id]).length;
  const row = (s: (typeof due)[number]) => {
    const meal = s.withMeal ? state.meals.find((m) => m.id === s.withMeal)?.name : '';
    const note = [s.servingSize !== '1 serving' ? s.servingSize : '', meal ? `with ${meal}` : '', scheduleNote(s), s.reminderTime ? fmtTime(s.reminderTime) : ''].filter(Boolean).join(' · ');
    return (
      <div key={s.id} className="row" style={{ padding: '7px 0' }}>
        <Check on={!!day.supplements[s.id]} onClick={() => update((d) => A.toggleSupplement(d, date, s.id), day.supplements[s.id] ? `Unchecked ${s.name}` : `Took ${s.name}`)} label={s.name} />
        <div className="grow small"><b>{s.brand} {s.name}</b>{note && <div className="muted tiny">{note}</div>}</div>
      </div>
    );
  };
  return (
    <section className="card" style={{ marginTop: 22, padding: 0 }} data-testid="supplements">
      <button className="row" style={{ width: '100%', padding: '14px 16px', textAlign: 'left' }} onClick={toggleOpen} aria-expanded={open}>
        <Icon name="pill" size={20} color="var(--sub)" />
        <div className="grow"><div className="card-title" style={{ fontSize: 16 }}>Supplements</div>
          <div className="tiny muted num">{due.length ? `${taken}/${due.length} taken` : 'Nothing in your daily groups'}{optional.length ? ` · ${optional.length} optional` : ''}</div></div>
        <Icon name={open ? 'up' : 'down'} size={18} color="var(--sub)" />
      </button>
      {open && (
        <div style={{ padding: '0 16px 12px' }}>
          {GROUPS.map((g) => {
            const list = g.id === 'optional' ? optional : due.filter((s) => s.group === g.id);
            if (!list.length) return null;
            return (
              <div key={g.id}>
                <div className="cat-head" style={{ margin: '10px 0 2px' }}>{g.label}</div>
                {list.map(row)}
              </div>
            );
          })}
          <button className="btn ghost sm" style={{ paddingLeft: 0, marginTop: 4 }} onClick={() => setUI({ tab: 'settings' })}>Edit groups in Settings</button>
        </div>
      )}
    </section>
  );
}
