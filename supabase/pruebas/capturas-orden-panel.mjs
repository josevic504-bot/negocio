// Prueba y capturas 1.9.84: orden del Panel en ambas direcciones
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const RAIZ = process.argv[3], OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const SRC = fs.readFileSync(RAIZ + '/Codigo.gs', 'utf8');
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), log: () => {}, urlArchivo: r => 'http://localhost:8783/__f/' + r, rutaDeUrl: u => (u.split('/__f/')[1] || null) });
const api = async (action, data, token, extra) => { const r = await srv.atender(Object.assign({ action, token, data: data || {} }, extra || {})); if (!r.ok) console.log('API', action, r.error); return r; };
const web = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); let f = path.join(RAIZ, u); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); r.end(d); }); }).listen(8783);
let fallas = 0; const v = (n, c, x) => { console.log((c ? '✔ ' : '✘ ') + n); if (!c) { fallas++; if (x !== undefined) console.log('   ', JSON.stringify(x).slice(0, 400)); } };
await db.aplicar({ props: { PANEL_CLAVE: 'clave123' } });
const nombres = ['Primero Viejo', 'Segundo Medio', 'Tercero Nuevo'];
for (let i = 0; i < 3; i++) { await api('registrar', { negocio: nombres[i], nombre: 'Dueño ' + i, giro: 'variedades', whatsapp: '3313027' + i, pin: '1234' }); }
// fechas de registro distintas
(db.T.Licencias||[]).forEach((l, i) => { l.registro = new Date(Date.UTC(2026, 9, 1 + i * 10)).toISOString(); });
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage();
const errores = []; pg.on('pageerror', e => { errores.push(e.message); console.log('ERROR JS:', e.message); });
await pg.route(/^https?:\/\/(?!localhost).*/, async rt => { if (rt.request().url().indexOf('/functions/v1/api') < 0) return rt.abort(); const b = JSON.parse(rt.request().postData() || '{}'); const r = await api(b.action, b.data, b.token, { panel: b.panel }); rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r) }); });
await pg.goto('http://localhost:8783/?panel'); await pg.waitForTimeout(1500);
const inp = pg.locator('input[type=password]').first(); await inp.fill('clave123'); await inp.press('Enter'); await pg.waitForTimeout(2500);
await pg.locator('#pn-tabs [data-k="cli"]').click(); await pg.waitForTimeout(800);
const orden = async () => (await pg.locator('#pn-list').textContent());
const pos = t => nombres.map(n => t.indexOf(n));
let p = pos(await orden()); v('por defecto: nuevos primero', p[2] < p[1] && p[1] < p[0], p);
v('el botón dice «Nuevos primero»', /Nuevos primero/.test(await pg.locator('.pn-dir').textContent()));
await pg.evaluate(() => document.querySelector('.pn-h').scrollIntoView({ block: 'start' })); await pg.screenshot({ path: OUT + '/1-nuevos-primero.png' });
await pg.locator('.pn-dir').click(); await pg.waitForTimeout(400);
p = pos(await orden()); v('al tocar la flecha: viejos primero', p[0] < p[1] && p[1] < p[2], p);
v('el botón dice «Viejos primero»', /Viejos primero/.test(await pg.locator('.pn-dir').textContent()));
await pg.evaluate(() => document.querySelector('.pn-h').scrollIntoView({ block: 'start' })); await pg.screenshot({ path: OUT + '/2-viejos-primero.png' });
await pg.reload(); await pg.waitForTimeout(2500); if (!(await pg.locator('.pn-dir').count())) { await pg.locator('#pn-tabs [data-k="cli"]').click(); await pg.waitForTimeout(800); }
v('recuerda la dirección al recargar', /Viejos primero/.test(await pg.locator('.pn-dir').textContent()));
await pg.locator('[data-a="panelOrden"]').click(); await pg.waitForTimeout(400);
v('al cambiar a pendientes vuelve a la dirección normal', /Más pendientes/.test(await pg.locator('.pn-dir').textContent()));
await pg.locator('[data-a="panelOrden"]').click(); await pg.waitForTimeout(300); await pg.locator('.pn-dir').click(); await pg.waitForTimeout(300);
v('salud volteada dice «Mejor salud»', /Mejor salud/.test(await pg.locator('.pn-dir').textContent()));
await pg.evaluate(() => document.querySelector('.pn-h').scrollIntoView({ block: 'start' })); await pg.screenshot({ path: OUT + '/3-mejor-salud.png' });
v('sin errores de JavaScript', !errores.length, errores);
await br.close(); web.close(); console.log(fallas ? fallas + ' FALLAS' : 'TODO BIEN'); process.exit(fallas ? 1 : 0);
