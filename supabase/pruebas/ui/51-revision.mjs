// Revisión total 1.9.92, en pantalla: precio por opción al cobrar, guardar producto sin pisar existencias, novedades y «Cobrado»
import { nuevaPagina, ok, cerrar, esperar, api, db, OUT } from './base.mjs';
const reg = await api('registrar', { ciudad: 'San Pedro Sula', negocio: 'Boutique Revisión', nombre: 'Ana', giro: 'boutique', whatsapp: '98760051', pin: '1234' }); const tok = reg.data.token;
let r = await api('guardar', { entidad: 'Productos', registro: { nombre: 'Blusa', categoria: 'Ropa', precio: 200, costo: 100, tipo: 'producto', opciones: 'Talla: M, XL', variantes: JSON.stringify({ 'Talla: M': { p: 0, s: 10 }, 'Talla: XL': { p: 250, s: 5 } }) } }, tok);
const blusa = r.data.registro || r.data; if (!r.ok) console.log('producto', r.error);
const cli = (await api('guardar', { entidad: 'Clientes', registro: { nombre: 'Rosa Mejía', telefono: '9999-0000', limite: 5000, activo: true } }, tok)).data; const cid = (cli.registro || cli).id;
const pg = await nuevaPagina({ token: tok }); await pg.goto('http://localhost:8765/'); await esperar(pg, 8000); await pg.waitForTimeout(1200);
// 1) Precio propio de la opción al abrir Cobrar
await pg.ir('vender');
await pg.evaluate(id => { S.ticket = { items: [{ productoId: id, descripcion: 'Blusa · XL', cantidad: 1, precio: 250, variante: 'XL' }], clienteId: '', pedidoId: '', descuento: 0 }; guardarTicket(); R.vender(); }, blusa.id);
await pg.waitForTimeout(500); await pg.accion('abrirCobro', 900);
let t = await pg.hojaTxt(); const precioTicket = await pg.evaluate(() => S.ticket.items[0].precio);
ok('Cobrar: la talla XL conserva su precio (L 250)', precioTicket === 250 && /250\.00/.test(t) && !/Cobrar L\s*200\.00/.test(t), precioTicket + ' · ' + t.slice(0, 160));
await pg.screenshot({ path: OUT + '/51-cobrar-opcion.png' });
await pg.evaluate(() => { cerrarHojas(); S.ticket = { items: [], clienteId: '', pedidoId: '', descuento: 0 }; guardarTicket(); });
// 2) Guardar el producto no pisa lo vendido mientras el formulario estaba abierto
await pg.ir('productos'); await pg.evaluate(id => formProducto(byId(S.productos, id)), blusa.id); await pg.waitForTimeout(700);
r = await api('venta', { items: [{ productoId: blusa.id, cantidad: 3, precio: 200, variante: 'M' }], metodo: 'Efectivo', recibido: 600, clave: 'rv1' }, tok); if (!r.ok) console.log('venta', r.error);
await pg.fill('#pf-pre, #pf-precio, [id^="pf-p"]', '210').catch(async () => { await pg.evaluate(() => { const i = [...document.querySelectorAll('.hoja input, .sheet input')].find(x => x.value === '200' || x.value === '200.00'); i.value = '210'; i.dispatchEvent(new Event('input', { bubbles: true })); }); });
await pg.texto('Guardar', 1500);
const tras = (await api('bootstrap', {}, tok)).data.productos.find(x => x.id === blusa.id), V = JSON.parse(tras.variantes);
ok('Producto: al cambiar solo el precio, la existencia de M queda en 7 (no vuelve a 10)', tras.precio === 210 && V['Talla: M'].s === 7 && tras.stock === 12, JSON.stringify({ precio: tras.precio, stock: tras.stock, v: tras.variantes }));
// 3) Venta al crédito de días atrás que hoy se cambia a pagada → «Cobrado» de hoy la muestra
r = await api('venta', { items: [{ productoId: blusa.id, cantidad: 1, precio: 200, variante: 'M' }], metodo: 'Crédito', clienteId: cid, clave: 'rv2' }, tok); const vc = r.data.venta;
const atras = new Date(Date.now() - 3 * 86400000), f3 = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Tegucigalpa' }).format(atras) + 'T10:00';
db.T.Ventas.find(x => x.id === vc.id).fecha = f3;
r = await api('editarVenta', { id: vc.id, items: [{ productoId: blusa.id, cantidad: 1, precio: 210, variante: 'M' }], clienteId: cid, metodo: 'Efectivo', recibido: 210, motivo: 'ya pagó' }, tok); if (!r.ok) console.log('editar', r.error);
await pg.evaluate(() => { S.f.rep = 'cobrado'; S.f.kper = 'hoy'; }); await pg.ir('reportes'); await pg.waitForTimeout(600);
await pg.texto('Cobrado', 900); await pg.tocar('[data-a="kper"][data-k="hoy"]', 1200); t = await pg.txt();
ok('Reportes › Cobrado (hoy): sale la venta cobrada al editarla', /Venta cobrada/.test(t) && /Rosa Mejía/.test(t), t.slice(0, 300));
await pg.screenshot({ path: OUT + '/51-cobrado-hoy.png', fullPage: true });
// 4) Novedades 1.9.92
await pg.evaluate(() => { cerrarHojas(); mostrarNovedades(''); }); await pg.waitForTimeout(700); t = await pg.hojaTxt();
ok('Novedades: aparece la 1.9.92', /1\.9\.92/.test(t) && /Revisión completa/.test(t), t.slice(0, 200));
await pg.screenshot({ path: OUT + '/51-novedades.png' });
await cerrar(); process.exit(0);
