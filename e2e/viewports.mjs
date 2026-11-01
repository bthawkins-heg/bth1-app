import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const w of [320, 375, 430]) {
  const p = await (await b.newContext({ viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true })).newPage();
  await p.goto(process.argv[2] ?? 'http://localhost:4173/');
  for (const t of ['Today', 'Training', 'Groceries', 'Progress', 'Settings']) {
    await p.locator('.tabbar').getByRole('button', { name: t }).click();
    await p.waitForTimeout(150);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    console.log(w, t, sw <= w ? 'ok' : 'OVERFLOW ' + sw);
  }
  if (w === 320) await p.screenshot({ path: '/tmp/shots/se-settings.png' });
}
await b.close();
