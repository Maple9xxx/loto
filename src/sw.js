// Service worker: lưu sẵn toàn bộ app để mở được khi mất mạng. File này được build.mjs điền danh sách + mã bản build.
const BUILD = '__BUILD__';
const CACHE = `loto-${BUILD}`;
const ASSETS = __ASSETS__;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('loto-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Mở trang: ưu tiên bản mới nhất từ mạng (tối đa 3 giây), không có mạng thì dùng bản đã lưu
  if (req.mode === 'navigate') {
    e.respondWith(
      Promise.race([
        fetch(req),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
      ])
        .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('index.html', copy)); } return res; })
        .catch(() => caches.match('index.html', { ignoreSearch: true }).then((hit) => hit || caches.match('./', { ignoreSearch: true })))
    );
    return;
  }

  // File tĩnh: dùng bản đã lưu, thiếu thì tải và lưu thêm
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
