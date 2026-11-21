// Prueba y capturas: bloque «Cómo nos encuentran en buscadores» del análisis de Tiendas Catrachas (Panel Molina)
// La tabla Buscadores la llena la función «buscadores» de Supabase (Search Console y Bing Webmaster); aquí se llena a mano.
// Uso: node buscadores.mjs <carpeta de capturas> <raíz del repo en main>
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
const dia = n => new Date(Date.now() - 6 * 3600000 - n * 86400000).toISOString().slice(0, 10); // día de Honduras
const fila = (f, m, q, imp, cl, pos) => ({ op: 'ins', t: 'Buscadores', k: { id: f + '|' + m + '|' + q }, row: { id: f + '|' + m + '|' + q, fecha: f, motor: m, consulta: q, impresiones: String(imp), clics: String(cl), posicion: pos ? String(pos) : '' } });
const borrar = async () => { db.T.Buscadores = []; };
await db.aplicar({ props: { PANEL_CLAVE: 'clave123' } });
const pt = (await api('panelLogin', { clave: 'clave123' })).data; const PT = pt && (pt.token || pt);
const pide = async dias => (await api('panelCatrachas', { dias }, PT, { panel: PT }));

// 1) Sin nada todavía
let r = await pide(30); let b = r.data && r.data.busc;
v('sin datos: el análisis sigue funcionando y el bloque viene vacío', r.ok && b && !b.cuando && b.consultas.length === 0 && b.motores.google.imp === 0, [r.error, b]);

// 2) Datos de ejemplo (dos buscadores)
await db.aplicar({ props: { BUSCADORES_ESTADO: JSON.stringify({ cuando: new Date().toISOString(), google: { ok: true, filas: 9 }, bing: { ok: true, filas: 6 } }) }, ops: [
  fila(dia(2), 'google', '', 60, 5, 12), fila(dia(3), 'google', '', 40, 3, 8), fila(dia(40), 'google', '', 500, 50, 3),
  fila(dia(2), 'google', 'molina soluciones digitales', 20, 4, 2), fila(dia(3), 'google', 'molina soluciones digitales', 21, 3, 2),
  fila(dia(2), 'google', 'programa de inventario para negocio', 30, 1, 14), fila(dia(3), 'google', 'programa de inventario para negocio', 23, 0, 14),
  fila(dia(40), 'google', 'búsqueda vieja', 400, 40, 3),
  fila(dia(4), 'bing', '', 318, 25, 0),
  fila(dia(4), 'bing', 'tiendas catrachas', 96, 19, 1), fila(dia(4), 'bing', 'tiendas en línea honduras', 158, 3, 9), fila(dia(4), 'bing', 'floristería san pedro sula', 64, 3, 11) ] });
r = await pide(30); b = r.data.busc;
v('totales por buscador en el período (lo viejo no entra)', b.motores.google.imp === 100 && b.motores.google.clics === 8 && b.motores.bing.imp === 318 && b.motores.bing.clics === 25, b.motores);
v('lugar promedio de Google: pesado por las veces que salió', b.motores.google.pos === Math.round((12 * 60 + 8 * 40) / 100 * 10) / 10, b.motores.google.pos);
v('lugar promedio de Bing: sale de sus búsquedas', b.motores.bing.pos === Math.round((1 * 96 + 9 * 158 + 11 * 64) / 318 * 10) / 10, b.motores.bing.pos);
v('junta cada búsqueda del período y ordena por clics', b.consultas.length === 5 && b.consultas[0].q === 'tiendas catrachas' && b.consultas[0].clics === 19 && b.consultas[1].q === 'molina soluciones digitales' && b.consultas[1].imp === 41 && b.consultas[1].clics === 7 && !b.consultas.some(q => q.q === 'búsqueda vieja'), b.consultas);
v('con 90 días entra también lo anterior', (await pide(90)).data.busc.motores.google.imp === 600);
v('sin clave del Panel no se ve', !(await api('panelCatrachas', { dias: 30 })).ok);

// 3) El Panel
const br = await chromium.launch({ channel: 'chrome' }); const ctx = await br.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage();
const errores = []; pg.on('pageerror', e => { errores.push(e.message); console.log('ERROR JS:', e.message); });
await pg.route(/^https?:\/\/(?!localhost).*/, async rt => { if (rt.request().url().indexOf('/functions/v1/api') < 0) return rt.abort(); const q = JSON.parse(rt.request().postData() || '{}'); const y = await api(q.action, q.data, q.token, { panel: q.panel }); rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(y) }); });
const abrir = async () => { await pg.goto('http://localhost:8786/?panel'); await pg.waitForTimeout(1500);
  const inp = pg.locator('input[type=password]').first(); if (await inp.count()) { await inp.fill('clave123'); await inp.press('Enter'); await pg.waitForTimeout(2500); }
  await pg.locator('#pn-tabs [data-k="mkt"]').click(); await pg.waitForTimeout(1000); await pg.locator('[data-a="panelCatrachas"]').click(); await pg.waitForTimeout(1500); };
const foto = async n => { await pg.locator('#tc-b').scrollIntoViewIfNeeded(); await pg.evaluate(() => document.querySelector('#tc-b').scrollIntoView({ block: 'start' })); await pg.waitForTimeout(400); await pg.screenshot({ path: OUT + '/' + n + '.png' }); await pg.locator('#tc-b').screenshot({ path: OUT + '/' + n + '-bloque.png' }); };
await abrir();
let txt = await pg.locator('#tc-b').textContent();
v('el Panel muestra el bloque con los totales de todos', /Cómo nos encuentran en buscadores/.test(txt) && /Veces que saliste\s*418/.test(txt) && /Clics\s*33/.test(txt) && /8 de 100/.test(txt), txt.slice(0, 300));
v('la lectura dice la búsqueda que más trae y la que sale mucho sin clics', /La búsqueda que más trae gente es «tiendas catrachas» \(19 clics\)/.test(txt) && /«tiendas en línea honduras» sale mucho \(158 veces\) pero casi nadie entra: está en el lugar 9\.º/.test(txt), txt.slice(0, 900));
v('la lista trae las búsquedas con su buscador', /tiendas catrachas\s*Bing/.test(txt) && /molina soluciones digitales\s*Google/.test(txt), txt.slice(300, 900));
await foto('buscadores-ejemplo');
await pg.locator('#tc-b [data-bm="google"]').click(); await pg.waitForTimeout(400); txt = await pg.locator('#tc-b').textContent();
v('al tocar Google quedan solo sus números', /Veces que saliste\s*100/.test(txt) && /Clics\s*8/.test(txt) && !/tiendas catrachas/.test(txt) && /Lugar promedio\s*10\.º/.test(txt), txt.slice(0, 400));
await pg.locator('#tc-b [data-bm="bing"]').click(); await pg.waitForTimeout(400); txt = await pg.locator('#tc-b').textContent();
v('al tocar Bing quedan solo los suyos', /Veces que saliste\s*318/.test(txt) && /tiendas catrachas/.test(txt) && !/molina soluciones digitales/.test(txt), txt.slice(0, 400));
await pg.locator('#tc-d [data-d="7"]').click(); await pg.waitForTimeout(900); txt = await pg.locator('#tc-b').textContent();
v('cambiar el período conserva el buscador elegido', /Veces que saliste\s*318/.test(txt) && (await pg.locator('#tc-b [data-bm="bing"].on').count()) === 1, txt.slice(0, 200));

// 4) Los datos reales del 2026-11-21 (Google recién empieza; Bing conectado y sin datos todavía)
await borrar();
await db.aplicar({ props: { BUSCADORES_ESTADO: JSON.stringify({ cuando: new Date().toISOString(), google: { ok: true, filas: 12 }, bing: { ok: true, filas: 0 } }) }, ops: [
  fila(dia(4), 'google', '', 1, 0, 8), fila(dia(2), 'google', '', 6, 0, 54.2), fila(dia(1), 'google', '', 7, 0, 68.6), fila(dia(0), 'google', '', 1, 0, 6),
  fila(dia(2), 'google', 'cierre de caja', 4, 0, 80.3), fila(dia(1), 'google', 'cierre de caja', 1, 0, 89), fila(dia(1), 'google', 'cierres de caja', 4, 0, 74), fila(dia(1), 'google', 'cómo cerrar caja', 1, 0, 86) ] });
await abrir(); txt = await pg.locator('#tc-b').textContent();
v('con pocos datos lo dice tal cual', /Veces que saliste\s*15/.test(txt) && /Clics\s*0/.test(txt) && /Bing todavía no tiene datos del sitio/.test(txt) && /Todavía son pocos datos/.test(txt) && /nadie tocó el resultado/.test(txt) && /suma menos que el total/.test(txt), txt.slice(0, 900));
await foto('buscadores-real');
// 5) Un buscador con error
await db.aplicar({ props: { BUSCADORES_ESTADO: JSON.stringify({ cuando: new Date().toISOString(), google: { ok: false, error: 'Search Console respondió 403: sin permiso' }, bing: { ok: true, filas: 0 } }) } });
await abrir(); txt = await pg.locator('#tc-b').textContent();
v('si un buscador falla, el bloque lo avisa', /No se pudo leer Google: Search Console respondió 403/.test(txt), txt.slice(0, 500));
// 6) En computadora
const c2 = await br.newContext({ viewport: { width: 1280, height: 900 } }); const p2 = await c2.newPage(); p2.on('pageerror', e => errores.push(e.message));
v('sin errores de JavaScript en el Panel', !errores.length, errores);
await br.close(); web.close();
console.log(fallas ? `== ${fallas} fallas ==` : '== Todo bien ==');
process.exit(fallas ? 1 : 0);
