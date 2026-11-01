import { useState } from 'react';
import type { Food, GroceryCategory, Unit, Verification } from '../lib/types';
import { ALL_UNITS } from '../lib/units';
import { newId } from '../lib/nutrition';
import { Field, NumInput, UnitSelect } from './ui';

const CATS: GroceryCategory[] = ['Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery', 'Pantry', 'Snacks', 'Beverages', 'Supplements', 'Other'];
const VERS: { v: Verification; label: string }[] = [
  { v: 'label', label: 'Official manufacturer label' }, { v: 'retailer-label', label: 'Retailer label listing' },
  { v: 'database', label: 'Food composition database (USDA etc.)' }, { v: 'estimate', label: 'Estimate / unverified' }, { v: 'user', label: 'My own entry' },
];

export default function FoodForm({ initial, onSave, onDelete }: { initial: Food | null; onSave: (f: Food) => void; onDelete?: () => void }) {
  const [f, setF] = useState<Food>(() => initial ? structuredClone(initial) : {
    id: newId('food'), brand: '', name: '', servingSize: 1, servingUnit: 'serving',
    nutrients: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: null },
    sourceName: '', sourceUrl: '', verification: 'user', category: 'Other',
    purchase: { unit: 'serving', packageSize: 1, packageLabel: 'package' },
  });
  const set = (p: Partial<Food>) => setF((x) => ({ ...x, ...p }));
  const setN = (k: keyof Food['nutrients'], v: number | null) => setF((x) => ({ ...x, nutrients: { ...x.nutrients, [k]: k === 'sugar' ? v : (v ?? 0) } }));
  const pur = f.purchase ?? { unit: f.servingUnit, packageSize: 1, packageLabel: 'package' };
  const setP = (p: Partial<NonNullable<Food['purchase']>>) => setF((x) => ({ ...x, purchase: { ...pur, ...p } }));
  const valid = f.name.trim() && f.servingSize > 0;

  return (
    <div>
      <div className="grid2">
        <Field label="Brand"><input className="input" value={f.brand} onChange={(e) => set({ brand: e.target.value })} /></Field>
        <Field label="Product name"><input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} aria-label="Product name" /></Field>
      </div>
      <div className="grid2">
        <Field label="Flavor (optional)"><input className="input" value={f.flavor ?? ''} onChange={(e) => set({ flavor: e.target.value || undefined })} /></Field>
        <Field label="Values refer to">
          <select className="select" value={f.state ?? 'as sold'} onChange={(e) => set({ state: e.target.value as Food['state'] })}>
            {['as sold', 'cooked', 'raw', 'dry', 'prepared'].map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid2">
        <Field label="Serving size"><NumInput value={f.servingSize} onChange={(v) => set({ servingSize: v ?? 0 })} ariaLabel="Serving size" /></Field>
        <Field label="Serving unit"><UnitSelect value={f.servingUnit} units={ALL_UNITS} onChange={(u: Unit) => set({ servingUnit: u })} /></Field>
      </div>
      <div className="grid2">
        <Field label="Grams per serving (opt.)"><NumInput value={f.gramsPerServing} onChange={(v) => set({ gramsPerServing: v ?? undefined })} /></Field>
        <Field label="mL per serving (opt.)"><NumInput value={f.mlPerServing} onChange={(v) => set({ mlPerServing: v ?? undefined })} /></Field>
      </div>
      <div className="cat-head">Nutrition per serving</div>
      <div className="grid3">
        <Field label="Calories"><NumInput value={f.nutrients.calories} onChange={(v) => setN('calories', v)} ariaLabel="Calories" /></Field>
        <Field label="Protein g"><NumInput value={f.nutrients.protein} onChange={(v) => setN('protein', v)} ariaLabel="Protein" /></Field>
        <Field label="Carbs g"><NumInput value={f.nutrients.carbs} onChange={(v) => setN('carbs', v)} ariaLabel="Carbs" /></Field>
        <Field label="Fat g"><NumInput value={f.nutrients.fat} onChange={(v) => setN('fat', v)} ariaLabel="Fat" /></Field>
        <Field label="Fiber g"><NumInput value={f.nutrients.fiber} onChange={(v) => setN('fiber', v)} /></Field>
        <Field label="Sugar g"><NumInput value={f.nutrients.sugar} onChange={(v) => setN('sugar', v)} placeholder="n/a" /></Field>
      </div>
      <div className="cat-head">Source</div>
      <Field label="Verification">
        <select className="select" value={f.verification} onChange={(e) => set({ verification: e.target.value as Verification })}>
          {VERS.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
        </select>
      </Field>
      <Field label="Source name"><input className="input" value={f.sourceName} onChange={(e) => set({ sourceName: e.target.value })} /></Field>
      <Field label="Source URL"><input className="input" value={f.sourceUrl} onChange={(e) => set({ sourceUrl: e.target.value })} inputMode="url" /></Field>
      <Field label="Notes"><textarea className="input" value={f.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} /></Field>
      <div className="cat-head">Shopping</div>
      <div className="grid2">
        <Field label="Grocery category">
          <select className="select" value={f.category} onChange={(e) => set({ category: e.target.value as GroceryCategory })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label="Buy in unit"><UnitSelect value={pur.unit} units={ALL_UNITS} onChange={(u) => setP({ unit: u })} /></Field>
      </div>
      <div className="grid2">
        <Field label="Package size"><NumInput value={pur.packageSize} onChange={(v) => setP({ packageSize: v ?? 1 })} /></Field>
        <Field label="Package name"><input className="input" value={pur.packageLabel} onChange={(e) => setP({ packageLabel: e.target.value })} /></Field>
      </div>
      {pur.conversion && (
        <div className="grid2">
          <Field label={`Buy per 1 ${pur.conversion.fromUnit} eaten`}><NumInput value={Math.round(pur.conversion.factor * 10000) / 10000} onChange={(v) => setP({ conversion: { ...pur.conversion!, factor: v ?? pur.conversion!.factor } })} /></Field>
          <div className="small muted" style={{ alignSelf: 'center' }}>{pur.conversion.label}</div>
        </div>
      )}
      <div className="grid2">
        <Field label="Price per package ($, opt.)"><NumInput value={pur.pricePerPackage} onChange={(v) => setP({ pricePerPackage: v ?? undefined })} /></Field>
        <label className="field"><span>Batch-cook on prep day</span>
          <select className="select" value={f.prepable ? 'yes' : 'no'} onChange={(e) => set({ prepable: e.target.value === 'yes' })}><option value="no">No</option><option value="yes">Yes</option></select>
        </label>
      </div>
      <button className="btn block" disabled={!valid} onClick={() => onSave({ ...f, name: f.name.trim(), brand: f.brand.trim() || 'Generic' })}>Save food</button>
      {onDelete && <button className="btn danger block" style={{ marginTop: 10 }} onClick={onDelete}>Archive food</button>}
    </div>
  );
}
