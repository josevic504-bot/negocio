// Capturas 1.9.78: encargado por tienda, tienda en línea por tienda, funciones por tienda, reportes
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const RAIZ = process.argv[3], OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const SRC = fs.readFileSync(RAIZ + '/Codigo.gs', 'utf8');
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), log: () => {}, urlArchivo: r => 'http://localhost:8773/__f/' + r, rutaDeUrl: u => (u.split('/__f/')[1] || null) });
const api = (action, data, token, extra) => srv.atender(Object.assign({ action, token, data: data || {} }, extra || {}));
http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]);
  let f = path.join(RAIZ, u); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.webp') ? 'image/webp' : f.endsWith('.png') ? 'image/png' : 'application/octet-stream' }); r.end(d); }); }).listen(8773);
await db.aplicar({ props: { PANEL_CLAVE: 'clave-panel' } });
const PT = (await api('panelLogin', { clave: 'clave-panel' })).data.token;
const P = (a, d) => api(a, d, undefined, { panel: PT });
const T = (await api('registrar', { negocio: 'Todo en Uno HN', nombre: 'Carlos Mejía', giro: 'boutique', whatsapp: '99887766', pin: '1234' })).data.token;
const neg = (await api('bootstrap', {}, T)).data.negocioId;
await P('panelAccion', { id: neg, accion: 'activar', monto: 1000, metodo: 'Efectivo' });
await P('panelAccion', { id: neg, accion: 'plus', monto: 300, metodo: 'Efectivo' });
await P('panelAccion', { id: neg, accion: 'giros', giros: ['streaming', 'recargas'] });
for (const g of ['boutique', 'streaming', 'recargas']) await api('cargarEjemplos', { giro: g }, T);
await api('guardar', { entidad: 'Config', registro: { tienda: 'si', tiendaOff: 'streaming,recargas', tiendaAbre: '00:00', tiendaCierra: '23:59', tiendaDias: '0,1,2,3,4,5,6' } }, T);
const U = (nombre, wa, rol, tienda) => api('guardarUsuario', { registro: { nombre, usuario: wa, rol, tienda }, clave: '5555' }, T);
await U('Karla Ramos', '33221100', 'admin', 'boutique'); await U('Andrea Paz', '55667788', 'cajero', 'boutique');
await U('Luis Cárcamo', '98765432', 'admin', 'streaming'); await U('Marvin Díaz', '87654321', 'admin', 'recargas');
const TL = (await api('login', { whatsapp: '98765432', pin: '5555' })).data.token;
// algunas ventas en cada tienda
const b0 = (await api('bootstrap', {}, T)).data, pr = g => b0.productos.filter(p => (p.giro || 'boutique') === g && p.activo && p.precio > 0);
for (const [g, n] of [['boutique', 3], ['streaming', 2], ['recargas', 2]]) for (const p of pr(g).slice(0, n)) {
  const r = await api('venta', { items: [{ productoId: p.id, cantidad: 1, precio: p.precio, opcion: p.opciones ? undefined : undefined }], metodo: 'Efectivo', recibido: p.precio, tienda: g }, T); if (!r.ok) console.log('venta', g, r.error);
}
const br = await chromium.launch(); const errores = [];
async function pagina(tok) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage();
  pg.on('pageerror', e => { errores.push(e.message); console.log('ERROR JS:', e.message); });
  await pg.route(/^https?:\/\/(?!localhost).*/, async rt => { if (rt.request().url().indexOf('/functions/v1/api') < 0) return rt.abort(); const b = JSON.parse(rt.request().postData() || '{}'); const r = await api(b.action, b.data, b.token); rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r) }); });
  if (tok) await pg.addInitScript(t => { localStorage.setItem('gnvm@/|token', t); localStorage.setItem('gnvm@/|verVisto', '9.9.9'); localStorage.setItem('gnvm@/|tienda_' + '*', '*'); }, tok);
  return pg;
}
const shot = (pg, n) => pg.screenshot({ path: OUT + '/' + n + '.png' });
const vista = async (pg, v, extra) => { await pg.addStyleTag({ content: '#toasts{display:none!important}' }); await pg.evaluate(([v, e]) => { cerrarHojas(); if (e) Object.assign(S.f, e); ir(v); }, [v, extra || null]); await pg.waitForTimeout(1500); await pg.evaluate(() => { if (PILA.length) { cerrarHojas(); render(); } }); await pg.waitForTimeout(400); };
// ---------- dueño ----------
const app = await pagina(T); await app.goto('http://localhost:8773/'); await app.waitForTimeout(3000);
await app.evaluate(() => { cerrarHojas(); aplicarTienda(''); }); await app.waitForTimeout(800); await app.addStyleTag({ content: '#toasts{display:none!important}' }); await app.evaluate(() => cerrarHojas());
await vista(app, 'usuarios'); await shot(app, '01-usuarios-dueno');
await app.evaluate(() => formUsuario(null)); await app.waitForTimeout(600);
await app.evaluate(() => { const h = PILA[PILA.length - 1].el; h.querySelector('#uf-n').value = 'Luis Cárcamo'; h.querySelector('#uf-u').value = '9876-5432'; h.querySelector('#uf-r [data-r="admin"]').click(); h.querySelector('#uf-t [data-t="streaming"]').click(); const sb = h.querySelector('.sheet-b'); sb.scrollTop = h.querySelector('#uf-r').offsetTop - sb.offsetTop - 20; });
await app.waitForTimeout(400); await shot(app, '02-nuevo-encargado');
await vista(app, 'tienda'); await app.evaluate(() => { const s = document.getElementById('aj-giros'); window.scrollTo(0, s.getBoundingClientRect().top + scrollY - 70); }); await app.waitForTimeout(500); await shot(app, '03-tiendas-en-pagina');
await vista(app, 'ajustes', { ftT: 'streaming' }); await app.evaluate(() => { const s = document.getElementById('aj-modulos'); window.scrollTo(0, s.getBoundingClientRect().top + scrollY - 70); }); await app.waitForTimeout(500); await shot(app, '04-funciones-por-tienda');
await vista(app, 'reportes', { rtab: 'resumen', rgiro: '', rper: 'mes' }); await app.waitForTimeout(1500); await shot(app, '05-reporte-todo');
await vista(app, 'reportes', { rtab: 'secciones', rper: 'mes' }); await app.waitForTimeout(1500); await shot(app, '06-reporte-por-tienda');
await vista(app, 'reportes', { rtab: 'resumen', rgiro: 'streaming', rper: 'mes' }); await app.waitForTimeout(1500); await shot(app, '07-reporte-streaming');
// ---------- encargado de streaming ----------
const enc = await pagina(TL); await enc.goto('http://localhost:8773/'); await enc.waitForTimeout(3000); await enc.evaluate(() => cerrarHojas()); await enc.waitForTimeout(500);
await shot(enc, '08-encargado-inicio');
await vista(enc, 'usuarios'); await shot(enc, '09-encargado-usuarios');
await vista(enc, 'tienda'); await shot(enc, '10-encargado-tienda');
await vista(enc, 'reportes', { rper: 'mes' }); await enc.waitForTimeout(1200); await shot(enc, '11-encargado-reportes');
await vista(enc, 'ajustes'); await shot(enc, '12-encargado-ajustes');
await enc.evaluate(() => { cerrarHojas(); ACC.mas(); }); await enc.waitForTimeout(700); await shot(enc, '13-encargado-menu');
// ---------- tienda en línea ----------
const ti = await pagina(); await ti.goto('http://localhost:8773/?tienda=' + neg); await ti.waitForTimeout(3000); await shot(ti, '14-tienda-en-linea');
const info = await ti.evaluate(() => ({ giros: T.info.negocio.giros.map(g => g.id), n: T.info.productos.length }));
console.log('tienda:', JSON.stringify(info), '\nerrores JS:', errores.length);
await br.close(); process.exit(0);
