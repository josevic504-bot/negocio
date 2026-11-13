// Capturas 1.9.81: compras en línea — registrar factura, en camino, apartados, liberar
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const RAIZ = process.argv[3], OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const SRC = fs.readFileSync(RAIZ + '/Codigo.gs', 'utf8');
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), log: () => {}, urlArchivo: r => 'http://localhost:8773/__f/' + r, rutaDeUrl: u => (u.split('/__f/')[1] || null) });
const api = (action, data, token) => srv.atender({ action, token, data: data || {} });
const web = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]);
  let f = path.join(RAIZ, u); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.webp') ? 'image/webp' : f.endsWith('.png') ? 'image/png' : 'application/octet-stream' }); r.end(d); }); }).listen(8773);
const tok = (await api('registrar', { negocio: 'Todo en Uno HN', nombre: 'Karla Hernández', giro: 'compras', whatsapp: '33130265', pin: '1234' })).data.token;
const neg = (await api('bootstrap', {}, tok)).data.negocioId;
await db.aplicar({ ops: [{ t: 'Licencias', op: 'upd', k: { id: neg }, row: { plus: 'si', estado: 'Activa' } }] });
await api('guardar', { entidad: 'Config', registro: { tienda: 'si', tiendaPagos: 'Efectivo,Transferencia', comprasCambio: '25', comprasRecargo: '15', comprasAnticipo: '50', comprasPlazo: '8', tiendaAbre: '00:00', tiendaCierra: '23:59', tiendaDias: '0,1,2,3,4,5,6' } }, tok);
const pedir = (nombre, tel, arts) => api('pedir', { negocio: neg, nombre, telefono: tel, entrega: 'recoger', pago: 'Efectivo', items: arts.map(a => Object.assign({ id: '_compra', cantidad: 1 }, a)) });
const r1 = await pedir('María López', '9911-0001', [{ enlace: 'sw2306123456789', usd: 18.4, talla: 'M', color: 'Negro' }, { enlace: 'sw2310987654321', usd: 21.2, talla: '38' }]);
const r2 = await pedir('Ana Paz', '9911-0002', [{ enlace: 'sw2401122334455', usd: 15.9, talla: 'S', color: 'Rosa' }]);
const r3 = await pedir('Luis Mejía', '9911-0003', [{ enlace: 'tm8812345', usd: 32 }]);
const L = (await api('pedidos', {}, tok)).data;
for (const id of [r1.data.id, r3.data.id]) { const p = L.find(x => x.id === id); await api('anticipoPedido', { id, monto: p.anticipo, metodo: 'Efectivo' }, tok); }
const br = await chromium.launch();
const errores = [];
const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const app = await ctx.newPage();
app.on('pageerror', e => { errores.push(e.message); console.log('ERROR JS:', e.message); });
app.on('console', m => { if (m.type() === 'error') console.log('consola:', m.text()); });
await app.route(/^https?:\/\/(?!localhost).*/, async rt => { if (rt.request().url().indexOf('/functions/v1/api') < 0) return rt.abort(); const b = JSON.parse(rt.request().postData() || '{}'); const r = await api(b.action, b.data, b.token); rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r) }); });
await app.addInitScript(t => { localStorage.setItem('gnvm@/|token', t); localStorage.setItem('gnvm@/|verVisto', '9.9.9'); }, tok);
await app.goto('http://localhost:8773/'); await app.waitForTimeout(3000); await app.evaluate(() => cerrarHojas()); await app.waitForTimeout(400);
await app.evaluate(() => ir('pedidos')); await app.waitForTimeout(1500);
await app.screenshot({ path: OUT + '/01-pedidos-nuevos.png' });
// Registrar factura con 2 pedidos
const n1 = await app.evaluate(id => S.pedidosL.find(p => p.id === id).numero, r1.data.id);
await app.locator(`[data-a="pedAccion"][data-id="${r1.data.id}"]`).click(); await app.waitForTimeout(700);
await app.check(`input[data-p="${r2.data.id}"]`); await app.waitForTimeout(400);
await app.fill('#rf-f', 'GSHN7X2K');
const us = { [r1.data.id + '|0']: '8.40', [r1.data.id + '|1']: '11.20', [r2.data.id + '|0']: '7.15' };
for (const k in us) await app.fill(`input[data-u="${k}"]`, us[k]);
await app.fill('#rf-e', '150');
await app.waitForTimeout(300);
await app.screenshot({ path: OUT + '/02-registrar-factura.png', fullPage: false });
await app.evaluate(() => { const s = document.querySelector('.sheet .sheet-b') || document.querySelector('.sheet'); if (s) s.scrollTop = 99999; }); await app.waitForTimeout(300);
await app.screenshot({ path: OUT + '/03-registrar-factura-resumen.png' });
await app.locator('.sheet-f .btn.pri').click(); await app.waitForTimeout(1500);
await app.screenshot({ path: OUT + '/04-en-camino.png' });
// Ya llegó (María)
await app.locator(`[data-a="pedAccion"][data-id="${r1.data.id}"][data-e="llego"]`).click(); await app.waitForTimeout(600);
await app.screenshot({ path: OUT + '/05-ya-llego-confirmar.png' });
await app.locator('.sheet-f .btn.pri').last().click(); await app.waitForTimeout(1500);
await app.screenshot({ path: OUT + '/06-apartados.png' });
// Ver pedido apartado
await app.locator(`[data-a="verPedido"][data-id="${r1.data.id}"]`).click(); await app.waitForTimeout(700);
await app.evaluate(() => { const s = [...document.querySelectorAll('.sheet .sheet-b')].pop(); if (s) s.scrollTop = 99999; }); await app.waitForTimeout(300);
await app.screenshot({ path: OUT + '/07-ver-apartado.png' });
await app.evaluate(() => cerrarHojas()); await app.waitForTimeout(300);
// Luis: factura Temu ya llegó, vencido, liberar
await api('compraFactura', { pedidos: [{ id: r3.data.id, costos: [800] }], proveedor: 'Temu', factura: 'PO-55821', metodo: 'Efectivo', envio: 90, modo: 'gasto', llego: true }, tok);
const p3 = db.T.Pedidos.find(p => p.id === r3.data.id), rb = JSON.parse(p3.recibo); rb.vence = '2026-11-10'; p3.recibo = JSON.stringify(rb);
await app.evaluate(() => { S.pedidosL = null; S.f.pest = 'apartado'; R.pedidos(); }); await app.waitForTimeout(1500);
await app.screenshot({ path: OUT + '/08-apartado-vencido.png' });
await app.locator(`[data-a="liberarAp"][data-id="${r3.data.id}"]`).click(); await app.waitForTimeout(700);
await app.fill('input[data-n="0"]', 'Zapatos deportivos blancos'); await app.fill('input[data-pr="0"]', '1250');
await app.locator('[data-an="ingreso"]').click(); await app.waitForTimeout(300);
await app.screenshot({ path: OUT + '/09-liberar.png' });
await app.evaluate(() => { const s = [...document.querySelectorAll('.sheet .sheet-b')].pop(); if (s) s.scrollTop = 99999; }); await app.waitForTimeout(300);
await app.screenshot({ path: OUT + '/10-liberar-resumen.png' });
await app.locator('.sheet-f .btn.pri').click(); await app.waitForTimeout(1500);
await app.screenshot({ path: OUT + '/11-liberado.png' });
// Entregar a María: cobro con segundo pago
await app.evaluate(() => { S.pedidosL = null; S.f.pest = 'apartado'; R.pedidos(); }); await app.waitForTimeout(1200);
await app.locator(`[data-a="pedAccion"][data-id="${r1.data.id}"][data-e="cobrar"]`).click(); await app.waitForTimeout(1800);
await app.screenshot({ path: OUT + '/12-cobrar-apartado.png' });
// Inicio
await app.evaluate(() => { cerrarHojas(); S.inicio = null; ir('inicio'); }); await app.waitForTimeout(2000);
await app.evaluate(() => { const t = [...document.querySelectorAll('.tile')].find(x => /Compras en línea/.test(x.textContent)); if (t) t.scrollIntoView({ block: 'center' }); }); await app.waitForTimeout(300);
await app.screenshot({ path: OUT + '/13-inicio.png' });
// Ajustes: plazo y mensajes
await app.evaluate(() => ir('tienda')); await app.waitForTimeout(1500);
await app.evaluate(() => { const t = document.querySelector('[data-k="comprasPlazo"]'); if (t) { const d = t.closest('details'); if (d) d.open = true; const s = t.closest('.sec'); if (s && s.querySelector('.sec-h') && !s.classList.contains('on')) s.querySelector('.sec-h').click(); setTimeout(() => t.scrollIntoView({ block: 'center' }), 200); } });
await app.waitForTimeout(800);
await app.screenshot({ path: OUT + '/14-ajustes-plazo.png' });
console.log('errores JS:', errores.length);
const prods = db.T.Productos.filter(p => p.nombre === 'Zapatos deportivos blancos'); console.log('producto liberado:', JSON.stringify(prods.map(p => [p.stock, p.costo, p.precio, p.tienda])));
await br.close(); web.close(); process.exit(0);
