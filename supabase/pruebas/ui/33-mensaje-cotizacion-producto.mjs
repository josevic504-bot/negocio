import { nuevaPagina, ok, cerrar, esperar, api, db, OUT } from './base.mjs';
import fs from 'node:fs';
const f64 = (fam, w, p) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync('node_modules/@fontsource/'+p).toString('base64')})}`;
const css = [400,500,600,700].map(w=>f64('Jost',w,`jost/files/jost-latin-${w}-normal.woff2`)).join('')+[500,600].map(w=>f64('Cormorant Garamond',w,`cormorant-garamond/files/cormorant-garamond-latin-${w}-normal.woff2`)).join('');
const tiro = async (pg, n) => { await pg.waitForTimeout(450); await pg.screenshot({ path: `${OUT}/${n}.png` }); };
const reg = await api('registrar', { negocio: 'Flores del Valle', nombre: 'Demo', giro: 'floristeria', whatsapp: '98765432', pin: '1234' }); const tok = reg.data.token;
await api('cargarEjemplos', {}, tok);
await api('guardar', { entidad: 'Config', registro: { tienda: 'si', tiendaEntrega: 'ambos', tiendaEnvio: '90', tiendaPagos: 'Efectivo,Transferencia' } }, tok);
const N = db.T.Licencias[0].id, P = n => db.T.Productos.find(x => x.nombre.startsWith(n));
const t = await nuevaPagina({}); await t.goto('http://localhost:8765/?tienda=' + N); await t.waitForTimeout(1500); await t.addStyleTag({ content: css });
await t.evaluate(() => document.querySelector('[data-ramo]').click()); await t.waitForTimeout(500);
for (let i = 0; i < 12; i++) await t.evaluate(id => document.querySelector(`[data-rq="${id}"][data-d="1"]`).click(), P('Rosa').id);
await t.fill('#rf-pre', '900'); if (await t.$('#rf-fe')) await t.fill('#rf-fe', '2026-11-14');
await t.fill('#rf-n', 'María López'); await t.fill('#rf-t', '9876-5432');
await t.evaluate(() => [...document.querySelectorAll('.sheet-f button')].pop().click()); await t.waitForTimeout(900);
const id1 = db.T.Pedidos[0].id;
await api('cotizarRamo', { id: id1, precio: 980, nota: '' }, tok);
await t.evaluate(() => misPedidosTienda()); await t.waitForTimeout(700);
ok('Botón preguntar en la cotización', await t.locator('[data-pq]').count() === 1);
await t.evaluate(() => { document.querySelector('#t-mis').scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); }); await tiro(t, '1-tienda-cotizacion-preguntar');
await t.evaluate(() => document.querySelector('[data-pq]').click()); await t.waitForTimeout(600);
await t.fill('#tch-in', '¿Pueden poner las rosas en papel blanco?');
await t.evaluate(() => document.querySelector('#tch-send').click()); await t.waitForTimeout(900);
await t.fill('#tch-in', 'Gracias'); await t.evaluate(() => document.querySelector('#tch-send').click()); await t.waitForTimeout(900);
const ms = db.T.Mensajes.map(m => m.texto);
ok('Mensaje con referencia de la cotización (solo el primero)', /^⟦💐 Cotización de ramo P-00001 · L 980\.00⟧¿Pueden/.test(ms[0]) && ms[1] === 'Gracias', JSON.stringify(ms));
ok('Chat marca la cotización', db.T.Chats[0].producto === 'Cotización P-00001', db.T.Chats[0].producto);
await tiro(t, '2-tienda-chat-cotizacion');
await t.evaluate(() => cerrarHojas()); await t.waitForTimeout(300);
// Producto con varias opciones: botón visible
await t.evaluate(id => tProducto(id), P('Rosa').id); await t.waitForTimeout(500);
ok('Producto: botón Escríbenos', await t.locator('#tp-preg').count() === 1);
await tiro(t, '3-producto-preguntar');
await t.evaluate(() => document.querySelector('#tp-preg').click()); await t.waitForTimeout(600);
await t.fill('#tch-in', '¿Tienen rosas azules?'); await t.evaluate(() => document.querySelector('#tch-send').click()); await t.waitForTimeout(900);
ok('Mensaje con referencia del producto', /^⟦🛍️ Rosa \(unidad\) · L 45\.00⟧¿Tienen/.test(db.T.Mensajes[2].texto), db.T.Mensajes[2].texto);
// Pedido ajeno: no pone referencia
const r = await api('chatEnviar', { negocio: N, clave: db.T.Chats[0].clave, texto: 'x', pedidoId: 'OTRO', ref: true });
ok('Pedido ajeno sin referencia', r.ok && db.T.Mensajes[3].texto === 'x');
// El cliente no puede inventar la etiqueta
await api('chatEnviar', { negocio: N, clave: db.T.Chats[0].clave, texto: '⟦falso⟧hola' }); ok('No se falsifica la etiqueta', db.T.Mensajes[4].texto === 'falsohola', db.T.Mensajes[4].texto);
// App: el negocio ve las etiquetas
const pg = await nuevaPagina({ token: tok }); await pg.goto('http://localhost:8765/'); await esperar(pg, 8000); await pg.waitForTimeout(600); await pg.addStyleTag({ content: css });
await pg.evaluate(id => verChat(id), db.T.Chats[0].id); await pg.waitForTimeout(900);
const tx = await pg.hojaTxt();
ok('App: muestra las referencias', /Cotización de ramo P-00001/.test(tx) && /Rosa \(unidad\) · L 45/.test(tx), tx.slice(0, 300));
await pg.evaluate(() => { const b = document.querySelector('#ch-m'); b.scrollTop = 0; }); await tiro(pg, '4-app-chat');
await cerrar();
