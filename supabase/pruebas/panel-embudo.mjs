// 1.9.83: pasos guardados en Licencias, embudo de cada publicidad y aviso de fin de prueba (servidor simulado)
import fs from 'node:fs'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const SRC = fs.readFileSync(process.argv[2], 'utf8');
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
const subsT = [];
db.push = async q => q.lista ? subsT : true;
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), log: () => {}, urlArchivo: r => 'https://x/archivos/' + r, rutaDeUrl: u => (u.split('/archivos/')[1] || null) });
const api = (action, data, token, extra) => srv.atender(Object.assign({ action, token, data: data || {} }, extra || {}));
let f = 0; const ok = (n, r) => { if (!r.ok) f++; console.log((r.ok ? '✓ ' : '✗ ') + n + (r.ok ? '' : ': ' + r.error)); return r.data; };
const igual = (n, a, b) => { const x = JSON.stringify(a) === JSON.stringify(b); if (!x) f++; console.log((x ? '✓ ' : '✗ ') + n + ': ' + JSON.stringify(a) + (x ? '' : ' (esperado ' + JSON.stringify(b) + ')')); };
const ef = () => { const e = db.efectos || []; db.efectos = []; return e.filter(x => x.push).map(x => x.push.negocio + ' | ' + x.push.titulo + ' | ' + x.push.cuerpo); };
await db.aplicar({ props: { PANEL_CLAVE: 'c', TAREAS_CLAVE: 'tt', RT_SECRETO: 's', VAPID_PUBLICA: 'a', VAPID_PRIVADA: 'b' } });
const hoy = new Date(Date.now() - 6 * 3600000).toISOString().slice(0, 10), dia = n => new Date(Date.now() - 6 * 3600000 + n * 86400000).toISOString().slice(0, 10);
const pt = (await api('panelLogin', { clave: 'c' })).data.token;
const P = (a, d) => srv.atender({ action: a, panel: pt, data: d || {} });
ok('panel: publicidad que cubre hoy', await P('panelGastoGuardar', { tipo: 'publicidad', plataforma: 'TikTok', nombre: 'Prueba embudo', moneda: 'HNL', montoOrig: 300, fecha: dia(-1), desde: dia(-1) }));
const A = (await api('registrar', { negocio: 'Variedades Uno', nombre: 'Ana', giro: 'tienda', whatsapp: '31111111', pin: '1111' })).data.token;
const B = (await api('registrar', { negocio: 'Pulpería Dos', nombre: 'Beto', giro: 'tienda', whatsapp: '32222222', pin: '2222' })).data.token;
const C = (await api('registrar', { negocio: 'Tienda Tres', nombre: 'Caro', giro: 'tienda', whatsapp: '33333333', pin: '3333' })).data.token;
const na = (await api('bootstrap', {}, A)).data.negocioId, nb = (await api('bootstrap', {}, B)).data.negocioId, nc = (await api('bootstrap', {}, C)).data.negocioId;
// A: producto propio y una venta; B: solo entra; C: nunca abre Inicio
const pr = ok('A crea un producto', await api('guardar', { entidad: 'Productos', registro: { nombre: 'Jabón', categoria: 'Limpieza', precio: 30, tipo: 'producto', stock: 10 } }, A));
const prods = (await api('bootstrap', {}, A)).data.productos, jab = prods.find(p => p.nombre === 'Jabón');
ok('A vende', await api('venta', { items: [{ productoId: jab.id, cantidad: 2 }], metodo: 'Efectivo', recibido: 100, clave: 'v1' }, A));
const ia = ok('A abre Inicio', await api('inicio', {}, A)); ok('B abre Inicio', await api('inicio', {}, B));
const L = id => db.T.Licencias.find(l => l.id === id);
igual('pasos guardados de A', L(na).pasos, 'producto,venta');
igual('pasos guardados de B', L(nb).pasos, 'ninguno');
igual('C sin datos', L(nc).pasos, '');
igual('Inicio sin resumen de fin (faltan 7 días)', ia.prueba === undefined, true);
// Lista del Panel
const res = ok('panel: resumen', await P('panelResumen'));
const todas = res.negocios; const fa = todas.find(x => x.id === na), fc = todas.find(x => x.id === nc);
igual('lista: A trae sus pasos', fa && fa.pasos && [fa.pasos.producto, fa.pasos.venta, fa.pasos.negocio], [true, true, false]);
igual('lista: C sin pasos', fc && fc.pasos, null);
// Embudo de la publicidad
const g = ok('panel: gastos', await P('panelGastos')); const c = g.campanas.find(x => x.nombre === 'Prueba embudo');
igual('embudo [registros, productos, vendieron, activaron, sinDatos]', [c.registros, c.productos, c.vendieron, c.activaron, c.sinDatos], [3, 1, 1, 0, 1]);
igual('costo por cliente que vendió', c.costoVendio, 300);
// Fin de prueba: A termina mañana, B en 2 días, C en 5
L(na).vencePrueba = dia(1); L(nb).vencePrueba = dia(2); L(nc).vencePrueba = dia(5);
const ia2 = ok('A abre Inicio en su último día', await api('inicio', {}, A));
igual('resumen para la ventana', ia2.prueba, { ventas: 1, productos: 1, clientes: 0 });
subsT.push({ negocio: na, apagados: '' }, { negocio: nb, apagados: '' }, { negocio: nc, apagados: '' });
ef(); ok('tarea de las 7 a. m.', await srv.atender({ tarea: 'recordatoriosDia', clave: 'tt' }));
const avisos = ef(); avisos.forEach(x => console.log('   ' + x));
igual('A: mañana termina', avisos.some(x => x.startsWith(na) && x.includes('Mañana termina') && x.includes('Ya llevas 1 venta y 1 producto')), true);
igual('B: termina en 2 días', avisos.some(x => x.startsWith(nb) && x.includes('termina en 2 días')), true);
igual('C: sin aviso de prueba', avisos.some(x => x.startsWith(nc) && x.includes('prueba')), false);
// Ficha del Panel actualiza los pasos
ok('A pone logo', await api('guardar', { entidad: 'Config', registro: { logo: 'https://x/archivos/logo.png' } }, A));
ok('panel: ficha de A', await P('panelNegocio', { id: na }));
igual('ficha guardó el logo en pasos', L(na).pasos, 'negocio,producto,venta');
console.log(f ? '\n' + f + ' FALLAS' : '\nTodo bien'); process.exit(f ? 1 : 0);
