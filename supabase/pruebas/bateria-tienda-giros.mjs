// Batería: tienda en línea, pedidos, chats y módulos por giro (servidor simulado con base de datos en memoria)
// Ejecutar: cd supabase/pruebas && node bateria-tienda-giros.mjs
import { api, db } from './prueba.mjs';

let pasadas = 0, fallidas = 0; const fallos = [];
const ok = (nombre, cond, detalle) => { if (cond) { pasadas++; console.log('✓ ' + nombre); } else { fallidas++; fallos.push(nombre); console.log('✗ ' + nombre + (detalle !== undefined ? ' → ' + (typeof detalle === 'string' ? detalle : JSON.stringify(detalle)).slice(0, 300) : '')); } return !!cond; };
const bien = (nombre, r) => ok(nombre, r.ok, r.error);                  // debía funcionar
const mal = (nombre, r, re) => ok(nombre, !r.ok && (!re || re.test(String(r.error))), r.ok ? 'ACEPTADO: ' + JSON.stringify(r.data).slice(0, 120) : 'otro error: ' + r.error); // debía fallar
const sec = t => console.log('\n── ' + t + ' ──');
// Fechas en la zona del programa (America/Tegucigalpa), igual que hoy_() del servidor
const fmtTGU = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Tegucigalpa', year: 'numeric', month: '2-digit', day: '2-digit' });
const dias = n => fmtTGU.format(new Date(Date.now() + n * 86400000));
const hoy = () => dias(0);
const FIRMA = 'data:image/png;base64,' + 'A'.repeat(400);
const FOTO = 'data:image/jpeg;base64,' + 'B'.repeat(200);

// ---------- Panel Molina (para activar licencia, Plus y giros extra) ----------
await db.aplicar({ props: { PANEL_CLAVE: 'clave-panel' } });
const PT = (await api('panelLogin', { clave: 'clave-panel' })).data.token;
const P = (a, d) => api(a, d, undefined, { panel: PT });
const activar = neg => P('panelAccion', { id: neg, accion: 'activar', monto: 1000, metodo: 'Efectivo' });
const plus = neg => P('panelAccion', { id: neg, accion: 'plus', monto: 300, metodo: 'Efectivo' });
const giros = (neg, l) => P('panelAccion', { id: neg, accion: 'giros', giros: l });

let nWa = 31000000;
async function negocio(giro, nombre, op) {
  op = op || {};
  const wa = String(nWa++);
  const r = await api('registrar', { negocio: nombre, nombre: 'Dueño ' + nombre, giro, whatsapp: wa, pin: '1234' });
  if (!r.ok) throw new Error('registrar ' + giro + ': ' + r.error);
  const tok = r.data.token, neg = (await api('bootstrap', {}, tok)).data.negocioId;
  if (op.activar) await activar(neg);
  if (op.plus) await plus(neg);
  if (op.ejemplos !== false) await api('cargarEjemplos', {}, tok);
  if (op.tienda !== false) await api('guardar', { entidad: 'Config', registro: Object.assign({ tienda: 'si' }, op.config || {}) }, tok);
  const prods = (await api('bootstrap', {}, tok)).data.productos;
  return { tok, neg, wa, prods, prod: n => prods.find(p => p.nombre === n) };
}
const stockDe = async (tok, id) => (await api('bootstrap', {}, tok)).data.productos.find(p => p.id === id).stock;
const fila = (t, id) => db.T[t].find(x => x.id === id);

/* =========================================================================
 * 1) tiendaInfo: prueba, Plus, vencida, sin tienda
 * ========================================================================= */
sec('tiendaInfo');
{
  const A = await negocio('tienda', 'Pulpería Prueba');                 // en prueba (Plus incluido)
  let t = await api('tiendaInfo', { negocio: A.neg });
  bien('tienda en prueba abre', t);
  ok('tiendaInfo: 8 productos de ejemplo, gid tienda', t.ok && t.data.productos.length === 8 && t.data.negocio.gid === 'tienda', t.data && t.data.negocio);
  ok('tiendaInfo: producto trae max (stock oculto) y no stock', t.ok && t.data.productos.every(p => p.max !== undefined && p.stock === undefined), t.data && t.data.productos[0]);
  ok('tiendaInfo: refresco trae opciones de sabor', t.ok && /Sabor/.test(t.data.productos.find(p => p.nombre === 'Refresco 2 L').opciones));
  mal('tiendaInfo: enlace inválido', await api('tiendaInfo', { negocio: 'NOEXISTE' }), /no es válido/);
  mal('tiendaInfo: sin negocio', await api('tiendaInfo', {}), /no es válido/);
  // Tienda apagada en ajustes
  await api('guardar', { entidad: 'Config', registro: { tienda: 'no' } }, A.tok);
  mal('tiendaInfo: tienda apagada → TIENDA_CERRADA', await api('tiendaInfo', { negocio: A.neg }), /^TIENDA_CERRADA\|/);
  await api('guardar', { entidad: 'Config', registro: { tienda: 'si', tiendaMostrarStock: 'si' } }, A.tok);
  t = await api('tiendaInfo', { negocio: A.neg });
  ok('tiendaInfo: con tiendaMostrarStock trae stock', t.ok && t.data.productos.every(p => typeof p.stock === 'number'), t.data && t.data.productos[0]);
  // Licencia activa SIN Plus → tienda cerrada; con Plus → abre
  const B = await negocio('tienda', 'Pulpería Activa', { activar: true, tienda: false });
  const g = await api('guardar', { entidad: 'Config', registro: { tienda: 'si' } }, B.tok);
  mal('activa sin Plus: no deja encender la tienda', g, /plan Plus/);
  mal('activa sin Plus: tiendaInfo cerrada', await api('tiendaInfo', { negocio: B.neg }), /TIENDA_CERRADA/);
  await plus(B.neg);
  bien('activa con Plus: enciende la tienda', await api('guardar', { entidad: 'Config', registro: { tienda: 'si' } }, B.tok));
  bien('activa con Plus: tiendaInfo abre', await api('tiendaInfo', { negocio: B.neg }));
  // Prueba vencida
  const C = await negocio('tienda', 'Pulpería Vencida');
  await db.aplicar({ ops: [{ t: 'Licencias', op: 'upd', k: { id: C.neg }, row: { vencePrueba: dias(-2) } }] });
  const tv = await api('tiendaInfo', { negocio: C.neg });
  mal('vencida: tiendaInfo → TIENDA_CERRADA', tv, /TIENDA_CERRADA/);
  ok('vencida: el error dice vencida y trae contacto', !tv.ok && /"vencida":"vencida"/.test(tv.error) && /contacto/.test(tv.error), tv.error);
  mal('vencida: pedir también cerrado', await api('pedir', { negocio: C.neg, nombre: 'Ana López', telefono: '98881111', items: [{ id: C.prods[0].id, cantidad: 1 }] }), /TIENDA_CERRADA/);
  mal('vencida: chatEnviar cerrado', await api('chatEnviar', { negocio: C.neg, nombre: 'Ana López', telefono: '98881111', texto: 'hola' }), /TIENDA_CERRADA/);
  // Negocio pausado por cobro
  const D = await negocio('tienda', 'Pulpería Pausada', { activar: true, plus: true });
  bien('pausada: antes abre', await api('tiendaInfo', { negocio: D.neg }));
  await P('panelAccion', { id: D.neg, accion: 'pausar', motivo: 'prueba' });
  mal('pausada desde el panel: tienda cerrada', await api('tiendaInfo', { negocio: D.neg }), /TIENDA_CERRADA/);
}

/* =========================================================================
 * 2) pedir / misPedidos / pedidos / estadoPedido / editarPedido / anticipo / pago
 * ========================================================================= */
sec('pedir');
const T = await negocio('tienda', 'Pulpería La Bendición', { config: { tiendaPagos: 'Efectivo,Transferencia', tiendaDatosPago: 'BAC 123456', tiendaEnvio: '30', tiendaMinimo: '20' } });
const arroz = T.prod('Arroz 1 lb'), frijol = T.prod('Frijoles rojos 1 lb'), refresco = T.prod('Refresco 2 L'), aceite = T.prod('Aceite 750 ml');
let ped1, ped2, ped3;
{
  // Casos malos de datos
  mal('pedir: sin items', await api('pedir', { negocio: T.neg, nombre: 'Ana López', telefono: '98881111', items: [] }), /vacío/);
  mal('pedir: nombre corto', await api('pedir', { negocio: T.neg, nombre: 'Al', telefono: '98881111', items: [{ id: arroz.id, cantidad: 1 }] }), /nombre/);
  mal('pedir: teléfono corto', await api('pedir', { negocio: T.neg, nombre: 'Ana López', telefono: '1234', items: [{ id: arroz.id, cantidad: 1 }] }), /WhatsApp/);
  mal('pedir: producto inexistente', await api('pedir', { negocio: T.neg, nombre: 'Ana López', telefono: '98881111', items: [{ id: 'RXXX', cantidad: 1 }] }), /ya no está disponible/);
  mal('pedir: cantidad 0', await api('pedir', { negocio: T.neg, nombre: 'Ana López', telefono: '98881111', items: [{ id: arroz.id, cantidad: 0 }] }), /Cantidad no válida/);
  mal('pedir: cantidad mayor a existencia (arroz hay 40, pide 41)', await api('pedir', { negocio: T.neg, nombre: 'Ana López', telefono: '98881111', items: [{ id: arroz.id, cantidad: 41 }] }), /Solo quedan 40/);
  mal('pedir: misma línea repetida suma (25+20 > 40)', await api('pedir', { negocio: T.neg, nombre: 'Ana López', telefono: '98881111', items: [{ id: arroz.id, cantidad: 25 }, { id: arroz.id, cantidad: 20 }] }), /Solo quedan 40/);
  mal('pedir: domicilio sin dirección', await api('pedir', { negocio: T.neg, nombre: 'Ana López', telefono: '98881111', entrega: 'domicilio', items: [{ id: arroz.id, cantidad: 1 }] }), /dirección/);
  mal('pedir: bajo el mínimo (L 20)', await api('pedir', { negocio: T.neg, nombre: 'Ana López', telefono: '98881111', items: [{ id: arroz.id, cantidad: 1 }] }), /mínimo/);
  mal('pedir: producto fuera de tienda', await (async () => { await api('guardar', { entidad: 'Productos', registro: { id: aceite.id, tienda: false } }, T.tok); return api('pedir', { negocio: T.neg, nombre: 'Ana López', telefono: '98881111', items: [{ id: aceite.id, cantidad: 1 }] }); })(), /ya no está disponible/);
  // Pedido bueno: varios productos, recoger, efectivo
  const r1 = await api('pedir', { negocio: T.neg, nombre: 'Ana López', telefono: '9888-1111', entrega: 'recoger', pago: 'Efectivo', items: [{ id: arroz.id, cantidad: 3 }, { id: frijol.id, cantidad: 2 }, { id: refresco.id, cantidad: 1, opcion: 'Sabor: Uva' }], nota: 'Paso a las 5' });
  bien('pedir: 3 productos para recoger', r1); ped1 = r1.data;
  ok('pedir: subtotal 3·18+2·25+55 = 159, envío 0', r1.ok && ped1.subtotal === 159 && ped1.envio === 0 && ped1.total === 159, ped1);
  ok('pedir: la línea con sabor lleva la opción en el nombre', r1.ok && ped1.items[2].nombre === 'Refresco 2 L (Sabor: Uva)', ped1 && ped1.items);
  ok('pedir: numero P-00001 y estado nuevo', r1.ok && ped1.numero === 'P-00001' && fila('Pedidos', ped1.id).estado === 'nuevo', ped1);
  ok('pedir: creó al cliente con teléfono 9888-1111', db.T.Clientes.some(c => c.nombre === 'Ana López' && c.telefono === '9888-1111'), db.T.Clientes.map(c => c.telefono));
  ok('pedir: NO baja la existencia (se descuenta al cobrar)', (await stockDe(T.tok, arroz.id)) === 40);
  // Domicilio + transferencia + comprobante
  const r2 = await api('pedir', { negocio: T.neg, nombre: 'Ana López', telefono: '98881111', entrega: 'domicilio', direccion: 'Col. Centro, casa 12', pago: 'Transferencia', comprobante: FOTO, items: [{ id: arroz.id, cantidad: 2 }] });
  bien('pedir: domicilio con transferencia y comprobante', r2); ped2 = r2.data;
  ok('pedir: envío 30 y total 66; datosPago en la respuesta', r2.ok && ped2.envio === 30 && ped2.total === 66 && ped2.datosPago === 'BAC 123456', ped2);
  ok('pedir: quedó con comprobante y pagoEstado revisar', r2.ok && !!fila('Pedidos', ped2.id).comprobante && fila('Pedidos', ped2.id).pagoEstado === 'revisar', fila('Pedidos', ped2.id));
  ok('pedir: la dirección se copió al cliente que no tenía', db.T.Clientes.find(c => c.nombre === 'Ana López').direccion === 'Col. Centro, casa 12');
  ok('pedir: no duplicó al cliente', db.T.Clientes.filter(c => c.nombre === 'Ana López').length === 1);
  // Pago no permitido cae al primero
  const r3 = await api('pedir', { negocio: T.neg, nombre: 'Luis Mejía', telefono: '50499992222', entrega: 'recoger', pago: 'Tarjeta', items: [{ id: frijol.id, cantidad: 1 }] });
  bien('pedir: otro cliente (teléfono con 504)', r3); ped3 = r3.data;
  ok('pedir: método no permitido cae a Efectivo', r3.ok && ped3.pago === 'Efectivo', ped3);
  ok('pedir: cliente con 504 queda 9999-2222', db.T.Clientes.some(c => c.nombre === 'Luis Mejía' && c.telefono === '9999-2222'), db.T.Clientes.map(c => c.telefono));
  // Solo entrega a domicilio
  await api('guardar', { entidad: 'Config', registro: { tiendaEntrega: 'domicilio' } }, T.tok);
  mal('pedir: negocio solo domicilio rechaza recoger', await api('pedir', { negocio: T.neg, nombre: 'Luis Mejía', telefono: '99992222', entrega: 'recoger', items: [{ id: frijol.id, cantidad: 1 }] }), /solo hace entregas a domicilio/);
  await api('guardar', { entidad: 'Config', registro: { tiendaEntrega: 'recoger' } }, T.tok);
  mal('pedir: negocio solo recoger rechaza domicilio', await api('pedir', { negocio: T.neg, nombre: 'Luis Mejía', telefono: '99992222', entrega: 'domicilio', direccion: 'Barrio X casa 3', items: [{ id: frijol.id, cantidad: 1 }] }), /no hace entregas a domicilio/);
  await api('guardar', { entidad: 'Config', registro: { tiendaEntrega: 'ambos' } }, T.tok);
  // Vender sin stock permite pedir de más
  await api('guardar', { entidad: 'Config', registro: { tiendaSinStock: 'si' } }, T.tok);
  const ti = await api('tiendaInfo', { negocio: T.neg });
  ok('tiendaSinStock: la tienda ya no manda max ni marca agotados', ti.ok && ti.data.productos.every(p => p.max === undefined && !p.agotado), ti.data && ti.data.productos[0]);
  bien('pedir: con tiendaSinStock acepta más que la existencia', await api('pedir', { negocio: T.neg, nombre: 'Luis Mejía', telefono: '99992222', items: [{ id: arroz.id, cantidad: 100 }] }));
  await api('guardar', { entidad: 'Config', registro: { tiendaSinStock: 'no' } }, T.tok);
}

sec('misPedidos / pedidoComprobante');
{
  const m = await api('misPedidos', { negocio: T.neg, telefono: '98881111', ids: [ped1.id, ped2.id, ped3.id] });
  bien('misPedidos', m);
  ok('misPedidos: solo los 2 de Ana (el de Luis no)', m.ok && m.data.length === 2 && m.data.every(p => [ped1.id, ped2.id].indexOf(p.id) >= 0), m.data);
  ok('misPedidos: trae items como cantidad y pagoEstado', m.ok && m.data.find(p => p.id === ped1.id).items === 3 && m.data.find(p => p.id === ped2.id).pagoEstado === 'revisar', m.data);
  const m2 = await api('misPedidos', { negocio: T.neg, telefono: '98881111' });
  ok('misPedidos: sin ids devuelve []', m2.ok && Array.isArray(m2.data) && m2.data.length === 0, m2);
  const m3 = await api('misPedidos', { negocio: T.neg, telefono: '00000000', ids: [ped1.id] });
  ok('misPedidos: otro teléfono no ve nada', m3.ok && m3.data.length === 0, m3);
  // Comprobante
  mal('pedidoComprobante: teléfono de otro', await api('pedidoComprobante', { negocio: T.neg, id: ped1.id, telefono: '99992222', foto: FOTO }), /No encontramos/);
  mal('pedidoComprobante: foto no válida', await api('pedidoComprobante', { negocio: T.neg, id: ped1.id, telefono: '98881111', foto: 'hola' }), /foto o captura/);
  const c1 = await api('pedidoComprobante', { negocio: T.neg, id: ped1.id, telefono: '98881111', foto: FOTO });
  bien('pedidoComprobante: el cliente manda comprobante del pedido 1', c1);
  ok('pedidoComprobante: pagoEstado revisar', c1.ok && c1.data.pagoEstado === 'revisar' && fila('Pedidos', ped1.id).pagoEstado === 'revisar');
  for (let i = 0; i < 4; i++) await api('pedidoComprobante', { negocio: T.neg, id: ped1.id, telefono: '98881111', foto: FOTO });
  mal('pedidoComprobante: el 6.º intento se frena', await api('pedidoComprobante', { negocio: T.neg, id: ped1.id, telefono: '98881111', foto: FOTO }), /varios comprobantes/);
}

sec('pedidos / pendientes / estadoPedido / pedidoPago');
let pedidoCancelado;
{
  const l = await api('pedidos', {}, T.tok);
  bien('pedidos: lista del negocio', l);
  ok('pedidos: 4 pedidos, todos nuevos, items parseados', l.ok && l.data.length === 4 && l.data.every(p => p.estado === 'nuevo' && Array.isArray(p.items)), l.data && l.data.map(p => p.estado));
  ok('pedidos: ordenados del más reciente al más viejo', l.ok && l.data[0].fecha >= l.data[l.data.length - 1].fecha);
  const pe = await api('pendientes', {}, T.tok);
  ok('pendientes: nuevos = 4', pe.ok && pe.data.nuevos === 4, pe.data);
  // estadoPedido
  mal('estadoPedido: pedido inexistente', await api('estadoPedido', { id: 'PXX', estado: 'confirmado' }, T.tok), /no existe/);
  mal('estadoPedido: estado inválido', await api('estadoPedido', { id: ped1.id, estado: 'volando' }, T.tok), /Estado no válido/);
  mal('estadoPedido: entregado solo se pone al cobrar', await api('estadoPedido', { id: ped1.id, estado: 'entregado' }, T.tok), /Estado no válido/);
  const e1 = await api('estadoPedido', { id: ped1.id, estado: 'confirmado' }, T.tok);
  bien('estadoPedido: confirmar', e1); ok('estadoPedido: devuelve confirmado', e1.ok && e1.data.estado === 'confirmado');
  const e2 = await api('estadoPedido', { id: ped1.id, estado: 'listo' }, T.tok);
  ok('estadoPedido: listo', e2.ok && e2.data.estado === 'listo', e2);
  // Cancelar el pedido 3 con motivo: existencias no cambian (nunca bajaron)
  const stAntes = await stockDe(T.tok, frijol.id);
  const e3 = await api('estadoPedido', { id: ped3.id, estado: 'cancelado', motivo: 'El cliente no llegó' }, T.tok);
  bien('estadoPedido: cancelar con motivo', e3); pedidoCancelado = ped3.id;
  ok('estadoPedido: nota con el motivo', e3.ok && /Cancelado: El cliente no llegó/.test(e3.data.nota), e3.data);
  ok('estadoPedido: existencia de frijol igual tras cancelar (' + stAntes + ')', (await stockDe(T.tok, frijol.id)) === stAntes);
  mal('estadoPedido: un cancelado no se vuelve a mover', await api('estadoPedido', { id: ped3.id, estado: 'confirmado' }, T.tok), /ya está cancelado/);
  mal('editarPedido: un cancelado no se edita', await api('editarPedido', { id: ped3.id, cantidades: [1] }, T.tok), /cancelado/);
  mal('anticipoPedido: un cancelado no recibe anticipo', await api('anticipoPedido', { id: ped3.id, monto: 10, metodo: 'Efectivo' }, T.tok), /cancelado/);
  const pe2 = await api('pendientes', {}, T.tok);
  ok('pendientes: nuevos = 2 tras confirmar y cancelar', pe2.ok && pe2.data.nuevos === 2, pe2.data);
  // Cliente no puede volver a mandar comprobante de un cancelado
  mal('pedidoComprobante: pedido cancelado', await api('pedidoComprobante', { negocio: T.neg, id: ped3.id, telefono: '99992222', foto: FOTO }), /cancelado/);
  // pedidoPago (revisión del comprobante del pedido 2: total 66)
  mal('pedidoPago: pedido inexistente', await api('pedidoPago', { id: 'PXX', ok: true }, T.tok), /no existe/);
  const pp0 = await api('pedidoPago', { id: ped2.id, ok: false }, T.tok);
  bien('pedidoPago: rechazar comprobante', pp0); ok('pedidoPago: pagoEstado no', pp0.ok && pp0.data.pagoEstado === 'no' && pp0.data.anticipoPagado === 0, pp0.data);
  const pp = await api('pedidoPago', { id: ped2.id, ok: true }, T.tok);
  bien('pedidoPago: aceptar comprobante', pp);
  ok('pedidoPago: pagoEstado ok y anticipo = total 66', pp.ok && pp.data.pagoEstado === 'ok' && pp.data.anticipoPagado === 66, pp.data);
  ok('pedidoPago: el anticipo entró como abono Transferencia ligado al pedido', db.T.Abonos.some(a => a.ref === ped2.id && a.monto === 66 && a.metodo === 'Transferencia'), db.T.Abonos);
  mal('pedidoPago: ya confirmado no se repite', await api('pedidoPago', { id: ped2.id, ok: true }, T.tok), /ya está confirmado/);
  mal('estadoPedido: no se cancela con anticipo pagado', await api('estadoPedido', { id: ped2.id, estado: 'cancelado' }, T.tok), /anticipo pagado/);
  mal('pedidoComprobante: pago ya confirmado por el negocio', await api('pedidoComprobante', { negocio: T.neg, id: ped2.id, telefono: '98881111', foto: FOTO }), /ya confirmó tu pago/);
  const lp = await api('pedidos', {}, T.tok);
  ok('pedidos: el pedido 2 muestra anticipoPagado 66', lp.ok && lp.data.find(p => p.id === ped2.id).anticipoPagado === 66, lp.data && lp.data.find(p => p.id === ped2.id));
}

sec('editarPedido / anticipoPedido');
{
  mal('editarPedido: cantidades con distinto largo', await api('editarPedido', { id: ped1.id, cantidades: [1, 1] }, T.tok), /cambió mientras/);
  mal('editarPedido: sin cambios', await api('editarPedido', { id: ped1.id, cantidades: [3, 2, 1] }, T.tok), /No cambiaste nada/);
  mal('editarPedido: quitar todo', await api('editarPedido', { id: ped1.id, cantidades: [0, 0, 0] }, T.tok), /mejor cancela/);
  mal('editarPedido: cantidad negativa', await api('editarPedido', { id: ped1.id, cantidades: [-1, 2, 1] }, T.tok), /Cantidad no válida/);
  mal('editarPedido: subir arroz a 41 (hay 40)', await api('editarPedido', { id: ped1.id, cantidades: [41, 2, 1] }, T.tok), /Solo quedan 40/);
  const e1 = await api('editarPedido', { id: ped1.id, cantidades: [1, 2, 0], motivo: 'se acabó la uva' }, T.tok);
  bien('editarPedido: bajar arroz a 1 y quitar el refresco', e1);
  ok('editarPedido: queda 2 líneas, subtotal 18+50 = 68, cambios anotados', e1.ok && e1.data.items.length === 2 && e1.data.subtotal === 68 && e1.data.total === 68 && e1.data.cambios.length === 2, e1.data);
  ok('editarPedido: nota con quién y motivo', e1.ok && /Editado .* por Dueño \(se acabó la uva\)/.test(e1.data.nota), e1.data && e1.data.nota);
  const e2 = await api('editarPedido', { id: ped1.id, cantidades: [10, 2] }, T.tok);
  bien('editarPedido: subir arroz de 1 a 10', e2); ok('editarPedido: subtotal 180+50 = 230', e2.ok && e2.data.subtotal === 230, e2.data);
  // anticipo
  mal('anticipoPedido: monto 0', await api('anticipoPedido', { id: ped1.id, monto: 0, metodo: 'Efectivo' }, T.tok), /monto/);
  mal('anticipoPedido: más que el total (230)', await api('anticipoPedido', { id: ped1.id, monto: 231, metodo: 'Efectivo' }, T.tok), /más que el total/);
  const a1 = await api('anticipoPedido', { id: ped1.id, monto: 100, metodo: 'Efectivo' }, T.tok);
  bien('anticipoPedido: 100 en efectivo', a1); ok('anticipoPedido: anticipoPagado 100', a1.ok && a1.data.anticipoPagado === 100, a1.data);
  mal('editarPedido: no bajar el total por debajo del anticipo (100)', await api('editarPedido', { id: ped1.id, cantidades: [1, 2] }, T.tok), /ya pagó/);
  const a2 = await api('anticipoPedido', { id: ped1.id, monto: 130, metodo: 'Transferencia' }, T.tok);
  ok('anticipoPedido: completa el total (230)', a2.ok && a2.data.anticipoPagado === 230, a2);
  mal('anticipoPedido: ya no cabe más', await api('anticipoPedido', { id: ped1.id, monto: 1, metodo: 'Efectivo' }, T.tok), /más que el total/);
  // Cobrar el pedido 1: venta con pedidoId → entregado, baja existencia y descuenta anticipo
  const st0 = await stockDe(T.tok, arroz.id);
  const v = await api('venta', { pedidoId: ped1.id, items: [{ productoId: arroz.id, cantidad: 10, precio: 18 }, { productoId: frijol.id, cantidad: 2, precio: 25 }], metodo: 'Efectivo', recibido: 0, clave: 'cob-p1' }, T.tok);
  bien('venta: cobrar el pedido 1 (todo pagado con anticipos)', v);
  ok('venta: anticipo 230 aplicado, nada por pagar', v.ok && v.data.venta.anticipo === 230 && v.data.venta.total === 230 && v.data.venta.cambio === 0, v.data && v.data.venta);
  ok('venta: el pedido quedó entregado con ventaId', fila('Pedidos', ped1.id).estado === 'entregado' && fila('Pedidos', ped1.id).ventaId === v.data.venta.id, fila('Pedidos', ped1.id));
  ok('venta: la existencia de arroz bajó 10 (' + st0 + ' → ' + (st0 - 10) + ')', (await stockDe(T.tok, arroz.id)) === st0 - 10);
  mal('editarPedido: un pedido cobrado no se edita', await api('editarPedido', { id: ped1.id, cantidades: [1, 1] }, T.tok), /cobrado/);
  mal('estadoPedido: un entregado no se cambia', await api('estadoPedido', { id: ped1.id, estado: 'confirmado' }, T.tok), /ya está entregado/);
  mal('venta: cobrar dos veces el mismo pedido', await api('venta', { pedidoId: ped1.id, items: [{ productoId: arroz.id, cantidad: 1 }], metodo: 'Efectivo', clave: 'cob-p1b' }, T.tok), /ya se cobró/);
  mal('venta: cobrar un pedido cancelado', await api('venta', { pedidoId: pedidoCancelado, items: [{ productoId: frijol.id, cantidad: 1 }], metodo: 'Efectivo', clave: 'cob-p3' }, T.tok), /cancelado/);
  // Anular la venta devuelve existencia y el pedido vuelve a listo
  const an = await api('anularVenta', { id: v.data.venta.id, motivo: 'prueba' }, T.tok);
  bien('anularVenta: la del pedido 1', an);
  ok('anularVenta: existencia de arroz vuelve a ' + st0, (await stockDe(T.tok, arroz.id)) === st0);
  ok('anularVenta: el pedido vuelve a «listo» sin ventaId', fila('Pedidos', ped1.id).estado === 'listo' && !fila('Pedidos', ped1.id).ventaId, fila('Pedidos', ped1.id));
}

sec('pedir: límites por cliente y por negocio');
{
  const L = await negocio('tienda', 'Pulpería Límites');
  const p = L.prods[0];
  let n = 0;
  for (let i = 0; i < 7; i++) { const r = await api('pedir', { negocio: L.neg, nombre: 'Pedro Pérez', telefono: '97770000', items: [{ id: p.id, cantidad: 1 }] }); if (r.ok) n++; else { ok('pedirLimites_: el pedido ' + (i + 1) + ' del mismo teléfono se frena', i === 6 && /varios pedidos/.test(r.error), r.error); } }
  ok('pedirLimites_: 6 pedidos pasaron', n === 6, n);
  bien('pedirLimites_: otro teléfono sí puede', await api('pedir', { negocio: L.neg, nombre: 'María Soto', telefono: '96660000', items: [{ id: p.id, cantidad: 1 }] }));
  await db.aplicar({ c: [{ k: 'PH_' + L.neg, v: '150', s: 3600 }] });
  mal('pedirLimites_: 150 pedidos por hora en el negocio → se frena', await api('pedir', { negocio: L.neg, nombre: 'Otra Persona', telefono: '95550000', items: [{ id: p.id, cantidad: 1 }] }), /muchos pedidos/);
}

/* =========================================================================
 * 3) Variantes (tono/talla) y precio especial por cantidad (giro catálogo)
 * ========================================================================= */
sec('pedir: variantes y precio por cantidad');
{
  const K = await negocio('catalogo', 'Norey Beauty');
  const primer = K.prod('Primer hidratante'); // precioEsp 200 desde 3
  const ti = await api('tiendaInfo', { negocio: K.neg });
  ok('tiendaInfo catálogo: trae precioEsp/minEsp, sub y puntos', ti.ok && ti.data.productos.find(p => p.id === primer.id).precioEsp === 200 && ti.data.productos.find(p => p.id === primer.id).minEsp === 3 && !!ti.data.productos.find(p => p.id === primer.id).sub, ti.data && ti.data.productos.find(p => p.id === primer.id));
  ok('tiendaInfo catálogo: catalogo=true y ordenCats', ti.ok && ti.data.negocio.catalogo === true && ti.data.negocio.ordenCats.length > 0, ti.data && ti.data.negocio);
  const r1 = await api('pedir', { negocio: K.neg, nombre: 'Carla Ruiz', telefono: '98765432', items: [{ id: primer.id, cantidad: 2 }] });
  ok('pedir: 2 unidades → precio normal 220', r1.ok && r1.data.items[0].precio === 220 && r1.data.subtotal === 440, r1);
  const r2 = await api('pedir', { negocio: K.neg, nombre: 'Carla Ruiz', telefono: '98765432', items: [{ id: primer.id, cantidad: 3 }] });
  ok('pedir: 3 unidades → precio especial 200', r2.ok && r2.data.items[0].precio === 200 && r2.data.subtotal === 600, r2);
  // Producto con existencia por tono y talla
  const co = (await api('guardar', { entidad: 'Productos', registro: { nombre: 'Blusa Luna', categoria: 'Ropa', precio: 300, costo: 150, tipo: 'producto', tienda: true, opciones: 'Talla: S, M, L | Color: Negro#222222, Blanco#f5f5f5',
    variantes: { 'Talla: S, Color: Negro': { s: 2 }, 'Talla: M, Color: Negro': { s: 0 }, 'Talla: M, Color: Blanco': { s: 5, p: 320 }, 'Talla: L, Color: Blanco': { s: 1 } } } }, K.tok)).data;
  ok('guardar: blusa con existencia por talla/color (stock total 8)', co && co.stock === 8, co);
  const ti2 = await api('tiendaInfo', { negocio: K.neg });
  const bl = ti2.ok && ti2.data.productos.find(p => p.id === co.id);
  ok('tiendaInfo: la blusa manda vars con n por combinación y p en la que tiene precio', bl && bl.vars['Talla: M, Color: Blanco'].n === 5 && bl.vars['Talla: M, Color: Blanco'].p === 320 && bl.vars['Talla: M, Color: Negro'].n === 0, bl && bl.vars);
  mal('pedir: blusa sin elegir talla/color', await api('pedir', { negocio: K.neg, nombre: 'Carla Ruiz', telefono: '98765432', items: [{ id: co.id, cantidad: 1 }] }), /Elige talla y color/);
  mal('pedir: blusa con solo la talla', await api('pedir', { negocio: K.neg, nombre: 'Carla Ruiz', telefono: '98765432', items: [{ id: co.id, cantidad: 1, opcion: 'Talla: M' }] }), /Elige talla y color/);
  mal('pedir: combinación agotada (M Negro)', await api('pedir', { negocio: K.neg, nombre: 'Carla Ruiz', telefono: '98765432', items: [{ id: co.id, cantidad: 1, opcion: 'Talla: M, Color: Negro' }] }), /se agotó/);
  mal('pedir: más que la combinación (L Blanco hay 1, pide 2)', await api('pedir', { negocio: K.neg, nombre: 'Carla Ruiz', telefono: '98765432', items: [{ id: co.id, cantidad: 2, opcion: 'Talla: L, Color: Blanco' }] }), /Solo quedan 1/);
  mal('pedir: dos líneas de la misma combinación suman (S Negro 1+2 > 2)', await api('pedir', { negocio: K.neg, nombre: 'Carla Ruiz', telefono: '98765432', items: [{ id: co.id, cantidad: 1, opcion: 'Talla: S, Color: Negro' }, { id: co.id, cantidad: 2, opcion: 'Talla: S, Color: Negro' }] }), /Solo quedan 2/);
  const r3 = await api('pedir', { negocio: K.neg, nombre: 'Carla Ruiz', telefono: '98765432', items: [{ id: co.id, cantidad: 1, opcion: 'Talla: M, Color: Blanco' }, { id: co.id, cantidad: 2, opcion: 'Color: Negro, Talla: S' }] });
  bien('pedir: M Blanco (precio propio 320) + 2 S Negro (300), orden invertido', r3);
  ok('pedir: precios por variante 320 y 300, subtotal 920', r3.ok && r3.data.items[0].precio === 320 && r3.data.items[1].precio === 300 && r3.data.subtotal === 920, r3.data && r3.data.items);
  ok('pedir: el nombre de la línea conserva la opción escrita', r3.ok && r3.data.items[1].nombre === 'Blusa Luna (Color: Negro, Talla: S)', r3.data && r3.data.items);
  // Cobrar ese pedido: baja por combinación
  const vv = await api('venta', { pedidoId: r3.data.id, items: [{ productoId: co.id, descripcion: 'Blusa Luna (Talla: M, Color: Blanco)', cantidad: 1, precio: 320 }, { productoId: co.id, descripcion: 'Blusa Luna (Color: Negro, Talla: S)', cantidad: 2, precio: 300 }], metodo: 'Efectivo', recibido: 1000, clave: 'cob-bl' }, K.tok);
  bien('venta: cobrar el pedido con variantes', vv);
  const V = JSON.parse(fila('Productos', co.id).variantes);
  ok('venta: existencia por combinación bajó (M Blanco 4, S Negro 0, total 5)', V['Talla: M, Color: Blanco'].s === 4 && V['Talla: S, Color: Negro'].s === 0 && fila('Productos', co.id).stock === 5, V);
  // editarPedido con variantes: existencia por combinación
  const r4 = await api('pedir', { negocio: K.neg, nombre: 'Dora Paz', telefono: '98765000', items: [{ id: co.id, cantidad: 1, opcion: 'Talla: L, Color: Blanco' }] });
  const ed = await api('editarPedido', { id: r4.data.id, cantidades: [2] }, K.tok);
  // L Blanco solo hay 1 pero el producto tiene 5 en total: editarPedido_ solo compara con pr.stock (observación)
  console.log('   · editarPedido subir L Blanco a 2 (hay 1 de esa combinación, 5 en total):', ed.ok ? 'ACEPTADO' : ed.error);
  ok('editarPedido+variantes: subir una combinación por encima de su existencia debería frenarse', !ed.ok, ed.ok ? 'aceptó 2 de L Blanco con 1 en existencia' : '');
}

/* =========================================================================
 * 4) Chats (tienda ↔ negocio)
 * ========================================================================= */
sec('chats');
{
  const C = await negocio('tienda', 'Pulpería Chat');
  const p = C.prods[1];
  mal('chatEnviar: sin texto', await api('chatEnviar', { negocio: C.neg, nombre: 'Rosa Núñez', telefono: '98880001', texto: '  ' }), /Escribe tu mensaje/);
  mal('chatEnviar: sin nombre', await api('chatEnviar', { negocio: C.neg, nombre: 'R', telefono: '98880001', texto: 'hola' }), /nombre/);
  mal('chatEnviar: sin teléfono', await api('chatEnviar', { negocio: C.neg, nombre: 'Rosa Núñez', telefono: '', texto: 'hola' }), /WhatsApp/);
  const c1 = await api('chatEnviar', { negocio: C.neg, nombre: 'Rosa Núñez', telefono: '98880001', texto: '¿Tienen leche?', productoId: p.id });
  bien('chatEnviar: primer mensaje con producto', c1);
  ok('chatEnviar: devuelve clave, producto y 1 mensaje', c1.ok && c1.data.clave && c1.data.producto === p.nombre && c1.data.mensajes.length === 1 && c1.data.mensajes[0].de === 'cliente', c1.data);
  const clave = c1.ok && c1.data.clave;
  const c2 = await api('chatEnviar', { negocio: C.neg, clave, texto: 'Y pan?' });
  ok('chatEnviar: segundo mensaje con la clave (sin nombre ni teléfono)', c2.ok && c2.data.mensajes.length === 2, c2);
  const cv = await api('chatVer', { negocio: C.neg, clave });
  ok('chatVer: ve los 2 mensajes y no manda la clave', cv.ok && cv.data.mensajes.length === 2 && cv.data.clave === undefined && !!cv.data.vence, cv.data);
  const cvb = await api('chatVer', { negocio: C.neg, clave: 'inventada' });
  ok('chatVer: clave desconocida → borrado', cvb.ok && cvb.data.borrado === true, cvb);
  // Negocio
  const lc = await api('chats', {}, C.tok);
  ok('chats: 1 conversación con 2 sin leer, sin clave', lc.ok && lc.data.length === 1 && lc.data[0].sinLeer === 2 && lc.data[0].clave === undefined, lc.data);
  const pe = await api('pendientes', {}, C.tok);
  ok('pendientes: mensajes = 1', pe.ok && pe.data.mensajes === 1, pe.data);
  const chatId = lc.data[0].id;
  mal('chat: id inexistente', await api('chat', { id: 'HXX' }, C.tok), /ya no existe/);
  const ch = await api('chat', { id: chatId }, C.tok);
  ok('chat: abre, marca leído y trae producto', ch.ok && ch.data.chat.sinLeer === 0 && ch.data.mensajes.length === 2 && ch.data.producto && ch.data.producto.id === p.id, ch.data);
  mal('chatResponder: sin texto', await api('chatResponder', { id: chatId, texto: '' }, C.tok), /respuesta/);
  const rp = await api('chatResponder', { id: chatId, texto: 'Sí, hay leche y pan 🙂' }, C.tok);
  ok('chatResponder: queda con 3 mensajes, el último del negocio con nombre', rp.ok && rp.data.mensajes.length === 3 && rp.data.mensajes[2].de === 'negocio' && rp.data.mensajes[2].quien === 'Dueño Pulpería Chat', rp.data && rp.data.mensajes);
  const cv2 = await api('chatVer', { negocio: C.neg, clave });
  ok('chatVer: el cliente ve la respuesta', cv2.ok && cv2.data.mensajes.length === 3 && cv2.data.mensajes[2].de === 'negocio');
  // Cajero puede ver y responder, no borrar
  await api('guardarUsuario', { registro: { usuario: '99990001', nombre: 'Cajera', rol: 'cajero', activo: true }, clave: '5555' }, C.tok);
  const tc = (await api('login', { whatsapp: '99990001', pin: '5555', negocioId: C.neg })).data.token;
  bien('chats: cajero ve la lista', await api('chats', {}, tc));
  mal('chatBorrar: cajero no puede', await api('chatBorrar', { id: chatId }, tc), /administrador|permiso/i);
  mal('chatBorrar: id inexistente', await api('chatBorrar', { id: 'HXX' }, C.tok), /ya no existe/);
  bien('chatBorrar: admin borra', await api('chatBorrar', { id: chatId }, C.tok));
  ok('chatBorrar: sin chats ni mensajes', db.T.Chats.filter(c => c.negocio_id === C.neg).length === 0 && db.T.Mensajes.filter(m => m.negocio_id === C.neg).length === 0);
  const cv3 = await api('chatVer', { negocio: C.neg, clave });
  ok('chatVer: tras borrar el cliente ve borrado', cv3.ok && cv3.data.borrado === true);
  // Chat apagado
  await api('guardar', { entidad: 'Config', registro: { tiendaChat: 'no' } }, C.tok);
  mal('chatEnviar: con el chat apagado', await api('chatEnviar', { negocio: C.neg, nombre: 'Rosa Núñez', telefono: '98880001', texto: 'hola' }), /no recibe mensajes/);
  const tinfo = await api('tiendaInfo', { negocio: C.neg });
  ok('tiendaInfo: chat=false', tinfo.ok && tinfo.data.negocio.chat === false);
  await api('guardar', { entidad: 'Config', registro: { tiendaChat: 'si' } }, C.tok);
  // Límites
  await db.aplicar({ c: [{ k: 'CM_' + C.neg + '98880002', v: '40', s: 3600 }] });
  mal('chatLimites_: 40 mensajes del mismo teléfono', await api('chatEnviar', { negocio: C.neg, nombre: 'Juan Pérez', telefono: '98880002', texto: 'hola' }), /muchos mensajes/);
  await db.aplicar({ c: [{ k: 'CN_' + C.neg, v: '400', s: 3600 }] });
  mal('chatLimites_: 400 mensajes al negocio', await api('chatEnviar', { negocio: C.neg, nombre: 'Juan Pérez', telefono: '98880003', texto: 'hola' }), /muchos mensajes/);
  const t600 = 'x'.repeat(700);
  await db.aplicar({ c: [{ k: 'CN_' + C.neg, v: '0', s: 1 }] });
  const cl = await api('chatEnviar', { negocio: C.neg, nombre: 'Juan Pérez', telefono: '98880004', texto: t600 });
  ok('chatEnviar: texto largo se recorta a 600', cl.ok && cl.data.mensajes[0].texto.length === 600, cl);
}

/* =========================================================================
 * 5) Streaming: cuentas, suscripciones, venta de perfil, renovar, vencer
 * ========================================================================= */
sec('streaming');
{
  const S = await negocio('streaming', 'StreamHN');
  const nf = S.prod('Netflix · 1 perfil'), nfc = S.prod('Netflix · cuenta completa'), combo = S.prod('Combo Netflix + Disney+');
  ok('streaming: el ejemplo trae plataforma/entrega', nf.plataforma === 'Netflix' && nf.entrega === 'perfil' && /Netflix:1\|Disney\+:1/.test(combo.incluye), nf);
  const cu = (await api('guardar', { entidad: 'Cuentas', registro: { plataforma: 'Netflix', nombre: 'NF-1', correo: 'nf1@mail.com', clave: 'secreta', perfiles: 2, costo: 290 } }, S.tok));
  bien('guardar Cuentas: cuenta Netflix con 2 perfiles', cu);
  const cuId = cu.data.id || (cu.data.registro && cu.data.registro.id);
  const sc0 = await api('susCuentas', {}, S.tok);
  ok('susCuentas: 1 cuenta, 2 perfiles libres', sc0.ok && sc0.data.length === 1 && sc0.data[0].ocupados === 0 && sc0.data[0].perfilesL.length === 2, sc0.data);
  const cli = (await api('guardar', { entidad: 'Clientes', registro: { nombre: 'Kevin Cruz', telefono: '9777-0001' } }, S.tok)).data;
  const cliId = cli.id || cli.registro.id;
  // Vender un perfil
  mal('venta sus: fecha de vencimiento pasada', await api('venta', { clienteId: cliId, items: [{ productoId: nf.id, cantidad: 1 }], metodo: 'Efectivo', recibido: 200, clave: 's0', sus: [{ idx: 0, meses: 1, vence: dias(-1), asig: [{ plataforma: 'Netflix', cuentaId: cuId, perfil: 1, pin: '1111' }] }] }, S.tok), /ya pasó/);
  const v1 = await api('venta', { clienteId: cliId, items: [{ productoId: nf.id, cantidad: 1 }], metodo: 'Efectivo', recibido: 200, clave: 's1', sus: [{ idx: 0, meses: 1, asig: [{ plataforma: 'Netflix', cuentaId: cuId, perfil: 1, pin: '1111' }] }] }, S.tok);
  bien('venta: Netflix 1 perfil (perfil 1 de NF-1)', v1);
  ok('venta: devuelve accesos con correo/clave/perfil/pin', v1.ok && v1.data.accesos.length === 1 && v1.data.accesos[0].correo === 'nf1@mail.com' && v1.data.accesos[0].perfil === 1 && v1.data.accesos[0].pin === '1111', v1.data && v1.data.accesos);
  const ss = await api('suscripciones', {}, S.tok);
  ok('suscripciones: 1 activa, vence en ~1 mes, con cuenta', ss.ok && ss.data.length === 1 && ss.data[0].estadoR === 'activa' && ss.data[0].dias >= 28 && ss.data[0].dias <= 31 && ss.data[0].cuentaNombre === 'NF-1', ss.data);
  const susId = ss.data[0].id;
  mal('venta: el mismo perfil otra vez → ocupado', await api('venta', { items: [{ productoId: nf.id, cantidad: 1 }], metodo: 'Efectivo', recibido: 200, clave: 's2', sus: [{ idx: 0, meses: 1, asig: [{ plataforma: 'Netflix', cuentaId: cuId, perfil: 1 }] }] }, S.tok), /ya está ocupado por Kevin/);
  mal('venta: cuenta completa cuando ya hay un perfil vendido', await api('venta', { items: [{ productoId: nfc.id, cantidad: 1 }], metodo: 'Efectivo', recibido: 500, clave: 's3', sus: [{ idx: 0, meses: 1, asig: [{ plataforma: 'Netflix', cuentaId: cuId }] }] }, S.tok), /perfiles vendidos por separado/);
  mal('venta: combo con cuenta de otra plataforma', await api('venta', { items: [{ productoId: combo.id, cantidad: 1 }], metodo: 'Efectivo', recibido: 500, clave: 's4', sus: [{ idx: 0, meses: 1, asig: [{ plataforma: 'Netflix', cuentaId: cuId, perfil: 2 }, { plataforma: 'Disney+', cuentaId: cuId, perfil: 2 }] }] }, S.tok), /es de Netflix, no de Disney/);
  ok('venta fallida no dejó suscripciones a medias', db.T.Suscripciones.filter(s => s.negocio_id === S.neg).length === 1);
  const v2 = await api('venta', { items: [{ productoId: nf.id, cantidad: 1 }], metodo: 'Efectivo', recibido: 200, clave: 's5', sus: [{ idx: 0, meses: 3, cliente: 'Sin registro', asig: [{ plataforma: 'Netflix', cuentaId: cuId, perfil: 2 }] }] }, S.tok);
  bien('venta: perfil 2 a cliente sin registrar, 3 meses', v2);
  const sc1 = await api('susCuentas', {}, S.tok);
  ok('susCuentas: cuenta llena (2/2) con clientes', sc1.ok && sc1.data[0].ocupados === 2 && sc1.data[0].perfilesL[0].cliente === 'Kevin Cruz' && sc1.data[0].perfilesL[1].cliente === 'Sin registro', sc1.data);
  mal('venta: perfil 3 de una cuenta de 2 → se recorta a 2 y está ocupado', await api('venta', { items: [{ productoId: nf.id, cantidad: 1 }], metodo: 'Efectivo', recibido: 200, clave: 's6', sus: [{ idx: 0, meses: 1, asig: [{ plataforma: 'Netflix', cuentaId: cuId, perfil: 3 }] }] }, S.tok), /ocupado/);
  // susEstado: nota, pin, vence, cancelar
  mal('susEstado: id inexistente', await api('susEstado', { id: 'SXX', nota: 'x' }, S.tok), /no existe/);
  mal('susEstado: fecha inválida', await api('susEstado', { id: susId, vence: '15/12/2026' }, S.tok), /Fecha no válida/);
  const se = await api('susEstado', { id: susId, nota: 'pagó por adelantado', pin: '9999', vence: dias(-3) }, S.tok);
  bien('susEstado: nota, pin y vencer (fecha pasada)', se);
  const s1 = se.ok && se.data.find(s => s.id === susId);
  ok('susEstado: queda vencida con dias negativos, pin 9999', s1 && s1.estadoR === 'vencida' && s1.dias === -3 && s1.pin === '9999' && s1.nota === 'pagó por adelantado', s1);
  const sc2 = await api('susCuentas', {}, S.tok);
  ok('susCuentas: el perfil 1 se ve vencido (margen de 7 días)', sc2.ok && sc2.data[0].perfilesL[0].estado === 'vencida', sc2.data[0].perfilesL);
  const pe = await api('pendientes', {}, S.tok);
  ok('pendientes: avisos.susVenc = 1', pe.ok && pe.data.avisos && pe.data.avisos.susVenc === 1, pe.data);
  // Renovar: nueva venta con renuevaId en el mismo perfil
  const v3 = await api('venta', { clienteId: cliId, items: [{ productoId: nf.id, cantidad: 1 }], metodo: 'Efectivo', recibido: 200, clave: 's7', sus: [{ idx: 0, meses: 1, renuevaId: susId, asig: [{ plataforma: 'Netflix', cuentaId: cuId, perfil: 1, pin: '9999' }] }] }, S.tok);
  bien('venta: renovar el perfil 1 (renuevaId)', v3);
  const ss2 = await api('suscripciones', {}, S.tok);
  const vieja = ss2.data.find(s => s.id === susId), nueva = ss2.data.find(s => s.renueva === susId);
  ok('renovar: la vieja queda «renovada» y la nueva activa en el perfil 1', vieja && vieja.estado === 'renovada' && nueva && nueva.estadoR === 'activa' && Number(nueva.perfil) === 1, { vieja: vieja && vieja.estado, nueva: nueva && nueva.estadoR });
  // Anular la renovación: la vieja vuelve a estar vigente
  bien('anularVenta: la renovación', await api('anularVenta', { id: v3.data.venta.id, motivo: 'error' }, S.tok));
  const ss3 = await api('suscripciones', {}, S.tok);
  ok('anular renovación: la nueva cancelada y la vieja vuelve a activa (vencida por fecha)', ss3.data.find(s => s.id === nueva.id).estado === 'cancelada' && ss3.data.find(s => s.id === susId).estado === 'activa', ss3.data.map(s => s.estado));
  // Cancelar
  const sc = await api('susEstado', { id: susId, estado: 'cancelada' }, S.tok);
  ok('susEstado: cancelar', sc.ok && sc.data.find(s => s.id === susId).estado === 'cancelada');
  const sc3 = await api('susCuentas', {}, S.tok);
  ok('susCuentas: el perfil 1 queda libre al cancelar', sc3.ok && !sc3.data[0].perfilesL[0].susId, sc3.data[0].perfilesL);
  // Cuenta completa en una cuenta nueva
  const cu2 = (await api('guardar', { entidad: 'Cuentas', registro: { plataforma: 'Netflix', nombre: 'NF-2', correo: 'nf2@mail.com', clave: 'x', perfiles: 4 } }, S.tok)).data;
  const cu2Id = cu2.id || cu2.registro.id;
  const v4 = await api('venta', { items: [{ productoId: nfc.id, cantidad: 1 }], metodo: 'Efectivo', recibido: 500, clave: 's8', sus: [{ idx: 0, meses: 1, cliente: 'Familia Gómez', asig: [{ plataforma: 'Netflix', cuentaId: cu2Id }] }] }, S.tok);
  bien('venta: cuenta completa NF-2', v4);
  const sc4 = await api('susCuentas', {}, S.tok);
  ok('susCuentas: NF-2 se ve «completa»', sc4.ok && sc4.data.find(c => c.id === cu2Id).completa && sc4.data.find(c => c.id === cu2Id).completa.cliente === 'Familia Gómez', sc4.data);
  mal('venta: un perfil de una cuenta vendida completa', await api('venta', { items: [{ productoId: nf.id, cantidad: 1 }], metodo: 'Efectivo', recibido: 200, clave: 's9', sus: [{ idx: 0, meses: 1, asig: [{ plataforma: 'Netflix', cuentaId: cu2Id, perfil: 1 }] }] }, S.tok), /se vendió completa/);
  // Cajero no ve la clave en susCuentas
  await api('guardarUsuario', { registro: { usuario: '99990002', nombre: 'Caja', rol: 'cajero', activo: true }, clave: '5555' }, S.tok);
  const tc = (await api('login', { whatsapp: '99990002', pin: '5555', negocioId: S.neg })).data.token;
  const sc5 = await api('susCuentas', {}, tc);
  ok('susCuentas: el cajero ve la clave tapada', sc5.ok && sc5.data[0].clave === '••••', sc5.data && sc5.data[0].clave);
  const ss5 = await api('suscripciones', {}, tc);
  console.log('   · suscripciones (cajero) manda la clave de la cuenta:', ss5.ok && JSON.stringify(ss5.data[0].clave));
  ok('suscripciones: al cajero no debería mandarle la clave de la cuenta madre (susCuentas sí la tapa)', ss5.ok && ss5.data.every(s => !s.clave || s.clave === '••••'), ss5.data && ss5.data.map(s => s.clave));
}

/* =========================================================================
 * 6) Órdenes de trabajo (repuestos)
 * ========================================================================= */
sec('ordenes');
{
  const R = await negocio('repuestos', 'Taller Molina');
  const aceite = R.prod('Aceite 20W-50 (litro)'), mano = R.prod('Cambio de aceite (mano de obra)');
  mal('ordenGuardar: sin cliente', await api('ordenGuardar', { registro: { equipo: 'Toyota Hilux' } }, R.tok), /nombre del cliente/);
  mal('ordenGuardar: sin equipo', await api('ordenGuardar', { registro: { cliente: 'Mario Ruiz' } }, R.tok), /equipo o vehículo/);
  mal('ordenGuardar: estado inválido', await api('ordenGuardar', { registro: { cliente: 'Mario Ruiz', equipo: 'Hilux', estado: 'roto' } }, R.tok), /Estado no válido/);
  mal('ordenGuardar: cliente inexistente', await api('ordenGuardar', { registro: { clienteId: 'CXX', equipo: 'Hilux' } }, R.tok), /ya no existe/);
  const o1 = await api('ordenGuardar', { registro: { cliente: 'Mario Ruiz', telefono: '9555-0001', equipo: 'Toyota Hilux', placa: 'HAB1234', falla: 'Ruido en el motor', promesa: dias(2), anticipo: 500, presupuesto: 2000 }, metodo: 'Efectivo' }, R.tok);
  bien('ordenGuardar: nueva con anticipo 500', o1);
  const ord = o1.data;
  ok('orden: numero O-00001, estado recibido, promesa', o1.ok && ord.numero === 'O-00001' && ord.estado === 'recibido' && ord.promesa === dias(2), ord);
  ok('orden: el anticipo entró como abono ligado', db.T.Abonos.some(a => a.ref === ord.id && a.monto === 500), db.T.Abonos.filter(a => a.ref === ord.id));
  const ol = await api('ordenes', {}, R.tok);
  ok('ordenes: lista con 1', ol.ok && ol.data.length === 1 && ol.data[0].id === ord.id, ol.data);
  const o2 = await api('ordenGuardar', { registro: { id: ord.id, estado: 'proceso', diagnostico: 'Banda floja', anticipo: 900 } }, R.tok);
  ok('ordenGuardar: pasa a proceso; el anticipo ya cobrado no se cambia (sigue 500)', o2.ok && o2.data.estado === 'proceso' && o2.data.anticipo === 500 && o2.data.diagnostico === 'Banda floja', o2.data);
  mal('ordenGuardar: id inexistente', await api('ordenGuardar', { registro: { id: 'OXX', estado: 'listo' } }, R.tok), /ya no existe/);
  bien('ordenGuardar: listo', await api('ordenGuardar', { registro: { id: ord.id, estado: 'listo' } }, R.tok));
  // Promesa vencida → aviso
  await api('ordenGuardar', { registro: { cliente: 'Ana Díaz', equipo: 'Moto', promesa: dias(-1) } }, R.tok);
  const pe = await api('pendientes', {}, R.tok);
  ok('pendientes: avisos.ordAtras = 1 (promesa vencida)', pe.ok && pe.data.avisos && pe.data.avisos.ordAtras === 1, pe.data && pe.data.avisos);
  // Cobrar: venta ligada a la orden, descuenta anticipo
  const st0 = await stockDe(R.tok, aceite.id);
  const v = await api('venta', { ordenId: ord.id, items: [{ productoId: aceite.id, cantidad: 4, precio: 190 }, { productoId: mano.id, cantidad: 1, precio: 250 }], metodo: 'Efectivo', recibido: 510, clave: 'o1' }, R.tok);
  bien('venta: cobrar la orden (1010 − 500 de anticipo = 510)', v);
  ok('venta: anticipo 500 descontado, cambio 0', v.ok && v.data.venta.anticipo === 500 && v.data.venta.total === 1010 && v.data.venta.cambio === 0, v.data && v.data.venta);
  ok('venta: la orden quedó entregada con ventaId', fila('Ordenes', ord.id).estado === 'entregado' && fila('Ordenes', ord.id).ventaId === v.data.venta.id, fila('Ordenes', ord.id));
  ok('venta: el aceite bajó 4', (await stockDe(R.tok, aceite.id)) === st0 - 4);
  mal('venta: efectivo menor a lo que falta', await api('venta', { items: [{ productoId: aceite.id, cantidad: 1, precio: 190 }], metodo: 'Efectivo', recibido: 100, clave: 'o2' }, R.tok), /menor/);
  // Cajero no puede reabrir una entregada
  await api('guardarUsuario', { registro: { usuario: '99990003', nombre: 'Caja', rol: 'cajero', activo: true }, clave: '5555' }, R.tok);
  const tc = (await api('login', { whatsapp: '99990003', pin: '5555', negocioId: R.neg })).data.token;
  mal('ordenGuardar: cajero no cambia una entregada', await api('ordenGuardar', { registro: { id: ord.id, estado: 'proceso' } }, tc), /ya no se cambia/);
  bien('ordenGuardar: admin sí puede reabrirla', await api('ordenGuardar', { registro: { id: ord.id, estado: 'proceso' } }, R.tok));
  mal('ordenGuardar: agregar anticipo a una orden ya cobrada', await api('ordenGuardar', { registro: { id: (await api('ordenGuardar', { registro: { cliente: 'Z', equipo: 'Z' } }, R.tok)).data.id, anticipo: 0 } }, R.tok).then(async r => { const o = r.data; await api('venta', { ordenId: o.id, items: [{ productoId: mano.id, cantidad: 1 }], metodo: 'Efectivo', clave: 'o3' }, R.tok); return api('ordenGuardar', { registro: { id: o.id, anticipo: 100 }, metodo: 'Efectivo' }, R.tok); }), /ya se cobró/);
}

/* =========================================================================
 * 7) Agenda (belleza) y veterinaria
 * ========================================================================= */
sec('agenda (belleza)');
{
  const B = await negocio('belleza', 'Salón Luna');
  const base = B.prod('Base líquida');
  mal('agendaGuardar: sin cliente', await api('agendaGuardar', { registro: { dia: hoy(), detalle: 'Corte' } }, B.tok), /nombre del cliente/);
  mal('agendaGuardar: sin día', await api('agendaGuardar', { registro: { cliente: 'Lucía Paz', detalle: 'Corte' } }, B.tok), /Elige el día/);
  mal('agendaGuardar: día mal escrito', await api('agendaGuardar', { registro: { cliente: 'Lucía Paz', dia: '12/12/2026', detalle: 'Corte' } }, B.tok), /Elige el día/);
  mal('agendaGuardar: hora mal escrita', await api('agendaGuardar', { registro: { cliente: 'Lucía Paz', dia: hoy(), hora: '9am', detalle: 'Corte' } }, B.tok), /Hora no válida/);
  mal('agendaGuardar: sin detalle', await api('agendaGuardar', { registro: { cliente: 'Lucía Paz', dia: hoy() } }, B.tok), /Escribe el servicio/);
  mal('agendaGuardar: estado inválido', await api('agendaGuardar', { registro: { cliente: 'Lucía Paz', dia: hoy(), detalle: 'Corte', estado: 'volado' } }, B.tok), /Estado no válido/);
  const a1 = await api('agendaGuardar', { registro: { cliente: 'Lucía Paz', telefono: '9444-0001', dia: hoy(), hora: '23:30', detalle: 'Corte y tinte', monto: 450, atiende: 'Mary', anticipo: 100 }, metodo: 'Efectivo' }, B.tok);
  bien('agendaGuardar: cita hoy con anticipo', a1);
  const cita = a1.data;
  ok('cita: tipo cita, pendiente, anticipo abonado', a1.ok && cita.tipo === 'cita' && cita.estado === 'pendiente' && db.T.Abonos.some(a => a.ref === cita.id && a.monto === 100), cita);
  const a2 = await api('agendaGuardar', { registro: { cliente: 'Lucía Paz', dia: dias(1), detalle: 'Pastel', tipo: 'encargo', productoId: base.id } }, B.tok);
  ok('agendaGuardar: encargo con producto toma el precio del producto', a2.ok && a2.data.tipo === 'encargo' && a2.data.monto === base.precio, a2.data);
  const ag = await api('agenda', {}, B.tok);
  ok('agenda: 2 registros ordenados por día/hora', ag.ok && ag.data.length === 2 && ag.data[0].id === cita.id, ag.data);
  const agc = await api('agenda', { tipo: 'cita' }, B.tok);
  ok('agenda: filtro tipo cita → 1', agc.ok && agc.data.length === 1 && agc.data[0].tipo === 'cita');
  const agr = await api('agenda', { desde: dias(10), hasta: dias(20) }, B.tok);
  ok('agenda: fuera del rango pero pendientes siguen saliendo', agr.ok && agr.data.length === 2);
  const pe = await api('pendientes', {}, B.tok);
  ok('pendientes: avisos.citasHoy = 1', pe.ok && pe.data.avisos && pe.data.avisos.citasHoy === 1, pe.data && pe.data.avisos);
  // Cobrar la cita: venta ligada (precio acordado en la cita)
  const v = await api('venta', { agendaId: cita.id, items: [{ descripcion: 'Corte y tinte', cantidad: 1, precio: 450 }], metodo: 'Efectivo', recibido: 350, clave: 'ag1' }, B.tok);
  bien('venta: cobrar la cita (450 − 100 = 350)', v);
  ok('venta: cita atendida con ventaId y anticipo 100', v.ok && v.data.venta.anticipo === 100 && fila('Agenda', cita.id).estado === 'atendido' && fila('Agenda', cita.id).ventaId === v.data.venta.id, fila('Agenda', cita.id));
  const a2b = await api('agendaGuardar', { registro: { id: a2.data.id, anticipo: 50 }, metodo: 'Efectivo' }, B.tok);
  ok('agendaGuardar: agregar anticipo al editar un encargo que no tenía', a2b.ok && a2b.data.anticipo === 50 && db.T.Abonos.some(a => a.ref === a2.data.id && a.monto === 50), a2b.data);
  const a2c = await api('agendaGuardar', { registro: { id: a2.data.id, anticipo: 80 }, metodo: 'Efectivo' }, B.tok);
  ok('agendaGuardar: el anticipo ya cobrado no se cambia (sigue 50)', a2c.ok && a2c.data.anticipo === 50, a2c.data);
  const a3 = (await api('agendaGuardar', { registro: { cliente: 'Lucía Paz', dia: dias(2), detalle: 'Manicure', monto: 200 } }, B.tok)).data;
  await api('venta', { agendaId: a3.id, items: [{ descripcion: 'Manicure', cantidad: 1, precio: 200 }], metodo: 'Efectivo', clave: 'ag2' }, B.tok);
  mal('agendaGuardar: anticipo a una cita ya cobrada', await api('agendaGuardar', { registro: { id: a3.id, anticipo: 50 }, metodo: 'Efectivo' }, B.tok), /Ya se cobró/);
  const can = await api('agendaGuardar', { registro: { id: cita.id, estado: 'cancelado' } }, B.tok);
  ok('agendaGuardar: cancelar', can.ok && can.data.estado === 'cancelado');
}

sec('veterinaria');
{
  const V = await negocio('veterinaria', 'Vet Amigos');
  const vac = V.prods.find(p => /vacuna|Vacuna/i.test(p.nombre)) || V.prods[0];
  // módulo apagado en otro giro
  const X = await negocio('tienda', 'Pulpe sin vet', { ejemplos: false, tienda: false });
  mal('mascotas: giro tienda sin módulo', await api('mascotas', {}, X.tok), /Activa «Mascotas»/);
  mal('mascotaGuardar: sin nombre', await api('mascotaGuardar', { registro: { dueno: 'Pedro Lara' } }, V.tok), /nombre de la mascota/);
  mal('mascotaGuardar: sin dueño', await api('mascotaGuardar', { registro: { nombre: 'Firulais' } }, V.tok), /nombre del dueño/);
  mal('mascotaGuardar: dueño inexistente', await api('mascotaGuardar', { registro: { nombre: 'Firulais', clienteId: 'CXX' } }, V.tok), /ya no existe/);
  const m1 = await api('mascotaGuardar', { registro: { nombre: 'Firulais', especie: 'Perro', raza: 'Criollo', sexo: 'Macho', nacimiento: '2022-05-01', peso: 12.5, dueno: 'Pedro Lara', telefono: '9333-0001' } }, V.tok);
  bien('mascotaGuardar: nueva con dueño nuevo', m1);
  const masc = m1.data.mascota;
  ok('mascota: creó al cliente dueño', m1.ok && m1.data.cliente && m1.data.cliente.nombre === 'Pedro Lara' && masc.clienteId === m1.data.cliente.id, m1.data);
  const m2 = await api('mascotaGuardar', { registro: { nombre: 'Michi', especie: 'Gato', sexo: 'Otro', nacimiento: dias(5), dueno: 'Otro Nombre', telefono: '93330001' } }, V.tok);
  ok('mascotaGuardar: mismo teléfono reutiliza al dueño; sexo y nacimiento inválidos se limpian', m2.ok && m2.data.cliente === null && m2.data.mascota.clienteId === masc.clienteId && m2.data.mascota.sexo === '' && m2.data.mascota.nacimiento === '', m2.data);
  const ml = await api('mascotas', {}, V.tok);
  ok('mascotas: 2 con dueño y teléfono', ml.ok && ml.data.length === 2 && ml.data.every(m => m.dueno === 'Pedro Lara' && m.telefono === '9333-0001'), ml.data);
  // Consulta con receta y vacunas
  mal('consultaGuardar: mascota inexistente', await api('consultaGuardar', { registro: { mascotaId: 'AXX', motivo: 'x' } }, V.tok), /ya no existe/);
  const c1 = await api('consultaGuardar', { registro: { mascotaId: masc.id, tipo: 'consulta', motivo: 'Vómitos', peso: 13, temperatura: 39.2, diagnostico: 'Gastritis', tratamiento: 'Dieta blanda', control: dias(7),
    receta: [{ n: 'Omeprazol 10 mg', dosis: '1 tableta', via: 'Oral', cada: '24 h', dias: 5, lleva: true, cant: 5 }, { n: '', dosis: 'x' }] }, alergias: 'Penicilina', vacunas: [{ tipo: 'vacuna', nombre: 'Séxtuple', proxima: dias(365), lote: 'L-1' }, { tipo: 'desparasitacion', nombre: 'Drontal', proxima: dias(3) }] }, V.tok);
  bien('consultaGuardar: consulta con receta y 2 vacunas', c1);
  ok('consulta: receta con 1 medicamento válido y número R-00001', c1.ok && JSON.parse(c1.data.consulta.receta).length === 1 && c1.data.consulta.numero === 'R-00001' && c1.data.vacunas === 2, c1.data);
  ok('consulta: la mascota quedó con peso 13 y alergias', fila('Mascotas', masc.id).peso === 13 && fila('Mascotas', masc.id).alergias === 'Penicilina', fila('Mascotas', masc.id));
  const c2 = await api('consultaGuardar', { registro: { id: c1.data.consulta.id, diagnostico: 'Gastritis leve', receta: [{ n: 'Omeprazol 10 mg', dosis: '1', dias: 3 }] }, vacunas: [{ nombre: 'NoDebe' }] }, V.tok);
  ok('consultaGuardar: editar conserva el número de receta y no agrega vacunas', c2.ok && c2.data.consulta.numero === 'R-00001' && c2.data.consulta.diagnostico === 'Gastritis leve' && c2.data.vacunas === 0, c2.data);
  const ex = await api('expediente', { id: masc.id }, V.tok);
  bien('expediente', ex);
  ok('expediente: dueño, 1 consulta, 2 vacunas, 2 pendientes (la más próxima primero)', ex.ok && ex.data.dueno.nombre === 'Pedro Lara' && ex.data.consultas.length === 1 && ex.data.vacunas.length === 2 && ex.data.pendientes.length === 2 && ex.data.pendientes[0].nombre === 'Drontal', ex.data);
  mal('expediente: mascota inexistente', await api('expediente', { id: 'AXX' }, V.tok), /ya no existe/);
  const vl = await api('vacunas', {}, V.tok);
  ok('vacunas: 2 pendientes con mascota/dueño, 2 aplicadas', vl.ok && vl.data.pendientes.length === 2 && vl.data.aplicadas.length === 2 && vl.data.pendientes[0].mascota === 'Firulais' && vl.data.pendientes[0].dueno === 'Pedro Lara', vl.data);
  const ml2 = await api('mascotas', {}, V.tok);
  ok('mascotas: Firulais muestra próxima vacuna Drontal y control', ml2.ok && ml2.data.find(m => m.id === masc.id).vacuna.nombre === 'Drontal' && ml2.data.find(m => m.id === masc.id).control === dias(7), ml2.data);
  // vacunaGuardar: carnet previo y edición
  mal('vacunaGuardar: sin nombre', await api('vacunaGuardar', { registro: { mascotaId: masc.id } }, V.tok), /qué vacuna/);
  mal('vacunaGuardar: mascota inexistente', await api('vacunaGuardar', { registro: { mascotaId: 'AXX', nombre: 'Rabia' } }, V.tok), /ya no existe/);
  const vg = await api('vacunaGuardar', { registro: { mascotaId: masc.id, nombre: 'Rabia', fecha: dias(-100), proxima: dias(265) } }, V.tok);
  ok('vacunaGuardar: vacuna previa con fecha pasada', vg.ok && vg.data.fecha === dias(-100) && vg.data.consultaId === '', vg);
  const vg2 = await api('vacunaGuardar', { registro: { mascotaId: masc.id, nombre: 'Futura', fecha: dias(5) } }, V.tok);
  ok('vacunaGuardar: fecha futura cae a hoy', vg2.ok && vg2.data.fecha === hoy(), vg2);
  const om = await api('vacunaGuardar', { registro: { id: vg2.data.id, estado: 'omitida', proxima: dias(30) } }, V.tok);
  ok('vacunaGuardar: editar estado omitida y próxima', om.ok && om.data.estado === 'omitida' && om.data.proxima === dias(30), om);
  const vl2 = await api('vacunas', {}, V.tok);
  ok('vacunas: la omitida no sale en pendientes (3 pendientes: Drontal, Rabia, Séxtuple)', vl2.ok && vl2.data.pendientes.length === 3 && !vl2.data.pendientes.some(v => v.nombre === 'Futura'), vl2.data.pendientes.map(v => v.nombre));
  const av = await api('vacunaGuardar', { registro: { id: vg.data.id, avisado: true } }, V.tok);
  ok('vacunaGuardar: avisado hoy', av.ok && av.data.avisado === hoy());
  // Cobrar la consulta
  const v = await api('venta', { consultaId: c1.data.consulta.id, clienteId: masc.clienteId, items: [{ descripcion: 'Consulta general', cantidad: 1, precio: 300 }], metodo: 'Efectivo', recibido: 300, clave: 'vet1' }, V.tok);
  bien('venta: cobrar la consulta', v);
  ok('venta: la consulta queda con ventaId y total', fila('Consultas', c1.data.consulta.id).ventaId === v.data.venta.id && fila('Consultas', c1.data.consulta.id).total === 300, fila('Consultas', c1.data.consulta.id));
  // Cajero no anula una cobrada
  await api('guardarUsuario', { registro: { usuario: '99990004', nombre: 'Caja', rol: 'cajero', activo: true }, clave: '5555' }, V.tok);
  const tc = (await api('login', { whatsapp: '99990004', pin: '5555', negocioId: V.neg })).data.token;
  mal('consultaGuardar: cajero no quita una consulta cobrada', await api('consultaGuardar', { registro: { id: c1.data.consulta.id, anulada: true } }, tc), /solo el administrador/);
  const anu = await api('consultaGuardar', { registro: { id: c1.data.consulta.id, anulada: true } }, V.tok);
  ok('consultaGuardar: admin la anula y anula sus vacunas', anu.ok && anu.data.consulta.anulada === true && db.T.Vacunas.filter(x => x.consultaId === c1.data.consulta.id).every(x => x.estado === 'anulada'), db.T.Vacunas.filter(x => x.consultaId === c1.data.consulta.id).map(x => x.estado));
  const ex2 = await api('expediente', { id: masc.id }, V.tok);
  ok('expediente: sin consultas, 2 vacunas (las del carnet)', ex2.ok && ex2.data.consultas.length === 0 && ex2.data.vacunas.length === 2, ex2.data);
  // Cita de mascota
  const ac = await api('agendaGuardar', { registro: { mascotaId: masc.id, dia: dias(1), hora: '10:00', detalle: 'Baño' } }, V.tok);
  ok('agendaGuardar: cita de mascota toma al dueño como cliente', ac.ok && ac.data.mascota === 'Firulais' && ac.data.cliente === 'Pedro Lara', ac.data);
  mal('agendaGuardar: mascota inexistente', await api('agendaGuardar', { registro: { mascotaId: 'AXX', dia: dias(1), detalle: 'Baño' } }, V.tok), /mascota ya no existe/);
}

/* =========================================================================
 * 8) Servicios: cotizaciones, plan de pagos, contrato, entregables, acta
 * ========================================================================= */
sec('cotizaciones (servicios)');
{
  const S = await negocio('servicios', 'Servicios Pro');
  const X = await negocio('tienda', 'Pulpe sin cot', { ejemplos: false, tienda: false });
  mal('cotizaciones: giro tienda sin módulo', await api('cotizaciones', {}, X.tok), /Activa «Cotizaciones/);
  mal('cotizacionGuardar: sin cliente', await api('cotizacionGuardar', { registro: { proyecto: 'Web', items: [{ n: 'Diseño', cant: 1, precio: 100 }] } }, S.tok), /nombre del cliente/);
  mal('cotizacionGuardar: sin proyecto', await api('cotizacionGuardar', { registro: { cliente: 'Empresa X', items: [{ n: 'Diseño', cant: 1, precio: 100 }] } }, S.tok), /nombre del proyecto/);
  mal('cotizacionGuardar: sin items válidos', await api('cotizacionGuardar', { registro: { cliente: 'Empresa X', proyecto: 'Web', items: [{ n: '', precio: 5 }] } }, S.tok), /al menos un servicio/);
  const q1 = await api('cotizacionGuardar', { registro: { cliente: 'Empresa X', telefono: '9222-0001', proyecto: 'Sitio web', items: [{ n: 'Diseño', cat: 'Servicios', cant: 1, precio: 6000 }, { n: 'Hosting', cant: 12, precio: 250 }], descuento: 10, isv: 'si', validez: 10, entrega: dias(30), pagos: [{ n: 'Anticipo', f: hoy(), pct: 50 }, { n: 'Entrega', f: dias(30), pct: 50 }] } }, S.tok);
  bien('cotizacionGuardar: nueva con descuento, ISV y plan 50/50', q1);
  const Q = q1.data;
  // subtotal 9000, desc 900, base 8100, isv 15% = 1215, total 9315
  ok('cotización: COT-00001, borrador, subtotal 9000, total 9315', q1.ok && Q.numero === 'COT-00001' && Q.estado === 'borrador' && Q.subtotal === 9000 && Q.total === 9315 && Q.pagos.length === 2, Q);
  const ql = await api('cotizaciones', {}, S.tok);
  ok('cotizaciones: 1 en la lista sin condiciones ni firmas', ql.ok && ql.data.length === 1 && ql.data[0].condiciones === undefined && ql.data[0].contratoFirma === undefined, ql.data);
  mal('cotizacionEstado: estado inválido', await api('cotizacionEstado', { id: Q.id, estado: 'aceptada' }, S.tok), /Estado no válido/);
  mal('cotizacionEstado: id inexistente', await api('cotizacionEstado', { id: 'ZXX', estado: 'enviada' }, S.tok), /ya no existe/);
  const en = await api('cotizacionEstado', { id: Q.id, estado: 'enviada' }, S.tok);
  ok('cotizacionEstado: enviada', en.ok && en.data.estado === 'enviada' && en.data.estadoR === 'enviada');
  // Vencida por validez
  await db.aplicar({ ops: [{ t: 'Cotizaciones', op: 'upd', k: { id: Q.id }, n: S.neg, row: { fecha: dias(-20) } }] });
  const qv = await api('cotizacion', { id: Q.id }, S.tok);
  ok('cotizacion: enviada hace 20 días con validez 10 → estadoR vencida', qv.ok && qv.data.estadoR === 'vencida' && qv.data.estado === 'enviada', qv.data && qv.data.estadoR);
  mal('cotizacionPago: antes de aceptar', await api('cotizacionPago', { id: Q.id, pagoId: Q.pagos[0].id, metodo: 'Efectivo' }, S.tok), /Primero acepta/);
  mal('cotizacionFirmar: antes de aceptar', await api('cotizacionFirmar', { id: Q.id, tipo: 'contrato', firma: FIRMA }, S.tok), /Primero acepta/);
  mal('cotizacionAceptar: plan que no suma el total', await api('cotizacionAceptar', { id: Q.id, pagos: [{ n: 'Único', f: hoy(), m: 5000 }] }, S.tok), /Ajusta el plan/);
  mal('cotizacionAceptar: pago sin fecha', await api('cotizacionAceptar', { id: Q.id, pagos: [{ n: 'Único', f: '', pct: 100 }] }, S.tok), /Ponle fecha/);
  const ac = await api('cotizacionAceptar', { id: Q.id, cobrarPrimero: true, metodo: 'Transferencia' }, S.tok);
  bien('cotizacionAceptar: con el anticipo cobrado de una vez', ac);
  const A = ac.data;
  ok('aceptar: estado aceptada, proyecto creado, cliente registrado, pago 1 cobrado 4657.5, cobrado=4657.5, saldo 4657.5', ac.ok && A.estado === 'aceptada' && !!A.proyectoId && !!A.clienteId && A.pagos[0].estado === 'cobrado' && A.pagos[0].m === 4657.5 && A.cobrado === 4657.5 && A.saldo === 4657.5, A);
  ok('aceptar: el proyecto tiene 2 entregables pendientes y presupuesto 9315', db.T.ProyectoProductos.filter(x => x.proyectoId === A.proyectoId).length === 2 && fila('Proyectos', A.proyectoId).presupuesto === 9315 && fila('Proyectos', A.proyectoId).estado === 'curso', fila('Proyectos', A.proyectoId));
  ok('aceptar: el anticipo entró como abono Transferencia ligado a la cotización', db.T.Abonos.some(a => a.ref === Q.id && a.monto === 4657.5 && a.metodo === 'Transferencia'));
  mal('cotizacionAceptar: dos veces', await api('cotizacionAceptar', { id: Q.id }, S.tok), /ya se aceptó/);
  mal('cotizacionEstado: una aceptada no cambia', await api('cotizacionEstado', { id: Q.id, estado: 'borrador' }, S.tok), /ya se aceptó/);
  const ge = await api('cotizacionGuardar', { registro: { id: Q.id, cliente: 'Otro', items: [{ n: 'X', cant: 1, precio: 1 }], notas: 'Llamar antes' } }, S.tok);
  ok('cotizacionGuardar: en aceptada solo cambian notas/entrega', ge.ok && ge.data.cliente === 'Empresa X' && ge.data.items.length === 2 && ge.data.notas === 'Llamar antes', ge.data);
  mal('cotizacionPago: pago ya cobrado', await api('cotizacionPago', { id: Q.id, pagoId: A.pagos[0].id }, S.tok), /ya se cobró/);
  mal('cotizacionPago: pago inexistente', await api('cotizacionPago', { id: Q.id, pagoId: 'nope' }, S.tok), /ya no existe/);
  mal('cotizacionPago: más que el total', await api('cotizacionPago', { id: Q.id, pagoId: A.pagos[1].id, monto: 5000 }, S.tok), /más que el total/);
  // cotizacionPagos: mover la fecha del 2.º pago, intentar quitar el cobrado
  mal('cotizacionPagos: quitar el pago cobrado', await api('cotizacionPagos', { id: Q.id, pagos: [A.pagos[1]] }, S.tok), /ya está cobrado/);
  const cp = await api('cotizacionPagos', { id: Q.id, pagos: [Object.assign({}, A.pagos[0], { m: 1, estado: '' }), { id: A.pagos[1].id, n: 'Entrega final', f: dias(45), m: 4657.5 }], avisado: A.pagos[1].id }, S.tok);
  ok('cotizacionPagos: el cobrado no se altera; el 2.º cambia de nombre/fecha y queda avisado hoy', cp.ok && cp.data.pagos[0].m === 4657.5 && cp.data.pagos[0].estado === 'cobrado' && cp.data.pagos[1].n === 'Entrega final' && cp.data.pagos[1].f === dias(45) && cp.data.pagos[1].avisado === hoy(), cp.data && cp.data.pagos);
  // Contrato
  mal('cotizacionFirmar: firma inválida', await api('cotizacionFirmar', { id: Q.id, tipo: 'contrato', firma: 'data:image/png;base64,AAA', nombre: 'Juan' }, S.tok), /dibujar su firma/);
  mal('cotizacionFirmar: firma gigante', await api('cotizacionFirmar', { id: Q.id, tipo: 'contrato', firma: 'data:image/png;base64,' + 'A'.repeat(50000) }, S.tok), /muy grande/);
  const st = await api('cotizacionFirmar', { id: Q.id, tipo: 'contrato', texto: 'CONTRATO de servicios…', soloTexto: true }, S.tok);
  ok('cotizacionFirmar: guardar solo el texto del contrato', st.ok && st.data.contrato === 'CONTRATO de servicios…' && !st.data.contratoEl, st.data && st.data.contratoEl);
  const fc = await api('cotizacionFirmar', { id: Q.id, tipo: 'contrato', firma: FIRMA, nombre: 'Juan Gerente' }, S.tok);
  bien('cotizacionFirmar: contrato firmado', fc);
  ok('contrato: firmado por Juan Gerente, con fecha y texto previo', fc.ok && fc.data.contratoPor === 'Juan Gerente' && !!fc.data.contratoEl && fc.data.contrato === 'CONTRATO de servicios…' && fc.data.contratoFirma === FIRMA, fc.data && [fc.data.contratoPor, fc.data.contratoEl]);
  mal('cotizacionFirmar: contrato dos veces', await api('cotizacionFirmar', { id: Q.id, tipo: 'contrato', firma: FIRMA }, S.tok), /ya está firmado/);
  // Acta: antes hay que terminar los entregables
  mal('cotizacionFirmar: acta con entregables pendientes', await api('cotizacionFirmar', { id: Q.id, tipo: 'acta', firma: FIRMA }, S.tok), /2 entregables pendientes/);
  const ents = db.T.ProyectoProductos.filter(x => x.proyectoId === A.proyectoId);
  mal('entregable: id inexistente', await api('entregable', { id: 'WXX', estado: 'listo' }, S.tok), /ya no existe/);
  const e1 = await api('entregable', { id: ents[0].id, estado: 'proceso' }, S.tok);
  ok('entregable: en proceso sin fecha', e1.ok && e1.data.estado === 'proceso' && e1.data.entregado === '', e1);
  const e2 = await api('entregable', { id: ents[0].id, estado: 'listo' }, S.tok);
  ok('entregable: listo con fecha de hoy', e2.ok && e2.data.estado === 'listo' && e2.data.entregado === hoy(), e2);
  const e3 = await api('entregable', { id: ents[1].id, estado: 'lo que sea' }, S.tok);
  ok('entregable: estado raro cae a pendiente', e3.ok && e3.data.estado === 'pendiente');
  mal('cotizacionFirmar: acta con 1 pendiente', await api('cotizacionFirmar', { id: Q.id, tipo: 'acta', firma: FIRMA }, S.tok), /1 entregable pendiente/);
  await api('entregable', { id: ents[1].id, estado: 'listo' }, S.tok);
  // Proyecto visible desde proyectos (cajero puede verlo si cotizaciones activo)
  const pr = await api('proyecto', { id: A.proyectoId }, S.tok);
  ok('proyecto: trae la cotización ligada (cot.cobrado 4657.5)', pr.ok && pr.data.cot && pr.data.cot.cobrado === 4657.5 && pr.data.cot.contratoPor === 'Juan Gerente', pr.data && pr.data.cot);
  // Cobrar el saldo con el 2.º pago y luego el acta
  const p2 = await api('cotizacionPago', { id: Q.id, pagoId: A.pagos[1].id, metodo: 'Efectivo' }, S.tok);
  ok('cotizacionPago: 2.º pago cobrado, saldo 0', p2.ok && p2.data.cobrado === 9315 && p2.data.saldo === 0 && p2.data.pagos[1].estado === 'cobrado', p2.data);
  const fa = await api('cotizacionFirmar', { id: Q.id, tipo: 'acta', firma: FIRMA, nombre: 'Juan Gerente', texto: 'ACTA de entrega' }, S.tok);
  bien('cotizacionFirmar: acta firmada', fa);
  ok('acta: proyecto terminado con fin hoy', fa.ok && !!fa.data.actaEl && fila('Proyectos', A.proyectoId).estado === 'terminado' && fila('Proyectos', A.proyectoId).fin === hoy(), fila('Proyectos', A.proyectoId));
  mal('cotizacionPago: proyecto cerrado con acta', await api('cotizacionPago', { id: Q.id, pagoId: A.pagos[1].id }, S.tok), /cerrado con su acta|ya se cobró/);
  // Venta final ligada a la cotización: los pagos ya cobrados se descuentan como anticipo
  const Q2 = (await api('cotizacionGuardar', { registro: { cliente: 'Empresa Y', proyecto: 'Logo', items: [{ n: 'Logo', cant: 1, precio: 2000 }], pagos: [{ n: 'Anticipo', f: hoy(), pct: 50 }, { n: 'Final', f: dias(10), pct: 50 }] } }, S.tok)).data;
  const A2 = (await api('cotizacionAceptar', { id: Q2.id, cobrarPrimero: true, metodo: 'Efectivo' }, S.tok)).data;
  const vf = await api('venta', { cotizacionId: Q2.id, clienteId: A2.clienteId, items: [{ descripcion: 'Logo', cantidad: 1, precio: 2000 }], metodo: 'Efectivo', recibido: 1000, clave: 'cotv' }, S.tok);
  bien('venta: final del proyecto Logo (2000 − 1000 anticipo)', vf);
  ok('venta: anticipo 1000 aplicado y el 2.º pago queda cerrado por la venta', vf.ok && vf.data.venta.anticipo === 1000 && JSON.parse(fila('Cotizaciones', Q2.id).planPagos)[1].abonoId === 'venta:' + vf.data.venta.id, vf.data && vf.data.venta);
  const q2f = await api('cotizacion', { id: Q2.id }, S.tok);
  ok('cotizacion: cobrado 2000 y saldo 0 tras la venta', q2f.ok && q2f.data.cobrado === 2000 && q2f.data.saldo === 0, q2f.data && [q2f.data.cobrado, q2f.data.saldo]);
  // Rechazar una cotización
  const Q3 = (await api('cotizacionGuardar', { registro: { cliente: 'Empresa Z', proyecto: 'App', items: [{ n: 'App', cant: 1, precio: 100 }] } }, S.tok)).data;
  const rj = await api('cotizacionEstado', { id: Q3.id, estado: 'rechazada' }, S.tok);
  ok('cotizacionEstado: rechazada', rj.ok && rj.data.estado === 'rechazada');
  const res = await api('pendientes', {}, S.tok);
  ok('pendientes: trae avisos.cotHoy/cotAtras', res.ok && res.data.avisos && 'cotHoy' in res.data.avisos, res.data && res.data.avisos);
}

/* =========================================================================
 * 9) Proyectos (producción): gastos, materiales del inventario, pasar a inventario
 * ========================================================================= */
sec('proyectos');
{
  const Pn = await negocio('panaderia', 'Panadería Doña Tita', { ejemplos: true });
  const harina = (await api('guardar', { entidad: 'Productos', registro: { nombre: 'Harina (lb)', categoria: 'Materia prima', precio: 15, costo: 10, tipo: 'producto', stock: 50, tienda: false } }, Pn.tok)).data;
  const pan = Pn.prod('Pan de coco') || Pn.prods.find(p => p.tipo === 'producto');
  mal('guardarProyecto: sin nombre', await api('guardarProyecto', { registro: { nombre: '' } }, Pn.tok), /nombre del proyecto/);
  mal('guardarProyecto: margen inválido', await api('guardarProyecto', { registro: { nombre: 'X', margen: 5000 } }, Pn.tok), /ganancia deseado/);
  mal('guardarProyecto: producto final sin cantidad', await api('guardarProyecto', { registro: { nombre: 'Horneada', producto: { nombre: 'Pan de coco', cantidad: 0 } } }, Pn.tok), /cantidad que vas a producir/);
  console.log('   · proyectos guardados tras el error de cantidad:', db.T.Proyectos.filter(p => p.negocio_id === Pn.neg).length);
  ok('guardarProyecto: un error por la cantidad del producto final no debería dejar el proyecto creado', db.T.Proyectos.filter(p => p.negocio_id === Pn.neg).length === 0, 'quedó un proyecto huérfano «Horneada»');
  const pj = await api('guardarProyecto', { registro: { nombre: 'Horneada lunes', cliente: '', descripcion: 'Pan de coco', margen: 40, producto: { nombre: 'Pan de coco', cantidad: 100, unidad: 'unidad', precio: 0 } } }, Pn.tok);
  bien('guardarProyecto: con producto final 100 panes', pj);
  const J = pj.data;
  ok('proyecto: en curso, 1 producto, sin costo, semáforo gris', pj.ok && J.estado === 'curso' && J.r.nProductos === 1 && J.r.costo === 0 && J.r.semaforo === 'gris', J.r);
  mal('proyectoAInventario: sin gastos', await api('proyectoAInventario', { proyectoId: J.id, items: [{ id: J.r.productos[0].id }] }, Pn.tok), /Primero registra los gastos/);
  // Gastos
  mal('gastoProyecto: proyecto inexistente', await api('gastoProyecto', { registro: { proyectoId: 'JXX', monto: 10, descripcion: 'x' } }, Pn.tok), /ya no existe/);
  mal('gastoProyecto: sin descripción', await api('gastoProyecto', { registro: { proyectoId: J.id, monto: 10 } }, Pn.tok), /qué fue el gasto/);
  mal('gastoProyecto: monto 0', await api('gastoProyecto', { registro: { proyectoId: J.id, monto: 0, descripcion: 'Gas' } }, Pn.tok), /mayor a cero/);
  mal('gastoProyecto: fecha futura', await api('gastoProyecto', { registro: { proyectoId: J.id, monto: 10, descripcion: 'Gas', dia: dias(1) } }, Pn.tok), /futura/);
  mal('gastoProyecto: material más que la existencia (hay 50)', await api('gastoProyecto', { registro: { proyectoId: J.id, productoId: harina.id, cantidad: 60 } }, Pn.tok), /Solo hay 50/);
  mal('gastoProyecto: material de un servicio', await api('gastoProyecto', { registro: { proyectoId: J.id, productoId: Pn.prods.find(p => p.tipo === 'servicio').id, cantidad: 1 } }, Pn.tok), /no controla existencias/);
  const g1 = await api('gastoProyecto', { registro: { proyectoId: J.id, categoria: 'mano de obra', descripcion: 'Panadero', cantidad: 2, costoUnit: 150, caja: true } }, Pn.tok);
  bien('gastoProyecto: mano de obra 2×150 pagado de caja', g1);
  ok('gasto: categoría normalizada «Mano de obra», monto 300, caja', g1.ok && g1.data.gastos[0].categoria === 'Mano de obra' && g1.data.gastos[0].monto === 300 && g1.data.gastos[0].caja === true && g1.data.r.costo === 300, g1.data && g1.data.gastos);
  const g2 = await api('gastoProyecto', { registro: { proyectoId: J.id, productoId: harina.id, cantidad: 20 } }, Pn.tok);
  bien('gastoProyecto: 20 lb de harina del inventario', g2);
  const gm = g2.ok && g2.data.gastos.find(g => g.productoId === harina.id);
  ok('gasto material: 20×10 = 200 al costo del producto, costo total 500', gm && gm.monto === 200 && gm.costoUnit === 10 && gm.caja === false && g2.data.r.costo === 500, gm);
  ok('gasto material: la harina bajó de 50 a 30', (await stockDe(Pn.tok, harina.id)) === 30);
  mal('gastoProyecto: el material no se edita', await api('gastoProyecto', { registro: { id: gm.id, proyectoId: J.id, cantidad: 5 } }, Pn.tok), /no se puede modificar/);
  const g1e = await api('gastoProyecto', { registro: { id: g1.data.gastos.find(g => !g.productoId).id, proyectoId: J.id, descripcion: 'Panadero y ayudante', cantidad: 2, costoUnit: 175, caja: true } }, Pn.tok);
  ok('gastoProyecto: editar monto del gasto de mano de obra (350), costo 550', g1e.ok && g1e.data.r.costo === 550, g1e);
  const an = await api('anularGastoProyecto', { id: gm.id }, Pn.tok);
  bien('anularGastoProyecto: el material', an);
  ok('anular material: la harina vuelve a 50 y el costo a 350', (await stockDe(Pn.tok, harina.id)) === 50 && an.data.r.costo === 350, an.data && an.data.r.costo);
  mal('anularGastoProyecto: dos veces', await api('anularGastoProyecto', { id: gm.id }, Pn.tok), /ya está anulado/);
  const g3 = await api('gastoProyecto', { registro: { proyectoId: J.id, productoId: harina.id, cantidad: 25 } }, Pn.tok);
  ok('gastoProyecto: volver a tomar 25 lb (costo 600, harina 25)', g3.ok && g3.data.r.costo === 600 && (await stockDe(Pn.tok, harina.id)) === 25, g3.data && g3.data.r.costo);
  // Productos finales
  mal('productoProyecto: sin nombre', await api('productoProyecto', { registro: { proyectoId: J.id, cantidad: 10 } }, Pn.tok), /nombre del producto final/);
  mal('productoProyecto: cantidad 0', await api('productoProyecto', { registro: { proyectoId: J.id, nombre: 'Semitas', cantidad: 0 } }, Pn.tok), /cantidad producida/);
  const pp = await api('productoProyecto', { registro: { proyectoId: J.id, nombre: 'Semitas', cantidad: 50, peso: 0.5, precio: 15 } }, Pn.tok);
  bien('productoProyecto: agregar Semitas 50 con peso 0.5', pp);
  // costo 600: panes 100×1 = 100, semitas 50×0.5 = 25 → panes 480 (4.8 c/u), semitas 120 (2.4 c/u)
  const prodsP = pp.data.r.productos;
  ok('proyecto: reparto del costo por peso (pan 4.8, semita 2.4)', prodsP.find(x => x.nombre === 'Pan de coco').costoUnit === 4.8 && prodsP.find(x => x.nombre === 'Semitas').costoUnit === 2.4, prodsP.map(x => [x.nombre, x.costoUnit]));
  const ppe = await api('productoProyecto', { registro: { id: prodsP[0].id, proyectoId: J.id, nombre: prodsP[0].nombre, cantidad: prodsP[0].cantidad, precio: 12 } }, Pn.tok);
  ok('productoProyecto: ponerle precio 12 al pan → ganancia calculada y semáforo', ppe.ok && ppe.data.r.ganancia !== null && ppe.data.r.semaforo !== 'gris', ppe.data && ppe.data.r);
  const q = await api('quitarProductoProyecto', { id: prodsP.find(x => x.nombre === 'Semitas').id }, Pn.tok);
  ok('quitarProductoProyecto: quita Semitas (1 producto, costo unit 6)', q.ok && q.data.r.nProductos === 1 && q.data.r.costoUnit === 6, q.data && q.data.r);
  mal('quitarProductoProyecto: id inexistente', await api('quitarProductoProyecto', { id: 'WXX' }, Pn.tok), /ya no existe/);
  // Pasar al inventario: al producto existente «Pan de coco» (costo promedio)
  const prodPan = J.r.productos[0];
  const stPan0 = pan ? await stockDe(Pn.tok, pan.id) : 0, costoPan0 = pan ? fila('Productos', pan.id).costo : 0;
  mal('proyectoAInventario: sin items', await api('proyectoAInventario', { proyectoId: J.id, items: [] }, Pn.tok), /al menos un producto/);
  mal('proyectoAInventario: producto del inventario inexistente', await api('proyectoAInventario', { proyectoId: J.id, items: [{ id: prodPan.id, productoId: 'RXX' }] }, Pn.tok), /ya no existe/);
  mal('proyectoAInventario: repetido', await api('proyectoAInventario', { proyectoId: J.id, items: [{ id: prodPan.id }, { id: prodPan.id }] }, Pn.tok), /repetido/);
  const inv = await api('proyectoAInventario', { proyectoId: J.id, items: [{ id: prodPan.id, productoId: pan.id, precio: 14, cambiarPrecio: true }] }, Pn.tok);
  bien('proyectoAInventario: 100 panes al producto existente', inv);
  const panD = fila('Productos', pan.id);
  const costoEsp = Math.round(((Math.max(0, stPan0) * costoPan0 + 100 * 6) / (Math.max(0, stPan0) + 100)) * 10000) / 10000;
  ok('inventario: el pan subió 100 (' + stPan0 + ' → ' + (stPan0 + 100) + '), costo promedio ' + costoEsp + ', precio 14', panD.stock === stPan0 + 100 && Math.abs(panD.costo - costoEsp) < 0.001 && panD.precio === 14, panD);
  ok('inventario: la harina sigue en 25 (ya había bajado con el gasto)', (await stockDe(Pn.tok, harina.id)) === 25);
  ok('inventario: el producto del proyecto quedó marcado con inventario y productoId', inv.ok && inv.data.r.productos[0].inventario === hoy() && inv.data.r.productos[0].productoId === pan.id && inv.data.pasados === 1, inv.data && inv.data.r.productos[0]);
  ok('inventario: movimiento tipo producción en el kardex', db.T.Inventario.some(m => m.productoId === pan.id && m.tipo === 'producción' && m.cantidad === 100 && m.refId === J.id));
  mal('proyectoAInventario: dos veces', await api('proyectoAInventario', { proyectoId: J.id, items: [{ id: prodPan.id }] }, Pn.tok), /ya pasó al inventario/);
  mal('productoProyecto: no cambia la cantidad de uno ya pasado', await api('productoProyecto', { registro: { id: prodPan.id, proyectoId: J.id, nombre: 'Pan de coco', cantidad: 90 } }, Pn.tok), /no se puede cambiar/);
  mal('quitarProductoProyecto: uno ya pasado', await api('quitarProductoProyecto', { id: prodPan.id }, Pn.tok), /ya pasó al inventario/);
  // Producto nuevo en el inventario
  const pp2 = await api('productoProyecto', { registro: { proyectoId: J.id, nombre: 'Pan nuevo', cantidad: 10, precio: 20 } }, Pn.tok);
  const nuevoId = pp2.data.r.productos.find(x => x.nombre === 'Pan nuevo').id;
  const inv2 = await api('proyectoAInventario', { proyectoId: J.id, items: [{ id: nuevoId, categoria: 'Pan dulce', icono: '🍞' }] }, Pn.tok);
  bien('proyectoAInventario: crea producto nuevo', inv2);
  const nuevo = db.T.Productos.find(p => p.negocio_id === Pn.neg && p.nombre === 'Pan nuevo');
  ok('inventario: producto nuevo con stock 10, precio 20, categoría Pan dulce, fuera de tienda', nuevo && nuevo.stock === 10 && nuevo.precio === 20 && nuevo.categoria === 'Pan dulce' && nuevo.tienda === false, nuevo);
  // Estado y duplicar
  mal('estadoProyecto: estado inválido', await api('estadoProyecto', { id: J.id, estado: 'pausado' }, Pn.tok), /Estado no válido/);
  const te = await api('estadoProyecto', { id: J.id, estado: 'terminado' }, Pn.tok);
  ok('estadoProyecto: terminado con fin hoy', te.ok && te.data.estado === 'terminado' && te.data.fin === hoy());
  const ca = await api('estadoProyecto', { id: J.id, estado: 'cancelado' }, Pn.tok);
  ok('estadoProyecto: cancelado', ca.ok && ca.data.estado === 'cancelado');
  mal('gastoProyecto: a un proyecto cancelado', await api('gastoProyecto', { registro: { proyectoId: J.id, monto: 10, descripcion: 'x' } }, Pn.tok), /cancelado/);
  mal('proyectoAInventario: proyecto cancelado', await api('proyectoAInventario', { proyectoId: J.id, items: [{ id: nuevoId }] }, Pn.tok), /cancelado/);
  const re = await api('estadoProyecto', { id: J.id, estado: 'curso' }, Pn.tok);
  ok('estadoProyecto: reabrir borra fin', re.ok && re.data.estado === 'curso' && re.data.fin === '');
  const du = await api('duplicarProyecto', { id: J.id, nombre: 'Horneada martes', gastos: true }, Pn.tok);
  bien('duplicarProyecto: con gastos', du);
  ok('duplicar: copia 2 productos sin inventario, 1 gasto (omite el material: omitidos 1)', du.ok && du.data.r.nProductos === 2 && du.data.r.productos.every(x => !x.inventario && !x.productoId) && du.data.gastos.length === 1 && du.data.omitidos === 1 && du.data.r.costo === 350, du.data && [du.data.r.nProductos, du.data.gastos.length, du.data.omitidos]);
  const pl = await api('proyectos', {}, Pn.tok);
  ok('proyectos: lista con resumen (2 + el huérfano del error)', pl.ok && pl.data.length >= 2 && pl.data.every(p => p.r && typeof p.r.costo === 'number'), pl.data && pl.data.length);
  // cajero no entra a proyectos si no hay cotizaciones
  await api('guardarUsuario', { registro: { usuario: '99990005', nombre: 'Caja', rol: 'cajero', activo: true }, clave: '5555' }, Pn.tok);
  const tc = (await api('login', { whatsapp: '99990005', pin: '5555', negocioId: Pn.neg })).data.token;
  mal('proyectos: cajero sin módulo cotizaciones no entra', await api('proyectos', {}, tc));
}

/* =========================================================================
 * 10) Multinegocio: varios giros en una tienda
 * ========================================================================= */
sec('multinegocio');
{
  const M = await negocio('tienda', 'Multi Molina', { activar: true, plus: true });
  mal('cambiarGiro: giro inválido', await api('cambiarGiro', { giro: 'nave' }, M.tok), /no válido/);
  mal('cargarEjemplos: de un giro no activo', await api('cargarEjemplos', { giro: 'streaming' }, M.tok), /no está activo/);
  const gi = await giros(M.neg, ['streaming', 'servicios', 'compras']);
  bien('panel: activar giros extra streaming, servicios y compras', gi);
  const ti = await api('tiendaInfo', { negocio: M.neg });
  ok('tiendaInfo: 4 giros (tienda + 3) en orden', ti.ok && ti.data.negocio.giros.map(g => g.id).join(',') === 'tienda,streaming,servicios,compras', ti.data && ti.data.negocio.giros);
  ok('tiendaInfo: sección compras con cambio y anticipo', ti.ok && ti.data.negocio.compras && ti.data.negocio.compras.cambio === 25 && ti.data.negocio.compras.anticipo === 50, ti.data && ti.data.negocio.compras);
  bien('cargarEjemplos: streaming ya activo', await api('cargarEjemplos', { giro: 'streaming' }, M.tok));
  bien('cargarEjemplos: servicios', await api('cargarEjemplos', { giro: 'servicios' }, M.tok));
  const bs = (await api('bootstrap', {}, M.tok)).data;
  ok('bootstrap: girosActivos con 4 y productos de 3 giros', JSON.stringify(bs.girosActivos || bs.config.girosActivos || []).indexOf('streaming') >= 0 || bs.productos.some(p => p.giro === 'streaming'), bs.girosActivos);
  const ti2 = await api('tiendaInfo', { negocio: M.neg });
  const porG = {}; ti2.data.productos.forEach(p => { porG[p.g] = (porG[p.g] || 0) + 1; });
  ok('tiendaInfo: cada producto lleva su sección g (tienda 8, streaming 10, servicios 5)', porG.tienda === 8 && porG.streaming === 10 && porG.servicios === 5, porG);
  const arrozM = ti2.data.productos.find(p => p.nombre === 'Arroz 1 lb'), nfM = ti2.data.productos.find(p => p.nombre === 'Netflix · 1 perfil'), servM = ti2.data.productos.find(p => p.nombre === 'Servicio básico');
  ok('tiendaInfo: los servicios/suscripciones van como serv (sin existencia)', nfM.serv === 1 && servM.serv === 1 && arrozM.serv === undefined, [nfM, servM]);
  // Pedidos por sección
  const p1 = await api('pedir', { negocio: M.neg, nombre: 'Cliente Uno', telefono: '98110001', items: [{ id: arrozM.id, cantidad: 2 }] });
  const p2 = await api('pedir', { negocio: M.neg, nombre: 'Cliente Dos', telefono: '98110002', items: [{ id: nfM.id, cantidad: 1, opcion: 'Plan: 3 meses' }] });
  const p3 = await api('pedir', { negocio: M.neg, nombre: 'Cliente Tres', telefono: '98110003', items: [{ id: servM.id, cantidad: 1 }, { id: arrozM.id, cantidad: 1 }] });
  bien('pedir: tienda', p1); bien('pedir: streaming con plan', p2); bien('pedir: mixto servicios+tienda', p3);
  // Compra por enlace
  mal('pedir: compra por enlace sin precio', await api('pedir', { negocio: M.neg, nombre: 'Cliente Cuatro', telefono: '98110004', items: [{ id: '_compra', enlace: 'https://shein.com/x', usd: 0, cantidad: 1 }] }), /precio en dólares/);
  const p4 = await api('pedir', { negocio: M.neg, nombre: 'Cliente Cuatro', telefono: '98110004', items: [{ id: '_compra', enlace: 'https://shein.com/x', usd: 10, cantidad: 2, talla: 'M' }] });
  bien('pedir: compra por enlace 2×$10', p4);
  // precio = ceil(10 × 25 × 1.15) = 288 c/u → total 576; anticipo 50 % = 288
  ok('pedir compra: precio en L (288 redondeado arriba), total 576, anticipo 288', p4.ok && p4.data.items[0].precio === 288 && p4.data.total === 576 && p4.data.anticipo === 288, p4.data);
  const todos = await api('pedidos', {}, M.tok);
  ok('pedidos: sin tienda ve los 4', todos.ok && todos.data.length === 4, todos.data && todos.data.length);
  const pt = await api('pedidos', { tienda: 'tienda' }, M.tok), ps = await api('pedidos', { tienda: 'streaming' }, M.tok), pv = await api('pedidos', { tienda: 'servicios' }, M.tok), pc = await api('pedidos', { tienda: 'compras' }, M.tok);
  ok('pedidos por sección: tienda 2 (el mixto cuenta), streaming 1, servicios 1, compras 1', pt.data.length === 2 && ps.data.length === 1 && pv.data.length === 1 && pc.data.length === 1, [pt.data.length, ps.data.length, pv.data.length, pc.data.length]);
  const pen = await api('pendientes', { tienda: 'streaming' }, M.tok);
  ok('pendientes por tienda: streaming 1 nuevo', pen.ok && pen.data.nuevos === 1, pen.data);
  const tl = await api('tiendas', {}, M.tok);
  ok('tiendas: 4 tiendas con pedidos nuevos por sección', tl.ok && tl.data.tiendas.length === 4 && tl.data.tiendas.find(t => t.id === 'streaming').pedidos === 1 && tl.data.tiendas.find(t => t.id === 'tienda').pedidos === 2, tl.data && tl.data.tiendas.map(t => [t.id, t.pedidos, t.productos]));
  // Un cajero asignado a streaming solo ve lo suyo
  await api('guardarUsuario', { registro: { usuario: '99990006', nombre: 'Caja Stream', rol: 'cajero', activo: true, sucursal: 'streaming' }, clave: '5555' }, M.tok);
  const tc = (await api('login', { whatsapp: '99990006', pin: '5555', negocioId: M.neg })).data.token;
  const pcj = await api('pedidos', { tienda: 'tienda' }, tc);
  ok('pedidos: el cajero de streaming solo ve el suyo aunque pida «tienda»', pcj.ok && pcj.data.length === 1 && pcj.data[0].nombre === 'Cliente Dos', pcj.data && pcj.data.map(p => p.nombre));
  // Cobrar el pedido streaming con venta en su tienda
  const vs = await api('venta', { pedidoId: p2.data.id, items: [{ productoId: nfM.id, descripcion: 'Netflix · 1 perfil (Plan: 3 meses)', cantidad: 1, precio: 120 }], metodo: 'Efectivo', recibido: 120, clave: 'm1', tienda: 'streaming', sus: [{ idx: 0, meses: 3 }] }, M.tok);
  bien('venta: cobrar el pedido streaming (sin cuenta asignada)', vs);
  ok('venta: queda con sucursal streaming y crea la suscripción', vs.ok && vs.data.venta.sucursal === 'streaming' && db.T.Suscripciones.some(s => s.ventaId === vs.data.venta.id && s.plataforma === 'Netflix' && Number(s.meses) === 3), vs.data && vs.data.venta);
  // cambiarGiro: cambia el principal y conserva datos
  const cg = await api('cambiarGiro', { giro: 'streaming' }, M.tok);
  bien('cambiarGiro: principal a streaming', cg);
  ok('cambiarGiro: girosActivos empieza por streaming', cg.ok && cg.data.girosActivos[0] === 'streaming' && cg.data.config.giro === 'streaming', cg.data && cg.data.girosActivos);
  ok('cambiarGiro: el giro anterior (tienda) debería seguir como sección extra (observación)', cg.ok && cg.data.girosActivos.indexOf('tienda') >= 0, cg.data && cg.data.girosActivos);
  // nota: el giro anterior «tienda» sigue activo porque girosExtra_ lo toma de Licencias.giros (ahora incluye…)
  console.log('   · giros activos tras cambiar principal:', JSON.stringify(cg.data && cg.data.girosActivos), '· Licencias.giros =', JSON.stringify(fila('Licencias', M.neg).giros));
  const ti3 = await api('tiendaInfo', { negocio: M.neg });
  ok('tiendaInfo tras cambiarGiro: gid streaming y el arroz sigue en la tienda', ti3.ok && ti3.data.negocio.gid === 'streaming' && ti3.data.productos.some(p => p.nombre === 'Arroz 1 lb'), ti3.data && ti3.data.negocio);
  console.log('   · secciones tras cambiarGiro:', JSON.stringify(ti3.data && ti3.data.negocio.giros.map(g => g.id)), '· arroz g =', ti3.data && ti3.data.productos.find(p => p.nombre === 'Arroz 1 lb').g);
}

console.log('\n==== RESULTADO: ' + pasadas + ' pasadas · ' + fallidas + ' fallidas ====');
if (fallos.length) console.log('Fallidas:\n - ' + fallos.join('\n - '));
process.exitCode = fallidas ? 1 : 0;
