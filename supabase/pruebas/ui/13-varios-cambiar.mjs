import { nuevaPagina, ok, cerrar, api, db, OUT } from './base.mjs';
import fs from 'node:fs';
const f64 = (fam, w, p) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync('node_modules/@fontsource/'+p).toString('base64')})}`;
const css = [400,500,600,700].map(w=>f64('Jost',w,`jost/files/jost-latin-${w}-normal.woff2`)).join('')+[500,600].map(w=>f64('Cormorant Garamond',w,`cormorant-garamond/files/cormorant-garamond-latin-${w}-normal.woff2`)).join('');
const reg = await api('registrar', { negocio: 'Belleza Demo', nombre: 'Demo', giro: 'catalogo', whatsapp: '98765432', pin: '1234' });
await api('cargarEjemplos', {}, reg.data.token);
const nid = db.T.Licencias[0].id, P = n => db.T.Productos.find(x => x.nombre.startsWith(n)), polvo = P('Polvo'), blusa = P('Blusa'), deli = P('Delineador');
const t = await nuevaPagina({});
await t.goto('http://localhost:8765/?tienda=' + nid); await t.waitForTimeout(2000);
await t.addStyleTag({ content: css }); await t.waitForTimeout(300);
const tiro = async n => { await t.waitForTimeout(350); await t.screenshot({ path: `${OUT}/${n}.png` }); };
const txt = async () => (await t.locator('body').innerText()).replace(/\s+/g,' ');
const v = s => t.evaluate(s => [...document.querySelectorAll('[data-v]')].find(b=>b.textContent.includes(s)).click(), s);
const bot = async (re, ms=450) => { await t.evaluate(s => { const b=[...document.querySelectorAll('.sheet-f button')].filter(b=>new RegExp(s).test(b.textContent)).pop(); b.click(); }, re); await t.waitForTimeout(ms); };
const mas = () => t.evaluate(() => document.querySelector('.prod-h .qty [data-d="1"]').click());
const cart = () => t.evaluate(() => Object.keys(T.cart).map(k => [k.split(SEP)[1]||'', T.cart[k]]));
const abrir = async id => { await t.evaluate(id => tProducto(id), id); await t.waitForTimeout(450); };
// Hora: e
await abrir(polvo.id); await t.evaluate(() => document.querySelector('#tp-esp [data-t="e"]').click()); await v('Claro'); await t.waitForTimeout(100); await bot('Agregar claro|Agregar · Claro|Claro ·');
let c = await cart(); ok('Tocar cuadro Especial no agrega «Hora»', c.length===1 && c[0][0]==='Tono: Claro', JSON.stringify(c));
await t.evaluate(() => { T.cart={}; guardarCarrito(); gridTienda(); });
// varias
await abrir(polvo.id);
ok('Botón elegir otro presente', /Agregar y elegir otro/.test(await txt()));
await v('Claro'); await mas(); await t.waitForTimeout(120); await bot('elegir otro', 700);
ok('Sigue abierta y limpia', /Listo/.test(await t.locator('.sheet-f').last().innerText()) && await t.evaluate(() => !document.querySelector('.tono.on') && document.querySelector('#tp-n').textContent==='1'));
ok('Cuadro Ya llevas', /Ya llevas de este producto 2 · Claro/.test(await txt()));
await v('Oscuro'); await t.waitForTimeout(150); await tiro('1-elegir-otro');
await bot('elegir otro', 700);
await tiro('2-listo');
ok('Sin selección sale Listo', /Listo/.test(await t.locator('.sheet-f').last().innerText()));
await bot('Listo');
c = await cart(); ok('Dos combinaciones en el carrito', c.length===2 && c.find(x=>x[0]==='Tono: Claro')[1]===2 && c.find(x=>x[0]==='Tono: Oscuro')[1]===1, JSON.stringify(c));
// sin opciones
await abrir(deli.id); ok('Sin opciones no sale el botón', !/elegir otro/.test(await t.locator('.sheet-f').last().innerText())); await t.evaluate(() => cerrarHojas()); await t.waitForTimeout(350);
// Tu pedido
await t.evaluate(() => { tCarrito(); }); await t.waitForTimeout(500);
await t.locator('#tc').evaluate(()=>{}); await tiro('3-tu-pedido');
ok('Cada línea con Cambiar', (await t.locator('#tc .tk-cam').count())===2);
await t.evaluate(() => [...document.querySelectorAll('#tc [data-cam]')].find(x=>/Oscuro/.test(x.textContent)).click()); await t.waitForTimeout(500);
ok('Abre con lo elegido', /Cambiando este producto/.test(await txt()) && await t.evaluate(() => /Oscuro/i.test(document.querySelector('.tono.on').textContent)));
await v('Medio'); await mas(); await t.waitForTimeout(150); await tiro('4-cambiar'); await bot('Guardar cambio', 600);
c = await cart(); ok('Cambió tono y cantidad', c.length===2 && c.find(x=>x[0]==='Tono: Medio')[1]===2, JSON.stringify(c));
ok('Vuelve a Tu pedido con precio actualizado', /Tu pedido/.test(await txt()) && /Tono: Medio/.test(await txt()) && /Ahorras/.test(await txt()));
// unir con otra línea igual
await t.evaluate(() => [...document.querySelectorAll('#tc [data-cam]')].find(x=>/Medio/.test(x.textContent)).click()); await t.waitForTimeout(500);
await v('Claro'); await t.waitForTimeout(150); await bot('Guardar cambio', 600);
c = await cart(); ok('Se une a la línea igual', c.length===1 && c[0][1]===4, JSON.stringify(c));
// quitar y cerrar
await t.evaluate(() => document.querySelector('#tc [data-cam]').click()); await t.waitForTimeout(500);
await bot('Quitar', 600); c = await cart(); ok('Quitar vacía el carrito y cierra', c.length===0, JSON.stringify(c));
await cerrar(); process.exit(0);
