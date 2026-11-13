// Capturas 1.9.77: mensajes automáticos (tienda ↔ programa)
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const RAIZ = process.argv[3], OUT = process.argv[2];
const SRC = fs.readFileSync(RAIZ + '/Codigo.gs', 'utf8');
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), log: () => {}, urlArchivo: r => 'http://localhost:8772/__f/' + r, rutaDeUrl: u => (u.split('/__f/')[1] || null) });
const api = (action, data, token) => srv.atender({ action, token, data: data || {} });
const web = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]);
  let f = path.join(RAIZ, u); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.webp') ? 'image/webp' : f.endsWith('.png') ? 'image/png' : 'application/octet-stream' }); r.end(d); }); }).listen(8772);
const tok = (await api('registrar', { negocio: 'Variedades Hernández', nombre: 'Karla Hernández', giro: 'variedades', whatsapp: '33130265', pin: '1234' })).data.token;
await api('cargarEjemplos', {}, tok);
const neg = (await api('bootstrap', {}, tok)).data.negocioId;
await db.aplicar({ ops: [{ t: 'Licencias', op: 'upd', k: { id: neg }, row: { plus: 'si', estado: 'Activa' } }] });
await api('guardar', { entidad: 'Config', registro: { tienda: 'si', tiendaPagos: 'Efectivo,Transferencia', tiendaAbre: '00:00', tiendaCierra: '23:59', tiendaDias: '0,1,2,3,4,5,6' } }, tok);
const br = await chromium.launch();
const errores = [];
async function pagina(init, arg) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage();
  pg.on('pageerror', e => { errores.push(e.message); console.log('ERROR JS:', e.message); });
  await pg.route(/^https?:\/\/(?!localhost).*/, async rt => { if (rt.request().url().indexOf('/functions/v1/api') < 0) return rt.abort(); const b = JSON.parse(rt.request().postData() || '{}'); const r = await api(b.action, b.data, b.token); rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r) }); });
  if (init) await pg.addInitScript(init, arg); return pg;
}
// 1) Tienda: el comprador hace su pedido
const tienda = await pagina(); await tienda.goto('http://localhost:8772/?tienda=' + neg); await tienda.waitForTimeout(2500);
await tienda.evaluate(() => { const ps = T.info.productos.filter(x => x.precio > 0).slice(0, 2); T.cart[ps[0].id] = 2; T.cart[ps[1].id] = 1; guardarCarrito(); tCarrito(); });
await tienda.waitForTimeout(600); await tienda.fill('#tc-n', 'María Rodríguez'); await tienda.fill('#tc-t', '98765432');
await tienda.locator('.sheet-f .wa').click(); await tienda.waitForTimeout(1500);
const clave = await tienda.evaluate(() => chatClave()); console.log('clave guardada en la tienda:', !!clave);
// 2) App del negocio: confirmar desde Pedidos (con la interfaz)
const app = await pagina(t => { localStorage.setItem('gnvm@/|token', t); localStorage.setItem('gnvm@/|verVisto', '9.9.9'); }, tok);
await app.goto('http://localhost:8772/'); await app.waitForTimeout(3000); await app.evaluate(() => cerrarHojas()); await app.waitForTimeout(500);
await app.evaluate(() => ir('pedidos')); await app.waitForTimeout(1500);
await app.locator('[data-a="pedAccion"][data-e="confirmado"]').first().click(); await app.waitForTimeout(700);
await app.screenshot({ path: OUT + '/a1-confirmado-toast.png' });
const hojaWA = await app.locator('.sheet .btn.wa.big').count(); console.log('hoja de WhatsApp abierta tras confirmar:', hojaWA);
await app.waitForTimeout(2500);
// el cliente pregunta y el negocio responde
await api('chatEnviar', { negocio: neg, clave, texto: '¿Puedo pasar a las 4?' });
const ch = (await api('chats', {}, tok)).data[0];
await api('chatResponder', { id: ch.id, texto: '¡Claro! Te esperamos 😊' }, tok);
await app.evaluate(() => { S.pedidosL = null; R.pedidos(); }); await app.waitForTimeout(1200);
await app.locator('[data-a="pedAccion"][data-e="listo"]').first().click(); await app.waitForTimeout(700);
await app.screenshot({ path: OUT + '/a2-listo-toast.png' });
await app.waitForTimeout(2500);
// 3) Tienda: el comprador ve los avisos en el chat
await tienda.evaluate(() => { cerrarHojas(); chatBadgeTienda(); misPedidosTienda(); }); await tienda.waitForTimeout(1500);
await tienda.screenshot({ path: OUT + '/a3-tienda-globito.png' });
await tienda.evaluate(() => chatTienda('')); await tienda.waitForTimeout(1500);
await tienda.screenshot({ path: OUT + '/a4-tienda-chat.png' });
// 4) App: conversación en Mensajes
await app.evaluate(() => { cerrarHojas(); ir('mensajes'); }); await app.waitForTimeout(1500);
await app.screenshot({ path: OUT + '/a5-app-mensajes.png' });
await app.evaluate(id => verChat(id), ch.id); await app.waitForTimeout(1500);
await app.screenshot({ path: OUT + '/a6-app-chat.png' });
// 5) App: Mi tienda en línea › Mensajes automáticos
await app.evaluate(() => { cerrarHojas(); ir('tienda'); }); await app.waitForTimeout(1500);
await app.locator('#aj-auto').scrollIntoViewIfNeeded(); await app.evaluate(() => { document.getElementById('aj-auto').scrollIntoView({ block: 'start' }); scrollBy(0, -70); });
await app.waitForTimeout(400); await app.screenshot({ path: OUT + '/a7-ajustes.png' });
await app.locator('#aj-auto details').first().evaluate(d => d.open = true); await app.waitForTimeout(300);
await app.locator('#aj-auto').screenshot({ path: OUT + '/a8-ajustes-completo.png' });
// guardar desde la interfaz: apagar «Pedido confirmado»
await app.locator('#aj-auto input[data-k="autoConfirmado"]').evaluate(i => i.click());
await app.locator('#aj-auto [data-a="guardarAj"]').click(); await app.waitForTimeout(1200);
console.log('autoConfirmado guardado:', (await api('bootstrap', {}, tok)).data.config.autoConfirmado);
await br.close(); web.close(); console.log('errores JS:', errores.length); console.log('listo');
