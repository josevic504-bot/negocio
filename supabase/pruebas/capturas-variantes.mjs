// Capturas y prueba en el navegador: existencia y precio por opción, Vender, tienda y carga desde Excel en el Panel
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const RAIZ = process.argv[3], OUT = process.argv[2], XLSXJS = process.argv[4];
const SRC = fs.readFileSync(RAIZ + '/Codigo.gs', 'utf8');
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), log: () => {}, urlArchivo: r => 'https://x/' + r, rutaDeUrl: () => null });
const api = (action, data, token, extra) => srv.atender(Object.assign({ action, token, data: data || {} }, extra || {}));
const web = http.createServer((q, r) => { let f = path.join(RAIZ, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.webp') ? 'image/webp' : f.endsWith('.png') ? 'image/png' : 'application/octet-stream' }); r.end(d); }); }).listen(8770);
const tok = (await api('registrar', { negocio: 'Norey Beauty & More', nombre: 'Noemí Reyes', giro: 'catalogo', whatsapp: '33130265', pin: '1234' })).data.token;
const neg = (await api('bootstrap', {}, tok)).data.negocioId;
await db.aplicar({ ops: [{ t: 'Licencias', op: 'upd', k: { id: neg }, row: { plus: 'si', estado: 'Activa' } }], props: { PANEL_CLAVE: 'clave123' } });
await api('guardar', { entidad: 'Config', registro: { tienda: 'si', tema: 'rosa' } }, tok);
const co = (await api('guardar', { entidad: 'Productos', registro: { nombre: 'Corrector líquido', categoria: 'Rostro', sub: 'Corrección', precio: 140, costo: 90, tipo: 'producto', precioEsp: 130, minEsp: 3, lema: 'Cobertura que se siente ligera.', puntos: 'Cobertura uniforme|Textura ligera',
  opciones: 'Tono: Nude 1#fbe0cf, Nude 3#f3cfa8, Beige 2#f1c39e, Beige 3#efbd85, Chocolate 1#a86c45', variantes: { 'Tono: Nude 1': { s: 10 }, 'Tono: Nude 3': { s: 0 }, 'Tono: Beige 2': { s: 7 }, 'Tono: Beige 3': { s: 9 }, 'Tono: Chocolate 1': { s: 6 } } } }, tok)).data;
const lo = (await api('guardar', { entidad: 'Productos', registro: { nombre: 'Loción Brisa', categoria: 'Lociones', sub: 'Dama', precio: 450, costo: 280, tipo: 'producto', opciones: 'Presentación: 50 ml, 100 ml', variantes: { 'Presentación: 50 ml': { s: 12 }, 'Presentación: 100 ml': { s: 8, p: 650 } } } }, tok)).data;
const br = await chromium.launch();
async function pagina(init, arg) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
  const pg = await ctx.newPage();
  pg.on('pageerror', e => console.log('ERROR JS:', e.message));
  await pg.route(/^https?:\/\/(?!localhost).*/, async rt => {
    const u = rt.request().url();
    if (/xlsx\.full\.min\.js/.test(u)) return rt.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(XLSXJS) });
    if (u.indexOf('/functions/v1/api') < 0) return rt.abort();
    const b = JSON.parse(rt.request().postData() || '{}');
    const r = await api(b.action, b.data, b.token, { panel: b.panel });
    rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r) });
  });
  if (init) await pg.addInitScript(init, arg);
  return pg;
}
// 1) Formulario: tabla por tono
let pg = await pagina(t => { localStorage.setItem('gnvm@/|token', t); localStorage.setItem('gnvm@/|verVisto', '9.9.9'); }, tok);
await pg.goto('http://localhost:8770/'); await pg.waitForTimeout(3000);
await pg.evaluate(() => { ir('productos'); formProducto(S.productos.find(p => p.nombre === 'Corrector líquido')); }); await pg.waitForTimeout(800);
await pg.locator('#pf-vg').scrollIntoViewIfNeeded(); await pg.waitForTimeout(300);
await pg.screenshot({ path: OUT + '/v1-form.png' });
// cambiar existencia de Beige 3 a 4 y guardar
await pg.locator('#pf-vg [data-vk="Tono: Beige 3"][data-c="s"]').fill('4'); await pg.locator('.sheet-f .pri').click(); await pg.waitForTimeout(900);
const p1 = (await api('bootstrap', {}, tok)).data.productos.find(p => p.id === co.id);
console.log('guardar desde el formulario → total', p1.stock, '(esperado 27) · Beige 3', JSON.parse(p1.variantes)['Tono: Beige 3'].s);
// 2) Vender: elegir presentación (precio propio) y tono agotado
await pg.evaluate(() => { ir('vender'); }); await pg.waitForTimeout(800);
await pg.evaluate(id => ACC.vadd({ dataset: { id } }), lo.id); await pg.waitForTimeout(600);
await pg.screenshot({ path: OUT + '/v2-vender-pres.png' });
await pg.locator('.sheet [data-v="100 ml"]').click(); await pg.locator('.sheet-f .pri').click(); await pg.waitForTimeout(500);
await pg.evaluate(id => ACC.vadd({ dataset: { id } }), co.id); await pg.waitForTimeout(600);
await pg.screenshot({ path: OUT + '/v3-vender-tono.png' });
await pg.locator('.sheet [data-v="Beige 2"]').click(); await pg.locator('.sheet-f .pri').click(); await pg.waitForTimeout(500);
console.log('ticket:', JSON.stringify(await pg.evaluate(() => S.ticket.items.map(i => i.descripcion + ' ' + i.precio))));
// 3) Tienda
pg = await pagina(); await pg.goto('http://localhost:8770/?tienda=' + neg); await pg.waitForTimeout(2500);
await pg.evaluate(() => { T.cat = 'Rostro'; pintarTienda(); }); await pg.waitForTimeout(500);
await pg.locator('.sp-card', { hasText: 'Corrector' }).click(); await pg.waitForTimeout(700);
await pg.locator('.tono', { hasText: 'Beige 2' }).click(); await pg.waitForTimeout(300);
await pg.screenshot({ path: OUT + '/v4-tienda-tonos.png' });
await pg.keyboard.press('Escape'); await pg.evaluate(() => { cerrarHojas && cerrarHojas(); T.cat = 'Lociones'; pintarTienda(); }); await pg.waitForTimeout(600);
await pg.locator('#t-cat').scrollIntoViewIfNeeded();
await pg.screenshot({ path: OUT + '/v5-tienda-lista.png' });
await pg.locator('.sp-card', { hasText: 'Loción' }).click(); await pg.waitForTimeout(600);
await pg.locator('.sheet [data-v="100 ml"]').click(); await pg.waitForTimeout(300);
await pg.screenshot({ path: OUT + '/v6-tienda-pres.png' });
await pg.locator('.sheet-f .acc').click(); await pg.waitForTimeout(500);
await pg.evaluate(() => tCarrito()); await pg.waitForTimeout(500);
await pg.fill('#tc-n', 'Carla Ruiz'); await pg.fill('#tc-t', '98765432'); await pg.locator('.sheet-f .wa').click(); await pg.waitForTimeout(1200);
const pe = (await api('pedidos', {}, tok)).data; console.log('pedido de la tienda:', JSON.stringify((pe.lista || pe)[0].items.map(i => i.nombre + ' ' + i.precio)));
// 4) Panel: plantilla y carga
pg = await pagina(); await pg.goto('http://localhost:8770/?panel'); await pg.waitForTimeout(1500);
const inp = pg.locator('input[type=password]').first(); await inp.fill('clave123'); await inp.press('Enter'); await pg.waitForTimeout(2500);
await pg.evaluate(id => panelImportar(id, 'Norey Beauty & More'), neg); await pg.waitForTimeout(600);
const [dl] = await Promise.all([pg.waitForEvent('download'), pg.locator('[data-a="impPlantilla"]').click()]);
const plant = OUT + '/plantilla-productos.xlsx'; await dl.saveAs(plant);
// hoja del cliente: usa la plantilla y agrega una fila con error
const X = createRequire(import.meta.url)(XLSXJS.replace(/dist\/xlsx\.full\.min\.js$/, ''));
const wb = X.readFile(plant), ws = wb.Sheets['Productos'], rows = X.utils.sheet_to_json(ws, { header: 1 });
rows.push(['Gloss Cherry', 'Labios', 'Gloss', '', 60]); rows.push(['Paleta Jade 15 tonos', 'Ojos', 'Paletas', 320, 210, 15, 'BM-604']);
wb.Sheets['Productos'] = X.utils.aoa_to_sheet(rows); X.writeFile(wb, OUT + '/norey.xlsx');
await pg.locator('#imp-f').setInputFiles(OUT + '/norey.xlsx'); await pg.waitForTimeout(1500);
await pg.screenshot({ path: OUT + '/v7-panel-revision.png' });
await pg.locator('.sheet-f .pri').click(); await pg.waitForTimeout(600);
const cf = pg.locator('.sheet-f .pri, .conf-b .pri, [data-si]').last(); try { await pg.getByRole('button', { name: 'Cargar las demás' }).click({ timeout: 2000 }); } catch (e) {}
await pg.waitForTimeout(1500);
await pg.screenshot({ path: OUT + '/v8-panel-cargado.png' });
const ps = (await api('bootstrap', {}, tok)).data.productos;
console.log('productos después de cargar:', ps.length, ps.map(p => p.nombre + ' ' + p.stock).join(' | '));
await br.close(); web.close(); console.log('listo');
