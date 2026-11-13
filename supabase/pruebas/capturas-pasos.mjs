// Prueba y capturas 1.9.82: Primeros pasos (lista en Inicio que se marca sola) + ficha del Panel
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const RAIZ = process.argv[3], OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const SRC = fs.readFileSync(RAIZ + '/Codigo.gs', 'utf8');
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), log: () => {}, urlArchivo: r => 'http://localhost:8781/__f/' + r, rutaDeUrl: u => (u.split('/__f/')[1] || null) });
const api = async (action, data, token, extra) => { const r = await srv.atender(Object.assign({ action, token, data: data || {} }, extra || {})); if (!r.ok) console.log('API', action, r.error); return r; };
const web = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); let f = path.join(RAIZ, u); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.webp') ? 'image/webp' : f.endsWith('.png') ? 'image/png' : 'application/octet-stream' }); r.end(d); }); }).listen(8781);
let fallas = 0; const v = (n, c, x) => { console.log((c ? '✔ ' : '✘ ') + n); if (!c) { fallas++; if (x !== undefined) console.log('   ', JSON.stringify(x).slice(0, 400)); } };
await db.aplicar({ props: { PANEL_CLAVE: 'clave123' } });

// 1) Servidor: negocio nuevo en prueba
const tok = (await api('registrar', { negocio: 'Variedades Karla', nombre: 'Karla Hernández', giro: 'variedades', whatsapp: '33130265', pin: '1234' })).data.token;
const neg = (await api('bootstrap', {}, tok)).data.negocioId;
let p = (await api('inicio', {}, tok)).data.pasos;
v('recién registrado trae pasos', !!p, p);
v('ningún paso hecho al empezar', p && Object.values(p).every(x => !x), p);
const ej = await api('cargarEjemplos', { giro: 'variedades' }, tok); p = (await api('inicio', {}, tok)).data.pasos;
v('los productos de ejemplo no cuentan como propios', ej.ok && ej.data.agregados > 0 && !p.producto, ej.data);
const pr = (await api('guardar', { entidad: 'Productos', registro: { nombre: 'Blusa de lino', categoria: 'Ropa', precio: 450, costo: 250, stock: 8, tipo: 'producto', activo: true, tienda: true } }, tok)).data;
const cl = (await api('guardar', { entidad: 'Clientes', registro: { nombre: 'Doña Marta', telefono: '99887766' } }, tok)).data;
await api('venta', { items: [{ productoId: pr.id, cantidad: 1, precio: 450 }], metodo: 'Efectivo', recibido: 450, clave: 'p1' }, tok);
p = (await api('inicio', {}, tok)).data.pasos;
v('producto propio, venta y cliente se marcan solos', p.producto && p.venta && p.cliente, p);
v('lo demás sigue pendiente', !p.negocio && !p.compartir && !p.pedido && !p.caja && !p.cuenta, p);
// Un pedido anotado en el negocio (WhatsApp) no cuenta como pedido en línea
db.T.Pedidos = db.T.Pedidos || [];
const pv = (await api('pasoMarca', { k: 'otro' }, tok)); v('pasoMarca rechaza pasos no válidos', !pv.ok, pv);
// 2) Panel: la ficha trae los pasos
const pt = (await api('panelLogin', { clave: 'clave123' })).data; const PT = pt && (pt.token || pt);
const fi = (await api('panelNegocio', { id: neg }, PT, { panel: PT })).data;
v('la ficha del Panel trae los pasos', fi && fi.pasos && fi.pasos.venta && !fi.pasos.caja, fi && fi.pasos);
// 3) Negocio con licencia activa: no ve la lista
const tok2 = (await api('registrar', { negocio: 'Ferretería El Clavo', nombre: 'Luis Mejía', giro: 'ferreteria', whatsapp: '33130266', pin: '1234' })).data.token;
const neg2 = (await api('bootstrap', {}, tok2)).data.negocioId;
await db.aplicar({ ops: [{ t: 'Licencias', op: 'upd', k: { id: neg2 }, row: { estado: 'Activa' } }] });
v('con licencia activa el servidor no manda pasos', !(await api('inicio', {}, tok2)).data.pasos);

// 4) La app
const br = await chromium.launch();
const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const app = await ctx.newPage();
const errores = []; app.on('pageerror', e => { errores.push(e.message); console.log('ERROR JS:', e.message); });
await app.route(/^https?:\/\/(?!localhost).*/, async rt => { if (rt.request().url().indexOf('/functions/v1/api') < 0) return rt.abort(); const b = JSON.parse(rt.request().postData() || '{}'); const r = await api(b.action, b.data, b.token, { panel: b.panel }); rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r) }); });
await app.addInitScript(t => { localStorage.setItem('gnvm@/|token', t); localStorage.setItem('gnvm@/|verVisto', '9.9.9'); localStorage.setItem('gnvm@/|avisosOferta', 'no'); }, tok);
await app.goto('http://localhost:8781/'); await app.waitForTimeout(3000); await app.evaluate(() => cerrarHojas()); await app.waitForTimeout(300);
const shot = async n => { await app.waitForTimeout(500); await app.screenshot({ path: OUT + '/' + n + '.png' }); };
// Bienvenida al registrarse
await app.evaluate(() => guiaIniciar()); await shot('1-bienvenida'); await app.evaluate(() => cerrarHojas());
// Inicio con 3 de 8
await app.evaluate(() => { S.inicio = null; ir('inicio'); }); await app.waitForTimeout(1500);
v('la tarjeta sale en Inicio', await app.locator('#pp-card').count() === 1);
v('dice 3 de 8', /3 de 8/.test(await app.locator('#pp-card .pp-n').textContent()));
await app.evaluate(() => document.querySelector('#pp-card').scrollIntoView({ block: 'start' })); await app.evaluate(() => scrollBy(0, -70)); await shot('2-inicio-3-de-8');
// Tocar «Cierra tu primera caja»: su explicación con imagen
await app.locator('[data-a="pasoIr"][data-k="caja"]').click(); await shot('3-paso-caja'); await app.evaluate(() => cerrarHojas());
// «¿Cómo me fue hoy?» se marca al abrirlo; compartir la tienda al copiar el enlace
await app.evaluate(() => ACC.cuenta()); await app.waitForTimeout(900); await app.evaluate(() => cerrarHojas());
await app.evaluate(() => { try { navigator.clipboard.writeText = async () => {}; } catch (e) {} ACC.copiarTienda(); }); await app.waitForTimeout(600);
p = (await api('inicio', {}, tok)).data.pasos;
v('«¿Cómo me fue hoy?» y compartir quedan anotados en el servidor', p.cuenta && p.compartir, p);
// Pedido desde la tienda en línea + cierre de caja + logo
const ped = await api('pedir', { negocio: neg, nombre: 'Ana Paz', telefono: '9911-0002', entrega: 'recoger', pago: 'Efectivo', items: [{ id: pr.id, cantidad: 1 }] });
v('pedido de prueba desde la tienda', ped.ok, ped);
p = (await api('inicio', {}, tok)).data.pasos; v('el pedido en línea se marca solo', p.pedido, p);
await app.evaluate(() => { S.inicio = null; ir('inicio'); }); await app.waitForTimeout(1500);
v('dice 6 de 8', /6 de 8/.test(await app.locator('#pp-card .pp-n').textContent()));
await app.evaluate(() => document.querySelector('#pp-card').scrollIntoView({ block: 'start' })); await app.evaluate(() => scrollBy(0, -70)); await shot('4-inicio-6-de-8');
const cj = (await api('caja', {}, tok)).data;
await api('cerrarCaja', { contado: cj && cj.esperado !== undefined ? cj.esperado : 450, nota: '' }, tok);
await api('guardar', { entidad: 'Config', registro: { logo: 'data:image/png;base64,iVBORw0KGgo=' } }, tok);
p = (await api('inicio', {}, tok)).data.pasos; v('cierre de caja y logo se marcan solos', p.caja && p.negocio, p);
await app.evaluate(() => { S.inicio = null; ir('inicio'); }); await app.waitForTimeout(1500);
v('completo: sale la felicitación', /Listo/.test(await app.locator('#pp-card').textContent()));
await app.evaluate(() => document.querySelector('#pp-card').scrollIntoView({ block: 'start' })); await app.evaluate(() => scrollBy(0, -70)); await shot('5-completo');
await app.locator('[data-a="pasosFin"]').click(); await app.waitForTimeout(300);
await app.evaluate(() => { ir('ventas'); ir('inicio'); }); await app.waitForTimeout(900);
v('al cerrar la felicitación ya no vuelve', await app.locator('#pp-card').count() === 0);
// Ocultar por ahora (otro negocio en prueba)
const tok3 = (await api('registrar', { negocio: 'Comedor Doña Tere', nombre: 'Teresa Rivera', giro: 'comida', whatsapp: '33130267', pin: '1234' })).data.token;
const app3 = await ctx.newPage(); app3.on('pageerror', e => { errores.push(e.message); console.log('ERROR JS:', e.message); });
await app3.route(/^https?:\/\/(?!localhost).*/, async rt => { if (rt.request().url().indexOf('/functions/v1/api') < 0) return rt.abort(); const b = JSON.parse(rt.request().postData() || '{}'); const r = await api(b.action, b.data, b.token, { panel: b.panel }); rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r) }); });
await app3.addInitScript(t => { localStorage.setItem('gnvm@/|token', t); localStorage.setItem('gnvm@/|verVisto', '9.9.9'); localStorage.setItem('gnvm@/|avisosOferta', 'no'); }, tok3);
await app3.goto('http://localhost:8781/'); await app3.waitForTimeout(3000); await app3.evaluate(() => cerrarHojas()); await app3.waitForTimeout(300);
v('restaurante: el paso de venta es «Cobra tu primera mesa»', /Cobra tu primera mesa/.test(await app3.locator('#pp-card').textContent()));
v('restaurante: «Crea tu primer plato»', /Crea tu primer plato/.test(await app3.locator('#pp-card').textContent()));
await app3.evaluate(() => document.querySelector('#pp-card').scrollIntoView({ block: 'start' })); await app3.evaluate(() => scrollBy(0, -70)); await app3.waitForTimeout(400); await app3.screenshot({ path: OUT + '/6-restaurante.png' });
await app3.locator('[data-a="pasosOcultar"]').click(); await app3.waitForTimeout(300);
v('«Ocultar por ahora» la quita', await app3.locator('#pp-card').count() === 0);
// Panel Molina: ficha con los pasos
const pg = await ctx.newPage(); pg.on('pageerror', e => { errores.push(e.message); console.log('ERROR JS:', e.message); });
await pg.route(/^https?:\/\/(?!localhost).*/, async rt => { if (rt.request().url().indexOf('/functions/v1/api') < 0) return rt.abort(); const b = JSON.parse(rt.request().postData() || '{}'); const r = await api(b.action, b.data, b.token, { panel: b.panel }); rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r) }); });
await pg.goto('http://localhost:8781/?panel'); await pg.waitForTimeout(1500);
const inp = pg.locator('input[type=password]').first(); await inp.fill('clave123'); await inp.press('Enter'); await pg.waitForTimeout(2500);
const neg3 = (await api('bootstrap', {}, tok3)).data.negocioId;
await api('guardar', { entidad: 'Productos', registro: { nombre: 'Pollo frito', categoria: 'Platos', precio: 120, costo: 60, stock: 0, tipo: 'servicio', activo: true, tienda: true } }, tok3);
await pg.evaluate(id => panelFicha(id), neg3); await pg.waitForTimeout(1800);
v('la ficha del Panel muestra los pasos', /Primeros pasos/.test(await pg.locator('.pp-p').textContent()));
await pg.evaluate(() => { const e = document.querySelector('.pp-p'); e.scrollIntoView({ block: 'center' }); }); await pg.waitForTimeout(400);
await pg.screenshot({ path: OUT + '/7-panel-ficha.png' });
v('sin errores de JavaScript', !errores.length, errores);
await br.close(); web.close();
console.log(fallas ? fallas + ' FALLAS' : 'TODO BIEN'); process.exit(fallas ? 1 : 0);
