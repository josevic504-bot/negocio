// Pruebas: el cliente borra sus datos (movimientos o todo) o elimina su cuenta; copia previa, aviso al Panel, recuperar y purga a los 30 días
import fs from 'node:fs'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
const SRC = fs.readFileSync(process.argv[2], 'utf8');
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
const subsT = [{ endpoint: 'https://push.example/x', negocio: '_panel', usuario: '', p256dh: 'k', auth: 'a', apagados: '' }];
db.push = async q => { if (q.lista) return subsT.map(x => ({ negocio: x.negocio, apagados: x.apagados })); return true; };
const srv = crearServidor(SRC, db, { sha256: b => createHash('sha256').update(b).digest(), log: () => {}, urlArchivo: r => 'http://x/__f/' + r, rutaDeUrl: u => (u.split('/__f/')[1] || null) });
const api = (action, data, token, extra) => srv.atender(Object.assign({ action, token, data: data || {} }, extra || {}));
let fallas = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fallas++; };
await db.aplicar({ props: { PANEL_CLAVE: 'clave123', TAREAS_CLAVE: 'tk', RT_SECRETO: 'rt', VAPID_PUBLICA: 'p', VAPID_PRIVADA: 'q' } });
const reg = async (n, w) => { const t = (await api('registrar', { negocio: n, nombre: 'Dueña', giro: 'catalogo', whatsapp: w, pin: '1234' })).data.token; await api('cargarEjemplos', {}, t); return { t, id: (await api('bootstrap', {}, t)).data.negocioId }; };
const A = await reg('Norey Beauty', '33130265'), B = await reg('Comedor Mary', '97776655');
const pt = (await api('panelLogin', { clave: 'clave123' })).data.token;
const P = (a, d) => srv.atender({ action: a, panel: pt, data: d || {} });
const cuenta = (t, neg) => (db.T[t] || []).filter(x => x.negocio_id === neg).length;
// venta para tener movimientos
const b0 = (await api('bootstrap', {}, A.t)).data;
const v = await api('venta', { items: [{ productoId: b0.productos.find(p => Number(p.stock) > 0).id, cantidad: 1, precio: 100 }], metodo: 'Efectivo', recibido: 100 }, A.t); ok(v.ok, 'venta de prueba: ' + (v.ok ? 'ok' : v.error));
const prodA = cuenta('Productos', A.id); ok(prodA > 0 && cuenta('Ventas', A.id) === 1, `antes: ${prodA} productos, 1 venta`);
// misDatos
const md = await api('misDatos', {}, A.t); ok(md.ok && md.data.Productos && md.data.Ventas && !md.data.Usuarios, 'misDatos trae las tablas sin usuarios: ' + Object.keys(md.data || {}).join(','));
// borrarDatos: validaciones
ok((await api('borrarDatos', { alcance: 'movimientos', confirmar: 'otro', pin: '1234' }, A.t)).error.indexOf('nombre') >= 0, 'pide el nombre correcto');
ok((await api('borrarDatos', { alcance: 'movimientos', confirmar: 'Norey Beauty', pin: '0000' }, A.t)).error.indexOf('PIN') >= 0, 'pide el PIN correcto');
ok(cuenta('Respaldos', A.id) === 1, 'ya se guardó una copia previa aunque fallara la validación (' + cuenta('Respaldos', A.id) + ')');
const bd = await api('borrarDatos', { alcance: 'movimientos', confirmar: 'norey beauty', pin: '1234' }, A.t);
ok(bd.ok && cuenta('Ventas', A.id) === 0 && cuenta('VentaDetalle', A.id) === 0 && cuenta('Inventario', A.id) === 0, 'borrar movimientos: ventas e inventario en 0');
ok(cuenta('Productos', A.id) === prodA && cuenta('Usuarios', A.id) >= 1 && cuenta('Config', A.id) > 0, 'se conservan productos, usuarios y configuración');
ok(db.T.Seguimiento.some(x => x.negocioId === A.id && x.tipo === 'cliente'), 'queda anotado en el historial');
ok((db.efectos || []).some(e => e.push && e.push.negocio === '_panel' && e.push.tipo === 'cuentas'), 'Vic recibe aviso al teléfono');
const bt = await api('borrarDatos', { alcance: 'todo', confirmar: 'Norey Beauty', pin: '1234' }, A.t);
ok(bt.ok && cuenta('Productos', A.id) === 0 && cuenta('Clientes', A.id) === 0, 'borrar todo: productos y clientes en 0');
ok((await api('bootstrap', {}, A.t)).ok, 'la dueña sigue entrando');
// Restaurar desde el Panel con la copia previa
const rl = (await P('panelRespaldos', { id: A.id })).data; ok(rl.length >= 1 && rl.every(x => x.tipo === 'antes'), 'copias previas en el Panel: ' + rl.map(x => x.tipo + ' ' + x.resumen.productos).join(', '));
const rs = await P('panelRespaldoRestaurar', { id: A.id, rid: rl[rl.length - 1].id, alcance: 'todo' }); ok(rs.ok && cuenta('Productos', A.id) === prodA, 'Vic recupera todo desde la copia (' + cuenta('Productos', A.id) + ' productos)');
// eliminarCuenta
ok((await api('eliminarCuenta', { confirmar: 'borrar', pin: '1234' }, B.t)).error.indexOf('ELIMINAR') >= 0, 'pide escribir ELIMINAR');
const ec = await api('eliminarCuenta', { confirmar: 'eliminar', pin: '1234', motivo: 'Cerré el negocio' }, B.t); ok(ec.ok && ec.data.hasta > '2026-11-30', 'cuenta eliminada, se guarda hasta ' + (ec.data && ec.data.hasta));
const bb = await api('bootstrap', {}, B.t); ok(!bb.ok && /eliminada/.test(bb.error), 'sus usuarios ya no entran: ' + String(bb.error).slice(0, 40));
const lg = await api('login', { whatsapp: '97776655', pin: '1234' }); ok(!lg.ok, 'ni con el WhatsApp: ' + lg.error);
const re = await api('registrar', { negocio: 'Mary 2', nombre: 'Mary', giro: 'comida', whatsapp: '97776655', pin: '1234' }); ok(re.ok, 'su WhatsApp queda libre para registrarse de nuevo');
let res = (await P('panelResumen')).data;
ok(res.eliminadas.length === 1 && res.eliminadas[0].motivo === 'Cerré el negocio' && res.eliminadas[0].borraEl === '2026-12-03' && res.negocios.every(n => n.id !== B.id), 'el Panel la ve en eliminadas: ' + JSON.stringify(res.eliminadas[0].borraEl));
ok(res.avisosCli.length >= 3, 'avisos del cliente en pendientes: ' + res.avisosCli.length);
const fi = (await P('panelNegocio', { id: B.id })).data; ok(fi.estado === 'eliminada' && fi.eliminada && !fi.eliminada.purgado, 'ficha: ' + JSON.stringify(fi.eliminada));
// Recuperar
const rc = await P('panelAccion', { id: B.id, accion: 'recuperar' }); ok(rc.ok && rc.data.estado === 'prueba', 'Vic recupera la cuenta: ' + (rc.ok ? rc.data.estado : rc.error));
const lg2 = await api('login', { whatsapp: '97776655', pin: '1234', negocioId: B.id }); ok(lg2.ok && lg2.data.token, 'la dueña vuelve a entrar' + (lg2.ok ? '' : ': ' + lg2.error));
// Purga a los 30 días
await api('eliminarCuenta', { confirmar: 'ELIMINAR', pin: '1234' }, lg2.data.token);
const lic = db.T.Licencias.find(x => x.id === B.id); ok(lic && lic.estado === 'Eliminada', 'eliminada otra vez');
await srv.atender({ tarea: 'respaldosDia', clave: 'tk' }); ok(cuenta('Productos', B.id) > 0 && lic.purgado !== 'si', 'antes de 30 días no se borra nada');
lic.eliminadoEl = '2026-10-01|Prueba|';
await srv.atender({ tarea: 'respaldosDia', clave: 'tk' });
ok(lic.purgado === 'si' && cuenta('Productos', B.id) === 0 && cuenta('Respaldos', B.id) === 0 && !db.T.Accesos.some(a => a.negocioId === B.id), 'a los 30 días se borran datos, respaldos y accesos');
ok((await P('panelAccion', { id: B.id, accion: 'recuperar' })).ok === false, 'ya no se puede recuperar');
console.log(fallas ? '\n✗ ' + fallas + ' fallas' : '\n✓ todo bien');
