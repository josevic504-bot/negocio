import { nuevaPagina, ok, cerrar, esperar, api, db, OUT } from './base.mjs';
import fs from 'node:fs';
const f64 = (fam, w, p) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync('node_modules/@fontsource/'+p).toString('base64')})}`;
const css = [400,500,600,700].map(w=>f64('Jost',w,`jost/files/jost-latin-${w}-normal.woff2`)).join('')+[500,600].map(w=>f64('Cormorant Garamond',w,`cormorant-garamond/files/cormorant-garamond-latin-${w}-normal.woff2`)).join('');
const reg = await api('registrar', { negocio: 'Belleza Demo', nombre: 'Demo', giro: 'catalogo', whatsapp: '98765432', pin: '1234' }); const tok = reg.data.token;
await api('cargarEjemplos', {}, tok);
const nid = db.T.Licencias[0].id, polvo = db.T.Productos.find(x => x.nombre.startsWith('Polvo')), blush = db.T.Productos.find(x => x.nombre.startsWith('Blush'));
const t = await nuevaPagina({});
await t.addInitScript(() => { localStorage.setItem('cliente_tienda', JSON.stringify({ nombre:'María López', telefono:'9876-5432', direccion:'Col. Ejemplo, casa 12' })); });
await t.goto('http://localhost:8765/?tienda=' + nid); await t.waitForTimeout(2000);
await t.addStyleTag({ content: css }); await t.waitForTimeout(300);
const tiro = async n => { await t.waitForTimeout(350); await t.screenshot({ path: `${OUT}/${n}.png` }); };
const txt = async () => (await t.locator('body').innerText()).replace(/\s+/g,' ');
// búsqueda
await t.locator('#t-q').fill('labial'); await t.waitForTimeout(500);
const orden = await t.evaluate(() => { const g=document.querySelector('#t-grid'), s=document.querySelector('#t-secs'); return !g.hidden && !!(g.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING) && !document.querySelector('#t-expl').hidden; });
ok('Búsqueda: resultados antes que categorías', orden);
await t.evaluate(() => { document.querySelector('#t-q').scrollIntoView({block:'start'}); window.scrollBy(0,-20); }); await tiro('5-buscar');
await t.locator('#t-q').fill(''); await t.waitForTimeout(400);
ok('Sin búsqueda: lista oculta y categorías', await t.evaluate(() => document.querySelector('#t-grid').hidden && document.querySelector('#t-expl').hidden));
// producto
await t.evaluate(id => tProducto(id), polvo.id); await t.waitForTimeout(400);
const tono = v => t.evaluate(v => [...document.querySelectorAll('[data-v]')].find(b=>b.textContent.includes(v)).click(), v);
const mas = (k=1) => t.evaluate(k => { for(let i=0;i<k;i++) document.querySelector('.qty [data-d="1"]').click(); }, k);
await tono('Oscuro'); await t.waitForTimeout(150);
ok('Producto: sin descuento con 1', await t.evaluate(() => document.querySelector('#tp-ah').hidden));
await mas(2); await t.waitForTimeout(200);
ok('Producto: descuento con 3', /Descuento por cantidad −L 45\.00/.test(await txt()));
await t.evaluate(()=>document.querySelector('#tp-n').scrollIntoView({block:'center'})); await tiro('2-producto');
await t.evaluate(() => [...document.querySelectorAll('button')].filter(b=>/Agregar/.test(b.textContent)).pop().click()); await t.waitForTimeout(500);
await t.evaluate(id => tProducto(id), blush.id); await t.waitForTimeout(300); await t.evaluate(() => [...document.querySelectorAll('[data-v]')].find(b=>b.textContent.includes('Rosa')).click()); await t.waitForTimeout(150);
await t.evaluate(() => [...document.querySelectorAll('button')].filter(b=>/Agregar/.test(b.textContent)).pop().click()); await t.waitForTimeout(500);
// carrito
await t.evaluate(() => { T.entrega='domicilio'; tCarrito(); }); await t.waitForTimeout(500);
const c = await txt(); ok('Carrito: ahorro y resumen', /Ahorras L 45\.00/.test(c) && /Productos L 690\.00/.test(c) && /Descuento por cantidad −L 45\.00/.test(c), c.slice(0,300));
await tiro('1-tu-pedido');
// enviar
await t.locator('#tc-n').fill('María López'); await t.locator('#tc-t').fill('9876-5432');
if (await t.locator('#tc-d').count()) await t.locator('#tc-d').fill('Col. Ejemplo, casa 12');
await t.evaluate(() => [...document.querySelectorAll('button')].filter(b=>/Enviar pedido/.test(b.textContent)).pop().click()); await t.waitForTimeout(900);
ok('Pedido enviado', /Pedido enviado/.test(await txt()));
await t.evaluate(() => cerrarHojas()); await t.waitForTimeout(800);
await t.evaluate(() => { document.querySelector('#t-mis').scrollIntoView({block:'start'}); window.scrollBy(0,-90); });
ok('Tus pedidos: líneas tocables', (await t.locator('[data-pl]').count()) === 2);
await tiro('3-mis-pedidos');
// editar
await t.evaluate(() => document.querySelector('[data-pl]').click()); await t.waitForTimeout(500);
const e = await txt(); ok('Editar: misma pantalla con lo elegido', /Cambiando tu pedido/.test(e) && /Guardar cambio/.test(e) && await t.evaluate(() => /Oscuro/i.test(document.querySelector('.tono.on').textContent) && document.querySelector('#tp-n').textContent === '3'), e.slice(0,200));
await t.evaluate(()=>document.querySelector('#tp-n').scrollIntoView({block:'center'})); await tiro('4-editar');
await t.evaluate(() => document.querySelector('.qty [data-d="-1"]').click()); await t.waitForTimeout(200);
await t.evaluate(() => [...document.querySelectorAll('button')].filter(b=>/Guardar cambio/.test(b.textContent)).pop().click()); await t.waitForTimeout(900);
const f = db.T.Pedidos[0], its = JSON.parse(f.items);
ok('Editar: guardó 2 a precio normal', its[0].cantidad === 2 && its[0].precio === polvo.precio, f.items);
// quitar
await t.evaluate(() => document.querySelectorAll('[data-pl]')[1].click()); await t.waitForTimeout(500);
await t.evaluate(() => [...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Quitar').pop().click()); await t.waitForTimeout(500);
await tiro('7-quitar');
await t.evaluate(() => [...document.querySelectorAll('.sheet.chica button')].filter(b=>/Quitar/.test(b.textContent)).pop().click()); await t.waitForTimeout(900);
ok('Quitar: queda una línea', JSON.parse(db.T.Pedidos[0].items).length === 1, db.T.Pedidos[0].items);
// confirmado
await api('estadoPedido', { id: db.T.Pedidos[0].id, estado: 'confirmado' }, tok);
await t.evaluate(() => misPedidosTienda()); await t.waitForTimeout(700);
ok('Confirmado: ya no edita, contacta tienda', (await t.locator('[data-pl]').count()) === 0 && /Escríbele a la tienda/.test(await txt()));
await t.evaluate(() => { document.querySelector('#t-mis').scrollIntoView({block:'start'}); window.scrollBy(0,-90); }); await tiro('6-confirmado');
await cerrar(); process.exit(0);
