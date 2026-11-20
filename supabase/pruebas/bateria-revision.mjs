// Batería de la revisión total del 19 nov 2026 (1.9.92): doble toque, cobro al editar una venta, fondo de caja, visitas por conexión
// Ejecutar: cd supabase/pruebas && node bateria-revision.mjs   (necesita el Codigo.gs de main 1.9.92 o posterior)
const R = Date; let off = -3 * 86400000; // el negocio empieza hace 3 días
class D extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + off); } static now() { return R.now() + off; } }
globalThis.Date = D;
const { api, db } = await import('./prueba.mjs');
db.push = q => (q.lista ? [] : true);
let pasadas = 0, fallidas = 0;
const ok = (n, c, det) => { if (c) { pasadas++; console.log('✓', n); } else { fallidas++; console.log('✗', n, det === undefined ? '' : JSON.stringify(det)); } };
const T = n => db.T[n] || [];
let r = await api('registrar', { ciudad: 'San Pedro Sula', negocio: 'Revisión', nombre: 'Vic', giro: 'tienda', whatsapp: '33130265', pin: '1234' });
let tok = r.data.token; const A = (a, d) => api(a, d, tok);
const G = (e, reg) => A('guardar', { entidad: e, registro: reg });
await G('Productos', { nombre: 'Camisa', precio: 500, costo: 200, categoria: 'Ropa' }); await G('Clientes', { nombre: 'Ana', telefono: '99990000' });
const pid = T('Productos').slice(-1)[0].id, cid = T('Clientes').slice(-1)[0].id;

/* --- un solo registro por toque --- */
r = await A('compra', { items: [{ productoId: pid, cantidad: 10, costo: 200 }], metodo: 'Transferencia', clave: 'c1' });
let r2 = await A('compra', { items: [{ productoId: pid, cantidad: 10, costo: 200 }], metodo: 'Transferencia', clave: 'c1' });
ok('compra repetida: una sola y devuelve los productos', r.ok && r2.ok && r2.data.repetida && T('Compras').length === 1 && Array.isArray(r2.data.productos) && T('Productos').slice(-1)[0].stock === 10, [T('Compras').length, T('Productos').slice(-1)[0].stock]);
r = await A('venta', { items: [{ productoId: pid, cantidad: 1, precio: 500 }], clienteId: cid, metodo: 'Efectivo', recibido: 500, clave: 'v1' });
const vid = r.data.venta.id;
r = await A('guardarGasto', { registro: { categoria: 'Luz', detalle: 'ENEE', monto: 50, metodo: 'Transferencia' }, clave: 'g1' }); r2 = await A('guardarGasto', { registro: { categoria: 'Luz', detalle: 'ENEE', monto: 50, metodo: 'Transferencia' }, clave: 'g1' });
ok('gasto repetido: uno solo', r.ok && r2.ok && T('Gastos').length === 1, T('Gastos').length);
r = await A('ajusteStock', { id: pid, modo: 'entrada', cantidad: 2, motivo: 'x', clave: 'j1' }); r2 = await A('ajusteStock', { id: pid, modo: 'entrada', cantidad: 2, motivo: 'x', clave: 'j1' });
ok('ajuste repetido: uno solo', r.ok && r2.ok && T('Productos').slice(-1)[0].stock === 11, T('Productos').slice(-1)[0].stock);
r = await A('cerrarCaja', { contado: 500, fondo: 0, clave: 'k1' }); r2 = await A('cerrarCaja', { contado: 500, fondo: 0, clave: 'k1' });
ok('cierre repetido: uno solo', r.ok && r2.ok && T('Cierres').length === 1, T('Cierres').length);

/* --- días después: la venta pagada por error pasa a crédito y luego a pagada --- */
off = 0; tok = (await api('login', { whatsapp: '33130265', pin: '1234' })).data.token;
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Tegucigalpa' }).format(new R());
const it = [{ productoId: pid, cantidad: 1, precio: 500 }];
r = await A('editarVenta', { id: vid, items: it, clienteId: cid, metodo: 'Crédito', recibido: 0, motivo: 'era crédito' });
ok('editar a crédito: queda con saldo', r.ok && r.data.venta.saldo === 500, r.error);
const v2 = r.data.venta.id;
r = await A('abono', { clienteId: cid, monto: 200, metodo: 'Efectivo', clave: 'a1' }); r2 = await A('abono', { clienteId: cid, monto: 200, metodo: 'Efectivo', clave: 'a1' });
ok('abono repetido: uno solo y el saldo baja una vez', r.ok && r2.ok && r2.data.repetida && T('Abonos').length === 1 && r2.data.saldo === 300, [T('Abonos').length, r2.data && r2.data.saldo]);
r = await A('anularAbono', { id: T('Abonos')[0].id }); ok('anular el abono', r.ok, r.error);
r = await A('editarVenta', { id: v2, items: it, clienteId: cid, metodo: 'Efectivo', recibido: 500, motivo: 'ya pagó' });
ok('editar a pagada', r.ok && r.data.venta.saldo === 0, r.error);
const di = (await A('diario', {})).data.movimientos.filter(m => !m.anulado);
const cob = di.filter(m => m.deVenta), ve = di.filter(m => m.tipo === 'venta');
ok('diario: el cobro al editar sale HOY', cob.length === 1 && cob[0].fecha.slice(0, 10) === hoy && cob[0].cobrado === 500 && cob[0].tipo === 'cobro', cob);
ok('diario: la venta conserva su día y no cuenta el cobro dos veces', ve.length === 1 && ve[0].fecha.slice(0, 10) < hoy && ve[0].monto === 500 && ve[0].cobrado === 0, ve);

/* --- fondo de caja escrito con coma --- */
r = await G('Config', { fondoCaja: '1,500' }); const cj = (await A('caja', {})).data;
ok('fondo de caja «1,500» cuenta 1500', cj.fondo === 1500, cj.fondo);

/* --- visitas: tope por conexión --- */
const neg = T('Licencias')[0].id.toLowerCase(); let si = 0;
for (let i = 0; i < 50; i++) { const x = await api('visita', { p: 't-' + neg, o: 'facebook', d: 'cel', v: 'bot' + i + 'xxxxxx' }, undefined, { ip: 'aaaaaaaaaaaaaaaa' }); if (x.ok && x.data === true) si++; }
ok('visitas: máximo 40 por hora desde la misma conexión', si === 40, si);
const y = await api('visita', { p: 't-' + neg, o: 'wa', d: 'cel', v: 'personareal1' }, undefined, { ip: 'bbbbbbbbbbbbbbbb' });
ok('visitas: otra conexión sí cuenta', y.ok && y.data === true, y);

/* --- registro: la ciudad necesita letras --- */
r = await api('registrar', { ciudad: '...', negocio: 'Otra', nombre: 'X', giro: 'tienda', whatsapp: '33130299', pin: '1234' });
ok('registro con ciudad «...» se rechaza', !r.ok && /ciudad/.test(r.error), r.error);

console.log('\n== ' + pasadas + ' pasadas · ' + fallidas + ' fallidas ==');
process.exit(fallidas ? 1 : 0);
