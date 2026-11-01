// Full-page screenshots of each tab from a saved state. Usage: node e2e/shots.mjs <url> <fixture.json> <outDir>
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const [url, fx, out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })).newPage();
await p.goto(url); await p.evaluate((f) => localStorage.setItem('fuel-app-state-v1', f), readFileSync(fx, 'utf8'));
for (const [t, sub] of [['today'], ['training'], ['training', 'History'], ['groceries'], ['groceries', 'Meal prep'], ['progress'], ['settings']]) {
  await p.goto(url + '#' + t); await p.reload(); await p.waitForSelector('.tabbar');
  if (sub) await p.getByRole('tab', { name: sub }).click();
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${out}/s-${t}${sub ? '-' + sub.replace(' ', '') : ''}.png`, fullPage: true });
}
await b.close();
