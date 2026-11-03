// Pruebas: respaldos (hacer, lista, restaurar, guardar solo los recientes), tarea de la noche, salud y copiar productos
import fs from 'node:fs'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const SRC = fs.readFileSync(process.argv[2], 'utf8');
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), log: () => {}, urlArchivo: r => 'http://x/__f/' + r, rutaDeUrl: u => (u.split('/__f/')[1] || null) });
const api = (action, data, token, extra) => srv.atender(Object.assign({ action, token, data: data || {} }, extra || {}));
let fallas = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fallas++; };
await db.aplicar({ props: { PANEL_CLAVE: 'clave123', TAREAS_CLAVE: 'tk', RT_SECRETO: 'rt' } });
const t1 = (await api('registrar', { negocio: 'Norey Beauty', nombre: 'Noemí', giro: 'catalogo', whatsapp: '33130265', pin: '1234' })).data.token;
await api('cargarEjemplos', {}, t1);
const n1 = (await api('bootstrap', {}, t1)).data.negocioId;
const t2 = (await api('registrar', { negocio: 'Perfumería Rosa', nombre: 'Rosa', giro: 'catalogo', whatsapp: '99887766', pin: '1234' })).data.token;
const n2 = (await api('bootstrap', {}, t2)).data.negocioId;
const pt = (await api('panelLogin', { clave: 'clave123' })).data.token;
const P = (a, d) => srv.atender({ action: a, panel: pt, data: d || {} });
const prods = () => db.T.Productos.filter(p => p.negocio_id === n1).length;
const p0 = prods(); ok(p0 > 3, 'el negocio tiene ' + p0 + ' productos de ejemplo');
ok((await srv.atender({ action: 'panelRespaldos', panel: 'malo', data: { id: n1 } })).error === 'PANEL', 'sin sesión del panel no deja ver respaldos');
const r1 = await P('panelRespaldoHacer', { id: n1 }); ok(r1.ok && r1.data.resumen.productos === p0, 'respaldo manual: ' + JSON.stringify(r1.data && r1.data.resumen) + ' · ' + (r1.data && r1.data.kb) + ' KB');
let l = (await P('panelRespaldos', { id: n1 })).data; ok(l.length === 1 && l[0].tipo === 'manual', 'aparece en la lista');
// Se pierden productos y se restauran solo los productos
const borrar = db.T.Productos.filter(p => p.negocio_id === n1).slice(0, 3).map(p => p.id);
db.T.Productos = db.T.Productos.filter(p => borrar.indexOf(p.id) < 0);
ok(prods() === p0 - 3, 'se borraron 3 productos');
const ventasAntes = db.T.Ventas ? db.T.Ventas.filter(v => v.negocio_id === n1).length : 0;
const rs = await P('panelRespaldoRestaurar', { id: n1, rid: l[0].id, alcance: 'productos' });
ok(rs.ok && prods() === p0, 'restaurar productos: vuelven a ser ' + prods() + (rs.ok ? '' : ' · ' + rs.error));
ok((db.T.Ventas ? db.T.Ventas.filter(v => v.negocio_id === n1).length : 0) === ventasAntes, 'las ventas no se tocan');
l = (await P('panelRespaldos', { id: n1 })).data; ok(l.some(x => x.tipo === 'antes'), 'antes de restaurar se guardó una copia');
ok((db.efectos || []).some(e => e.rt), 'avisa a su app que cambió');
const bootP = (await api('bootstrap', {}, t1)).data; ok((bootP.productos || []).length === p0, 'su app ve los ' + p0 + ' productos');
// Solo se guardan los más recientes
for (let i = 0; i < 5; i++) await P('panelRespaldoHacer', { id: n1, forzar: true });
l = (await P('panelRespaldos', { id: n1 })).data; ok(l.filter(x => x.tipo === 'manual').length === 4, 'manuales guardados: ' + l.filter(x => x.tipo === 'manual').length + ' (máximo 4)');
ok(db.T.RespaldoDatos.filter(x => x.negocio_id === n1).length === l.length, 'los datos viejos también se borran');
const dt = await P('panelRespaldoDatos', { id: n1, rid: l[0].id }); ok(dt.ok && dt.data.Productos.length === p0, 'datos para Excel: ' + Object.keys(dt.data || {}).join(', '));
// Tarea de la noche
ok((await srv.atender({ tarea: 'respaldosDia', clave: 'mala' })).ok === false, 'la tarea pide la clave');
const td = await srv.atender({ tarea: 'respaldosDia', clave: 'tk' }); ok(td.ok && td.data.hechos + td.data.sinCambio === 2, 'tarea de la noche (se salta el que no cambió): ' + JSON.stringify(td.data));
const td2 = await srv.atender({ tarea: 'respaldosDia', clave: 'tk' }); ok(td2.ok && td2.data.pendientes === 0, 'no se repite el mismo día');
const lic = db.T.Licencias.find(x => x.id === n1); ok(lic.nProductos === String(p0) && lic.respaldo, 'la licencia guarda productos ' + lic.nProductos + ', clientes ' + lic.nClientes + ', respaldo ' + lic.respaldo);
// Salud en el Panel
const res = (await P('panelResumen')).data; const f1 = res.negocios.find(x => x.id === n1);
ok(f1.salud && f1.salud.n >= 0 && f1.salud.np === p0, 'salud en la tarjeta: ' + JSON.stringify(f1.salud));
const fi = (await P('panelNegocio', { id: n1 })).data; ok(fi.salud && fi.salud.np === p0, 'salud en la ficha: ' + fi.salud.n);
// Copiar productos
const info = (await P('panelCopiarInfo', { de: n1 })).data; ok(info.total === p0 && info.cats.length > 0, 'categorías para copiar: ' + info.cats.map(c => c.cat + ' ' + c.n).join(', '));
const cat = info.cats[0];
const cp = await P('panelCopiarProductos', { de: n1, a: n2, cats: [cat.cat], fotos: false, costos: false, existencias: false });
ok(cp.ok && cp.data.copiados === cat.n, 'copiados ' + (cp.data && cp.data.copiados) + ' de «' + cat.cat + '»' + (cp.ok ? '' : ' · ' + cp.error));
const dest = db.T.Productos.filter(p => p.negocio_id === n2);
ok(dest.length === cat.n && dest.every(p => Number(p.stock) === 0 && Number(p.costo) === 0), 'llegan con existencia y costo en 0');
ok(dest.every(p => !db.T.Productos.some(q => q.negocio_id === n1 && q.id === p.id)), 'con códigos nuevos');
const cp2 = await P('panelCopiarProductos', { de: n1, a: n2, cats: null, fotos: false });
ok(cp2.data.omitidos === cat.n && cp2.data.copiados === p0 - cat.n, 'no repite los que ya tiene: copiados ' + cp2.data.copiados + ', ya tenía ' + cp2.data.omitidos);
const b2 = (await api('bootstrap', {}, t2)).data; ok((b2.productos || []).length === p0, 'la app del destino ve ' + (b2.productos || []).length + ' productos');
const vta = await api('venta', { items: [{ productoId: b2.productos[0].id, cantidad: 1, precio: b2.productos[0].precio }], metodo: 'Efectivo', recibido: 9999 }, t2);
ok(vta.ok || /existencia|stock|agotad|suficiente/i.test(vta.error), 'el destino puede usar un producto copiado: ' + (vta.ok ? 'venta hecha' : vta.error));
// Restaurar todo
const rt = await P('panelRespaldoRestaurar', { id: n2, rid: (await P('panelRespaldos', { id: n2 })).data.find(x => x.tipo !== 'antes').id, alcance: 'todo' });
ok(rt.ok && db.T.Productos.filter(p => p.negocio_id === n2).length === 0, 'restaurar todo devuelve el negocio vacío de antes de copiar');
console.log(fallas ? '\n✗ ' + fallas + ' fallas' : '\n✓ todo bien');
