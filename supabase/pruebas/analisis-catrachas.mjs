// Prueba y capturas: análisis de Tiendas Catrachas en el Panel (visitas tc-…, clics a tiendas, búsquedas, solicitudes) y contador del sitio
// Uso: node analisis-catrachas.mjs <carpeta de capturas> <raíz del repo en main> <carpeta «publico» del sitio>
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const OUT = process.argv[2], RAIZ = process.argv[3], PUB = process.argv[4]; fs.mkdirSync(OUT, { recursive: true });
const SRC = fs.readFileSync(RAIZ + '/Codigo.gs', 'utf8');
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), log: () => {}, urlArchivo: r => 'http://localhost:8784/__f/' + r, rutaDeUrl: u => (u.split('/__f/')[1] || null) });
const api = async (action, data, token, extra) => srv.atender(Object.assign({ action, token, data: data || {} }, extra || {}));
const tipo = f => f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.css') ? 'text/css' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.webp') ? 'image/webp' : f.endsWith('.woff2') ? 'font/woff2' : f.endsWith('.png') ? 'image/png' : 'application/octet-stream';
const sirve = (raiz, puerto) => http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); let f = path.join(raiz, u); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': tipo(f) }); r.end(d); }); }).listen(puerto);
const web = sirve(RAIZ, 8784), web2 = sirve(PUB, 8785);
let fallas = 0; const v = (n, c, x) => { console.log((c ? '✔ ' : '✘ ') + n); if (!c) { fallas++; if (x !== undefined) console.log('   ', JSON.stringify(x).slice(0, 500)); } };
await db.aplicar({ props: { PANEL_CLAVE: 'clave123' } });
const reg = await api('registrar', { negocio: 'Flores del Valle', nombre: 'Ana Mejía', giro: 'floristeria', whatsapp: '33130280', pin: '1234' });
const neg = (await api('bootstrap', {}, reg.data.token)).data.negocioId, nid = neg.toLowerCase();
// 1) Servidor: visitas del sitio
let k = 0; const ev = async (p, o, d) => api('visita', { p, o: o || 'google', d: d || 'cel', v: 'persona' + String(1000 + (k++)) });
for (let i = 0; i < 20; i++) await ev('tc-inicio', i % 3 ? 'google' : 'facebook', i % 4 ? 'cel' : 'pc');
for (let i = 0; i < 12; i++) await ev('tc-dir', 'wa');
for (let i = 0; i < 9; i++) await ev('tc-t-' + nid);
for (let i = 0; i < 4; i++) await ev('tc-gc-floristeria-el-progreso');
for (let i = 0; i < 6; i++) await ev('tc-ir-' + nid);
for (let i = 0; i < 3; i++) await ev('tc-b-pasteles'); await ev('tc-b-ropa-de-nino');
for (let i = 0; i < 5; i++) await ev('tc-aparecer'); for (let i = 0; i < 3; i++) await ev('tc-negocio'); await ev('tc-prog-floristeria'); await ev('tc-guia-1');
await api('visita', { p: 'tc-inicio', o: 'google', d: 'cel', v: 'persona1000' }); // repetida del mismo navegador: no cuenta
await ev('negocio'); await ev('t-' + nid); // visitas normales y de la tienda: no entran al análisis
await api('solicitudDir', { negocio: 'Boutique Aurora', nombre: 'Andrea Lagos', whatsapp: '99887766', tipo: 'Boutiques', ciudad: 'La Ceiba', enlace: '@aurora' });
const pt = (await api('panelLogin', { clave: 'clave123' })).data; const PT = pt && (pt.token || pt);
let r = await api('panelCatrachas', { dias: 30 }); v('sin clave del Panel no se ve el análisis', !r.ok);
r = await api('panelCatrachas', { dias: 30 }, PT, { panel: PT }); const x = r.data || {};
v('cuenta las visitas a páginas (sin clics ni búsquedas)', r.ok && x.visitas === 55, [r.error, x.visitas]);
v('cuenta los clics a tiendas y quiénes entran', x.clics === 6 && x.personasClic === 6 && x.tasa === Math.round(6 * 100 / 55), [x.clics, x.personasClic, x.tasa]);
v('agrupa por parte del sitio', x.secciones && x.secciones[0].k === 'Inicio' && x.secciones[0].n === 20 && x.secciones.some(s => s.k === 'Fichas de tienda' && s.n === 9) && x.secciones.some(s => s.k === 'Tipo de negocio y ciudad' && s.n === 4), x.secciones);
v('la tienda sale con su nombre, vistas y clics', x.tiendas && x.tiendas.length === 1 && x.tiendas[0].negocio === 'Flores del Valle' && x.tiendas[0].vistas === 9 && x.tiendas[0].clics === 6, x.tiendas);
v('junta lo que buscaron', x.busquedas && x.busquedas[0].k === 'pasteles' && x.busquedas[0].n === 3 && x.busquedas[1].k === 'ropa de nino' && x.nBusquedas === 4, x.busquedas);
v('interés de los negocios y solicitudes', x.duenos && x.duenos.aparecer === 5 && x.duenos.negocio === 4 && x.duenos.guias === 1 && x.duenos.solicitudes === 1 && x.duenos.nuevas === 1, x.duenos);
const gen = (await api('panelVisitas', { dias: 7 }, PT, { panel: PT })).data;
v('las visitas generales del Panel no se mezclan con las del sitio', gen && gen.total === 1, gen && gen.total);
// 2) El Panel
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage();
const errores = []; pg.on('pageerror', e => { errores.push(e.message); console.log('ERROR JS:', e.message); });
await pg.route(/^https?:\/\/(?!localhost).*/, async rt => { if (rt.request().url().indexOf('/functions/v1/api') < 0) return rt.abort(); const b = JSON.parse(rt.request().postData() || '{}'); const y = await api(b.action, b.data, b.token, { panel: b.panel }); rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(y) }); });
await pg.goto('http://localhost:8784/?panel'); await pg.waitForTimeout(1500);
const inp = pg.locator('input[type=password]').first(); await inp.fill('clave123'); await inp.press('Enter'); await pg.waitForTimeout(2500);
await pg.locator('#pn-tabs [data-k="mkt"]').click(); await pg.waitForTimeout(1000);
await pg.locator('[data-a="panelCatrachas"]').click(); await pg.waitForTimeout(1500);
const txt = await pg.locator('#tc-c').textContent();
v('el Panel muestra los números', /Visitas\s*55/.test(txt) && /Flores del Valle/.test(txt) && /pasteles/.test(txt), txt.slice(0, 200));
v('la lectura explica el resultado', /De cada 100 personas, 11/.test(txt) && /Lo más buscado: «pasteles»/.test(txt) && /5 visitas a «Aparece aquí» y 1 solicitud/.test(txt), txt.slice(0, 600));
await pg.screenshot({ path: OUT + '/analisis-1.png' });
await pg.evaluate(() => { const h = [...document.querySelectorAll('#tc-c .pn-h')].find(e => /Tiendas más vistas/.test(e.textContent)); if (h) h.scrollIntoView({ block: 'start' }); }); await pg.waitForTimeout(400); await pg.screenshot({ path: OUT + '/analisis-2.png' });
await pg.locator('#tc-d [data-d="7"]').click(); await pg.waitForTimeout(900); v('cambiar a 7 días vuelve a calcular', /Visitas\s*55/.test(await pg.locator('#tc-c').textContent()));
v('sin errores de JavaScript en el Panel', !errores.length, errores);
// 3) El sitio: su contador manda lo que debe
const c2 = await br.newContext({ viewport: { width: 390, height: 844 } }); const p = await c2.newPage(); const e2 = []; p.on('pageerror', e => e2.push(e.message));
const mandados = []; await p.addInitScript(() => { window.__tcPrueba = 1; });
await p.route(/^https?:\/\/(?!localhost).*/, rt => { if (/functions\/v1\/api/.test(rt.request().url())) { try { mandados.push(JSON.parse(rt.request().postData() || '{}')); } catch (e) {} return rt.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"data":true}' }); } return rt.abort(); });
const ps = () => mandados.filter(m => m.action === 'visita').map(m => m.data.p);
await p.goto('http://localhost:8785/?src=facebook'); await p.waitForTimeout(500);
v('el inicio se cuenta con el origen del enlace', ps().includes('tc-inicio') && mandados[0].data.o === 'facebook' && mandados[0].data.d === 'pc' && mandados[0].data.v.length >= 8, mandados[0]);
await p.goto('http://localhost:8785/'); await p.waitForTimeout(400); v('la misma página no se cuenta dos veces seguidas', ps().filter(x => x === 'tc-inicio').length === 1);
await p.goto('http://localhost:8785/tiendas/'); await p.waitForTimeout(300); await p.fill('#buscar', 'Ropa de niño'); await p.waitForTimeout(3000);
v('el directorio y la búsqueda se cuentan', ps().includes('tc-dir') && ps().includes('tc-b-ropa-de-nino'), ps());
v('el origen se mantiene al navegar', mandados[mandados.length - 1].data.o === 'facebook');
await p.goto('http://localhost:8785/tiendas/floristerias/el-progreso/'); await p.waitForTimeout(300); await p.goto('http://localhost:8785/tiendas/flores-del-valle/'); await p.waitForTimeout(300);
v('la página por giro y ciudad y la ficha se cuentan', ps().includes('tc-gc-floristeria-el-progreso') && ps().includes('tc-t-flor01'), ps());
await p.evaluate(() => { document.querySelector('.acciones [data-ir]').addEventListener('click', e => e.preventDefault()); document.querySelector('.acciones [data-ir]').click(); }); await p.waitForTimeout(400);
v('tocar «Entrar a la tienda» se cuenta como clic', ps().includes('tc-ir-flor01'), ps());
await p.goto('http://localhost:8785/aparecer/?yo=1'); await p.waitForTimeout(400); v('con ?yo=1 ese navegador deja de contarse', !ps().includes('tc-aparecer'), ps());
await p.goto('http://localhost:8785/guias/?yo=0'); await p.waitForTimeout(400); v('con ?yo=0 vuelve a contarse', ps().includes('tc-guia'), ps());
v('sin errores de JavaScript en el sitio', !e2.length, e2);
await br.close(); web.close(); web2.close(); console.log(fallas ? fallas + ' FALLAS' : 'TODO BIEN'); process.exit(fallas ? 1 : 0);
