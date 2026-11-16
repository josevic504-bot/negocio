// Prueba y capturas: solicitudes de Tiendas Catrachas (formulario público del sitio → Panel Molina)
// Uso: node solicitudes.mjs <carpeta de capturas> <raíz del repo en main>
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const OUT = process.argv[2], RAIZ = process.argv[3]; fs.mkdirSync(OUT, { recursive: true });
const SRC = fs.readFileSync(RAIZ + '/Codigo.gs', 'utf8');
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), log: () => {}, urlArchivo: r => 'http://localhost:8783/__f/' + r, rutaDeUrl: u => (u.split('/__f/')[1] || null) });
const api = async (action, data, token, extra) => srv.atender(Object.assign({ action, token, data: data || {} }, extra || {}));
const web = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); let f = path.join(RAIZ, u); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.webp') ? 'image/webp' : f.endsWith('.png') ? 'image/png' : 'application/octet-stream' }); r.end(d); }); }).listen(8783);
let fallas = 0; const v = (n, c, x) => { console.log((c ? '✔ ' : '✘ ') + n); if (!c) { fallas++; if (x !== undefined) console.log('   ', JSON.stringify(x).slice(0, 400)); } };
await db.aplicar({ props: { PANEL_CLAVE: 'clave123' } });
await api('registrar', { negocio: 'Variedades Karla', nombre: 'Karla Hernández', giro: 'variedades', whatsapp: '33130270', pin: '1234' });
const buena = { negocio: 'Boutique Aurora', nombre: 'Andrea Lagos', whatsapp: '9988-7766', tipo: 'Boutiques de ropa y calzado', ciudad: 'La Ceiba', enlace: 'https://instagram.com/boutiqueaurora', nota: 'Vendo por Instagram desde 2022' };
let r = await api('solicitudDir', buena); v('una solicitud completa se guarda', r.ok && r.data === true, r);
r = await api('solicitudDir', buena); v('el mismo número el mismo día no se duplica', r.ok && (db.T.Solicitudes || []).length === 1, (db.T.Solicitudes || []).length);
r = await api('solicitudDir', Object.assign({}, buena, { whatsapp: '123' })); v('sin WhatsApp completo se rechaza', !r.ok && /WhatsApp/.test(r.error), r);
r = await api('solicitudDir', { negocio: '', nombre: 'X', whatsapp: '99887700', ciudad: '', enlace: '' }); v('sin datos se rechaza', !r.ok && /Completa/.test(r.error), r);
r = await api('solicitudDir', { negocio: '<script>alert(1)</script> Tienda', nombre: 'Luis Paz', whatsapp: '+504 3344-5566', tipo: 'Otros negocios', ciudad: 'Tela', enlace: '@tiendatela', nota: 'x'.repeat(900) });
v('textos largos se recortan y se guarda', r.ok && db.T.Solicitudes.length === 2 && db.T.Solicitudes[1].nota.length === 300, db.T.Solicitudes[1] && db.T.Solicitudes[1].nota.length);
r = await api('panelSolicitudes', {}); v('sin clave del Panel no se pueden ver', !r.ok, r);
const pt = (await api('panelLogin', { clave: 'clave123' })).data; const PT = pt && (pt.token || pt);
r = await api('panelSolicitudes', {}, PT, { panel: PT }); v('el Panel las lista, la más nueva primero', r.ok && r.data.length === 2 && r.data[0].ciudad === 'Tela' && r.data[1].estado === 'nueva', r.data);
r = await api('panelSolicitudEstado', { id: r.data[1].id, estado: 'contactada' }, PT, { panel: PT }); v('se puede marcar como contactada', r.ok && r.data[1].estado === 'contactada', r);
r = await api('panelSolicitudEstado', { id: r.data[1].id, estado: 'cualquiera' }, PT, { panel: PT }); v('un estado raro queda como nueva', r.ok && r.data[1].estado === 'nueva', r);
for (let i = 0; i < 62; i++) r = await api('solicitudDir', Object.assign({}, buena, { whatsapp: '9000' + String(1000 + i) }));
v('freno: máximo 60 solicitudes por día', !r.ok && /muchas solicitudes/.test(r.error) && db.T.Solicitudes.length === 60, [r.error, db.T.Solicitudes.length]);
db.T.Solicitudes.splice(2); // deja las dos primeras para la captura
// El Panel
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage();
const errores = []; pg.on('pageerror', e => { errores.push(e.message); console.log('ERROR JS:', e.message); });
await pg.route(/^https?:\/\/(?!localhost).*/, async rt => { if (rt.request().url().indexOf('/functions/v1/api') < 0) return rt.abort(); const b = JSON.parse(rt.request().postData() || '{}'); const x = await api(b.action, b.data, b.token, { panel: b.panel }); rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(x) }); });
await pg.goto('http://localhost:8783/?panel'); await pg.waitForTimeout(1500);
const inp = pg.locator('input[type=password]').first(); await inp.fill('clave123'); await inp.press('Enter'); await pg.waitForTimeout(2500);
await pg.locator('#pn-tabs [data-k="mkt"]').click(); await pg.waitForTimeout(1200);
v('el botón sale en Marketing con el número de nuevas', await pg.locator('[data-a="panelSolicitudes"]').count() === 1 && (await pg.locator('#pn-sol-n').textContent()) === '2', await pg.locator('#pn-sol-n').textContent().catch(() => ''));
await pg.screenshot({ path: OUT + '/panel-marketing.png' });
await pg.locator('[data-a="panelSolicitudes"]').click(); await pg.waitForTimeout(1000);
v('la hoja lista las dos solicitudes', await pg.locator('#so-l .li').count() === 2);
v('el texto con etiquetas sale como texto, no se ejecuta', (await pg.locator('#so-l').innerHTML()).indexOf('<script>alert') < 0 && /&lt;script&gt;/.test(await pg.locator('#so-l').innerHTML()));
v('el botón de WhatsApp lleva el número con 504', /wa\.me\/50499887766\?text=/.test(await pg.locator('#so-l .li').nth(1).locator('a.btn').getAttribute('href')));
await pg.locator('#so-l .li').nth(1).locator('[data-e="contactada"]').click(); await pg.waitForTimeout(800);
v('marcar «Contactada» se guarda y baja el contador', db.T.Solicitudes[0].estado === 'contactada' && (await pg.locator('#pn-sol-n').textContent()) === '1');
await pg.screenshot({ path: OUT + '/panel-solicitudes.png' });
v('sin errores de JavaScript', !errores.length, errores);
await br.close(); web.close(); console.log(fallas ? fallas + ' FALLAS' : 'TODO BIEN'); process.exit(fallas ? 1 : 0);
