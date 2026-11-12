// Formwork Delivery: keeps the app on the phone so it opens without internet.
// The page itself: newest from the internet when there is a connection, else the copy on the phone.
// Order catalogue photos, icons and the PDF / Excel / Supabase libraries: kept on the phone after the first download.
// Data never goes through here (it is kept by the app itself).
const CACHE = 'fd-app-v3';
const CORE = ['./', './index.html', './manifest.json', './ordercat.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const fresh = async req => {               // internet first, phone copy when offline
  const c = await caches.open(CACHE);
  try {
    const r = await fetch(req, { cache: 'no-store' });
    if (r && r.ok) c.put(req, r.clone());
    return r;
  } catch (_) {
    return (await c.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? c.match('./index.html') : undefined) || Response.error();
  }
};
const kept = async req => {                // phone copy first, internet the first time
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  if (hit) return hit;
  try {
    const r = await fetch(req);
    if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone());
    return r;
  } catch (_) { return Response.error(); }
};

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.hostname.endsWith('supabase.co')) return;                       // data: handled by the app
  if (u.origin === self.location.origin) {
    if (req.mode === 'navigate' || /\/(index\.html|ordercat\.json|manifest\.json)?$/.test(u.pathname) || u.pathname.endsWith('/ordercat.json')) { e.respondWith(fresh(req)); return; }
    e.respondWith(kept(req));                                            // oc/*.jpg, icons
    return;
  }
  if (/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|fonts\.(googleapis|gstatic)\.com/.test(u.hostname)) e.respondWith(kept(req));   // versioned libraries and fonts
});
