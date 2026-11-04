// Recorrido de TODAS las pantallas por rol (admin, cajero, bodega) en un negocio con datos
import { nuevaPagina, ok, cerrar, esperar, api, db } from './base.mjs';
const reg = await api('registrar', { negocio: 'Variedades Prueba Total', nombre: 'Vic Prueba', giro: 'variedades', whatsapp: '98765432', pin: '1234' });
const tok = reg.data.token;
await api('cargarEjemplos', {}, tok);
const b = (await api('bootstrap', {}, tok)).data;
const prods = b.productos;
const cli = (await api('guardar', { entidad: 'Clientes', registro: { nombre: 'Doña Marta', telefono: '9999-0000', limite: 5000, activo: true } }, tok)).data;
const cid = (cli.registro || cli).id;
for (let i = 0; i < 5; i++) { const p = prods[i % prods.length]; const r = await api('venta', { items: [{ productoId: p.id, cantidad: 1 + i % 2, precio: p.precio }], metodo: i === 4 ? 'Crédito' : 'Efectivo', clienteId: i === 4 ? cid : '', recibido: 2000, clave: 'K' + i }, tok); if (!r.ok) console.log('   venta previa', r.error); }
await api('guardarGasto', { registro: { detalle: 'Luz del local', monto: 350, categoria: 'Servicios', metodo: 'Efectivo', fecha: '2026-11-03' } }, tok).then(r => { if (!r.ok) console.log('   gasto previo', r.error); });
// Usuarios cajero y bodega
const uc = await api('guardarUsuario', { registro: { nombre: 'Cajera Ana', usuario: '9876-1111', rol: 'cajero', activo: true }, clave: '2222' }, tok); if (!uc.ok) console.log('   usuario cajero', uc.error);
const ub = await api('guardarUsuario', { registro: { nombre: 'Bodega Luis', usuario: '9876-2222', rol: 'bodega', activo: true }, clave: '3333' }, tok); if (!ub.ok) console.log('   usuario bodega', ub.error);
const VISTAS = ['inicio', 'vender', 'pedidos', 'mensajes', 'tienda', 'productos', 'precios', 'proyectos', 'clientes', 'proveedores', 'compras', 'gastos', 'caja', 'ventas', 'reportes', 'usuarios', 'ajustes'];
async function recorrer(pg, rol) {
  const visibles = await pg.evaluate(() => Object.keys(VISTAS).filter(k => puedeVer(k)));
  console.log('  ', rol, 'pantallas visibles:', visibles.join(' '));
  for (const v of visibles) {
    await pg.ir(v);
    const t = await pg.txt();
    const vista = await pg.evaluate(() => S.vista);
    ok(`${rol} · pantalla ${v}: carga sin error`, vista === v && t.length > 20 && !/No se pudo cargar|Cargando…/.test(t), (vista !== v ? 'quedó en ' + vista + ' · ' : '') + t.slice(0, 120));
    await pg.cap(rol + '-' + v);
  }
  return visibles;
}
let pg = await nuevaPagina({ token: tok });
await pg.goto('http://localhost:8765/'); await esperar(pg, 8000); await pg.waitForTimeout(1500);
ok('admin · entra con token guardado', /Variedades Prueba Total/.test(await pg.txt()));
const vAdmin = await recorrer(pg, 'admin');
ok('admin · ve todas las pantallas base', VISTAS.every(v => vAdmin.includes(v)), 'faltan: ' + VISTAS.filter(v => !vAdmin.includes(v)).join(','));
// Vista de computadora
const pc = await nuevaPagina({ token: tok, pc: true });
await pc.goto('http://localhost:8765/'); await esperar(pc, 8000); await pc.waitForTimeout(1200);
ok('admin · versión de computadora carga', /Variedades Prueba Total/.test(await pc.txt()));
await pc.cap('pc-inicio'); await pc.ir('vender'); await pc.cap('pc-vender'); await pc.ir('reportes'); await pc.cap('pc-reportes');
await pc.context().close();
// Cajero
const lc = await api('login', { whatsapp: '98761111', pin: '2222' }); if (!lc.ok) console.log('   login cajero', lc.error);
if (lc.ok) {
  const pgc = await nuevaPagina({ token: lc.data.token }); await pgc.goto('http://localhost:8765/'); await esperar(pgc, 8000); await pgc.waitForTimeout(1200);
  ok('cajero · entra', /Cajera Ana|Variedades/.test(await pgc.txt()));
  const vc = await recorrer(pgc, 'cajero');
  ok('cajero · no ve Reportes, Usuarios, Precios, Compras, Proveedores, Tienda', !['reportes', 'usuarios', 'precios', 'compras', 'proveedores', 'tienda'].some(v => vc.includes(v)), vc.join(','));
  const ctxt = await pgc.evaluate(() => JSON.stringify((S.productos || [])[0] || {}));
  ok('cajero · no recibe costos de productos', !/"costo":[1-9]/.test(ctxt), ctxt.slice(0, 150));
  await pgc.context().close();
}
// Bodega
const lb = await api('login', { whatsapp: '98762222', pin: '3333' }); if (!lb.ok) console.log('   login bodega', lb.error);
if (lb.ok) {
  const pgb = await nuevaPagina({ token: lb.data.token }); await pgb.goto('http://localhost:8765/'); await esperar(pgb, 8000); await pgb.waitForTimeout(1200);
  ok('bodega · entra', /Bodega Luis|Variedades/.test(await pgb.txt()));
  const vb = await recorrer(pgb, 'bodega');
  ok('bodega · no ve Vender, Clientes, Caja, Ventas, Reportes', !['vender', 'clientes', 'caja', 'ventas', 'reportes', 'usuarios'].some(v => vb.includes(v)), vb.join(','));
  await pgb.context().close();
}
await cerrar();
