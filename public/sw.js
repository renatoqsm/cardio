// Only public offline assets are cached. Auth, feeds and photos always use the network.
const CACHE = 'pulso-public-v5';
const ASSETS = ['/offline.html', '/icons/pulso-192.png', '/icons/pulso-512.png', '/icons/pulso-maskable-512.png', '/icons/pulso-apple-180.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('pulso-public-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(async () => (await caches.match('/offline.html')) || Response.error()));
  } else if (ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
  }
});

// The account binding prevents stale notifications leaking across account changes.
function accountStore(mode, action) {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open('pulso-notifications', 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore('settings');
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result, transaction = db.transaction('settings', mode);
      const request = action(transaction.objectStore('settings'));
      let result;
      request.onsuccess = () => { result = request.result; };
      transaction.oncomplete = () => { db.close(); resolve(result); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  });
}
self.addEventListener('message', event => {
  if (event.data?.type !== 'PULSO_ACCOUNT') return;
  event.waitUntil(accountStore('readwrite', store => store.put(typeof event.data.userId === 'string' ? event.data.userId : null, 'userId'))
    .then(() => event.ports[0]?.postMessage({ ok: true })));
});
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let data;
    try { data = event.data?.json(); } catch { return; }
    if (!data || typeof data.body !== 'string' || typeof data.recipient !== 'string') return;
    const account = await accountStore('readonly', store => store.get('userId'));
    if (account !== data.recipient) return;
    const url = new URL(data.url || '/', self.location.origin);
    if (url.origin !== self.location.origin || !['/', '/app'].includes(url.pathname)) return;
    await self.registration.showNotification(data.title || 'Pulso', {
      body: data.body, icon: '/icons/pulso-192.png', badge: '/icons/pulso-192.png',
      tag: data.tag, renotify: false, data: { url: url.href, recipient: data.recipient },
    });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const account = await accountStore('readonly', store => store.get('userId'));
    const target = account === event.notification.data?.recipient ? event.notification.data.url : self.location.origin + '/app';
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(target); await existing.focus(); }
    else await self.clients.openWindow(target);
  })());
});
