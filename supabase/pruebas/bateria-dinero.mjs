// Batería: dinero, inventario y reportes (servidor simulado con base falsa en memoria)
// Ejecutar: cd supabase/pruebas && node bateria-dinero.mjs
import { api, db } from './prueba.mjs';

let pasadas = 0, fallidas = 0; const fallos = [];
const ok = (nombre, cond, detalle) => { if (cond) { pasadas++; console.log('✓ ' + nombre); } else { fallidas++; fallos.push(nombre); console.log('✗ ' + nombre + (detalle !== undefined ? ' → ' + (typeof detalle === 'string' ? detalle : JSON.stringify(detalle)) : '')); } return !!cond; };
const cerca = (a, b, eps) => Math.abs(Number(a) - Number(b)) <= (eps || 0.005);
const okN = (nombre, a, b, eps) => ok(nombre, cerca(a, b, eps), 'obtenido ' + a + ' · esperado ' + b);
const okErr = (nombre, r, frag) => ok(nombre, !r.ok && (!frag || String(r.error).toLowerCase().indexOf(frag.toLowerCase()) >= 0), r.ok ? 'debió fallar, devolvió ' + JSON.stringify(r.data).slice(0, 120) : 'error distinto: ' + r.error);
const okRes = (nombre, r) => { ok(nombre, r.ok, r.error); return r.data; };
const hoy = new Date(Date.now() - 6 * 3600000).toISOString().slice(0, 10);
const mesAct = hoy.slice(0, 7);
const mesAnt = (() => { const y = Number(hoy.slice(0, 4)), m = Number(hoy.slice(5, 7)) - 2; const d = new Date(y, m, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); })();
const ayer = new Date(Date.now() - 6 * 3600000 - 86400000).toISOString().slice(0, 10);
const esperar = ms => new Promise(r => setTimeout(r, ms));
let clave = 0; const K = () => 'K' + (++clave);

/* ===================== PREPARACIÓN ===================== */
await db.aplicar({ props: { PANEL_CLAVE: 'c', RT_SECRETO: 's', VAPID_PUBLICA: 'a', VAPID_PRIVADA: 'b' } });
const reg = okRes('registrar', await api('registrar', { negocio: 'Pulpería Prueba', nombre: 'Vic', giro: 'tienda', whatsapp: '33130265', pin: '1234' }));
const tok = reg.token;
const boot0 = okRes('bootstrap', await api('bootstrap', {}, tok));
const neg = boot0.negocioId;
await db.aplicar({ ops: [{ t: 'Licencias', op: 'upd', k: { id: neg }, row: { plus: 'si', estado: 'Activa' } }] });
okRes('cargarEjemplos', await api('cargarEjemplos', {}, tok));
const prod = async id => (await api('bootstrap', {}, tok)).data.productos.find(p => p.id === id);
const prods = async () => (await api('bootstrap', {}, tok)).data.productos;
const stock = async id => (await prod(id)).stock;
const vars = p => { const V = JSON.parse(p.variantes || '{}'); const o = {}; Object.keys(V).forEach(k => { o[k.split(': ')[1]] = V[k].s; }); return o; };
const G = async (ent, r) => (await api('guardar', { entidad: ent, registro: r }, tok)).data;

const cafe = await G('Productos', { nombre: 'Café 400 g', categoria: 'Abarrotes', precio: 100, costo: 70, stock: 20, tipo: 'producto', activo: true });
const pan = await G('Productos', { nombre: 'Pan', categoria: 'Panadería', precio: 10, costo: 6, stock: 50, tipo: 'producto', tasaIsv: '0', activo: true });
const whisky = await G('Productos', { nombre: 'Whisky', categoria: 'Bebidas', precio: 236, costo: 150, stock: 10, tipo: 'producto', tasaIsv: '18', activo: true });
const jabon = await G('Productos', { nombre: 'Jabón', categoria: 'Limpieza', precio: 20, costo: 12, stock: 100, tipo: 'producto', precioEsp: 15, minEsp: 10, activo: true });
const camisa = await G('Productos', { nombre: 'Camisa', categoria: 'Ropa', precio: 250, costo: 150, tipo: 'producto', opciones: 'Talla: S, M, L', variantes: { 'Talla: S': { s: 5 }, 'Talla: M': { s: 3 }, 'Talla: L': { s: 0 } }, activo: true });
const servicio = await G('Productos', { nombre: 'Instalación', categoria: 'Servicios', precio: 500, costo: 0, tipo: 'servicio', activo: true });
ok('productos creados', cafe && cafe.id && pan.id && whisky.id && jabon.id && camisa.id && servicio.id);
okN('café: existencia inicial 20', cafe.stock, 20);
okN('camisa: existencia = suma de tallas', camisa.stock, 8);
const c1 = await G('Clientes', { nombre: 'Doña Marta', telefono: '9999-0000', limite: 500, activo: true });
const c2 = await G('Clientes', { nombre: 'Don Pedro', telefono: '9999-0001', limite: 0, activo: true });
const pr1 = await G('Proveedores', { nombre: 'Distribuidora Sula', telefono: '2222-0000', activo: true });
ok('clientes y proveedor creados', c1.id && c2.id && pr1.id);
// Cajero
okRes('crear cajero', await api('guardarUsuario', { registro: { usuario: '99990000', nombre: 'Cajera', rol: 'cajero', activo: true }, clave: '5555' }, tok));
const tcaj = (await api('login', { whatsapp: '99990000', pin: '5555' })).data.token;
ok('login cajero', !!tcaj);

// Libro mayor de lo esperado (para invariantes)
const E = { cajaVentas: 0, cobros: 0, gastos: 0, pagos: 0, compras: 0, tarjeta: 0, transferencia: 0 };

/* ===================== VENTAS ===================== */
console.log('\n— Ventas —');
// 1) Efectivo con cambio: 2 café (ISV 15 % incluido) + 3 pan (exento)
let r = await api('venta', { items: [{ productoId: cafe.id, cantidad: 2, precio: 100 }, { productoId: pan.id, cantidad: 3, precio: 10 }], metodo: 'Efectivo', recibido: 300, clave: K() }, tok);
const v1 = okRes('venta efectivo con cambio', r);
okN('v1 subtotal 230', v1.venta.subtotal, 230); okN('v1 total 230', v1.venta.total, 230); okN('v1 ISV 26.09 (solo el café)', v1.venta.isv, 26.09);
okN('v1 cambio 70', v1.venta.cambio, 70); okN('v1 costo 158', v1.venta.costo, 158);
okN('v1 existencia café 18', await stock(cafe.id), 18); okN('v1 existencia pan 47', await stock(pan.id), 47);
ok('v1 número V-00001', v1.venta.numero === 'V-00001', v1.venta.numero);
E.cajaVentas += 230;
// Efectivo insuficiente
okErr('efectivo recibido menor al total', await api('venta', { items: [{ productoId: cafe.id, cantidad: 1 }], metodo: 'Efectivo', recibido: 50, clave: K() }, tok), 'menor');
// 2) Idempotencia: misma clave devuelve la misma venta y no mueve inventario
const kRep = K();
const vA = okRes('venta con clave', await api('venta', { items: [{ productoId: pan.id, cantidad: 1 }], metodo: 'Efectivo', recibido: 10, clave: kRep }, tok));
const vB = okRes('venta repetida (misma clave)', await api('venta', { items: [{ productoId: pan.id, cantidad: 1 }], metodo: 'Efectivo', recibido: 10, clave: kRep }, tok));
ok('clave repetida devuelve la misma venta', vB.repetida === true && vB.venta.id === vA.venta.id, vB);
okN('clave repetida no descuenta dos veces (pan 46)', await stock(pan.id), 46);
E.cajaVentas += 10;
// 3) ISV 18 %
const v18 = okRes('venta whisky (ISV 18 %)', await api('venta', { items: [{ productoId: whisky.id, cantidad: 1 }], metodo: 'Efectivo', clave: K() }, tok));
okN('whisky ISV 36', v18.venta.isv, 36); okN('whisky total 236', v18.venta.total, 236); okN('sin recibido: cambio 0', v18.venta.cambio, 0);
E.cajaVentas += 236;
// 4) Crédito a cliente con límite 500
const vc1 = okRes('venta crédito 400 a Marta', await api('venta', { clienteId: c1.id, items: [{ productoId: cafe.id, cantidad: 4 }], metodo: 'Crédito', recibido: 0, clave: K() }, tok));
okN('crédito: saldo 400', vc1.venta.saldo, 400); okN('crédito: saldoCliente 400', vc1.saldoCliente, 400);
okErr('crédito que supera el límite (400 + 200 > 500)', await api('venta', { clienteId: c1.id, items: [{ productoId: cafe.id, cantidad: 2 }], metodo: 'Crédito', clave: K() }, tok), 'límite');
okErr('crédito sin cliente', await api('venta', { items: [{ productoId: cafe.id, cantidad: 1 }], metodo: 'Crédito', clave: K() }, tok), 'cliente');
const vc2 = okRes('crédito con pago parcial (100, recibe 50)', await api('venta', { clienteId: c1.id, items: [{ productoId: cafe.id, cantidad: 1 }], metodo: 'Crédito', recibido: 50, clave: K() }, tok));
okN('parcial: saldo 50', vc2.venta.saldo, 50); okN('parcial: saldoCliente 450', vc2.saldoCliente, 450);
E.cajaVentas += 50;
okErr('crédito: ya debe 450, otros 100 superan 500', await api('venta', { clienteId: c1.id, items: [{ productoId: cafe.id, cantidad: 1 }], metodo: 'Crédito', clave: K() }, tok), 'límite');
// Cliente sin límite
const vc3 = okRes('crédito a cliente sin límite (Pedro, 3 café)', await api('venta', { clienteId: c2.id, items: [{ productoId: cafe.id, cantidad: 3 }], metodo: 'Crédito', clave: K() }, tok));
okN('Pedro debe 300', vc3.saldoCliente, 300);
okN('café: 18 − 4 − 1 − 3 = 10', await stock(cafe.id), 10);
// 5) Tarjeta y transferencia
const vt = okRes('venta tarjeta', await api('venta', { items: [{ productoId: pan.id, cantidad: 2 }], metodo: 'Tarjeta', clave: K() }, tok));
okN('tarjeta: recibido = total', vt.venta.recibido, 20); E.tarjeta += 20;
const vtr = okRes('venta transferencia', await api('venta', { items: [{ productoId: pan.id, cantidad: 1 }], metodo: 'Transferencia', clave: K() }, tok));
okN('transferencia total 10', vtr.venta.total, 10); E.transferencia += 10;
// 6) Descuento global
const vd = okRes('venta con descuento global 20', await api('venta', { items: [{ productoId: cafe.id, cantidad: 2 }], metodo: 'Efectivo', descuento: 20, recibido: 180, clave: K() }, tok));
okN('descuento: total 180', vd.venta.total, 180); okN('descuento: ISV 23.48', vd.venta.isv, 23.48); okN('descuento guardado 20', vd.venta.descuento, 20);
E.cajaVentas += 180;
// 7) Descuento por línea (admin baja el precio de la línea)
const vl = okRes('descuento por línea (café a 90)', await api('venta', { items: [{ productoId: cafe.id, cantidad: 1, precio: 90 }], metodo: 'Efectivo', clave: K() }, tok));
okN('línea: total 90', vl.venta.total, 90); E.cajaVentas += 90;
okN('café: 10 − 2 − 1 = 7', await stock(cafe.id), 7);
// 8) Existencia insuficiente
okErr('existencia insuficiente (100 café)', await api('venta', { items: [{ productoId: cafe.id, cantidad: 100 }], metodo: 'Efectivo', clave: K() }, tok), 'suficiente');
okN('existencia no cambió tras rechazo', await stock(cafe.id), 7);
// 9) Variantes
okErr('camisa sin talla', await api('venta', { items: [{ productoId: camisa.id, cantidad: 1 }], metodo: 'Efectivo', clave: K() }, tok), 'talla');
okErr('camisa talla L agotada', await api('venta', { items: [{ productoId: camisa.id, cantidad: 1, variante: 'L' }], metodo: 'Efectivo', clave: K() }, tok), 'suficiente');
okErr('camisa talla M: pide 4, hay 3', await api('venta', { items: [{ productoId: camisa.id, cantidad: 4, variante: 'M' }], metodo: 'Efectivo', clave: K() }, tok), 'suficiente');
const vv = okRes('camisa 2 talla M', await api('venta', { items: [{ productoId: camisa.id, cantidad: 2, variante: 'M' }], metodo: 'Efectivo', clave: K() }, tok));
{ const p = await prod(camisa.id); ok('camisa: M 1, S 5, L 0 y total 6', JSON.stringify(vars(p)) === JSON.stringify({ S: 5, M: 1, L: 0 }) && p.stock === 6, [vars(p), p.stock]); }
ok('descripción lleva la talla', /M/.test(vv.detalle[0].descripcion), vv.detalle[0].descripcion);
E.cajaVentas += 500;
// 10) Precio especial por cantidad (cajero)
const vj = okRes('cajero: 10 jabones al precio especial 15', await api('venta', { items: [{ productoId: jabon.id, cantidad: 10, precio: 15 }], metodo: 'Efectivo', clave: K() }, tcaj));
okN('precio especial aceptado: total 150', vj.venta.total, 150); E.cajaVentas += 150;
const vj2 = okRes('cajero: 10 jabones a 12 (precio inventado)', await api('venta', { items: [{ productoId: jabon.id, cantidad: 10, precio: 12 }], metodo: 'Efectivo', clave: K() }, tcaj));
okN('precio inventado se corrige al normal: total 200', vj2.venta.total, 200); E.cajaVentas += 200;
const vj3 = okRes('cajero: 5 jabones a 15 (no llega al mínimo)', await api('venta', { items: [{ productoId: jabon.id, cantidad: 5, precio: 15 }], metodo: 'Efectivo', clave: K() }, tcaj));
okN('sin mínimo se cobra a 20: total 100', vj3.venta.total, 100); E.cajaVentas += 100;
const vj4 = okRes('admin: 1 jabón a 5 (admin sí cambia precio)', await api('venta', { items: [{ productoId: jabon.id, cantidad: 1, precio: 5 }], metodo: 'Efectivo', clave: K() }, tok));
okN('admin precio libre: total 5', vj4.venta.total, 5); E.cajaVentas += 5;
okN('jabón: 100 − 26 = 74', await stock(jabon.id), 74);
// 11) Ítem libre
const vlib = okRes('ítem libre (sin producto)', await api('venta', { items: [{ descripcion: 'Bolsa plástica', cantidad: 2, precio: 5, costo: 2 }], metodo: 'Efectivo', clave: K() }, tok));
okN('ítem libre total 10', vlib.venta.total, 10); okN('ítem libre costo 4', vlib.venta.costo, 4); E.cajaVentas += 10;
okErr('ítem libre sin descripción', await api('venta', { items: [{ cantidad: 1, precio: 5 }], metodo: 'Efectivo', clave: K() }, tok), 'descripción');
// 12) Servicio no mueve inventario
const vs = okRes('venta de servicio', await api('venta', { items: [{ productoId: servicio.id, cantidad: 1 }], metodo: 'Efectivo', clave: K() }, tok));
okN('servicio total 500', vs.venta.total, 500); E.cajaVentas += 500;
// 13) Descuento del cajero
okErr('cajero: descuento 60 % rechazado', await api('venta', { items: [{ productoId: pan.id, cantidad: 10 }], metodo: 'Efectivo', descuento: 60, clave: K() }, tcaj), '50');
const vcd = okRes('cajero: descuento 50 % aceptado', await api('venta', { items: [{ productoId: pan.id, cantidad: 10 }], metodo: 'Efectivo', descuento: 50, clave: K() }, tcaj));
okN('cajero descuento 50 %: total 50', vcd.venta.total, 50); E.cajaVentas += 50;
// Otros malos
okErr('ticket vacío', await api('venta', { items: [], metodo: 'Efectivo', clave: K() }, tok), 'vacío');
okErr('cantidad 0', await api('venta', { items: [{ productoId: pan.id, cantidad: 0 }], metodo: 'Efectivo', clave: K() }, tok), 'cantidad');
okErr('producto inexistente', await api('venta', { items: [{ productoId: 'RNOEXISTE', cantidad: 1 }], metodo: 'Efectivo', clave: K() }, tok), 'existe');
okErr('bodega no vende', await api('venta', { items: [{ productoId: pan.id, cantidad: 1 }], metodo: 'Efectivo', clave: K() }, 'tokenmalo'), 'SESION');

// 14) Suscripción de streaming
console.log('\n— Suscripciones —');
okRes('activar módulo suscripciones', await api('guardar', { entidad: 'Config', registro: { suscripciones: 'si' } }, tok));
const cta = await G('Cuentas', { plataforma: 'Netflix', nombre: 'NF-1', correo: 'nf1@x.com', clave: 'abc', perfiles: 2, costo: 200, activo: true });
ok('cuenta madre creada', cta && cta.id, cta);
const pnf = await G('Productos', { nombre: 'Netflix 1 perfil', categoria: 'Streaming', precio: 150, costo: 50, tipo: 'servicio', plataforma: 'Netflix', entrega: 'perfil', activo: true });
const vsus = okRes('venta de suscripción (perfil 1)', await api('venta', { clienteId: c2.id, items: [{ productoId: pnf.id, cantidad: 1 }], metodo: 'Efectivo', sus: [{ idx: 0, meses: 1, asig: [{ plataforma: 'Netflix', cuentaId: cta.id, perfil: 1, pin: '1111' }] }], clave: K() }, tok));
ok('devuelve datos de acceso', vsus.accesos && vsus.accesos.length === 1 && vsus.accesos[0].correo === 'nf1@x.com', vsus.accesos); E.cajaVentas += 150;
okErr('mismo perfil ocupado', await api('venta', { clienteId: c2.id, items: [{ productoId: pnf.id, cantidad: 1 }], metodo: 'Efectivo', sus: [{ idx: 0, meses: 1, asig: [{ plataforma: 'Netflix', cuentaId: cta.id, perfil: 1 }] }], clave: K() }, tok), 'ocupado');
okErr('vencimiento en el pasado', await api('venta', { clienteId: c2.id, items: [{ productoId: pnf.id, cantidad: 1 }], metodo: 'Efectivo', sus: [{ idx: 0, meses: 1, vence: '2020-01-01', asig: [{ plataforma: 'Netflix', cuentaId: cta.id, perfil: 2 }] }], clave: K() }, tok), 'pasó');
const sus1 = (await api('suscripciones', {}, tok)).data; ok('1 suscripción activa', sus1.length === 1 && sus1[0].estadoR === 'activa', sus1.map(s => s.estadoR));
okRes('anular venta de suscripción', await api('anularVenta', { id: vsus.venta.id, motivo: 'prueba' }, tok)); E.cajaVentas -= 150;
ok('la suscripción queda cancelada', (await api('suscripciones', {}, tok)).data[0].estado === 'cancelada');

/* ===================== VENTAS (lista) ===================== */
console.log('\n— Lista de ventas —');
let L = okRes('ventas (hoy)', await api('ventas', { desde: hoy, hasta: hoy }, tok));
const ventasDb = () => db.T.Ventas.filter(v => v.negocio_id === neg);
okN('ventas.n = todas las de hoy', L.n, ventasDb().length);
okN('ventas.resumen.total = suma de no anuladas', L.resumen.total, ventasDb().filter(v => !v.anulada).reduce((a, v) => a + v.total, 0));
okN('ventas.resumen.anuladas', L.resumen.anuladas, ventasDb().filter(v => v.anulada).length);
okN('ventas.resumen.credito = saldos', L.resumen.credito, 400 + 50 + 300);
const Lc = okRes('ventas por cliente', await api('ventas', { clienteId: c1.id }, tok));
ok('por cliente: solo las de Marta', Lc.n === 2 && Lc.lista.every(v => v.clienteId === c1.id), Lc.n);
ok('cada venta trae su detalle', L.lista.every(v => Array.isArray(v.detalle) && v.detalle.length > 0));
const Lcaj = okRes('ventas como cajero', await api('ventas', { desde: hoy, hasta: hoy }, tcaj));
ok('cajero no ve costos', Lcaj.lista.every(v => v.costo === undefined && v.detalle.every(d => d.costo === undefined)));
ok('rango vacío (ayer) sin ventas', (await api('ventas', { desde: ayer, hasta: ayer }, tok)).data.n === 0);

/* ===================== ANULAR VENTA ===================== */
console.log('\n— Anular venta —');
const stCafe = await stock(cafe.id), stPan = await stock(pan.id);
okRes('anular v1 (efectivo)', await api('anularVenta', { id: v1.venta.id, motivo: 'cliente devolvió' }, tok)); E.cajaVentas -= 230;
okN('anulación devuelve café +2', await stock(cafe.id), stCafe + 2); okN('anulación devuelve pan +3', await stock(pan.id), stPan + 3);
okErr('anular dos veces', await api('anularVenta', { id: v1.venta.id }, tok), 'ya está anulada');
okErr('anular inexistente', await api('anularVenta', { id: 'VNOEXISTE' }, tok), 'no existe');
okErr('cajero no anula', await api('anularVenta', { id: vt.venta.id }, tcaj));
{ const vz = ventasDb().find(v => v.id === v1.venta.id); ok('anulada: saldo 0, marca y nota', vz.anulada === true && vz.saldo === 0 && vz.anulacion && /Anulada por Vic/.test(vz.nota), vz.nota); }
// venta vieja (hace 100 días, efectivo) insertada directamente: ya no se puede anular
const msId = (dias, pref) => pref + new Date(Date.now() - dias * 86400000).getTime().toString(36).toUpperCase() + '0A0B';
const fIso = dias => new Date(Date.now() - 6 * 3600000 - dias * 86400000).toISOString().slice(0, 16);
const vieja = { id: msId(100, 'V'), numero: 'V-OLD1', fecha: fIso(100), clienteId: '', usuarioId: boot0.usuario.id, subtotal: 115, descuento: 0, isv: 15, total: 115, costo: 70, metodo: 'Efectivo', recibido: 115, cambio: 0, saldo: 0, anulada: false };
await db.aplicar({ ops: [{ t: 'Ventas', op: 'ins', n: neg, k: { id: vieja.id }, row: vieja }] });
okErr('anular venta en efectivo de hace 100 días', await api('anularVenta', { id: vieja.id }, tok), '90 días');
// venta de hace 5 días (dentro de la ventana): se anula y la caja abierta recibe la devolución
const v5 = Object.assign({}, vieja, { id: msId(5, 'V'), numero: 'V-OLD2', fecha: fIso(5) });
await db.aplicar({ ops: [{ t: 'Ventas', op: 'ins', n: neg, k: { id: v5.id }, row: v5 }] });
const cajaAntes = (await api('caja', {}, tok)).data;
okRes('anular venta efectivo de hace 5 días', await api('anularVenta', { id: v5.id }, tok));
const cajaDesp = (await api('caja', {}, tok)).data;
okN('la devolución baja la caja abierta en 115', cajaDesp.k.ventas, cajaAntes.k.ventas - 115);
okN('cuenta como anulación en caja', cajaDesp.k.anulaciones, cajaAntes.k.anulaciones + 1);
E.cajaVentas -= 115;

/* ===================== EDITAR VENTA ===================== */
console.log('\n— Editar venta —');
// vd: 2 café con descuento 20 (total 180) → 3 café sin descuento, efectivo
const stC = await stock(cafe.id);
okErr('editar sin motivo', await api('editarVenta', { id: vd.venta.id, items: [{ productoId: cafe.id, cantidad: 3 }], metodo: 'Efectivo' }, tok), 'por qué');
const ed1 = okRes('editar: 2 café c/desc → 3 café', await api('editarVenta', { id: vd.venta.id, motivo: 'faltó uno', items: [{ productoId: cafe.id, cantidad: 3 }], metodo: 'Efectivo', descuento: 0, recibido: 300 }, tok));
okN('editada: total 300', ed1.venta.total, 300); ok('editada: mismo número', ed1.venta.numero === vd.venta.numero, [ed1.venta.numero, vd.venta.numero]);
ok('editada: misma fecha', ed1.venta.fecha === vd.venta.fecha, [ed1.venta.fecha, vd.venta.fecha]);
okN('editar mueve solo la diferencia (café −1)', await stock(cafe.id), stC - 1);
{ const o = ventasDb().find(v => v.id === vd.venta.id); ok('original: anulada y corregida → nueva', o.anulada && o.corregida === ed1.venta.id); }
E.cajaVentas += 300 - 180;
okErr('editar la original otra vez', await api('editarVenta', { id: vd.venta.id, motivo: 'x', items: [{ productoId: cafe.id, cantidad: 1 }], metodo: 'Efectivo' }, tok), 'ya se editó');
okErr('editar una anulada', await api('editarVenta', { id: v1.venta.id, motivo: 'x', items: [{ productoId: cafe.id, cantidad: 1 }], metodo: 'Efectivo' }, tok), 'anulada');
L = (await api('ventas', { desde: hoy, hasta: hoy }, tok)).data;
ok('la lista no muestra la versión vieja aparte', !L.lista.some(v => v.id === vd.venta.id) && L.lista.find(v => v.id === ed1.venta.id).anterior);
// Cambiar método: efectivo → tarjeta
const ed2 = okRes('editar: cambia a tarjeta', await api('editarVenta', { id: ed1.venta.id, motivo: 'pagó con tarjeta', items: [{ productoId: cafe.id, cantidad: 3 }], metodo: 'Tarjeta' }, tok));
ok('ahora tarjeta', ed2.venta.metodo === 'Tarjeta'); okN('editar 2 veces: veces=2', JSON.parse(ed2.venta.edicion).veces, 2);
E.cajaVentas -= 300; E.tarjeta += 300;
okN('existencia café igual tras cambiar método', await stock(cafe.id), stC - 1);
// Crédito con abonos: no se puede bajar del abonado ni cambiar de cliente
const ab0 = okRes('abono 100 de Marta (a la venta de 400)', await api('abono', { clienteId: c1.id, monto: 100, metodo: 'Efectivo' }, tok)); E.cobros += 100;
okN('tras abono Marta debe 350', ab0.saldo, 350);
okErr('editar venta con abonos: total menor que lo abonado', await api('editarVenta', { id: vc1.venta.id, motivo: 'x', clienteId: c1.id, items: [{ productoId: pan.id, cantidad: 1 }], metodo: 'Crédito' }, tok), 'abon');
okErr('editar venta con abonos: cambiar de cliente', await api('editarVenta', { id: vc1.venta.id, motivo: 'x', clienteId: c2.id, items: [{ productoId: cafe.id, cantidad: 4 }], metodo: 'Crédito' }, tok), 'cliente');
okErr('editar venta con abonos: pasar a efectivo', await api('editarVenta', { id: vc1.venta.id, motivo: 'x', clienteId: c1.id, items: [{ productoId: cafe.id, cantidad: 4 }], metodo: 'Efectivo' }, tok), 'crédito');
const ed3 = okRes('editar venta a crédito: 4 → 3 café (300), conserva abono', await api('editarVenta', { id: vc1.venta.id, motivo: 'devolvió uno', clienteId: c1.id, items: [{ productoId: cafe.id, cantidad: 3 }], metodo: 'Crédito', recibido: 0 }, tok));
okN('saldo nuevo = 300 − 100 abonado', ed3.venta.saldo, 200); okN('saldoCliente Marta 250', ed3.saldoCliente, 250);
{ const a = db.T.Abonos.find(x => x.id === ab0.abono.id); ok('el abono apunta a la venta corregida', JSON.parse(a.aplicado)[0].id === ed3.venta.id); }
okErr('anular venta con abonos', await api('anularVenta', { id: ed3.venta.id }, tok), 'abonos');

/* ===================== ABONOS ===================== */
console.log('\n— Abonos —');
let cc = okRes('cuentaCliente Marta', await api('cuentaCliente', { id: c1.id }, tok));
okN('cuenta: saldo 250', cc.saldo, 250); ok('cuenta: no lista la versión corregida vieja', !cc.ventas.some(v => v.id === vc1.venta.id));
okErr('abono mayor que la deuda', await api('abono', { clienteId: c1.id, monto: 1000, metodo: 'Efectivo' }, tok), 'mayor');
okErr('abono 0', await api('abono', { clienteId: c1.id, monto: 0 }, tok), 'mayor a cero');
okErr('abono cliente inexistente', await api('abono', { clienteId: 'CX', monto: 10 }, tok), 'cliente');
const ab1 = okRes('abono 230 (cubre 200 de la primera y 30 de la segunda)', await api('abono', { clienteId: c1.id, monto: 230, metodo: 'Transferencia' }, tok)); E.transferencia += 230;
okN('saldo Marta 20', ab1.saldo, 20);
{ const ap = JSON.parse(ab1.abono.aplicado); ok('se reparte entre las dos ventas y suma 230', ap.length === 2 && cerca(ap[0].monto + ap[1].monto, 230), ap); }
const abx = okRes('abono cajero 20 efectivo', await api('abono', { clienteId: c1.id, monto: 20, metodo: 'Efectivo' }, tcaj)); E.cobros += 20;
okN('Marta en cero', abx.saldo, 0);
okRes('anularAbono (el de 230)', await api('anularAbono', { id: ab1.abono.id }, tok)); E.transferencia -= 230;
cc = (await api('cuentaCliente', { id: c1.id }, tok)).data; okN('al anular el abono vuelve a deber 230', cc.saldo, 230);
okErr('anular abono dos veces', await api('anularAbono', { id: ab1.abono.id }, tok), 'ya está');
okErr('cajero no anula abonos', await api('anularAbono', { id: abx.abono.id }, tcaj));
{ const sv = ventasDb().filter(v => v.clienteId === c1.id && !v.anulada).reduce((a, v) => a + v.saldo, 0); okN('invariante: saldo = suma saldos de ventas', cc.saldo, sv); }
okN('cuenta: totalComprado 300 + 100', cc.totalComprado, 400);

/* ===================== COMPRAS Y PROVEEDORES ===================== */
console.log('\n— Compras —');
const stC0 = await stock(cafe.id), cost0 = (await prod(cafe.id)).costo;
const cp1 = okRes('compra 10 café a 80 (efectivo)', await api('compra', { items: [{ productoId: cafe.id, cantidad: 10, costo: 80 }], metodo: 'Efectivo', factura: 'F-1' }, tok));
okN('compra total 800', cp1.compra.total, 800); E.compras += 800;
okN('compra sube existencia +10', await stock(cafe.id), stC0 + 10);
okN('costo promedio ponderado', (await prod(cafe.id)).costo, (stC0 * cost0 + 800) / (stC0 + 10), 0.001);
ok('compra número C-00001', cp1.compra.numero === 'C-00001', cp1.compra.numero);
okErr('compra crédito sin proveedor', await api('compra', { items: [{ productoId: pan.id, cantidad: 1, costo: 5 }], metodo: 'Crédito' }, tok), 'proveedor');
okErr('compra sin items', await api('compra', { items: [], metodo: 'Efectivo' }, tok));
okErr('compra de un servicio', await api('compra', { items: [{ productoId: servicio.id, cantidad: 1, costo: 5 }], metodo: 'Efectivo' }, tok), 'existencias');
okErr('compra cantidad 0', await api('compra', { items: [{ productoId: pan.id, cantidad: 0, costo: 5 }], metodo: 'Efectivo' }, tok), 'cantidad');
const stP0 = await stock(pan.id);
const cp2 = okRes('compra crédito 5 pan a 7 con fecha de ayer', await api('compra', { proveedorId: pr1.id, items: [{ productoId: pan.id, cantidad: 5, costo: 7 }], metodo: 'Crédito', fecha: ayer }, tok));
okN('compra crédito saldo 35', cp2.compra.saldo, 35); ok('fecha de ayer a mediodía', cp2.compra.fecha === ayer + 'T12:00', cp2.compra.fecha);
okN('pan +5', await stock(pan.id), stP0 + 5);
ok('proveedores con saldo 35', cp2.proveedores.find(p => p.id === pr1.id).saldo === 35);
// compra con producto nuevo y cambio de precio
const cp3 = okRes('compra con producto nuevo (y precio)', await api('compra', { proveedorId: pr1.id, items: [{ nuevo: { nombre: 'Galletas', categoria: 'Snacks' }, cantidad: 12, costo: 8, precio: 12 }], metodo: 'Efectivo' }, tok));
const gall = cp3.productos.find(p => p.nombre === 'Galletas'); E.compras += 96;
ok('producto nuevo con existencia 12, costo 8, precio 12', gall && gall.stock === 12 && gall.costo === 8 && gall.precio === 12, gall);
okErr('nuevo repetido', await api('compra', { items: [{ nuevo: { nombre: 'galletas', categoria: 'Snacks' }, cantidad: 1, costo: 8, precio: 12 }], metodo: 'Efectivo' }, tok), 'Ya existe');
// lista
const cl = okRes('compras (lista)', await api('compras', { desde: ayer, hasta: hoy }, tok));
okN('compras.n 3', cl.n, 3); okN('compras.resumen.total', cl.resumen.total, 800 + 35 + 96); okN('compras.pendiente 35', cl.resumen.pendiente, 35);
ok('compras por proveedor', (await api('compras', { proveedorId: pr1.id }, tok)).data.n === 2);
// pagos
okErr('pago mayor que el saldo', await api('pago', { proveedorId: pr1.id, monto: 100, metodo: 'Efectivo' }, tok), 'mayor');
const pg1 = okRes('pago 20 efectivo', await api('pago', { proveedorId: pr1.id, monto: 20, metodo: 'Efectivo' }, tok)); E.pagos += 20;
let cpv = okRes('cuentaProveedor', await api('cuentaProveedor', { id: pr1.id }, tok));
okN('proveedor saldo 15', cpv.saldo, 15); ok('cuentaProveedor trae compras y pagos', cpv.compras.length === 2 && cpv.pagos.length === 1);
okErr('anular compra con pagos', await api('anularCompra', { id: cp2.compra.id }, tok), 'pagos');
okRes('anularPago', await api('anularPago', { id: pg1.pago.id }, tok)); E.pagos -= 20;
okErr('anular pago dos veces', await api('anularPago', { id: pg1.pago.id }, tok), 'ya está');
cpv = (await api('cuentaProveedor', { id: pr1.id }, tok)).data; okN('saldo vuelve a 35', cpv.saldo, 35);
const stP1 = await stock(pan.id);
okRes('anularCompra (crédito pan)', await api('anularCompra', { id: cp2.compra.id }, tok));
okN('anular compra baja existencia −5', await stock(pan.id), stP1 - 5);
okN('saldo proveedor 0', (await api('cuentaProveedor', { id: pr1.id }, tok)).data.saldo, 0);
okErr('anular compra dos veces', await api('anularCompra', { id: cp2.compra.id }, tok), 'ya está');
// anular compra cuando ya se vendió parte
await api('venta', { items: [{ productoId: gall.id, cantidad: 11 }], metodo: 'Efectivo', clave: K() }, tok); E.cajaVentas += 132;
okErr('anular compra de la que ya se vendió parte', await api('anularCompra', { id: cp3.compra.id }, tok), 'vendió');
// costo promedio al anular
const stC1 = await stock(cafe.id), costC1 = (await prod(cafe.id)).costo;
okRes('anular compra de café (efectivo)', await api('anularCompra', { id: cp1.compra.id }, tok)); E.compras -= 800;
okN('café −10', await stock(cafe.id), stC1 - 10);
okN('costo vuelve al anterior', (await prod(cafe.id)).costo, cost0, 0.01);
// fecha futura se ignora (queda hoy)
const cpf = okRes('compra con fecha futura', await api('compra', { items: [{ productoId: pan.id, cantidad: 1, costo: 6 }], metodo: 'Transferencia', fecha: '2099-01-01' }, tok));
ok('fecha futura → hoy', cpf.compra.fecha.slice(0, 10) === hoy, cpf.compra.fecha);

/* ===================== GASTOS ===================== */
console.log('\n— Gastos —');
okErr('gasto sin categoría', await api('guardarGasto', { registro: { detalle: 'x', monto: 10 } }, tok), 'categoría');
okErr('gasto sin detalle', await api('guardarGasto', { registro: { categoria: 'Luz', monto: 10 } }, tok), 'detalle');
okErr('gasto monto 0', await api('guardarGasto', { registro: { categoria: 'Luz', detalle: 'Recibo', monto: 0 } }, tok), 'mayor a cero');
okErr('gasto fecha futura', await api('guardarGasto', { registro: { categoria: 'Luz', detalle: 'Recibo', monto: 10, fechaGasto: '2099-01-01' } }, tok), 'futura');
const g1 = okRes('gasto efectivo 150', await api('guardarGasto', { registro: { categoria: 'Luz', detalle: 'Recibo ENEE', monto: 150, metodo: 'Efectivo' } }, tok)); E.gastos += 150;
ok('gasto queda con fecha de hoy', g1.gasto.fechaGasto === hoy);
const g2 = okRes('gasto tarjeta 80 (ayer)', await api('guardarGasto', { registro: { categoria: 'luz', detalle: 'recibo enee', monto: 80, metodo: 'Tarjeta', fechaGasto: ayer } }, tok));
ok('categoría y detalle se unifican (Luz / Recibo ENEE)', g2.gasto.categoria === 'Luz' && g2.gasto.detalle === 'Recibo ENEE', [g2.gasto.categoria, g2.gasto.detalle]);
ok('método inválido → Efectivo', (await api('guardarGasto', { registro: { categoria: 'Varios', detalle: 'Bolsas', monto: 25, metodo: 'Cheque' } }, tok)).data.gasto.metodo === 'Efectivo'); E.gastos += 25;
const g3 = okRes('gasto cajero 40', await api('guardarGasto', { registro: { categoria: 'Transporte', detalle: 'Taxi', monto: 40, metodo: 'Efectivo' } }, tcaj)); E.gastos += 40;
const g3e = okRes('editar gasto (monto 150 → 120)', await api('guardarGasto', { registro: { id: g1.gasto.id, categoria: 'Luz', detalle: 'Recibo ENEE', monto: 120, metodo: 'Efectivo' } }, tok)); E.gastos -= 30;
okN('gasto editado 120', g3e.gasto.monto, 120);
okErr('cajero edita gasto ajeno', await api('guardarGasto', { registro: { id: g1.gasto.id, categoria: 'Luz', detalle: 'Recibo ENEE', monto: 1, metodo: 'Efectivo' } }, tcaj), 'registraste');
let gl = okRes('gastos (lista hoy)', await api('gastos', { desde: hoy, hasta: hoy }, tok));
okN('3 gastos hoy', gl.length, 3);
ok('cajero solo ve los suyos', (await api('gastos', { desde: ayer, hasta: hoy }, tcaj)).data.length === 1);
okN('rango ayer-hoy: 4', (await api('gastos', { desde: ayer, hasta: hoy }, tok)).data.length, 4);
okRes('anularGasto', await api('anularGasto', { id: g3.gasto.id }, tok)); E.gastos -= 40;
okErr('anular gasto dos veces', await api('anularGasto', { id: g3.gasto.id }, tok), 'ya está');
okErr('editar gasto anulado', await api('guardarGasto', { registro: { id: g3.gasto.id, categoria: 'Transporte', detalle: 'Taxi', monto: 5 } }, tok), 'anulado');
okErr('cajero no anula gastos', await api('anularGasto', { id: g1.gasto.id }, tcaj));

/* ===================== CAJA ===================== */
console.log('\n— Caja —');
const cajaDb = () => { // lo que debería haber según la base, desde el último cierre (hoy 00:00 si no hay)
  const N = t => db.T[t].filter(x => x.negocio_id === neg);
  const ci = N('Cierres').sort((a, b) => Number(b.marca) - Number(a.marca))[0];
  const desdeMs = ci ? Number(ci.marca) : Date.parse(hoy + 'T00:00:00-06:00') - 1;
  const ms = id => parseInt(String(id).slice(1, 9), 36), en = id => ms(id) > desdeMs;
  const k = { ventas: 0, cobros: 0, gastos: 0, pagos: 0, compras: 0, tarjeta: 0, transferencia: 0 };
  N('Ventas').forEach(v => { const efe = v.metodo === 'Efectivo' || (v.metodo === 'Crédito' && v.recibido > 0); if (en(v.id)) { if (v.anulada) return; if (v.metodo === 'Efectivo') k.ventas += v.total - (v.anticipo || 0); else if (v.metodo === 'Crédito') k.ventas += v.recibido; else if (v.metodo === 'Tarjeta') k.tarjeta += v.total - (v.anticipo || 0); else k.transferencia += v.total - (v.anticipo || 0); } else if (v.anulada && efe && Number(v.anulacion) > desdeMs) { if (v.metodo === 'Efectivo') k.ventas -= v.total; else k.ventas -= v.recibido; } });
  N('Abonos').forEach(a => { if (en(a.id)) { if (a.anulado) return; if (a.metodo === 'Efectivo') k.cobros += a.monto; else if (a.metodo === 'Tarjeta') k.tarjeta += a.monto; else k.transferencia += a.monto; } else if (a.anulado && a.metodo === 'Efectivo' && Number(a.anulacion) > desdeMs) k.cobros -= a.monto; });
  N('Gastos').forEach(g => { if (g.metodo !== 'Efectivo') return; if (en(g.id)) { if (!g.anulado) k.gastos += g.monto; } else if (g.anulado && Number(g.anulacion) > desdeMs) k.gastos -= g.monto; });
  N('Pagos').forEach(p => { if (p.metodo !== 'Efectivo') return; if (en(p.id)) { if (!p.anulado) k.pagos += p.monto; } else if (p.anulado && Number(p.anulacion) > desdeMs) k.pagos -= p.monto; });
  N('Compras').forEach(c => { if (c.metodo !== 'Efectivo') return; if (en(c.id)) { if (!c.anulada) k.compras += c.total; } else if (c.anulada && Number(c.anulacion) > desdeMs) k.compras -= c.total; });
  Object.keys(k).forEach(x => { k[x] = Math.round(k[x] * 100) / 100; });
  return k;
};
let caja = okRes('caja', await api('caja', {}, tok));
const cmp = (nombre, k) => { const d = cajaDb(); ['ventas', 'cobros', 'gastos', 'pagos', 'compras', 'tarjeta', 'transferencia'].forEach(x => okN(nombre + ' k.' + x, k[x], d[x])); };
cmp('caja', caja.k);
okN('caja.k.ventas = libro propio', caja.k.ventas, E.cajaVentas); okN('caja.k.cobros = libro propio', caja.k.cobros, E.cobros);
okN('caja.k.gastos = libro propio', caja.k.gastos, E.gastos); okN('caja.k.compras = libro propio', caja.k.compras, E.compras); okN('caja.k.pagos', caja.k.pagos, E.pagos);
okN('caja.k.tarjeta', caja.k.tarjeta, E.tarjeta); okN('caja.k.transferencia', caja.k.transferencia, E.transferencia);
okN('caja.k.credito = saldos al crédito del día', caja.k.credito, ventasDb().filter(v => !v.anulada && v.metodo === 'Crédito' && new Date(parseInt(v.id.slice(1, 9), 36) - 6 * 3600000).toISOString().slice(0, 10) === hoy).reduce((a, v) => a + v.total - v.recibido, 0));
ok('caja.desde = hoy 00:00 (sin cierres)', caja.desde === hoy + 'T00:00', caja.desde);
ok('caja.ventasHoy lista', Array.isArray(caja.ventasHoy) && caja.ventasHoy.length > 5);
// Cerrar caja
const esperado = caja.fondo + caja.k.ventas + caja.k.cobros - caja.k.gastos - caja.k.pagos - caja.k.compras;
okErr('cerrar sin contado', await api('cerrarCaja', {}, tok), 'contaste');
okErr('cerrar contado negativo', await api('cerrarCaja', { contado: -5 }, tok), 'contaste');
const z1 = okRes('cerrarCaja contado = esperado − 10, fondo 200', await api('cerrarCaja', { contado: Math.round((esperado - 10) * 100) / 100, fondo: 200, nota: 'primer cierre' }, tok));
okN('cierre.esperado = fondo + ventas + cobros − gastos − pagos − compras', z1.cierre.esperado, esperado + 200);
okN('cierre.diferencia = −210 (fondo 200 no contado, −10)', z1.cierre.diferencia, -210);
okN('cierre.ventas', z1.cierre.ventas, caja.k.ventas); okN('cierre.gastos incluye compras en efectivo', z1.cierre.gastos, caja.k.gastos + caja.k.compras);
ok('tras cerrar la caja arranca en cero', z1.caja.k.ventas === 0 && z1.caja.k.gastos === 0 && z1.caja.k.cobros === 0, z1.caja.k);
ok('caja.desde = hasta del cierre', z1.caja.desde === z1.cierre.hasta, [z1.caja.desde, z1.cierre.hasta]);
okErr('segundo cierre inmediato', await api('cerrarCaja', { contado: 0 }, tok), 'Espera');
await esperar(3200);
const z2 = okRes('segundo cierre del día (tras 3 s) sin movimientos', await api('cerrarCaja', { contado: 0, fondo: 0 }, tok));
okN('segundo cierre esperado 0', z2.cierre.esperado, 0); okN('segundo cierre diferencia 0', z2.cierre.diferencia, 0);
// Movimientos después del cierre y anulación de algo que ya estaba cerrado
const vpost = okRes('venta efectivo después del cierre', await api('venta', { items: [{ productoId: pan.id, cantidad: 4 }], metodo: 'Efectivo', clave: K() }, tok));
okRes('anular venta de servicio (cerrada antes, efectivo 500)', await api('anularVenta', { id: vs.venta.id }, tok));
caja = (await api('caja', {}, tok)).data;
okN('caja nueva: 40 − 500 (devolución de lo ya cerrado)', caja.k.ventas, 40 - 500); okN('anulaciones 1', caja.k.anulaciones, 1);
cmp('caja tras cierre', caja.k);
ok('cierres listados: 2', caja.cierres.length === 2 && caja.cierres[0].usuario === 'Vic');
okErr('cajero: cerrar sin contado falla', await api('cerrarCaja', {}, tcaj));

/* ===================== REPORTE ===================== */
console.log('\n— Reporte —');
const rep = okRes('reporte hoy', await api('reporte', { desde: hoy, hasta: hoy }, tok));
const act = ventasDb().filter(v => !v.anulada && v.fecha.slice(0, 10) === hoy);
okN('kpi.ventas = suma ventas activas de hoy', rep.kpi.ventas, act.reduce((a, v) => a + v.total, 0));
okN('kpi.n', rep.kpi.n, act.length);
okN('kpi.isv', rep.kpi.isv, act.reduce((a, v) => a + v.isv, 0));
okN('kpi.costo', rep.kpi.costo, act.reduce((a, v) => a + v.costo, 0));
okN('kpi.descuentos', rep.kpi.descuentos, act.reduce((a, v) => a + v.descuento, 0));
okN('kpi.credito = total − recibido de las de crédito', rep.kpi.credito, act.filter(v => v.metodo === 'Crédito').reduce((a, v) => a + v.total - v.recibido, 0));
okN('kpi.bruta = ventas − isv − costo', rep.kpi.bruta, rep.kpi.ventas - rep.kpi.isv - rep.kpi.costo, 0.02);
const gHoy = db.T.Gastos.filter(g => g.negocio_id === neg && !g.anulado && g.fechaGasto === hoy).reduce((a, g) => a + g.monto, 0);
okN('kpi.gastos = gastos de hoy no anulados', rep.kpi.gastos, gHoy);
okN('kpi.neta = bruta − gastos', rep.kpi.neta, rep.kpi.bruta - rep.kpi.gastos, 0.02);
okN('kpi.cobros', rep.kpi.cobros, db.T.Abonos.filter(a => a.negocio_id === neg && !a.anulado).reduce((a, x) => a + x.monto, 0));
okN('kpi.compras (hoy)', rep.kpi.compras, db.T.Compras.filter(c => c.negocio_id === neg && !c.anulada && c.fecha.slice(0, 10) === hoy).reduce((a, c) => a + c.total, 0));
okN('kpi.pagos', rep.kpi.pagos, 0);
okN('kpi.anuladas (sin contar editadas)', rep.kpi.anuladas, ventasDb().filter(v => v.anulada && !v.corregida && v.fecha.slice(0, 10) === hoy).length);
okN('kpi.clientesNuevos 2', rep.kpi.clientesNuevos, 2);
okN('porMetodo suma = kpi.ventas', rep.porMetodo.reduce((a, m) => a + m.total, 0), rep.kpi.ventas, 0.02);
okN('porDia[hoy] = kpi.ventas', rep.porDia[hoy], rep.kpi.ventas, 0.02);
okN('top: suma de totales = suma de líneas', rep.top.reduce((a, t) => a + t.total, 0), db.T.VentaDetalle.filter(d => d.negocio_id === neg && act.some(v => v.id === d.ventaId)).reduce((a, d) => a + d.total, 0), 0.05);
okN('usuarios: suma = kpi.ventas', rep.usuarios.reduce((a, u) => a + u.ventas, 0), rep.kpi.ventas, 0.02);
const repG = okRes('reporte por giro (tienda)', await api('reporte', { desde: hoy, hasta: hoy, giro: 'tienda' }, tok));
okN('por giro único: mismas ventas', repG.kpi.ventas, rep.kpi.ventas, 0.02);
okN('por giro único: mismo ISV', repG.kpi.isv, rep.kpi.isv, 0.05);
const repA = okRes('reporte de ayer', await api('reporte', { desde: ayer, hasta: ayer }, tok));
okN('ayer: sin ventas', repA.kpi.ventas, 0); okN('ayer: gasto tarjeta 80', repA.kpi.gastos, 80);
okN('ayer: compras 0 (la de crédito se anuló)', repA.kpi.compras, 0);
okErr('cajero no ve el reporte', await api('reporte', { desde: hoy, hasta: hoy }, tcaj));
// cuadre reporte vs ventas()
const Lh = (await api('ventas', { desde: hoy, hasta: hoy }, tok)).data;
okN('reporte.kpi.ventas = ventas().resumen.total', rep.kpi.ventas, Lh.resumen.total, 0.02);

/* ===================== DIARIO, CUENTAS, INVENTARIO, KARDEX ===================== */
console.log('\n— Diario / cuentas / inventario —');
const dia = okRes('diario mes actual', await api('diario', { mes: mesAct }, tok));
const nMov = ventasDb().filter(v => v.fecha.slice(0, 7) === mesAct).length + db.T.Abonos.filter(a => a.negocio_id === neg).length + db.T.Gastos.filter(g => g.negocio_id === neg && g.fechaGasto.slice(0, 7) === mesAct).length + db.T.Compras.filter(c => c.negocio_id === neg && c.fecha.slice(0, 7) === mesAct).length + db.T.Pagos.filter(p => p.negocio_id === neg).length;
okN('diario: un movimiento por documento', dia.movimientos.length, nMov);
okN('diario.resumen.ventas = no anuladas del mes', dia.resumen.ventas, ventasDb().filter(v => !v.anulada && v.fecha.slice(0, 7) === mesAct).reduce((a, v) => a + v.total, 0));
okN('diario.resumen.gastos', dia.resumen.gastos, db.T.Gastos.filter(g => g.negocio_id === neg && !g.anulado && g.fechaGasto.slice(0, 7) === mesAct).reduce((a, g) => a + g.monto, 0));
ok('diario ordenado por fecha', dia.movimientos.every((m, i, a) => !i || a[i - 1].fecha <= m.fecha));
ok('mes inválido → mes actual', (await api('diario', { mes: 'zz' }, tok)).data.mes === mesAct);
const cu = okRes('cuentas (antigüedad)', await api('cuentas', {}, tok));
okN('cuentas.cobrar Marta 230', (cu.cobrar.find(c => c.id === c1.id) || {}).total, 230);
okN('cuentas.cobrar Pedro 300', (cu.cobrar.find(c => c.id === c2.id) || {}).total, 300);
ok('cuentas.cobrar todo a 30 días', cu.cobrar.every(c => c.a30 === c.total));
okN('cuentas.pagar vacío', cu.pagar.length, 0);
const inv = okRes('inventario', await api('inventario', {}, tok));
const P = await prods();
okN('inventario: valor a costo = Σ stock × costo', inv.productos.reduce((a, p) => a + p.valorCosto, 0), P.filter(p => p.tipo === 'producto').reduce((a, p) => a + Math.max(0, p.stock) * p.costo, 0), 0.05);
ok('inventario: existencias coinciden con productos', inv.productos.every(p => p.stock === P.find(x => x.id === p.id).stock));
okN('inventario: vendidos30 café', inv.productos.find(p => p.id === cafe.id).vendidos30, db.T.VentaDetalle.filter(d => d.negocio_id === neg && d.productoId === cafe.id && ventasDb().find(v => v.id === d.ventaId && !v.anulada)).reduce((a, d) => a + d.cantidad, 0));
const kx = okRes('kardex café', await api('kardex', { id: cafe.id }, tok));
ok('kardex: el último movimiento deja el stock actual', kx[0].stock === (await stock(cafe.id)), [kx[0].stock, await stock(cafe.id)]);
okN('kardex: Σ cantidades = existencia', kx.reduce((a, m) => a + m.cantidad, 0), await stock(cafe.id));
ok('kardex: tipos esperados', ['inicial', 'venta', 'anulación', 'compra'].every(t => kx.some(m => m.tipo === t)), [...new Set(kx.map(m => m.tipo))]);
okErr('cajero no ve kardex', await api('kardex', { id: cafe.id }, tcaj));
// Invariante global: existencia = Σ movimientos de inventario, por producto y por variante
{ let malos = []; P.filter(p => p.tipo === 'producto').forEach(p => { const s = db.T.Inventario.filter(m => m.negocio_id === neg && m.productoId === p.id).reduce((a, m) => a + m.cantidad, 0); if (Math.abs(s - p.stock) > 0.001) malos.push(p.nombre + ' ' + s + '≠' + p.stock); });
  ok('invariante: existencia = Σ kardex (todos los productos)', !malos.length, malos);
  const cv = P.find(p => p.id === camisa.id), V = JSON.parse(cv.variantes); const sv = Object.keys(V).reduce((a, k) => a + V[k].s, 0);
  ok('invariante: Σ tallas = existencia camisa', sv === cv.stock, [sv, cv.stock]); }

/* ===================== DISTRIBUCIÓN DE GANANCIA ===================== */
console.log('\n— Distribución de ganancia —');
okErr('distribuir el mes en curso', await api('guardarDistribucion', { registro: { mes: mesAct, tipo: 'cuenta', destino: 'Ahorro', monto: 10 } }, tok), 'cerrados');
okErr('mes sin ganancia', await api('guardarDistribucion', { registro: { mes: mesAnt, tipo: 'cuenta', destino: 'Ahorro', monto: 10 } }, tok), 'ganancia');
// venta del mes anterior: 1000 total, 130.43 isv, 500 costo → utilidad 369.57
const vAnt = { id: msId(40, 'V'), numero: 'V-ANT', fecha: mesAnt + '-15T10:00', clienteId: '', usuarioId: boot0.usuario.id, subtotal: 1000, descuento: 0, isv: 130.43, total: 1000, costo: 500, metodo: 'Tarjeta', recibido: 1000, cambio: 0, saldo: 0, anulada: false };
await db.aplicar({ ops: [{ t: 'Ventas', op: 'ins', n: neg, k: { id: vAnt.id }, row: vAnt }] });
const dist = okRes('distribuir 200 a Ahorro', await api('guardarDistribucion', { registro: { mes: mesAnt, tipo: 'cuenta', destino: 'Ahorro', monto: 200 } }, tok));
{ const m = dist.meses.find(x => x.mes === mesAnt); okN('utilidad del mes 369.57', m.utilidad, 369.57); okN('pendiente 169.57', m.pendiente, 169.57); okN('asignado 200', m.asignado, 200); }
okErr('distribuir más de lo disponible (200 > 169.57)', await api('guardarDistribucion', { registro: { mes: mesAnt, tipo: 'pago', destino: 'Préstamo', monto: 200 } }, tok), 'supera');
okErr('sin destino', await api('guardarDistribucion', { registro: { mes: mesAnt, tipo: 'pago', monto: 10 } }, tok), 'Indica');
const dist2 = okRes('pago 169.57 (lo que queda)', await api('guardarDistribucion', { registro: { mes: mesAnt, tipo: 'pago', destino: 'Préstamo', monto: 169.57 } }, tok));
okN('pendiente 0', dist2.meses.find(x => x.mes === mesAnt).pendiente, 0);
ok('destino unificado (ahorro → Ahorro)', (await api('guardarDistribucion', { registro: { mes: mesAnt, tipo: 'cuenta', destino: 'ahorro', monto: 1 } }, tok)).ok === false);
const d1 = dist2.distribuciones.find(x => x.destino === 'Ahorro');
const an = okRes('anularDistribucion', await api('anularDistribucion', { id: d1.id }, tok));
okN('tras anular pendiente 200', an.meses.find(x => x.mes === mesAnt).pendiente, 200);
okErr('anular distribución dos veces', await api('anularDistribucion', { id: d1.id }, tok), 'Ya estaba');
const hist = okRes('historial', await api('historial', {}, tok)); ok('historial trae pagos por destino', hist.pagos.some(p => p.destino === 'Préstamo' && p.total === 169.57));

/* ===================== PEDIDO EN LÍNEA: pedidoPago ===================== */
console.log('\n— Pedido en línea (pedidoPago) —');
okRes('activar tienda', await api('guardar', { entidad: 'Config', registro: { tienda: 'si', tiendaPagos: 'Efectivo,Transferencia' } }, tok));
const ped = okRes('pedir (cliente de la tienda)', await api('pedir', { negocio: neg, nombre: 'Carla Ruiz', telefono: '98765432', entrega: 'recoger', pago: 'Transferencia', items: [{ id: pan.id, cantidad: 3 }] }));
okN('pedido total 30', ped.total, 30);
okErr('pedidoPago inexistente', await api('pedidoPago', { id: 'PX', ok: true }, tok), 'no existe');
const pp = okRes('pedidoPago ok', await api('pedidoPago', { id: ped.id, ok: true }, tok));
ok('pago confirmado, anticipo = total', pp.pagoEstado === 'ok' && pp.anticipoPagado === 30, pp);
E.transferencia += 30;
okErr('confirmar dos veces', await api('pedidoPago', { id: ped.id, ok: true }, tok), 'ya está');
{ const a = db.T.Abonos.filter(x => x.negocio_id === neg && x.ref === ped.id); ok('anticipo registrado como abono por transferencia', a.length === 1 && a[0].metodo === 'Transferencia' && a[0].monto === 30, a); }
const stPan2 = await stock(pan.id);
const vped = okRes('cobrar el pedido pagado', await api('venta', { pedidoId: ped.id, items: [{ productoId: pan.id, cantidad: 3, precio: 10 }], metodo: 'Efectivo', recibido: 0, clave: K() }, tok));
okN('venta del pedido: anticipo 30, total 30, cambio 0', vped.venta.anticipo + vped.venta.total + vped.venta.cambio, 60);
okN('pan −3', await stock(pan.id), stPan2 - 3);
okErr('cobrar el pedido otra vez', await api('venta', { pedidoId: ped.id, items: [{ productoId: pan.id, cantidad: 3 }], metodo: 'Efectivo', clave: K() }, tok), 'ya se cobró');
caja = (await api('caja', {}, tok)).data; cmp('caja con pedido', caja.k);
okErr('editar venta con anticipo', await api('editarVenta', { id: vped.venta.id, motivo: 'x', items: [{ productoId: pan.id, cantidad: 2 }], metodo: 'Efectivo' }, tok), 'anticipo');
okRes('anular venta del pedido', await api('anularVenta', { id: vped.venta.id }, tok));
ok('el pedido vuelve a «listo»', db.T.Pedidos.find(p => p.id === ped.id).estado === 'listo');
const pp2 = okRes('pedidoPago no coincide (otro pedido)', await api('pedir', { negocio: neg, nombre: 'Ana López', telefono: '98765433', entrega: 'recoger', pago: 'Transferencia', items: [{ id: pan.id, cantidad: 1 }] }).then(r => api('pedidoPago', { id: r.data.id, ok: false }, tok)));
ok('pagoEstado no', pp2.pagoEstado === 'no' && pp2.anticipoPagado === 0);

/* ===================== COBRO DE LICENCIA: cobroComprobante ===================== */
console.log('\n— cobroComprobante (licencia) —');
const FOTO = 'data:image/jpeg;base64,' + Buffer.from('comprobante').toString('base64');
okErr('sin cuotas pendientes', await api('cobroComprobante', { foto: FOTO }, tok), 'pendientes');
const pt = (await api('panelLogin', { clave: 'c' })).data.token;
const en3 = new Date(Date.now() - 6 * 3600000 + 3 * 86400000).toISOString().slice(0, 10);
okRes('panel programa cuota', await api('panelCuotas', { id: neg, accion: 'programar', monto: 350, fecha: en3, veces: 1, concepto: 'Licencia' }, undefined, { panel: pt }));
okErr('cajero no manda comprobante', await api('cobroComprobante', { foto: FOTO }, tcaj));
okErr('comprobante que no es foto', await api('cobroComprobante', { foto: 'data:text/plain;base64,aG9sYQ==' }, tok), 'foto');
const cr = okRes('dueño manda comprobante', await api('cobroComprobante', { foto: FOTO }, tok));
ok('cuota queda por revisar', cr.proxima && cr.proxima.r === 'revisar' && cr.proxima.m === 350, cr);
const cr2 = okRes('reenvía comprobante', await api('cobroComprobante', { foto: FOTO }, tok));
ok('sigue en revisar', cr2.proxima.r === 'revisar');

/* ===================== FACTURACIÓN SAR ===================== */
console.log('\n— Facturación SAR —');
const CAI = '1A2B3C-4D5E6F-7A8B9C-0D1E2F-3A4B5C-6D';
const base = { activo: true, razon: 'Pulpería Prueba', rtn: '05011990123456', direccion: 'Col. Centro, SPS', cai: CAI, est: '1', punto: '2', desde: 1, hasta: 3, limite: '2027-12-31' };
okErr('SAR: RTN corto', await api('guardarSAR', { registro: Object.assign({}, base, { rtn: '123' }) }, tok), 'RTN');
okErr('SAR: CAI mal formado', await api('guardarSAR', { registro: Object.assign({}, base, { cai: 'ABC-123' }) }, tok), 'CAI');
okErr('SAR: rango invertido', await api('guardarSAR', { registro: Object.assign({}, base, { desde: 10, hasta: 5 }) }, tok), 'rango');
okErr('SAR: fecha límite pasada', await api('guardarSAR', { registro: Object.assign({}, base, { limite: '2020-01-01' }) }, tok), 'pasó');
okErr('SAR: sin dirección', await api('guardarSAR', { registro: Object.assign({}, base, { direccion: '' }) }, tok), 'dirección');
okErr('SAR: último usado fuera del rango', await api('guardarSAR', { registro: Object.assign({}, base, { ultimo: 9 }) }, tok), 'rango');
const sar = okRes('guardarSAR (rango 1–3)', await api('guardarSAR', { registro: base }, tok));
ok('estado SAR aviso (quedan ≤ 50), siguiente 001-002-01-00000001', sar.sar.estado === 'aviso' && sar.sar.siguiente === '001-002-01-00000001' && sar.sar.quedan === 3, sar.sar);
const f1 = okRes('factura 1', await api('venta', { items: [{ productoId: cafe.id, cantidad: 1 }, { productoId: pan.id, cantidad: 1 }], metodo: 'Efectivo', clave: K() }, tok));
ok('número 001-002-01-00000001', f1.venta.factura === '001-002-01-00000001', f1.venta.factura);
{ const fz = JSON.parse(f1.venta.fiscal); ok('fiscal: cai, rango, desglose', fz.cai === CAI && fz.desde === '001-002-01-00000001' && fz.hasta === '001-002-01-00000003' && cerca(fz.g15, 86.96) && cerca(fz.i15, 13.04) && fz.exento === 10 && /LEMPIRAS/.test(fz.letras), fz); }
okErr('SAR: RTN de cliente inválido', await api('venta', { items: [{ productoId: pan.id, cantidad: 1 }], metodo: 'Efectivo', fiscal: { rtn: '123' }, clave: K() }, tok), 'RTN');
okErr('SAR: exonerado sin constancia', await api('venta', { items: [{ productoId: pan.id, cantidad: 1 }], metodo: 'Efectivo', fiscal: { exonerado: true }, clave: K() }, tok), 'exonerad');
const f2 = okRes('factura 2 con RTN del cliente y exonerada', await api('venta', { items: [{ productoId: cafe.id, cantidad: 1 }], metodo: 'Efectivo', fiscal: { nombre: 'Empresa X', rtn: '08019999123456', exonerado: true, oce: 'OCE-1' }, clave: K() }, tok));
{ const fz = JSON.parse(f2.venta.fiscal); ok('exonerada: va a exonerado, ISV 0', fz.exonerado === 86.96 && f2.venta.isv === 0 && f2.venta.total === 86.96 && fz.rtn === '08019999123456', [fz, f2.venta.isv, f2.venta.total]); }
ok('factura 2 correlativa', f2.venta.factura === '001-002-01-00000002', f2.venta.factura);
// editar factura 1: la corregida toma la 3 y fecha de hoy
const ef = okRes('editar factura 1 (toma número nuevo)', await api('editarVenta', { id: f1.venta.id, motivo: 'cambio', items: [{ productoId: cafe.id, cantidad: 2 }], metodo: 'Efectivo' }, tok));
ok('corregida = factura 3, fecha de hoy', ef.venta.factura === '001-002-01-00000003' && ef.venta.fecha.slice(0, 10) === hoy, [ef.venta.factura, ef.venta.fecha]);
ok('SAR agotado tras la 3', ef.sar.estado === 'agotado', ef.sar);
okErr('sin números: no se vende', await api('venta', { items: [{ productoId: pan.id, cantidad: 1 }], metodo: 'Efectivo', clave: K() }, tok), 'terminaron');
okErr('venta sin número NO abre un hueco de factura (rechazo antes de numerar)', await api('venta', { items: [{ productoId: pan.id, cantidad: 999 }], metodo: 'Efectivo', clave: K() }, tok));
const lib = okRes('libroSAR mes', await api('libroSAR', { mes: mesAct }, tok));
okN('libro: 3 filas (1 anulada por edición)', lib.filas.length, 3); okN('libro: emitidas 2', lib.emitidas, 2); okN('libro: anuladas 1', lib.anuladas, 1);
ok('libro: primera y última', lib.primera === '001-002-01-00000001' && lib.ultima === '001-002-01-00000003', [lib.primera, lib.ultima]);
okN('libro: total = suma de no anuladas', lib.tot.total, f2.venta.total + ef.venta.total);
okN('libro: i15 total', lib.tot.i15, ef.venta.isv);
okN('libro: exonerado', lib.tot.exonerado, 86.96);
okErr('nuevo rango con número ya emitido', await api('guardarSAR', { registro: Object.assign({}, base, { hasta: 10, ultimo: 2 }) }, tok), 'Ya se emitió');
okErr('ampliar rango sin indicar el último usado: lo rechaza (cambió el rango → arranca en 1)', await api('guardarSAR', { registro: Object.assign({}, base, { hasta: 10 }) }, tok), 'Ya se emitió');
const sar2 = okRes('ampliar rango a 10 indicando último = 3', await api('guardarSAR', { registro: Object.assign({}, base, { hasta: 10, ultimo: 3 }) }, tok));
ok('siguiente 00000004', sar2.sar.siguiente === '001-002-01-00000004', sar2.sar);
const sar3 = okRes('CAI nuevo: numeración arranca en el inicio del rango', await api('guardarSAR', { registro: Object.assign({}, base, { cai: 'AAAAAA-BBBBBB-CCCCCC-DDDDDD-EEEEEE-FF', desde: 50, hasta: 60 }) }, tok));
ok('siguiente 00000050', sar3.sar.siguiente === '001-002-01-00000050', sar3.sar);
okErr('CAI con límite en 10 días no, pero vencido sí falla', await api('guardarSAR', { registro: Object.assign({}, base, { limite: ayer }) }, tok), 'pasó');
const off = okRes('apagar SAR', await api('guardarSAR', { registro: { activo: false } }, tok));
ok('SAR apagado', off.sar.activo === false);
const sinF = okRes('venta sin SAR', await api('venta', { items: [{ productoId: pan.id, cantidad: 1 }], metodo: 'Efectivo', clave: K() }, tok));
ok('sin factura fiscal', sinF.venta.factura === '');

/* ===================== MES CERRADO (Contabilidad) ===================== */
console.log('\n— Mes cerrado en Contabilidad —');
await db.aplicar({ ops: [{ t: 'Licencias', op: 'upd', k: { id: neg }, row: { contab: 'si' } }] });
okRes('cerrar mes anterior', await api('cerrarPeriodo', { mes: mesAnt }, tok));
okErr('gasto con fecha de mes cerrado', await api('guardarGasto', { registro: { categoria: 'Luz', detalle: 'Viejo', monto: 10, fechaGasto: mesAnt + '-10' } }, tok), 'cerrado');
okErr('compra con fecha de mes cerrado', await api('compra', { items: [{ productoId: pan.id, cantidad: 1, costo: 5 }], metodo: 'Efectivo', fecha: mesAnt + '-10' }, tok), 'cerrado');
ok('gasto de hoy sigue permitido', (await api('guardarGasto', { registro: { categoria: 'Luz', detalle: 'Hoy', monto: 10 } }, tok)).ok);

/* ===================== INVARIANTES FINALES ===================== */
console.log('\n— Invariantes finales —');
const Pf = await prods();
{ let malos = []; Pf.filter(p => p.tipo === 'producto').forEach(p => { const s = db.T.Inventario.filter(m => m.negocio_id === neg && m.productoId === p.id).reduce((a, m) => a + m.cantidad, 0); if (Math.abs(s - p.stock) > 0.001) malos.push(p.nombre + ' ' + s + '≠' + p.stock); });
  ok('existencia = Σ kardex (final)', !malos.length, malos); }
caja = (await api('caja', {}, tok)).data; cmp('caja final', caja.k);
{ const sc = {}; ventasDb().forEach(v => { if (!v.anulada && v.saldo > 0.004 && v.clienteId) sc[v.clienteId] = (sc[v.clienteId] || 0) + v.saldo; });
  for (const c of [c1, c2]) { const x = (await api('cuentaCliente', { id: c.id }, tok)).data; okN('saldo ' + c.nombre + ' = Σ saldos', x.saldo, sc[c.id] || 0); } }
{ const b = (await api('bootstrap', {}, tok)).data; ok('bootstrap: clientes traen saldo', b.clientes.find(c => c.id === c1.id).saldo === 230, b.clientes.map(c => c.saldo)); }
{ const ini = (await api('inicio', {}, tok)).data; okN('inicio.porCobrar = 230 + 300', ini.porCobrar.total, 530);
  const esp = (Number(caja.fondo) || 0) + caja.k.ventas + caja.k.cobros - caja.k.gastos - caja.k.pagos - caja.k.compras; okN('inicio.caja = esperado de caja', ini.caja, esp); }

console.log('\n' + pasadas + ' pasadas · ' + fallidas + ' fallidas');
if (fallidas) { console.log('Fallos:'); fallos.forEach(f => console.log('  - ' + f)); process.exitCode = 1; }
