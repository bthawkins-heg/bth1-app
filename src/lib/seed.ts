import type { AppState, Food, MealItem, MealTemplate, Supplement, Nutrients } from './types';
import { today } from './date';

const n = (calories: number, protein: number, carbs: number, fat: number, fiber: number, sugar: number | null): Nutrients =>
  ({ calories, protein, carbs, fat, fiber, sugar });

const USDA_NOTE = 'Generic USDA SR Legacy reference value entered from the published dataset; it could not be re-fetched from this build environment. Confirm against FoodData Central or your package.';
const FDC = (q: string) => `https://fdc.nal.usda.gov/food-search?query=${encodeURIComponent(q)}&type=SR%20Legacy`;

export const SEED_FOODS: Food[] = [
  {
    id: 'eggs-eb', brand: "Eggland's Best", name: 'Large egg', servingSize: 1, servingUnit: 'each', gramsPerServing: 50,
    nutrients: n(60, 6, 0, 4, 0, 0), state: 'raw', category: 'Dairy & Eggs',
    sourceName: "Eggland's Best Classic Eggs label (Large)", sourceUrl: 'https://www.egglandsbest.com/product/classic-eggs', verification: 'label',
    purchase: { unit: 'each', packageSize: 18, packageLabel: '18-count carton' },
  },
  {
    id: 'bagel-dkb', brand: "Dave's Killer Bread", name: 'Plain Awesome bagel', servingSize: 1, servingUnit: 'each', gramsPerServing: 95,
    nutrients: n(260, 11, 48, 3, 3, 5), state: 'as sold', category: 'Bakery',
    sourceName: 'Retailer label listing (ShopRite, 5 ct 16.75 oz)', sourceUrl: 'https://www.shoprite.com/product/00013764028012', verification: 'retailer-label',
    notes: 'H-E-B lists a "10g protein" version as 260 kcal, 10g protein, 52g carbs, 6g fiber. Check the panel on your bag and edit if it differs.',
    purchase: { unit: 'each', packageSize: 5, packageLabel: '5-pack' },
  },
  {
    id: 'cream-cheese', brand: 'Generic', name: 'Cream cheese, regular', servingSize: 2, servingUnit: 'tbsp', gramsPerServing: 29,
    nutrients: n(99, 1.7, 1.2, 9.9, 0, 0.9), state: 'as sold', category: 'Dairy & Eggs',
    sourceName: 'USDA SR Legacy "Cheese, cream" (342 kcal/100 g)', sourceUrl: FDC('cheese cream'), verification: 'database', notes: USDA_NOTE,
    purchase: { unit: 'tbsp', packageSize: 16, packageLabel: '8 oz brick (≈16 tbsp)' },
  },
  {
    id: 'honey', brand: 'Generic', name: 'Honey', servingSize: 1, servingUnit: 'tsp', gramsPerServing: 7.1,
    nutrients: n(21, 0, 5.8, 0, 0, 5.8), category: 'Pantry',
    sourceName: 'USDA SR Legacy "Honey" (304 kcal/100 g)', sourceUrl: FDC('honey'), verification: 'database', notes: USDA_NOTE,
    purchase: { unit: 'tsp', packageSize: 48, packageLabel: '12 oz bottle (≈48 tsp)' },
  },
  {
    id: 'oj-simply', brand: 'Simply Orange', name: 'Pulp Free orange juice', servingSize: 8, servingUnit: 'fl oz', mlPerServing: 240,
    nutrients: n(110, 2, 26, 0, 0, 23), category: 'Beverages',
    sourceName: 'Retailer label listing (H-E-B), matches Kroger listing', sourceUrl: 'https://www.heb.com/product-detail/simply-orange-pulp-free-juice/998177', verification: 'retailer-label',
    purchase: { unit: 'fl oz', packageSize: 52, packageLabel: '52 fl oz bottle' },
  },
  {
    id: 'gainer-milkchoc', brand: 'Transparent Labs', name: 'Mass Gainer', flavor: 'Milk Chocolate', servingSize: 1, servingUnit: 'serving', gramsPerServing: 198,
    nutrients: n(740, 53, 109, 12, 8, 15), category: 'Supplements',
    sourceName: 'Label transcribed in BarBend review (Milk Chocolate, 2 scoops)', sourceUrl: 'https://barbend.com/transparent-labs-mass-gainer-review', verification: 'retailer-label',
    notes: 'Transparent Labs states 760–770 kcal and 53–55 g protein per serving depending on flavor. Copy the exact panel from your bag.',
    purchase: { unit: 'serving', packageSize: 15, packageLabel: 'bag (check servings on your bag)' },
  },
  {
    id: 'gainer-donut', brand: 'Transparent Labs', name: 'Mass Gainer', flavor: 'Chocolate Glaze Donut', servingSize: 1, servingUnit: 'serving',
    nutrients: n(760, 53, 109, 13, 0, null), category: 'Supplements',
    sourceName: 'Manufacturer range (760–770 kcal, 53–55 g protein) + Garage Gym Reviews carbs/fat', sourceUrl: 'https://www.transparentlabs.com/products/mass-gainer', verification: 'estimate',
    notes: 'Per-flavor panel is only published as an image. Fiber/sugar unknown. Enter your bag\'s panel to verify.',
    purchase: { unit: 'serving', packageSize: 15, packageLabel: 'bag (check servings on your bag)' },
  },
  {
    id: 'gainer-vanilla', brand: 'Transparent Labs', name: 'Mass Gainer', flavor: 'Sweet Vanilla', servingSize: 1, servingUnit: 'serving',
    nutrients: n(760, 53, 109, 13, 0, null), category: 'Supplements',
    sourceName: 'Manufacturer range (760–770 kcal, 53–55 g protein) + Garage Gym Reviews carbs/fat', sourceUrl: 'https://www.transparentlabs.com/products/mass-gainer', verification: 'estimate',
    notes: 'Per-flavor panel is only published as an image. Fiber/sugar unknown. Enter your bag\'s panel to verify.',
    purchase: { unit: 'serving', packageSize: 15, packageLabel: 'bag (check servings on your bag)' },
  },
  {
    id: 'milk-fairlife', brand: 'fairlife', name: 'Whole ultra-filtered milk', servingSize: 8, servingUnit: 'fl oz', mlPerServing: 240,
    nutrients: n(150, 13, 6, 8, 0, 6), category: 'Dairy & Eggs',
    sourceName: 'fairlife Whole nutrition panel (1 cup / 240 ml)', sourceUrl: 'https://fairlife.com/our-products/whole', verification: 'label',
    purchase: { unit: 'fl oz', packageSize: 52, packageLabel: '52 fl oz bottle' },
  },
  {
    id: 'beef-8020-cooked', brand: 'Thomas Farms', name: '80/20 ground beef (cooked)', servingSize: 100, servingUnit: 'g',
    nutrients: n(272, 25.9, 0, 17.9, 0, 0), state: 'cooked', category: 'Meat & Seafood', prepable: true,
    sourceName: 'USDA SR Legacy "Beef, ground, 80% lean / 20% fat, crumbles, cooked, pan-browned"', sourceUrl: FDC('beef ground 80% lean crumbles pan-browned'), verification: 'database',
    notes: 'Measured by COOKED weight. Thomas Farms labels list RAW values, so the generic cooked value is used. ' + USDA_NOTE,
    purchase: { unit: 'lb', conversion: { fromUnit: 'oz', factor: 1 / (0.7 * 16), label: 'raw lb, assuming ~70% cooked yield (estimate; varies with fat drained)' }, packageSize: 1, packageLabel: '1 lb pack (raw)' },
  },
  {
    id: 'chicken-cooked', brand: 'Generic', name: 'Chicken breast (cooked)', servingSize: 100, servingUnit: 'g',
    nutrients: n(165, 31, 0, 3.6, 0, 0), state: 'cooked', category: 'Meat & Seafood', prepable: true,
    sourceName: 'USDA SR Legacy "Chicken, broilers, breast, meat only, roasted"', sourceUrl: FDC('chicken breast meat only roasted'), verification: 'database', notes: USDA_NOTE,
    purchase: { unit: 'lb', conversion: { fromUnit: 'oz', factor: 1 / (0.75 * 16), label: 'raw lb, assuming ~75% cooked yield (estimate)' }, packageSize: 1, packageLabel: '1 lb pack (raw)' },
  },
  {
    id: 'salmon-cooked', brand: 'Generic', name: 'Atlantic salmon (cooked)', servingSize: 100, servingUnit: 'g',
    nutrients: n(206, 22.1, 0, 12.4, 0, 0), state: 'cooked', category: 'Meat & Seafood',
    sourceName: 'USDA SR Legacy "Fish, salmon, Atlantic, farmed, cooked, dry heat"', sourceUrl: FDC('salmon atlantic farmed cooked dry heat'), verification: 'database', notes: USDA_NOTE,
    purchase: { unit: 'lb', conversion: { fromUnit: 'oz', factor: 1 / (0.8 * 16), label: 'raw lb, assuming ~80% cooked yield (estimate)' }, packageSize: 1, packageLabel: '1 lb fillet (raw)' },
  },
  {
    id: 'rice-jasmine-cooked', brand: 'Generic', name: 'Jasmine rice (cooked)', servingSize: 1, servingUnit: 'cup', gramsPerServing: 158,
    nutrients: n(205, 4.3, 44.5, 0.4, 0.6, 0.1), state: 'cooked', category: 'Pantry', prepable: true,
    sourceName: 'USDA SR Legacy "Rice, white, long-grain, regular, enriched, cooked" (proxy for jasmine)', sourceUrl: FDC('rice white long-grain regular enriched cooked'), verification: 'database',
    notes: 'Jasmine is a long-grain white rice; the generic cooked value is used until you enter your brand\'s label. ' + USDA_NOTE,
    purchase: { unit: 'cup', conversion: { fromUnit: 'cup', factor: 1 / 3, label: 'cups DRY rice (~1 cup dry → ~3 cups cooked, estimate)' }, packageSize: 4.9, packageLabel: '2 lb bag (≈4.9 cups dry)' },
  },
  {
    id: 'olive-oil', brand: 'Generic', name: 'Olive oil', servingSize: 1, servingUnit: 'tbsp', gramsPerServing: 13.5,
    nutrients: n(119, 0, 0, 13.5, 0, 0), category: 'Pantry',
    sourceName: 'USDA SR Legacy "Oil, olive, salad or cooking"', sourceUrl: FDC('oil olive salad or cooking'), verification: 'database', notes: USDA_NOTE,
    purchase: { unit: 'tbsp', packageSize: 33.8, packageLabel: '16.9 fl oz bottle (≈34 tbsp)' },
  },
  {
    id: 'chobani-30g', brand: 'Chobani', name: '30g Protein drink', flavor: 'Vanilla', servingSize: 1, servingUnit: 'bottle', mlPerServing: 414,
    nutrients: n(220, 30, 17, 4, 1, 11), category: 'Dairy & Eggs',
    sourceName: 'Retailer label listing (ShopRite, Vanilla 14 fl oz). Mango on H-E-B is the same except 12 g sugar.', sourceUrl: 'https://www.shoprite.com/product/00818290015631', verification: 'retailer-label',
    purchase: { unit: 'bottle', packageSize: 1, packageLabel: '14 fl oz bottle' },
  },
  {
    id: 'pretzels', brand: 'Generic', name: 'Pretzels, hard, salted', servingSize: 1, servingUnit: 'oz', gramsPerServing: 28.35,
    nutrients: n(108, 2.9, 22.6, 0.8, 0.8, 0.8), category: 'Snacks',
    sourceName: 'USDA SR Legacy "Snacks, pretzels, hard, plain, salted"', sourceUrl: FDC('pretzels hard plain salted'), verification: 'database', notes: USDA_NOTE,
    purchase: { unit: 'oz', packageSize: 16, packageLabel: '16 oz bag' },
  },
  {
    id: 'apple-juice', brand: 'Generic', name: 'Apple juice, 100%', servingSize: 8, servingUnit: 'fl oz', mlPerServing: 237,
    nutrients: n(114, 0.2, 28, 0.3, 0.5, 24), category: 'Beverages',
    sourceName: 'USDA SR Legacy "Apple juice, canned or bottled, unsweetened"', sourceUrl: FDC('apple juice canned or bottled unsweetened'), verification: 'database', notes: USDA_NOTE,
    purchase: { unit: 'fl oz', packageSize: 64, packageLabel: '64 fl oz bottle' },
  },
  {
    id: 'pineapple-juice', brand: 'Generic', name: 'Pineapple juice, 100%', servingSize: 8, servingUnit: 'fl oz', mlPerServing: 237,
    nutrients: n(133, 0.9, 32.2, 0.3, 0.5, 25), category: 'Beverages',
    sourceName: 'USDA SR Legacy "Pineapple juice, canned, unsweetened"', sourceUrl: FDC('pineapple juice canned unsweetened'), verification: 'database', notes: USDA_NOTE,
    purchase: { unit: 'fl oz', packageSize: 46, packageLabel: '46 fl oz can' },
  },
  {
    id: 'cranberry-cocktail', brand: 'Ocean Spray', name: 'Cranberry juice cocktail', servingSize: 8, servingUnit: 'fl oz', mlPerServing: 237,
    nutrients: n(110, 0, 28, 0, 0, 27), category: 'Beverages',
    sourceName: 'Commonly listed Ocean Spray label value — the official page could not be fetched', sourceUrl: 'https://www.oceanspray.com/', verification: 'estimate',
    notes: 'Not verified. Older USDA data for generic cranberry cocktail is higher (~137 kcal / 8 fl oz). Copy the panel from your bottle.',
    purchase: { unit: 'fl oz', packageSize: 64, packageLabel: '64 fl oz bottle' },
  },
];

let idc = 0;
const mi = (foodId: string, qty: number, unit: MealItem['unit'], alternatives?: string[]): MealItem =>
  ({ id: `seed-${++idc}`, foodId, qty, unit, alternatives });

const JUICES = ['oj-simply', 'apple-juice', 'pineapple-juice', 'cranberry-cocktail'];
const GAINERS = ['gainer-milkchoc', 'gainer-donut', 'gainer-vanilla'];

export const SEED_MEALS: MealTemplate[] = [
  {
    id: 'm-breakfast', name: 'Breakfast', emoji: '🍳', items: [
      mi('eggs-eb', 2, 'each'), mi('bagel-dkb', 1, 'each'), mi('cream-cheese', 2, 'tbsp'), mi('honey', 2, 'tsp'),
      mi('oj-simply', 12, 'fl oz', JUICES),
    ],
  },
  {
    id: 'm-shake', name: 'Mass Gainer Shake', emoji: '🥤', items: [
      mi('gainer-milkchoc', 1, 'serving', GAINERS), mi('milk-fairlife', 16, 'fl oz'),
    ],
  },
  {
    id: 'm-dinner', name: 'Dinner', emoji: '🍚', items: [
      mi('beef-8020-cooked', 6, 'oz', ['beef-8020-cooked', 'chicken-cooked', 'salmon-cooked']),
      mi('rice-jasmine-cooked', 1.5, 'cup'), mi('olive-oil', 1.5, 'tbsp'),
    ],
  },
  {
    id: 'm-snacks', name: 'Snacks & Drinks', emoji: '🥨', items: [
      mi('chobani-30g', 1, 'bottle'), mi('pretzels', 2, 'oz'), mi('apple-juice', 12, 'fl oz', JUICES),
      mi('pineapple-juice', 12, 'fl oz', JUICES),
    ],
  },
];

const S = (id: string, brand: string, name: string, extra: Partial<Supplement> = {}): Supplement => ({
  id, brand, name, servingSize: '1 serving', frequency: 'unset', preWorkout: false, postWorkout: false, withMeal: '',
  active: true, tags: { creatine: false, vitaminD: false, stimulant: false }, tagSource: 'Not tagged yet — check the label and tag it in Settings', ...extra,
});

export const SEED_SUPPLEMENTS: Supplement[] = [
  S('sup-greens', 'Transparent Labs', 'Greens', { frequency: 'daily', notes: 'Set to daily because your 7-day grocery list includes 7 servings. Change any time.' }),
  S('sup-metamucil', 'Metamucil', 'Clear Fiber Blend', { frequency: 'daily', notes: 'Set to daily because your 7-day grocery list includes 7 servings. Change any time.' }),
  S('sup-multi', 'Transparent Labs', 'Multivitamin', { tags: { creatine: false, vitaminD: true, stimulant: false }, tagSource: 'Multivitamins typically include vitamin D — confirm on label' }),
  S('sup-creatine', 'Transparent Labs', 'Creatine HMB', { tags: { creatine: true, vitaminD: false, stimulant: false }, tagSource: 'Creatine is in the product name' }),
  S('sup-krill', 'Transparent Labs', 'Krill Oil'),
  S('sup-vitality', 'Transparent Labs', 'Vitality'),
  S('sup-collagen', 'Transparent Labs', 'Collagen'),
  S('sup-magnesium', 'Transparent Labs', 'Magnesium'),
  S('sup-d3k2', 'Transparent Labs', 'D3 + K2', { tags: { creatine: false, vitaminD: true, stimulant: false }, tagSource: 'Vitamin D3 is in the product name' }),
  S('sup-hydrate', 'Transparent Labs', 'Hydrate'),
  S('sup-sleep', 'Transparent Labs', 'Sleep & Recover'),
  S('sup-savage', 'RAW', 'Savage'),
  S('sup-pump', 'RAW', 'Pump', { tagSource: 'Sold as a non-stim pre-workout (retailer listing) — confirm on label' }),
  S('sup-aminos', 'RAW', 'Aminos'),
  S('sup-evp', 'Evogen', 'EVP Xtreme', { tags: { creatine: false, vitaminD: false, stimulant: true }, tagSource: 'Sold as an energy/focus pre-workout (stack3d.com) — confirm caffeine and creatine on label' }),
];

const PUBLIC = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_PUBLIC === '1';

export function seedState(): AppState {
  const t = today();
  const goals = { calories: 3400, protein: 170, carbs: 455, fat: 100 };
  return {
    version: 1,
    updatedAt: 0,
    // The public (home-screen) build ships without personal details; they are entered on first use.
    profile: PUBLIC ? { name: '', startWeight: 0, goalWeight: 0, heightIn: 0, startDate: t } : { name: 'Benjamin', startWeight: 145, goalWeight: 180, heightIn: 70, startDate: t },
    goals,
    goalHistory: [{ date: t, goals, note: 'Starting targets' }],
    prefs: { distanceUnit: 'mi', weightUnit: 'lb', notifications: false, groceryDays: 7, prepDays: [0, 3], weekStartsOn: 0 },
    foods: SEED_FOODS.map((f) => structuredClone(f)),
    meals: SEED_MEALS.map((m) => structuredClone(m)),
    plans: [{
      id: 'plan-standard', name: 'Standard day',
      slots: SEED_MEALS.map((m, i) => ({ id: `slot-${i + 1}`, mealId: m.id })),
    }],
    schedule: { weekdays: { 0: 'plan-standard', 1: 'plan-standard', 2: 'plan-standard', 3: 'plan-standard', 4: 'plan-standard', 5: 'plan-standard', 6: 'plan-standard' }, overrides: {} },
    days: {},
    pantry: {},
    groceryChecked: {},
    supplements: SEED_SUPPLEMENTS.map((s) => structuredClone(s)),
    programs: [{ id: 'prog-main', name: 'My Program', paused: false }],
    activeProgramId: 'prog-main',
    templates: [],
    scheduleEntries: [],
    exceptions: {},
    sessions: [],
    weights: [],
    prep: {},
  };
}
