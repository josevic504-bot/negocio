// Prueba de la fase 5: un «Google» simulado (modo prueba de la app con el negocio de ejemplo, meses de historia),
// se corre Exportar.gs, se importa en el servidor nuevo y se comparan los reportes en los dos lados.
import fs from 'node:fs'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const SRC = fs.readFileSync(new URL('../../Codigo.gs', import.meta.url), 'utf8');
const EXP = fs.readFileSync(new URL('../exportar/Exportar.gs', import.meta.url), 'utf8').replace('PEGAR_AQUI_LA_CLAVE', 'k-prueba');
const HTML = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const corta = (ini, fin) => { const a = HTML.indexOf(ini); return HTML.slice(a, HTML.indexOf(fin, a)); };
let reloj = new Date('2026-10-30T19:00:00-06:00').getTime(), semilla = 777; const RealDate = Date;
globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [reloj])); } static now() { return reloj; } };
Math.random = () => { semilla = (semilla * 16807) % 2147483647; return (semilla - 1) / 2147483646; };
const shims = new Function(corta('function sha256(bytes)', 'function demoShims') + corta('function demoShims(DEMO)', '// Compila el código del servidor') + 'return demoShims;')();
// «Google»
const DEMO = { db: { sheets: {}, order: [] }, cache: {} };
const envios = [];
const UrlFetchApp = { fetch: (url, o) => { envios.push(o.payload); return { getContentText: () => '{"ok":true,"data":{}}', getResponseCode: () => 200 }; } };
const SH = shims(DEMO);
const PS0 = SH[6]; SH[6] = { getScriptProperties: () => Object.assign(PS0.getScriptProperties(), { getProperties: () => Object.assign({}, DEMO.db.props || {}) }) };
const G = new Function('SpreadsheetApp', 'Utilities', 'CacheService', 'LockService', 'Logger', 'ContentService', 'PropertiesService', 'DriveApp', 'UrlFetchApp',
  SRC + '\n' + EXP + '\nreturn { route_, instalar, setNegocio_, negocioPorId_, sembrarEjemplo_, mRows_, exportarASupabase };')(...SH, UrlFetchApp);
G.instalar();
const g = req => { try { return { ok: true, data: JSON.parse(JSON.stringify(G.route_(JSON.parse(JSON.stringify(req))) ?? null)) }; } catch (e) { return { ok: false, error: String(e.message || e) }; } };
const r1 = g({ action: 'registrar', data: { negocio: 'Variedades Sofía', giro: 'variedades', nombre: 'Sofía Hernández', whatsapp: '9876-0000', pin: '1234' } });
const lic = G.mRows_('Licencias').find(l => l.negocio === 'Variedades Sofía');
G.setNegocio_(G.negocioPorId_(lic.id)); G.sembrarEjemplo_(r1.data.usuario.id);
g({ action: 'registrar', data: { negocio: 'Ferretería El Clavo', giro: 'ferreteria', nombre: 'Luis', whatsapp: '9555-1111', pin: '4321' } });
DEMO.db.props = Object.assign(DEMO.db.props || {}, { PANEL_CLAVE: 'xyz', PLUS_PASSWORD: 'p' });
// Exportar
G.exportarASupabase();
const filasG = {}; Object.keys(DEMO.db.books || {}).forEach(b => Object.keys(DEMO.db.books[b].sheets).forEach(t => { filasG[t] = (filasG[t] || 0) + Math.max(0, DEMO.db.books[b].sheets[t].filter(r => r && r[0] !== '' && r[0] != null).length - 1); }));
// Importar en el servidor nuevo
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
await db.aplicar({ props: { IMPORTAR_CLAVE: 'k-prueba' } });
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), urlArchivo: r => 'u/' + r, rutaDeUrl: () => null });
let filasS = 0, errores = 0;
for (const p of envios) { const r = await srv.atender(JSON.parse(p)); if (!r.ok) { errores++; console.log('error al importar:', r.error); } else filasS += r.data.filas; }
console.log('envíos:', envios.length, '· filas importadas:', filasS, '· errores:', errores);
const mal = Object.keys(filasG).filter(t => (db.T[t] || []).length !== filasG[t]).map(t => t + ' google ' + filasG[t] + ' vs supabase ' + (db.T[t] || []).length);
console.log('tablas con cantidad distinta:', mal.length ? mal : 'ninguna');
console.log('propiedades copiadas:', Object.keys(db.props).filter(k => k !== 'IMPORTAR_CLAVE').join(', '));
// Comparar respuestas
const S = async req => JSON.parse(JSON.stringify(await srv.atender(JSON.parse(JSON.stringify(req)))));
const pasos = [['login', { whatsapp: '9876-0000', pin: '1234' }], ['bootstrap', {}], ['inicio', {}], ['pendientes', {}], ['ventas', { desde: '2026-08-01', hasta: '2026-10-31' }],
  ['reporte', { desde: '2026-09-01', hasta: '2026-10-31', giro: '' }], ['reporte', { desde: '2026-10-01', hasta: '2026-10-31', giro: '' }], ['diario', { fecha: '2026-10-29' }], ['caja', {}],
  ['compras', { desde: '2026-08-01', hasta: '2026-10-31' }], ['gastos', { desde: '2026-08-01', hasta: '2026-10-31' }], ['pedidos', {}], ['historial', {}], ['inventario', {}], ['cuentas', {}], ['chats', {}],
  ['venta', null], ['inicio', {}], ['login', { whatsapp: '9555-1111', pin: '4321' }], ['bootstrap', {}]];
let tg = '', ts = '', iguales = 0, total = 0;
for (const [a, d0] of pasos) {
  reloj += 30000;
  let d = d0;
  if (a === 'venta') { const b = g({ action: 'bootstrap', token: tg }).data; const p = b.productos.find(x => x.stock > 2); d = { items: [{ productoId: p.id, cantidad: 2, precio: p.precio }], metodo: 'Efectivo', recibido: 99999, clave: 'MIG-1' }; }
  const sem = semilla, x = g({ action: a, token: tg, data: d }); const semG = semilla; semilla = sem;
  const y = await S({ action: a, token: ts, data: d }); semilla = semG;
  if (a === 'login') { tg = x.data && x.data.token; ts = y.data && y.data.token; }
  const norm = o => JSON.stringify(o).replace(/"token":"[0-9a-f]+"/g, '"token":"<t>"').replace(/\b[A-Z]MV[0-9A-Z]{8,}\b/g, '<id>');
  total++;
  if (norm(x) === norm(y)) { iguales++; console.log('= ', a, x.ok ? '' : '(' + x.error + ')'); }
  else { const A = norm(x), Bb = norm(y); let k = 0; while (A[k] === Bb[k]) k++; console.log('≠ ', a, '\n   google  :', A.slice(Math.max(0, k - 100), k + 100), '\n   supabase:', Bb.slice(Math.max(0, k - 100), k + 100)); }
}
console.log(`\n${iguales} de ${total} respuestas idénticas entre Google y Supabase después de copiar los datos`);
