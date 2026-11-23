// Pruebas: regla de inactividad — prueba vencida y más de 30 días sin entrar → «Eliminada» (30 días para recuperar, luego purga)
import fs from 'node:fs'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const SRC = fs.readFileSync(process.argv[2], 'utf8');
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
db.push = async q => (q.lista ? [] : true);
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), log: () => {}, urlArchivo: r => 'http://x/__f/' + r, rutaDeUrl: u => (u.split('/__f/')[1] || null) });
const api = (action, data, token, extra) => srv.atender(Object.assign({ action, token, data: data || {} }, extra || {}));
let fallas = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fallas++; };
await db.aplicar({ props: { PANEL_CLAVE: 'clave123', TAREAS_CLAVE: 'tk', RT_SECRETO: 'rt', VAPID_PUBLICA: 'p', VAPID_PRIVADA: 'q' } });
const reg = async (n, w) => { const r = await api('registrar', { ciudad: 'San Pedro Sula', negocio: n, nombre: 'Dueño', giro: 'variedades', whatsapp: w, pin: '1234' }); await api('cargarEjemplos', {}, r.data.token); return { t: r.data.token, id: (await api('bootstrap', {}, r.data.token)).data.config.negocioId || db.T.Licencias.find(l => l.negocio === n).id }; };
const hace = d => { const x = new Date(Date.now() - 6 * 3600000 - d * 86400000).toISOString(); return x.slice(0, 10) + ' ' + x.slice(11, 16); };
const lic = id => db.T.Licencias.find(x => x.id === id);
const tarea = () => srv.atender({ tarea: 'respaldosDia', clave: 'tk' });
const cuenta = (t, neg) => (db.T[t] || []).filter(x => x.negocio_id === neg).length;

const A = await reg('Vencida Vieja', '33110001');   // prueba vencida, 40 días sin entrar → se elimina
const B = await reg('Vencida Reciente', '33110002'); // prueba vencida, 20 días sin entrar → se queda
const C = await reg('Activa Vieja', '33110003');    // licencia activa, 40 días sin entrar → se queda
const D = await reg('Justo 30', '33110004');        // prueba vencida, exactamente 30 días → se queda
const E = await reg('Prueba Extendida', '33110005'); // prueba que vence en el futuro, 40 días sin entrar → se queda
const F = await reg('Pausada', '33110006');         // pausada, 40 días → se queda
const G = await reg('Grupo', '33110007');           // vencida, 40 días, pero agrupada con otro negocio → se queda
const pt = (await api('panelLogin', { clave: 'clave123' })).data.token;
const P = (a, d) => srv.atender({ action: a, panel: pt, data: d || {} });
const kAntes = (await P('panelResumen')).data.kpis;
const set = (x, o) => Object.assign(lic(x.id), o);
set(A, { estado: 'Vencida', vencePrueba: hace(47).slice(0, 10), ultimaConexion: hace(40) });
set(B, { estado: 'Vencida', vencePrueba: hace(25).slice(0, 10), ultimaConexion: hace(20) });
set(C, { estado: 'Activa', ultimaConexion: hace(40) });
set(D, { estado: 'Vencida', vencePrueba: hace(37).slice(0, 10), ultimaConexion: hace(30) });
set(E, { estado: 'Prueba', vencePrueba: hace(-3).slice(0, 10), ultimaConexion: hace(40) });
set(F, { estado: 'Bloqueada', vencePrueba: hace(47).slice(0, 10), ultimaConexion: hace(40) });
set(G, { estado: 'Prueba', vencePrueba: hace(47).slice(0, 10), ultimaConexion: hace(40) }); // estado guardado atrasado: igual cuenta como vencida…
const H = await reg('Hermano de G', '33110008'); set(H, { persona: G.id }); // …pero G tiene otro negocio de la misma persona
const kBase = (await P('panelResumen')).data.kpis;

await tarea();
ok(lic(A.id).estado === 'Eliminada' && /\|inactividad$/.test(lic(A.id).eliminadoEl) && lic(A.id).eliminadoEl.split('|')[1] === 'Vencida', 'A (vencida, 40 días) queda eliminada: ' + lic(A.id).eliminadoEl);
ok(['B', 'C', 'D', 'E', 'F', 'G', 'H'].every(k => lic(eval(k).id).estado !== 'Eliminada'), 'no se tocan: vencida 20 días, activa, justo 30 días, prueba vigente, pausada ni negocios agrupados');
ok(db.T.Accesos.filter(a => a.negocioId === A.id).every(a => String(a.whatsapp).indexOf('x') === 0), 'los accesos de A se marcan (WhatsApp libre)');
ok(cuenta('Productos', A.id) > 0, 'sus datos siguen ahí (se borran a los 30 días)');
ok(db.T.Seguimiento.some(s => s.negocioId === A.id && /inactividad/.test(s.nota)), 'queda anotado en su historial');
const lg = await api('login', { whatsapp: '33110001', pin: '1234' }); ok(!lg.ok, 'ya no entra con su WhatsApp: ' + lg.error);
let res = (await P('panelResumen')).data;
const ea = res.eliminadas.find(x => x.id === A.id);
ok(ea && ea.inactivo === true && /40 días sin entrar/.test(ea.motivo) && res.negocios.every(n => n.id !== A.id), 'el Panel la muestra en Eliminadas, marcada por inactividad: ' + (ea && ea.motivo));
ok(res.kpis.terminadas === kBase.terminadas && res.kpis.compraron === kBase.compraron, `la conversión no cambia (${kBase.terminadas} → ${res.kpis.terminadas} pruebas terminadas)`);
ok(res.kpis.vencidos === kBase.vencidos - 1, 'sale del conteo de vencidos');
const fi = (await P('panelNegocio', { id: A.id })).data; ok(fi.estado === 'eliminada' && fi.eliminada.inactivo && !fi.eliminada.purgado, 'ficha: ' + JSON.stringify(fi.eliminada));
await tarea(); ok(db.T.Seguimiento.filter(s => s.negocioId === A.id && /inactividad/.test(s.nota)).length === 1, 'la segunda noche no la vuelve a procesar');

// Vuelve a registrarse con el mismo WhatsApp: prueba nueva
const re = await api('registrar', { ciudad: 'San Pedro Sula', negocio: 'Vencida Vieja 2', nombre: 'Dueño', giro: 'variedades', whatsapp: '33110001', pin: '1234' });
ok(re.ok && re.data.token, 'se registra de nuevo con su WhatsApp' + (re.ok ? '' : ': ' + re.error));
const nueva = db.T.Licencias.find(l => l.negocio === 'Vencida Vieja 2'); ok(nueva && nueva.estado === 'Prueba', 'y empieza una prueba nueva');

// Recuperar desde el Panel: vuelve como vencida
const rc = await P('panelAccion', { id: A.id, accion: 'recuperar' }); ok(rc.ok && rc.data.estado === 'vencida', 'Vic la recupera y vuelve como vencida: ' + (rc.ok ? rc.data.estado : rc.error));
ok(db.T.Seguimiento.some(s => s.negocioId === A.id && /por inactividad/.test(s.nota) && /recuperada/i.test(s.nota)), 'el historial dice que se recuperó tras eliminarse por inactividad');
// Se vuelve a eliminar y a los 30 días se purga
set(A, { ultimaConexion: hace(40) }); await tarea(); ok(lic(A.id).estado === 'Eliminada', 'sin entrar, se elimina otra vez');
lic(A.id).eliminadoEl = hace(31).slice(0, 10) + '|Vencida|Prueba vencida y 40 días sin entrar|inactividad';
await tarea();
ok(lic(A.id).purgado === 'si' && cuenta('Productos', A.id) === 0 && !db.T.Accesos.some(a => a.negocioId === A.id), 'a los 30 días se borran sus datos y accesos');
res = (await P('panelResumen')).data;
ok(res.eliminadas.some(x => x.id === A.id && x.purgado), 'el registro de que existió se queda en el Panel');
ok(res.kpis.terminadas === kBase.terminadas, 'después de la purga sigue contando en la conversión (' + res.kpis.terminadas + ')');
console.log(fallas ? '\n✗ ' + fallas + ' fallas' : '\n✓ todo bien');
