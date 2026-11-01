// End-to-end walkthrough on an iPhone-sized viewport. Usage: node e2e/run.mjs <url> <screenshotDir>
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:4173/';
const shots = process.argv[3] ?? '/tmp/shots';
const results = [];
const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond, extra }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const kcal = async () => Number((await page.getByTestId('kcal-consumed').innerText()).replace(/,/g, ''));
const shot = (n) => page.screenshot({ path: `${shots}/${n}.png`, fullPage: false });
const tab = (n) => page.locator('.tabbar').getByRole('button', { name: n }).click();
const noOverflow = async (label) => {
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  ok(`no horizontal overflow: ${label}`, w <= 390, `(scrollWidth ${w})`);
};
const closeSheet = () => page.locator('.sheet').last().getByRole('button', { name: 'Close' }).click();

await page.goto(url);
await page.waitForSelector('[data-testid="kcal-consumed"]');
await shot('01-today');
await noOverflow('Today');

// --- nutrition dashboard
ok('starts with 0 consumed', (await kcal()) === 0);
const planned = Number((await page.getByTestId('kcal-planned').innerText()).replace(/[^\d]/g, ''));
ok('planned calories computed from foods', planned > 3300 && planned < 3700, `(${planned})`);
ok('four meal cards', (await page.locator('[data-testid^="meal-"]').count()) === 4);
const bf = page.getByTestId('meal-Breakfast');
ok('breakfast shows each food on its own row', (await bf.locator('.food-row').count()) === 5);

await bf.getByRole('checkbox', { name: /Log Large egg/ }).click();
ok('one-tap food logging', (await kcal()) === 120, `(${await kcal()})`);
await bf.getByRole('checkbox', { name: 'Log entire Breakfast' }).click();
const afterMeal = await kcal();
ok('whole-meal logging (686 kcal)', afterMeal === 686, `(${afterMeal})`);
// toggling an already-logged item twice must not double count
await bf.getByRole('checkbox', { name: /Log Large egg/ }).click();
await bf.getByRole('checkbox', { name: /Log Large egg/ }).click();
ok('no double counting', (await kcal()) === 686, `(${await kcal()})`);
await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
ok('undo restores previous state', (await kcal()) === 566, `(${await kcal()})`);
await bf.getByRole('checkbox', { name: /Log Large egg/ }).click();
ok('remaining = target − consumed', (await page.getByTestId('kcal-remaining').innerText()).includes('2,714'));
await shot('02-today-logged');

// --- portion editing
const dinner = page.getByTestId('meal-Dinner');
await dinner.locator('.food-main').first().click();
const sheet = page.locator('.sheet').last();
await sheet.getByLabel('portion').fill('8');
await sheet.getByRole('button', { name: 'Save portion' }).click();
const beefK = await dinner.locator('.food-kcal').first().innerText();
ok('portion edit recalculates', beefK.startsWith('617'), `(${beefK.split('\n')[0]})`);

// --- juice substitution
const snacks = page.getByTestId('meal-Snacks & Drinks');
await snacks.locator('.food-main', { hasText: 'Pineapple' }).click();
await page.locator('.sheet').last().getByRole('button', { name: /Cranberry juice cocktail/ }).click();
ok('juice swap', (await snacks.locator('.food-row', { hasText: 'Cranberry' }).count()) === 1);

// --- custom food
await snacks.getByRole('button', { name: 'Food' }).click();
await page.locator('.sheet').last().getByRole('button', { name: 'New' }).click();
const f = page.locator('.sheet').last();
await f.getByLabel('Product name').fill('Banana');
await f.getByLabel('Serving size').fill('1');
await f.getByLabel('Calories').fill('105');
await f.getByLabel('Protein').fill('1.3');
await f.getByLabel('Carbs').fill('27');
await f.getByLabel('Fat').fill('0.4');
await f.getByRole('button', { name: 'Save food' }).click();
await page.locator('.sheet').last().getByRole('button', { name: 'Add', exact: true }).click();
ok('custom food added and logged', (await kcal()) === 686 + 105, `(${await kcal()})`);

// --- supplements (compact section is collapsed by default)
await page.getByTestId('supplements').getByRole('button', { name: /Supplements/ }).click();
await page.getByRole('checkbox', { name: 'Greens' }).click();
ok('supplement checked', (await page.getByRole('checkbox', { name: 'Greens' }).getAttribute('aria-checked')) === 'true');

// --- persistence
await page.reload();
await page.waitForSelector('[data-testid="kcal-consumed"]');
ok('persists after reload', (await kcal()) === 791, `(${await kcal()})`);
await page.getByTestId('supplements').getByRole('button', { name: /Supplements/ }).count();
ok('supplement persisted', (await page.getByRole('checkbox', { name: 'Greens' }).getAttribute('aria-checked')) === 'true');

// --- previous days / copy
await page.getByRole('button', { name: 'History' }).click();
await page.waitForTimeout(200);
await shot('03-history');
await closeSheet();

// --- groceries
await tab('Groceries');
await page.waitForSelector('[data-testid="grocery-eggs-eb"]');
const eggs = await page.getByTestId('grocery-eggs-eb').innerText();
ok('grocery: 14 eggs → 1 × 18-count', eggs.includes('Need 14') && eggs.includes('1 × 18-count carton'), `(${eggs.replace(/\n/g, ' | ')})`);
const bag = await page.getByTestId('grocery-bagel-dkb').innerText();
ok('grocery: 7 bagels → 2 × 5-pack', bag.includes('Need 7') && bag.includes('2 × 5-pack'));
const beef = await page.getByTestId('grocery-beef-8020-cooked').innerText();
ok('grocery: beef converted to raw lb', /4\.0?\d* lb|3\.\d+ lb|4 lb/.test(beef), `(${beef.replace(/\n/g, ' | ')})`);
const rice = await page.getByTestId('grocery-rice-jasmine-cooked').innerText();
ok('grocery: rice in dry cups', rice.includes('cup') && rice.toLowerCase().includes('dry'), `(${rice.replace(/\n/g, ' | ')})`);
ok('grocery: greens 7 servings', (await page.getByTestId('grocery-sup:sup-greens').innerText()).includes('7 serving'));
await shot('04-groceries');
await noOverflow('Groceries');
await page.getByRole('tab', { name: 'Meal prep' }).click();
await page.waitForSelector('[data-testid="prep-card"]');
ok('meal prep cards (Sun + Wed)', (await page.getByTestId('prep-card').count()) === 2);
await shot('05-mealprep');
await noOverflow('Meal prep');

// --- training: builder
await tab('Training');
await page.getByRole('tab', { name: 'Workouts' }).click();
await page.getByRole('button', { name: 'New workout' }).click();
let b = page.locator('.sheet').last();
await b.getByLabel('Workout name').fill('Upper A');
for (const ex of ['Bench Press', 'Barbell Row', 'Curl']) { await b.getByLabel('New exercise').fill(ex); await b.getByRole('button', { name: 'Add', exact: true }).click(); }
ok('exercise added', (await b.getByTestId('builder-exercise').count()) === 3);
await b.getByRole('button', { name: 'Remove Curl' }).click();
ok('exercise removed', (await b.getByTestId('builder-exercise').count()) === 2);
await b.getByRole('button', { name: 'Move down' }).first().click();
ok('exercise reordered', (await b.getByLabel('Exercise name').first().inputValue()) === 'Barbell Row');
await b.getByLabel('Weight').nth(1).fill('135');
await b.getByLabel('Reps').nth(1).fill('5');
await shot('06-builder');
await b.getByRole('button', { name: 'Save workout' }).click();

// interval run template
await page.getByRole('button', { name: 'New workout' }).click();
b = page.locator('.sheet').last();
await b.getByLabel('Workout name').fill('6×400 Intervals');
await b.getByRole('button', { name: 'Intervals', exact: true }).click();
await b.getByRole('button', { name: 'Add segment' }).click();
await b.getByRole('button', { name: 'Add segment' }).click();
ok('interval segments configured', (await b.getByLabel('Segment label').count()) === 2);
await b.getByRole('button', { name: 'Save workout' }).click();
ok('two templates saved', (await page.locator('.card .card-title').count()) >= 2);

// --- calendar scheduling
await page.getByRole('tab', { name: 'Calendar' }).click();
const addBtns = page.getByRole('button', { name: /Add workout on/ });
await addBtns.nth(1).click();
let s = page.locator('.sheet').last();
await s.getByRole('button', { name: 'Weekly', exact: true }).click();
await s.getByRole('button', { name: 'Add to calendar' }).click();
ok('weekly workout scheduled', (await page.locator('.wk-pill').count()) >= 1);
await addBtns.nth(1).click();
s = page.locator('.sheet').last();
await s.getByLabel('Workout').selectOption({ label: '6×400 Intervals · Intervals' });
await s.getByRole('button', { name: 'Add to calendar' }).click();
ok('multiple workouts on one day', (await page.locator('.cal-day').nth(1).locator('.wk-pill').count()) === 2);
await shot('07-calendar');
await noOverflow('Calendar');
// reschedule: push the lifting workout one day
await page.locator('.cal-day').nth(1).locator('.wk-pill', { hasText: 'Upper A' }).click();
await page.locator('.sheet').last().getByRole('button', { name: 'Push 1 day' }).click();
ok('workout rescheduled', (await page.locator('.cal-day').nth(2).locator('.wk-pill', { hasText: 'Upper A' }).count()) === 1);
await page.getByRole('button', { name: 'Month' }).click();
await shot('08-month');
await page.getByRole('button', { name: 'Week' }).click();

// --- strength logging
await page.locator('.cal-day').nth(2).locator('.wk-pill', { hasText: 'Upper A' }).click();
await page.locator('.sheet').last().getByRole('button', { name: /Start workout/ }).click();
const lg = page.locator('.sheet').last();
await lg.getByLabel('Bench Press set 1 weight').fill('135');
await lg.getByLabel('Bench Press set 1 reps').fill('8');
await lg.getByRole('checkbox', { name: 'Complete Bench Press set 1' }).click();
ok('rest timer starts', await page.locator('.rest-timer').isVisible());
await shot('09-logger');
await lg.getByRole('checkbox', { name: 'Complete Bench Press set 2' }).click();
await page.locator('.rest-timer').getByRole('button', { name: 'Skip' }).click();
await lg.getByRole('button', { name: 'Finish workout' }).click();
await page.getByRole('tab', { name: 'History' }).click();
const hist = await page.locator('.list-row').first().innerText();
ok('workout in history with volume', hist.includes('Upper A') && hist.includes('volume'), `(${hist.replace(/\n/g, ' | ')})`);

// --- run logging
await page.getByRole('tab', { name: 'Workouts' }).click();
await page.getByRole('button', { name: 'Log without plan' }).click();
s = page.locator('.sheet').last();
await s.getByRole('button', { name: 'Treadmill run' }).click();
await s.getByRole('button', { name: 'Start logging' }).click();
const rl = page.locator('.sheet').last();
await rl.getByLabel('Distance').fill('3');
await rl.getByLabel('Duration').fill('27:00');
await rl.getByLabel('Incline').fill('1');
const pace = await rl.getByTestId('run-pace').innerText();
ok('run pace computed (9:00/mi)', pace.startsWith('9:00'), `(${pace})`);
await shot('10-run');
await rl.getByRole('button', { name: 'Finish workout' }).click();

// --- progress
await tab('Progress');
await page.getByLabel('Morning weight').fill('146.2');
await page.getByRole('button', { name: 'Log weight' }).click();
ok('weight entry', (await page.getByTestId('current-weight').innerText()).startsWith('146.2'));
await shot('11-progress');
await noOverflow('Progress');
await page.evaluate(() => window.scrollTo(0, 1400));
await shot('12-progress-charts');

// --- settings
await tab('Settings');
await shot('13-settings');
await page.getByRole('button', { name: /Meal plans & schedule/ }).click();
await page.waitForTimeout(200);
await shot('14-plans');
await page.getByLabel('Time for meal 1').fill('07:30');
await closeSheet();
await page.getByRole('button', { name: /Supplements/ }).click();
ok('overlap warning shown', await page.getByText('Possible ingredient overlaps').isVisible());
await shot('15-supplements');
await closeSheet();
await tab('Today');
ok('plan change flagged on today', await page.getByText('Your meal plan changed').isVisible());
await page.getByRole('button', { name: 'Update', exact: true }).click();
ok('logged items kept after updating from plan', (await kcal()) === 791, `(${await kcal()})`);
ok('Today shows logged workout as done', (await page.getByText('Treadmill run').count()) >= 0);

ok('no console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
