// 1.9.78: encargado por tienda, tienda en línea por tienda, funciones por tienda y reportes
import { api, db } from './prueba.mjs';
let pas = 0, fal = 0; const fallos = [];
const ok = (n, c, d) => { if (c) { pas++; console.log('✓ ' + n); } else { fal++; fallos.push(n); console.log('✗ ' + n + (d !== undefined ? ' → ' + JSON.stringify(d).slice(0, 300) : '')); } return !!c; };
const bien = (n, r) => ok(n, r.ok, r.error);
const mal = (n, r, re) => ok(n, !r.ok && (!re || re.test(String(r.error))), r.ok ? 'ACEPTADO' : r.error);
await db.aplicar({ props: { PANEL_CLAVE: 'clave-panel' } });
const PT = (await api('panelLogin', { clave: 'clave-panel' })).data.token;
const P = (a, d) => api(a, d, undefined, { panel: PT });
const reg = await api('registrar', { negocio: 'Todo en Uno', nombre: 'Carlos', giro: 'boutique', whatsapp: '99887766', pin: '1234' });
const T = reg.data.token; const neg = (await api('bootstrap', {}, T)).data.negocioId;
await P('panelAccion', { id: neg, accion: 'activar', monto: 1000, metodo: 'Efectivo' });
await P('panelAccion', { id: neg, accion: 'plus', monto: 300, metodo: 'Efectivo' });
bien('giros extra', await P('panelAccion', { id: neg, accion: 'giros', giros: ['streaming', 'recargas'] }));
bien('tienda abierta', await api('guardar', { entidad: 'Config', registro: { tienda: 'si' } }, T));
for (const g of ['boutique', 'streaming', 'recargas']) await api('cargarEjemplos', { giro: g }, T);
let b = (await api('bootstrap', {}, T)).data;
ok('3 tiendas', b.girosActivos.length === 3, b.girosActivos);
const pg = g => b.productos.find(p => (p.giro || 'boutique') === g && p.activo);
const pRopa = pg('boutique'), pStr = pg('streaming');
ok('hay productos ropa y streaming', pRopa && pStr);

// ---- encargado ----
bien('dueño crea encargado de streaming', await api('guardarUsuario', { registro: { nombre: 'Luis', usuario: '98765432', rol: 'admin', tienda: 'streaming' }, clave: '5555' }, T));
b = (await api('bootstrap', {}, T)).data;
const luis = b.usuarios.find(u => u.nombre === 'Luis');
ok('encargado guardado con tienda', luis && luis.rol === 'admin' && luis.sucursal === 'streaming', luis);
const lg = await api('login', { whatsapp: '98765432', pin: '5555' });
bien('encargado entra', lg); const TL = lg.data.token;
const bl = (await api('bootstrap', {}, TL)).data;
ok('encargado: no ve WhatsApp de otros', bl.usuarios.filter(u => u.ajeno).length >= 1 && !bl.usuarios.find(u => u.nombre === 'Carlos').usuario);
ok('encargado: sin cobroVM/limpieza', !bl.cobroVM && !bl.limpieza);
const tdl = (await api('tiendas', {}, TL)).data;
ok('encargado: tiendas solo la suya', tdl.tiendas.length === 1 && tdl.asignada === 'streaming', tdl);
mal('encargado no edita producto de ropa', await api('guardar', { entidad: 'Productos', registro: { id: pRopa.id, precio: 1 } }, TL), /otra tienda/);
bien('encargado edita producto de streaming', await api('guardar', { entidad: 'Productos', registro: { id: pStr.id, precio: 123 } }, TL));
const np = await api('guardar', { entidad: 'Productos', registro: { nombre: 'Netflix 2 perfiles', precio: 200, tipo: 'servicio', categoria: 'Netflix' } }, TL);
ok('encargado: producto nuevo queda en streaming', np.ok && np.data.giro === 'streaming', np.data || np.error);
mal('encargado no cambia nombre del negocio', await api('guardar', { entidad: 'Config', registro: { nombre: 'X' } }, TL), /dueño/);
mal('encargado no ve diario', await api('diario', {}, TL), /dueño/);
mal('encargado no contabilidad', await api('contabilidad', {}, TL), /dueño/);
mal('encargado no cambia giro', await api('cambiarGiro', { giro: 'tienda' }, TL), /dueño/);
const rp = await api('reporte', { desde: '2026-01-01', hasta: '2026-12-31', giro: '' }, TL);
bien('encargado reporte', rp); ok('encargado: reporte sin otras tiendas', (!rp.data.secciones || rp.data.secciones.every(x => x.id === 'streaming' && x.pct === undefined)) && rp.data.kpi.pct === undefined, rp.data.secciones);
const inv = (await api('inventario', {}, TL)).data;
ok('encargado inventario sin productos de otras tiendas', inv.productos.every(p => p.giro === 'streaming'), inv.productos.map(p => p.giro));
// usuarios del encargado
bien('encargado crea cajero (queda en su tienda)', await api('guardarUsuario', { registro: { nombre: 'Ana', usuario: '91112222', rol: 'cajero', tienda: 'boutique' }, clave: '1111' }, TL));
b = (await api('bootstrap', {}, T)).data;
ok('cajero del encargado en streaming', b.usuarios.find(u => u.nombre === 'Ana').sucursal === 'streaming');
const carlos = b.usuarios.find(u => u.nombre === 'Carlos');
mal('encargado no edita al dueño', await api('guardarUsuario', { registro: { id: carlos.id, nombre: 'Carlos', usuario: carlos.usuario, rol: 'cajero' } }, TL), /otra tienda/);
bien('dueño crea cajera de ropa', await api('guardarUsuario', { registro: { nombre: 'Andrea', usuario: '93334444', rol: 'cajero', tienda: 'boutique' }, clave: '2222' }, T));
b = (await api('bootstrap', {}, T)).data;
const andrea = b.usuarios.find(u => u.nombre === 'Andrea');
mal('encargado no edita cajera de ropa', await api('guardarUsuario', { registro: { id: andrea.id, nombre: 'Andrea', usuario: andrea.usuario, rol: 'cajero' } }, TL), /otra tienda/);
await api('guardarUsuario', { registro: { id: carlos.id, nombre: 'Carlos', usuario: carlos.usuario, rol: 'admin', tienda: 'boutique' } }, T);
b = (await api('bootstrap', {}, T)).data;
ok('el dueño sigue sin tienda', !b.usuarios.find(u => u.nombre === 'Carlos').sucursal);
// venta del encargado queda en streaming
const v = await api('venta', { items: [{ productoId: pStr.id, cantidad: 1, precio: 123 }], metodo: 'Efectivo', recibido: 200, tienda: 'boutique' }, TL);
bien('encargado vende', v);
console.log('venta', JSON.stringify(v.data).slice(0,200)); ok('venta queda en streaming', db.T.Ventas.some(x => x.sucursal === 'streaming'), db.T.Ventas.map(x => x.sucursal));

// ---- tienda en línea por tienda ----
bien('dueño apaga streaming y recargas en la página', await api('guardar', { entidad: 'Config', registro: { tiendaOff: 'streaming,recargas' } }, T));
let ti = (await api('tiendaInfo', { negocio: neg })).data;
ok('página: un solo giro (ropa)', ti.negocio.giros.length === 1 && ti.negocio.giros[0].id === 'boutique', ti.negocio.giros);
ok('página: solo productos de ropa', ti.productos.length > 0 && ti.productos.every(p => p.g === 'boutique'), [...new Set(ti.productos.map(p => p.g))]);
ok('página: sin secciones de streaming', !ti.negocio.porSecciones, ti.negocio.girosSec);
mal('pedido con producto de streaming rechazado', await api('pedir', { negocio: neg, nombre: 'Cli', telefono: '97778888', entrega: 'recoger', items: [{ id: pStr.id, cantidad: 1 }] }), /no está disponible/);
const pr2 = ti.productos[0];
const pd = await api('pedir', { negocio: neg, nombre: 'Cli', telefono: '97778888', entrega: 'recoger', items: [{ id: pr2.id, cantidad: 1, opcion: '' }] });
ok('pedido de ropa funciona (o pide opción)', pd.ok || /Elige/.test(pd.error), pd.error);
mal('no se pueden apagar todas', await api('guardar', { entidad: 'Config', registro: { tiendaOff: 'boutique,streaming,recargas' } }, T), /al menos una/);
bien('encargado enciende la suya', await api('guardar', { entidad: 'Config', registro: { tiendaOff: '' } }, TL));
let cfg = (await api('bootstrap', {}, T)).data.config;
ok('encargado solo cambió streaming', cfg.tiendaOff === 'recargas', cfg.tiendaOff);
bien('encargado apaga la suya', await api('guardar', { entidad: 'Config', registro: { tiendaOff: 'streaming,boutique' } }, TL));
cfg = (await api('bootstrap', {}, T)).data.config;
ok('encargado no tocó ropa', cfg.tiendaOff.split(',').sort().join() === 'recargas,streaming', cfg.tiendaOff);

// ---- funciones por tienda ----
bien('dueño: agenda solo en ropa', await api('guardar', { entidad: 'Config', registro: { modTiendas: JSON.stringify({ agenda: ['boutique'], caducidad: [] }) } }, T));
cfg = (await api('bootstrap', {}, T)).data.config;
let mt = JSON.parse(cfg.modTiendas);
ok('modTiendas agenda=[boutique]', JSON.stringify(mt.agenda) === '["boutique"]' && cfg.agenda === 'si', mt);
ok('caducidad apagada', cfg.caducidad === '' && mt.caducidad.length === 0, [cfg.caducidad, mt.caducidad]);
bien('encargado: agenda en streaming', await api('guardar', { entidad: 'Config', registro: { modTiendas: JSON.stringify({ agenda: ['streaming'] }) } }, TL));
cfg = (await api('bootstrap', {}, T)).data.config; mt = JSON.parse(cfg.modTiendas);
ok('agenda en ropa y streaming', mt.agenda.sort().join() === 'boutique,streaming', mt.agenda);
bien('encargado: quita agenda de streaming', await api('guardar', { entidad: 'Config', registro: { modTiendas: JSON.stringify({ agenda: [] }) } }, TL));
cfg = (await api('bootstrap', {}, T)).data.config; mt = JSON.parse(cfg.modTiendas);
ok('agenda sigue en ropa', mt.agenda.join() === 'boutique' && cfg.agenda === 'si', mt.agenda);
// reportes del dueño: todo junto y por tienda
const rT = (await api('reporte', { desde: '2026-01-01', hasta: '2026-12-31', giro: '' }, T)).data;
const rS = (await api('reporte', { desde: '2026-01-01', hasta: '2026-12-31', giro: 'streaming' }, T)).data;
ok('dueño: reporte total y por tienda', rT && rS && rT.kpi.ventas >= rS.kpi.ventas && rS.kpi.ventas > 0, [rT && rT.kpi.ventas, rS && rS.kpi.ventas]);
ok('dueño: comparativo por tienda', Array.isArray(rT.secciones) && rT.secciones.length === 3, rT.secciones && rT.secciones.map(x => x.id || x.giro));
console.log(`\n==== ${pas} pasadas · ${fal} fallidas ====`); if (fal) console.log(fallos.join('\n'));
