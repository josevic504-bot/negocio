// Capturas del giro Vitaminas y suplementos: tienda por objetivo, ficha, Inicio, Lotes, Recompra, producto, menú
// node capturas-vitaminas.mjs <carpeta salida> <carpeta con index.html y Codigo.gs>
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const OUT = process.argv[2], RAIZ = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });
const SRC = fs.readFileSync(RAIZ + '/Codigo.gs', 'utf8');
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), log: () => {}, urlArchivo: r => 'https://x/' + r, rutaDeUrl: () => null });
const api = (action, data, token, extra) => srv.atender(Object.assign({ action, token, data: data || {} }, extra || {}));
const web = http.createServer((q, r) => { let f = path.join(RAIZ, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.png') ? 'image/png' : f.endsWith('.webp') ? 'image/webp' : 'application/octet-stream' }); r.end(d); }); }).listen(8769);
const tok = (await api('registrar', { negocio: 'Vida Natural HN', nombre: 'Ana Mejía', giro: 'vitaminas', whatsapp: '33445566', pin: '1234' })).data.token;
await api('cargarEjemplos', {}, tok);
const neg = (await api('bootstrap', {}, tok)).data.negocioId;
await db.aplicar({ ops: [{ t: 'Licencias', op: 'upd', k: { id: neg }, row: { plus: 'si', estado: 'Activa' } }] });
await api('guardar', { entidad: 'Config', registro: { tienda: 'si', tema: 'esmeralda', eslogan: 'Vitaminas y suplementos · San Pedro Sula', telefono: '3344-5566' } }, tok);
let ps = (await api('bootstrap', {}, tok)).data.productos; const P = n => ps.find(p => p.nombre.startsWith(n));
const f = d => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
await api('loteAgregar', { productoId: P('Colágeno').id, lote: 'A-114', vence: f(12), cantidad: 6 }, tok);
await api('loteAgregar', { productoId: P('Omega').id, lote: 'OM-22', vence: f(25), cantidad: 3 }, tok);
await api('loteAgregar', { productoId: P('Magnesio').id, lote: 'MG-05', vence: f(28), cantidad: 8 }, tok);
await api('loteAgregar', { productoId: P('Vitamina C').id, lote: 'VC-07', vence: f(60), cantidad: 10 }, tok);
// Clientes y ventas de hace un tiempo
const clientes = [['María López', '99887766', 'Multivitamínico', 1, 55], ['Carlos Mejía', '98761234', 'Proteína', 1, 26], ['Daniela Paz', '97651111', 'Omega', 1, 86], ['Ana Rivera', '96542222', 'Colágeno', 1, 28]];
let k = 0;
for (const [n, t, prod, c, dias] of clientes) {
  const cl = (await api('guardar', { entidad: 'Clientes', registro: { nombre: n, telefono: t } }, tok)).data;
  const p = P(prod);
  const r = await api('venta', { clienteId: cl.id, items: [{ productoId: p.id, cantidad: c, precio: p.precio, variante: p.nombre.startsWith('Multi') ? 'Presentación: 60 cápsulas' : p.nombre.startsWith('Prote') ? 'Sabor: Vainilla' : '' }], metodo: 'Efectivo', recibido: p.precio * c, clave: 'v' + (++k) }, tok);
  if (!r.ok) console.log('venta', n, r.error);
  const V = (await api('ventas', {}, tok)).data; const lista = V.lista || V; const v = lista.find(x => x.clienteId === cl.id);
  await db.aplicar({ ops: [{ t: 'Ventas', op: 'upd', k: { id: v.id }, row: { fecha: new Date(Date.now() - dias * 864e5).toISOString().slice(0, 10) + 'T10:00' } }] });
}
const rc = await api('recompra', {}, tok); const ana = rc.data.lista.find(x => x.cliente === 'Ana Rivera');
if (ana) await api('recompraAvisado', { clienteId: ana.clienteId, productoId: ana.productoId, ventaId: ana.ventaId }, tok);
const br = await chromium.launch();
const errores = [];
async function pagina(init, arg) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  pg.on('pageerror', e => errores.push(String(e))); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errores.push(m.text()); });
  await pg.route(/^https?:\/\/(?!localhost).*/, async rt => {
    if (rt.request().url().indexOf('/functions/v1/api') < 0) return rt.abort();
    const b = JSON.parse(rt.request().postData() || '{}');
    const r = await api(b.action, b.data, b.token, { panel: b.panel });
    rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r) });
  });
  if (init) await pg.addInitScript(init, arg);
  return pg;
}
// Tienda
let pg = await pagina();
await pg.goto('http://localhost:8769/?tienda=' + neg); await pg.waitForTimeout(2500);
await pg.screenshot({ path: OUT + '/t1-portada.png' });
await pg.locator('#t-cat').scrollIntoViewIfNeeded().catch(() => {}); await pg.waitForTimeout(400);
await pg.screenshot({ path: OUT + '/t2-secciones.png' });
await pg.locator('[data-sec="Defensas"]').click().catch(e => errores.push('sin sección Defensas')); await pg.waitForTimeout(900);
await pg.screenshot({ path: OUT + '/t3-defensas.png' });
await pg.locator('.sp-card, .pcard, [data-a="tProd"]', { hasText: 'Multivitamínico' }).first().click().catch(e => errores.push('sin tarjeta multi: ' + e.message)); await pg.waitForTimeout(900);
await pg.screenshot({ path: OUT + '/t4-ficha.png' });
// App
pg = await pagina(t => { localStorage.setItem('gnvm@/|token', t); localStorage.setItem('gnvm@/|verVisto', '9.9.9'); localStorage.setItem('gnvm@/|guiaVista', '1'); }, tok);
await pg.goto('http://localhost:8769/'); await pg.waitForTimeout(3000);
await pg.evaluate(() => cerrarHojas && cerrarHojas()).catch(() => {}); await pg.waitForTimeout(300);
await pg.screenshot({ path: OUT + '/a1-inicio.png' });
await pg.evaluate(() => ir('lotes')); await pg.waitForTimeout(1200);
await pg.screenshot({ path: OUT + '/a2-lotes.png' });
await pg.evaluate(() => ir('recompra')); await pg.waitForTimeout(1200);
await pg.screenshot({ path: OUT + '/a3-recompra.png' });
await pg.evaluate(() => ACC.mas()); await pg.waitForTimeout(800);
await pg.screenshot({ path: OUT + '/a4-menu.png' });
await pg.evaluate(() => cerrarHojas()); await pg.waitForTimeout(300);
await pg.evaluate(() => { ir('productos'); }); await pg.waitForTimeout(800);
await pg.evaluate(() => formProducto(S.productos.find(p => p.nombre.startsWith('Colágeno')))); await pg.waitForTimeout(900);
await pg.locator('#pf-lotes').scrollIntoViewIfNeeded().catch(() => {}); await pg.waitForTimeout(300);
await pg.screenshot({ path: OUT + '/a5-producto-lotes.png' });
await pg.evaluate(() => { cerrarHojas(); formProducto(S.productos.find(p => p.nombre.startsWith('Multivit'))); }); await pg.waitForTimeout(900);
await pg.screenshot({ path: OUT + '/a6-producto.png' });
await pg.evaluate(() => { cerrarHojas(); loteNuevo(S.productos.find(p => p.nombre.startsWith('Vitamina C')).id); }); await pg.waitForTimeout(700);
await pg.screenshot({ path: OUT + '/a7-lote-nuevo.png' });
// Recompra: tocar «Avisar» abre WhatsApp y marca avisada
await pg.evaluate(() => { cerrarHojas(); window.open = (u) => { window.__wa = u; }; ir('recompra'); }); await pg.waitForTimeout(900);
await pg.locator('[data-a="recAvisar"]').first().click(); await pg.waitForTimeout(900);
const wa = await pg.evaluate(() => window.__wa || '');
console.log('WhatsApp →', decodeURIComponent(wa).slice(0, 160));
await pg.screenshot({ path: OUT + '/a8-recompra-avisada.png' });
// Imágenes de la guía de inicio (330 px de ancho, como las demás)
{
  const ctx = await br.newContext({ viewport: { width: 330, height: 900 }, deviceScaleFactor: 2 });
  const g = await ctx.newPage();
  await g.route(/^https?:\/\/(?!localhost).*/, async rt => { if (rt.request().url().indexOf('/functions/v1/api') < 0) return rt.abort(); const b = JSON.parse(rt.request().postData() || '{}'); const r = await api(b.action, b.data, b.token, { panel: b.panel }); rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r) }); });
  await g.addInitScript(t => { localStorage.setItem('gnvm@/|token', t); localStorage.setItem('gnvm@/|verVisto', '9.9.9'); }, tok);
  await g.goto('http://localhost:8769/'); await g.waitForTimeout(3000); await g.evaluate(() => cerrarHojas()).catch(() => {});
  await g.evaluate(() => { ir('productos'); formProducto(S.productos.find(p => p.nombre.startsWith('Multivit'))); }); await g.waitForTimeout(900);
  const pf = async (sel, n) => { const el = g.locator(sel).first(); await el.scrollIntoViewIfNeeded(); await g.waitForTimeout(200); await el.screenshot({ path: OUT + '/gp' + n + '.png' }); };
  await pf('.fld:has(#pf-cat)', 1);
  await pf('.precio-box:has(.opc-row), .precio-box:has([id^="pf-op"])', 2).catch(async () => { await pf('.precio-box >> nth=0', 2); });
  await pf('.precio-box:has(#pf-pe), .precio-box:has(#pf-esp), .precio-box:has(h4:text("Catálogo"))', 3);
  await pf('.fld:has(#pf-rinde)', 4);
  await g.evaluate(() => { cerrarHojas(); ir('lotes'); }); await g.waitForTimeout(1200);
  await g.screenshot({ path: OUT + '/glotes.png', clip: { x: 0, y: 60, width: 330, height: 330 } });
  await g.evaluate(() => { ir('recompra'); }); await g.waitForTimeout(1200);
  await g.screenshot({ path: OUT + '/grecompra.png', clip: { x: 0, y: 60, width: 330, height: 330 } });
}
console.log(errores.length ? 'ERRORES:\n' + errores.join('\n') : 'SIN ERRORES EN CONSOLA');
await br.close(); web.close(); process.exit(0);
