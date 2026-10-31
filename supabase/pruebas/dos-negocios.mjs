// Dos negocios vendiendo al mismo tiempo en el mismo servidor: cada uno debe ver solo lo suyo
import { api } from './prueba.mjs';
const A = await api('registrar', { negocio: 'Tienda A', nombre: 'Ana', giro: 'tienda', whatsapp: '31111111', pin: '1111' });
const Bn = await api('registrar', { negocio: 'Tienda B', nombre: 'Beto', giro: 'tienda', whatsapp: '32222222', pin: '2222' });
const ta = A.data.token, tb = Bn.data.token;
const pa = (await api('guardar', { entidad: 'Productos', registro: { nombre: 'Pan A', precio: 10, costo: 5, stock: 50, tipo: 'producto', activo: true } }, ta)).data;
const pb = (await api('guardar', { entidad: 'Productos', registro: { nombre: 'Leche B', precio: 30, costo: 20, stock: 80, tipo: 'producto', activo: true } }, tb)).data;
const tareas = [];
for (let i = 0; i < 12; i++) {
  tareas.push(api('venta', { items: [{ productoId: pa.id, cantidad: 2, precio: 10 }], metodo: 'Efectivo', recibido: 20, clave: 'A' + i }, ta));
  tareas.push(api('venta', { items: [{ productoId: pb.id, cantidad: 1, precio: 30 }], metodo: 'Efectivo', recibido: 30, clave: 'B' + i }, tb));
  tareas.push(api('bootstrap', {}, i % 2 ? ta : tb));
}
const r = await Promise.all(tareas);
console.log('errores:', r.filter(x => !x.ok).map(x => x.error));
const ba = (await api('bootstrap', {}, ta)).data, bb = (await api('bootstrap', {}, tb)).data;
console.log('A ve productos:', ba.productos.map(p => p.nombre + ' ' + p.stock).join(', '), '(esperado Pan A 26)');
console.log('B ve productos:', bb.productos.map(p => p.nombre + ' ' + p.stock).join(', '), '(esperado Leche B 68)');
const va = (await api('ventas', { desde: '2026-01-01', hasta: '2026-12-31' }, ta)).data, vb = (await api('ventas', { desde: '2026-01-01', hasta: '2026-12-31' }, tb)).data;
console.log('ventas A:', (va.lista || va).length, ' ventas B:', (vb.lista || vb).length, '(esperado 12 y 12)');
