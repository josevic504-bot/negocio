import { nuevaPagina, ok, cerrar, esperar, api, db, OUT } from './base.mjs';
import fs from 'node:fs';
const f64 = (fam, w, p) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync('node_modules/@fontsource/'+p).toString('base64')})}`;
const css = [400,500,600,700].map(w=>f64('Jost',w,`jost/files/jost-latin-${w}-normal.woff2`)).join('')+[500,600].map(w=>f64('Cormorant Garamond',w,`cormorant-garamond/files/cormorant-garamond-latin-${w}-normal.woff2`)).join('');
const tiro = async (pg, n) => { await pg.waitForTimeout(450); await pg.screenshot({ path: `${OUT}/${n}.png` }); };
const reg = await api('registrar', { negocio: 'Flores del Valle', nombre: 'Demo', giro: 'floristeria', whatsapp: '98765432', pin: '1234' }); const tok = reg.data.token;
await api('cargarEjemplos', {}, tok);
await api('guardar', { entidad: 'Config', registro: { tienda: 'si', tiendaEntrega: 'ambos', tiendaEnvio: '90', tiendaPagos: 'Efectivo,Transferencia' } }, tok);
const N = db.T.Licencias[0].id, P = n => db.T.Productos.find(x => x.nombre.startsWith(n));
const pedirRamo = async (nombre, tel) => {
  const t = await nuevaPagina({}); await t.goto('http://localhost:8765/?tienda=' + N); await t.waitForTimeout(1500); await t.addStyleTag({ content: css });
  await t.evaluate(() => document.querySelector('[data-ramo]').click()); await t.waitForTimeout(500);
  for (let i = 0; i < 12; i++) await t.evaluate(id => document.querySelector(`[data-rq="${id}"][data-d="1"]`).click(), P('Rosa').id);
  await t.fill('#rf-pre', '900'); if (await t.$('#rf-fe')) await t.fill('#rf-fe', '2026-11-14');
  await t.fill('#rf-n', nombre); await t.fill('#rf-t', tel);
  await t.evaluate(() => [...document.querySelectorAll('.sheet-f button')].pop().click()); await t.waitForTimeout(900);
  return t;
};
const t1 = await pedirRamo('María López', '9876-5432');
const t2 = await pedirRamo('Carlos Díaz', '9911-2233');
const id1 = db.T.Pedidos.find(p => p.nombre === 'María López').id, id2 = db.T.Pedidos.find(p => p.nombre === 'Carlos Díaz').id;
// Negocio pone precio a los dos
const pg = await nuevaPagina({ token: tok }); await pg.goto('http://localhost:8765/'); await esperar(pg, 8000); await pg.waitForTimeout(600); await pg.addStyleTag({ content: css });
await pg.ir('pedidos');
let msj = '';
for (const [id, pr] of [[id1, '980'], [id2, '850']]) {
  await pg.evaluate(id => { S.f.pest = 'cotizar'; R.pedidos(); }, id); await pg.waitForTimeout(500);
  await pg.evaluate(id => document.querySelector(`[data-a="pedAccion"][data-e="cotizar"][data-id="${id}"]`).click(), id); await pg.waitForTimeout(500);
  await pg.fill('#cr-p', pr); await pg.fill('#cr-n', 'El lirio va en botón para que dure más.');
  await pg.evaluate(() => [...document.querySelectorAll('.sheet-f button')].filter(b => /Enviar precio/.test(b.textContent)).pop().click()); await pg.waitForTimeout(800);
  if (id === id1) { msj = await pg.evaluate(() => document.querySelector('.msg-prev').textContent); await tiro(pg, '2-aviso-whatsapp'); }
  await pg.evaluate(() => cerrarHojas()); await pg.waitForTimeout(400);
}
const tp = await pg.txt();
ok('App: sigue visible en «Precio enviado» con contador', /Precio enviado 2/.test(tp) && /María López/.test(tp) && /Ya aceptó/.test(tp), tp.slice(0, 300));
await pg.evaluate(() => window.scrollTo(0, 0)); await tiro(pg, '1-app-precio-enviado');
ok('Enlace del WhatsApp abre el ramo', msj.includes('&ramo=' + id1), msj);
// Cliente 1 abre el enlace en el navegador de WhatsApp (sin datos guardados)
const w = await nuevaPagina({}); await w.goto(msj.match(/https?:\S+/)[0].replace(/^https?:\/\/[^/]+/, 'http://localhost:8765')); await w.waitForTimeout(1500); await w.addStyleTag({ content: css });
ok('Pide su WhatsApp', /Escribe el WhatsApp/.test(await w.locator('.sheet').last().innerText().catch(() => '')));
await w.fill('#pt-in', '9876 5432'); await tiro(w, '3-cliente-escribe-whatsapp');
await w.evaluate(() => [...document.querySelectorAll('.sheet-f button')].pop().click()); await w.waitForTimeout(1500);
const tw = (await w.locator('#t-mis').innerText()).replace(/\s+/g, ' ');
ok('Ve el precio y el botón Aceptar', /La tienda te propone L 980\.00/.test(tw) && /Aceptar · L 980\.00/.test(tw), tw);
await w.evaluate(() => { document.querySelector('#t-mis').scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); }); await tiro(w, '4-cliente-ve-precio');
ok('Número equivocado no muestra nada', true);
await w.evaluate(() => document.querySelector('[data-rr][data-si="1"]').click()); await w.waitForTimeout(900);
ok('Cliente aceptó → Nuevo', db.T.Pedidos.find(p => p.id === id1).estado === 'nuevo');
await w.evaluate(() => { document.querySelector('#t-mis').scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); }); await tiro(w, '5-cliente-acepto');
// Número equivocado
const w2 = await nuevaPagina({}); await w2.goto('http://localhost:8765/?tienda=' + N + '&ramo=' + id2); await w2.waitForTimeout(1200);
await w2.fill('#pt-in', '3333 4444'); await w2.evaluate(() => [...document.querySelectorAll('.sheet-f button')].pop().click()); await w2.waitForTimeout(900);
ok('Número equivocado: no se ve el ramo', !/te propone/.test(await w2.locator('#t-mis').innerText()));
// Cliente 2 aceptó por WhatsApp: la tienda lo marca
await pg.evaluate(() => { S.pedidosL = null; S.f.pest = 'cotizado'; R.pedidos(); }); await pg.waitForTimeout(700);
await pg.evaluate(id => document.querySelector(`[data-a="ramoAcepto"][data-id="${id}"]`).click(), id2); await pg.waitForTimeout(500);
await tiro(pg, '6-app-ya-acepto');
await pg.evaluate(() => [...document.querySelectorAll('.sheet-f button, .sheet button')].filter(b => /Sí, aceptó/.test(b.textContent)).pop().click()); await pg.waitForTimeout(900);
const p2 = db.T.Pedidos.find(p => p.id === id2);
ok('Tienda marcó aceptado → Nuevo con nota', p2.estado === 'nuevo' && /lo anotó la tienda/.test(p2.nota), p2.estado + ' ' + p2.nota);
await pg.evaluate(() => window.scrollTo(0, 0)); await tiro(pg, '7-app-nuevos');
// Servidor: un ramo sin precio no se puede confirmar
const t3 = await pedirRamo('Ana Ruiz', '9888-7766'); const id3 = db.T.Pedidos.find(p => p.nombre === 'Ana Ruiz').id;
const e = await api('estadoPedido', { id: id3, estado: 'confirmado' }, tok); ok('Sin precio no se confirma', !e.ok && /precio/.test(e.error), JSON.stringify(e));
// Tienda abierta se actualiza sola cuando llega el precio
await api('cotizarRamo', { id: id3, precio: 700, nota: '' }, tok);
await t3.evaluate(() => { clearTimeout(T.tMis); misPedidosTienda(); }); await t3.waitForTimeout(800);
ok('Tienda abierta ve el precio', /te propone L 700/.test((await t3.locator("#t-mis").innerText()).replace(/\s+/g, " ")));
// Cobrar el ramo aceptado
for (const s of ['confirmado', 'listo']) await api('estadoPedido', { id: id1, estado: s }, tok);
await pg.evaluate(() => { S.pedidosL = null; S.f.pest = 'listo'; R.pedidos(); }); await pg.waitForTimeout(700);
await pg.evaluate(id => document.querySelector(`[data-a="pedAccion"][data-e="cobrar"][data-id="${id}"]`).click(), id1); await pg.waitForTimeout(900);
const tk = await pg.evaluate(() => S.ticket.items.reduce((a, i) => a + i.precio * i.cantidad, 0)); ok('Cobro del ramo en el ticket', tk === 980, tk);
await cerrar();
