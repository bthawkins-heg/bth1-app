// Taps every button on every tab (and every button inside the sheet it opens) starting from a realistic
// saved state, and reports page errors and broken text (NaN, undefined, Infinity, [object Object]).
// Usage: node e2e/monkey.mjs <url> <fixture.json>
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const url = process.argv[2];
const fixture = readFileSync(process.argv[3], 'utf8');
const TABS = process.argv[4] ? [process.argv[4]] : ['Today', 'Training', 'Groceries', 'Progress', 'Settings'];
const SUBTABS = { Training: ['Calendar', 'Workouts', 'History'], Groceries: ['Shopping list', 'Pantry', 'Meal prep'] };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
let errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('dialog', (d) => d.dismiss());
const problems = [];
let clicks = 0;
const BAD = /\bNaN\b|undefined|Infinity|\[object Object\]|null lb|null kcal/;
async function fresh(tab, sub) {
  if (page.url() === 'about:blank') await page.goto(url);
  await page.evaluate((f) => { localStorage.clear(); localStorage.setItem('fuel-app-state-v1', f); }, fixture);
  await page.goto(url + '#' + tab.toLowerCase());
  await page.reload();
  await page.waitForSelector('.tabbar');
  if (sub) await page.getByRole('tab', { name: sub }).click().catch(() => page.getByRole('button', { name: sub, exact: true }).click());
  await page.waitForTimeout(50);
}
async function check(where) {
  await page.waitForTimeout(60);
  const txt = await page.evaluate(() => document.body.innerText);
  const m = BAD.exec(txt);
  if (m) console.log(`PROBLEM ${where}: text "${txt.slice(Math.max(0, m.index - 40), m.index + 30).replace(/\n/g, ' ')}"`);
  if (errs.length) console.log(`PROBLEM ${where}: ERROR ${errs.join(' | ')}`);
  if (m) problems.push(`${where}: text "${txt.slice(Math.max(0, m.index - 40), m.index + 30).replace(/\n/g, ' ')}"`);
  if (errs.length) { problems.push(`${where}: ERROR ${errs.join(' | ')}`); errs = []; }
}
const label = async (loc) => ((await loc.getAttribute('aria-label')) || (await loc.innerText()).replace(/\s+/g, ' ').trim()).slice(0, 40);
const SKIP = /Reset all data|Delete log|Share|Save backup file/;
for (const tab of TABS) {
  for (const sub of SUBTABS[tab] ?? [null]) {
    await fresh(tab, sub);
    const where0 = `${tab}${sub ? '/' + sub : ''}`;
    await check(where0);
    const n = await page.locator('main button:visible').count();
    for (let i = 0; i < n; i++) {
      await fresh(tab, sub);
      const btn = page.locator('main button:visible').nth(i);
      if (!(await btn.count())) continue;
      const name = await label(btn);
      if (SKIP.test(name)) continue;
      await btn.click({ timeout: 3000 }).catch((e) => problems.push(`${where0} [${name}]: click failed ${e.message.split('\n')[0]}`));
      clicks++;
      await check(`${where0} [${name}]`);
      if (!(await page.locator('.sheet').count())) continue;
      const m = await page.locator('.sheet').last().locator('button:visible').count();
      for (let j = 0; j < Math.min(m, 40); j++) {
        await fresh(tab, sub);
        await page.locator('main button:visible').nth(i).click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(80);
        const sb = page.locator('.sheet').last().locator('button:visible').nth(j);
        if (!(await sb.count())) continue;
        const sname = await label(sb);
        if (SKIP.test(sname)) continue;
        await sb.click({ timeout: 3000 }).catch((e) => problems.push(`${where0} [${name}] > [${sname}]: click failed ${e.message.split('\n')[0]}`));
        clicks++;
        await check(`${where0} [${name}] > [${sname}]`);
      }
    }
  }
}
await b.close();
console.log(`${clicks} taps`);
console.log(problems.length ? problems.join('\n') : 'no problems');
