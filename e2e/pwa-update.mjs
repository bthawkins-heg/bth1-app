// An updated deploy must show on the next open (not the one after). Serves docs/ on 4181.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const f = 'docs/index.html', orig = readFileSync(f, 'utf8');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext()).newPage();
await p.goto('http://localhost:4181/'); await p.waitForFunction(() => navigator.serviceWorker.controller); await p.reload(); await p.waitForSelector('.tabbar');
writeFileSync(f, orig.replace('<title>', '<title>NEWVERSION '));
try {
  await p.reload(); await p.waitForSelector('.tabbar');
  const t = await p.title();
  console.log(t.startsWith('NEWVERSION') ? 'PASS  update shows on next open' : `FAIL  still old: ${t}`);
} finally { writeFileSync(f, orig); await b.close(); }
