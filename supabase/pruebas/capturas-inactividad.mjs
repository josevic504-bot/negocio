// Capturas: regla de inactividad (prueba vencida y más de 30 días sin entrar) en el Panel
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const RAIZ = process.argv[3], OUT = process.argv[2], RECIBO = process.argv[4];
const SRC = fs.readFileSync(RAIZ + '/Codigo.gs', 'utf8');
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
const fotos = {}; db.efecto = async e => { if (e.subir) fotos[e.subir.ruta] = Buffer.from(e.subir.b64, 'base64'); };
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), log: () => {}, urlArchivo: r => 'http://localhost:8777/__f/' + r, rutaDeUrl: u => (u.split('/__f/')[1] || null) });
const api = (action, data, token, extra) => srv.atender(Object.assign({ action, token, data: data || {} }, extra || {}));
const web = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); if (u.startsWith('/__f/')) { r.writeHead(200, { 'Content-Type': 'image/jpeg' }); r.end(fotos[u.slice(5)] || ''); return; }
  let f = path.join(RAIZ, u); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.webp') ? 'image/webp' : f.endsWith('.png') ? 'image/png' : 'application/octet-stream' }); r.end(d); }); }).listen(8777);
await db.aplicar({ props: { TAREAS_CLAVE: 'tk', PANEL_CLAVE: 'clave123', DATOS_PAGO_LIC: 'BAC · Cuenta 7300-0000-1 · José Vicdonio Molina' } });

const negs = [];
for (const [n, d, g, w] of [['Boutique Lucía', 'Lucía Paz', 'boutique', '99880001'], ['Variedades Don Toño', 'Antonio Ruiz', 'variedades', '99880002'], ['Pulpería La Esquina', 'Marta Díaz', 'tienda', '99880003'], ['Taller El Rayo', 'Carlos Mejía', 'repuestos', '99880004'], ['Farmacia Vida', 'Rosa Cruz', 'farmacia', '99880005']]) {
  const t = (await api('registrar', { ciudad: 'San Pedro Sula', negocio: n, nombre: d, giro: g, whatsapp: w, pin: '1234' })).data.token; negs.push({ t, id: db.T.Licencias.find(l => l.negocio === n).id });
}
for (const x of negs) await api('cargarEjemplos', {}, x.t);
const hace = d => { const x = new Date(Date.now() - 6 * 3600000 - d * 86400000).toISOString(); return x.slice(0, 10) + ' ' + x.slice(11, 16); };
const lic = id => db.T.Licencias.find(x => x.id === id);
Object.assign(lic(negs[1].id), { estado: 'Vencida', registro: hace(45), vencePrueba: hace(38).slice(0, 10), ultimaConexion: hace(36) });
Object.assign(lic(negs[2].id), { estado: 'Vencida', registro: hace(42), vencePrueba: hace(35).slice(0, 10), ultimaConexion: hace(33) });
Object.assign(lic(negs[3].id), { estado: 'Vencida', registro: hace(20), vencePrueba: hace(13).slice(0, 10), ultimaConexion: hace(12) });
await srv.atender({ tarea: 'respaldosDia', clave: 'tk' });
const pt = (await api('panelLogin', { clave: 'clave123' })).data.token;
const P = (a, d) => srv.atender({ action: a, panel: pt, data: d || {} });
await P('panelAccion', { id: negs[0].id, accion: 'activar', monto: 3000 });
const br = await chromium.launch();
async function pagina(init, arg) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage();
  pg.on('pageerror', e => console.log('ERROR JS:', e.message));
  await pg.route(/^https?:\/\/(?!localhost).*/, async rt => { if (rt.request().url().indexOf('/functions/v1/api') < 0) return rt.abort(); const b = JSON.parse(rt.request().postData() || '{}'); const r = await api(b.action, b.data, b.token, { panel: b.panel }); rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r) }); });
  if (init) await pg.addInitScript(init, arg); return pg;
}

let pg = await pagina(); await pg.goto('http://localhost:8777/?panel'); await pg.waitForTimeout(2500); await pg.screenshot({ path: OUT + '/i0.png' }); console.log(await pg.evaluate(() => document.body.innerText.slice(0, 300)));
const inp = pg.locator('input[type=password]').first(); await inp.fill('clave123'); await inp.press('Enter'); await pg.waitForTimeout(2500);
await pg.evaluate(() => { const h = [...document.querySelectorAll('.pn-it')].find(x => /inactividad/.test(x.textContent)); if (h) h.scrollIntoView({ block: 'center' }); }); await pg.waitForTimeout(400);
await pg.screenshot({ path: OUT + '/i1-pendientes.png' });
await pg.evaluate(() => { const h = [...document.querySelectorAll('.pn-it')].find(x => /inactividad/.test(x.textContent)); if (h) h.click(); }); await pg.waitForTimeout(1200);
await pg.screenshot({ path: OUT + '/i2-eliminadas.png' });
await pg.evaluate(id => panelFicha(id), negs[1].id); await pg.waitForTimeout(2500); await pg.evaluate(() => { const el = [...document.querySelectorAll('.aviso')].find(x => /inactividad/.test(x.textContent)); if (el) el.scrollIntoView({ block: 'center' }); }); await pg.waitForTimeout(500);
await pg.screenshot({ path: OUT + '/i3-ficha.png' });
console.log('eliminadas:', JSON.stringify((await P('panelResumen')).data.eliminadas.map(x => x.negocio + ' · ' + x.motivo)));
await br.close(); web.close(); console.log('listo');
