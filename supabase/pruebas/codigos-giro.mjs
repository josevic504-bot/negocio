// Prueba 1.9.74: códigos automáticos con prefijo por giro
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

// 1) Farmacia
const tok = (await api('registrar', { negocio: 'Farmacia San Rafael', nombre: 'Rafael', giro: 'farmacia', whatsapp: '33112233', pin: '1234' })).data.token;
const neg = (await api('bootstrap', {}, tok)).data.negocioId;
await db.aplicar({ ops: [{ t: 'Licencias', op: 'upd', k: { id: neg }, row: { plus: 'si', estado: 'Activa' } }] });
await api('cargarEjemplos', {}, tok);
const a = await api('guardar', { entidad: 'Productos', registro: { nombre: 'Ibuprofeno 400 mg (10)', categoria: 'Medicamentos', precio: 45 } }, tok);
ok(a.ok && a.data.codigo === 'FAR-0001', 'farmacia, sin código → ' + (a.ok ? a.data.codigo : a.error));
const b = await api('guardar', { entidad: 'Productos', registro: { nombre: 'Loratadina 10 mg (10)', categoria: 'Medicamentos', precio: 60 } }, tok);
ok(b.ok && b.data.codigo === 'FAR-0002', 'segundo producto → ' + (b.ok ? b.data.codigo : b.error));
const c = await api('guardar', { entidad: 'Productos', registro: { nombre: 'Suero oral', categoria: 'Medicamentos', precio: 30, codigo: '7421000123456' } }, tok);
ok(c.ok && c.data.codigo === '7421000123456', 'con código de barras escaneado → se respeta ' + (c.ok ? c.data.codigo : c.error));
const e = await api('guardar', { entidad: 'Productos', registro: { id: a.data.id, nombre: 'Ibuprofeno 400 mg (10)', codigo: 'FAR-0001', precio: 48 } }, tok);
ok(e.ok && e.data.codigo === 'FAR-0001', 'editar no cambia el código');
const sinC = (await api('bootstrap', {}, tok)).data.productos.find(p => /^EJ/.test(p.codigo));
ok(!!sinC, 'los productos de ejemplo siguen con EJ (' + (sinC && sinC.codigo) + ')');
// compra con producto nuevo
const prov = await api('guardar', { entidad: 'Proveedores', registro: { nombre: 'Droguería Central' } }, tok);
const co = await api('compra', { proveedorId: prov.ok ? prov.data.id : '', items: [{ nuevo: { nombre: 'Alcohol 70% 250 ml', categoria: 'Primeros auxilios' }, cantidad: 6, costo: 25, precio: 45 }], pago: 'efectivo' }, tok);
const pa = (await api('bootstrap', {}, tok)).data.productos.find(p => p.nombre === 'Alcohol 70% 250 ml');
ok(pa && pa.codigo === 'FAR-0003', 'compra con producto nuevo → ' + (pa ? pa.codigo : (co.error || 'no creado')));

// 2) Varios giros: variedades + streaming
const t2 = (await api('registrar', { negocio: 'Todo en Uno HN', nombre: 'Karla', giro: 'variedades', whatsapp: '99001122', pin: '1234' })).data.token;
const n2 = (await api('bootstrap', {}, t2)).data.negocioId;
await db.aplicar({ ops: [{ t: 'Licencias', op: 'upd', k: { id: n2 }, row: { plus: 'si', estado: 'Activa', giros: 'streaming,recargas' } }] });
const v1 = await api('guardar', { entidad: 'Productos', registro: { nombre: 'Termo 1 L', categoria: 'Hogar', precio: 320 } }, t2);
const s1 = await api('guardar', { entidad: 'Productos', registro: { nombre: 'Netflix 1 perfil', categoria: 'Video', precio: 120, giro: 'streaming', tipo: 'servicio' } }, t2);
const r1 = await api('guardar', { entidad: 'Productos', registro: { nombre: '100 diamantes', categoria: 'Free Fire', precio: 25, giro: 'recargas', tipo: 'servicio' } }, t2);
const s2 = await api('guardar', { entidad: 'Productos', registro: { nombre: 'Disney+ 1 perfil', categoria: 'Video', precio: 110, giro: 'streaming', tipo: 'servicio' } }, t2);
ok(v1.data && v1.data.codigo === 'VAR-0001', 'sección variedades → ' + (v1.data ? v1.data.codigo : v1.error));
ok(s1.data && s1.data.codigo === 'STR-0001', 'sección streaming → ' + (s1.data ? s1.data.codigo : s1.error));
ok(r1.data && r1.data.codigo === 'REC-0001', 'sección recargas → ' + (r1.data ? r1.data.codigo : r1.error));
ok(s2.data && s2.data.codigo === 'STR-0002', 'cada sección lleva su propio número → ' + (s2.data ? s2.data.codigo : s2.error));

// 3) Carga desde Excel en el Panel
const pt = (await api('panelLogin', { clave: 'clave123' })).data.token;
const im = await srv.atender({ action: 'panelImportar', panel: pt, data: { negocio: neg, filas: [{ _fila: 2, nombre: 'Omeprazol 20 mg (14)', categoria: 'Medicamentos', precio: 85 }, { _fila: 3, nombre: 'Gasas estériles', categoria: 'Primeros auxilios', precio: 40, codigo: 'G-55' }] } });
const pi = (await api('bootstrap', {}, tok)).data.productos;
const om = pi.find(p => p.nombre === 'Omeprazol 20 mg (14)'), ga = pi.find(p => p.nombre === 'Gasas estériles');
ok(im.ok && om && om.codigo === 'FAR-0004' && ga && ga.codigo === 'G-55', 'carga desde Excel: ' + (om ? om.codigo : im.error) + ' y el código propio ' + (ga && ga.codigo));

// 4) Capturas
await api('limpiezaOmitir', {}, tok);
const web = http.createServer((q, r) => { let f = path.join(RAIZ, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (er, d) => { if (er) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.png') ? 'image/png' : f.endsWith('.webp') ? 'image/webp' : 'application/octet-stream' }); r.end(d); }); }).listen(8772);
const br = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const shot = async (token, fn, nombre) => {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage(); const errores = []; pg.on('pageerror', x => errores.push(x.message));
  await pg.route(/^https?:\/\/(?!localhost).*/, async rt => { if (rt.request().url().indexOf('/functions/v1/api') < 0) return rt.abort(); const bd = JSON.parse(rt.request().postData() || '{}'); const rr = await api(bd.action, bd.data, bd.token); rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(rr) }); });
  await pg.addInitScript(t => { localStorage.setItem('gnvm@/|token', t); localStorage.setItem('gnvm@/|verVisto', '9.9.9'); }, token);
  await pg.goto('http://localhost:8772/'); await pg.waitForTimeout(3000);
  await fn(pg); await pg.screenshot({ path: OUT + '/' + nombre });
  ok(!errores.length, nombre + ': sin errores en consola' + (errores.length ? ' · ' + errores.join(' | ') : '')); await ctx.close();
};
await shot(tok, async pg => { await pg.evaluate(() => { ir('productos'); S.f.pcat = ''; formProducto(null); }); await pg.waitForTimeout(800); await pg.fill('#pf-nom', 'Paracetamol 500 mg (10)'); await pg.locator('.pick [data-pv="Medicamentos"]').first().click().catch(() => {}); await pg.waitForTimeout(300); await pg.locator('#pf-cod').scrollIntoViewIfNeeded(); await pg.waitForTimeout(300); }, 'c1-form-farmacia.png');
await shot(tok, async pg => { await pg.evaluate(() => { ir('productos'); }); await pg.waitForTimeout(800); const q = pg.locator('input[placeholder*="Buscar"]').first(); await q.fill('FAR'); await pg.waitForTimeout(800); await q.scrollIntoViewIfNeeded(); }, 'c2-lista-farmacia.png');
await shot(t2, async pg => { await pg.evaluate(() => { ir('productos'); S.f.pcat = ''; formProducto(null); }); await pg.waitForTimeout(800); await pg.fill('#pf-nom', 'HBO Max 1 perfil'); await pg.locator('#pf-giro [data-g="streaming"]').click(); await pg.waitForTimeout(300); await pg.locator('#pf-cod').scrollIntoViewIfNeeded(); await pg.evaluate(() => document.querySelector('#pf-giro').scrollIntoView({ block: 'center' })); await pg.waitForTimeout(300); }, 'c3-form-varios-giros.png');
await br.close(); web.close();
console.log(fallas ? fallas + ' fallas' : 'todo bien');
