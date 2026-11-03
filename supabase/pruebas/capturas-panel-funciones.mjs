// Capturas: modo soporte, mensaje en Inicio, pago de licencia con comprobante y el Panel
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const RAIZ = process.argv[3], OUT = process.argv[2], RECIBO = process.argv[4];
const SRC = fs.readFileSync(RAIZ + '/Codigo.gs', 'utf8');
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
const fotos = {}; db.efecto = async e => { if (e.subir) fotos[e.subir.ruta] = Buffer.from(e.subir.b64, 'base64'); };
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), log: () => {}, urlArchivo: r => 'http://localhost:8772/__f/' + r, rutaDeUrl: u => (u.split('/__f/')[1] || null) });
const api = (action, data, token, extra) => srv.atender(Object.assign({ action, token, data: data || {} }, extra || {}));
const web = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); if (u.startsWith('/__f/')) { r.writeHead(200, { 'Content-Type': 'image/jpeg' }); r.end(fotos[u.slice(5)] || ''); return; }
  let f = path.join(RAIZ, u); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.webp') ? 'image/webp' : f.endsWith('.png') ? 'image/png' : 'application/octet-stream' }); r.end(d); }); }).listen(8772);
await db.aplicar({ props: { PANEL_CLAVE: 'clave123', DATOS_PAGO_LIC: 'BAC · Cuenta 7300-0000-1 · José Vicdonio Molina' } });
const tok = (await api('registrar', { negocio: 'Norey Beauty & More', nombre: 'Noemí Reyes', giro: 'catalogo', whatsapp: '33130265', pin: '1234' })).data.token;
await api('cargarEjemplos', {}, tok);
const neg = (await api('bootstrap', {}, tok)).data.negocioId;
await api('guardar', { entidad: 'Config', registro: { tema: 'rosa' } }, tok);
const pt = (await api('panelLogin', { clave: 'clave123' })).data.token;
const P = (a, d) => srv.atender({ action: a, panel: pt, data: d || {} });
const en3 = new Date(Date.now() - 6 * 3600000 + 3 * 86400000).toISOString().slice(0, 10);
await P('panelCuotas', { id: neg, accion: 'programar', monto: 350, fecha: en3, veces: 1, concepto: 'Licencia noviembre' });
await P('panelAnunciar', { titulo: 'Novedad', texto: 'Tus clientes ya pueden mandarte el comprobante de pago con su pedido en línea. Lo ves en Pedidos.', filtro: 'todos', banner: true, push: false });
const br = await chromium.launch();
async function pagina(init, arg) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage();
  pg.on('pageerror', e => console.log('ERROR JS:', e.message));
  await pg.route(/^https?:\/\/(?!localhost).*/, async rt => { if (rt.request().url().indexOf('/functions/v1/api') < 0) return rt.abort(); const b = JSON.parse(rt.request().postData() || '{}'); const r = await api(b.action, b.data, b.token, { panel: b.panel }); rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r) }); });
  if (init) await pg.addInitScript(init, arg); return pg;
}
// Dueña: Inicio con el mensaje y el próximo pago; enviar comprobante
let pg = await pagina(t => { localStorage.setItem('gnvm@/|token', t); localStorage.setItem('gnvm@/|verVisto', '9.9.9'); }, tok);
await pg.goto('http://localhost:8772/'); await pg.waitForTimeout(3500);
await pg.screenshot({ path: OUT + '/p1-inicio.png' });
await pg.locator('[data-a="verCobro"]').first().click(); await pg.waitForTimeout(600);
await pg.locator('#cb-cf').setInputFiles(RECIBO); await pg.waitForTimeout(800);
await pg.screenshot({ path: OUT + '/p2-cobro.png' });
await pg.evaluate(() => { try { cerrarHojas(); } catch (e) {} }); await pg.waitForTimeout(300);
await pg.evaluate(() => { S.inicioT = 0; R.inicio(); }); await pg.waitForTimeout(1200);
// Panel
pg = await pagina(); await pg.goto('http://localhost:8772/?panel'); await pg.waitForTimeout(1500);
const inp = pg.locator('input[type=password]').first(); await inp.fill('clave123'); await inp.press('Enter'); await pg.waitForTimeout(2500);
await pg.locator('.comp-mini').first().scrollIntoViewIfNeeded(); await pg.evaluate(() => scrollBy(0, -80));
await pg.screenshot({ path: OUT + '/p3-panel.png' });
await pg.evaluate(() => ACC.panelMensajes()); await pg.waitForTimeout(800);
await pg.locator('#an-t').fill('Mantenimiento'); await pg.locator('#an-x').fill('Hoy a las 10 p. m. el programa puede tardar unos minutos en responder.');
await pg.screenshot({ path: OUT + '/p4-mensaje.png' });
// Modo soporte
const va = (await P('panelVerApp', { id: neg })).data;
pg = await pagina(); await pg.goto('http://localhost:8772/?soporte=' + va.token); await pg.waitForTimeout(3500);
await pg.screenshot({ path: OUT + '/p5-soporte.png' });
await pg.evaluate(() => ir('productos')); await pg.waitForTimeout(800);
await pg.evaluate(() => formProducto(S.productos[0])); await pg.waitForTimeout(600); await pg.locator('.sheet-f .pri').click(); await pg.waitForTimeout(900);
await pg.screenshot({ path: OUT + '/p6-soporte-guardar.png' });
console.log('comprobantes en el panel:', JSON.stringify((await P('panelComprobantes')).data.map(c => c.negocio + ' ' + c.monto)));
await br.close(); web.close(); console.log('listo');
