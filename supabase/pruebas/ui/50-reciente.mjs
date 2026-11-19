// Funciones publicadas entre 1.9.86 y el 2026-11-19, en pantalla
import { nuevaPagina, ok, cerrar, esperar, api, db } from './base.mjs';
const reg = await api('registrar', { ciudad: 'San Pedro Sula',  ciudad: 'San Pedro Sula', negocio: 'Variedades Reciente', nombre: 'Vic Prueba', giro: 'variedades', ciudad: 'La Ceiba', whatsapp: '98760050', pin: '1234' });
const tok = reg.data.token; await api('cargarEjemplos', {}, tok);
const b = (await api('bootstrap', {}, tok)).data; const p = b.productos.find(x => !x.opciones && x.stock > 5) || b.productos[0];
const cli = (await api('guardar', { entidad: 'Clientes', registro: { nombre: 'Rosa Mejía', telefono: '9999-0000', limite: 5000, activo: true } }, tok)).data; const cid = (cli.registro || cli).id;
let r = await api('venta', { items: [{ productoId: p.id, cantidad: 1, precio: p.precio }], metodo: 'Efectivo', recibido: 5000, clienteNombre: 'Doña Marta López', clave: 'a1' }, tok); if (!r.ok) console.log('venta1', r.error);
r = await api('venta', { items: [{ productoId: p.id, cantidad: 1, precio: p.precio }], metodo: 'Crédito', clienteId: cid, clave: 'a2' }, tok); if (!r.ok) console.log('venta2', r.error);
r = await api('abono', { clienteId: cid, monto: 50, metodo: 'Efectivo' }, tok); if (!r.ok) console.log('abono', r.error);
r = await api('guardarProyecto', { registro: { nombre: 'Canastas de prueba', margen: 40, producto: { nombre: 'Canasta', cantidad: 10, unidad: 'unidad', precio: 300 } } }, tok); if (!r.ok) console.log('proyecto', r.error);
const pg = await nuevaPagina({ token: tok }); await pg.goto('http://localhost:8765/'); await esperar(pg, 8000); await pg.waitForTimeout(1200);
let t = await pg.txt();
ok('Inicio: la venta sale con el nombre escrito', /Doña Marta López/.test(t), t.slice(0, 200));
await pg.ir('ventas'); t = await pg.txt();
ok('Ventas: la lista muestra el nombre escrito', /Doña Marta López/.test(t), t.slice(0, 200));
await pg.texto('Doña Marta López', 1200); t = await pg.hojaTxt();
ok('Detalle de la venta: Cliente = nombre escrito', /CLIENTE\s*Doña Marta López|Cliente\s*Doña Marta López/i.test(t), t.slice(0, 220));
await pg.evaluate(() => cerrarHojas());
// Cobrar con nombre sin guardar
await pg.ir('vender'); await pg.evaluate(id => document.querySelector(`[data-a="vadd"][data-id="${id}"]`).click(), p.id); await pg.waitForTimeout(700);
await pg.accion('abrirCobro', 900);
await pg.fill('#cb-cli', 'Don Luis Paz'); await pg.dispatchEvent('#cb-cli', 'change'); await pg.waitForTimeout(600);
const toast = await pg.evaluate(() => [...document.querySelectorAll('.toast')].map(e => e.textContent).join('|'));
ok('Cobrar: acepta un nombre sin guardar (sin aviso rojo)', (await pg.inputValue('#cb-cli')) === 'Don Luis Paz' && !/no está registrado/.test(toast), toast);
await pg.tocar('[data-a="cbMet"][data-m="Crédito"]', 700); t = await pg.hojaTxt();
ok('Cobrar al crédito: pide guardar a ese cliente', /Para vender al crédito, Don Luis Paz debe estar guardado/.test(t), t.slice(0, 300));
await pg.accion('nuevoClienteRapido', 800);
ok('Botón +: abre «Nuevo cliente» con el nombre ya escrito', (await pg.inputValue('#cf-n').catch(() => '')) === 'Don Luis Paz');
await pg.evaluate(() => cerrarHojas()); await pg.evaluate(() => { S.ticket = { items: [], clienteId: '', pedidoId: '', descuento: 0 }; guardarTicket(); });
// Reportes · Cobrado
await pg.ir('reportes'); await pg.texto('Cobrado', 1500); await esperar(pg); t = await pg.txt();
ok('Reportes · pestaña «Cobrado»: carga con lo cobrado del día', /Cobrado/.test(t) && /Efectivo/.test(t) && !/No se pudo cargar/.test(t), t.slice(0, 300));
await pg.cap('rep-cobrado');
// Clientes · ver un abono
await pg.ir('clientes'); await pg.texto('Rosa Mejía', 1500);
const hayAb = await pg.locator('[data-a="verAbono"]').count();
ok('Cliente: el abono aparece en su historial', hayAb >= 1, 'abonos ' + hayAb + ' · ' + (await pg.hojaTxt()).slice(0, 200));
if (hayAb) { await pg.clic('[data-a="verAbono"]', 1200); t = await pg.hojaTxt(); ok('Ver de nuevo el abono (1.9.90)', /Abono/.test(t) && /50\.00/.test(t), t.slice(0, 220)); }
await pg.evaluate(() => cerrarHojas());
// Pedidos · Nuevo pedido
await pg.ir('pedidos'); await pg.accion('nuevoPedidoNegocio', 1000); t = await pg.hojaTxt();
ok('Pedidos · «Nuevo pedido» abre su formulario (1.9.87)', /WhatsApp|Llamada|En persona/.test(t), t.slice(0, 220));
await pg.cap('nuevo-pedido'); await pg.evaluate(() => cerrarHojas());
// Mi tienda · Cambiar enlace
await pg.ir('tienda'); t = await pg.txt();
ok('Mi tienda: enlace con el nombre del negocio (1.9.88)', /variedades-reciente/.test(t), t.slice(0, 200));
await pg.accion('enlaceTienda', 1000); t = await pg.hojaTxt();
ok('Mi tienda · «Cambiar enlace» abre su hoja', /enlace/i.test(t), t.slice(0, 200));
await pg.evaluate(() => cerrarHojas());
ok('Mi tienda: Tiendas Catrachas encendido y con la ciudad del registro', (await pg.evaluate(() => S.config.dirOn + '|' + S.config.dirCiudad)) === 'si|La Ceiba', await pg.evaluate(() => S.config.dirOn + '|' + S.config.dirCiudad));
// Proyectos · Producir más
await pg.ir('proyectos'); await pg.accion('verProyecto', 1500); t = (await pg.txt()) + ' ' + (await pg.hojaTxt());
ok('Proyectos: abre un proyecto de ejemplo', /Gastos|Productos|Producto final/i.test(t), t.slice(0, 200));
ok('Proyectos: ofrece «Producir más u otro tamaño» (1.9.86)', /Producir más/.test(t), t.slice(0, 400));
await cerrar(); process.exit(0);
