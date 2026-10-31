import { api, db, logs } from './prueba.mjs';
const reg = await api('registrar', { negocio: 'Tienda Doble Caja', nombre: 'Vic', giro: 'tienda', whatsapp: '33130265', pin: '1234' });
const tok = reg.data.token;
const p = (await api('guardar', { entidad: 'Productos', registro: { nombre: 'Refresco', precio: 25, costo: 15, stock: 100, tipo: 'producto', activo: true } }, tok)).data;
// 10 ventas al mismo tiempo, cada una de 3 unidades
const res = await Promise.all(Array.from({ length: 10 }, (_, i) => api('venta', { items: [{ productoId: p.id, cantidad: 3, precio: 25 }], metodo: 'Efectivo', recibido: 75, clave: 'C' + i }, tok)));
const b = (await api('bootstrap', {}, tok)).data;
const nums = res.map(r => r.ok ? r.data.venta.numero : r.error);
console.log('ventas:', nums.join(' '));
console.log('stock final:', b.productos.find(x => x.id === p.id).stock, '(esperado 70)');
console.log('números repetidos:', nums.length - new Set(nums).size);
console.log(logs.filter(l => /^venta/.test(l)).map(l => l.replace(/ · \d+ ms/, '')).join('\n'));
