// Capturas y prueba en navegador del giro «Repuestos y taller (carro y moto)» (1.9.94)
// node capturas-repuestos.mjs <carpeta salida> <carpeta con index.html y Codigo.gs>   (PLAYWRIGHT_PATH y CHROME opcionales)
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const req = createRequire(import.meta.url); let pw; try { pw = req('playwright'); } catch (e) { pw = req(process.env.PLAYWRIGHT_PATH || 'playwright-core'); }
const OUT = process.argv[2], RAIZ = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });
const SRC = fs.readFileSync(RAIZ + '/Codigo.gs', 'utf8');
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), log: () => {}, urlArchivo: r => 'https://x/' + r, rutaDeUrl: () => null });
const api = (action, data, token, extra) => srv.atender(Object.assign({ action, token, data: data || {} }, extra || {}));
const PORT = 8771;
const web = http.createServer((q, r) => { let f = path.join(RAIZ, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.png') ? 'image/png' : f.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream' }); r.end(d); }); }).listen(PORT);

let pas = 0, fal = 0; const ok = (n, c, d) => { if (c) { pas++; console.log('✓ ' + n); } else { fal++; console.log('✗ ' + n + (d !== undefined ? ' → ' + JSON.stringify(d).slice(0, 200) : '')); } };

// Negocio de ejemplo: solo vende repuestos
const r0 = await api('registrar', { ciudad: 'San Pedro Sula', negocio: 'Repuestos El Pistón', nombre: 'Carlos Rivera', giro: 'repuestos', whatsapp: '33112244', pin: '1234', taller: 'no' });
const tok = r0.data.token;
await api('cargarEjemplos', {}, tok);
const neg = (await api('bootstrap', {}, tok)).data.negocioId;
await db.aplicar({ ops: [{ t: 'Licencias', op: 'upd', k: { id: neg }, row: { plus: 'si', estado: 'Activa' } }] });
await api('guardar', { entidad: 'Config', registro: { tienda: 'si', tema: 'grafito', eslogan: 'Repuestos para carro y moto · San Pedro Sula', telefono: '3311-2244' } }, tok);

const br = await pw.chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const errores = [];
async function pagina(init, arg) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  pg.on('pageerror', e => errores.push(String(e))); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errores.push(m.text()); });
  await pg.route(/^https?:\/\/(?!localhost).*/, async rt => {
    if (rt.request().url().indexOf('/functions/v1/api') < 0) return rt.abort();
    const b = JSON.parse(rt.request().postData() || '{}');
    const r = await api(b.action, b.data, b.token, { panel: b.panel });
    rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r) });
  });
  if (init) await pg.addInitScript(init, arg);
  return pg;
}
const U = 'http://localhost:' + PORT + '/';

// 1) Registro: la pregunta aparece solo con Repuestos
let pg = await pagina(() => { localStorage.setItem('gnvm@/|modo', 'real'); });
await pg.goto(U + '?registro'); await pg.waitForTimeout(2500);
const hayReg = await pg.locator('#r-giro').count();
if (!hayReg) { const b = pg.locator('[data-a="irRegistro"], [data-a="crearCuenta"], button:has-text("Crear mi cuenta")').first(); await b.click().catch(() => {}); await pg.waitForTimeout(1200); }
ok('registro: formulario visible', await pg.locator('#r-giro').count() === 1);
ok('registro: pregunta oculta con otro giro', await pg.locator('#r-taller').isHidden().catch(() => false));
await pg.evaluate(() => { const s = document.getElementById('r-giro'); s.value = 'repuestos'; s.dispatchEvent(new Event('change', { bubbles: true })); gselSync(s); });
await pg.waitForTimeout(300);
ok('registro: pregunta visible con Repuestos', await pg.locator('#r-taller').isVisible());
await pg.locator('#r-taller label:has-text("No, solo vendo")').click();
await pg.locator('#r-giro').evaluate(e => e.closest('label').scrollIntoView({ block: 'start' }));
await pg.waitForTimeout(300);
await pg.screenshot({ path: OUT + '/1-registro.png' });
await pg.context().close();

// 2) App del negocio: menú sin órdenes, Ajustes › Funciones, ficha del repuesto y Vender por vehículo
pg = await pagina(t => { localStorage.setItem('gnvm@/|token', t); localStorage.setItem('gnvm@/|modo', 'real'); localStorage.setItem('gnvm@/|verVisto', '9.9.9'); localStorage.setItem('gnvm@/|guiaVista', '1'); }, tok);
await pg.goto(U); await pg.waitForTimeout(3500); await pg.evaluate(() => cerrarHojas()).catch(() => {});
ok('app: sinOrdenes llegó a la config', await pg.evaluate(() => S.config.sinOrdenes) === 'si');
ok('app: «Órdenes» no está en el menú', await pg.evaluate(() => !modOn('ordenes') && !puedeVer('ordenes')));
await pg.evaluate(() => ir('vender')); await pg.waitForTimeout(1200);
ok('vender: barra «Busca por vehículo»', await pg.locator('#v-veh .rp-bar').count() === 1);
const nTodos = await pg.locator('#v-grid .pc').count();
await pg.locator('#v-veh [data-vb="t"][data-v="carro"]').click().catch(() => {}); await pg.waitForTimeout(200);
await pg.locator('#v-veh select[data-vb="marca"]').selectOption('Toyota'); await pg.waitForTimeout(200);
await pg.locator('#v-veh select[data-vb="modelo"]').selectOption('Corolla'); await pg.waitForTimeout(200);
await pg.locator('#v-veh select[data-vb="anio"]').selectOption('2011'); await pg.waitForTimeout(400);
const nombres = await pg.locator('#v-grid .pc .nm').allTextContents();
ok('vender: con Toyota Corolla 2011 salen pastillas, filtro y bujía', ['Pastillas de freno delanteras', 'Filtro de aceite', 'Bujía iridium (c/u)'].every(n => nombres.includes(n)), nombres);
ok('vender: no sale el amortiguador (Nissan) ni el kit de moto', !nombres.includes('Amortiguador delantero') && !nombres.includes('Kit de arrastre (cadena y piñones)'), nombres);
ok('vender: sale la batería como Universal', nombres.includes('Batería 12 V') && await pg.locator('#v-grid .rp-ok.u').count() >= 1, nombres);
ok('vender: hay menos productos que sin filtro', nombres.length < nTodos, [nombres.length, nTodos]);
await pg.screenshot({ path: OUT + '/3-vender.png' });
// Búsqueda por nº de parte
await pg.locator('#v-veh [data-vb="x"]').click(); await pg.waitForTimeout(200);
await pg.locator('#v-q').fill('428H'); await pg.waitForTimeout(400);
ok('vender: buscar por nº de parte 428H', (await pg.locator('#v-grid .pc .nm').allTextContents()).join() === 'Kit de arrastre (cadena y piñones)', await pg.locator('#v-grid .pc .nm').allTextContents());
await pg.locator('#v-q').fill(''); await pg.waitForTimeout(200);
// Ficha del repuesto
await pg.evaluate(() => formProducto(S.productos.find(p => p.nombre === 'Pastillas de freno delanteras'))); await pg.waitForTimeout(800);
ok('ficha: 3 vehículos', await pg.locator('#pf-vl .rp-vr').count() === 3);
ok('ficha: Es para Carro', (await pg.locator('#pf-vt .chip.on').textContent()).includes('Carro'));
await pg.locator('#pf-rep').scrollIntoViewIfNeeded(); await pg.locator('#pf-rep').evaluate(e => e.scrollIntoView({ block: 'start' })); await pg.waitForTimeout(300);
await pg.screenshot({ path: OUT + '/2-ficha.png' });
// Agregar un vehículo y guardar
await pg.evaluate(() => ACC.pfVehAdd()); await pg.waitForTimeout(200);
const last = pg.locator('#pf-vl .rp-vr').last();
await last.locator('[data-c="1"]').fill('Auris'); await last.locator('[data-c="2"]').fill('2010'); await last.locator('[data-c="3"]').fill('2012');
await pg.evaluate(() => { const b = [...document.querySelectorAll('.hoja button, .sheet button, button')].find(x => /^\s*Guardar/.test(x.textContent) && x.offsetParent); b && b.click(); }); await pg.waitForTimeout(1500);
const pp = (await api('bootstrap', {}, tok)).data.productos.find(p => p.nombre === 'Pastillas de freno delanteras');
ok('ficha: guardó el 4º vehículo (Toyota Auris 2010–2012)', pp && JSON.parse(pp.compat).v.some(x => x[0] === 'Toyota' && x[1] === 'Auris' && x[2] === 2010 && x[3] === 2012), pp && pp.compat);
ok('ficha: conserva nº de parte y para qué sirve', pp && pp.parte === '04465-02220' && /pastillas/.test(pp.descripcion), pp);
await pg.evaluate(() => cerrarHojas()).catch(() => {});
// Ajustes › Funciones
await pg.evaluate(() => ir('ajustes')); await pg.waitForTimeout(1000);
await pg.evaluate(() => { const d = document.querySelector('#aj-modulos'); const s = d && d.closest('details'); if (s) s.open = true; const t = document.querySelector('[data-k="sinOrdenes"]'); t && t.closest('label').scrollIntoView({ block: 'center' }); }); await pg.waitForTimeout(400);
ok('ajustes: interruptor de órdenes apagado', await pg.locator('[data-k="sinOrdenes"]').count() === 1 && !(await pg.locator('[data-k="sinOrdenes"]').isChecked()));
await pg.screenshot({ path: OUT + '/4-ajustes.png' });
await pg.context().close();

// 3) Tienda en línea
pg = await pagina();
await pg.goto(U + '?tienda=' + neg); await pg.waitForTimeout(3000);
ok('tienda: «¿Qué vehículo tienes?»', await pg.locator('#t-veh .rp-bar').count() === 1);
await pg.locator('#t-veh [data-vb="t"][data-v="moto"]').click(); await pg.waitForTimeout(200);
await pg.locator('#t-veh select[data-vb="marca"]').selectOption('Honda'); await pg.waitForTimeout(200);
await pg.locator('#t-veh select[data-vb="modelo"]').selectOption('XR150L'); await pg.waitForTimeout(200);
await pg.locator('#t-veh select[data-vb="anio"]').selectOption('2019'); await pg.waitForTimeout(500);
const tn = await pg.locator('#t-grid .pc .nm').allTextContents();
ok('tienda: Honda XR150L 2019 → kit y zapatas', tn.includes('Kit de arrastre (cadena y piñones)') && tn.includes('Zapatas de freno trasero'), tn);
ok('tienda: sin repuestos de carro', !tn.includes('Pastillas de freno delanteras') && !tn.includes('Batería 12 V'), tn);
ok('tienda: aceite «ambos» como Universal', tn.includes('Aceite 20W-50 (litro)'), tn);
await pg.locator('#t-veh').evaluate(e => e.scrollIntoView({ block: 'start' })); await pg.evaluate(() => scrollBy(0, -70)); await pg.waitForTimeout(400);
await pg.screenshot({ path: OUT + '/5-tienda.png' });
await pg.locator('#t-grid .pc:has-text("Kit de arrastre")').first().click(); await pg.waitForTimeout(900);
ok('tienda: detalle con «Le queda a tu Honda XR150L 2019»', await pg.locator('.rp-si').count() === 1);
await pg.screenshot({ path: OUT + '/6-detalle.png' });
// Recordar vehículo al recargar
await pg.reload(); await pg.waitForTimeout(3000);
ok('tienda: recuerda el vehículo al recargar', (await pg.locator('#t-veh select[data-vb="modelo"]').inputValue()) === 'XR150L');
await pg.context().close();

await br.close(); web.close();
console.log('\nErrores de consola:', errores.length ? errores : 'ninguno');
console.log(`==== ${pas} pasadas · ${fal + errores.length} fallidas ====`);
process.exit(fal || errores.length ? 1 : 0);
