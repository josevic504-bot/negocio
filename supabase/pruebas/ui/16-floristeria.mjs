import { nuevaPagina, ok, cerrar, esperar, api, db, OUT } from './base.mjs';
import fs from 'node:fs';
const f64 = (fam, w, p) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync('node_modules/@fontsource/'+p).toString('base64')})}`;
const css = [400,500,600,700].map(w=>f64('Jost',w,`jost/files/jost-latin-${w}-normal.woff2`)).join('')+[500,600].map(w=>f64('Cormorant Garamond',w,`cormorant-garamond/files/cormorant-garamond-latin-${w}-normal.woff2`)).join('');
const tiro = async (pg, n) => { await pg.waitForTimeout(400); await pg.screenshot({ path: `${OUT}/${n}.png` }); };
const reg = await api('registrar', { negocio: 'Flores del Valle', nombre: 'Demo', giro: 'floristeria', whatsapp: '98765432', pin: '1234' }); const tok = reg.data.token;
const ej = await api('cargarEjemplos', {}, tok); ok('Ejemplos', ej.ok && ej.data.agregados === 14, JSON.stringify(ej).slice(0, 160));
await api('guardar', { entidad: 'Config', registro: { tienda: 'si', tiendaEntrega: 'ambos', tiendaEnvio: '90', tiendaPagos: 'Efectivo,Transferencia' } }, tok);
const N = db.T.Licencias[0].id, P = n => db.T.Productos.find(x => x.nombre.startsWith(n));
P('Lirio').precio = 0; // flor sin precio
const t = await nuevaPagina({}); await t.goto('http://localhost:8765/?tienda=' + N); await t.waitForTimeout(2000); await t.addStyleTag({ content: css });
ok('Botón Arma tu ramo', await t.locator('[data-ramo]').count() === 1);
await t.evaluate(() => { document.querySelector('[data-ramo]').scrollIntoView({ block: 'center' }); }); await tiro(t, '1-tienda');
// arreglo definido
await t.evaluate(id => tProducto(id), P('Arreglo de rosas').id); await t.waitForTimeout(400);
const ta = (await t.locator('.sheet').last().innerText()).replace(/\s+/g, ' ');
ok('Arreglo: fecha y tarjeta', /Fecha que prefieres/.test(ta) && /Mensaje para la tarjeta/.test(ta), ta.slice(0, 200));
await t.evaluate(() => cerrarHojas()); await t.waitForTimeout(300);
// arma tu ramo
await t.evaluate(() => document.querySelector('[data-ramo]').click()); await t.waitForTimeout(500);
const mas = async (nom, k) => { for (let i = 0; i < k; i++) await t.evaluate(id => document.querySelector(`[data-rq="${id}"][data-d="1"]`).click(), P(nom).id); };
await mas('Rosa', 12); await mas('Lirio', 3); await mas('Follaje', 1);
await t.evaluate(id => [...document.querySelector(`[data-o="${id}"]`).querySelectorAll('[data-rv]')].find(b => b.dataset.rv === 'Roja').click(), P('Rosa').id);
const tr = (await t.locator('.sheet').last().innerText()).replace(/\s+/g, ' ');
ok('Lirio sin precio y aproximado con +', /Precio a cotizar/.test(tr) && /Aproximado de las flores con precio L 600\.00 \+/.test(tr), tr.slice(0, 400));
await t.fill('#rf-pre', '1000'); await t.fill('#rf-fe', '2026-11-14'); await t.fill('#rf-det', 'Papel kraft con listón rojo'); await t.fill('#rf-msj', 'Feliz aniversario');
await t.fill('#rf-n', 'María López'); await t.fill('#rf-t', '9876-5432');
await t.evaluate(() => document.querySelector('#rf-ent [data-e="domicilio"]').click()); await t.fill('#rf-d', 'Col. Ejemplo, casa 12');
await t.evaluate(() => document.querySelector('.sheet-b').scrollTo(0, 0)); await tiro(t, '2-arma');
await t.evaluate(() => [...document.querySelectorAll('.sheet-f button')].pop().click()); await t.waitForTimeout(900);
const ped = db.T.Pedidos[0];
ok('Solicitud creada por cotizar', ped && ped.estado === 'cotizar' && Number(ped.presupuesto) === 1000 && Number(ped.total) === 0 && /Tarjeta: Feliz aniversario/.test(ped.nota), JSON.stringify(ped).slice(0, 300));
ok('Tus pedidos: esperando precio', /Esperando precio/.test(await t.locator('#t-mis').innerText()));
// app
const pg = await nuevaPagina({ token: tok }); await pg.goto('http://localhost:8765/'); await esperar(pg, 8000); await pg.waitForTimeout(800); await pg.addStyleTag({ content: css });
await pg.ir('pedidos');
const tp = await pg.txt(); ok('App: Por cotizar con presupuesto', /Por cotizar/.test(tp) && /Presupuesto del cliente/.test(tp) && /sin precio/.test(tp), tp.slice(0, 400));
await tiro(pg, '3-por-cotizar');
await pg.evaluate(() => document.querySelector('[data-a="pedAccion"][data-e="cotizar"]').click()); await pg.waitForTimeout(500);
await pg.fill('#cr-p', '980'); await pg.fill('#cr-n', 'El lirio va en botón para que dure más.'); await pg.waitForTimeout(200);
await tiro(pg, '4-poner-precio');
await pg.evaluate(() => [...document.querySelectorAll('.sheet-f button')].filter(b => /Enviar precio/.test(b.textContent)).pop().click()); await pg.waitForTimeout(800);
const p2 = db.T.Pedidos[0], its = JSON.parse(p2.items);
ok('Cotizado: línea del ramo y total', p2.estado === 'cotizado' && Number(p2.total) === 1070 && its.some(i => i.tipo === 'ramo' && i.precio === 980) && its.filter(i => !i.tipo).every(i => i.precio === 0), p2.items);
await pg.evaluate(() => cerrarHojas());
// cliente acepta
await t.evaluate(() => misPedidosTienda()); await t.waitForTimeout(700);
await t.evaluate(() => { document.querySelector('#t-mis').scrollIntoView({ block: 'start' }); window.scrollBy(0, -90); });
ok('Tienda: precio listo con aceptar', /La tienda te propone L 980\.00/.test((await t.locator('#t-mis').innerText()).replace(/\s+/g, ' ')) && /Aceptar · L 1,070\.00/.test((await t.locator('#t-mis').innerText()).replace(/\s+/g, ' ')), (await t.locator('#t-mis').innerText()).replace(/\s+/g, ' ').slice(0, 300));
await tiro(t, '5-acepta');
const e1 = await api('pedidoClienteEditar', { negocio: N, id: p2.id, telefono: '9876-5432', version: 'x', linea: 0, cantidad: 1, opcion: '' });
ok('No se edita un ramo cotizado', !e1.ok, JSON.stringify(e1));
await t.evaluate(() => document.querySelector('[data-rr][data-si="1"]').click()); await t.waitForTimeout(800);
ok('Aceptado: pedido nuevo', db.T.Pedidos[0].estado === 'nuevo' && /Precio aceptado/.test(db.T.Pedidos[0].nota));
// cobrar
await pg.evaluate(() => { S.pedidosL = null; }); await pg.ir('pedidos');
for (const e of ['confirmado', 'listo']) await api('estadoPedido', { id: p2.id, estado: e }, tok);
await pg.evaluate(() => { S.pedidosL = null; }); await pg.ir('pedidos'); await pg.evaluate(() => { S.f.pest = 'listo'; R.pedidos(); }); await pg.waitForTimeout(600);
await pg.evaluate(() => document.querySelector('[data-a="pedAccion"][data-e="cobrar"]').click()); await pg.waitForTimeout(900);
const tk = await pg.evaluate(() => S.ticket.items.map(i => [i.descripcion, i.precio, i.cantidad]));
ok('Cobro: flores en 0, ramo y envío', tk.some(x => x[0] === 'Ramo a tu gusto' && x[1] === 980) && tk.some(x => /Envío/.test(x[0]) && x[1] === 90) && tk.filter(x => /Rosa|Lirio|Follaje/.test(x[0])).every(x => x[1] === 0), JSON.stringify(tk));
await tiro(pg, '6-cobro');
// rechazo del cliente y validaciones
const r2 = await api('pedir', { negocio: N, ramo: true, presupuesto: 500, nombre: 'Ana Pérez', telefono: '3333-4444', entrega: 'recoger', items: [{ id: P('Girasol').id, cantidad: 5 }] });
ok('Segunda solicitud', r2.ok, JSON.stringify(r2));
const mal = await api('pedir', { negocio: N, ramo: true, presupuesto: 500, nombre: 'Ana Pérez', telefono: '3333-4444', entrega: 'recoger', items: [{ id: P('Arreglo de rosas').id, cantidad: 1 }] });
ok('No acepta arreglos en el ramo', !mal.ok, JSON.stringify(mal));
const sinPre = await api('pedir', { negocio: N, ramo: true, nombre: 'Ana Pérez', telefono: '3333-4444', entrega: 'recoger', items: [{ id: P('Girasol').id, cantidad: 5 }] });
ok('Pide presupuesto', !sinPre.ok && /presupuesto/.test(sinPre.error), JSON.stringify(sinPre));
const antes = await api('respuestaRamo', { negocio: N, id: r2.data.id, telefono: '3333-4444', acepta: true });
ok('No acepta antes del precio', !antes.ok, JSON.stringify(antes));
await api('cotizarRamo', { id: r2.data.id, precio: 450 }, tok);
const otro = await api('respuestaRamo', { negocio: N, id: r2.data.id, telefono: '1111-2222', acepta: true });
ok('Otro WhatsApp no responde', !otro.ok);
const viejo = await api('respuestaRamo', { negocio: N, id: r2.data.id, telefono: '3333-4444', acepta: true, precio: 400 });
ok('Precio cambiado se avisa', !viejo.ok && /cambió el precio/.test(viejo.error), JSON.stringify(viejo));
const no = await api('respuestaRamo', { negocio: N, id: r2.data.id, telefono: '3333-4444', acepta: false, precio: 450 });
ok('Rechazo del cliente cancela', no.ok && db.T.Pedidos.find(x => x.id === r2.data.id).estado === 'cancelado');
// imagen de la guía
await pg.evaluate(() => cerrarHojas()); await pg.setViewportSize({ width: 390, height: 4400 });
await pg.evaluate(() => { const p = S.productos.find(x => x.nombre.startsWith('Arreglo de rosas')); formProducto(p); }); await pg.waitForTimeout(900);
const r = await pg.evaluate(() => { const sh = [...document.querySelectorAll('.sheet')].pop(); sh.style.maxHeight = 'none'; const b = sh.querySelector('.sheet-b'); b.style.maxHeight = 'none'; b.style.overflow = 'visible';
  const md = [...sh.querySelectorAll('summary, button, [data-a]')].find(x => /Más detalles/.test(x.textContent) && x.textContent.length < 80); if (md) md.click();
  const vb = sh.querySelector('#pf-varbox'); const tg = vb && vb.querySelector('input[type=checkbox]'); if (tg && !tg.checked) tg.click();
  const R = e => { if (!e) return null; const q = e.getBoundingClientRect(); return [q.left, q.top, q.width, q.height]; };
  const fld = re => [...sh.querySelectorAll('label.fld')].find(x => re.test((x.querySelector('span') || x).textContent));
  return { n: R(fld(/^Nombre/)), o: R([...sh.querySelectorAll('.precio-box')].find(x => /Opciones que elige/.test(x.querySelector('h4').textContent))), v: R(sh.querySelector('#pf-varbox')) }; });
await pg.waitForTimeout(300); await pg.screenshot({ path: `${OUT}/guia-full.png` }); fs.writeFileSync(`${OUT}/guia.json`, JSON.stringify(r));
await cerrar(); process.exit(0);
