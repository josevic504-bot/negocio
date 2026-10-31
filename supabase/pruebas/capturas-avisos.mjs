// Vista previa: avisos en Ajustes, tarjeta de Inicio, Panel y cómo se ven las notificaciones
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import { api, db } from './prueba.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const RAIZ = process.argv[3], OUT = process.argv[2];
const srv = http.createServer((q, r) => { let f = path.join(RAIZ, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.png') ? 'image/png' : f.endsWith('.webp') ? 'image/webp' : 'application/octet-stream' }); r.end(d); }); }).listen(8766);
const reg = await api('registrar', { negocio: 'Pulpería La Bendición', nombre: 'Vic', giro: 'tienda', whatsapp: '33130265', pin: '1234' });
const tok = reg.data.token; await api('cargarEjemplos', {}, tok);
await db.aplicar({ props: { PANEL_CLAVE: 'clave123' } });
const pt = (await api('panelLogin', { clave: 'clave123' })).data.token;
const br = await chromium.launch();
async function pagina(init) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.grantPermissions(['notifications'], { origin: 'http://localhost:8766' });
  const pg = await ctx.newPage();
  await pg.route(/^https?:\/\/(?!localhost).*/, async rt => {
    if (rt.request().url().indexOf('/functions/v1/api') < 0) return rt.abort();
    const b = JSON.parse(rt.request().postData() || '{}');
    const r = await api(b.action, b.data, b.token, { panel: b.panel });
    rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r) });
  });
  await pg.addInitScript(init.f, init.a);
  return pg;
}
// 1) Inicio con la tarjeta para activar avisos (permiso aún sin pedir)
let pg = await pagina({ f: t => { try { Object.defineProperty(Notification, 'permission', { get: () => 'default' }); } catch (e) {} localStorage.setItem('gnvm@/|token', t); localStorage.setItem('gnvm@/|verVisto', '9.9.9'); }, a: tok });
await pg.context().clearPermissions();
await pg.goto('http://localhost:8766/'); await pg.waitForTimeout(3000);
const card = pg.locator('.aviso', { hasText: 'Recibe avisos' }); await card.scrollIntoViewIfNeeded(); await pg.waitForTimeout(400);
await pg.screenshot({ path: OUT + '/1-inicio-avisos.png' });
// 2) Ajustes › Avisos activados
pg = await pagina({ f: t => { try { Object.defineProperty(Notification, 'permission', { get: () => 'granted' }); } catch (e) {} localStorage.setItem('gnvm@/|token', t); localStorage.setItem('gnvm@/|verVisto', '9.9.9'); localStorage.setItem('gnvm@/|avisos', 'si'); }, a: tok });
await pg.goto('http://localhost:8766/#ajustes'); await pg.waitForTimeout(2500);
await pg.evaluate(() => { try { ir('ajustes'); } catch (e) {} }); await pg.waitForTimeout(1500);
await pg.locator('#aj-avisos').scrollIntoViewIfNeeded(); await pg.waitForTimeout(400);
await pg.locator('#aj-avisos').screenshot({ path: OUT + '/2-ajustes-avisos.png' });
// 3) Panel Molina con la tarjeta de avisos
pg = await pagina({ f: () => { try { Object.defineProperty(Notification, 'permission', { get: () => 'default' }); } catch (e) {} }, a: null });
await pg.context().clearPermissions();
await pg.goto('http://localhost:8766/?panel'); await pg.waitForTimeout(1500);
const inp = pg.locator('input[type=password]').first(); await inp.fill('clave123'); await inp.press('Enter'); await pg.waitForTimeout(2500);
await pg.screenshot({ path: OUT + '/3-panel-avisos.png' });
pg = await pagina({ f: () => {}, a: null });
await pg.setContent(`<html><head><meta charset="utf-8"><style>
body{margin:0;font-family:Roboto,system-ui,sans-serif;background:linear-gradient(160deg,#2b2140,#5b1a45);height:844px;color:#fff}
.hora{font-size:64px;font-weight:300;text-align:center;padding-top:70px;letter-spacing:1px}.fecha{text-align:center;opacity:.85;margin-top:4px;font-size:16px}
.n{margin:12px 14px;background:rgba(255,255,255,.93);color:#1d1b20;border-radius:22px;padding:14px 16px;display:flex;gap:12px;box-shadow:0 6px 18px rgba(0,0,0,.25)}
.n img{width:38px;height:38px;border-radius:50%}.n b{font-size:15px}.n p{margin:3px 0 0;font-size:14px;color:#49454f;line-height:1.35}.n small{color:#79747e;font-size:12px;margin-left:6px;font-weight:400}
.lst{margin-top:60px}
</style></head><body><div class="hora">7:00</div><div class="fecha">sábado, 1 de noviembre</div><div class="lst">
<div class="n"><img src="http://localhost:8766/icon-192.png"><div><b>Tu día en Pulpería La Bendición <small>Negocio VM · 7:00</small></b><p>☀️ 2 suscripciones vencen hoy · L 3,450 por cobrar a 5 clientes · 3 productos agotados</p></div></div>
<div class="n"><img src="http://localhost:8766/icon-192.png"><div><b>¡Nuevo pedido en línea! <small>Negocio VM · ahora</small></b><p>🛍️ Carlos pidió 3 productos · L 485.00</p></div></div>
<div class="n"><img src="http://localhost:8766/icon-192.png"><div><b>Mensaje nuevo en tu tienda <small>Negocio VM · 2 min</small></b><p>💬 María: ¿Tienen la blusa en talla M?</p></div></div>
<div class="n"><img src="http://localhost:8766/icon-192.png"><div><b>Panel Molina · Nuevo registro <small>9:14</small></b><p>🎉 Ferretería El Clavo (Luis) empezó su prueba gratis · llegó por Facebook</p></div></div>
</div></body></html>`);
await pg.waitForTimeout(800);
await pg.screenshot({ path: OUT + '/0-avisos-telefono.png' });
await br.close(); srv.close(); console.log('listo');
