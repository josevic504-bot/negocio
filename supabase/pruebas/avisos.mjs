// Avisos con la app cerrada, canal de cambios y resumen de la mañana (servidor simulado)
import { api, db, srv, logs } from './prueba.mjs';
const ok = (n, r) => { console.log((r.ok ? '✓ ' : '✗ ') + n + (r.ok ? '' : ': ' + r.error)); return r.data; };
const subsT = []; // tabla PushSubs simulada
db.push = async q => {
  if (q.lista) return subsT.map(s => ({ negocio: s.negocio, apagados: s.apagados }));
  if (q.guardar) { const i = subsT.findIndex(s => s.endpoint === q.guardar.endpoint && s.negocio === q.guardar.negocio); if (i >= 0) subsT[i] = q.guardar; else subsT.push(q.guardar); return true; }
  if (q.quitar) { const i = subsT.findIndex(s => s.endpoint === q.quitar.endpoint && s.negocio === q.quitar.negocio); if (i >= 0) subsT.splice(i, 1); return true; }
};
await db.aplicar({ props: { PANEL_CLAVE: 'clave123', TAREAS_CLAVE: 'tt', VAPID_PUBLICA: 'PUB', VAPID_PRIVADA: 'PRIV', RT_SECRETO: 'secreto' } });
const sub = (n) => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc' + n, keys: { p256dh: 'BPk' + 'x'.repeat(60), auth: 'auth1234abcd' } });
const efectos = () => { const e = db.efectos || []; db.efectos = []; return e; };

const reg = await api('registrar', { negocio: 'Tienda Avisos', nombre: 'Vic', giro: 'tienda', whatsapp: '33130265', pin: '1234' });
const tok = reg.data.token;
const pl = ok('panel: entrar', await srv.atender({ action: 'panelLogin', data: { clave: 'clave123' } })); const pt = pl.token;
ok('panel: activar avisos', await srv.atender({ action: 'pushGuardar', panel: pt, data: { sub: sub(0) } }));
efectos();
// Registro nuevo → aviso al Panel
await api('registrar', { negocio: 'Pulpería Nueva', nombre: 'Ana', giro: 'tienda', whatsapp: '31112222', pin: '1111', origen: { o: 'tiktok', v: 'x1' } });
console.log('   aviso registro:', JSON.stringify(efectos().filter(e => e.push).map(e => e.push)));

const b = ok('arranque trae canal', await api('bootstrap', { app: '1.9.26' }, tok)); console.log('   canal:', b.rt);
const neg = b.negocioId;
ok('negocio: activar avisos (sin resumen)', await api('pushGuardar', { sub: sub(1), apagados: ['citas'] }, tok));
{ const r = await api('pushGuardar', { sub: sub(1) }, 'tokenfalso'); console.log(r.ok ? '✗ sesión falsa aceptada' : '✓ sesión falsa rechazada (' + r.error + ')'); }
console.log('   en tabla:', subsT.map(s => s.negocio + ' ' + s.apagados).join(' | '));
// Producto + pedido de la tienda en línea
const pr = ok('producto', await api('guardar', { entidad: 'Productos', registro: { nombre: 'Café molido', precio: 95, costo: 60, stock: 10, tipo: 'producto', activo: true, tienda: true } }, tok, { dev: 'tel1' }));
console.log('   cambio al instante:', JSON.stringify(efectos().filter(e => e.rt).map(e => e.rt)));
await db.aplicar({ ops: [{ t: 'Config', n: neg, op: 'upd', k: { clave: 'tienda' }, row: { valor: 'si' } }], v: {} }).catch(() => {});
const pd = await api('pedir', { negocio: neg, nombre: 'Carlos López', telefono: '98765432', entrega: 'tienda', items: [{ id: pr.id, cantidad: 3 }], clave: 'p1' });
console.log(pd.ok ? '✓ pedido de la tienda' : '✗ pedido: ' + pd.error);
let ef = efectos(); console.log('   aviso pedido:', JSON.stringify(ef.filter(e => e.push).map(e => e.push)), '· canal:', JSON.stringify(ef.filter(e => e.rt).map(e => e.rt.t)));
await api('chatEnviar', { negocio: neg, nombre: 'Carlos', telefono: '98765432', texto: '¿A qué hora cierran?', clave: 'cli-1' });
ef = efectos(); console.log('   aviso mensaje:', JSON.stringify(ef.filter(e => e.push).map(e => e.push)));
// Soporte ida y vuelta
await api('soporteCrear', { motivo: 'error', modulo: 'Ventas', texto: 'No me imprime', foto: '', version: '1.9.26' }, tok);
ef = efectos(); console.log('   aviso soporte → panel:', JSON.stringify(ef.filter(e => e.push).map(e => e.push)));
const sop = (await srv.atender({ action: 'panelSoporte', panel: pt, data: {} })).data;
const rr = await srv.atender({ action: 'panelSoporteResponder', panel: pt, data: { id: sop[0].id, texto: 'Ya lo revisamos, prueba de nuevo' } });
console.log(rr.ok ? '✓ panel responde' : '✗ ' + rr.error);
ef = efectos(); console.log('   aviso respuesta → negocio:', JSON.stringify(ef.filter(e => e.push).map(e => e.push)));
// Fiado para el resumen
const cl = ok('cliente', await api('guardar', { entidad: 'Clientes', registro: { nombre: 'Doña Marta', telefono: '99887766' } }, tok));
const v = await api('venta', { items: [{ productoId: pr.id, cantidad: 2, precio: 95 }], metodo: 'Crédito', credito: true, clienteId: cl.id, recibido: 0, clave: 'v1' }, tok);
console.log(v.ok ? '✓ venta al crédito' : '✗ venta: ' + v.error);
efectos();
// Resumen de las 7 a. m.
let t = await srv.atender({ tarea: 'recordatoriosDia', clave: 'tt' }); console.log('resumen (con «resumen» encendido):', JSON.stringify(t), JSON.stringify(efectos().filter(e => e.push).map(e => e.push)));
await api('pushGuardar', { sub: sub(1), apagados: ['resumen'] }, tok);
t = await srv.atender({ tarea: 'recordatoriosDia', clave: 'tt' }); console.log('resumen (apagado):', JSON.stringify(t));
t = await srv.atender({ tarea: 'recordatoriosDia', clave: 'mala' }); console.log('clave mala:', JSON.stringify(t));
ok('quitar avisos', await api('pushQuitar', { endpoint: sub(1).endpoint }, tok)); console.log('   en tabla:', subsT.map(s => s.negocio).join(' | '));
console.log(logs.filter(l => /recordatorio|Efecto|avisos/.test(l)).join('\n'));
