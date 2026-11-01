import { useState } from 'react';
import type { Food, Goals, MealTemplate, Supplement } from '../lib/types';
import { useApp, update, useSyncStatus, getState, replaceState, resetAll, showToast } from '../lib/store';
import * as A from '../lib/actions';
import { foodLabel, itemNutrients, mealNutrients, newId, r0, sum } from '../lib/nutrition';
import { fmtDate, today, WD_LONG, WD_SHORT, range, startOfWeek, weekday } from '../lib/date';
import { unitsFor } from '../lib/units';
import { FREQ_LABEL, GROUPS, overlaps, scheduleNote } from '../lib/supplements';
import { copyText, Field, Icon, NumInput, Sheet, Switch, UnitSelect, useConfirm, VerBadge, VER_LABEL } from '../components/ui';
import FoodForm from '../components/FoodForm';
import FoodPicker from '../components/FoodPicker';
import { planForDate } from '../lib/nutrition';
import { setUI } from '../lib/uiState';

type Panel = 'goals' | 'profile' | 'foods' | 'meals' | 'plans' | 'supps' | 'prefs' | 'data' | null;

export default function Settings() {
  const state = useApp((s) => s);
  const sync = useSyncStatus();
  const [panel, setPanel] = useState<Panel>(null);
  const unverified = state.foods.filter((f) => !f.archived && (f.verification === 'estimate')).length;
  const Row = ({ id, icon, title, sub }: { id: Panel; icon: string; title: string; sub: string }) => (
    <button className="list-row" onClick={() => setPanel(id)}>
      <span className="meal-emoji" style={{ width: 34, height: 34, fontSize: 18 }}>{icon}</span>
      <div className="grow"><div className="food-name">{title}</div><div className="food-sub ellipsis">{sub}</div></div>
      <span className="chev">›</span>
    </button>
  );
  const syncText = { device: 'Saved on this device', syncing: 'Syncing…', synced: 'Saved to your account', offline: 'Offline · saved on device', error: 'Sync issue · saved on device' }[sync];
  return (
    <div>
      <div className="screen-head"><div><h1 className="large-title">Settings</h1><div className={`sync ${sync}`}><i />{syncText}</div></div></div>
      <div className="list">
        <Row id="goals" icon="🎯" title="Nutrition targets" sub={`${state.goals.calories} kcal · ${state.goals.protein}P · ${state.goals.carbs}C · ${state.goals.fat}F`} />
        <Row id="profile" icon="👤" title="Profile & weight goal" sub={state.profile.startWeight && state.profile.goalWeight ? `${state.profile.startWeight} → ${state.profile.goalWeight} lb` : 'Not set yet'} />
      </div>
      <div className="list">
        <Row id="meals" icon="🍽️" title="Meals" sub={state.meals.map((m) => m.name).join(' · ')} />
        <Row id="plans" icon="🗓️" title="Meal plans & schedule" sub={`${state.plans.length} plan${state.plans.length > 1 ? 's' : ''} · times optional`} />
        <Row id="foods" icon="🥫" title="Food database" sub={`${state.foods.filter((f) => !f.archived).length} foods${unverified ? ` · ${unverified} estimates to verify` : ''}`} />
        <Row id="supps" icon="💊" title="Supplements" sub={`${state.supplements.filter((s) => s.active).length} active`} />
      </div>
      <div className="list">
        <Row id="prefs" icon="⚙️" title="Preferences" sub={`Distance in ${state.prefs.distanceUnit} · notifications ${state.prefs.notifications ? 'on' : 'off'}`} />
        <Row id="data" icon="💾" title="Data & backup" sub={`Last backup: ${state.lastBackup ? fmtDate(state.lastBackup) : 'never'}`} />
      </div>
      <p className="tiny muted center">Nutrition values are labeled by source. Targets are guides, not limits. This app is not medical advice.</p>

      {panel === 'goals' && <GoalsSheet onClose={() => setPanel(null)} />}
      {panel === 'profile' && <ProfileSheet onClose={() => setPanel(null)} />}
      {panel === 'foods' && <FoodsSheet onClose={() => setPanel(null)} />}
      {panel === 'meals' && <MealsSheet onClose={() => setPanel(null)} />}
      {panel === 'plans' && <PlansSheet onClose={() => setPanel(null)} />}
      {panel === 'supps' && <SupplementsSheet onClose={() => setPanel(null)} />}
      {panel === 'prefs' && <PrefsSheet onClose={() => setPanel(null)} />}
      {panel === 'data' && <DataSheet onClose={() => setPanel(null)} />}
    </div>
  );
}

function GoalsSheet({ onClose }: { onClose: () => void }) {
  const goals = useApp((s) => s.goals);
  const [g, setG] = useState<Goals>({ ...goals });
  const macroKcal = g.protein * 4 + g.carbs * 4 + g.fat * 9;
  return (
    <Sheet open onClose={onClose} title="Nutrition targets">
      <div className="grid2">
        <Field label="Calories (kcal)"><NumInput value={g.calories} onChange={(v) => setG({ ...g, calories: v ?? 0 })} ariaLabel="Calorie target" /></Field>
        <Field label="Protein (g)"><NumInput value={g.protein} onChange={(v) => setG({ ...g, protein: v ?? 0 })} ariaLabel="Protein target" /></Field>
        <Field label="Carbs (g)"><NumInput value={g.carbs} onChange={(v) => setG({ ...g, carbs: v ?? 0 })} ariaLabel="Carb target" /></Field>
        <Field label="Fat (g)"><NumInput value={g.fat} onChange={(v) => setG({ ...g, fat: v ?? 0 })} ariaLabel="Fat target" /></Field>
        <Field label="Fiber (g, optional)"><NumInput value={g.fiber} onChange={(v) => setG({ ...g, fiber: v ?? undefined })} /></Field>
      </div>
      <div className="small muted" style={{ marginBottom: 12 }}>Macros add up to {r0(macroKcal).toLocaleString()} kcal (protein & carbs 4 kcal/g, fat 9 kcal/g).</div>
      {!(g.calories > 0 && g.protein >= 0 && g.carbs >= 0 && g.fat >= 0) && <div className="small" style={{ color: 'var(--red)', marginBottom: 8 }}>Calories must be above zero and macros can’t be negative.</div>}
      <button className="btn block" disabled={!(g.calories > 0 && g.protein >= 0 && g.carbs >= 0 && g.fat >= 0)} onClick={() => { update((d) => A.setGoals(d, g, 'Edited in Settings'), 'Targets saved'); onClose(); }}>Save targets</button>
    </Sheet>
  );
}

function ProfileSheet({ onClose }: { onClose: () => void }) {
  const p = useApp((s) => s.profile);
  const [x, setX] = useState({ ...p });
  return (
    <Sheet open onClose={onClose} title="Profile">
      <Field label="Name"><input className="input" value={x.name} onChange={(e) => setX({ ...x, name: e.target.value })} /></Field>
      <div className="grid2">
        <Field label="Starting weight (lb)"><NumInput value={x.startWeight} onChange={(v) => setX({ ...x, startWeight: v ?? 0 })} /></Field>
        <Field label="Goal weight (lb)"><NumInput value={x.goalWeight} onChange={(v) => setX({ ...x, goalWeight: v ?? 0 })} /></Field>
        <Field label="Height (in)"><NumInput value={x.heightIn} onChange={(v) => setX({ ...x, heightIn: v ?? 0 })} /></Field>
        <Field label="Start date"><input className="input" type="date" value={x.startDate} onChange={(e) => setX({ ...x, startDate: e.target.value })} /></Field>
      </div>
      <div className="small muted" style={{ marginBottom: 12 }}>{Math.floor(x.heightIn / 12)}′{Math.round(x.heightIn % 12)}″</div>
      <button className="btn block" onClick={() => { update((d) => { d.profile = x; }, 'Profile saved'); onClose(); }}>Save</button>
    </Sheet>
  );
}

function FoodsSheet({ onClose }: { onClose: () => void }) {
  const foods = useApp((s) => s.foods);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Food | 'new' | null>(null);
  const list = foods.filter((f) => !f.archived && `${f.brand} ${f.name} ${f.flavor ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Sheet open onClose={onClose} title="Food database" full right={<button className="btn ghost sm" onClick={() => setEdit('new')}>Add</button>}>
      <input className="input" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} />
      <div className="legend" style={{ marginBottom: 10 }}>{(Object.keys(VER_LABEL) as (keyof typeof VER_LABEL)[]).map((v) => <VerBadge key={v} v={v} />)}</div>
      <div className="list">
        {list.map((f) => (
          <button key={f.id} className="list-row" onClick={() => setEdit(f)}>
            <div className="grow">
              <div className="food-name">{foodLabel(f)}</div>
              <div className="food-sub">{f.brand} · per {f.servingSize} {f.servingUnit}{f.state && f.state !== 'as sold' ? ` (${f.state})` : ''} · {r0(f.nutrients.calories)} kcal · {f.nutrients.protein}P {f.nutrients.carbs}C {f.nutrients.fat}F</div>
            </div>
            <VerBadge v={f.verification} />
          </button>
        ))}
      </div>
      <p className="tiny muted">Green “Label” = copied from the manufacturer’s published panel. Blue “Retailer label” = the label as listed by a grocery retailer. “USDA ref” = generic USDA reference values. Orange “Estimate” = not verified; update it from your package.</p>
      {edit && (
        <Sheet open onClose={() => setEdit(null)} title={edit === 'new' ? 'New food' : foodLabel(edit)} full>
          {edit !== 'new' && edit.sourceUrl && <div className="small" style={{ marginBottom: 10 }}><a href={edit.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a></div>}
          <FoodForm initial={edit === 'new' ? null : edit}
            onSave={(f) => { update((d) => { const i = d.foods.findIndex((x) => x.id === f.id); if (i >= 0) d.foods[i] = f; else d.foods.push(f); }, 'Food saved'); setEdit(null); }}
            onDelete={edit === 'new' ? undefined : () => { update((d) => { d.foods.find((x) => x.id === (edit as Food).id)!.archived = true; }, 'Food archived'); setEdit(null); }} />
          <p className="tiny muted">Editing a food updates future plans. Days you already logged keep the values they were logged with.</p>
        </Sheet>
      )}
    </Sheet>
  );
}

function MealsSheet({ onClose }: { onClose: () => void }) {
  const state = useApp((s) => s);
  const [edit, setEdit] = useState<string | null>(null);
  return (
    <Sheet open onClose={onClose} title="Meals" full right={<button className="btn ghost sm" onClick={() => { let id = ''; update((d) => { id = A.addMealTemplate(d, 'New meal'); }); setEdit(id); }}>Add</button>}>
      <p className="small muted" style={{ marginTop: 0 }}>Meals are reusable. Put them in a day plan under “Meal plans & schedule”.</p>
      <div className="list">
        {state.meals.map((m) => {
          const n = mealNutrients(state, m.id);
          return (
            <button key={m.id} className="list-row" onClick={() => setEdit(m.id)}>
              <span className="meal-emoji" style={{ width: 36, height: 36, fontSize: 20 }}>{m.emoji}</span>
              <div className="grow"><div className="food-name">{m.name}</div><div className="food-sub num">{m.items.length} foods · {r0(n.calories)} kcal · {r0(n.protein)}P {r0(n.carbs)}C {r0(n.fat)}F</div></div>
              <span className="chev">›</span>
            </button>
          );
        })}
      </div>
      {edit && <MealEditor id={edit} onClose={() => setEdit(null)} />}
    </Sheet>
  );
}

function MealEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const state = useApp((s) => s);
  const m = state.meals.find((x) => x.id === id);
  const [picker, setPicker] = useState(false);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const { ask, node } = useConfirm();
  if (!m) return null;
  const mut = (fn: (x: MealTemplate) => void) => update((d) => { const x = d.meals.find((y) => y.id === id); if (x) fn(x); });
  const total = sum(m.items.map((i) => itemNutrients(state, i)));
  return (
    <Sheet open onClose={onClose} title={m.name} full>
      <div className="row" style={{ marginBottom: 12 }}>
        <input className="input" style={{ width: 64, textAlign: 'center', fontSize: 22 }} value={m.emoji} onChange={(e) => mut((x) => { x.emoji = e.target.value; })} aria-label="Emoji" />
        <input className="input grow" value={m.name} onChange={(e) => mut((x) => { x.name = e.target.value; })} aria-label="Meal name" />
      </div>
      <div className="card"><div className="grid4 center num">
        <div><div className="tiny muted">kcal</div><b>{r0(total.calories)}</b></div><div><div className="tiny muted">Protein</div><b>{r0(total.protein)}g</b></div>
        <div><div className="tiny muted">Carbs</div><b>{r0(total.carbs)}g</b></div><div><div className="tiny muted">Fat</div><b>{r0(total.fat)}g</b></div>
      </div></div>
      {m.items.map((it, i) => {
        const f = state.foods.find((x) => x.id === it.foodId);
        const n = itemNutrients(state, it);
        return (
          <div key={it.id} className="card" data-testid="template-item">
            <div className="row" style={{ marginBottom: 8 }}>
              <div className="grow"><div className="food-name">{f ? foodLabel(f) : 'Missing food'}</div><div className="food-sub num">{f?.brand} · {r0(n.calories)} kcal · {r0(n.protein)}P {r0(n.carbs)}C {r0(n.fat)}F</div></div>
              {f && <VerBadge v={f.verification} />}
            </div>
            <div className="row">
              <NumInput className="input sm" value={it.qty} onChange={(v) => v != null && mut((x) => { x.items[i].qty = v; })} ariaLabel={`${f?.name} amount`} />
              {f && <UnitSelect sm value={it.unit} units={unitsFor(f)} onChange={(u) => mut((x) => { x.items[i].unit = u; })} />}
              <button className="icon-btn" onClick={() => setSwapFor(it.id)} aria-label="Swap food"><Icon name="swap" size={16} /></button>
              <button className="icon-btn" onClick={() => mut((x) => A.moveInArray(x.items, i, -1))} aria-label="Move up"><Icon name="up" size={16} /></button>
              <button className="icon-btn" onClick={() => mut((x) => { x.items.splice(i, 1); })} aria-label="Remove food"><Icon name="trash" size={16} /></button>
            </div>
            {(it.alternatives?.length ?? 0) > 1 && (
              <div className="chips" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                {it.alternatives!.filter((a) => a !== it.foodId).map((a) => {
                  const af = state.foods.find((x) => x.id === a);
                  return af ? <button key={a} className="chip outline" onClick={() => update((d) => A.swapTemplateItem(d, id, it.id, a), `Plan now uses ${foodLabel(af)}`)}><Icon name="swap" size={12} />{foodLabel(af)}</button> : null;
                })}
              </div>
            )}
          </div>
        );
      })}
      <button className="btn secondary block" onClick={() => setPicker(true)}><Icon name="plus" size={16} />Add food</button>
      <button className="btn danger block" style={{ marginTop: 12 }} onClick={async () => { if (await ask(`Delete “${m.name}”? It will be removed from all plans. Logged days are kept.`)) { update((d) => A.deleteMealTemplate(d, id), 'Meal deleted'); onClose(); } }}>Delete meal</button>
      <FoodPicker open={picker} onClose={() => setPicker(false)} title={`Add to ${m.name}`} onPick={(foodId, qty, unit) => update((d) => { A.addTemplateItem(d, id, foodId, qty, unit); }, 'Food added to meal')} />
      <FoodPicker open={!!swapFor} onClose={() => setSwapFor(null)} title="Swap for…" onPick={(foodId) => { const it = swapFor!; update((d) => A.swapTemplateItem(d, id, it, foodId), 'Food swapped'); }} />
      {node}
    </Sheet>
  );
}

function PlansSheet({ onClose }: { onClose: () => void }) {
  const state = useApp((s) => s);
  const [ovDate, setOvDate] = useState(today());
  const [ovPlan, setOvPlan] = useState(state.plans[0]?.id ?? '');
  const { ask, node } = useConfirm();
  const week = range(startOfWeek(today(), state.prefs.weekStartsOn), 7);
  const planKcal = (pid: string) => {
    const p = state.plans.find((x) => x.id === pid);
    return p ? p.slots.reduce((a, s) => a + mealNutrients(state, s.mealId).calories, 0) : 0;
  };
  return (
    <Sheet open onClose={onClose} title="Meal plans & schedule" full>
      <div className="cat-head" style={{ marginTop: 0 }}>Weekly schedule</div>
      <div className="list">
        {week.map((d) => {
          const wd = weekday(d);
          const pid = state.schedule.weekdays[wd];
          return (
            <div key={wd} className="list-row">
              <div style={{ width: 92 }} className="food-name">{WD_LONG[wd]}</div>
              <select className="select sm grow" value={pid} onChange={(e) => update((x) => { x.schedule.weekdays[wd] = e.target.value; }, `${WD_LONG[wd]} plan changed`)} aria-label={`${WD_LONG[wd]} plan`}>
                {state.plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <span className="small muted num" style={{ width: 64, textAlign: 'right' }}>{r0(planKcal(pid)).toLocaleString()}</span>
            </div>
          );
        })}
      </div>
      <div className="small muted" style={{ margin: '-4px 4px 12px' }}>Weekly plan total: <b className="num">{r0(week.reduce((a, d) => a + planKcal(planForDate(state, d)?.id ?? ''), 0)).toLocaleString()} kcal</b> · avg {r0(week.reduce((a, d) => a + planKcal(planForDate(state, d)?.id ?? ''), 0) / 7).toLocaleString()} / day</div>

      <div className="cat-head">One-off date changes</div>
      <div className="row" style={{ marginBottom: 8 }}>
        <input className="input grow" type="date" value={ovDate} onChange={(e) => setOvDate(e.target.value)} aria-label="Override date" />
        <select className="select grow" value={ovPlan} onChange={(e) => setOvPlan(e.target.value)}>{state.plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <button className="btn" onClick={() => update((x) => { x.schedule.overrides[ovDate] = ovPlan; }, `${fmtDate(ovDate)} plan set`)}>Set</button>
      </div>
      {Object.entries(state.schedule.overrides).sort().map(([d, pid]) => (
        <div key={d} className="row between small" style={{ padding: '4px 4px' }}>
          <span>{fmtDate(d, { weekday: true })} → {state.plans.find((p) => p.id === pid)?.name}</span>
          <button className="btn ghost sm" onClick={() => update((x) => { delete x.schedule.overrides[d]; })}>Remove</button>
        </div>
      ))}

      <div className="cat-head">Day plans</div>
      {state.plans.map((p) => (
        <div key={p.id} className="card" data-testid="plan-card">
          <div className="row" style={{ marginBottom: 10 }}>
            <input className="input sm grow" value={p.name} onChange={(e) => update((x) => { x.plans.find((y) => y.id === p.id)!.name = e.target.value; })} aria-label="Plan name" style={{ fontWeight: 700 }} />
            <span className="small muted num">{r0(planKcal(p.id)).toLocaleString()} kcal</span>
          </div>
          {p.slots.map((s, i) => (
            <div key={s.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--sep)' }}>
              <select className="select sm" style={{ width: '100%', marginBottom: 6 }} value={s.mealId} onChange={(e) => update((x) => { x.plans.find((y) => y.id === p.id)!.slots[i].mealId = e.target.value; })} aria-label="Meal">
                {state.meals.map((m) => <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}
              </select>
              <div className="row">
                <input className="input sm grow" type="time" value={s.time ?? ''} onChange={(e) => update((x) => { x.plans.find((y) => y.id === p.id)!.slots[i].time = e.target.value || undefined; })} aria-label={`Time for meal ${i + 1}`} />
                {s.time && <button className="btn ghost sm" onClick={() => update((x) => { x.plans.find((y) => y.id === p.id)!.slots[i].time = undefined; })}>No time</button>}
                <button className="icon-btn" onClick={() => update((x) => A.moveInArray(x.plans.find((y) => y.id === p.id)!.slots, i, -1))} aria-label="Earlier"><Icon name="up" size={16} /></button>
                <button className="icon-btn" onClick={() => update((x) => A.moveInArray(x.plans.find((y) => y.id === p.id)!.slots, i, 1))} aria-label="Later"><Icon name="down" size={16} /></button>
                <button className="icon-btn" onClick={() => update((x) => { x.plans.find((y) => y.id === p.id)!.slots.splice(i, 1); })} aria-label="Remove from plan"><Icon name="trash" size={16} /></button>
              </div>
            </div>
          ))}
          {!p.slots.length && <div className="small muted">No meals yet.</div>}
          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn ghost sm" onClick={() => update((x) => { x.plans.find((y) => y.id === p.id)!.slots.push({ id: newId('slot'), mealId: state.meals[0]?.id ?? '' }); })}><Icon name="plus" size={14} />Meal</button>
            <button className="btn ghost sm" onClick={() => update((x) => { A.addPlan(x, `${p.name} copy`, p.id); }, 'Plan duplicated')}><Icon name="copy" size={14} />Duplicate</button>
            <div className="grow" />
            {state.plans.length > 1 && <button className="btn ghost sm" style={{ color: 'var(--red)' }} onClick={async () => { if (await ask(`Delete plan “${p.name}”? Days using it switch to another plan.`)) update((x) => A.deletePlan(x, p.id), 'Plan deleted'); }}>Delete</button>}
          </div>
          <div className="tiny muted">Times are optional. Leave blank to keep meals in order without a set time.</div>
        </div>
      ))}
      <button className="btn secondary block" onClick={() => update((x) => { A.addPlan(x, 'New plan'); }, 'Plan added')}><Icon name="plus" size={16} />New day plan</button>
      <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => { onClose(); setUI({ tab: 'today' }); }}>See today</button>
      {node}
    </Sheet>
  );
}

function SupplementsSheet({ onClose }: { onClose: () => void }) {
  const state = useApp((s) => s);
  const [edit, setEdit] = useState<Supplement | null>(null);
  const ov = overlaps(state.supplements);
  const blank: Supplement = { id: '', brand: '', name: '', servingSize: '1 serving', frequency: 'daily', group: 'optional', withMeal: '', active: true, tags: { creatine: false, vitaminD: false, stimulant: false }, tagSource: 'Entered by you' };
  return (
    <Sheet open onClose={onClose} title="Supplements" full right={<button className="btn ghost sm" onClick={() => setEdit(blank)}>Add</button>}>
      {ov.length > 0 && (
        <div className="banner warn" style={{ alignItems: 'flex-start' }}>
          <span>⚠️</span>
          <div className="small">
            <b>Possible ingredient overlaps</b>
            {ov.map((o) => <div key={o.key} style={{ marginTop: 4 }}>{o.label}: {o.items.map((i) => `${i.brand} ${i.name}`).join(', ')}</div>)}
            <div className="muted tiny" style={{ marginTop: 6 }}>Informational only, based on ingredient tags you can edit. Check labels and talk with a clinician about combined amounts. The app doesn’t recommend doses.</div>
          </div>
        </div>
      )}
      <p className="small muted" style={{ marginTop: 0 }}>Daily, Pre-workout and Post-workout items form your checklist on Today. Optional items are always there to tick but never count as missed. No times are set unless you add one.</p>
      {GROUPS.map((g) => {
        const list = state.supplements.filter((s) => s.group === g.id);
        return (
          <div key={g.id} data-testid={`sup-group-${g.id}`}>
            <div className="cat-head">{g.label} <span className="muted">({list.length})</span></div>
            <div className="list">
              {list.map((s) => {
                const note = [scheduleNote(s), s.servingSize !== '1 serving' ? s.servingSize : '', ...[s.tags.creatine && 'creatine', s.tags.vitaminD && 'vitamin D', s.tags.stimulant && 'stimulant'].filter(Boolean)].filter(Boolean).join(' · ');
                return (
                  <button key={s.id} className="list-row" onClick={() => setEdit(structuredClone(s))} style={{ opacity: s.active ? 1 : .5, minHeight: 44 }}>
                    <div className="grow">
                      <div className="food-name">{s.brand} {s.name}{!s.active && <span className="muted"> · paused</span>}</div>
                      {note && <div className="food-sub">{note}</div>}
                    </div>
                    <span className="chev">›</span>
                  </button>
                );
              })}
              {!list.length && <div className="empty small" style={{ padding: 14 }}>None</div>}
            </div>
          </div>
        );
      })}
      {edit && <SupplementEditor initial={edit} onClose={() => setEdit(null)} />}
    </Sheet>
  );
}

function SupplementEditor({ initial, onClose }: { initial: Supplement; onClose: () => void }) {
  const state = useApp((s) => s);
  const [s, setS] = useState(initial);
  const set = (p: Partial<Supplement>) => setS((x) => ({ ...x, ...p }));
  const isNew = !initial.id;
  return (
    <Sheet open onClose={onClose} title={isNew ? 'New supplement' : `${s.brand} ${s.name}`} full>
      <div className="grid2">
        <Field label="Brand"><input className="input" value={s.brand} onChange={(e) => set({ brand: e.target.value })} /></Field>
        <Field label="Name"><input className="input" value={s.name} onChange={(e) => set({ name: e.target.value })} /></Field>
      </div>
      <div className="grid2">
        <Field label="Serving size"><input className="input" value={s.servingSize} onChange={(e) => set({ servingSize: e.target.value })} aria-label="Serving size" /></Field>
        <Field label="Servings per container"><NumInput value={s.servingsPerContainer} onChange={(v) => set({ servingsPerContainer: v ?? undefined })} /></Field>
      </div>
      <Field group label="Group">
        <div className="chips" style={{ flexWrap: 'wrap' }}>
          {GROUPS.map((g) => <button key={g.id} className={`chip ${s.group === g.id ? 'active' : ''}`} onClick={() => set({ group: g.id })}>{g.label}</button>)}
        </div>
      </Field>
      {s.group !== 'optional' && (
        <Field group label="Show on">
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            {(Object.keys(FREQ_LABEL) as (keyof typeof FREQ_LABEL)[]).map((f) => <button key={f} className={`chip ${s.frequency === f ? 'active' : ''}`} onClick={() => set({ frequency: f })}>{FREQ_LABEL[f]}</button>)}
          </div>
        </Field>
      )}
      {s.frequency === 'days' && (
        <Field group label="Days">
          <div className="chips" style={{ flexWrap: 'wrap' }}>{WD_SHORT.map((w, i) => <button key={w} className={`chip ${(s.days ?? []).includes(i) ? 'active' : ''}`} onClick={() => set({ days: (s.days ?? []).includes(i) ? s.days!.filter((x) => x !== i) : [...(s.days ?? []), i] })}>{w}</button>)}</div>
        </Field>
      )}
      <div className="list">
        <div className="list-row"><span className="grow">With meal</span>
          <select className="select sm" style={{ width: 170 }} value={s.withMeal} onChange={(e) => set({ withMeal: e.target.value })}>
            <option value="">—</option>{state.meals.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="list-row"><span className="grow">Reminder time (optional)</span><input className="input sm" type="time" style={{ width: 120 }} value={s.reminderTime ?? ''} onChange={(e) => set({ reminderTime: e.target.value || undefined })} /></div>
        <div className="list-row"><span className="grow">Active</span><Switch on={s.active} onChange={(v) => set({ active: v })} label="Active" /></div>
      </div>
      <div className="cat-head">Ingredient tags (for overlap warnings)</div>
      <div className="list">
        <div className="list-row"><span className="grow">Contains creatine</span><Switch on={s.tags.creatine} onChange={(v) => set({ tags: { ...s.tags, creatine: v } })} label="Creatine" /></div>
        <div className="list-row"><span className="grow">Contains vitamin D</span><Switch on={s.tags.vitaminD} onChange={(v) => set({ tags: { ...s.tags, vitaminD: v } })} label="Vitamin D" /></div>
        <div className="list-row"><span className="grow">Contains stimulants / caffeine</span><Switch on={s.tags.stimulant} onChange={(v) => set({ tags: { ...s.tags, stimulant: v } })} label="Stimulant" /></div>
      </div>
      <div className="tiny muted" style={{ margin: '-4px 4px 12px' }}>Tag source: {s.tagSource}</div>
      <Field label="Notes"><textarea className="input" value={s.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} /></Field>
      {!state.prefs.notifications && s.reminderTime && <div className="small muted" style={{ marginBottom: 10 }}>Reminders stay off until you enable notifications in Preferences.</div>}
      <button className="btn block" disabled={!s.name.trim()} onClick={() => {
        update((d) => {
          const out = { ...s, tagSource: isNew ? 'Entered by you' : s.tagSource };
          if (isNew) d.supplements.push({ ...out, id: newId('sup') });
          else d.supplements[d.supplements.findIndex((x) => x.id === s.id)] = out;
        }, 'Supplement saved');
        onClose();
      }}>Save</button>
      {!isNew && <button className="btn danger block" style={{ marginTop: 10 }} onClick={() => { update((d) => { d.supplements = d.supplements.filter((x) => x.id !== s.id); }, 'Supplement removed'); onClose(); }}>Remove</button>}
    </Sheet>
  );
}

function PrefsSheet({ onClose }: { onClose: () => void }) {
  const prefs = useApp((s) => s.prefs);
  const [note, setNote] = useState('');
  return (
    <Sheet open onClose={onClose} title="Preferences">
      <div className="list">
        <div className="list-row"><span className="grow">Distance unit</span>
          <div className="chips">{(['mi', 'km'] as const).map((u) => <button key={u} className={`chip ${prefs.distanceUnit === u ? 'active' : ''}`} onClick={() => update((d) => { d.prefs.distanceUnit = u; })}>{u === 'mi' ? 'Miles' : 'Kilometers'}</button>)}</div>
        </div>
        <div className="list-row"><span className="grow">Week starts on</span>
          <div className="chips">{([0, 1] as const).map((u) => <button key={u} className={`chip ${prefs.weekStartsOn === u ? 'active' : ''}`} onClick={() => update((d) => { d.prefs.weekStartsOn = u; })}>{WD_LONG[u]}</button>)}</div>
        </div>
        <div className="list-row"><span className="grow">Notifications<div className="tiny muted">Off unless you turn them on. On iPhone, a web app can’t schedule alerts while closed, so reminders show inside the app.</div></span>
          <Switch on={prefs.notifications} label="Notifications" onChange={async (v) => {
            if (v) {
              try {
                const N = (window as unknown as { Notification?: { requestPermission(): Promise<string> } }).Notification;
                const res = N ? await N.requestPermission() : 'unsupported';
                if (res !== 'granted') setNote('This browser view did not allow notifications. Upcoming meals and reminders still show in the app.');
              } catch { setNote('Notifications are not available here. Upcoming meals and reminders still show in the app.'); }
            }
            update((d) => { d.prefs.notifications = v; });
          }} />
        </div>
      </div>
      {note && <div className="small muted">{note}</div>}
      <button className="btn block" style={{ marginTop: 12 }} onClick={onClose}>Done</button>
    </Sheet>
  );
}

function DataSheet({ onClose }: { onClose: () => void }) {
  const [txt, setTxt] = useState('');
  const { ask, node } = useConfirm();
  const sync = useSyncStatus();
  const last = useApp((s) => s.lastBackup);
  const markBackedUp = () => update((d) => { d.lastBackup = today(); });
  const restore = async (raw: string) => {
    try {
      const data = JSON.parse(raw);
      if (!data.goals || !data.foods) throw new Error('bad');
      if (await ask('Replace all current data with this backup?')) { replaceState(data); showToast('Backup restored'); onClose(); }
    } catch { showToast('That doesn’t look like a backup from this app'); }
  };
  const saveFile = async () => {
    const name = `bulk-backup-${today()}.json`;
    const blob = new Blob([JSON.stringify(getState())], { type: 'application/json' });
    try {
      const file = new File([blob], name, { type: 'application/json' });
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
      if (nav.canShare?.({ files: [file] })) { await nav.share({ files: [file], title: 'Backup' }); markBackedUp(); return; }
    } catch (e) { if ((e as Error)?.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    markBackedUp();
  };
  return (
    <Sheet open onClose={onClose} title="Data & backup">
      <div className="small muted" style={{ marginBottom: 12 }}>
        {sync === 'synced' || sync === 'syncing' ? 'Your data is saved to your Claude account (private to you) and on this device, so it follows you between devices.' : 'Your data is saved only on this device. Save a backup file now and then so a lost phone or cleared browser data doesn’t erase your history.'}
        <div style={{ marginTop: 6 }} data-testid="last-backup">Last backup: <b>{last ? fmtDate(last) : 'never'}</b></div>
      </div>
      <button className="btn block" onClick={saveFile}><Icon name="share" size={16} />Save backup file</button>
      <button className="btn secondary block" style={{ marginTop: 8 }} onClick={async () => { const ok = await copyText(JSON.stringify(getState())); if (ok) markBackedUp(); showToast(ok ? 'Backup copied to clipboard' : 'Copy failed'); }}><Icon name="copy" size={16} />Copy backup text</button>
      <div className="cat-head">Restore</div>
      <label className="btn secondary block" style={{ cursor: 'pointer' }}>
        Restore from file
        <input type="file" accept="application/json,.json,text/plain" style={{ display: 'none' }} aria-label="Backup file"
          onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) await restore(await f.text()); }} />
      </label>
      <Field label="Or paste backup text"><textarea className="input" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Paste backup JSON here" style={{ marginTop: 8 }} /></Field>
      <button className="btn secondary block" disabled={!txt.trim()} onClick={() => restore(txt)}>Restore pasted backup</button>
      <div className="hr" />
      <button className="btn danger block" onClick={async () => { if (await ask('Erase everything and start over with the default plan? Save a backup first if you might want it.')) { resetAll(); showToast('Reset to defaults'); onClose(); } }}>Reset all data</button>
      {node}
    </Sheet>
  );
}
