/* Gestión de Negocio VM · guarda la app en el teléfono para que abra rápido.
   Los datos SIEMPRE se piden al servidor; aquí solo se guardan la página, íconos y librerías. */
const VERSION = 'gnvm-1.9.62';
const BASE = ['./', './index.html', './manifest.json', './panel.webmanifest', './panel/', './icon-192.png', './icon-512.png',
  './iconos/agenda.webp', './iconos/ajustes.webp', './iconos/ayuda.webp', './iconos/caja.webp', './iconos/clientes.webp', './iconos/compras.webp', './iconos/cotizaciones.webp', './iconos/cuentas.webp', './iconos/encargos.webp', './iconos/g_belleza.webp', './iconos/g_boutique.webp', './iconos/g_catalogo.webp', './iconos/g_comida.webp', './iconos/g_compras.webp', './iconos/g_farmacia.webp', './iconos/g_ferreteria.webp', './iconos/g_otro.webp', './iconos/g_panaderia.webp', './iconos/g_recargas.webp', './iconos/g_repuestos.webp', './iconos/g_servicios.webp', './iconos/g_streaming.webp', './iconos/g_tecnologia.webp', './iconos/g_tienda.webp', './iconos/g_variedades.webp', './iconos/g_veterinaria.webp', './iconos/g_vitaminas.webp', './iconos/lotes.webp', './iconos/recompra.webp', './iconos/gastos.webp', './iconos/hospedaje.webp', './iconos/mascotas.webp', './iconos/mensajes.webp', './iconos/ordenes.webp', './iconos/pedidos.webp', './iconos/precios.webp', './iconos/productos.webp', './iconos/proveedores.webp', './iconos/proyectos.webp', './iconos/qa_cobrar.webp', './iconos/qa_compra.webp', './iconos/qa_gasto.webp', './iconos/qa_resumen.webp', './iconos/reportes.webp', './iconos/tienda.webp', './iconos/usuarios.webp', './iconos/vacunas.webp', './iconos/vencimientos.webp', './iconos/vender.webp', './iconos/ventas.webp'];
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

// Aviso que manda el servidor (pedido nuevo, mensaje, soporte, resumen de la mañana): llega aunque la app esté cerrada
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { cuerpo: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Gestión de Negocio VM', {
    body: d.cuerpo || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || 'gnvm', renotify: true,
    data: { vista: d.vista || 'inicio', url: d.url || '' }, vibrate: [120, 60, 120]
  }));
});

// Al tocar una notificación: abre la app (o la trae al frente) en la pantalla indicada; los avisos del Panel abren el Panel
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const d = e.notification.data || {}, vista = d.vista || 'inicio', panel = d.url === 'panel';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => 'focus' in x && /[?&]panel|\/panel\//.test(x.url) === panel);
    if (c) { c.focus(); if (!panel) c.postMessage({ tipo: 'ir', vista }); return; }
    return self.clients.openWindow(panel ? './panel/?panel' : './#' + vista);
  }));
});
