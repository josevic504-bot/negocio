// Dos equipos del mismo negocio: avisos registrados en el servidor y cambios al instante (servidor y Realtime simulados)
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import { api, db } from './prueba.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const RAIZ = process.argv[3], OUT = process.argv[2];
const srv = http.createServer((q, r) => { let f = path.join(RAIZ, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.png') ? 'image/png' : f.endsWith('.webp') ? 'image/webp' : 'application/octet-stream' }); r.end(d); }); }).listen(8767);
const subsT = [];
db.push = async q => {
  if (q.lista) return subsT.map(s => ({ negocio: s.negocio, apagados: s.apagados }));
  if (q.guardar) { const i = subsT.findIndex(s => s.endpoint === q.guardar.endpoint && s.negocio === q.guardar.negocio); if (i >= 0) subsT[i] = q.guardar; else subsT.push(q.guardar); return true; }
  if (q.quitar) { const i = subsT.findIndex(s => s.endpoint === q.quitar.endpoint && s.negocio === q.quitar.negocio); if (i >= 0) subsT.splice(i, 1); return true; }
};
await db.aplicar({ props: { TAREAS_CLAVE: 'tt', VAPID_PUBLICA: 'PUB', VAPID_PRIVADA: 'PRIV', RT_SECRETO: 'secreto' } });
const reg = await api('registrar', { negocio: 'Pulpería La Bendición', nombre: 'Vic', giro: 'tienda', whatsapp: '33130265', pin: '1234' });
const tok = reg.data.token; await api('cargarEjemplos', {}, tok);
const neg = (await api('bootstrap', {}, tok)).data.negocioId;
const unidos = []; const pushes = [];
const repartir = () => { const ef = db.efectos || []; db.efectos = []; ef.forEach(e => {
  if (e.push) pushes.push(e.push);
  if (e.rt) unidos.filter(u => u.topic === 'realtime:' + e.rt.canal).forEach(u => u.ws.send(JSON.stringify({ topic: u.topic, event: 'broadcast', payload: { type: 'broadcast', event: 'cambio', payload: { t: e.rt.t, dev: e.rt.dev } }, ref: null })));
}); };
const br = await chromium.launch();
async function equipo(ep) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  await pg.route(/^https?:\/\/(?!localhost).*/, async rt => {
    if (rt.request().url().indexOf('/functions/v1/api') < 0) return rt.abort();
    const b = JSON.parse(rt.request().postData() || '{}');
    const r = await api(b.action, b.data, b.token, { panel: b.panel, dev: b.dev });
    repartir();
    rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r) });
  });
  await pg.routeWebSocket(/realtime\/v1\/websocket/, ws => {
    ws.onMessage(m => { const j = JSON.parse(m); if (j.event === 'phx_join') { unidos.push({ topic: j.topic, ws }); ws.send(JSON.stringify({ topic: j.topic, event: 'phx_reply', payload: { status: 'ok', response: {} }, ref: j.ref })); } });
  });
  await pg.addInitScript(([t, ep]) => {
    window.__notifs = [];
    try { Object.defineProperty(Notification, 'permission', { get: () => 'granted' }); } catch (e) {}
    const sub = { endpoint: ep, toJSON() { return { endpoint: ep, keys: { p256dh: 'BPk' + 'x'.repeat(60), auth: 'auth1234abcd' } }; } };
    const reg = { pushManager: { getSubscription: async () => null, subscribe: async () => sub }, showNotification: async (ti, o) => { window.__notifs.push(ti + ' | ' + o.body); } };
    window.PushManager = function () {};
    Object.defineProperty(navigator, 'serviceWorker', { value: { ready: Promise.resolve(reg), getRegistration: async () => reg, addEventListener() {}, register() {} } });
    localStorage.setItem('gnvm@/|token', t); localStorage.setItem('gnvm@/|verVisto', '9.9.9'); localStorage.setItem('gnvm@/|avisos', 'si');
  }, [tok, ep]);
  await pg.goto('http://localhost:8767/'); await pg.waitForTimeout(3500);
  return pg;
}
const A = await equipo('https://fcm.googleapis.com/fcm/send/telefonoA');
const B = await equipo('https://fcm.googleapis.com/fcm/send/telefonoB');
console.log('avisos registrados en el servidor:', subsT.map(s => s.endpoint.split('/').pop() + ' (' + s.negocio + ')').join(', '));
console.log('canales unidos:', unidos.length);
await A.evaluate(() => ir('productos')); await A.waitForTimeout(1200);
const antes = await A.locator('#main').innerText();
// En el teléfono B se crea un producto (como si el cajero lo agregara)
await B.evaluate(async () => { await api('guardar', { entidad: 'Productos', registro: { nombre: 'Café Maya 500 g', precio: 120, costo: 80, stock: 24, tipo: 'producto', activo: true } }); });
await A.waitForTimeout(3500);
const despues = await A.locator('#main').innerText();
console.log('A ve el producto nuevo sin tocar nada:', !antes.includes('Café Maya') && despues.includes('Café Maya'));
await A.locator('.li', { hasText: 'Café Maya' }).first().scrollIntoViewIfNeeded();
await A.screenshot({ path: OUT + '/e2e-1-producto-al-instante.png' });
// Pedido de la tienda en línea: los dos teléfonos se enteran al momento
await db.aplicar({ ops: [{ t: 'Config', n: neg, op: 'upd', k: { clave: 'tienda' }, row: { valor: 'si' } }] });
const pr = (await api('bootstrap', {}, tok)).data.productos.find(p => p.nombre === 'Café Maya 500 g');
pushes.length = 0;
const pd = await api('pedir', { negocio: neg, nombre: 'Carlos López', telefono: '98765432', entrega: 'tienda', items: [{ id: pr.id, cantidad: 2 }], clave: 'p1' }); repartir();
console.log('pedido:', pd.ok, '· avisos al servidor de push:', JSON.stringify(pushes));
await A.evaluate(() => ir('inicio')); await A.waitForTimeout(3000);
console.log('A: pedidos nuevos en la cabecera =', await A.evaluate(() => S.pedidosNuevos), '· notificaciones locales repetidas =', JSON.stringify(await A.evaluate(() => window.__notifs)));
await A.screenshot({ path: OUT + '/e2e-2-pedido.png' });
// Apagar el resumen en A se guarda en el servidor
await A.evaluate(() => { localStorage.setItem('gnvm@/|av_resumen', 'no'); return pushSuscribir(false); });
console.log('apagados de A:', subsT.find(s => s.endpoint.endsWith('telefonoA')).apagados);
const rd = await (await import('./prueba.mjs')).srv.atender({ tarea: 'recordatoriosDia', clave: 'tt' }); repartir();
console.log('resumen 7 a. m.:', JSON.stringify(rd), JSON.stringify(pushes.filter(p => p.tipo === 'resumen')));
await br.close(); srv.close();
