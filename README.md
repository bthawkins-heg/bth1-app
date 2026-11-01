# Bulk — personal fitness & nutrition app

Mobile-first React + TypeScript app (Vite). Built to a single self-contained `dist/index.html`.

- Live: https://claude.ai/artifact/BtYYfSmKgStiq7ktSxWf26 (private to the owner; data saved per-user in the artifact's private store + on-device)
- Home Screen app (GitHub Pages): served from `docs/`. Rebuild with `npm run build:pwa && rm -rf docs && cp -r dist-pwa docs`.
- Dev: `npm install && npm run dev` (data saved in localStorage only)
- Build: `npm run build` → `dist/index.html`
- Logic tests: `npx vitest run` (32 tests)
- iPhone-viewport walkthrough: `npx vite preview --port 4173 &` then `node e2e/run.mjs http://localhost:4173/ /tmp/shots` (43 checks) and `node e2e/viewports.mjs`

Code map: `src/lib` (types, seed foods/meals/supplements, nutrition math, grocery, prep, training schedule, progress, store/sync), `src/screens` (Today, Training, SessionLogger, Groceries, Progress, Settings), `src/components`.
