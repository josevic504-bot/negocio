// Batería de lo publicado entre 1.9.86 y el 2026-11-19 que las otras baterías no cubren
import { api, db, srv } from './prueba.mjs';
db.push = q => (q.lista ? [] : true);
let pas = 0, fal = 0; const fallos = [];
const ok = (n, c, det) => { if (c) { pas++; console.log('✓', n); } else { fal++; fallos.push(n); console.log('✗', n, det === undefined ? '' : JSON.stringify(det).slice(0, 300)); } return c; };
const sec = t => console.log('\n── ' + t + ' ──');
const idDe = r => r.data && (r.data.id || (r.data.registro && r.data.registro.id));
db.props.PANEL_CLAVE = 'secreta';
const PT = (await api('panelLogin', { clave: 'secreta' }, undefined, { ip: '9999999999999999' })).data.token;
const P = (a, d) => api(a, d, undefined, { panel: PT });

sec('Registro con ciudad · Tiendas Catrachas en prueba');
let r = await api('registrar', { ciudad: 'San Pedro Sula',  ciudad: 'San Pedro Sula', negocio: 'Boutique Reciente', nombre: 'Vic', giro: 'boutique', ciudad: '  San   Pedro Sula ', whatsapp: '9811-0001', pin: '1234' });
ok('registrar con ciudad', r.ok && r.data.token, r.error);
const tok = r.data.token, NEG = db.T.Licencias[0].id;
const cfg = k => (db.T.Config.find(c => c.negocio_id === NEG && c.clave === k) || {}).valor;
ok('la ciudad queda como ciudad del directorio (sin espacios de más)', cfg('dirCiudad') === 'San Pedro Sula', cfg('dirCiudad'));
ok('Tiendas Catrachas encendido desde el inicio', cfg('dirOn') === 'si', cfg('dirOn'));
r = await srv.atender({ action: 'registrar', data: { negocio: 'Sin Ciudad', nombre: 'Ana', giro: 'tienda', whatsapp: '9811-0002', pin: '1234' } });
ok('registro sin ciudad → rechazado por el servidor', !r.ok && /ciudad/i.test(r.error), r.error || 'se registró');
ok('y no dejó un negocio creado a medias', db.T.Licencias.length === 1, db.T.Licencias.length);
r = await srv.atender({ action: 'registrar', data: { negocio: 'Sin Ciudad', nombre: 'Ana', giro: 'tienda', ciudad: '  x ', whatsapp: '9811-0002', pin: '1234' } });
ok('ciudad de 1 letra o solo espacios → rechazada', !r.ok && /ciudad/i.test(r.error), r.error || 'se registró');
r = await api('registrar', { ciudad: 'San Pedro Sula',  ciudad: 'Gracias', negocio: 'Sin Ciudad', nombre: 'Ana', giro: 'tienda', whatsapp: '9811-0002', pin: '1234' });
ok('con ciudad sí se registra', r.ok && db.T.Config.some(c => c.clave === 'dirCiudad' && c.valor === 'Gracias'), r.error);
const tok2 = r.data.token, NEG2 = db.T.Licencias[1].id;
r = await api('tiendaInfo', { negocio: NEG });
ok('en prueba y sin productos propios: todavía no sale en el directorio', r.ok && !r.data.negocio.dir, r.data && r.data.negocio && r.data.negocio.dir);
r = await api('guardar', { entidad: 'Productos', registro: { nombre: 'Sudadera gris', categoria: 'Caballeros', tipo: 'producto', precio: 550, costo: 300, stock: 8, tienda: true, activo: true } }, tok);
ok('crear producto propio', r.ok, r.error); const prodId = idDe(r);
r = await api('tiendaInfo', { negocio: NEG });
ok('en prueba con producto propio: SÍ sale en el directorio, con su ciudad', r.ok && r.data.negocio.dir && r.data.negocio.dir.ciudad === 'San Pedro Sula', r.data && r.data.negocio && r.data.negocio.dir);
{ const l = db.T.Licencias.find(x => x.id === NEG), antes = l.vencePrueba; l.vencePrueba = '2026-01-01'; Object.keys(db.cache).forEach(k => { if (k.indexOf('L_') === 0) delete db.cache[k]; });
  r = await api('tiendaInfo', { negocio: NEG });
  ok('prueba vencida sin Plus: deja de salir en el directorio', !(r.ok && r.data.negocio && r.data.negocio.dir), r.ok ? r.data.negocio.dir : r.error);
  l.vencePrueba = antes; Object.keys(db.cache).forEach(k => { if (k.indexOf('L_') === 0) delete db.cache[k]; }); }
await api('guardar', { entidad: 'Config', registro: { dirOn: 'no' } }, tok);
r = await api('tiendaInfo', { negocio: NEG });
ok('si el dueño lo apaga, deja de salir', r.ok && !r.data.negocio.dir, r.error || r.data.negocio.dir);
await api('guardar', { entidad: 'Config', registro: { dirOn: 'si' } }, tok);
{ const c0 = cfg('dirCiudad');
  let q = await api('guardar', { entidad: 'Config', registro: { dirOn: 'si', dirCiudad: '' } }, tok);
  ok('Tiendas Catrachas encendido: borrar la ciudad se rechaza', !q.ok && /ciudad/i.test(q.error) && cfg('dirCiudad') === c0, q.error || 'se guardó');
  q = await api('guardar', { entidad: 'Config', registro: { dirCiudad: ' ' } }, tok);
  ok('también si solo manda la ciudad vacía', !q.ok && cfg('dirCiudad') === c0, q.error || 'se guardó');
  q = await api('guardar', { entidad: 'Config', registro: { dirOn: 'no', dirCiudad: '' } }, tok);
  ok('apagándolo sí puede quedar sin ciudad', q.ok && cfg('dirCiudad') === '', q.error);
  q = await api('guardar', { entidad: 'Config', registro: { dirOn: 'si', dirCiudad: 'La Ceiba' } }, tok);
  ok('cambiar a otra ciudad se guarda', q.ok && cfg('dirCiudad') === 'La Ceiba', q.error);
  q = await api('guardar', { entidad: 'Config', registro: { tiendaHorario: 'Lunes a sábado' } }, tok);
  ok('guardar otra sección no pide ciudad', q.ok, q.error);
  await api('guardar', { entidad: 'Config', registro: { dirCiudad: c0 } }, tok); }

sec('Cobrar con nombre sin guardar al cliente');
r = await api('venta', { items: [{ productoId: prodId, cantidad: 1, precio: 550 }], metodo: 'Efectivo', recibido: 600, clienteNombre: '  Doña   Marta López ', clave: 'k1' }, tok);
ok('venta en efectivo con nombre escrito', r.ok && r.data.venta.clienteNombre === 'Doña Marta López' && r.data.venta.clienteId === '', r.error || r.data.venta);
const v1 = r.ok ? r.data.venta : {};
r = await api('venta', { items: [{ productoId: prodId, cantidad: 1, precio: 550 }], metodo: 'Transferencia', recibido: 550, clienteNombre: 'Don Luis', clave: 'k2' }, tok);
ok('venta por transferencia con nombre escrito', r.ok && r.data.venta.clienteNombre === 'Don Luis', r.error);
r = await api('venta', { items: [{ productoId: prodId, cantidad: 1, precio: 550 }], metodo: 'Tarjeta', recibido: 550, clienteNombre: 'Karen', clave: 'k2b' }, tok);
ok('venta con tarjeta con nombre escrito', r.ok && r.data.venta.clienteNombre === 'Karen', r.error);
r = await api('venta', { items: [{ productoId: prodId, cantidad: 1, precio: 550 }], metodo: 'Crédito', clienteNombre: 'Don Luis', clave: 'k3' }, tok);
ok('al crédito con nombre sin guardar → rechazada', !r.ok && /cliente registrado/.test(r.error), r.error || r.data);
r = await api('guardar', { entidad: 'Clientes', registro: { nombre: 'Rosa Mejía', telefono: '9900-1122', limite: 5000, activo: true } }, tok);
const cid = idDe(r); ok('guardar cliente', r.ok && cid, r.error);
r = await api('venta', { items: [{ productoId: prodId, cantidad: 1, precio: 550 }], metodo: 'Crédito', clienteId: cid, clienteNombre: 'Otro nombre', clave: 'k4' }, tok);
ok('al crédito con cliente guardado → pasa y no guarda el nombre suelto', r.ok && r.data.venta.clienteId === cid && r.data.venta.clienteNombre === '', r.error || (r.data && r.data.venta));
r = await api('venta', { items: [{ productoId: prodId, cantidad: 1, precio: 550 }], metodo: 'Efectivo', recibido: 550, clave: 'k5' }, tok);
ok('venta sin nombre sigue siendo consumidor final', r.ok && r.data.venta.clienteNombre === '' && r.data.venta.clienteId === '', r.error);
r = await api('venta', { items: [{ productoId: prodId, cantidad: 1, precio: 550 }], metodo: 'Efectivo', recibido: 550, clienteNombre: 'x'.repeat(200), clave: 'k6' }, tok);
ok('nombre muy largo se recorta a 60', r.ok && r.data.venta.clienteNombre.length === 60, r.error || r.data.venta.clienteNombre.length);
const hoy = new Date(Date.now() - 6 * 3600000).toISOString().slice(0, 10);
r = await api('ventas', { desde: hoy, hasta: hoy }, tok);
ok('la lista de ventas trae el nombre escrito', r.ok && JSON.stringify(r.data).indexOf('Doña Marta López') >= 0, r.error);
r = await api('reporte', { desde: hoy, hasta: hoy }, tok);
ok('el reporte del día responde con esas ventas', r.ok, r.error);
if (v1.id) { r = await api('editarVenta', { id: v1.id, motivo: 'se llevó dos', items: [{ productoId: prodId, cantidad: 2 }], metodo: 'Efectivo', descuento: 0, recibido: 1100 }, tok);
  const nv = r.ok ? (r.data.venta || {}) : {};
  ok('editar la venta conserva el nombre escrito', r.ok && nv.clienteNombre === 'Doña Marta López', r.error || nv); }

sec('Pedidos · «Nuevo pedido» anotado en el negocio (1.9.87)');
r = await api('pedidoNegocio', { nombre: 'Al', telefono: '99887766', items: [{ id: prodId, cantidad: 1 }] }, tok);
ok('pedido con nombre muy corto → rechazado', !r.ok && /nombre/.test(r.error), r.error);
r = await api('pedidoNegocio', { nombre: 'Alma Rivera', telefono: '123', items: [{ id: prodId, cantidad: 1 }] }, tok);
ok('pedido con WhatsApp corto → rechazado', !r.ok && /WhatsApp/.test(r.error), r.error);
r = await api('pedidoNegocio', { nombre: 'Alma Rivera', telefono: '9988-7766', canal: 'Llamada', entrega: 'recoger', items: [{ id: prodId, cantidad: 1 }] }, tok);
ok('pedido anotado por llamada', r.ok, r.error);
r = await api('pedidos', {}, tok);
const ped = r.ok ? (r.data.pedidos || r.data || []).find(p => p.nombre === 'Alma Rivera') : null;
ok('el pedido aparece en Pedidos con su total (1 × 550)', !!ped && Number(ped.total) === 550, ped || r.error);
r = await api('pedidoNegocio', { nombre: 'Alma Rivera', telefono: '9988-7766', items: [] }, tok);
ok('pedido sin productos → rechazado', !r.ok, r.error);

sec('Enlace de la tienda con nombre (1.9.88) · visitas de la tienda');
r = await api('tiendaEnlace', { enlace: 'Boutique Reciente!!', probar: true }, tok);
ok('probar enlace: limpia el texto y dice si está libre', r.ok && r.data.enlace === 'boutique-reciente' && r.data.libre === true, r.error || r.data);
r = await api('tiendaEnlace', { enlace: 'ab' }, tok);
ok('enlace de menos de 3 letras → rechazado', !r.ok && /3 letras/.test(r.error), r.error);
r = await api('tiendaEnlace', { enlace: 'moda-reciente' }, tok);
ok('cambiar el enlace', r.ok && db.T.Licencias.find(x => x.id === NEG).enlace === 'moda-reciente', r.error || db.T.Licencias.find(x => x.id === NEG).enlace);
r = await api('tiendaEnlace', { enlace: 'moda-reciente' }, tok2);
ok('otro negocio no puede usar el mismo enlace', !r.ok && /otra tienda/.test(r.error), r.error);
r = await api('tiendaEnlace', { enlace: 'panel' }, tok2);
ok('nombre reservado → rechazado', !r.ok, r.error || r.data);
r = await api('tiendaInfo', { negocio: 'moda-reciente' });
ok('la tienda abre por su enlace con nombre', r.ok && r.data.negocio && /Boutique Reciente/.test(r.data.negocio.nombre), r.error);
r = await api('tiendaInfo', { negocio: NEG });
ok('la tienda sigue abriendo por su código', r.ok && /Boutique Reciente/.test(r.data.negocio.nombre), r.error);
await api('visita', { p: 't-' + NEG.toLowerCase(), o: 'tiktok', v: 'navA', d: 'cel' });
r = await api('tiendaVisitas', { dias: '7' }, tok);
ok('visitas de la tienda (7 días)', r.ok && r.data.periodo === '7' && Array.isArray(r.data.barras) && r.data.total >= 1, r.error || r.data);
r = await api('tiendaVisitas', { dias: '30' }, tok);
ok('visitas de la tienda (30 días)', r.ok && r.data.periodo === '30', r.error);

sec('Lotes · editar fecha y número de lote');
{ const p = db.T.Productos.find(x => x.id === prodId); p.lotes = JSON.stringify([{ v: '2027-03-01', l: 'A-1', n: 5 }]); p.caduca = '2027-03-01';
  r = await api('loteEditar', { productoId: prodId, i: 0, vence: '2027-06-15', lote: 'B-2' }, tok);
  const pl = JSON.parse(db.T.Productos.find(x => x.id === prodId).lotes || '[]');
  ok('editar lote: cambia fecha y número', r.ok && pl[0] && pl[0].v === '2027-06-15' && pl[0].l === 'B-2', r.error || pl);
  r = await api('loteEditar', { productoId: prodId, i: 0, vence: '15/06/2027' }, tok);
  ok('editar lote con fecha mal escrita → rechazado', !r.ok && /Fecha/.test(r.error), r.error);
  r = await api('loteEditar', { productoId: prodId, i: 9, vence: '2027-06-15' }, tok);
  ok('editar lote que no existe → rechazado', !r.ok, r.error); }

sec('Panel · ligar un vendedor a una publicidad');
r = await P('panelVendedorGuardar', { nombre: 'Juan Pérez', whatsapp: '9988-7766' });
ok('vendedor nuevo', r.ok && r.data.codigo, r.error); const vcod = r.ok ? r.data.codigo : '';
r = await P('panelGastoGuardar', { tipo: 'publicidad', moneda: 'HNL', montoOrig: 500, nombre: 'Promoción TikTok', plataforma: 'TikTok', desde: hoy, hasta: hoy });
const pub = r.ok ? (r.data.campanas || [])[0] : null;
ok('publicidad registrada', r.ok && !!pub, r.error || (r.data && Object.keys(r.data)));
if (pub) { r = await P('panelVendedorLigar', { codigo: vcod, id: pub.id, ligar: true });
  ok('ligar vendedor a la publicidad', r.ok && db.T.GastosPanel.find(g => g.id === pub.id).vendedor === vcod, r.error || db.T.GastosPanel.find(g => g.id === pub.id).vendedor);
  r = await P('panelVendedorLigar', { codigo: vcod, id: pub.id, ligar: false });
  ok('desligar vendedor', r.ok && db.T.GastosPanel.find(g => g.id === pub.id).vendedor === '', r.error);
  r = await P('panelVendedorLigar', { codigo: 'v-nadie', id: pub.id, ligar: true });
  ok('ligar vendedor inexistente → rechazado', !r.ok, r.error); }


sec('Proyectos · «Producir más u otro tamaño» (1.9.86)');
{ r = await api('registrar', { ciudad: 'San Pedro Sula',  ciudad: 'San Pedro Sula', negocio: 'Panadería Reciente', nombre: 'Pan', giro: 'panaderia', ciudad: 'Tela', whatsapp: '9811-0003', pin: '1234' }); const tk = r.data.token;
  r = await api('guardarProyecto', { registro: { nombre: 'Horneada lunes', margen: 40, producto: { nombre: 'Pan de coco', cantidad: 100, unidad: 'unidad', precio: 12 } } }, tk);
  ok('proyecto con producto final (100 panes)', r.ok && r.data.r.nProductos === 1, r.error); const J = r.data;
  r = await api('gastoProyecto', { registro: { proyectoId: J.id, monto: 600, descripcion: 'Harina y coco' } }, tk); ok('gasto del proyecto L 600', r.ok, r.error);
  r = await api('proyectoAInventario', { proyectoId: J.id, items: [{ id: J.r.productos[0].id }] }, tk); ok('primera tanda pasa al inventario', r.ok, r.error);
  const inv1 = db.T.Productos.find(x => x.nombre === 'Pan de coco' && db.T.Licencias.some(l => l.id === x.negocio_id && l.negocio === 'Panadería Reciente'));
  ok('inventario: 100 panes a costo 6.00', !!inv1 && inv1.stock === 100 && inv1.costo === 6, inv1 && [inv1.stock, inv1.costo]);
  r = await api('productoProyecto', { registro: { proyectoId: J.id, nombre: 'Pan de coco', cantidad: 50, precio: 12 } }, tk);
  ok('producir más: segunda tanda del mismo producto (50)', r.ok && r.data.r.nProductos === 2, r.error || (r.data && r.data.r.nProductos));
  const t2 = r.ok ? r.data.r.productos.find(x => !x.inventario) : null;
  r = await api('productoProyecto', { registro: { proyectoId: J.id, nombre: 'Pan de coco grande', cantidad: 20, peso: 2, precio: 25 } }, tk);
  ok('otro tamaño del producto', r.ok && r.data.r.nProductos === 3, r.error);
  r = await api('gastoProyecto', { registro: { proyectoId: J.id, monto: 300, descripcion: 'Más harina' } }, tk); ok('otro gasto del mismo proyecto', r.ok, r.error);
  if (t2) { r = await api('proyectoAInventario', { proyectoId: J.id, items: [{ id: t2.id, productoId: inv1.id }] }, tk);
    const inv2 = db.T.Productos.find(x => x.id === inv1.id);
    ok('la tanda nueva pasa al inventario y suma existencias (150)', r.ok && inv2.stock === 150, r.error || inv2.stock);
    ok('no duplica el producto en el inventario', db.T.Productos.filter(x => x.nombre === 'Pan de coco' && x.negocio_id === inv1.negocio_id).length === 1, db.T.Productos.filter(x => x.nombre === 'Pan de coco' && x.negocio_id === inv1.negocio_id).length); }
  r = await api('proyecto', { id: J.id }, tk);
  ok('el proyecto reparte los L 900 entre todo lo producido', r.ok && Math.abs(r.data.r.costo - 900) < 0.01, r.error || (r.data && r.data.r.costo)); }

console.log(`\n== ${pas} pasadas · ${fal} fallidas ==`); if (fal) console.log(fallos.join('\n'));
