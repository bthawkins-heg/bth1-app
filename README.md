# Bulk — personal fitness & nutrition app

Mobile-first React + TypeScript app (Vite). Built to a single self-contained `dist/index.html`.

- Live: https://claude.ai/artifact/BtYYfSmKgStiq7ktSxWf26 (private to the owner; data saved per-user in the artifact's private store + on-device)
- Home Screen app (GitHub Pages): served from `docs/`. Rebuild with `npm run build:pwa && rm -rf docs && cp -r dist-pwa docs`.
- Dev: `npm install && npm run dev` (data saved in localStorage only)
- Build: `npm run build` → `dist/index.html`
- Logic tests: `npx vitest run` (32 tests)
- iPhone-viewport walkthrough: `npx vite preview --port 4173 &` then `node e2e/run.mjs http://localhost:4173/ /tmp/shots` (43 checks) and `node e2e/viewports.mjs`

Code map: `src/lib` (types, seed foods/meals/supplements, nutrition math, grocery, prep, training schedule, progress, store/sync), `src/screens` (Today, Training, SessionLogger, Groceries, Progress, Settings), `src/components`.

## Browser test suites
Serve a build (`npx vite preview --port 4174`), then:
- `node e2e/run.mjs <url> <shotsDir>` — original 43-step walkthrough
- `node e2e/review.mjs <url> <shotsDir>` — 78 checks across the 9 review areas
- `FIXTURE_OUT=/tmp/fx.json npx vitest run tests/fixture.test.ts` makes a "used for 3 weeks" state, then
  `node e2e/fixes.mjs <url> /tmp/fx.json` (data-safety and date checks) and
  `node e2e/monkey.mjs <url> /tmp/fx.json [Tab]` (taps every button on every tab and sheet)
- `node e2e/audit.mjs <url>` / `node e2e/viewports.mjs <url>` — layout at iPhone widths
