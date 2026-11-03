// Capturas: salud, respaldos y copiar productos
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const RAIZ = process.argv[3], OUT = process.argv[2], RECIBO = process.argv[4];
const SRC = fs.readFileSync(RAIZ + '/Codigo.gs', 'utf8');
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
const fotos = {}; db.efecto = async e => { if (e.subir) fotos[e.subir.ruta] = Buffer.from(e.subir.b64, 'base64'); };
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), log: () => {}, urlArchivo: r => 'http://localhost:8774/__f/' + r, rutaDeUrl: u => (u.split('/__f/')[1] || null) });
const api = (action, data, token, extra) => srv.atender(Object.assign({ action, token, data: data || {} }, extra || {}));
const web = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); if (u.startsWith('/__f/')) { r.writeHead(200, { 'Content-Type': 'image/jpeg' }); r.end(fotos[u.slice(5)] || ''); return; }
  let f = path.join(RAIZ, u); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.webp') ? 'image/webp' : f.endsWith('.png') ? 'image/png' : 'application/octet-stream' }); r.end(d); }); }).listen(8774);
await db.aplicar({ props: { TAREAS_CLAVE: 'tk', PANEL_CLAVE: 'clave123', DATOS_PAGO_LIC: 'BAC · Cuenta 7300-0000-1 · José Vicdonio Molina' } });
const negs = [];
for (const [n, d, g, w] of [['Norey Beauty & More', 'Noemí Reyes', 'catalogo', '33130265'], ['Boutique Ana', 'Ana López', 'ropa', '99887766'], ['Vet Canitas', 'Luis Pérez', 'veterinaria', '98765432'], ['Comedor Mary', 'Mary Castro', 'comida', '97776655'], ['Eventos Sol', 'Karla Díaz', 'eventos', '96665544']]) {
  const t = (await api('registrar', { negocio: n, nombre: d, giro: g, whatsapp: w, pin: '1234' })).data.token; negs.push({ t, id: (await api('bootstrap', {}, t)).data.negocioId });
}
for (const i of [0, 2, 3]) await api('cargarEjemplos', {}, negs[i].t);
await srv.atender({ tarea: 'respaldosDia', clave: 'tk' });
const pt = (await api('panelLogin', { clave: 'clave123' })).data.token;
const P = (a, d) => srv.atender({ action: a, panel: pt, data: d || {} });
for (const i of [0, 2]) console.log('activar', JSON.stringify((await P('panelAccion', { id: negs[i].id, accion: 'activar', monto: 350 })).ok));
await P('panelAccion', { id: negs[4].id, accion: 'bloquear' });
const en3 = new Date(Date.now() - 6 * 3600000 + 3 * 86400000).toISOString().slice(0, 10);
await P('panelCuotas', { id: negs[0].id, accion: 'programar', monto: 350, fecha: en3, veces: 1, concepto: 'Licencia noviembre' });
for (let i = 0; i < 34; i++) await api('visita', { p: 'inicio', o: ['facebook', 'facebook', 'whatsapp', ''][i % 4], d: 'cel', v: 'v' + (i % 21) });
await P('panelRespaldoHacer', { id: negs[0].id });
const br = await chromium.launch();
async function pagina(init, arg) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage();
  pg.on('pageerror', e => console.log('ERROR JS:', e.message));
  await pg.route(/^https?:\/\/(?!localhost).*/, async rt => { if (rt.request().url().indexOf('/functions/v1/api') < 0) return rt.abort(); const b = JSON.parse(rt.request().postData() || '{}'); const r = await api(b.action, b.data, b.token, { panel: b.panel }); rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r) }); });
  if (init) await pg.addInitScript(init, arg); return pg;
}
let pg = await pagina(); await pg.goto('http://localhost:8774/?panel'); await pg.waitForTimeout(1500);
const inp = pg.locator('input[type=password]').first(); await inp.fill('clave123'); await inp.press('Enter'); await pg.waitForTimeout(2500);
await pg.locator('#pn-tabs [data-k="cli"]').click(); await pg.waitForTimeout(700);
await pg.locator('.cc2').nth(1).click(); await pg.waitForTimeout(500);
await pg.screenshot({ path: OUT + '/r1-clientes.png' });
await pg.evaluate(id => panelFicha(id), negs[0].id); await pg.waitForTimeout(2500);
await pg.locator('.sal-c').scrollIntoViewIfNeeded(); await pg.evaluate(() => document.querySelector('.sheet-b').scrollBy(0, -60));
await pg.screenshot({ path: OUT + '/r2-salud.png' });
await pg.locator('#pf-resp').scrollIntoViewIfNeeded(); await pg.evaluate(() => document.querySelector('.sheet-b').scrollBy(0, 120));
await pg.screenshot({ path: OUT + '/r3-respaldos.png' });
await pg.locator('#pf-resp .resp-li').first().click(); await pg.waitForTimeout(700);
await pg.locator('#rs-a [data-k="productos"]').click(); await pg.waitForTimeout(200);
await pg.screenshot({ path: OUT + '/r4-restaurar.png' });
await pg.evaluate(() => { PILA.slice().reverse().forEach(h => h.cerrar()); }); await pg.waitForTimeout(500);
await pg.evaluate(id => panelFicha(id), negs[1].id); await pg.waitForTimeout(2000);
await pg.locator('[data-x="copiar"]').click(); await pg.waitForTimeout(600);
await pg.locator('#cp-de').selectOption(negs[0].id); await pg.waitForTimeout(1200);
await pg.locator('[data-c="Ropa"]').click(); await pg.waitForTimeout(300);
await pg.screenshot({ path: OUT + '/r5-copiar.png' });
await pg.locator('.sheet-f .pri').last().click(); await pg.waitForTimeout(2000);
console.log('toast:', await pg.locator('.toast').last().textContent().catch(() => ''));
console.log('productos en destino:', db.T.Productos.filter(p => p.negocio_id === negs[1].id).length);
await br.close(); web.close(); console.log('listo');
