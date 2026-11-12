// 1.9.67 · Tienda del restaurante: comer aquí (QR / número de mesa), para llevar y a domicilio → Mesas y Cocina → «¡Listo!» al cliente
import { nuevaPagina, ok, cerrar, esperar, api, db } from './base.mjs';
import { paso, texto, tiene, btn } from './lib.mjs';
const r = await api('registrar', { negocio: 'Comedor La Ceiba', nombre: 'Vic', giro: 'comida', whatsapp: '98111111', pin: '1234' }); const A = r.data.token;
await api('cargarEjemplos', {}, A);
await api('guardar', { entidad: 'Config', registro: { tienda: 'si', tiempoPrep: '20', mesasZonas: JSON.stringify([{ z: 'Salón', n: 8 }, { z: 'Terraza', n: 4 }]) } }, A);
const nid = db.T.Licencias[0].id, P = db.T.Productos.filter(p => p.negocio_id === nid); const pid = n => P.find(p => p.nombre === n).id;
const tienda = async (q, cli) => { const t = await nuevaPagina({}); if (cli) await t.addInitScript(c => localStorage.setItem('cliente_tienda', JSON.stringify(c)), cli); await t.goto('http://localhost:8765/?tienda=' + nid + q); await t.waitForTimeout(2200); return t; };
/* 1 · Comer aquí con el QR de la mesa 4 */
const t1 = await tienda('&mesa=4');
await paso(t1, 'QR mesa 4: el carrito abre en «Comer aquí» con la mesa fija y sin forma de pago', async () => {
  await t1.evaluate(id => { tAgregar(id, 2); tCarrito(); }, pid('Baleada con todo')); await t1.waitForTimeout(700); await t1.cap('tienda-comer-aqui');
  const t = await t1.hojaTxt(); return /Comer aquí.*Para llevar.*A domicilio/.test(t) && (await t1.locator('#tc-m').inputValue()) === '4' && /Mesa 4 · Salón\. Tu pedido le llega al mesero/.test(t) && !/¿Cómo vas a pagar\?/.test(t) && /Enviar a la cocina/.test(t);
});
await paso(t1, 'QR mesa 4: enviar solo con el nombre (sin WhatsApp)', async () => { await t1.fill('#tc-n', 'Ana'); await btn(t1, /Enviar a la cocina/, 1500); await t1.cap('tienda-mesa-enviado'); const p = db.T.Pedidos.find(x => x.entrega === 'mesa' && x.direccion === '4'); return /Pedido enviado/.test(await texto(t1)) && p && p.direccion === '4' && p.pago === 'En la mesa' && p.telefono === ''; });
await t1.context().close();
/* 1a · Entrada de la tienda: 3 módulos; «Comer aquí» pide la mesa y luego muestra el menú */
const t0 = await tienda('');
await paso(t0, 'Entrada: Comer aquí · Para llevar · A domicilio, sin menú todavía', async () => { await t0.evaluate(() => document.querySelector('#t-cat').scrollIntoView({ block: 'start' })); await t0.waitForTimeout(300); await t0.cap('tienda-entrada'); return (await t0.locator('[data-rmodo]').count()) === 3 && await t0.locator('#t-grid').isHidden(); });
await paso(t0, 'Comer aquí: elegir la mesa 5 y ver el menú con «Comer aquí · Mesa 5»', async () => {
  await t0.tocar('[data-rmodo="mesa"]', 700); await t0.cap('tienda-elegir-mesa-hoja'); await t0.tocar('[data-mesa="5"]', 900); await t0.cap('tienda-menu-mesa');
  return /Comer aquí · Mesa 5/.test(await texto(t0)) && !(await t0.locator('#t-grid').isHidden());
});
await paso(t0, 'Cambiar: vuelve a los 3 módulos', async () => { await t0.tocar('[data-rcambiar]', 700); return (await t0.locator('[data-rmodo]').count()) === 3; });
await t0.context().close();
/* 1b · Comer aquí sin QR: el cliente toca su mesa (la 6 está ocupada y también se puede elegir) */
await api('mesaAccion', { op: 'abrir', mesa: '6', personas: 2 }, A);
const t1b = await tienda('');
await paso(t1b, 'Sin QR: ve las mesas por zona, la 6 ocupada; tocar la 6 y enviar', async () => {
  await t1b.evaluate(id => { tAgregar(id, 1); tCarrito(); }, pid('Café')); await t1b.waitForTimeout(700);
  await t1b.evaluate(() => document.querySelector('#tc-e [data-e="mesa"]').click()); await t1b.waitForTimeout(400);
  const oc = await t1b.locator('.t-m.oc').count(), n = await t1b.locator('.t-m').count();
  await t1b.evaluate(() => document.querySelector('[data-mesa="6"]').click()); await t1b.waitForTimeout(400); await t1b.cap('tienda-elegir-mesa');
  await t1b.fill('#tc-n', 'Luis'); await btn(t1b, /Enviar a la cocina/, 1500);
  return oc === 1 && n === 12 && db.T.Pedidos.some(x => x.entrega === 'mesa' && x.direccion === '6');
});
await t1b.context().close();
/* 2 · Para llevar con WhatsApp */
const t2 = await tienda('', { nombre: 'Juan Pérez', telefono: '9876-5432', direccion: '' });
await paso(t2, 'Para llevar: muestra el tiempo aproximado y pide forma de pago', async () => {
  await t2.evaluate(id => { tAgregar(id, 1); tCarrito(); }, pid('Combo familiar')); await t2.waitForTimeout(700);
  await t2.evaluate(() => document.querySelector('#tc-e [data-e="recoger"]').click()); await t2.waitForTimeout(400); await t2.cap('tienda-para-llevar');
  const t = await t2.hojaTxt(); return /Listo aprox\. en 20 min/.test(t) && /¿Cómo vas a pagar\?/.test(t);
});
await paso(t2, 'Para llevar: enviar el pedido', async () => { await t2.fill('#tc-n', 'Juan Pérez'); await t2.fill('#tc-t', '9876-5432'); await btn(t2, /Enviar pedido/, 1500); return !!db.T.Pedidos.find(x => x.entrega === 'recoger'); });
/* 3 · App: aceptar el pedido de la mesa desde el tablero */
const pg = await nuevaPagina({ token: A });
await pg.route(/qrcode-generator/, rt => rt.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.qrcode=function(){return{addData(){},make(){},createSvgTag(){return "<svg width=10 height=10></svg>"}}}' }));
await pg.goto('http://localhost:8765/#mesas'); await esperar(pg, 8000); await pg.waitForTimeout(1500);
await paso(pg, 'Tablero: la mesa 4 muestra «Pedido» del celular', async () => { await pg.cap('tablero-pedido-celular'); return (await pg.locator('.ms-t[data-m="4"] .pend.cel').count()) === 1; });
await paso(pg, 'Mesa 4: aceptar y mandar a cocina → cuenta con el plato a nombre de Ana', async () => {
  await pg.tocar('.ms-t[data-m="4"]', 900); await pg.cap('aceptar-pedido-mesa'); await pg.tocar('[data-psi]', 1500);
  const c = await pg.evaluate(() => S.mesasD.cuentas.find(x => x.mesa === '4')); const k = db.T.Comandas.find(x => x.mesa === '4');
  return c && c.items[0].quien === 'Ana' && c.items[0].env === 2 && k && k.pedidoId && db.T.Pedidos.find(x => x.entrega === 'mesa' && x.direccion === '4').estado === 'confirmado';
});
/* 4 · Pedidos: confirmar el de llevar lo manda a Mesas y Cocina */
await paso(pg, 'Pedidos: «Confirmar y mandar a cocina» crea «Llevar 1 · Juan Pérez»', async () => {
  await pg.evaluate(() => cerrarHojas()); await pg.ir('pedidos'); await pg.waitForTimeout(900);
  const idJ = db.T.Pedidos.find(x => x.entrega === 'recoger').id; await pg.tocar(`[data-a="pedAccion"][data-id="${idJ}"][data-e="confirmado"]`, 1500); await pg.cap('pedidos-ver-en-mesas');
  const c = db.T.MesaCuentas.find(x => x.tipo === 'llevar'); console.log('     llevar:', JSON.stringify(c && { cliente: c.cliente, pedidoId: c.pedidoId, estado: c.estado }), 'ver:', await tiene(pg, /Ver en Mesas/)); await pg.waitForTimeout(800); const pl = await pg.evaluate(() => (S.pedidosL || []).find(p => p.nombre === 'Juan Pérez')); return c && c.cliente === 'Juan Pérez' && c.pedidoId && pl && pl.cuentaId === c.id;
});
/* 5 · Cocina lo marca listo → el cliente ve «¡Listo para recoger!» */
await paso(pg, 'Cocina: Listo en el de llevar → el pedido queda «listo»', async () => {
  await pg.ir('cocina'); await pg.waitForTimeout(900); await pg.cap('cocina-con-tienda');
  const id = db.T.Comandas.find(x => x.tipo === 'llevar').id;
  await pg.tocar(`[data-id="${id}"][data-e="preparando"]`, 800); await pg.tocar(`[data-id="${id}"][data-e="lista"]`, 900);
  return db.T.Pedidos.find(x => x.entrega === 'recoger').estado === 'listo';
});
await paso(t2, 'Tienda del cliente: «¡Listo para recoger!»', async () => { await t2.evaluate(() => misPedidosTienda()); await t2.waitForTimeout(1200); await t2.evaluate(() => document.querySelector('#t-mis') && document.querySelector('#t-mis').scrollIntoView({ block: 'center' })); await t2.cap('tienda-listo'); return /Listo para recoger/.test(await texto(t2)); });
/* 6 · Cobrar el de llevar desde Mesas → entregado */
await paso(pg, 'Cobrar «Llevar 1»: el pedido en línea queda entregado y la venta ligada', async () => {
  await pg.ir('mesas'); await pg.waitForTimeout(900); await pg.tocar('.ms-t.ms-ll', 900); await btn(pg, /^Cobrar L/, 1200); await btn(pg, /^Cobrar L/, 2200); await pg.evaluate(() => cerrarHojas()); await pg.waitForTimeout(800);
  const p = db.T.Pedidos.find(x => x.entrega === 'recoger'); return p.estado === 'entregado' && p.ventaId && db.T.Ventas.find(v => v.id === p.ventaId).servicio === 'llevar';
});
await paso(pg, 'No se cobra dos veces: cobrar el pedido de la mesa desde Vender se rechaza', async () => { const p = db.T.Pedidos.find(x => x.entrega === 'mesa' && x.direccion === '4'); const v = await api('venta', { pedidoId: p.id, items: [{ productoId: pid('Baleada con todo'), cantidad: 2 }], metodo: 'Efectivo' }, A); return !v.ok && /Mesas/.test(v.error); });
await paso(pg, 'Cobrar la mesa 4: el pedido del celular queda entregado', async () => { await pg.tocar('.ms-t[data-m="4"]', 900); await btn(pg, /^Cobrar L/, 1200); await btn(pg, /^Cobrar L/, 2200); await pg.waitForTimeout(600); return db.T.Pedidos.find(x => x.entrega === 'mesa' && x.direccion === '4').estado === 'entregado'; });
/* 7 · Restaurante sin Vender */
await paso(pg, 'Sin Vender: no está en el menú y «ir a Vender» lleva a Mesas', async () => { await pg.evaluate(() => { cerrarHojas(); ir('vender'); }); await pg.waitForTimeout(600); const v = await pg.evaluate(() => S.vista); await pg.accion('mas', 600); const t = await pg.hojaTxt(); await pg.evaluate(() => cerrarHojas()); return v === 'mesas' && !/Vender/.test(t); });
await paso(pg, 'Inicio: el botón grande lleva a Mesas', async () => { await pg.ir('inicio'); await pg.waitForTimeout(900); await pg.cap('inicio-sin-vender'); return (await pg.locator('.qa [data-v="mesas"]').count()) === 1 && (await pg.locator('.qa [data-v="vender"]').count()) === 0; });
/* 8 · Imprimir QR de las mesas */
await paso(pg, 'Mesas › ⚙: «Códigos QR» arma una hoja con un QR por mesa', async () => { await pg.evaluate(() => { cerrarHojas(); window.print = () => {}; }); await pg.ir('mesas'); await pg.waitForTimeout(800); await pg.accion('mesasConfig', 700); await pg.accion('mesasQR', 1500); const n = await pg.locator('#print-area .qr-m svg').count(); const u = await pg.evaluate(() => linkTienda()); return n === 12 && /tienda=/.test(u); });
await cerrar();
