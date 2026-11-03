// Capturas: comprobante de pago en la tienda, en «Mis pedidos» y en la app del negocio
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const RAIZ = process.argv[3], OUT = process.argv[2], RECIBO = process.argv[4];
const SRC = fs.readFileSync(RAIZ + '/Codigo.gs', 'utf8');
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
const fotos = {};
db.efecto = async e => { if (e.subir) fotos[e.subir.ruta] = Buffer.from(e.subir.b64, 'base64'); };
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), log: () => {}, urlArchivo: r => 'http://localhost:8771/__f/' + r, rutaDeUrl: u => (u.split('/__f/')[1] || null) });
const api = (action, data, token) => srv.atender({ action, token, data: data || {} });
const web = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); if (u.startsWith('/__f/')) { r.writeHead(200, { 'Content-Type': 'image/jpeg' }); r.end(fotos[u.slice(5)] || ''); return; }
  let f = path.join(RAIZ, u); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.webp') ? 'image/webp' : f.endsWith('.png') ? 'image/png' : 'application/octet-stream' }); r.end(d); }); }).listen(8771);
const tok = (await api('registrar', { negocio: 'Norey Beauty & More', nombre: 'Noemí Reyes', giro: 'catalogo', whatsapp: '33130265', pin: '1234' })).data.token;
await api('cargarEjemplos', {}, tok);
const neg = (await api('bootstrap', {}, tok)).data.negocioId;
await db.aplicar({ ops: [{ t: 'Licencias', op: 'upd', k: { id: neg }, row: { plus: 'si', estado: 'Activa' } }] });
await api('guardar', { entidad: 'Config', registro: { tienda: 'si', tema: 'rosa', tiendaPagos: 'Efectivo,Transferencia', tiendaDatosPago: 'BAC · Cuenta 7300-1234-5 · Noemí Reyes' } }, tok);
const br = await chromium.launch();
async function pagina(init, arg) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage();
  pg.on('pageerror', e => console.log('ERROR JS:', e.message));
  await pg.route(/^https?:\/\/(?!localhost).*/, async rt => { if (rt.request().url().indexOf('/functions/v1/api') < 0) return rt.abort(); const b = JSON.parse(rt.request().postData() || '{}'); const r = await api(b.action, b.data, b.token); rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r) }); });
  if (init) await pg.addInitScript(init, arg); return pg;
}
let pg = await pagina(); await pg.goto('http://localhost:8771/?tienda=' + neg); await pg.waitForTimeout(2500);
await pg.evaluate(() => { const p = T.info.productos.find(x => x.nombre.startsWith('Loción para dama')); T.cart[p.id + SEP + 'Aroma: Floral'] = 1; const q = T.info.productos.find(x => x.nombre.startsWith('Body')); T.cart[q.id + SEP + 'Aroma: Coco'] = 2; guardarCarrito(); tCarrito(); });
await pg.waitForTimeout(600); await pg.fill('#tc-n', 'Carla Ruiz'); await pg.fill('#tc-t', '98765432');
await pg.selectOption('#tc-p', 'Transferencia'); await pg.waitForTimeout(300);
await pg.locator('#tc-cf').setInputFiles(RECIBO); await pg.waitForTimeout(900);
await pg.locator('.comp-t').scrollIntoViewIfNeeded(); await pg.screenshot({ path: OUT + '/k1-tienda.png' });
await pg.locator('.sheet-f .wa').click(); await pg.waitForTimeout(1200);
// segundo pedido sin comprobante
await pg.evaluate(() => { cerrarHojas(); const p = T.info.productos.find(x => x.nombre.startsWith('Lip')); T.cart[p.id + SEP + 'Tono: Rosa'] = 1; guardarCarrito(); tCarrito(); }); await pg.waitForTimeout(500);
await pg.selectOption('#tc-p', 'Transferencia'); await pg.locator('.sheet-f .wa').click(); await pg.waitForTimeout(1200);
await pg.evaluate(() => { cerrarHojas(); misPedidosTienda(); }); await pg.waitForTimeout(1200);
await pg.locator('#t-mis').scrollIntoViewIfNeeded(); await pg.evaluate(() => scrollBy(0, -60)); await pg.screenshot({ path: OUT + '/k2-mis.png' });
// App del negocio
pg = await pagina(t => { localStorage.setItem('gnvm@/|token', t); localStorage.setItem('gnvm@/|verVisto', '9.9.9'); }, tok);
await pg.goto('http://localhost:8771/'); await pg.waitForTimeout(3000);
await pg.evaluate(() => ir('pedidos')); await pg.waitForTimeout(1500);
await pg.locator('.comp-p').first().scrollIntoViewIfNeeded(); await pg.screenshot({ path: OUT + '/k3-app.png' });
await pg.locator('[data-a="pedPago"][data-ok="1"]').first().click(); await pg.waitForTimeout(500);
await pg.getByRole('button', { name: 'Pago recibido' }).last().click(); await pg.waitForTimeout(1500);
await pg.locator('.comp-p').first().scrollIntoViewIfNeeded(); await pg.screenshot({ path: OUT + '/k4-app-ok.png' });
const L = (await api('pedidos', {}, tok)).data; console.log('pedidos:', JSON.stringify((L.lista || L).map(p => p.numero + ' ' + p.pagoEstado + ' anticipo ' + (p.anticipoPagado || 0))));
await br.close(); web.close(); console.log('listo');
