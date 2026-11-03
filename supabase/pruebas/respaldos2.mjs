// Pruebas: módulo de Respaldos (resumen, respaldar todos, cuántas copias guardar, restauraciones) y vendedores con enlace propio
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
const pt = (await api('panelLogin', { clave: 'clave123' })).data.token;
const P = (a, d) => srv.atender({ action: a, panel: pt, data: d || {} });
// Vendedores
const v1 = await P('panelVendedorGuardar', { nombre: 'María Reyes', whatsapp: '9988-7766' });
ok(v1.ok && v1.data.codigo === 'v-maria', 'vendedor creado: ' + (v1.data && v1.data.codigo));
const v2 = await P('panelVendedorGuardar', { nombre: 'María López' }); ok(v2.data.codigo === 'v-maria-lopez', 'mismo nombre, otro código: ' + v2.data.codigo);
const v3 = await P('panelVendedorGuardar', { nombre: 'Maximiliano Bartolomé Fernández' }); ok(v3.data.codigo.length <= 20, 'código corto: ' + v3.data.codigo);
ok((await P('panelVendedorGuardar', { nombre: '' })).ok === false, 'pide el nombre');
for (let i = 0; i < 5; i++) await api('visita', { p: 'negocio', o: 'v-maria', d: 'cel', v: 'vendmaria000' + i });
await api('visita', { p: 'negocio', o: 'tiktok', d: 'cel', v: 'otronavega01' });
const negs = [];
for (const [n, w, o] of [['Tienda Luna', '33130265', { o: 'v-maria', v: 'vendmaria0000' }], ['Comedor Mary', '97776655', { o: 'v-maria', v: 'vendmaria0001' }], ['Vet Canitas', '98765432', { o: 'tiktok', v: 'otronavega01' }]]) {
  const t = (await api('registrar', { negocio: n, nombre: 'Dueño', giro: 'catalogo', whatsapp: w, pin: '1234', origen: o })).data.token;
  if (n === 'Tienda Luna') await api('cargarEjemplos', {}, t);
  negs.push((await api('bootstrap', {}, t)).data.negocioId);
}
await P('panelAccion', { id: negs[0], accion: 'activar', monto: 350 });
const vs = (await P('panelVendedores')).data.vendedores, m = vs.find(x => x.codigo === 'v-maria');
ok(m.visitas === 5 && m.personas === 5, `visitas por su enlace: ${m.visitas} de ${m.personas} personas`);
ok(m.registros === 2 && m.compraron === 1 && m.pagado === 350, `trajo ${m.registros} negocios, compró ${m.compraron}, pagaron L ${m.pagado}`);
ok(m.negocios.map(x => x.negocio).sort().join(',') === 'Comedor Mary,Tienda Luna', 'negocios que trajo: ' + m.negocios.map(x => x.negocio + ' (' + x.estado + ')').join(', '));
const res = (await P('panelResumen')).data; ok((res.vendedores || []).length === 3 && res.negocios.find(x => x.id === negs[0]).canal === 'v-maria', 'el resumen trae vendedores y la ficha su canal');
await P('panelVendedorQuitar', { codigo: 'v-maria-lopez' }); ok((await P('panelVendedores')).data.vendedores.length === 2, 'quitar vendedor');
// Módulo de Respaldos
let r = (await P('panelRespaldosResumen')).data; ok(r.negocios.length === 3 && r.copias === 0 && r.negocios.every(n => n.est === 'nuevo'), 'resumen sin respaldos: ' + r.negocios.map(n => n.est).join(','));
await srv.atender({ tarea: 'respaldosDia', clave: 'tk' });
r = (await P('panelRespaldosResumen')).data;
ok(r.ultima && r.ultima.hechos === 3 && r.negocios.every(n => n.est === 'aldia'), 'después de la noche: ' + JSON.stringify(r.ultima));
ok(r.copias === 3 && r.kb > 0, `copias ${r.copias} · ${r.kb} KB`);
const t1 = await P('panelRespaldarTodos'); ok(t1.ok && t1.data.hechos === 0, 'respaldar todos se salta los recientes (' + t1.data.hechos + ')');
ok((await P('panelRespaldoConfig', { diario: 0, semanal: 4, manual: 2, antes: 4 })).ok === false, 'no deja 0 copias');
const cf = await P('panelRespaldoConfig', { diario: 7, semanal: 4, manual: 2, antes: 4 }); ok(cf.ok, 'cuántas copias guardar');
for (let i = 0; i < 4; i++) await P('panelRespaldoHacer', { id: negs[0] });
const l = (await P('panelRespaldos', { id: negs[0] })).data; ok(l.filter(x => x.tipo === 'manual').length === 2, 'respeta 2 manuales: ' + l.filter(x => x.tipo === 'manual').length);
const rs = await P('panelRespaldoRestaurar', { id: negs[0], rid: l.find(x => x.tipo === 'diario').id, alcance: 'productos' }); ok(rs.ok, 'restaurar');
r = (await P('panelRespaldosResumen')).data; ok(r.restauraciones.length === 1 && r.restauraciones[0].negocio === 'Tienda Luna' && r.restauraciones[0].alc === 'productos', 'última restauración anotada: ' + JSON.stringify(r.restauraciones[0]));
ok(r.guarda.manual === 2, 'el resumen trae la configuración');
ok((await srv.atender({ action: 'panelRespaldosResumen', panel: 'x', data: {} })).error === 'PANEL', 'pide sesión del panel');
console.log(fallas ? '\n✗ ' + fallas + ' fallas' : '\n✓ todo bien');
