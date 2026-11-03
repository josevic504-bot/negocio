// Prueba del bloqueo progresivo de intentos (PIN de clientes, conexión y clave del Panel)
import { api, db, logs } from './prueba.mjs';
db.push = q => (q.lista ? [] : true);
const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) process.exitCode = 1; };
const IP = 'a1b2c3d4e5f60718', IP2 = '0000000000000002';
const login = (wa, pin, ip) => api('login', { whatsapp: wa, pin }, undefined, { ip });
const vencer = pref => Object.keys(db.cache).forEach(k => { if (k.indexOf(pref) === 0) db.cache[k].e = Date.now() - 1; });
const pushes = () => (db.efectos || []).filter(e => e.push).map(e => e.push);
const reg = await api('registrar', { negocio: 'Pulpería La Bendición', nombre: 'Vic', giro: 'tienda', whatsapp: '33130265', pin: '1234' });
ok(reg.ok, 'registrar');
const r2 = await api('registrar', { negocio: 'Otro', nombre: 'Ana', giro: 'tienda', whatsapp: '99990000', pin: '5555' }); ok(r2.ok, 'registrar 2');
db.props.VAPID_PUBLICA = 'x'; db.props.VAPID_PRIVADA = 'y';
// 1) 5 fallos → 10 minutos
let r; for (let i = 0; i < 4; i++) r = await login('33130265', '0000', IP);
ok(!r.ok && /incorrectos$/.test(r.error), '4 fallos: solo «incorrectos» (' + r.error + ')');
r = await login('33130265', '0000', IP); ok(!r.ok && /10 minutos/.test(r.error), '5.º fallo: avisa 10 minutos (' + r.error + ')');
r = await login('33130265', '1234', IP); ok(!r.ok && /10 minutos/.test(r.error), 'PIN correcto durante el bloqueo: no entra (' + r.error + ')');
const seg = db.T.Seguimiento.filter(x => x.tipo === 'seguridad');
ok(seg.length === 1 && seg[0].negocioId && /cambia tu PIN/.test(seg[0].nota), 'queda anotado en Seguimiento para el negocio (' + seg.length + ')');
ok(pushes().some(p => p.tipo === 'seguridad' && p.negocio === seg[0].negocioId), 'aviso al teléfono del dueño: ' + JSON.stringify(pushes().filter(p => p.tipo === 'seguridad')[0] || null).slice(0, 160));
// 2) otro WhatsApp desde la misma conexión: normal
r = await login('99990000', '5555', IP); ok(r.ok, 'otro WhatsApp entra normal desde la misma conexión');
// 3) escalera 10 min → 1 h → hasta mañana (se simula que pasó el tiempo)
vencer('BL_'); for (let i = 0; i < 5; i++) r = await login('33130265', '0000', IP);
ok(/1 hora/.test(r.error), '2.ª tanda el mismo día: 1 hora (' + r.error + ')');
vencer('BL_'); for (let i = 0; i < 5; i++) r = await login('33130265', '0000', IP);
ok(/hasta mañana/.test(r.error), '3.ª tanda: hasta mañana (' + r.error + ')');
ok(db.T.Seguimiento.filter(x => x.tipo === 'seguridad').length === 3, 'un aviso por cada bloqueo (3)');
// 4) al vencer el bloqueo y acertar, entra y se limpia el contador
vencer('BL_'); r = await login('33130265', '1234', IP); ok(r.ok, 'vencido el bloqueo, con el PIN correcto entra');
ok(!db.cache['F_50433130265'] || db.cache['F_50433130265'].e < Date.now(), 'contador de fallos limpio tras acertar');
// 5) bloqueo por conexión: 20 fallos con números distintos desde la misma conexión
for (let i = 0; i < 20; i++) r = await login('9999' + String(1000 + i), '1111', IP2);
r = await login('33130265', '1234', IP2); ok(!r.ok && /conexión/.test(r.error), 'conexión bloqueada tras 20 fallos aunque el PIN sea correcto (' + r.error + ')');
r = await login('33130265', '1234', IP); ok(r.ok, 'desde otra conexión entra normal');
r = await login('33130265', '1234'); ok(r.ok, 'sin huella de conexión (Apps Script) sigue funcionando');
// 6) Panel: bloqueo solo para la conexión que falla
db.props.PANEL_CLAVE = 'secreta';
for (let i = 0; i < 5; i++) r = await api('panelLogin', { clave: 'mala' }, undefined, { ip: IP2 });
ok(!r.ok && /10 minutos/.test(r.error), 'Panel: 5 fallos desde una conexión → 10 minutos (' + r.error + ')');
r = await api('panelLogin', { clave: 'secreta' }, undefined, { ip: IP }); ok(r.ok && r.data.token, 'Panel: Vic entra desde su conexión aunque otra esté bloqueada');
r = await api('panelLogin', { clave: 'secreta' }, undefined, { ip: IP2 }); ok(!r.ok, 'Panel: la conexión bloqueada no entra ni con la clave buena');
ok(pushes().some(p => p.negocio === '_panel' && p.tipo === 'seguridad'), 'aviso a Vic: ' + JSON.stringify(pushes().filter(p => p.negocio === '_panel' && p.tipo === 'seguridad')[0] || null).slice(0, 140));
// 7) PIN en acciones (cambiar PIN): 5 fallos → bloqueo
const tok = (await login('33130265', '1234', IP)).data.token;
for (let i = 0; i < 5; i++) r = await api('cambiarClave', { actual: '9999', nueva: '4321' }, tok);
ok(!r.ok && /10 minutos/.test(r.error), 'cambiar PIN: 5 fallos → 10 minutos (' + r.error + ')');
r = await api('cambiarClave', { actual: '1234', nueva: '4321' }, tok); ok(!r.ok, 'cambiar PIN bloqueado aunque el actual sea correcto');
console.log(logs.filter(l => /error|Error/.test(l)).join('\n') || '(sin errores en el log)');
