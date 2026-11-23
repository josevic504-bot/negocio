// Prueba y capturas: descargas de plantillas de Excel en el análisis de Tiendas Catrachas (bloque colapsable del Panel)
// Uso: node plantillas-catrachas.mjs <carpeta de capturas> <raíz del repo en main>
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const OUT = process.argv[2], RAIZ = process.argv[3]; fs.mkdirSync(OUT, { recursive: true });
const SRC = fs.readFileSync(RAIZ + '/Codigo.gs', 'utf8');
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), log: () => {}, urlArchivo: r => 'http://localhost:8786/__f/' + r, rutaDeUrl: u => (u.split('/__f/')[1] || null) });
const api = async (action, data, token, extra) => srv.atender(Object.assign({ action, token, data: data || {} }, extra || {}));
const tipo = f => f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.css') ? 'text/css' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.png') ? 'image/png' : 'application/octet-stream';
const web = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); let f = path.join(RAIZ, u); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': tipo(f) }); r.end(d); }); }).listen(8786);
let fallas = 0; const v = (n, c, x) => { console.log((c ? '✔ ' : '✘ ') + n); if (!c) { fallas++; if (x !== undefined) console.log('   ', JSON.stringify(x).slice(0, 600)); } };
await db.aplicar({ props: { PANEL_CLAVE: 'clave123' } });
let k = 0; const ev = async (p, v2) => api('visita', { p, o: 'google', d: 'cel', v: v2 || 'persona' + String(1000 + (k++)) });
for (let i = 0; i < 10; i++) await ev('tc-inicio');
await ev('tc-plant', 'ana00001'); await ev('tc-plant-1', 'ana00001'); await ev('tc-bajar-1', 'ana00001');           // Ana ve la lista, la de inventario y la descarga
await ev('tc-plant-1', 'beto0001'); await ev('tc-bajar-1', 'beto0001'); await ev('tc-bajar-1', 'beto0001');        // Beto la descarga dos veces seguidas: cuenta una
await ev('tc-plant-8', 'caro0001'); await ev('tc-bajar-8', 'caro0001'); await ev('tc-bajar-8-wa', 'caro0001');     // Caro descarga la completa y pide la contraseña
await ev('tc-plant-4', 'dani0001');                                                                              // Dani solo mira Ventas al crédito
await ev('tc-bajar-plantilla-completa-pa', 'eva00001');                                                          // registro viejo (nombre cortado)
const pt = (await api('panelLogin', { clave: 'clave123' })).data; const PT = pt && (pt.token || pt);
const r = await api('panelCatrachas', { dias: 30 }, PT, { panel: PT }); const x = r.data || {}, p = x.plantillas || {};
v('las descargas no se suman como visitas', r.ok && x.visitas === 15, [r.error, x.visitas]);
v('las páginas de plantillas salen en su propia sección', x.secciones && x.secciones.some(s => s.k === 'Plantillas' && s.n === 5) && !x.secciones.some(s => s.k === 'Otras'), x.secciones);
v('cuenta descargas y personas', p.bajadas === 4 && p.personasBajan === 4 && p.vistas === 5 && p.personas === 4, p);
v('cuenta aparte el toque a «Comprar la contraseña»', p.wa === 1, p.wa);
const L = n => (p.lista || []).find(t => t.n === n) || {};
v('por plantilla: inventario 2 vistas y 2 descargas', L(1).nombre === 'Inventario' && L(1).vistas === 2 && L(1).bajadas === 2, L(1));
v('por plantilla: la completa junta la descarga nueva y la vieja', L(8).nombre === 'Plantilla completa para tu negocio' && L(8).bajadas === 2 && L(8).wa === 1 && L(8).vistas === 1, L(8));
v('salen las 8 plantillas, la más descargada primero', p.lista && p.lista.length === 8 && p.lista[0].bajadas === 2, p.lista && p.lista.map(t => t.nombre));
v('tasa: personas que descargan de cada 100 que ven', p.tasa === 100, p.tasa);
// El Panel
const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome' }); const ctx = await br.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage();
const errores = []; pg.on('pageerror', e => { errores.push(e.message); console.log('ERROR JS:', e.message); });
await pg.route(/^https?:\/\/(?!localhost).*/, async rt => { if (rt.request().url().indexOf('/functions/v1/api') < 0) return rt.abort(); const b = JSON.parse(rt.request().postData() || '{}'); const y = await api(b.action, b.data, b.token, { panel: b.panel }); rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(y) }); });
await pg.goto('http://localhost:8786/?panel'); await pg.waitForTimeout(1500);
const inp = pg.locator('input[type=password]').first(); await inp.fill('clave123'); await inp.press('Enter'); await pg.waitForTimeout(2500);
await pg.locator('#pn-tabs [data-k="mkt"]').click(); await pg.waitForTimeout(1000);
await pg.locator('[data-a="panelCatrachas"]').click(); await pg.waitForTimeout(1500);
const txt = await pg.locator('#tc-c').textContent();
v('la lectura dice la más descargada', /4 descargas de plantillas en el período\. La más descargada: «(Inventario|Plantilla completa para tu negocio)» \(2\)\. 1 toque a «Comprar la contraseña»\./.test(txt), txt.slice(0, 700));
v('el bloque empieza cerrado con el resumen', await pg.locator('#tc-pl').evaluate(d => !d.open) && /4 descargas · 5 vistas/.test(await pg.locator('#tc-pl summary').textContent()));
v('cerrado no se ve la lista', !(await pg.locator('#tc-pl .list').isVisible()));
await pg.locator('#tc-pl').scrollIntoViewIfNeeded(); await pg.evaluate(() => window.scrollBy(0, -260)); await pg.waitForTimeout(300);
await pg.screenshot({ path: OUT + '/plantillas-cerrado.png' });
await pg.locator('#tc-pl summary').click(); await pg.waitForTimeout(400);
v('al tocarlo se abre con la lista', await pg.locator('#tc-pl .list').isVisible() && (await pg.locator('#tc-pl .li').count()) === 8);
const t2 = await pg.locator('#tc-pl').textContent();
v('muestra descargas, vistas y la contraseña', /Descargas\s*4/.test(t2) && /Vieron las plantillas\s*5/.test(t2) && /100 de 100/.test(t2) && /1 pidió la contraseña/.test(t2), t2.slice(0, 500));
await pg.evaluate(() => document.querySelector('#tc-pl').scrollIntoView({ block: 'start' })); await pg.waitForTimeout(300);
await pg.screenshot({ path: OUT + '/plantillas-abierto.png' });
await pg.locator('#tc-d [data-d="7"]').click(); await pg.waitForTimeout(900);
v('al cambiar de período sigue abierto', await pg.locator('#tc-pl').evaluate(d => d.open));
await pg.locator('#tc-pl summary').click(); await pg.waitForTimeout(300);
v('se vuelve a cerrar', await pg.locator('#tc-pl').evaluate(d => !d.open));
v('sin errores de JavaScript en el Panel', !errores.length, errores);
await br.close(); web.close();
console.log(fallas ? `\n${fallas} FALLAS` : '\nTodo bien'); process.exit(fallas ? 1 : 0);
