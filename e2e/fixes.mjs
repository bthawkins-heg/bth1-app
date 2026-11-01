// Browser checks for the audit fixes. Usage: node e2e/fixes.mjs <url> <fixture.json>
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const [url, fx] = process.argv.slice(2);
const fixture = readFileSync(fx, 'utf8');
const results = [];
const ok = (n, c, x = '') => { results.push(!!c); console.log(`${c ? 'PASS' : 'FAIL'}  ${n} ${x}`); };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errors = [];
async function fresh(opts = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  if (opts.clock) await p.clock.install({ time: opts.clock });
  await p.goto(url);
  if (opts.state !== false) { await p.evaluate((f) => localStorage.setItem('fuel-app-state-v1', f), opts.raw ?? fixture); await p.reload(); }
  await p.waitForSelector('.tabbar');
  return p;
}
const tab = (p, n) => p.locator('.tabbar').getByRole('button', { name: n }).click();
const top = (p) => p.locator('.sheet').last();

// 1. Overnight: app left open on Sunday 11:58 PM, reopened Monday morning
{
  const p = await fresh({ clock: new Date(2026, 10, 1, 23, 58) });
  ok('shows Sunday before midnight', (await p.locator('.subtitle').first().innerText()).includes('Nov 1'));
  await p.clock.setSystemTime(new Date(2026, 10, 2, 7, 30));
  await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await p.waitForTimeout(100);
  ok('reopened next morning → Today shows Monday', (await p.locator('h1').innerText()) === 'Today' && (await p.locator('.subtitle').first().innerText()).includes('Nov 2'));
  await p.context().close();
}
// 2. Undo can't wipe a later change
{
  const p = await fresh();
  await p.getByTestId('meal-Breakfast').getByRole('checkbox', { name: 'Log entire Breakfast' }).click();
  ok('undo offered right after logging', (await p.locator('.toast').getByRole('button', { name: 'Undo' }).count()) === 1);
  await tab(p, 'Groceries');
  await p.getByRole('button', { name: 'increase' }).first().click(); // a change with no undo of its own
  const undoVisible = await p.locator('.toast').getByRole('button', { name: 'Undo' }).count();
  ok('after a later edit, the old Undo button is withdrawn', undoVisible === 0);
  await p.context().close();
}
// 3. Copy previous day asks before replacing logged food
{
  const p = await fresh();
  await p.getByTestId('meal-Breakfast').getByRole('checkbox', { name: 'Log entire Breakfast' }).click();
  await p.getByRole('button', { name: 'Copy previous day' }).click();
  ok('copy over logged day asks first', (await top(p).innerText()).includes('Replace this day'));
  await top(p).getByRole('button', { name: 'Cancel' }).click();
  ok('cancel keeps logged food', (await p.getByTestId('kcal-consumed').innerText()) === '686');
  await p.context().close();
}
// 4. Unsaved workout edits
{
  const p = await fresh();
  await tab(p, 'Training'); await p.getByRole('tab', { name: 'Workouts' }).click();
  await p.getByRole('button', { name: 'New workout' }).click();
  await top(p).getByLabel('Workout name').fill('Half-built');
  await top(p).getByRole('button', { name: 'Close' }).click();
  ok('closing an edited workout asks to discard', (await top(p).innerText()).includes('Discard your changes'));
  await top(p).getByRole('button', { name: 'Cancel' }).click();
  ok('cancel keeps the edits', (await p.getByLabel('Workout name').inputValue()) === 'Half-built');
  await p.context().close();
}
// 5. Backup file round trip
{
  const p = await fresh();
  await tab(p, 'Settings'); await p.getByRole('button', { name: /Data & backup/ }).click();
  const [dl] = await Promise.all([p.waitForEvent('download'), top(p).getByRole('button', { name: 'Save backup file' }).click()]);
  const path = await dl.path();
  const saved = JSON.parse(readFileSync(path, 'utf8'));
  ok('backup file downloads with all data', saved.sessions.length === 8 && saved.weights.length === 20, `(${dl.suggestedFilename()})`);
  ok('last backup date shown', (await top(p).getByTestId('last-backup').innerText()).includes('Nov'));
  await top(p).getByRole('button', { name: 'Reset all data' }).click(); await top(p).getByRole('button', { name: 'Confirm' }).click();
  await p.getByRole('button', { name: /Data & backup/ }).click();
  await top(p).getByLabel('Backup file').setInputFiles(path);
  await top(p).getByRole('button', { name: 'Confirm' }).click();
  await tab(p, 'Training'); await p.getByRole('tab', { name: 'History' }).click();
  ok('restore from file brings history back', (await p.locator('.list-row').count()) === 8);
  await p.context().close();
}
// 6. Unreadable saved data is kept, not overwritten
{
  const p = await fresh({ raw: '{broken' });
  ok('warning shown for unreadable data', (await p.getByRole('alert').count()) === 1);
  const kept = await p.evaluate(() => Object.keys(localStorage).filter((k) => k.includes('unreadable')).map((k) => localStorage.getItem(k)));
  ok('original text kept on device', kept[0] === '{broken');
  await p.context().close();
}
// 7. Grocery checkmarks expire
{
  const p = await fresh({ clock: new Date(2026, 10, 1, 10, 0) });
  await tab(p, 'Groceries');
  await p.getByTestId('grocery-eggs-eb').getByRole('checkbox').click();
  ok('item checked', (await p.getByTestId('grocery-eggs-eb').getByRole('checkbox').getAttribute('aria-checked')) === 'true');
  await p.clock.setSystemTime(new Date(2026, 10, 8, 10, 0)); await p.reload(); await p.waitForSelector('.tabbar');
  ok('a week later the checkmark has cleared', (await p.getByTestId('grocery-eggs-eb').getByRole('checkbox').getAttribute('aria-checked')) === 'false');
  await p.context().close();
}
// 8. Weigh-in can't be logged in the future; chart labels not cut off
{
  const p = await fresh();
  await tab(p, 'Progress');
  await p.getByLabel('Weigh-in date').fill('2099-01-01'); await p.getByLabel('Morning weight').fill('150');
  ok('future weigh-in blocked', await p.getByRole('button', { name: 'Log weight' }).isDisabled());
  const clipped = await p.evaluate(() => [...document.querySelectorAll('svg.chart text')].filter((t) => { const r = t.getBoundingClientRect(), s = t.closest('svg').getBoundingClientRect(); return r.right > s.right + 1 || r.left < s.left - 1; }).map((t) => t.textContent));
  ok('no chart labels cut off', clipped.length === 0, clipped.join(','));
  await p.context().close();
}
ok('no page errors', errors.length === 0, errors.join(' | '));
await b.close();
console.log(`${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(results.every(Boolean) ? 0 : 1);
