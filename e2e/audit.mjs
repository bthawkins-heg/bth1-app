// Mobile usability audit: page height, horizontal overflow, clipped text, small tap targets, per tab and viewport.
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:4173/';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let problems = 0;
for (const [w, h] of [[375, 667], [390, 844], [430, 932]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true })).newPage();
  await p.goto(url);
  for (const t of ['Today', 'Training', 'Groceries', 'Progress', 'Settings']) {
    await p.locator('.tabbar').getByRole('button', { name: t }).click();
    await p.waitForTimeout(150);
    const r = await p.evaluate(() => {
      const out = { height: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth, clipped: [], small: [] };
      for (const el of document.querySelectorAll('main *')) {
        const cs = getComputedStyle(el);
        if (el.scrollWidth > el.clientWidth + 1 && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll' && !el.classList.contains('ellipsis') && el.clientWidth > 0 && el.tagName !== 'svg' && el.tagName !== 'INPUT' && el.tagName !== 'SELECT')
          out.clipped.push(`${el.tagName}.${el.className}`.slice(0, 50) + ':' + (el.textContent || '').trim().slice(0, 30));
        if ((el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'SELECT' || el.tagName === 'INPUT')) {
          const rc = el.getBoundingClientRect();
          if (rc.width > 0 && (rc.height < 28 || rc.width < 28)) out.small.push(`${el.tagName}:${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)} ${Math.round(rc.width)}x${Math.round(rc.height)}`);
        }
      }
      return out;
    });
    const bad = r.sw > w || r.clipped.length;
    if (bad) problems++;
    console.log(`${w}x${h} ${t.padEnd(9)} height=${r.height} (${(r.height / h).toFixed(1)} screens) overflowX=${r.sw > w} clipped=${r.clipped.length} smallTargets=${r.small.length}`);
    if (r.clipped.length) console.log('   clipped:', [...new Set(r.clipped)].slice(0, 6).join(' | '));
    if (r.small.length && w === 375) console.log('   small:', [...new Set(r.small)].slice(0, 8).join(' | '));
  }
}
await b.close();
console.log(problems ? `${problems} screen(s) with overflow problems` : 'no overflow problems');
