// Travel Radar 서비스 워커 — 네트워크 우선(새 파일이 올라오면 바로 반영), 오프라인일 때만 캐시.
// V 는 빌드 때 찍힌다 → 배포마다 워커가 바뀌어 옛 캐시를 버린다. (예전 버전은 캐시 우선이라 폰이 옛 화면을 계속 보여줬다)
const V = '202611020153';
const SHELL = 'tr-shell-' + V;
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url); if (url.origin !== location.origin || e.request.method !== 'GET') return;
  const vendor = /\/(vendor|brand|icons)\//.test(url.pathname);
  if (vendor) { e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const c = res.clone(); caches.open(SHELL).then(x => x.put(e.request, c)); return res; }))); return; }
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(res => { if (res.ok) { const c = res.clone(); caches.open(SHELL).then(x => x.put(e.request, c)); } return res; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
