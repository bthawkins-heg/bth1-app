import { useMemo, useState } from 'react';
import type { Food, Unit } from '../lib/types';
import { useApp, update } from '../lib/store';
import { foodLabel, foodNutrients, newId, r0, r1 } from '../lib/nutrition';
import { unitsFor } from '../lib/units';
import { Field, NumInput, Sheet, Stepper, Switch, UnitSelect, VerBadge } from './ui';
import FoodForm from './FoodForm';

/** Search the food database, choose an amount, and return it. Can create a custom food inline. */
export default function FoodPicker({ open, onClose, onPick, title = 'Add food', showLogToggle }: {
  open: boolean; onClose: () => void; title?: string; showLogToggle?: boolean;
  onPick: (foodId: string, qty: number, unit: Unit, logNow: boolean) => void;
}) {
  const foods = useApp((s) => s.foods);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Food | null>(null);
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState<Unit>('serving');
  const [logNow, setLogNow] = useState(true);
  const [creating, setCreating] = useState(false);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return foods.filter((f) => !f.archived && (!t || `${f.brand} ${f.name} ${f.flavor ?? ''}`.toLowerCase().includes(t)));
  }, [foods, q]);

  const choose = (f: Food) => { setSel(f); setQty(f.servingSize); setUnit(f.servingUnit); };
  const close = () => { setSel(null); setQ(''); setCreating(false); onClose(); };
  const preview = sel ? foodNutrients(sel, qty, unit) : null;

  return (
    <>
      <Sheet open={open && !creating} onClose={close} title={sel ? foodLabel(sel) : title} full
        right={sel ? <button className="btn ghost sm" onClick={() => setSel(null)}>Back</button> : <button className="btn ghost sm" onClick={() => setCreating(true)}>New</button>}>
        {!sel && (
          <>
            <input className="input" placeholder="Search foods" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search foods" style={{ marginBottom: 12 }} />
            <div className="list">
              {list.map((f) => (
                <button key={f.id} className="list-row" onClick={() => choose(f)}>
                  <div className="grow">
                    <div className="food-name">{foodLabel(f)}</div>
                    <div className="food-sub">{f.brand} · {f.servingSize} {f.servingUnit} · {r0(f.nutrients.calories)} kcal</div>
                  </div>
                  <VerBadge v={f.verification} />
                </button>
              ))}
              {!list.length && <div className="empty small">No match. Tap “New” to add a custom food.</div>}
            </div>
          </>
        )}
        {sel && (
          <>
            <div className="row" style={{ marginBottom: 12 }}><span className="muted small">{sel.brand}</span><VerBadge v={sel.verification} /></div>
            <div className="grid2">
              <Field label="Amount"><Stepper value={qty} onChange={setQty} step={sel.servingUnit === 'g' ? 10 : 0.5} ariaLabel="amount" /></Field>
              <Field label="Unit"><UnitSelect value={unit} units={unitsFor(sel)} onChange={setUnit} /></Field>
            </div>
            <div className="card">
              {preview ? (
                <div className="grid4 center">
                  <div><div className="tiny muted">kcal</div><b>{r0(preview.calories)}</b></div>
                  <div><div className="tiny muted">Protein</div><b>{r1(preview.protein)}g</b></div>
                  <div><div className="tiny muted">Carbs</div><b>{r1(preview.carbs)}g</b></div>
                  <div><div className="tiny muted">Fat</div><b>{r1(preview.fat)}g</b></div>
                </div>
              ) : <div className="muted small">This unit can’t be converted for this food. Pick another unit.</div>}
            </div>
            {showLogToggle && (
              <div className="row between card"><span>Mark as eaten now</span><Switch on={logNow} onChange={setLogNow} label="Mark as eaten" /></div>
            )}
            <button className="btn block" disabled={!preview || qty <= 0} onClick={() => { onPick(sel.id, qty, unit, logNow); close(); }}>Add</button>
          </>
        )}
      </Sheet>
      {creating && (
        <Sheet open onClose={() => setCreating(false)} title="New custom food" full>
          <FoodForm initial={null} onSave={(f) => { update((d) => { d.foods.push(f); }); setCreating(false); choose(f); }} />
        </Sheet>
      )}
    </>
  );
}

export function blankFood(): Food {
  return {
    id: newId('food'), brand: '', name: '', servingSize: 1, servingUnit: 'serving',
    nutrients: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: null },
    sourceName: '', sourceUrl: '', verification: 'user', category: 'Other',
  };
}

export { NumInput };
