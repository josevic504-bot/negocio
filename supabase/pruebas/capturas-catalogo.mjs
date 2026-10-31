// Capturas del rubro Catálogo: portada con secciones, sección Rostro, ficha con tonos y precio especial, pedido, formulario del producto
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const RAIZ = process.argv[3], OUT = process.argv[2];
const SRC = fs.readFileSync(RAIZ + '/Codigo.gs', 'utf8');
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), log: () => {}, urlArchivo: r => 'https://x/' + r, rutaDeUrl: () => null });
const api = (action, data, token, extra) => srv.atender(Object.assign({ action, token, data: data || {} }, extra || {}));
const web = http.createServer((q, r) => { let f = path.join(RAIZ, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.png') ? 'image/png' : f.endsWith('.webp') ? 'image/webp' : 'application/octet-stream' }); r.end(d); }); }).listen(8768);
const tok = (await api('registrar', { negocio: 'Norey Beauty & More', nombre: 'Noemí Reyes', giro: 'catalogo', whatsapp: '33130265', pin: '1234' })).data.token;
await api('cargarEjemplos', {}, tok);
const neg = (await api('bootstrap', {}, tok)).data.negocioId;
await db.aplicar({ ops: [{ t: 'Licencias', op: 'upd', k: { id: neg }, row: { plus: 'si', estado: 'Activa' } }] });
await api('guardar', { entidad: 'Config', registro: { tienda: 'si', tema: 'rosa', eslogan: 'Maquillaje al detalle y por mayor', telefono: '9999-0000', tiendaSecciones: JSON.stringify({ Rostro: { c: '#e8758f' }, Ojos: { c: '#9a83d8' }, Labios: { c: '#f0806a' }, Cejas: { c: '#c98b5e' }, Lociones: { c: '#3fa7b5' }, Ropa: { c: '#d45d9b' } }) } }, tok);
const br = await chromium.launch();
async function pagina(init, arg) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  await pg.route(/^https?:\/\/(?!localhost).*/, async rt => {
    if (rt.request().url().indexOf('/functions/v1/api') < 0) return rt.abort();
    const b = JSON.parse(rt.request().postData() || '{}');
    const r = await api(b.action, b.data, b.token, { panel: b.panel });
    rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r) });
  });
  if (init) await pg.addInitScript(init, arg);
  return pg;
}
let pg = await pagina();
await pg.goto('http://localhost:8768/?tienda=' + neg); await pg.waitForTimeout(2500);
await pg.locator('#t-cat').scrollIntoViewIfNeeded(); await pg.evaluate(() => scrollBy(0, -10)); await pg.waitForTimeout(400);
await pg.screenshot({ path: OUT + '/c1-secciones.png' });
await pg.locator('[data-sec="Rostro"]').click(); await pg.waitForTimeout(900);
await pg.screenshot({ path: OUT + '/c2-rostro.png' });
await pg.locator('.sp-card', { hasText: 'Corrector' }).click(); await pg.waitForTimeout(700);
await pg.locator('.tono', { hasText: 'Nude 3' }).click(); await pg.locator('.qty [data-d="1"]').click(); await pg.locator('.qty [data-d="1"]').click(); await pg.waitForTimeout(400);
await pg.screenshot({ path: OUT + '/c3-ficha.png' });
await pg.locator('.sheet-f .acc').click(); await pg.waitForTimeout(800);
await pg.evaluate(() => tCarrito()); await pg.waitForTimeout(700);
await pg.screenshot({ path: OUT + '/c4-pedido.png' });
// Ropa y lociones
pg = await pagina(); await pg.goto('http://localhost:8768/?tienda=' + neg); await pg.waitForTimeout(2500);
await pg.locator('[data-sec="Lociones"]').scrollIntoViewIfNeeded(); await pg.waitForTimeout(300);
await pg.screenshot({ path: OUT + '/r0-secciones.png' });
await pg.locator('[data-sec="Ropa"]').click(); await pg.waitForTimeout(900);
await pg.screenshot({ path: OUT + '/r1-ropa.png' });
await pg.locator('.sp-card', { hasText: 'Blusa' }).click(); await pg.waitForTimeout(700);
await pg.locator('.tono', { hasText: 'Rosa' }).click(); await pg.locator('.sheet .chip', { hasText: /^M$/ }).click(); await pg.waitForTimeout(400);
await pg.screenshot({ path: OUT + '/r2-blusa.png' });
await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
await pg.evaluate(() => { T.cat = 'Lociones'; T.sub = ''; pintarTienda(); }); await pg.waitForTimeout(700);
await pg.locator('#t-cat').scrollIntoViewIfNeeded(); await pg.waitForTimeout(300);
await pg.screenshot({ path: OUT + '/r3-lociones.png' });
// Formulario del producto en la app
pg = await pagina(t => { localStorage.setItem('gnvm@/|token', t); localStorage.setItem('gnvm@/|verVisto', '9.9.9'); }, tok);
await pg.goto('http://localhost:8768/'); await pg.waitForTimeout(3000);
await pg.evaluate(() => { ir('productos'); }); await pg.waitForTimeout(800);
await pg.evaluate(() => formProducto(S.productos.find(p => p.nombre === 'Corrector líquido'))); await pg.waitForTimeout(800);
await pg.locator('.pf-sw').first().scrollIntoViewIfNeeded(); await pg.waitForTimeout(300);
await pg.screenshot({ path: OUT + '/c5-form-tonos.png' });
await pg.locator('#pf-pe').scrollIntoViewIfNeeded(); await pg.waitForTimeout(300);
await pg.screenshot({ path: OUT + '/c6-form-catalogo.png' });
await br.close(); web.close(); console.log('listo');
