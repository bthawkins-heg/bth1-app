// Feature review walkthrough at iPhone 13/14 size. Prints PASS/FAIL per check, grouped by the 9 review areas.
// Usage: node e2e/review.mjs <url> <screenshotDir>
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:4173/';
const shots = process.argv[3] ?? '/tmp/shots';
const results = [];
let area = '';
const section = (name) => { area = name; console.log(`\n== ${name}`); };
const ok = (name, cond, extra = '') => { results.push({ area, name, pass: !!cond, extra }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const num = (t) => Number(String(t).replace(/[^\d.-]/g, ''));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
let page = await ctx.newPage();
const errors = [];
const watch = (p) => { p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); };
watch(page);
const tab = (n) => page.locator('.tabbar').getByRole('button', { name: n }).click();
const top = () => page.locator('.sheet').last();
const close = async () => { await top().getByRole('button', { name: 'Close' }).click(); await page.waitForTimeout(80); };
const confirm = () => page.locator('.sheet').last().getByRole('button', { name: 'Confirm' }).click();
const kcal = async () => num(await page.getByTestId('kcal-consumed').innerText());
const y = async (loc) => (await loc.first().boundingBox())?.y ?? -1;

await page.goto(url);
await page.waitForSelector('[data-testid="kcal-consumed"]');

// ------------------------------------------------------------------ 1
section('1 Today layout');
const yHero = await y(page.locator('.hero'));
const yComing = await y(page.getByTestId('coming-up'));
const yWorkout = await y(page.locator('.section-title', { hasText: /^Workout/ }));
const yMeals = await y(page.locator('.section-title', { hasText: /^Meals/ }));
const ySupp = await y(page.getByTestId('supplements'));
ok('order: calories/macros → coming up → workout → meals → supplements', yHero < yComing && yComing < yWorkout && yWorkout < yMeals && yMeals < ySupp, `(${[yHero, yComing, yWorkout, yMeals, ySupp].map(Math.round).join(' < ')})`);
ok('calories and all macro bars on first screen', yComing < 844 && (await page.getByTestId('macro-fat').boundingBox()).y < 844);
ok('coming up lists the 4 planned meals in order', (await page.getByTestId('coming-up').locator('.list-row').count()) === 4
  && (await page.getByTestId('coming-up').locator('.list-row').first().innerText()).includes('Breakfast'));
ok('supplements collapsed by default', (await page.getByTestId('supplements').getByRole('checkbox').count()) === 0);
await page.getByTestId('supplements').getByRole('button', { name: /Supplements/ }).click();
ok('supplements expand into groups', (await page.getByTestId('supplements').locator('.cat-head').allInnerTexts()).join(',').includes('DAILY') || (await page.getByTestId('supplements').locator('.cat-head').allInnerTexts()).join(',').toLowerCase().includes('daily'));
await page.screenshot({ path: `${shots}/r01-today-top.png` });

// ------------------------------------------------------------------ 2
section('2 Supplements');
const supText = await page.getByTestId('supplements').innerText();
ok('no "Not scheduled" labels on Today', !/not scheduled/i.test(supText));
ok('Daily group shows Greens + Metamucil, Optional shows the rest', /Daily[\s\S]*Greens[\s\S]*Clear Fiber/i.test(supText) && /Optional[\s\S]*Creatine HMB/i.test(supText));
ok('count only includes daily-group items (0/2)', supText.includes('0/2 taken'));
await page.getByRole('checkbox', { name: 'Greens' }).click();
ok('checking a supplement updates count', (await page.getByTestId('supplements').innerText()).includes('1/2 taken'));
await tab('Settings');
await page.getByRole('button', { name: /^💊/ }).click();
const supSheet = await top().innerText();
ok('Settings lists Daily / Pre-workout / Post-workout / Optional groups', ['Daily', 'Pre-workout', 'Post-workout', 'Optional'].every((g) => supSheet.toUpperCase().includes(g.toUpperCase())));
ok('no "Not scheduled" labels in Settings', !/not scheduled/i.test(supSheet));
await top().getByRole('button', { name: /Creatine HMB/ }).click();
await top().getByRole('group', { name: 'Group' }).getByRole('button', { name: 'Pre-workout' }).click();
await top().getByRole('group', { name: 'Show on' }).getByRole('button', { name: 'Training days' }).click();
ok('no time field is pre-filled', (await top().locator('input[type="time"]').inputValue()) === '');
await top().getByRole('button', { name: 'Save' }).click();
await top().getByRole('button', { name: /Transparent Labs Sleep/ }).click();
await top().getByRole('group', { name: 'Group' }).getByRole('button', { name: 'Post-workout' }).click();
await top().getByRole('button', { name: 'Save' }).click();
ok('creatine moved to Pre-workout group', (await top().getByTestId('sup-group-pre').innerText()).includes('Creatine HMB'));
await page.screenshot({ path: `${shots}/r02-supp-settings.png` });
await close();

// ------------------------------------------------------------------ 6 (part 1: build workouts so Today can show one)
section('6 Training: create, edit, reschedule, delete');
await tab('Training');
await page.getByRole('tab', { name: 'Workouts' }).click();
await page.getByRole('button', { name: 'New workout' }).click();
await top().getByLabel('Workout name').fill('Lower A');
for (const ex of ['Squat', 'Romanian Deadlift']) { await top().getByLabel('New exercise').fill(ex); await top().getByRole('button', { name: 'Add', exact: true }).click(); }
await top().getByLabel('Weight').first().fill('185');
await top().getByRole('button', { name: 'Save workout' }).click();
ok('create strength workout', (await page.locator('.card-title', { hasText: 'Lower A' }).count()) === 1);
await page.locator('.card', { hasText: 'Lower A' }).click();
await top().getByLabel('Workout name').fill('Lower B');
await top().getByLabel('Sets').first().fill('5');
await top().getByRole('button', { name: 'Save workout' }).click();
ok('edit strength workout (rename)', (await page.locator('.card-title', { hasText: 'Lower B' }).count()) === 1 && (await page.locator('.card-title', { hasText: 'Lower A' }).count()) === 0);
await page.locator('.card', { hasText: 'Lower B' }).click();
ok('edit persisted (5 sets)', (await top().getByLabel('Sets').first().inputValue()) === '5');
await close();
await page.getByRole('button', { name: 'New workout' }).click();
await top().getByLabel('Workout name').fill('Easy 5k');
await top().getByRole('button', { name: 'Outdoor run', exact: true }).click();
await top().getByRole('button', { name: 'Save workout' }).click();
ok('create running workout', (await page.locator('.card-title', { hasText: 'Easy 5k' }).count()) === 1);
await page.locator('.card', { hasText: 'Easy 5k' }).click();
await top().getByLabel('Workout name').fill('Easy 3 mi');
await top().getByRole('button', { name: 'Treadmill run', exact: true }).click();
await top().getByRole('button', { name: 'Save workout' }).click();
ok('edit running workout (rename + type)', (await page.locator('.card', { hasText: 'Easy 3 mi' }).innerText()).includes('Treadmill'));

await page.getByRole('tab', { name: 'Calendar' }).click();
const todayIdx = await page.locator('.cal-day').evaluateAll((els) => els.findIndex((e) => e.querySelector('.cal-date.today')));
await page.locator('.cal-day').nth(todayIdx).getByRole('button', { name: /Add workout on/ }).click();
await top().getByLabel('Workout').selectOption({ label: 'Lower B · Strength' });
await top().getByRole('button', { name: 'Weekly', exact: true }).click();
await top().getByRole('button', { name: 'Add to calendar' }).click();
await page.locator('.cal-day').nth(todayIdx).getByRole('button', { name: /Add workout on/ }).click();
await top().getByLabel('Workout').selectOption({ label: 'Easy 3 mi · Treadmill run' });
await top().getByRole('button', { name: 'Add to calendar' }).click();
ok('schedule weekly strength + one-off run on the same day', (await page.locator('.cal-day').nth(todayIdx).locator('.wk-pill').count()) === 2);
ok('no workouts were preloaded on other days', (await page.locator('.wk-pill').count()) === 2);
await page.screenshot({ path: `${shots}/r03-calendar.png` });

// ------------------------------------------------------------------ 3/4 Nutrition + meals
section('3 Nutrition values');
await tab('Today');
const plannedTotal = num(await page.getByTestId('kcal-planned').innerText());
ok('planned total is the sum of foods (3,481 kcal)', plannedTotal === 3481, `(${plannedTotal})`);
const bfRows = page.getByTestId('meal-Breakfast').locator('.food-row');
ok('every food row shows its source (label / retailer / USDA / estimate)', (await bfRows.allInnerTexts()).every((t) => /label|USDA ref|estimate|custom/.test(t)));
ok('egg row marked as manufacturer label', (await bfRows.first().innerText()).includes('✓ label'));
await page.getByTestId('meal-Snacks & Drinks').locator('.food-main', { hasText: 'Pineapple' }).click();
await top().getByRole('button', { name: /Cranberry juice cocktail/ }).click();
ok('swapped-in estimate is labelled "estimate"', (await page.getByTestId('meal-Snacks & Drinks').locator('.food-row', { hasText: 'Cranberry' }).innerText()).includes('estimate'));

section('4 Meals');
const counts = { 'Breakfast': 5, 'Mass Gainer Shake': 2, 'Dinner': 3, 'Snacks & Drinks': 4 };
for (const [m, n] of Object.entries(counts)) ok(`${m}: ${n} foods, one row each`, (await page.getByTestId(`meal-${m}`).locator('.food-row').count()) === n);
for (const m of Object.keys(counts)) {
  const card = page.getByTestId(`meal-${m}`);
  const rows = (await card.locator('.food-kcal').allInnerTexts()).map((t) => num(t.split('\n')[0]));
  const head = num((await card.locator('.meal-macros span').first().innerText()));
  ok(`${m}: header total equals its rows (±1 rounding)`, Math.abs(rows.reduce((a, b) => a + b, 0) - head) <= rows.length, `(${head} vs ${rows.reduce((a, b) => a + b, 0)})`);
}
const bf = page.getByTestId('meal-Breakfast');
await bf.getByRole('checkbox', { name: /Log Plain Awesome bagel/ }).click();
ok('log one food (bagel 260)', (await kcal()) === 260);
await bf.getByRole('checkbox', { name: 'Log entire Breakfast' }).click();
ok('log whole meal (686)', (await kcal()) === 686);
await bf.getByRole('checkbox', { name: 'Log entire Breakfast' }).click();
await bf.getByRole('checkbox', { name: 'Log entire Breakfast' }).click();
for (let i = 0; i < 2; i++) await bf.getByRole('checkbox', { name: /Log Large egg/ }).click();
ok('repeat taps never double count (still 686)', (await kcal()) === 686, `(${await kcal()})`);
const shake = page.getByTestId('meal-Mass Gainer Shake');
await shake.getByRole('checkbox', { name: 'Log entire Mass Gainer Shake' }).click();
ok('two meals logged = 686 + 1040', (await kcal()) === 1726, `(${await kcal()})`);
ok('coming up drops fully-logged meals', (await page.getByTestId('coming-up').locator('.list-row').count()) === 2);

// ------------------------------------------------------------------ 5
section('5 Groceries');
await tab('Groceries');
await page.getByLabel('Shopping start date').fill(day(1)); // tomorrow onward: untouched plan days
const depts = await page.locator('section[data-testid^="dept-"] .cat-head').allInnerTexts();
ok('grouped by store department (not by meal)', depts.length >= 6 && !depts.some((d) => /breakfast|dinner|mass gainer|snacks & drinks/i.test(d)), `(${depts.map((d) => d.split(' ·')[0]).join(', ')})`);
const buy = async (k) => (await page.getByTestId(`grocery-${k}`).getByTestId('buy').innerText()).trim();
ok('eggs: Buy 1 × 18-count carton', (await buy('eggs-eb')) === 'Buy 1 × 18-count carton', `(${await buy('eggs-eb')})`);
ok('bagels: Buy 2 × 5-pack', (await buy('bagel-dkb')) === 'Buy 2 × 5-pack');
ok('beef shown as raw packs', /Buy 4 × 1 lb pack/.test(await buy('beef-8020-cooked')) && (await page.getByTestId('grocery-beef-8020-cooked').innerText()).includes('(raw)'));
ok('rice shown as dry bag', /Buy 1 × 2 lb bag/.test(await buy('rice-jasmine-cooked')) && (await page.getByTestId('grocery-rice-jasmine-cooked').innerText()).includes('(dry)'));
ok('milk: Buy 3 × 52 fl oz bottle', (await buy('milk-fairlife')).startsWith('Buy 3 × 52 fl oz'));
await page.screenshot({ path: `${shots}/r04-groceries.png` });
// change the plan: 3 eggs at breakfast, remove pretzels
await tab('Settings');
await page.getByRole('button', { name: /^🍽️/ }).click();
await top().getByRole('button', { name: /Breakfast/ }).click();
await top().getByLabel('Large egg amount').fill('3');
await close();
await top().getByRole('button', { name: /Snacks & Drinks/ }).click();
await top().getByTestId('template-item').filter({ hasText: 'Pretzels' }).getByRole('button', { name: 'Remove food' }).click();
await close(); await close();
await tab('Groceries');
await page.getByLabel('Shopping start date').fill(day(1));
ok('plan change recalculates: 21 eggs → 2 cartons', (await buy('eggs-eb')) === 'Buy 2 × 18-count carton' && (await page.getByTestId('grocery-eggs-eb').innerText()).includes('Need 21'));
ok('removed food disappears from list', (await page.getByTestId('grocery-pretzels').count()) === 0);
await page.getByTestId('grocery-eggs-eb').locator('button.grow').click();
await top().getByRole('button', { name: 'I have none' }).click();
await top().getByLabel('On hand').fill('6');
await top().getByRole('button', { name: 'Save' }).click();
ok('pantry subtracts: need 21, have 6 → 1 carton', (await buy('eggs-eb')) === 'Buy 1 × 18-count carton');

// ------------------------------------------------------------------ 6 (part 2: log, reschedule, delete)
section('6 Training: create, edit, reschedule, delete');
await tab('Today');
ok('today\'s workouts show on Today', (await page.getByTestId('today-workout').count()) === 2);
await page.getByTestId('supplements').getByRole('button', { name: /Supplements/ }).count();
const supNow = await page.getByTestId('supplements').innerText();
ok('training day shows the Pre-workout group (creatine)', /Pre-workout[\s\S]*Creatine HMB/i.test(supNow));
await page.getByTestId('today-workout').filter({ hasText: 'Lower B' }).getByRole('button', { name: 'Start' }).click();
await top().getByLabel('Squat set 1 weight').fill('185');
await top().getByLabel('Squat set 1 reps').fill('5');
await top().getByRole('checkbox', { name: 'Complete Squat set 1' }).click();
await top().getByRole('checkbox', { name: 'Complete Squat set 2' }).click();
await page.locator('.rest-timer').getByRole('button', { name: 'Skip' }).click();
await top().getByRole('button', { name: 'Finish workout' }).click();
ok('strength session logged → Done on Today', (await page.getByTestId('today-workout').filter({ hasText: 'Lower B' }).innerText()).includes('Done'));
await page.getByTestId('today-workout').filter({ hasText: 'Easy 3 mi' }).getByRole('button', { name: 'Start' }).click();
await top().getByLabel('Distance').fill('3');
await top().getByLabel('Duration').fill('27:00');
ok('run pace 9:00/mi', (await top().getByTestId('run-pace').innerText()).startsWith('9:00'));
await top().getByRole('button', { name: 'Finish workout' }).click();
// earlier sessions for history: a lift and a run yesterday
await tab('Training');
await page.getByRole('tab', { name: 'Workouts' }).click();
await page.getByRole('button', { name: 'Log without plan' }).click();
await top().getByRole('button', { name: 'Strength', exact: true }).click();
await top().locator('input[type="date"]').fill(day(-3));
await top().getByRole('button', { name: 'Start logging' }).click();
await top().getByLabel('Add exercise to session').fill('Squat');
await top().getByRole('button', { name: 'Add', exact: true }).click();
await top().getByLabel('Squat set 1 weight').fill('175');
await top().getByLabel('Squat set 1 reps').fill('5');
await top().getByRole('checkbox', { name: 'Complete Squat set 1' }).click();
await page.locator('.rest-timer').getByRole('button', { name: 'Skip' }).click();
await top().getByRole('button', { name: 'Finish workout' }).click();
await page.getByRole('button', { name: 'Log without plan' }).click();
await top().getByRole('button', { name: 'Outdoor run', exact: true }).click();
await top().locator('input[type="date"]').fill(day(-2));
await top().getByRole('button', { name: 'Start logging' }).click();
await top().getByLabel('Distance').fill('4');
await top().getByLabel('Duration').fill('38:00');
await top().getByRole('button', { name: 'Finish workout' }).click();
// reschedule next week's Lower B by date, then delete one and the series
await page.getByRole('tab', { name: 'Calendar' }).click();
await page.getByRole('button', { name: 'Next' }).click();
const nextIdx = todayIdx;
await page.locator('.cal-day').nth(nextIdx).locator('.wk-pill', { hasText: 'Lower B' }).click();
await top().getByLabel('Move to date').fill(day(9));
await top().getByRole('button', { name: 'Move', exact: true }).click();
ok('reschedule to a chosen date', (await page.locator('.cal-day').nth(nextIdx + 2).locator('.wk-pill', { hasText: 'Lower B' }).count()) === 1 && (await page.locator('.cal-day').nth(nextIdx).locator('.wk-pill').count()) === 0);
await page.locator('.cal-day').nth(nextIdx + 2).locator('.wk-pill', { hasText: 'Lower B' }).click();
await top().getByRole('button', { name: 'Skip this one' }).click();
ok('skip a single occurrence', (await page.locator('.wk-pill.skipped').count()) === 1);
await page.getByRole('button', { name: 'Next' }).click();
ok('later weeks still repeat', (await page.locator('.wk-pill', { hasText: 'Lower B' }).count()) === 1);
await page.locator('.wk-pill', { hasText: 'Lower B' }).click();
await top().getByRole('button', { name: 'Delete whole series' }).click();
await confirm();
ok('delete a repeating series', (await page.locator('.wk-pill').count()) === 0);
await page.getByRole('tab', { name: 'Workouts' }).click();
await page.locator('.card', { hasText: 'Easy 3 mi' }).click();
await top().getByRole('button', { name: 'Delete' }).click();
await confirm();
ok('delete a running workout', (await page.locator('.card-title', { hasText: 'Easy 3 mi' }).count()) === 0);
await page.locator('.card', { hasText: 'Lower B' }).click();
await top().getByRole('button', { name: 'Delete' }).click();
await confirm();
ok('delete a strength workout', (await page.locator('.card-title', { hasText: 'Lower B' }).count()) === 0);
await page.getByRole('tab', { name: 'History' }).click();
const hist = await page.locator('.list-row').allInnerTexts();
ok('history keeps all 4 logs after templates are deleted', hist.length === 4 && hist.some((h) => h.includes('Lower B')) && hist.some((h) => h.includes('Easy 3 mi')), `(${hist.length})`);

// ------------------------------------------------------------------ 7
section('7 Progress');
await tab('Progress');
const weights = [145.0, 145.4, 145.2, 145.8, 146.0, 145.6, 146.2, 146.4, 146.8];
for (let i = 0; i < weights.length; i++) {
  await page.getByLabel('Weigh-in date').fill(day(i - weights.length + 1));
  await page.getByLabel('Morning weight').fill(String(weights[i]));
  await page.getByRole('button', { name: 'Log weight' }).click();
}
const last7 = weights.slice(-7);
const avg7 = last7.reduce((a, b) => a + b, 0) / 7;
ok('current weight = latest weigh-in', (await page.getByTestId('current-weight').innerText()).startsWith('146.8'));
const avgTxt = await page.locator('.tile', { hasText: '7-day avg' }).innerText();
ok('7-day average is correct', num(avgTxt.split('\n').pop()) === Math.round(avg7 * 10) / 10, `(${avgTxt.split('\n').pop()} vs ${avg7.toFixed(2)})`);
const gainedTxt = await page.locator('.card', { hasText: 'Goal' }).first().innerText();
ok('gained since start (145 → 146.8 = +1.8)', gainedTxt.includes('+1.8 lb gained'));
ok('weekly rate computed after 4+ weigh-ins', /[+-]\d\.\d\d/.test(await page.getByTestId('weekly-rate').innerText()));
ok('calorie suggestion waits for 14 days', (await page.getByTestId('calorie-suggestion').innerText()).includes('Need 14 days'));
const strength = await page.locator('.card', { hasText: 'Personal records' }).innerText();
ok('strength history: Squat best 185 lb over 2 sessions', /Squat · 2 sessions[\s\S]*185 lb/.test(strength), `(${strength.replace(/\n/g, ' | ').slice(0, 120)})`);
const running = await page.locator('.card', { hasText: '30-day' }).innerText();
ok('running history: 2 runs, longest 4.0 mi, 7.0 mi in 30 days', /runs\n2/i.test(running) && running.includes('4.0') && running.includes('7.0'), `(${running.replace(/\n/g, ' ').slice(0, 80)})`);
await page.screenshot({ path: `${shots}/r05-progress.png`, fullPage: true });

// ------------------------------------------------------------------ 8
section('8 Persistence');
const before = { kcal: 1726 };
await page.reload();
await tab('Today');
await page.waitForSelector('[data-testid="kcal-consumed"]');
ok('meals survive refresh', (await kcal()) === before.kcal, `(${await kcal()})`);
await page.close();
page = await ctx.newPage(); watch(page);
await page.goto(url);
await tab('Today');
await page.waitForSelector('[data-testid="kcal-consumed"]');
ok('meals survive closing and reopening', (await kcal()) === before.kcal);
if (!(await page.getByRole('checkbox', { name: 'Greens' }).count())) await page.getByTestId('supplements').getByRole('button', { name: /Supplements/ }).click();
ok('supplements survive reopen', (await page.getByRole('checkbox', { name: 'Greens' }).getAttribute('aria-checked')) === 'true');
ok('workout status survives reopen', (await page.getByText('Done ✓').count()) >= 1 || (await page.getByTestId('today-workout').count()) === 0);
await tab('Training'); await page.getByRole('tab', { name: 'History' }).click();
ok('workout logs survive reopen', (await page.locator('.list-row').count()) === 4);
await tab('Progress');
ok('weight survives reopen', (await page.getByTestId('current-weight').innerText()).startsWith('146.8'));
await tab('Groceries');
await page.getByLabel('Shopping start date').fill(day(1));
ok('plan edits and pantry survive reopen', (await page.getByTestId('grocery-eggs-eb').getByTestId('buy').innerText()) === 'Buy 1 × 18-count carton');

// ------------------------------------------------------------------ 9
section('9 Mobile usability (sheets)');
const sheetOk = async (label) => {
  const r = await page.evaluate(() => { const b = document.querySelectorAll('.sheet-body'); const el = b[b.length - 1]; return el ? { sw: el.scrollWidth, cw: el.clientWidth } : null; });
  ok(`sheet fits width: ${label}`, r && r.sw <= r.cw + 1, r ? `(${r.sw}/${r.cw})` : '');
};
await tab('Today');
await page.getByTestId('meal-Dinner').locator('.food-main').first().click(); await sheetOk('portion editor'); await close();
await page.getByTestId('meal-Dinner').getByRole('button', { name: 'Food' }).click(); await sheetOk('food picker'); await close();
await tab('Training'); await page.getByRole('tab', { name: 'Workouts' }).click();
await page.getByRole('button', { name: 'New workout' }).click(); await top().getByRole('button', { name: 'Intervals', exact: true }).click();
await top().getByRole('button', { name: 'Add segment' }).click(); await sheetOk('workout builder w/ intervals'); await close(); await confirm();
await tab('Settings'); await page.getByRole('button', { name: /^🗓️/ }).click(); await sheetOk('meal plans'); await close();
await page.getByRole('button', { name: /^🥫/ }).click(); await top().locator('.list-row').first().click(); await sheetOk('food editor'); await close(); await close();
const tb = await page.locator('.tabbar').boundingBox();
ok('tab bar pinned to bottom and fully visible', tb && tb.y + tb.height <= 844 + 1 && tb.y > 700);

ok('no console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) console.log('FAILED:\n' + failed.map((f) => ` [${f.area}] ${f.name} ${f.extra}`).join('\n'));
process.exit(failed.length ? 1 : 0);
