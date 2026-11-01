import { useMemo, useState } from 'react';
import { useApp, update, showToast } from '../lib/store';
import * as A from '../lib/actions';
import { DEPARTMENTS, generateGroceries, groceryText, type GroceryLine } from '../lib/grocery';
import { coverage, nextPrepDate, prepBatch, PREP_STEPS, STORAGE_TIPS } from '../lib/prep';
import { addDays, fmtDate, relDay, today, WD_LONG, WD_SHORT, parse } from '../lib/date';
import { fmtQty, plural } from '../lib/units';
import type { Unit } from '../lib/types';

const u = (unit: string, n: number) => (['each'].includes(unit) ? '' : plural(unit as Unit, n) || unit);
import { Check, copyText, Empty, Field, Icon, NumInput, Segmented, Sheet, Stepper } from '../components/ui';

type View = 'list' | 'pantry' | 'prep';

export default function Groceries() {
  const [view, setView] = useState<View>('list');
  return (
    <div>
      <div className="screen-head"><div><h1 className="large-title">Groceries</h1><div className="subtitle">Built from your meal plan</div></div></div>
      <Segmented value={view} onChange={setView} options={[{ value: 'list', label: 'Shopping list' }, { value: 'pantry', label: 'Pantry' }, { value: 'prep', label: 'Meal prep' }]} />
      {view === 'list' && <ShoppingList />}
      {view === 'pantry' && <Pantry />}
      {view === 'prep' && <MealPrep />}
    </div>
  );
}

const fmt = (n: number) => fmtQty(Math.round(n * 100) / 100);

function ShoppingList() {
  const state = useApp((s) => s);
  const [start, setStart] = useState(today());
  const days = state.prefs.groceryDays;
  const lines = useMemo(() => generateGroceries(state, start, days), [state, start, days]);
  const [edit, setEdit] = useState<GroceryLine | null>(null);
  const toBuy = lines.filter((l) => l.toBuy > 0);
  const covered = lines.filter((l) => l.toBuy <= 0);
  const cost = toBuy.reduce((a, l) => a + (l.cost ?? 0), 0);
  const costKnown = toBuy.filter((l) => l.cost != null).length;
  const checkedCount = toBuy.filter((l) => state.groceryChecked[l.key]).length;
  const text = `Groceries · ${fmtDate(start)}–${fmtDate(addDays(start, days - 1))}\n` + groceryText(lines, state.groceryChecked, fmt);

  return (
    <div>
      <div className="card">
        <div className="grid2">
          <Field label="Starting"><input className="input" type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} aria-label="Shopping start date" /></Field>
          <Field label="Days to shop for"><Stepper value={days} min={1} onChange={(v) => update((d) => { d.prefs.groceryDays = Math.max(1, Math.round(v)); })} ariaLabel="Days to shop for" /></Field>
        </div>
        <div className="row between">
          <div className="small muted num">{toBuy.length} items · {checkedCount} in cart{costKnown ? ` · est. $${cost.toFixed(2)}${costKnown < toBuy.length ? ` (${costKnown} priced)` : ''}` : ''}</div>
          <div className="row">
            <button className="btn secondary sm" onClick={async () => showToast((await copyText(text)) ? 'List copied' : 'Copy failed')}><Icon name="copy" size={16} />Copy</button>
            <button className="btn secondary sm" onClick={async () => {
              try { if (navigator.share) { await navigator.share({ title: 'Grocery list', text }); return; } } catch { /* blocked */ }
              showToast((await copyText(text)) ? 'Sharing unavailable here, so the list was copied' : 'Share failed');
            }}><Icon name="share" size={16} />Share</button>
          </div>
        </div>
        {checkedCount > 0 && <button className="btn ghost sm" style={{ marginTop: 6, paddingLeft: 0 }} onClick={() => update((d) => { d.groceryChecked = {}; }, 'Cleared checkmarks')}>Clear checkmarks</button>}
      </div>

      {toBuy.length === 0 && <div className="card"><Empty icon="🛒" title="Nothing to buy">Your pantry covers this period.</Empty></div>}
      {DEPARTMENTS.map((dept) => {
        const items = toBuy.filter((l) => l.category === dept);
        if (!items.length) return null;
        return (
          <section key={dept} data-testid={`dept-${dept}`}>
            <div className="cat-head">{dept} <span className="muted">· {items.length}</span></div>
            <div className="list">
              {items.map((l) => {
                const checked = !!state.groceryChecked[l.key];
                const buy = l.packages > 0 && l.packageLabel ? `${l.packages} × ${l.packageLabel}` : `${fmt(l.toBuy)} ${u(String(l.needUnit), l.toBuy)}`;
                return (
                  <div key={l.key} className="list-row" style={{ alignItems: 'flex-start', opacity: checked ? .5 : 1 }} data-testid={`grocery-${l.key}`}>
                    <Check on={checked} onClick={() => update((d) => A.toggleGrocery(d, l.key))} label={`Got ${l.name}`} />
                    <button className="grow" style={{ textAlign: 'left' }} onClick={() => setEdit(l)}>
                      <div className="food-name" style={{ textDecoration: checked ? 'line-through' : 'none' }}>{l.brand !== 'Generic' ? `${l.brand} ` : ''}{l.name}</div>
                      <div className="food-buy" data-testid="buy">Buy {buy}{l.cost != null ? ` · $${l.cost.toFixed(2)}` : ''}</div>
                      <div className="food-sub num">
                        Need {fmt(l.needQty)} {u(String(l.needUnit), l.needQty)}{l.onHand > 0 ? ` · have ${fmt(l.onHand)}` : ''}
                      </div>
                      {l.conversionLabel && <div className="food-sub">Eaten as {l.required.map((r) => `${fmt(r.qty)} ${r.unit}`).join(' + ')} cooked · {l.conversionLabel}</div>}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      {covered.length > 0 && (
        <>
          <div className="cat-head">Already in pantry</div>
          <div className="list">
            {covered.map((l) => (
              <button key={l.key} className="list-row" onClick={() => setEdit(l)}>
                <div className="grow"><div className="food-name">{l.name}</div><div className="food-sub">Need {fmt(l.needQty)} {l.needUnit} · have {fmt(l.onHand)}</div></div>
                <span className="badge label">Covered</span>
              </button>
            ))}
          </div>
        </>
      )}
      <p className="tiny muted" style={{ margin: '12px 4px' }}>Quantities update automatically from your meal plan. Beef and rice purchase amounts use estimated cooked-yield conversions; edit the yield in Settings → Foods.</p>
      {edit && <PantrySheet line={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function PantrySheet({ line, onClose }: { line: GroceryLine; onClose: () => void }) {
  const state = useApp((s) => s);
  const food = state.foods.find((f) => f.id === line.key);
  const [have, setHave] = useState(state.pantry[line.key] ?? 0);
  const [price, setPrice] = useState<number | null>(food?.purchase?.pricePerPackage ?? null);
  return (
    <Sheet open onClose={onClose} title={line.name}>
      <div className="small muted" style={{ marginBottom: 12 }}>Needed for this period: {fmt(line.needQty)} {line.needUnit}. Used in {line.usedIn.join(', ')}.</div>
      <Field label={`On hand (${line.needUnit})`}><Stepper value={have} onChange={setHave} step={line.needUnit === 'lb' || line.needUnit === 'cup' ? 0.25 : 1} ariaLabel="On hand" /></Field>
      <div className="grid2" style={{ marginBottom: 12 }}>
        <button className="btn secondary" onClick={() => setHave(Math.ceil(line.needQty * 100) / 100)}>I have enough</button>
        <button className="btn secondary" onClick={() => setHave(0)}>I have none</button>
      </div>
      {food?.purchase && (
        <Field label={`Price per ${food.purchase.packageLabel} ($, optional)`}><NumInput value={price} onChange={setPrice} placeholder="Leave blank if unknown" /></Field>
      )}
      <button className="btn block" onClick={() => {
        update((d) => {
          A.setPantry(d, line.key, have);
          const f = d.foods.find((x) => x.id === line.key);
          if (f?.purchase) f.purchase.pricePerPackage = price ?? undefined;
        }, 'Pantry updated');
        onClose();
      }}>Save</button>
    </Sheet>
  );
}

function Pantry() {
  const state = useApp((s) => s);
  const lines = generateGroceries(state, today(), state.prefs.groceryDays);
  const [edit, setEdit] = useState<GroceryLine | null>(null);
  const items = lines;
  return (
    <div>
      <p className="small muted" style={{ margin: '0 4px 10px' }}>What you already own. On-hand amounts are subtracted from the shopping list.</p>
      <div className="list">
        {items.map((l) => {
          const have = state.pantry[l.key] ?? 0;
          const days = l.needQty > 0 ? (have / (l.needQty / state.prefs.groceryDays)) : 0;
          return (
            <button key={l.key} className="list-row" onClick={() => setEdit(l)}>
              <div className="grow">
                <div className="food-name">{l.name}</div>
                <div className="food-sub num">{have > 0 ? `${fmt(have)} ${l.needUnit} · lasts ~${Math.floor(days)} day${Math.floor(days) === 1 ? '' : 's'}` : 'None on hand'}</div>
              </div>
              <span className="chev">›</span>
            </button>
          );
        })}
      </div>
      {edit && <PantrySheet line={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function MealPrep() {
  const state = useApp((s) => s);
  const first = nextPrepDate(state, today());
  const dates: string[] = [];
  if (first) {
    dates.push(first);
    const next = nextPrepDate(state, addDays(first, coverage(state, first).length));
    if (next) dates.push(next);
  }
  return (
    <div>
      <div className="card">
        <div className="card-title" style={{ marginBottom: 8 }}>Prep days</div>
        <div className="chips" style={{ flexWrap: 'wrap' }}>
          {WD_SHORT.map((w, i) => (
            <button key={w} className={`chip ${state.prefs.prepDays.includes(i) ? 'active' : ''}`}
              onClick={() => update((d) => { const p = d.prefs.prepDays; d.prefs.prepDays = p.includes(i) ? p.filter((x) => x !== i) : [...p, i].sort(); })}>{w}</button>
          ))}
        </div>
        <div className="small muted" style={{ marginTop: 8 }}>Each batch covers the days until your next prep day.</div>
      </div>
      {!dates.length && <div className="card"><Empty icon="🍳" title="No prep days">Choose at least one prep day above.</Empty></div>}
      {dates.map((d) => <PrepCard key={d} date={d} />)}
      <div className="section-title">Storage</div>
      <div className="card"><ul style={{ margin: 0, paddingLeft: 18 }} className="small">{STORAGE_TIPS.map((t) => <li key={t} style={{ marginBottom: 6 }}>{t}</li>)}</ul>
        <div className="tiny muted">Source: <a href="https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/leftovers-and-food-safety" target="_blank" rel="noreferrer">USDA FSIS leftovers guidance</a></div>
      </div>
    </div>
  );
}

function PrepCard({ date }: { date: string }) {
  const state = useApp((s) => s);
  const b = prepBatch(state, date);
  const rec = state.prep[date];
  const coverText = `${WD_SHORT[parse(b.coversDays[0]).getDay()]}–${WD_SHORT[parse(b.coversDays[b.coversDays.length - 1]).getDay()]}`;
  return (
    <div className="card" data-testid="prep-card">
      <div className="row between">
        <div>
          <div className="card-title">{WD_LONG[parse(date).getDay()]} prep</div>
          <div className="small muted">{relDay(date)} · covers {coverText} ({b.coversDays.length} day{b.coversDays.length > 1 ? 's' : ''})</div>
        </div>
        {rec?.completed && <span className="badge label">Done</span>}
      </div>
      {b.items.length === 0 ? <div className="small muted" style={{ marginTop: 10 }}>No batch-cook foods are planned for these days.</div> : (
        <>
          <div className="cat-head">Batch quantities</div>
          {b.items.map((i) => (
            <div key={i.foodId + i.unit} className="row between" style={{ padding: '6px 0' }}>
              <div className="small"><b>{i.name}</b><div className="muted tiny">{fmt(i.perDay)} {i.unit} per day</div></div>
              <div className="small num" style={{ textAlign: 'right' }}>
                <b>{fmt(i.cookedQty)} {i.unit} cooked</b>
                {i.buyQty != null && i.buyUnit && <div className="muted tiny">≈ {fmt(i.buyQty)} {i.buyLabel?.split(',')[0]}</div>}
              </div>
            </div>
          ))}
          <div className="cat-head">Portioning</div>
          <div className="small">Make <b>{b.portions}</b> container{b.portions > 1 ? 's' : ''}, each with {b.items.map((i) => `${fmt(i.perDay)} ${i.unit} ${i.name.replace(/\s*\(cooked\)/, '').toLowerCase()}`).join(' + ')}.
            {b.coversDays.length > 3 && ' Freeze the last container(s) beyond day 3 and move them to the fridge the night before.'}</div>
        </>
      )}
      <div className="cat-head">Checklist</div>
      {PREP_STEPS.map((s) => (
        <div key={s.id} className="row" style={{ padding: '6px 0', alignItems: 'flex-start' }}>
          <Check on={!!rec?.done[s.id]} onClick={() => update((d) => A.togglePrepStep(d, date, s.id))} label={s.text} />
          <div className="small grow" style={{ paddingTop: 4, color: rec?.done[s.id] ? 'var(--sub)' : undefined }}>{s.text}</div>
        </div>
      ))}
      <button className={`btn block ${rec?.completed ? 'secondary' : 'green'}`} style={{ marginTop: 10 }} onClick={() => update((d) => A.setPrepComplete(d, date, !rec?.completed), rec?.completed ? 'Prep marked not done' : 'Meal prep complete')}>
        {rec?.completed ? 'Mark not done' : 'Mark prep complete'}
      </button>
    </div>
  );
}
