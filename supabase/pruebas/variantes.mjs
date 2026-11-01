// Existencia y precio por opción + carga desde Excel en el Panel (servidor simulado)
import fs from 'node:fs'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const SRC = fs.readFileSync(process.argv[2], 'utf8');
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), log: () => {}, urlArchivo: r => 'https://x/' + r, rutaDeUrl: () => null });
const api = (action, data, token, extra) => srv.atender(Object.assign({ action, token, data: data || {} }, extra || {}));
let fallas = 0;
const ok = (n, r) => { if (!r.ok) fallas++; console.log((r.ok ? '✓ ' : '✗ ') + n + (r.ok ? '' : ': ' + r.error)); return r.data; };
const no = (n, r) => { if (r.ok) fallas++; console.log((r.ok ? '✗ (debió fallar) ' : '✓ ') + n + (r.ok ? '' : ' → ' + r.error)); };
const igual = (n, a, b) => { const x = JSON.stringify(a) === JSON.stringify(b); if (!x) fallas++; console.log((x ? '✓ ' : '✗ ') + n + ': ' + JSON.stringify(a) + (x ? '' : ' (esperado ' + JSON.stringify(b) + ')')); };
const tok = (await api('registrar', { negocio: 'Norey', nombre: 'Vic', giro: 'catalogo', whatsapp: '33130265', pin: '1234' })).data.token;
const neg = (await api('bootstrap', {}, tok)).data.negocioId;
await db.aplicar({ ops: [{ t: 'Licencias', op: 'upd', k: { id: neg }, row: { plus: 'si', estado: 'Activa' } }], props: { PANEL_CLAVE: 'c' } });
await api('guardar', { entidad: 'Config', registro: { tienda: 'si' } }, tok);
const prod = id => api('bootstrap', {}, tok).then(r => r.data.productos.find(p => p.id === id));
const vs = p => { const V = JSON.parse(p.variantes || '{}'); const o = {}; Object.keys(V).forEach(k => { o[k.split(': ')[1]] = V[k].s; }); return o; };
// 1) Producto con existencia por tono
const co = ok('crear corrector con existencia por tono', await api('guardar', { entidad: 'Productos', registro: { nombre: 'Corrector líquido', categoria: 'Rostro', precio: 140, costo: 90, tipo: 'producto', opciones: 'Tono: Nude 1#fbe0cf, Nude 3#f3cfa8, Beige 2',
  variantes: JSON.stringify({ 'Tono: Nude 1': { s: 10 }, 'Tono: Nude 3': { s: 0 }, 'Tono: Beige 2': { s: 7 } }) } }, tok));
igual('total = suma de tonos', co.stock, 17); igual('tonos', vs(co), { 'Nude 1': 10, 'Nude 3': 0, 'Beige 2': 7 });
// 2) Tienda
const ti = ok('tiendaInfo', await api('tiendaInfo', { negocio: neg }));
igual('la tienda sabe qué tono está agotado', ti.productos.find(p => p.id === co.id).vars, { 'Tono: Nude 1': { n: 10 }, 'Tono: Nude 3': { n: 0 }, 'Tono: Beige 2': { n: 7 } });
no('pedido de un tono agotado', await api('pedir', { negocio: neg, nombre: 'Carla Ruiz', telefono: '98765432', entrega: 'recoger', items: [{ id: co.id, cantidad: 1, opcion: 'Tono: Nude 3' }] }));
no('pedido sin elegir tono', await api('pedir', { negocio: neg, nombre: 'Carla Ruiz', telefono: '98765432', entrega: 'recoger', items: [{ id: co.id, cantidad: 1 }] }));
no('pedido de más de lo que hay del tono', await api('pedir', { negocio: neg, nombre: 'Carla Ruiz', telefono: '98765432', entrega: 'recoger', items: [{ id: co.id, cantidad: 8, opcion: 'Tono: Beige 2' }] }));
const pd = ok('pedido 2 Nude 1', await api('pedir', { negocio: neg, nombre: 'Carla Ruiz', telefono: '98765432', entrega: 'recoger', items: [{ id: co.id, cantidad: 2, opcion: 'Tono: Nude 1' }] }));
// 3) Venta en caja (como Vender: variante «Nude 1»)
no('vender sin tono', await api('venta', { items: [{ productoId: co.id, cantidad: 1 }], metodo: 'Efectivo', recibido: 200, clave: 'a' }, tok));
no('vender un tono agotado', await api('venta', { items: [{ productoId: co.id, cantidad: 1, variante: 'Nude 3' }], metodo: 'Efectivo', recibido: 200, clave: 'b' }, tok));
const v1 = ok('vender 3 Nude 1', await api('venta', { items: [{ productoId: co.id, cantidad: 3, variante: 'Nude 1' }], metodo: 'Efectivo', recibido: 500, clave: 'c' }, tok));
igual('después de vender', vs(await prod(co.id)), { 'Nude 1': 7, 'Nude 3': 0, 'Beige 2': 7 });
// cobrar el pedido en línea (la línea viene «Corrector líquido (Tono: Nude 1)»)
const vp = ok('cobrar el pedido en línea', await api('venta', { pedidoId: pd.id, items: [{ productoId: co.id, descripcion: 'Corrector líquido (Tono: Nude 1)', cantidad: 2, precio: 140 }], metodo: 'Efectivo', recibido: 300, clave: 'd' }, tok));
igual('después del pedido', vs(await prod(co.id)), { 'Nude 1': 5, 'Nude 3': 0, 'Beige 2': 7 });
ok('anular la venta de 3', await api('anularVenta', { id: v1.venta.id, motivo: 'prueba' }, tok));
igual('vuelven al tono', vs(await prod(co.id)), { 'Nude 1': 8, 'Nude 3': 0, 'Beige 2': 7 });
// editar la venta del pedido: 1 Beige 2 en vez de 2 Nude 1
ok('editar venta (cambia de tono)', await api('editarVenta', { id: vp.venta.id, motivo: 'cambió de tono', items: [{ productoId: co.id, cantidad: 1, variante: 'Beige 2', precio: 140 }], metodo: 'Efectivo', recibido: 140 }, tok));
igual('después de editar', vs(await prod(co.id)), { 'Nude 1': 10, 'Nude 3': 0, 'Beige 2': 6 });
// 4) Compra y ajuste por tono
no('compra sin tono', await api('compra', { items: [{ productoId: co.id, cantidad: 5, costo: 85 }], metodo: 'Efectivo' }, tok));
const cp = ok('compra 5 Nude 3', await api('compra', { items: [{ productoId: co.id, cantidad: 5, costo: 85, variante: 'Nude 3' }], metodo: 'Efectivo' }, tok));
igual('después de comprar', vs(await prod(co.id)), { 'Nude 1': 10, 'Nude 3': 5, 'Beige 2': 6 });
ok('anular la compra', await api('anularCompra', { id: cp.compra.id }, tok));
igual('después de anular la compra', vs(await prod(co.id)), { 'Nude 1': 10, 'Nude 3': 0, 'Beige 2': 6 });
const aj = ok('conteo físico de Nude 1 = 4', await api('ajusteStock', { id: co.id, modo: 'conteo', cantidad: 4, variante: 'Nude 1', motivo: 'Conteo' }, tok));
igual('después del conteo', [vs(aj), aj.stock], [{ 'Nude 1': 4, 'Nude 3': 0, 'Beige 2': 6 }, 10]);
const kx = ok('movimientos', await api('kardex', { id: co.id }, tok)); console.log('   ', kx.slice(0, 4).map(m => m.tipo + ' ' + m.cantidad + ' ' + m.variante).join(' | '));
// 5) Precio por presentación
const lo = ok('loción con precio por presentación', await api('guardar', { entidad: 'Productos', registro: { nombre: 'Loción Brisa', categoria: 'Lociones', precio: 450, tipo: 'producto', opciones: 'Presentación: 50 ml, 100 ml',
  variantes: { 'Presentación: 50 ml': { s: 12 }, 'Presentación: 100 ml': { s: 8, p: 650 } } } }, tok));
const pl = ok('pedido 1 de 100 ml', await api('pedir', { negocio: neg, nombre: 'Ana López', telefono: '98765433', entrega: 'recoger', items: [{ id: lo.id, cantidad: 1, opcion: 'Presentación: 100 ml' }, { id: lo.id, cantidad: 1, opcion: 'Presentación: 50 ml' }] }));
igual('precios del pedido', pl.items.map(i => i.precio), [650, 450]);
await api('guardarUsuario', { registro: { usuario: '99990000', nombre: 'Cajera', rol: 'cajero', activo: true }, clave: '5555' }, tok);
const tc = (await api('login', { whatsapp: '99990000', pin: '5555', negocio: neg })).data.token;
const vc = ok('cajera vende 100 ml', await api('venta', { items: [{ productoId: lo.id, cantidad: 1, variante: '100 ml', precio: 650 }], metodo: 'Efectivo', recibido: 700, clave: 'e' }, tc));
igual('total 650', vc.venta.total, 650);
const vc2 = ok('cajera intenta cobrar 100 ml a 450', await api('venta', { items: [{ productoId: lo.id, cantidad: 1, variante: '100 ml', precio: 450 }], metodo: 'Efectivo', recibido: 700, clave: 'f' }, tc));
igual('se corrige a 650', vc2.venta.total, 650);
// 6) Panel: carga desde Excel
const pt = (await api('panelLogin', { clave: 'c' })).data.token;
const filas = [
  { _fila: 2, nombre: 'Blusa casual', categoria: 'Ropa', sub: 'Dama', precio: 380, costo: 220, op1: 'Talla', val1: 'S, M', op2: 'Color', val2: 'Negro#222222, Rosa', existOp: 'S / Negro = 2; M / Negro = 3; M / Rosa = 1', precioEsp: 340, minEsp: 3 },
  { _fila: 3, nombre: 'Body splash', categoria: 'Lociones', precio: 220, existencia: 24, codigo: 'BS-1' },
  { _fila: 4, nombre: 'Corrector líquido', categoria: 'Rostro', precio: 145 },
  { _fila: 5, nombre: 'Gloss Cherry', categoria: 'Labios' },
  { _fila: 6, nombre: 'Loción X', categoria: 'Lociones', precio: 500, op1: 'Presentación', val1: '50 ml, 100 ml', preciosOp: '100 ml = 700; 200 ml = 900' }];
const rv = ok('panel: revisar la hoja', await srv.atender({ action: 'panelImportar', panel: pt, data: { negocio: neg, filas, revisar: true } }));
console.log('   nuevos', rv.nuevos, '· actualizados', rv.actualizados, '· errores', JSON.stringify(rv.errores.map(e => e.fila + ': ' + e.error)));
igual('nada guardado al revisar', (await api('bootstrap', {}, tok)).data.productos.length, 2);
const cg = ok('panel: cargar', await srv.atender({ action: 'panelImportar', panel: pt, data: { negocio: neg, filas } }));
const ps = (await api('bootstrap', {}, tok)).data.productos;
const bl = ps.find(p => p.nombre === 'Blusa casual');
igual('cargados', cg.cargados, 3); { const V = JSON.parse(bl.variantes); igual('blusa: existencia por talla y color', [bl.stock, V['Talla: S, Color: Negro'].s, V['Talla: M, Color: Negro'].s, V['Talla: M, Color: Rosa'].s, V['Talla: S, Color: Rosa'].s, bl.precioEsp, bl.sub], [6, 2, 3, 1, 0, 340, 'Dama']); }
igual('body splash con 24', ps.find(p => p.nombre === 'Body splash').stock, 24);
igual('corrector actualizado (precio, sin duplicar)', [ps.filter(p => p.nombre === 'Corrector líquido').length, ps.find(p => p.nombre === 'Corrector líquido').precio, ps.find(p => p.nombre === 'Corrector líquido').stock], [1, 145, 10]);
console.log(fallas ? '\n✗ ' + fallas + ' fallas' : '\n✓ todo bien');
