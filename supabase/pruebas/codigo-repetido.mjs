// Prueba 1.9.72: códigos de producto repetidos (ejemplos de varios giros, editar, copiar productos) y papelera visible
// node codigo-repetido.mjs <carpeta-salida> <raíz del repo con Codigo.gs e index.html>
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const req = createRequire(import.meta.url); let pw; try { pw = req('playwright'); } catch (e) { pw = req(process.env.PLAYWRIGHT_PATH || 'playwright'); }
const { chromium } = pw;
const OUT = process.argv[2], RAIZ = process.argv[3];
const SRC = fs.readFileSync(RAIZ + '/Codigo.gs', 'utf8');
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), log: () => {}, urlArchivo: r => 'https://x/' + r, rutaDeUrl: () => null });
const api = (action, data, token, extra) => srv.atender(Object.assign({ action, token, data: data || {} }, extra || {}));
let fallas = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fallas++; };
await db.aplicar({ props: { PANEL_CLAVE: 'clave123' } });

// 1) Ejemplos de dos giros en el mismo negocio: los códigos no se repiten
const tok = (await api('registrar', { negocio: 'Variedades Sofía', nombre: 'Sofía', giro: 'variedades', whatsapp: '33445566', pin: '1234' })).data.token;
const neg = (await api('bootstrap', {}, tok)).data.negocioId;
await db.aplicar({ ops: [{ t: 'Licencias', op: 'upd', k: { id: neg }, row: { plus: 'si', estado: 'Activa', giros: 'comida' } }] });
await api('cargarEjemplos', {}, tok);
const e2 = await api('cargarEjemplos', { giro: 'comida' }, tok);
ok(e2.ok, 'ejemplos del segundo giro (comida) cargados' + (e2.ok ? '' : ' · ' + e2.error));
let prods = (await api('bootstrap', {}, tok)).data.productos;
const cods = prods.map(p => p.codigo).filter(Boolean), unicos = new Set(cods.map(c => c.toLowerCase()));
ok(cods.length === unicos.size, prods.length + ' productos de ejemplo, ' + unicos.size + ' códigos distintos (sin repetir)');
ok(cods.every(c => /^EJ\d/.test(c)), 'todos siguen con código EJ (el Panel los cuenta como ejemplo)');

// 2) Negocio que ya quedó con códigos repetidos (como el de la captura): se puede editar
const cam = prods.find(p => p.opciones && /Talla/.test(p.opciones)), otro = prods.find(p => p.giro === 'comida');
await db.aplicar({ ops: [{ t: 'Productos', op: 'upd', k: { id: otro.id }, n: neg, row: { codigo: cam.codigo } }] });
prods = (await api('bootstrap', {}, tok)).data.productos;
ok(prods.filter(p => p.codigo === cam.codigo).length === 2, 'simulado: «' + cam.nombre + '» y «' + otro.nombre + '» comparten el código ' + cam.codigo);
const g1 = await api('guardar', { entidad: 'Productos', registro: { id: cam.id, nombre: cam.nombre, codigo: cam.codigo, precio: 280 } }, tok);
ok(g1.ok, 'editar sin tocar el código: se guarda' + (g1.ok ? '' : ' · ' + g1.error));
const g2 = await api('guardar', { entidad: 'Productos', registro: { id: cam.id, nombre: cam.nombre, codigo: prods.find(p => p.id !== cam.id && p.id !== otro.id && p.codigo).codigo } }, tok);
ok(!g2.ok && /ya es de «/.test(g2.error), 'cambiar a un código de otro producto: ' + g2.error);
const g3 = await api('guardar', { entidad: 'Productos', registro: { nombre: 'Producto nuevo', categoria: 'Ropa', precio: 50, codigo: cam.codigo } }, tok);
ok(!g3.ok && /ya es de «/.test(g3.error), 'producto nuevo con código usado: ' + g3.error);
const g4 = await api('guardar', { entidad: 'Productos', registro: { nombre: 'Producto nuevo', categoria: 'Ropa', precio: 50, codigo: 'ABC-123' } }, tok);
ok(g4.ok, 'producto nuevo con código libre: se guarda');

// 3) Copiar productos desde el Panel a un negocio que ya tiene ejemplos: no repite códigos
const t2 = (await api('registrar', { negocio: 'Tienda Luis', nombre: 'Luis', giro: 'variedades', whatsapp: '99887766', pin: '1234' })).data.token;
const n2 = (await api('bootstrap', {}, t2)).data.negocioId;
await api('cargarEjemplos', {}, t2);
const pt = (await api('panelLogin', { clave: 'clave123' })).data.token;
const cp = await srv.atender({ action: 'panelCopiarProductos', panel: pt, data: { de: neg, a: n2, cats: null, fotos: false } });
ok(cp.ok && cp.data.copiados > 0, 'copiar productos: ' + (cp.ok ? cp.data.copiados + ' copiados, ' + cp.data.omitidos + ' omitidos' : cp.error));
const p2 = db.T.Productos.filter(p => p.negocio_id === n2), c2 = p2.map(p => p.codigo).filter(Boolean);
ok(c2.length === new Set(c2.map(c => c.toLowerCase())).size, 'destino: ' + p2.length + ' productos sin códigos repetidos');
ok(p2.find(p => p.codigo === 'ABC-123'), 'el código propio (ABC-123) se copió tal cual');

// 4) En la app: editar el producto de la captura y guardar; papelera visible
const web = http.createServer((q, r) => { let f = path.join(RAIZ, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.png') ? 'image/png' : f.endsWith('.webp') ? 'image/webp' : 'application/octet-stream' }); r.end(d); }); }).listen(8771);
const br = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const pg = await ctx.newPage(); const errores = [];
pg.on('pageerror', e => errores.push(e.message));
await pg.route(/^https?:\/\/(?!localhost).*/, async rt => {
  const u = rt.request().url(); if (u.indexOf('/functions/v1/api') < 0) return rt.abort();
  const b = JSON.parse(rt.request().postData() || '{}'); const r = await api(b.action, b.data, b.token, { panel: b.panel });
  rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r) });
});
await api('limpiezaOmitir', {}, tok); // desde 1.9.73 un negocio recién activado ve el aviso de limpiar la prueba
await pg.addInitScript(t => { localStorage.setItem('gnvm@/|token', t); localStorage.setItem('gnvm@/|verVisto', '1.9.71'); }, tok);
await pg.goto('http://localhost:8771/'); await pg.waitForTimeout(3000);
console.log('  hojas abiertas al entrar:', JSON.stringify(await pg.evaluate(() => [...document.querySelectorAll('.sheet h2, .sheet h3')].map(x => x.textContent.trim()).filter(Boolean))));
await pg.screenshot({ path: OUT + '/cr-entrar.png' });
for (let i = 0; i < 10 && !(await pg.locator('.sheet.nov').count()); i++) { await pg.evaluate(() => { const b = [...document.querySelectorAll('.sheet-f .btn, .sheet [data-cerrar]')].pop(); if (b && !document.querySelector('.sheet.nov')) b.click(); }); await pg.waitForTimeout(1600); }
const nov = await pg.locator('.sheet', { hasText: 'código repetido' }).count();
ok(nov > 0, 'aviso de novedades 1.9.72 aparece al actualizar');
if (nov) { await pg.screenshot({ path: OUT + '/cr0-novedades.png' }); await pg.locator('.sheet [data-cerrar]').first().click().catch(() => {}); await pg.keyboard.press('Escape'); await pg.waitForTimeout(500); }
await pg.evaluate(id => { ir('productos'); formProducto(S.productos.find(p => p.id === id)); }, cam.id); await pg.waitForTimeout(900);
const var1 = pg.locator('#pf-var'); if (await var1.count() && !(await var1.isChecked())) { await pg.locator('#pf-varbox .sw-row').click(); await pg.waitForTimeout(400); }
const ins = pg.locator('#pf-vg [data-c="s"]'); const n = await ins.count(); for (let i = 0; i < n; i++) await ins.nth(i).fill(String([2, 2, 2, 6, 6, 5][i % 6]));
await pg.locator('#pf-vg').scrollIntoViewIfNeeded(); await pg.waitForTimeout(300);
const colorPapelera = await pg.evaluate(() => { const b = document.querySelector('.sheet-f .btn.bad'); return b ? getComputedStyle(b).color + ' sobre ' + getComputedStyle(b).backgroundColor : 'no hay botón'; });
ok(/255, 255, 255/.test(colorPapelera), 'papelera: ' + colorPapelera);
await pg.screenshot({ path: OUT + '/cr1-editar.png' });
await pg.locator('.sheet-f .pri').click(); await pg.waitForTimeout(1000);
const toast1 = await pg.evaluate(() => [...document.querySelectorAll('.toast, #toast, .toasts *')].map(x => x.textContent.trim()).filter(Boolean).join(' | '));
await pg.screenshot({ path: OUT + '/cr2-guardado.png' });
const pg1 = (await api('bootstrap', {}, tok)).data.productos.find(p => p.id === cam.id);
ok(/Cambios guardados/.test(toast1) && pg1.variantes, 'Guardar cambios en la app: «' + toast1 + '» · existencia total ' + pg1.stock);
// Cambiar el código a uno de otro producto: el aviso dice de cuál
const otroCod = prods.find(p => p.id !== cam.id && p.id !== otro.id && p.codigo);
await pg.evaluate(id => formProducto(S.productos.find(p => p.id === id)), cam.id); await pg.waitForTimeout(800);
await pg.locator('#pf-cod').fill(otroCod.codigo); await pg.locator('.sheet-f .pri').click(); await pg.waitForTimeout(600);
await pg.screenshot({ path: OUT + '/cr3-aviso.png' });
const toast2 = await pg.evaluate(() => [...document.querySelectorAll('.toast, #toast, .toasts *')].map(x => x.textContent.trim()).filter(Boolean).join(' | '));
ok(toast2.indexOf(otroCod.nombre) >= 0, 'aviso en la app: «' + toast2 + '»');
ok(!errores.length, 'sin errores de JavaScript' + (errores.length ? ': ' + errores.join(' · ') : ''));
await br.close(); web.close();
console.log(fallas ? '✗ ' + fallas + ' fallas' : '✓ todo bien'); process.exit(fallas ? 1 : 0);
