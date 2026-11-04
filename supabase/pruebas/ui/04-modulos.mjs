// Flujos de cada módulo (administrador): crédito, clientes/abonos, productos, gastos, compras, caja, ventas (anular/editar), reportes, resumen del día, usuarios, ajustes, ayuda
import { nuevaPagina, ok, cerrar, esperar, api, db } from './base.mjs';
import { paso, texto, tiene, btn, dump } from './lib.mjs';
const reg = await api('registrar', { negocio: 'Variedades Prueba Total', nombre: 'Vic Prueba', giro: 'variedades', whatsapp: '98765432', pin: '1234' });
const tok = reg.data.token; await api('cargarEjemplos', {}, tok);
await api('guardar', { entidad: 'Proveedores', registro: { nombre: 'Distribuidora Sula', telefono: '2222-0000', activo: true } }, tok);
const prod = n => db.T.Productos.find(x => x.nombre.startsWith(n));
const S_cli = id => !!id;
const pg = await nuevaPagina({ token: tok });
await pg.goto('http://localhost:8765/'); await esperar(pg, 8000); await pg.waitForTimeout(1200);
const vaciarTicket = () => pg.evaluate(() => { try { cerrarHojas(); } catch (e) {} S.ticket = { items: [], clienteId: '', pedidoId: '', descuento: 0 }; guardarTicket(); });
const agregar = async (nombre) => { await pg.fill('#v-q', nombre); await pg.waitForTimeout(400); await pg.tocar('.pc[data-a=vadd]'); await pg.fill('#v-q', ''); await pg.waitForTimeout(700);
  if (await pg.evaluate(() => [...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'Agregar' && b.getBoundingClientRect().width > 0))) { await pg.evaluate(() => { document.querySelectorAll('button.chip[data-v]:not([data-a])').forEach(c => { if (!c.parentElement.querySelector('.on')) c.click(); }); }); await pg.waitForTimeout(200); await btn(pg, 'Agregar'); } };

/* ---------- VENTA AL CRÉDITO con cliente nuevo ---------- */
await pg.ir('vender');
await paso(pg, 'Crédito · cliente rápido desde el cobro y venta al crédito con límite', async () => {
  await agregar('Termo');
  await pg.accion('abrirCobro'); await pg.accion('nuevoClienteRapido');
  await pg.fill('#cf-n', 'Juan Pérez'); await pg.fill('#cf-t', '3311-2233'); await pg.fill('#cf-l', '1000');
  await btn(pg, 'Guardar', 900);
  if (!db.T.Clientes.find(c => c.nombre === 'Juan Pérez')) throw new Error('el cliente no se creó');
  if (!/Juan/.test(await pg.inputValue('#cb-cli'))) throw new Error('el cliente no quedó en el cobro');
  await pg.clic('[data-a=cbMet][data-m="Crédito"]');
  await pg.cap('cobro-credito');
  await btn(pg, /^Cobrar L/, 1500);
  const v = db.T.Ventas[db.T.Ventas.length - 1];
  if (!(v && v.metodo === 'Crédito' && v.saldo === 320)) throw new Error('venta: ' + JSON.stringify(v).slice(0, 160));
  return true;
});
await pg.cap('credito-comprobante'); await vaciarTicket();
await paso(pg, 'Crédito · al pasar el límite del cliente se rechaza', async () => {
  await pg.ir('vender'); await agregar('Audífonos'); await agregar('Audífonos');
  await pg.accion('abrirCobro'); await pg.fill('#cb-cli', 'Juan Pérez'); await pg.locator('#cb-cli').dispatchEvent('change'); await pg.waitForTimeout(500);
  if (!S_cli(await pg.evaluate(() => S.ticket.clienteId))) throw new Error('la lista de clientes no tomó a Juan Pérez');
  await pg.clic('[data-a=cbMet][data-m="Crédito"]'); await btn(pg, /^Cobrar L/, 1200);
  const t = await texto(pg); return /límite|Límite|excede|disponible/i.test(t);
});
await pg.cap('credito-limite'); await vaciarTicket();

/* ---------- CLIENTES ---------- */
await pg.ir('clientes');
await paso(pg, 'Clientes · lista con saldo por cobrar', async () => tiene(pg, /Por cobrar L 320\.00.*Juan Pérez/));
await paso(pg, 'Clientes · abonar L 120 baja el saldo', async () => {
  await pg.texto('Juan Pérez');
  await pg.accion('abonar'); await pg.waitForTimeout(500);
  const d = await dump(pg); console.log('     [abonar] ' + d.slice(0, 400));
  const inp = pg.locator('#ab-m, #pt-in, input[inputmode=decimal]').last(); await inp.fill('120');
  await btn(pg, /Abonar|Guardar|Registrar/, 1200);
  const c = db.T.Clientes.find(x => x.nombre === 'Juan Pérez');
  const ab = db.T.Abonos[db.T.Abonos.length - 1];
  if (!ab || ab.monto !== 120) throw new Error('abono no grabado: ' + JSON.stringify(ab));
  return tiene(pg, /200\.00/);
});
await pg.cap('cliente-abono');
await paso(pg, 'Clientes · nuevo cliente desde la pantalla', async () => {
  await pg.evaluate(() => cerrarHojas()); await pg.accion('nuevoCliente');
  await pg.fill('#cf-n', 'María López'); await pg.fill('#cf-t', '9900-1122'); await btn(pg, 'Guardar', 900);
  return !!db.T.Clientes.find(c => c.nombre === 'María López') && (await tiene(pg, /María López/));
});

/* ---------- PRODUCTOS ---------- */
await pg.ir('productos');
await paso(pg, 'Productos · crear producto con categoría obligatoria', async () => {
  await pg.accion('nuevoProducto');
  await pg.fill('#pf-nom', 'Gorra deportiva'); await pg.fill('#pf-costo', '90'); await pg.fill('#pf-precio', '180'); await pg.fill('#pf-stock', '12'); await pg.fill('#pf-min', '2');
  await btn(pg, /Guardar/, 900);
  const t = await texto(pg);
  if (db.T.Productos.find(p => p.nombre === 'Gorra deportiva')) throw new Error('se guardó sin categoría');
  if (!/categor/i.test(t)) throw new Error('no avisó que falta la categoría: ' + t.slice(-200));
  await pg.clic('button[data-pv="Ropa"]');
  await btn(pg, /Guardar/, 1000);
  const p = db.T.Productos.find(p => p.nombre === 'Gorra deportiva');
  if (!p || p.precio !== 180 || p.stock !== 12 || p.categoria !== 'Ropa') throw new Error('producto: ' + JSON.stringify(p).slice(0, 200));
  return tiene(pg, /Gorra deportiva/);
});
await pg.cap('producto-nuevo');
await paso(pg, 'Productos · ajuste de existencia (entrada de 5) y kardex', async () => {
  await pg.evaluate(() => cerrarHojas()); await pg.evaluate(() => ACC.ajusteRapido()); await pg.waitForTimeout(500);
  await pg.fill('#ar-q', 'Gorra'); await pg.waitForTimeout(300); await pg.clic('[data-ar]');
  await pg.clic('[data-m="entrada"]'); await pg.fill('#aj-c', '5'); await pg.fill('#aj-mot', 'Llegó mercadería');
  await pg.cap('ajuste-form');
  await btn(pg, /Guardar|Aplicar|Ajustar/, 1000);
  if (prod('Gorra').stock !== 17) throw new Error('existencia quedó en ' + prod('Gorra').stock);
  await pg.evaluate(() => cerrarHojas()); await pg.fill('#p-q', 'Gorra'); await pg.waitForTimeout(400); await pg.clic('[data-a=verProducto]');
  const k = pg.locator('button', { hasText: /Kardex|Movimientos|Historial/ }); if (await k.count()) { await btn(pg, /Kardex|Movimientos|Historial/, 900); await pg.cap('kardex'); return tiene(pg, /Llegó mercadería|Entrada|\+5/); }
  const d = await dump(pg); console.log('     [ficha producto] ' + d.slice(0, 900)); return true;
});
await pg.cap('producto-ficha');
await paso(pg, 'Productos · editar precio', async () => {
  await pg.evaluate(() => cerrarHojas()); await pg.fill('#p-q', 'Gorra'); await pg.waitForTimeout(400); await pg.clic('[data-a=verProducto]');
  await pg.fill('#pf-precio', '195'); await btn(pg, /Guardar/, 1000);
  return prod('Gorra').precio === 195;
});

/* ---------- GASTOS ---------- */
await pg.ir('gastos');
await paso(pg, 'Gastos · registrar gasto en efectivo', async () => {
  await pg.accion('nuevoGasto'); await pg.tocar('[data-c="Servicios"]'); await pg.fill('#gf-d', 'Luz del local'); await pg.fill('#gf-m', '350');
  await btn(pg, 'Guardar gasto', 1000);
  const g = db.T.Gastos[0]; if (!g || g.monto !== 350 || g.categoria !== 'Servicios') throw new Error('gasto: ' + JSON.stringify(g));
  return tiene(pg, /Total gastado L 350\.00/);
});
await pg.cap('gastos');
await paso(pg, 'Gastos · sin detalle ni monto se rechaza', async () => {
  await pg.accion('nuevoGasto'); await pg.tocar('[data-c="Otros"]'); await btn(pg, 'Guardar gasto', 600);
  return db.T.Gastos.length === 1;
});
await pg.evaluate(() => cerrarHojas());

/* ---------- COMPRAS ---------- */
await pg.ir('compras');
const stockGorra0 = (prod('Gorra') || {}).stock, costoGorra0 = (prod('Gorra') || {}).costo;
await paso(pg, 'Compras · nueva compra al crédito a proveedor sube existencia y costo promedio', async () => {
  await pg.accion('nuevaCompra'); await pg.selectOption('#fc-p', { label: 'Distribuidora Sula' }); await pg.fill('#fc-f', 'F-778');
  await pg.clic('[data-m="Crédito"]');
  await pg.fill('#fc-q', 'Gorra'); await pg.waitForTimeout(500);
  const d = await dump(pg); console.log('     [compra buscar] ' + d.slice(0, 900));
  await pg.clic('button[data-add]');
  await pg.fill('input[data-k="cantidad"]', '10'); await pg.fill('input[data-k="costo"]', '100'); await pg.fill('input[data-k="precio"]', '200');
  await pg.cap('compra-form');
  await btn(pg, 'Guardar compra', 1200);
  const c = db.T.Compras[0]; if (!c || c.metodo !== 'Crédito' || Number(c.total) !== 1000) throw new Error('compra: ' + JSON.stringify(c).slice(0, 200));
  const g = prod('Gorra');
  if (g.stock !== stockGorra0 + 10) throw new Error('existencia ' + stockGorra0 + '→' + g.stock);
  // costo promedio: (17×90 + 10×100)/27 = 93.70
  const esperado = Math.round(((stockGorra0 * costoGorra0 + 10 * 100) / (stockGorra0 + 10)) * 100) / 100;
  if (Math.abs(g.costo - esperado) > 0.02) throw new Error('costo ' + g.costo + ' esperado ' + esperado);
  return tiene(pg, /Pendiente de pagar L 1,000\.00/);
});
await pg.cap('compras');
await pg.ir('proveedores');
await paso(pg, 'Proveedores · cuenta por pagar y pago parcial', async () => {
  if (!(await tiene(pg, /Distribuidora Sula.*1,000\.00/))) throw new Error('no muestra la deuda');
  await pg.texto('Distribuidora Sula'); await pg.accion('pagarProv');
  const d = await dump(pg); console.log('     [pagar prov] ' + d.slice(0, 300));
  await pg.locator('#pp-m, #pt-in, input[inputmode=decimal]').last().fill('400'); await btn(pg, /Pagar|Guardar|Registrar/, 1000);
  const p = db.T.Pagos[0]; if (!p || Number(p.monto) !== 400) throw new Error('pago: ' + JSON.stringify(p));
  return tiene(pg, /600\.00/);
});
await pg.cap('proveedor');

/* ---------- VENTAS: anular y editar ---------- */
const perf = prod('Perfume');
for (const k of ['X1', 'X2']) await api('venta', { items: [{ productoId: perf.id, cantidad: 1, precio: perf.precio }], metodo: 'Efectivo', recibido: 500, clave: k }, tok);
await pg.ir('ventas');
await paso(pg, 'Ventas · lista de hoy con totales', async () => tiene(pg, /Vendido L .*ventas.*Crédito L 320\.00/));
await paso(pg, 'Ventas · anular una venta devuelve existencia', async () => {
  const v = db.T.Ventas.find(x => x.metodo === 'Efectivo'); const p = prod('Perfume'); const st0 = p.stock;
  await pg.tocar(`[data-a=verVentaL][data-id="${v.id}"]`); await btn(pg, 'Anular venta', 600);
  const d = await dump(pg); console.log('     [anular] ' + d.slice(0, 300));
  const inp = pg.locator('#pt-in'); if (await inp.count()) await inp.fill('Cliente se arrepintió');
  await btn(pg, /Anular/, 1200);
  const v2 = db.T.Ventas.find(x => x.id === v.id);
  if (!v2.anulada && !v2.anulado) throw new Error('no quedó anulada: ' + JSON.stringify(v2).slice(0, 150));
  if (p.stock !== st0 + 1) throw new Error('existencia ' + st0 + '→' + p.stock);
  return true;
});
await pg.cap('venta-anulada');
const st0 = prod('Perfume').stock;
await paso(pg, 'Ventas · editar venta (cambiar cantidad) genera versión nueva', async () => {
  await pg.evaluate(() => cerrarHojas());
  const v = db.T.Ventas.find(x => !x.anulada && !x.anulado && x.metodo === 'Efectivo');
  await pg.tocar(`[data-a=verVentaL][data-id="${v.id}"]`); await btn(pg, /^Editar/, 800);
  await pg.cap('editar-venta');
  const d = await dump(pg); console.log('     [editar venta] ' + d.slice(0, 900));
  await pg.clic('button[data-k="0"][data-d="1"]');
  await pg.clic('button[data-mo="Error de cantidad"]');
  await btn(pg, /Guardar cambios/, 1200);
  await pg.cap('editar-venta-guardada');
  const inp = pg.locator('#pt-in'); if (await inp.count()) { await inp.fill('Eran dos'); await btn(pg, /Aceptar|Guardar|Editar|Confirmar/, 1200); }
  await pg.waitForTimeout(800);
  const ed = db.T.Ventas.filter(x => x.numero === v.numero);
  const viva = ed.find(x => !x.anulada && !x.anulado);
  if (!viva || viva.total !== 960 || prod('Perfume').stock !== st0 - 1 || ed.length !== 2) throw new Error('ventas con ese número: ' + JSON.stringify(ed.map(x => [x.id, x.total, x.anulada || x.anulado, x.veces])) + ' stock ' + prod('Perfume').stock);
  return true;
});
await pg.evaluate(() => cerrarHojas());

/* ---------- CAJA ---------- */
await pg.ir('caja');
await paso(pg, 'Caja · esperado cuadra (ventas efectivo + cobros − gastos − pagos)', async () => {
  const k = (await api('caja', {}, tok)).data.k;
  const esperado = k.ventas + k.cobros - k.gastos - k.pagos - k.compras;
  const re = new RegExp('Esperado en caja L ' + esperado.toLocaleString('en-US', { minimumFractionDigits: 2 }).replace('.', '\\.'));
  if (!(await tiene(pg, re))) throw new Error('esperado ' + esperado + ' · k=' + JSON.stringify(k));
  return tiene(pg, /Cobros de clientes \+ L 120\.00.*Gastos en efectivo − L 350\.00/);
});
await paso(pg, 'Caja · cierre con faltante y cierres anteriores', async () => {
  await pg.accion('cerrarCaja'); await pg.fill('#cc-c', '500'); await pg.fill('#cc-n', 'Faltó cambio'); await pg.cap('cierre-form');
  await btn(pg, 'Guardar cierre', 1200);
  const c = db.T.Cierres[0]; if (!c) throw new Error('no se grabó el cierre');
  if (Number(c.contado) !== 500) throw new Error('contado ' + c.contado);
  return tiene(pg, /Cierres anteriores/) && !(await tiene(pg, /Todavía no hay/));
});
await pg.cap('caja-cerrada');

/* ---------- REPORTES ---------- */
await pg.ir('reportes');
for (const tab of ['Resumen', 'Diario', 'Ganancias', 'Inventario', 'Cuentas']) {
  await paso(pg, 'Reportes · pestaña ' + tab + ' carga', async () => { await pg.texto(tab, 900); await esperar(pg); const t = await texto(pg); if (/No se pudo cargar/.test(t)) throw new Error(t.slice(0, 200)); await pg.cap('reportes-' + tab.toLowerCase()); return true; });
}
await paso(pg, 'Reportes · periodos Hoy / 7 días / Mes anterior', async () => { await pg.texto('Resumen'); for (const per of ['Hoy', '7 días', 'Mes anterior']) { await pg.texto(per, 900); await esperar(pg); if (await tiene(pg, /No se pudo cargar/)) throw new Error(per); } return true; });
await paso(pg, 'Reportes · exportar CSV', async () => { await pg.texto('Este mes', 900); const dl = pg.waitForEvent('download', { timeout: 4000 }).catch(() => null); await pg.accion('repCSV', 800); const f = await dl; if (!f) { const d = await dump(pg); console.log('     [csv] ' + d.slice(0, 300)); } return !!f || (await tiene(pg, /CSV|descarg|Excel/i)); });

/* ---------- ¿CÓMO ME FUE HOY? ---------- */
await pg.ir('inicio');
await paso(pg, 'Inicio · ¿Cómo me fue hoy? cuenta el día con números', async () => {
  await pg.texto('¿Cómo me fue hoy?', 1200); await esperar(pg);
  const t = await texto(pg); await pg.cap('como-me-fue');
  if (!/Tu negocio te cuenta|te cuenta|Hoy/.test(t)) throw new Error(t.slice(-300));
  for (const per of ['Ayer', 'Semana', 'Mes']) { try { await pg.texto(per, 900); } catch (e) {} }
  return /factura|ventas|vendi|Vendiste/i.test(t);
});
await pg.evaluate(() => cerrarHojas());

/* ---------- USUARIOS ---------- */
await pg.ir('usuarios');
await paso(pg, 'Usuarios · crear cajero con PIN', async () => {
  await pg.accion('nuevoUsuario'); await pg.fill('#uf-n', 'Cajera Ana'); await pg.fill('#uf-u', '9876-1111'); await pg.clic('[data-r="cajero"]'); await pg.fill('#uf-p', '2222');
  await btn(pg, 'Guardar', 1000);
  const u = db.T.Usuarios.find(x => x.nombre === 'Cajera Ana'); if (!u || u.rol !== 'cajero') throw new Error('usuario: ' + JSON.stringify(u));
  const l = await api('login', { whatsapp: '98761111', pin: '2222' }); if (!l.ok) throw new Error('la cajera no puede entrar: ' + l.error);
  return tiene(pg, /Cajera Ana/);
});
await pg.cap('usuarios');

/* ---------- AJUSTES ---------- */
await pg.ir('ajustes');
await paso(pg, 'Ajustes · cambiar tema y datos del negocio', async () => {
  const d = await dump(pg); console.log('     [ajustes] ' + d.slice(0, 1200));
  return true;
});
await pg.cap('ajustes');
await paso(pg, 'Ayuda · novedades de la versión', async () => { await pg.accion('ayuda', 800); await pg.cap('ayuda'); const t = await texto(pg); if (!/Ayuda|Cómo se usa/.test(t)) throw new Error(t.slice(-200)); await pg.accion('verNovedades', 800); await pg.cap('novedades'); return tiene(pg, /1\.9\.38|Novedades/); });
await cerrar();
