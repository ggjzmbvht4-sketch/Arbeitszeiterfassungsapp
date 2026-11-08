/* Arbeitszeit PWA – versionsgeprüfter Offline-Start.
 * Cache nur die eigene HTML-Oberfläche, niemals Supabase-API-Antworten
 * oder private Apple-Kalender-Links. IndexedDB bleibt unberührt. */
const SHELL_CACHE = 'arbeitszeit-shell-next-v10';
const SHELL_URL = new URL('./index.html', self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    // Activate only when the replacement shell is ready for offline use.
    const cache = await caches.open(SHELL_CACHE);
    await cache.add(new Request(SHELL_URL, {cache: 'reload'}));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name =>
      name.startsWith('arbeitszeit-shell-') && name !== SHELL_CACHE
    ).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!(req.mode === 'navigate' || url.href === SHELL_URL)) return;

  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    try {
      const response = await fetch(req, {cache:'no-store'});
      if (response.ok && response.type === 'basic') {
        await cache.put(SHELL_URL, response.clone());
      }
      return response;
    } catch (_) {
      const offline = await cache.match(SHELL_URL);
      if (offline) return offline;
      return new Response('Die App konnte offline nicht geladen werden. Bitte einmal mit Internet öffnen.', {
        status:503, headers:{'Content-Type':'text/plain; charset=utf-8'}
      });
    }
  })());
});

// Web-Push-Meldungen: nur sichtbare Hinweise, niemals stille Hintergrundänderungen.
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data?.json() || {}; } catch (_) { payload = {}; }
    const title = typeof payload.title === 'string' ? payload.title.slice(0,60) : 'Arbeitszeit';
    const body = typeof payload.body === 'string' ? payload.body.slice(0,220) : 'Du hast eine neue Erinnerung.';
    await self.registration.showNotification(title, {
      body, icon: './icon-192.png', badge: './icon-192.png', tag: 'arbeitszeit-reminder',
      data: {url: new URL('./index.html', self.registration.scope).href}
    });
  })());
});
self.addEventListener('notificationclick',event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url=new URL('./index.html',self.registration.scope).href;
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){
      if(client.url.startsWith(url) && 'focus' in client){await client.focus();return;}
    }
    await self.clients.openWindow(url);
  })());
});
