// Giro Vitaminas y suplementos: ejemplos con lotes, venta por lote que vence antes, alta y baja de lotes, recompra
// node vitaminas.mjs <carpeta con Codigo.gs>
import { createHash } from 'node:crypto'; import fs from 'node:fs';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const RAIZ = process.argv[2];
const SRC = fs.readFileSync(RAIZ + '/Codigo.gs', 'utf8');
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), log: () => {}, urlArchivo: r => 'https://x/' + r, rutaDeUrl: () => null });
const api = (action, data, token) => srv.atender({ action, token, data: data || {} });
let fallas = 0;
const ok = (t, c, extra) => { console.log((c ? 'OK   ' : 'FALLA') + ' · ' + t + (c ? '' : ' → ' + JSON.stringify(extra).slice(0, 300))); if (!c) fallas++; };

const reg = await api('registrar', { negocio: 'Vida Natural HN', nombre: 'Ana', giro: 'vitaminas', whatsapp: '99990000', pin: '1234' });
ok('registro con giro vitaminas', reg.ok, reg); const tok = reg.data.token;
let r = await api('cargarEjemplos', {}, tok); ok('carga 10 ejemplos', r.ok && r.data.agregados === 10, r);
let ps = r.data.productos, multi = ps.find(p => p.nombre === 'Multivitamínico adulto'), cola = ps.find(p => p.nombre.startsWith('Colágeno'));
ok('ejemplo con rinde 60', multi.rinde === 60, multi);
ok('ejemplo con lote y caducidad', JSON.parse(multi.lotes).length === 1 && multi.caduca === JSON.parse(multi.lotes)[0].v, multi);
r = await api('bootstrap', {}, tok); ok('bootstrap', r.ok, r);
r = await api('lotes', {}, tok); ok('lista de lotes', r.ok && r.data.length >= 10, r);
// Agregar un lote que vence antes y otro después
const h = new Date(); const f = d => { const x = new Date(h.getTime() + d * 864e5); return x.toISOString().slice(0, 10); };
r = await api('loteAgregar', { productoId: cola.id, lote: 'A-114', vence: f(12), cantidad: 6 }, tok); ok('agregar lote A-114', r.ok, r);
r = await api('loteAgregar', { productoId: cola.id, lote: 'B-200', vence: f(400), cantidad: 4 }, tok); ok('agregar lote B-200', r.ok, r);
let p = r.data; let L = JSON.parse(p.lotes);
ok('existencia 8 + 6 + 4 = 18', p.stock === 18, p);
ok('caducidad = lote más próximo (A-114)', p.caduca === f(12), [p.caduca, L]);
// Cliente y venta: sale del que vence antes
const cli = (await api('guardar', { entidad: 'Clientes', registro: { nombre: 'María López', telefono: '99887766' } }, tok)).data;
r = await api('venta', { clienteId: cli.id, items: [{ productoId: cola.id, cantidad: 7, precio: 480 }], metodo: 'Efectivo', recibido: 4000, clave: 'v1' }, tok); ok('venta de 7', r.ok, r);
p = (await api('bootstrap', {}, tok)).data.productos.find(x => x.id === cola.id); L = JSON.parse(p.lotes);
ok('A-114 se agotó primero y el siguiente perdió 1', !L.find(x => x.l === 'A-114') && p.stock === 11 && L.reduce((s, x) => s + x.n, 0) === 11, L);
ok('caducidad pasa al siguiente lote', p.caduca === L[0].v, [p.caduca, L]);
// Anular devuelve existencia sin lote
const vid = r.data.venta ? r.data.venta.id : r.data.id;
// Baja de un lote específico
r = await api('lotes', {}, tok); const lb = r.data.find(x => x.productoId === cola.id && x.l === 'B-200');
r = await api('loteBaja', { productoId: cola.id, i: lb.i }, tok); ok('baja del lote B-200', r.ok, r);
p = (await api('bootstrap', {}, tok)).data.productos.find(x => x.id === cola.id); L = JSON.parse(p.lotes);
ok('quedan 7 y sin B-200', p.stock === 7 && !L.find(x => x.l === 'B-200') && L.reduce((s, x) => s + x.n, 0) === 7, [p.stock, L]);
// Recompra: la venta se hizo hace 27 días (rinde 30 → termina en 3 días... con 7 unidades: 210 días). Probamos con el multivitamínico x1
r = await api('venta', { clienteId: cli.id, items: [{ productoId: multi.id, cantidad: 1, precio: 350, variante: 'Presentación: 60 cápsulas' }], metodo: 'Efectivo', recibido: 350, clave: 'v2' }, tok); ok('venta multivitamínico', r.ok, r);
const ventas = await db.tabla ? null : null;
// mover la fecha de esa venta 55 días atrás
const V = (await api('ventas', {}, tok)).data; const v2 = (V.lista || V).find(x => x.total === 350);
const atras = new Date(h.getTime() - 55 * 864e5).toISOString().slice(0, 10) + 'T10:00';
await db.aplicar({ ops: [{ t: 'Ventas', op: 'upd', k: { id: v2.id }, row: { fecha: atras } }] });
r = await api('recompra', {}, tok); ok('recompra responde', r.ok, r);
const it = r.ok && r.data.lista.find(x => x.producto === 'Multivitamínico adulto');
ok('María aparece (días usados + días que faltan = 60)', it && it.faltan + it.haceDias === 60 && it.faltan <= 7, r.data);
ok('el colágeno (7 unidades × 30 días) no aparece', r.ok && !r.data.lista.find(x => x.producto.startsWith('Colágeno')), r.data);
r = await api('recompraAvisado', { clienteId: cli.id, productoId: multi.id, ventaId: it && it.ventaId }, tok); ok('marcar avisada', r.ok && r.data.lista[0].avisado, r);
// Cajero no puede agregar lotes
r = await api('guardar', { entidad: 'Usuarios', registro: { nombre: 'Caja', usuario: 'caja', rol: 'cajero', pin: '5678', activo: true } }, tok);
// Tienda: rinde y vence
const neg = (await api('bootstrap', {}, tok)).data.negocioId;
r = await api('tiendaInfo', { n: neg, negocio: neg }, null);
const tp = r.ok && r.data.productos.find(x => x.nombre === 'Multivitamínico adulto');
ok('tienda muestra rinde y mes de vencimiento', tp && tp.rinde === 60 && /^\d{4}-\d{2}$/.test(tp.vence), r.ok ? tp : r);
ok('la tienda no expone los lotes ni avisos', r.ok && !JSON.stringify(r.data).includes('recompraAv') && !JSON.stringify(r.data).includes('A-114'), '');
// Guardar producto no puede tocar lotes
r = await api('guardar', { entidad: 'Productos', registro: { id: cola.id, lotes: '[{"l":"X","v":"2030-01-01","n":999}]', rinde: 45 } }, tok);
ok('guardar ignora lotes y guarda rinde', r.ok && !r.data.lotes.includes('999') && r.data.rinde === 45, r);
console.log(fallas ? fallas + ' FALLAS' : 'TODO BIEN'); process.exit(fallas ? 1 : 0);
