// Capturas: fila de avisos del Panel en el Dashboard y su hoja (sin activar / activados / navegador sin avisos)
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const RAIZ = process.argv[3], OUT = process.argv[2];
const SRC = fs.readFileSync(RAIZ + '/Codigo.gs', 'utf8');
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), log: () => {}, urlArchivo: r => 'http://localhost:8778/__f/' + r, rutaDeUrl: u => (u.split('/__f/')[1] || null) });
const api = (action, data, token, extra) => srv.atender(Object.assign({ action, token, data: data || {} }, extra || {}));
const web = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); let f = path.join(RAIZ, u); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); r.end(d); }); }).listen(8778);
await db.aplicar({ props: { PANEL_CLAVE: 'clave123' } });
const t = (await api('registrar', { negocio: 'Norey Beauty & More', nombre: 'Noemí', giro: 'catalogo', whatsapp: '33130265', pin: '1234' })).data.token; await api('cargarEjemplos', {}, t);
const br = await chromium.launch();
async function pagina(init) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage();
  pg.on('pageerror', e => console.log('ERROR JS:', e.message));
  await pg.route(/^https?:\/\/(?!localhost).*/, async rt => { if (rt.request().url().indexOf('/functions/v1/api') < 0) return rt.abort(); const b = JSON.parse(rt.request().postData() || '{}'); const r = await api(b.action, b.data, b.token, { panel: b.panel }); rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r) }); });
  if (init) await pg.addInitScript(init); return pg;
}
const entrar = async pg => { await pg.goto('http://localhost:8778/?panel'); await pg.waitForTimeout(1500); const inp = pg.locator('input[type=password]').first(); await inp.fill('clave123'); await inp.press('Enter'); await pg.waitForTimeout(2500); };
let pg = await pagina(); await entrar(pg); await pg.screenshot({ path: OUT + '/a1-sin.png' });
await pg.evaluate(() => ACC.panelAvisos()); await pg.waitForTimeout(600); await pg.screenshot({ path: OUT + '/a2-hoja.png' });
pg = await pagina(() => { Object.defineProperty(Notification, 'permission', { get: () => 'granted' }); localStorage.setItem('gnvm@/|panelAvisos', 'si'); }); await entrar(pg); await pg.screenshot({ path: OUT + '/a3-on.png' });
await pg.evaluate(() => ACC.panelAvisos()); await pg.waitForTimeout(600); await pg.screenshot({ path: OUT + '/a4-on-hoja.png' });
pg = await pagina(() => { Object.defineProperty(window, 'Notification', { value: undefined, configurable: true }); }); await entrar(pg);
await pg.evaluate(() => ACC.panelAvisos()); await pg.waitForTimeout(600); await pg.screenshot({ path: OUT + '/a5-no.png' });
await br.close(); web.close(); console.log('listo');
