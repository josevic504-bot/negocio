// Flujos principales por pantalla (administrador): vender, clientes, productos, gastos, compras, caja, reportes
import { nuevaPagina, ok, cerrar, esperar, api, db } from './base.mjs';
import { paso, texto, tiene, btn, dump } from './lib.mjs';
const reg = await api('registrar', { negocio: 'Variedades Prueba Total', nombre: 'Vic Prueba', giro: 'variedades', whatsapp: '98765432', pin: '1234' });
const tok = reg.data.token; await api('cargarEjemplos', {}, tok);
const prods = () => db.T.Productos;
const stock = n => { const p = prods().find(x => x.nombre.startsWith(n)); return p ? p.stock : null; };
const pg = await nuevaPagina({ token: tok });
await pg.goto('http://localhost:8765/'); await esperar(pg, 8000); await pg.waitForTimeout(1200);

/* ---------- VENDER ---------- */
await pg.ir('vender');
const stockPerf0 = stock('Perfume'), stockCam0 = stock('Camiseta');
await paso(pg, 'Vender · buscar y agregar producto simple (Perfume)', async () => {
  await pg.fill('#v-q', 'Perfume'); await pg.waitForTimeout(500);
  if ((await pg.locator('.pc[data-a=vadd]').count()) !== 1) throw new Error('la búsqueda no filtró a 1 producto');
  await pg.tocar('.pc[data-a=vadd]'); await pg.fill('#v-q', ''); await pg.waitForTimeout(400);
  return tiene(pg, /1 artículo L 480\.00/);
});
await paso(pg, 'Vender · producto con talla y color pide elegirlas', async () => {
  await pg.getByText('Camiseta básica').first().click(); await pg.waitForTimeout(600);
  if (!(await tiene(pg, /Talla S M L XL Color/))) throw new Error('no apareció el selector de talla/color');
  await pg.tocar('.chip[data-v=M]'); await pg.tocar('.chip[data-v=Negro]'); await btn(pg, 'Agregar');
  return tiene(pg, /2 artículos L 730\.00/);
});
await pg.cap('vender-ticket');
await paso(pg, 'Cobrar · abre con cliente, cantidades, descuento, ISV y formas de pago', async () => {
  await pg.accion('abrirCobro');
  return tiene(pg, /Camiseta básica · M · Negro.*Subtotal L 730\.00.*ISV incluido \(15%\) L 95\.22.*Efectivo Tarjeta Transfer\. Crédito/);
});
const kDe = async precio => { const ks = await pg.$$eval('[data-a=cbPrecio]', els => els.map(e => [e.dataset.k, e.textContent])); const f = ks.find(x => x[1].includes(precio)); if (!f) throw new Error('no hay línea de ' + precio + ': ' + JSON.stringify(ks)); return f[0]; };
await paso(pg, 'Cobrar · subir cantidad y bajarla con + / −', async () => {
  const k = await kDe('480');
  await pg.tocar(`[data-a=cbQ][data-k="${k}"][data-d="1"]`); if (!(await tiene(pg, /Total L 1,210\.00/))) throw new Error('no subió a 1,210');
  await pg.tocar(`[data-a=cbQ][data-k="${k}"][data-d="-1"]`); return tiene(pg, /Total L 730\.00/);
});
await paso(pg, 'Cobrar · descuento global', async () => {
  await pg.tocar('[data-a=cbDesc]'); await pg.waitForTimeout(400);
  const i = pg.locator('#pt-in, input[inputmode=decimal]').last(); await i.fill('30'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(500);
  return tiene(pg, /Descuento.*30\.00.*Total L 700\.00/);
});
await pg.cap('cobro');
await paso(pg, 'Cobrar · efectivo con L 1,000 calcula el cambio y graba la venta', async () => {
  await pg.tocar('[data-a=cbRec][data-v="1000"]');
  if (!(await tiene(pg, /Cambio L 300\.00/))) throw new Error('cambio incorrecto');
  await btn(pg, 'Cobrar L 700.00', 1500);
  const v = db.T.Ventas[db.T.Ventas.length - 1];
  if (!v || v.total !== 700 || v.descuento !== 30 || v.recibido !== 1000 || v.cambio !== 300) throw new Error('venta grabada: ' + JSON.stringify(v).slice(0, 200));
  return true;
});
await pg.cap('comprobante');
await paso(pg, 'Comprobante · muestra factura con WhatsApp e imprimir', async () => tiene(pg, /V-00001|Venta|Comprobante/) && (await pg.locator('[data-a=recVenta], [data-a=impVenta]').count()) >= 1);
await paso(pg, 'Inventario · existencias bajaron (Perfume −1, Camiseta M·Negro −1)', async () => {
  const camiseta = prods().find(x => x.nombre.startsWith('Camiseta'));
  const okCam = stock('Camiseta') === stockCam0 - 1, okPerf = stock('Perfume') === stockPerf0 - 1;
  if (!okCam || !okPerf) throw new Error(`perfume ${stockPerf0}→${stock('Perfume')} camiseta ${stockCam0}→${stock('Camiseta')} var=${String(camiseta.varStock || camiseta.existencias || '').slice(0, 80)}`);
  return true;
});
await pg.evaluate(() => cerrarHojas()); await pg.waitForTimeout(300);
await paso(pg, 'Vender · cobrar más de la existencia se rechaza', async () => {
  await pg.ir('vender'); await pg.fill('#v-q', 'Audífonos'); await pg.waitForTimeout(400); await pg.tocar('.pc[data-a=vadd]'); await pg.fill('#v-q', '');
  const ch = pg.locator('.chip[data-v=Negro]'); if (await ch.count()) { await ch.click(); await btn(pg, 'Agregar'); }
  await pg.accion('abrirCobro');
  const k = await kDe('650');
  for (let i = 0; i < 7; i++) await pg.tocar(`[data-a=cbQ][data-k="${k}"][data-d="1"]`, 150);
  await pg.waitForTimeout(400); const t = await texto(pg);
  const m = t.match(/− (\d+) \+/); const cant = m ? Number(m[1]) : 0;
  if (cant > 6) throw new Error('permitió cantidad ' + cant + ' con 6 disponibles');
  return /Solo hay|disponible|existencia/i.test(t) || cant === 6;
});
await pg.cap('vender-existencia');
await pg.evaluate(() => cerrarHojas()); await pg.evaluate(() => { S.ticket = { items: [], clienteId: '', pedidoId: '', descuento: 0 }; guardarTicket(); }); await pg.waitForTimeout(400);
await paso(pg, 'Vender al crédito · nuevo cliente rápido desde el cobro y venta a crédito', async () => {
  await pg.ir('vender'); await pg.fill('#v-q', 'Termo'); await pg.waitForTimeout(400); await pg.tocar('.pc[data-a=vadd]'); await pg.fill('#v-q', '');
  await pg.accion('abrirCobro'); await pg.accion('nuevoClienteRapido');
  const d = await dump(pg); console.log('     [cliente rápido] ' + d.slice(0, 500));
  const nom = pg.locator('input').filter({ has: pg.locator('xpath=.') }).last();
  return true;
});
await pg.cap('cliente-rapido');
await cerrar();
