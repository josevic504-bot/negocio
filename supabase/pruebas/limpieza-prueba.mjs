// Prueba 1.9.73: limpiar los datos de la prueba (aviso al activar, elegir uno por uno, dependencias, existencias y copia)
// node limpieza-prueba.mjs <carpeta-salida> <raíz del repo con Codigo.gs e index.html>
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
const res = (m, r) => { ok(r && r.ok, m + (r && r.ok ? '' : ' · ' + (r && r.error))); return r && r.data; };
const espera = ms => new Promise(r => setTimeout(r, ms));
await db.aplicar({ props: { PANEL_CLAVE: 'clave123' } });

// ---- Durante la prueba ----
const tok = (await api('registrar', { negocio: 'Variedades Sofía', nombre: 'Sofía', giro: 'variedades', whatsapp: '33445566', pin: '1234' })).data.token;
const neg = (await api('bootstrap', {}, tok)).data.negocioId;
await db.aplicar({ ops: [{ t: 'Licencias', op: 'upd', k: { id: neg }, row: { plus: 'si' } }] });
await api('cargarEjemplos', {}, tok);
let b = (await api('bootstrap', {}, tok)).data;
ok(!b.limpieza && db.T.Config.some(c => c.negocio_id === neg && c.clave === 'sysPrueba' && c.valor === 'si'), 'en prueba: sin aviso y queda anotado que estuvo en prueba');
const ej = b.productos, cam = ej.find(p => p.nombre === 'Camiseta básica'), per = ej.find(p => /Perfume/.test(p.nombre));
const mio = res('producto propio creado en la prueba', await api('guardar', { entidad: 'Productos', registro: { nombre: 'Bolso de playa', categoria: 'Regalos', precio: 300, costo: 150, stock: 10 } }, tok));
const ana = res('cliente Ana', await api('guardar', { entidad: 'Clientes', registro: { nombre: 'Ana', telefono: '99112233' } }, tok));
const luis = res('cliente Luis', await api('guardar', { entidad: 'Clientes', registro: { nombre: 'Luis', telefono: '99445566' } }, tok));
const K = () => 'k' + Math.random();
const vA = res('venta A (ejemplo + propio)', await api('venta', { items: [{ productoId: cam.id, cantidad: 2, precio: 250, variante: 'Talla: S, Color: Blanco' }, { productoId: mio.id, cantidad: 1, precio: 300 }], metodo: 'Efectivo', recibido: 800, clave: K() }, tok));
const vB = res('venta B (perfume a Ana)', await api('venta', { items: [{ productoId: per.id, cantidad: 1 }], metodo: 'Efectivo', recibido: 1000, clienteId: ana.id, clave: K() }, tok));
const vD = res('venta D al crédito a Luis', await api('venta', { items: [{ productoId: mio.id, cantidad: 1, precio: 300 }], metodo: 'Crédito', credito: true, clienteId: luis.id, recibido: 0, clave: K() }, tok));
res('abono de Luis', await api('abono', { clienteId: luis.id, monto: 50, metodo: 'Efectivo' }, tok));
const cC = res('compra C (+5 bolsos)', await api('compra', { items: [{ productoId: mio.id, cantidad: 5, costo: 150 }], metodo: 'Efectivo', factura: 'F-1' }, tok));
res('gasto de prueba', await api('guardarGasto', { registro: { categoria: 'Luz', detalle: 'Recibo de prueba', monto: 120 } }, tok));
const stockAntes = (await api('bootstrap', {}, tok)).data.productos.find(p => p.id === mio.id).stock;
ok(stockAntes === 13, 'bolsos en la prueba: 10 + 5 − 1 − 1 = ' + stockAntes);

// ---- Se activa la licencia ----
await espera(1100);
await db.aplicar({ ops: [{ t: 'Licencias', op: 'upd', k: { id: neg }, row: { estado: 'Activa' } }] });
b = (await api('bootstrap', {}, tok)).data;
ok(b.limpieza && b.limpieza.aviso && b.limpieza.ver, 'licencia activa: aviso de limpieza ' + JSON.stringify(b.limpieza));
await espera(1100);
const vR = res('venta real después de activar (2 bolsos)', await api('venta', { items: [{ productoId: mio.id, cantidad: 2, precio: 300 }], metodo: 'Efectivo', recibido: 600, clave: K() }, tok));
const V = (await api('limpiezaVer', {}, tok)).data;
ok(V.ventas.length === 3 && !V.ventas.some(x => x.id === vR.venta.id), 'ventas de la prueba: ' + V.ventas.map(x => '#' + x.n).join(', ') + ' (la venta real no aparece)');
ok(V.productos.length === ej.length && !V.productos.some(x => x.id === mio.id), V.productos.length + ' productos de ejemplo; el producto propio no aparece');
ok(V.compras.length === 1 && V.gastos.length === 1 && V.clientes.length === 2, 'compras 1, gastos 1, clientes 2');
const dAna = V.clientes.find(c => c.id === ana.id).dep, dLuis = V.clientes.find(c => c.id === luis.id).dep;
ok(dAna.join() === 'v:' + vB.venta.id && dLuis.every(k => k === 'v:' + vD.venta.id), 'dependencias: Ana → venta B, Luis → venta D y su abono');
ok(!(await api('limpiarPrueba', { borrar: { ventas: [vA.venta.id] }, pin: '9999' }, tok)).ok, 'PIN equivocado: no borra nada');

// ---- En la app: aviso, elegir y borrar ----
const web = http.createServer((q, r) => { let f = path.join(RAIZ, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.png') ? 'image/png' : f.endsWith('.webp') ? 'image/webp' : 'application/octet-stream' }); r.end(d); }); }).listen(8772);
const br = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const pg = await ctx.newPage(); const errores = [];
pg.on('pageerror', e => errores.push(e.message));
pg.on('dialog', d => d.dismiss());
await pg.route(/^https?:\/\/(?!localhost).*/, async rt => {
  const u = rt.request().url(); if (u.indexOf('/functions/v1/api') < 0) return rt.abort();
  const bd = JSON.parse(rt.request().postData() || '{}'); const r = await api(bd.action, bd.data, bd.token, { panel: bd.panel });
  rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r) });
});
await pg.addInitScript(t => { localStorage.setItem('gnvm@/|token', t); localStorage.setItem('gnvm@/|verVisto', '9.9.9'); }, tok);
await pg.goto('http://localhost:8772/');
let aviso = 0; for (let i = 0; i < 20 && !aviso; i++) { await pg.waitForTimeout(700); aviso = await pg.locator('.sheet', { hasText: 'Tu licencia está activa' }).count(); }
ok(aviso, 'sale el aviso «¡Tu licencia está activa!»');
await pg.waitForTimeout(500); await pg.screenshot({ path: OUT + '/lz1-aviso.png' });
await pg.locator('.sheet-f .btn', { hasText: 'Revisar y limpiar' }).click(); await pg.waitForTimeout(900);
await pg.screenshot({ path: OUT + '/lz2-hoja.png' });
await pg.locator('[data-lzop="ventas"]').click(); await pg.waitForTimeout(300);
await pg.locator('.lz-i', { hasText: '#' + vB.venta.numero }).click(); await pg.waitForTimeout(300);
await pg.locator('[data-lzop="ventas"]').scrollIntoViewIfNeeded();
await pg.screenshot({ path: OUT + '/lz3-ventas.png' });
await pg.locator('[data-lzop="ventas"]').click(); await pg.waitForTimeout(200);
await pg.locator('[data-lzop="productos"]').click(); await pg.waitForTimeout(300);
const perBloq = await pg.locator('.lz-i[disabled]', { hasText: 'Perfume' }).count();
ok(perBloq === 1, 'el perfume queda bloqueado: «' + (await pg.locator('.lz-i[disabled]', { hasText: 'Perfume' }).first().innerText().catch(() => '')).replace(/\n/g, ' · ') + '»');
await pg.locator('.lz-i', { hasText: 'Perfume' }).first().scrollIntoViewIfNeeded(); await pg.screenshot({ path: OUT + '/lz4-productos.png' });
await pg.locator('[data-lzop="productos"]').click(); await pg.waitForTimeout(200);
await pg.locator('[data-lzop="clientes"]').click(); await pg.waitForTimeout(300);
const anaBloq = await pg.locator('.lz-i[disabled]', { hasText: 'Ana' }).count();
await pg.locator('.lz-i', { hasText: 'Luis' }).click(); await pg.waitForTimeout(300);
ok(anaBloq === 1 && await pg.locator('.lz-i', { hasText: 'Luis' }).locator('.ck.on').count() === 1, 'Ana bloqueada (venta que se conserva); Luis marcado');
await pg.locator('[data-lzop="clientes"]').scrollIntoViewIfNeeded(); await pg.screenshot({ path: OUT + '/lz5-clientes.png' });
const textoBoton = await pg.locator('.sheet-f .bad').innerText();
await pg.locator('#lz-pin').fill('1234'); await pg.locator('.sheet-f .bad').click(); await pg.waitForTimeout(600);
await pg.screenshot({ path: OUT + '/lz6-confirmar.png' });
await pg.locator('.sheet-f .btn', { hasText: 'Sí, borrar' }).click(); await pg.waitForTimeout(900);
await pg.screenshot({ path: OUT + '/lz7-listo.png' });
await pg.waitForTimeout(2500);
console.log('  botón: «' + textoBoton + '»');

// ---- Resultado ----
b = (await api('bootstrap', {}, tok)).data;
const P = b.productos, ventas = db.T.Ventas.filter(v => v.negocio_id === neg).map(v => v.id);
ok(!ventas.includes(vA.venta.id) && !ventas.includes(vD.venta.id) && ventas.includes(vB.venta.id) && ventas.includes(vR.venta.id), 'ventas A y D borradas; B (desmarcada) y la real se quedan');
ok(!P.some(p => p.id === cam.id) && P.some(p => p.id === per.id) && P.some(p => p.id === mio.id), 'camiseta de ejemplo borrada; perfume (en venta B) y bolso propio se quedan');
const bol = P.find(p => p.id === mio.id);
ok(bol.stock === 8, 'bolsos: 13 − 2 (venta real) + 1 + 1 (ventas borradas devueltas) − 5 (compra borrada) = ' + bol.stock + ' (esperado 8)');
const kx = db.T.Inventario.filter(m => m.negocio_id === neg && m.productoId === mio.id);
ok(!kx.some(m => [vA.venta.id, vD.venta.id, cC.compra ? cC.compra.id : cC.id].includes(m.refId)) && kx.some(m => /Limpieza de la prueba/.test(m.nota)), 'movimientos: se quitaron los de lo borrado y queda un ajuste «Limpieza de la prueba»');
ok(!db.T.Clientes.some(c => c.id === luis.id) && db.T.Clientes.some(c => c.id === ana.id), 'Luis borrado; Ana se queda');
ok(!db.T.Abonos.some(a => a.negocio_id === neg), 'el abono de Luis se fue con su venta');
ok(!db.T.Compras.some(c => c.negocio_id === neg) && !db.T.Gastos.some(g => g.negocio_id === neg), 'compra y gasto de prueba borrados');
ok(b.limpieza && !b.limpieza.aviso && b.limpieza.ver, 'ya no sale el aviso; sigue en Ajustes');
ok((db.T.Seguimiento || []).some(s => s.negocioId === neg && /Limpió los datos de la prueba/.test(s.nota)), 'queda anotado para el Panel: ' + ((db.T.Seguimiento || []).find(s => s.negocioId === neg && /Limpió/.test(s.nota)) || {}).nota);
// Ajustes › Mi cuenta
await pg.evaluate(() => ir('ajustes')); await pg.waitForTimeout(800);
await pg.evaluate(() => { const s = [...document.querySelectorAll('details, .sec')].find(x => /Mi cuenta/.test(x.textContent)); if (s && s.tagName === 'DETAILS') s.open = true; else if (s) s.click(); }); await pg.waitForTimeout(500);
const enAj = pg.locator('[data-a="limpiarPrueba"]');
ok(await enAj.count() === 1, 'en Ajustes › Mi cuenta aparece «Limpiar datos de la prueba»');
if (await enAj.count()) { await enAj.scrollIntoViewIfNeeded(); await pg.screenshot({ path: OUT + '/lz8-ajustes.png' }); }
// Conservar todo
const t2 = (await api('registrar', { negocio: 'Tienda Luis', nombre: 'Luis', giro: 'variedades', whatsapp: '99887766', pin: '1234' })).data.token;
const n2 = (await api('bootstrap', {}, t2)).data.negocioId; await api('cargarEjemplos', {}, t2); await api('bootstrap', {}, t2);
await espera(1100); await db.aplicar({ ops: [{ t: 'Licencias', op: 'upd', k: { id: n2 }, row: { estado: 'Activa' } }] });
ok((await api('bootstrap', {}, t2)).data.limpieza.aviso, 'otro negocio activado: sale el aviso');
await api('limpiezaOmitir', {}, t2);
const b2 = (await api('bootstrap', {}, t2)).data;
ok(!b2.limpieza.aviso && b2.productos.length > 0, '«Conservar todo»: no vuelve a salir y no se borra nada');
ok(!errores.length, 'sin errores de JavaScript' + (errores.length ? ': ' + errores.join(' · ') : ''));
await br.close(); web.close();
console.log(fallas ? '✗ ' + fallas + ' fallas' : '✓ todo bien'); process.exit(fallas ? 1 : 0);
