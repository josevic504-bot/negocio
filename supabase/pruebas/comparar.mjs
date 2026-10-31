// Corre la misma secuencia en el motor del modo prueba (simulador de hojas de index.html) y en el servidor nuevo, y compara las respuestas
import fs from 'node:fs'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const SRC = fs.readFileSync(new URL('../../Codigo.gs', import.meta.url), 'utf8');
const HTML = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const corta = (ini, fin) => { const a = HTML.indexOf(ini); return HTML.slice(a, HTML.indexOf(fin, a)); };
const sha = corta('function sha256(bytes)', 'function demoShims');
const shims = corta('function demoShims(DEMO)', '// Compila el código del servidor');
const demoComp = corta('function demoCompilar(src, DEMO)', 'const API_URL_DEFAULT');
// Reloj y azar iguales para los dos
let reloj, semilla; const RealDate = Date;
function fijar() { reloj = new RealDate('2026-10-30T20:00:00-06:00').getTime(); semilla = 12345; }
globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [reloj])); } static now() { return reloj; } };
Math.random = () => { semilla = (semilla * 16807) % 2147483647; return (semilla - 1) / 2147483646; };
let uu = 0; const uuidFijo = () => { uu++; return '00000000-0000-4000-8000-' + String(uu).padStart(12, '0'); };
Object.defineProperty(globalThis.crypto, 'randomUUID', { value: uuidFijo, configurable: true });
const demoMod = new Function(sha + '\n' + shims + '\n' + demoComp + '\nreturn { demoCompilar };')();

const pasos = (tok, x) => [
  ['registrar', { negocio: 'Pulpería La Bendición', nombre: 'Vic', giro: 'tienda', whatsapp: '33130265', pin: '1234' }],
  ['login', { whatsapp: '33130265', pin: '1234' }],
  ['login', { whatsapp: '33130265', pin: '0000' }],
  ['bootstrap', {}], ['cargarEjemplos', {}],
  ['guardar', { entidad: 'Productos', registro: { nombre: 'Café molido 400 g', categoria: 'Abarrotes', precio: 95, costo: 70, stock: 12, tipo: 'producto', activo: true } }],
  ['guardar', { entidad: 'Clientes', registro: { nombre: 'Doña Marta', telefono: '9999-0000', limite: 2000, activo: true } }],
  ['venta', () => ({ items: [{ productoId: x.pid, cantidad: 2, precio: 95 }], metodo: 'Efectivo', recibido: 200, clave: 'T1-a' })],
  ['venta', () => ({ items: [{ productoId: x.pid, cantidad: 2, precio: 95 }], metodo: 'Efectivo', recibido: 200, clave: 'T1-a' })],
  ['venta', () => ({ clienteId: x.cid, items: [{ productoId: x.pid, cantidad: 1, precio: 95 }], metodo: 'Crédito', recibido: 0, clave: 'T2-b' })],
  ['abono', () => ({ clienteId: x.cid, monto: 50, metodo: 'Efectivo' })],
  ['guardarGasto', { registro: { categoria: 'Luz', detalle: 'ENEE', monto: 300, fechaGasto: '2026-10-30', metodo: 'Efectivo' } }],
  ['guardar', { entidad: 'Proveedores', registro: { nombre: 'Distribuidora Sula', telefono: '2550-0000', activo: true } }],
  ['compra', () => ({ proveedorId: x.prov, factura: 'F-77', fecha: '2026-10-30', metodo: 'Crédito', nota: '', items: [{ productoId: x.pid, cantidad: 10, costo: 68 }] })],
  ['pago', () => ({ proveedorId: x.prov, monto: 200, metodo: 'Efectivo', nota: '' })],
  ['ajusteStock', () => ({ id: x.pid, modo: 'salida', cantidad: 1, motivo: 'Dañado' })],
  ['guardar', { entidad: 'Config', registro: { tienda: 'si' } }],
  ['pedir', () => ({ negocio: x.neg, nombre: 'Carlos', telefono: '98765432', entrega: 'retiro', direccion: '', pago: 'Efectivo', nota: '', items: [{ id: x.pid, cantidad: 1, opcion: '' }] })],
  ['pedidos', {}],
  ['compras', { desde: '2026-10-01', hasta: '2026-10-31' }], ['cuentaProveedor', () => ({ id: x.prov })],
  ['guardarUsuario', { registro: { nombre: 'Cajera Ana', usuario: '99887766', rol: 'cajero', color: '#333', activo: true, clave: '4321' } }],
  ['inicio', {}], ['ventas', { desde: '2026-10-01', hasta: '2026-10-31' }],
  ['cuentaCliente', () => ({ id: x.cid })],
  ['anularVenta', () => ({ id: x.vid, motivo: 'prueba' })],
  ['caja', {}], ['reporte', { desde: '2026-10-01', hasta: '2026-10-31', giro: '' }], ['diario', { fecha: '2026-10-30' }],
  ['kardex', () => ({ id: x.pid })], ['pendientes', {}], ['bootstrap', {}],
  ['estadoPedido', () => ({ id: x.ped, estado: 'confirmado' })],
  ['cerrarCaja', { contado: 500, nota: 'cierre' }],
  ['login', { whatsapp: '99887766', pin: '4321' }],
  ['tiendaInfo', () => ({ negocio: x.neg })],
  ['chatEnviar', () => ({ negocio: x.neg, nombre: 'Carlos', telefono: '98765432', texto: '¿Tienen café?', clave: 'cli-1' })],
  ['chats', {}],
  ['chatResponder', () => ({ id: x.chat, texto: 'Sí, a L 95' })],
  ['chatVer', () => ({ negocio: x.neg, clave: 'cli-1' })],
  ['soporteCrear', { motivo: 'error', modulo: 'Ventas', texto: 'No imprime', foto: '', version: '1.9.23' }],
  ['visita', { p: 'negocio', o: 'tiktok', v: 'abc123' }],
  ['logout', {}], ['bootstrap', {}]
];
async function correr(motor) {
  fijar(); uu = 0; const x = {}, out = []; let tok = '';
  for (const [a, dd] of pasos(tok, x)) {
    const d = typeof dd === 'function' ? dd() : dd;
    reloj += 60000;
    const r = await motor({ action: a, token: tok, data: JSON.parse(JSON.stringify(d)) });
    if (a === 'registrar' && r.ok) { tok = r.data.token; }
    if (a === 'guardar' && r.ok && d.entidad === 'Productos') x.pid = (r.data.registro || r.data).id;
    if (a === 'guardar' && r.ok && d.entidad === 'Clientes') x.cid = (r.data.registro || r.data).id;
    if (a === 'venta' && r.ok && !x.vid) x.vid = r.data.venta.id;
    if (a === 'guardar' && r.ok && d.entidad === 'Proveedores') x.prov = (r.data.registro || r.data).id;
    if (a === 'bootstrap' && r.ok && !x.neg) x.neg = r.data.negocioId;
    if (a === 'chats' && r.ok) { const l = r.data.lista || r.data; x.chat = Array.isArray(l) && l[0] ? l[0].id : ''; }
    if (a === 'pedidos' && r.ok) { const l = r.data.lista || r.data; x.ped = Array.isArray(l) && l[0] ? l[0].id : ''; }
    out.push([a, r]);
  }
  return out;
}
// Motor 1: modo prueba (Codigo.gs + simulador de hojas)
const DEMO = { db: { sheets: {}, order: [] }, cache: {} };
fijar();
const Bd = demoMod.demoCompilar(SRC, DEMO); Bd.instalar(); DEMO.db.props = DEMO.db.props || {};
const r1 = await correr(async req => { try { return { ok: true, data: JSON.parse(JSON.stringify(Bd.route_(req) ?? null)) }; } catch (e) { return { ok: false, error: String(e.message || e) }; } });
// Motor 2: servidor nuevo
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
fijar();
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), urlArchivo: r => 'u/' + r, rutaDeUrl: () => null });
const r2 = await correr(async req => JSON.parse(JSON.stringify(await srv.atender(req))));
// Comparar (los ids de hoja y negocio pueden diferir: se normalizan)
const norm = s => JSON.stringify(s).replace(/"(N|H|S)[0-9A-Z]{8,}[0-9a-z]*"/g, '"<id>"').replace(/\b[A-Z]MVV[0-9A-Z]{9,}\b/g, '<id>');
let iguales = 0;
r1.forEach(([a, x], i) => {
  const y = r2[i][1];
  if (norm(x) === norm(y)) { iguales++; console.log('= ', a, x.ok ? '' : '(' + x.error + ')'); }
  else { console.log('≠ ', a); const A = norm(x), Bb = norm(y); let k = 0; while (A[k] === Bb[k]) k++; console.log('   modo prueba:', A.slice(Math.max(0, k - 80), k + 120)); console.log('   nuevo      :', Bb.slice(Math.max(0, k - 80), k + 120)); }
});
console.log(`\n${iguales} de ${r1.length} respuestas idénticas`);
