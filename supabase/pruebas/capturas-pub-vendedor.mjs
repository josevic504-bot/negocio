// Vista previa: publicidad aplicada o ligada a un vendedor (Panel Molina)
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const RAIZ = process.argv[3], OUT = process.argv[2];
const SRC = fs.readFileSync(RAIZ + '/Codigo.gs', 'utf8');
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), log: () => {}, urlArchivo: r => 'http://localhost:8779/__f/' + r, rutaDeUrl: u => (u.split('/__f/')[1] || null) });
const api = async (action, data, token, extra) => { const r = await srv.atender(Object.assign({ action, token, data: data || {} }, extra || {})); if (!r.ok) console.log('API', action, r.error); return r; };
const web = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); let f = path.join(RAIZ, u); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.png') ? 'image/png' : 'application/octet-stream' }); r.end(d); }); }).listen(8779);
await db.aplicar({ props: { PANEL_CLAVE: 'clave123' } });
const pt = (await api('panelLogin', { clave: 'clave123' })).data; const PT = pt && (pt.token || pt);
const P = (a, d) => api(a, d, PT, { panel: PT });
// Vendedores
const maria = (await P('panelVendedorGuardar', { nombre: 'María Reyes', whatsapp: '99887766' })).data;
const carlos = (await P('panelVendedorGuardar', { nombre: 'Carlos Pineda', whatsapp: '33445566' })).data;
console.log('vend', maria && maria.codigo, carlos && carlos.codigo);
// Negocios que llegaron por sus enlaces
const neg = [['Pulpería La Bendición', 'tienda', maria.codigo, 3000], ['Boutique Ana', 'ropa', maria.codigo, 3500], ['Taller El Rápido', 'repuestos', maria.codigo, 0],
  ['Farmacia San José', 'farmacia', carlos.codigo, 3000], ['Comedor Doña Tere', 'restaurante', carlos.codigo, 0], ['Celulares HN', 'tecnologia', 'facebook', 3000]];
let i = 0;
for (const [n, g, o, pago] of neg) {
  const r = await api('registrar', { negocio: n, nombre: 'Dueño ' + (++i), giro: g, whatsapp: '9' + String(1000000 + i * 1111).slice(0, 7), pin: '1234', origen: { o, v: 'vid' + i } });
  const id = r.data && (r.data.negocioId || (r.data.sesion && r.data.sesion.negocioId));
  db.T.Licencias.forEach(l => { if (l.negocio === n) l._id = l.id; });
  const lic = db.T.Licencias.find(l => l.negocio === n);
  if (pago && lic) await P('panelPago', { id: lic.id, monto: pago, concepto: 'Licencia' });
}
console.log('lics', db.T.Licencias.map(l => l.negocio + ':' + l.origen).join(' | '));
const hoy = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10), hace = d => new Date(Date.now() - 6 * 3600e3 - d * 864e5).toISOString().slice(0, 10);
await P('panelGastoGuardar', { tipo: 'publicidad', plataforma: 'Facebook / Instagram', nombre: 'Prueba gratis 7 días', desde: hace(5), moneda: 'HNL', montoOrig: 1200 });
await P('panelGastoGuardar', { tipo: 'publicidad', plataforma: 'TikTok', nombre: 'Enlace de María', desde: hace(3), moneda: 'USD', montoOrig: 40, tasa: 26.2, vendedores: [maria.codigo] });
await P('panelGastoGuardar', { tipo: 'publicidad', plataforma: 'Facebook / Instagram', nombre: 'Ruta San Pedro Sula', desde: hace(4), moneda: 'HNL', montoOrig: 1600, vendedores: [maria.codigo, carlos.codigo] });
await P('panelGastoGuardar', { tipo: 'publicidad', plataforma: 'Volantes / impreso', nombre: 'Volantes mercado Guamilito', desde: hace(10), hasta: hace(2), moneda: 'HNL', montoOrig: 450 });

const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage();
pg.on('pageerror', e => console.log('ERROR JS:', e.message));
await pg.route(/^https?:\/\/(?!localhost).*/, async rt => { if (rt.request().url().indexOf('/functions/v1/api') < 0) return rt.abort(); const b = JSON.parse(rt.request().postData() || '{}'); const r = await api(b.action, b.data, b.token, { panel: b.panel }); rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r) }); });
await pg.goto('http://localhost:8779/?panel'); await pg.waitForTimeout(1500);
const inp = pg.locator('input[type=password]').first(); await inp.fill('clave123'); await inp.press('Enter'); await pg.waitForTimeout(2500);
const shot = async (n, full) => { await pg.waitForTimeout(700); await pg.screenshot({ path: OUT + '/' + n + '.png', fullPage: !!full }); };
// 1) Tus enlaces: tarjeta del vendedor con su publicidad
await pg.evaluate(() => ACC.panelEnlaces()); await pg.waitForTimeout(1200); await shot('1-enlaces');
// 2) Ficha de María: sección Publicidad (desplazada)
await pg.evaluate(c => ACC.panelVendVer({ dataset: { k: c } }), maria.codigo); await pg.waitForTimeout(900);
await pg.evaluate(() => { const b = document.querySelector('.sheet-b'); const t = [...b.querySelectorAll('.sec-t h3')].find(x => x.textContent === 'Publicidad'); b.scrollTop += t.getBoundingClientRect().top - b.getBoundingClientRect().top - 6; }); await shot('2-ficha-maria');
// 3) Aplicar gasto de publicidad desde su ficha (vendedor ya marcado)
await pg.click('[data-x="aplicar"]'); await pg.waitForTimeout(1200);
await pg.fill('#g-n1', 'Reel con su enlace'); await pg.fill('#g-m', '800'); await pg.dispatchEvent('#g-m', 'input');
await pg.evaluate(() => { const b = document.querySelector('.sheet-b'); b.scrollTop = 120; }); await shot('3-aplicar-gasto');
await pg.evaluate(() => document.querySelector('[data-cerrar]').click()); await pg.waitForTimeout(500);
// 4) Ligar a una publicidad existente
await pg.evaluate(c => ACC.panelEnlaces().then(() => ACC.panelVendVer({ dataset: { k: c } })), carlos.codigo); await pg.waitForTimeout(1200);
await pg.click('[data-x="ligar"]'); await shot('4-ligar');
await pg.evaluate(() => document.querySelector('[data-cerrar]').click()); await pg.waitForTimeout(500);
// 5) Gastos y publicidad: tarjetas con "De María…"
await pg.evaluate(() => ACC.panelGastosLista()); await pg.waitForTimeout(1200);
await pg.evaluate(() => { const t = [...document.querySelectorAll('.sec-t h3')].find(x => x.textContent === 'Publicidad'); window.scrollTo(0, t.getBoundingClientRect().top + scrollY - 60); }); await shot('5-gastos');
await br.close(); web.close(); console.log('listo');
