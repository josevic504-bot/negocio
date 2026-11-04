// Vuelca los campos de varias hojas: [["vista","accion"],...]
import { nuevaPagina, cerrar, esperar, api, db } from './base.mjs';
import { dump } from './lib.mjs';
const lista = JSON.parse(process.argv[2]);
const reg = await api('registrar', { negocio: 'Variedades Prueba Total', nombre: 'Vic Prueba', giro: process.env.GIRO || 'variedades', whatsapp: '98765432', pin: '1234' });
const tok = reg.data.token; await api('cargarEjemplos', {}, tok);
const b = (await api('bootstrap', {}, tok)).data; const p = b.productos[0];
const cli = (await api('guardar', { entidad: 'Clientes', registro: { nombre: 'Doña Marta', telefono: '9999-0000', limite: 5000, activo: true } }, tok)).data; const cid = (cli.registro || cli).id;
await api('guardar', { entidad: 'Proveedores', registro: { nombre: 'Distribuidora Sula', telefono: '2222-0000', activo: true } }, tok);
await api('venta', { items: [{ productoId: p.id, cantidad: 2, precio: p.precio }], metodo: 'Efectivo', recibido: 2000, clave: 'A' }, tok);
await api('venta', { items: [{ productoId: p.id, cantidad: 1, precio: p.precio }], metodo: 'Crédito', clienteId: cid, recibido: 0, clave: 'B' }, tok);
const pg = await nuevaPagina({ token: tok, verApi: true });
await pg.goto('http://localhost:8765/'); await esperar(pg, 8000); await pg.waitForTimeout(1200);
for (const [vista, ...acciones] of lista) {
  await pg.ir(vista);
  for (const a of acciones) { try { if (a.startsWith('text:')) { await pg.getByText(a.slice(5), { exact: false }).first().click(); await pg.waitForTimeout(700); } else await pg.accion(a, 700); } catch (e) { console.log('   (no se pudo', a, e.message.split('\n')[0], ')'); } }
  console.log(`\n=== ${vista} › ${acciones.join(' › ')}\n` + (await dump(pg)).slice(0, 2500));
  console.log('TEXTO: ' + (await pg.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 600));
  await pg.cap('ex-' + vista + '-' + acciones.join('-').replace(/[^a-z0-9-]/gi, ''));
  await pg.evaluate(() => { try { cerrarHojas(); } catch (e) {} });
}
await cerrar();
