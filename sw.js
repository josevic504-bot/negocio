/* Gestión de Negocio VM · guarda la app en el teléfono para que abra rápido.
   Los datos SIEMPRE se piden al servidor; aquí solo se guardan la página, íconos y librerías. */
const VERSION = 'gnvm-1.9';
const BASE = ['./', './index.html', './manifest.json', './panel.webmanifest', './panel/', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(BASE)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || /\.apk$/i.test(u.pathname) || u.searchParams.has('v') || u.hostname.endsWith('script.google.com') || u.hostname.endsWith('googleusercontent.com') || u.hostname === 'drive.google.com') return;
  // La página: primero internet (para recibir las actualizaciones) y si no hay, la guardada
  if (r.mode === 'navigate' || (u.origin === location.origin && /\.(html|json|gs)$|\/$/.test(u.pathname))) {
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(VERSION).then(c => c.put(r, cp)); return res; }).catch(() => caches.match(r).then(x => x || caches.match('./index.html'))));
    return;
  }
  // Librerías, fuentes e íconos: primero lo guardado
  if (u.origin === location.origin || /cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(u.hostname)) {
    e.respondWith(caches.match(r).then(x => x || fetch(r).then(res => { if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(VERSION).then(c => c.put(r, cp)); } return res; })));
  }
});

// Al tocar una notificación: abre la app (o la trae al frente) en la pantalla indicada
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const vista = (e.notification.data && e.notification.data.vista) || 'inicio';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => 'focus' in x);
    if (c) { c.focus(); c.postMessage({ tipo: 'ir', vista }); return; }
    return self.clients.openWindow('./#' + vista);
  }));
});
