// Panel Molina, dólar, soporte, visitas y chat de la tienda en el servidor nuevo (simulado)
import { api, db, srv, logs } from './prueba.mjs';
const ok = (n, r) => { console.log((r.ok ? '✓ ' : '✗ ') + n + (r.ok ? '' : ': ' + r.error)); return r.data; };
const reg = await api('registrar', { negocio: 'Tienda Chat', nombre: 'Vic', giro: 'tienda', whatsapp: '33130265', pin: '1234' });
const tok = reg.data.token, neg = (await api('bootstrap', {}, tok)).data.negocioId;
await db.aplicar({ props: { PANEL_CLAVE: 'clave123' } });
// Tienda en línea: el cliente escribe y el negocio responde
const env = ok('cliente escribe desde la tienda', await api('chatEnviar', { negocio: neg, nombre: 'Carlos', telefono: '98765432', texto: '¿Tienen café molido?', clave: 'cli-1' }));
const chats = ok('negocio ve sus chats', await api('chats', {}, tok)); const ch = (chats.lista || chats)[0];
console.log('   chat:', ch && ch.nombre, '·', ch && ch.ultimoTexto, '· sin leer', ch && ch.sinLeer);
ok('negocio responde', await api('chatResponder', { id: ch.id, texto: 'Sí, a L 95' }, tok));
const ver = ok('cliente ve la respuesta', await api('chatVer', { negocio: neg, clave: 'cli-1' }));
console.log('   mensajes:', (ver.mensajes || []).map(m => m.de + ': ' + m.texto).join(' | '));
// Soporte del cliente hacia Vic
ok('cliente abre soporte', await api('soporteCrear', { motivo: 'error', modulo: 'Ventas', texto: 'No me imprime', foto: '', version: '1.9.23' }, tok));
// Panel Molina
const pl = ok('panel: entrar', await srv.atender({ action: 'panelLogin', data: { clave: 'clave123' } })); const pt = pl.token;
const mala = await srv.atender({ action: 'panelLogin', data: { clave: 'mala' } }); console.log(mala.ok ? '✗ clave mala aceptada' : '✓ panel: clave mala rechazada');
const res = ok('panel: resumen', await srv.atender({ action: 'panelResumen', panel: pt, data: {} }));
console.log('   negocios en el panel:', (res.lista || res.negocios || []).length, '· kpis', JSON.stringify(res.kpis || {}).slice(0, 120));
const tasa = ok('panel: dólar del día', await srv.atender({ action: 'panelTasa', panel: pt, data: { forzar: true } })); console.log('   tasa:', JSON.stringify(tasa));
const sop = ok('panel: soporte', await srv.atender({ action: 'panelSoporte', panel: pt, data: {} })); console.log('   chats de soporte:', JSON.stringify(sop).slice(0, 120));
ok('visita (contador)', await api('visita', { p: 'negocio', o: 'tiktok', v: 'abc123' }));
const vis = ok('panel: visitas', await srv.atender({ action: 'panelVisitas', panel: pt, data: {} })); console.log('   visitas:', JSON.stringify(vis).slice(0, 140));
console.log(logs.filter(l => /carga extra/.test(l)).join('\n')); console.log(logs.filter(l => /panel|chat|visita|soporte/.test(l) && / ms /.test(l)).map(l => l.replace(/ \(leer.*?\)/, '')).join('\n'));
