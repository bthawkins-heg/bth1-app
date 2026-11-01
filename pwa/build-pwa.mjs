// Turns the single-file build (dist/index.html) into an installable Home Screen app in dist-pwa/.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
const out = 'dist-pwa';
mkdirSync(out, { recursive: true });
const version = Date.now().toString(36);
let html = readFileSync((process.argv[2] ?? 'dist') + '/index.html', 'utf8');
const head = `
    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="apple-touch-icon" href="./icon-180.png" />
    <meta name="apple-mobile-web-app-title" content="Bulk" />
    <meta name="mobile-web-app-capable" content="yes" />
    <script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').then((r) => r.update()).catch(() => {}); let had = !!navigator.serviceWorker.controller; navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) location.reload(); had = true; }); });</script>`;
html = html.replace('</title>', '</title>' + head);
writeFileSync(`${out}/index.html`, html);
writeFileSync(`${out}/manifest.webmanifest`, JSON.stringify({
  name: 'Bulk — Fitness & Nutrition', short_name: 'Bulk', start_url: './', scope: './', display: 'standalone',
  orientation: 'portrait', background_color: '#f2f2f7', theme_color: '#f2f2f7',
  icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
}, null, 2));
writeFileSync(`${out}/sw.js`, `// Offline support. The app page itself is fetched fresh when online (so updates show on the next open)
// and falls back to the cached copy when offline; icons and other files come from cache first.
const CACHE = 'bulk-${version}';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (e.request.mode === 'navigate') {
    const timeout = new Promise((r) => setTimeout(r, 4000));
    e.respondWith(Promise.race([
      fetch(e.request).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); } return res; }),
      timeout.then(() => caches.match('./index.html')),
    ]).then((r) => r || caches.match('./index.html')).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => {
    const net = fetch(e.request).then((res) => { if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone())); return res; }).catch(() => hit);
    return hit || net;
  }));
});
`);
for (const s of [180, 192, 512]) copyFileSync(`pwa/icon-${s}.png`, `${out}/icon-${s}.png`);
writeFileSync(`${out}/.nojekyll`, '');
console.log('PWA written to', out);
