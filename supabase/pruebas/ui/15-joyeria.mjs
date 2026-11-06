import { nuevaPagina, ok, cerrar, esperar, api, db, OUT } from './base.mjs';
import fs from 'node:fs';
const f64 = (fam, w, p) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync('node_modules/@fontsource/'+p).toString('base64')})}`;
const css = [400,500,600,700].map(w=>f64('Jost',w,`jost/files/jost-latin-${w}-normal.woff2`)).join('')+[500,600].map(w=>f64('Cormorant Garamond',w,`cormorant-garamond/files/cormorant-garamond-latin-${w}-normal.woff2`)).join('');
const tiro = async (pg, n) => { await pg.waitForTimeout(400); await pg.screenshot({ path: `${OUT}/${n}.png` }); };
// 1) registro
const r0 = await nuevaPagina({}); await r0.goto('http://localhost:8765/'); await r0.waitForTimeout(1500); await r0.addStyleTag({ content: css });
for (let i = 0; i < 6; i++) { const b = r0.locator('[data-a="introSig"]'); if (await b.count()) { await b.first().click(); await r0.waitForTimeout(300); } }
await r0.tocar('[data-a="introFin"]');
await r0.tocar('[data-a="pickGiro"]'); await r0.waitForTimeout(400);
ok('Joyería en el selector', (await r0.locator('.gpick .r[data-v="joyeria"]').count()) === 1);
await r0.evaluate(() => document.querySelector('.gpick .r[data-v="joyeria"]').scrollIntoView({ block: 'center' })); await tiro(r0, '1-registro');
// negocio de joyería
const reg = await api('registrar', { negocio: 'Joyería Brillante', nombre: 'Demo', giro: 'joyeria', whatsapp: '98765432', pin: '1234' }); const tok = reg.data.token;
const ej = await api('cargarEjemplos', {}, tok); ok('Ejemplos cargados', ej.ok && ej.data.agregados === 12, JSON.stringify(ej).slice(0,200));
const N = db.T.Licencias[0].id, cad = db.T.Productos.find(x => x.nombre === 'Cadena de oro 14k');
ok('Existencia por largo', JSON.parse(cad.variantes)['Largo: 50 cm'].p === 7600 && cad.stock === 3, cad.variantes + ' ' + cad.stock);
// 2) tienda
const t = await nuevaPagina({}); await t.goto('http://localhost:8765/?tienda=' + N); await t.waitForTimeout(2000); await t.addStyleTag({ content: css });
await t.evaluate(() => { const g=document.querySelector('#t-q'); g && g.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); }); await tiro(t, '2-tienda');
await t.evaluate(id => tProducto(id), cad.id); await t.waitForTimeout(500);
await t.evaluate(() => [...document.querySelectorAll('[data-v]')].find(b => b.textContent.includes('50 cm')).click()); await t.waitForTimeout(200);
const no = t.locator('#tp-no'); ok('Campo de grabado', await no.count() === 1); if (await no.count()) await no.fill('Ana & Luis · 14.02.2026');
const tt = (await t.locator('body').innerText()).replace(/\s+/g, ' ');
ok('Precio del largo 50 cm', /7,600\.00/.test(tt), tt.slice(0, 300));
await t.evaluate(() => { const x=document.querySelector('#tp-no'); x && x.scrollIntoView({ block: 'center' }); }); await tiro(t, '3-producto');
// 3) app: reparaciones y cobro
const pg = await nuevaPagina({ token: tok }); await pg.goto('http://localhost:8765/'); await esperar(pg, 8000); await pg.waitForTimeout(800); await pg.addStyleTag({ content: css });
await pg.ir('ordenes').catch(()=>{});
ok('Sin Reparaciones en el menú', !(await pg.evaluate(() => typeof modOn === 'function' && modOn('ordenes'))));
// imagen de la guía: formulario de la cadena
await pg.evaluate(() => { const p = S.productos.find(x => x.nombre === 'Cadena de oro 14k'); formProducto(p); }); await pg.waitForTimeout(700);
const caja = await pg.evaluate(() => { const sh = [...document.querySelectorAll('.sheet')].pop(), b = sh.querySelector('.sheet-b');
  const fld = re => [...sh.querySelectorAll('label.fld, .fld')].find(x => re.test((x.querySelector('span')||x).textContent));
  const n = fld(/^Nombre/), op = [...sh.querySelectorAll('*')].find(x => /Opciones que elige/.test(x.textContent) && x.children.length < 3 && x.closest('.opc-box, .card, fieldset, div'));
  return { n: !!n, op: !!op };
});
console.log('   guia', JSON.stringify(caja));
await pg.screenshot({ path: `${OUT}/form.png`, fullPage: false });
await pg.evaluate(() => cerrarHojas()); await pg.waitForTimeout(300);
await pg.evaluate(() => { const p = S.productos.find(x => x.nombre.startsWith('Argolla')); agregarAlTicket(p, 1, 'Talla: 8'); abrirCobro(); }); await pg.waitForTimeout(600);
const ct = (await pg.locator('.sheet').last().innerText()).replace(/\s+/g, ' ');
ok('Cobro pide código o certificado', /Código o certificado/.test(ct), ct.slice(0, 300));
await pg.evaluate(() => { const x=document.querySelector('.cb-serie'); x && (x.value='CERT-0458 · 4.1 g', x.scrollIntoView({ block: 'center' })); }); await tiro(pg, '5-cobro');
await cerrar(); process.exit(0);
