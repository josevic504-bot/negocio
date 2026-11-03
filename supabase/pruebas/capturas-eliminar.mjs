// Capturas: el cliente borra sus datos o elimina su cuenta
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const RAIZ = process.argv[3], OUT = process.argv[2], RECIBO = process.argv[4];
const SRC = fs.readFileSync(RAIZ + '/Codigo.gs', 'utf8');
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
const fotos = {}; db.efecto = async e => { if (e.subir) fotos[e.subir.ruta] = Buffer.from(e.subir.b64, 'base64'); };
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), log: () => {}, urlArchivo: r => 'http://localhost:8777/__f/' + r, rutaDeUrl: u => (u.split('/__f/')[1] || null) });
const api = (action, data, token, extra) => srv.atender(Object.assign({ action, token, data: data || {} }, extra || {}));
const web = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); if (u.startsWith('/__f/')) { r.writeHead(200, { 'Content-Type': 'image/jpeg' }); r.end(fotos[u.slice(5)] || ''); return; }
  let f = path.join(RAIZ, u); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.webp') ? 'image/webp' : f.endsWith('.png') ? 'image/png' : 'application/octet-stream' }); r.end(d); }); }).listen(8777);
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

const br = await chromium.launch();
async function pagina(init, arg) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage();
  pg.on('pageerror', e => console.log('ERROR JS:', e.message));
  await pg.route(/^https?:\/\/(?!localhost).*/, async rt => { if (rt.request().url().indexOf('/functions/v1/api') < 0) return rt.abort(); const b = JSON.parse(rt.request().postData() || '{}'); const r = await api(b.action, b.data, b.token, { panel: b.panel }); rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r) }); });
  if (init) await pg.addInitScript(init, arg); return pg;
}
let pg = await pagina(t => { localStorage.setItem('gnvm@/|token', t); localStorage.setItem('gnvm@/|verVisto', '9.9.9'); }, negs[0].t);
await pg.goto('http://localhost:8777/'); await pg.waitForTimeout(3500);
await pg.evaluate(() => ir('ajustes')); await pg.waitForTimeout(900);
await pg.evaluate(() => { const el = document.querySelector('.zp'); if (el) el.scrollIntoView({ block: 'center' }); }); await pg.waitForTimeout(300);
await pg.screenshot({ path: OUT + '/d1-ajustes.png' });
await pg.evaluate(() => ACC.borrarDatos()); await pg.waitForTimeout(600); await pg.locator('#bd-n').fill('Norey Beauty & More');
await pg.screenshot({ path: OUT + '/d2-borrar.png' });
await pg.evaluate(() => { PILA.slice().reverse().forEach(h => h.cerrar()); }); await pg.waitForTimeout(300);
await pg.evaluate(() => ACC.eliminarCuenta()); await pg.waitForTimeout(600); await pg.locator('#ec-m').fill('Cerré el negocio'); await pg.locator('#ec-c').fill('ELIMINAR'); await pg.locator('#ec-p').fill('1234');
await pg.screenshot({ path: OUT + '/d3-eliminar.png' });
await pg.locator('.sheet-f .bad').click(); await pg.waitForTimeout(500); await pg.locator('.sheet-f .bad, .sheet-f .pri').last().click(); await pg.waitForTimeout(2500);
await pg.screenshot({ path: OUT + '/d4-eliminada.png' });
// otra dueña borra movimientos
const t2 = negs[3].t; await api('borrarDatos', { alcance: 'movimientos', confirmar: 'Comedor Mary', pin: '1234' }, t2);
// Panel
pg = await pagina(); await pg.goto('http://localhost:8777/?panel'); await pg.waitForTimeout(1500);
const inp = pg.locator('input[type=password]').first(); await inp.fill('clave123'); await inp.press('Enter'); await pg.waitForTimeout(2500);
await pg.evaluate(() => { const el = document.querySelector('.pn-card'); const h = [...document.querySelectorAll('.pn-h')].find(x => /Pendientes/.test(x.textContent)); if (h) h.scrollIntoView({ block: 'start' }); }); await pg.waitForTimeout(300);
await pg.screenshot({ path: OUT + '/d5-panel.png' });
await pg.evaluate(id => panelFicha(id), negs[0].id); await pg.waitForTimeout(2500);
await pg.screenshot({ path: OUT + '/d6-ficha.png' });
console.log('eliminadas:', JSON.stringify((await P('panelResumen')).data.eliminadas.map(x => x.negocio)));
await br.close(); web.close(); console.log('listo');
