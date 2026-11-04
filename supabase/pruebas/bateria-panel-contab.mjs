// Batería: Panel Molina (32 acciones) + licencia + Contabilidad, sobre el mismo Codigo.gs con la base falsa
import { api, db, logs } from './prueba.mjs';
db.push = q => (q.lista ? [{ negocio: '_panel', apagados: '' }] : true);
let pasadas = 0, fallidas = 0; const fallos = [];
const ok = (nombre, cond, detalle) => { if (cond) { pasadas++; console.log('✓ ' + nombre); } else { fallidas++; fallos.push(nombre); console.log('✗ ' + nombre + (detalle !== undefined ? ' → ' + (typeof detalle === 'string' ? detalle : JSON.stringify(detalle)).slice(0, 300) : '')); } };
const sec = t => console.log('\n── ' + t + ' ──');
const TZ = 'America/Tegucigalpa';
const fmt = (ms, conHora) => { const p = {}; new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).forEach(x => { p[x.type] = x.value; }); return p.year + '-' + p.month + '-' + p.day + (conHora ? 'T' + p.hour + ':' + p.minute : ''); };
const HOY = fmt(Date.now()), MES = HOY.slice(0, 7), dia = n => fmt(Date.now() + n * 86400000);
const mesAnt = (() => { const y = Number(MES.slice(0, 4)), m = Number(MES.slice(5, 7)) - 2; const d = new Date(y, m, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); })();
const mesAnt2 = (() => { const y = Number(mesAnt.slice(0, 4)), m = Number(mesAnt.slice(5, 7)) - 2; const d = new Date(y, m, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); })();
const lic = id => db.T.Licencias.find(l => l.id === id);
const IPA = 'aaaa000000000001', IPB = 'bbbb000000000002';
const FOTO = 'data:image/png;base64,' + 'A'.repeat(400);

/* ========== Datos ========== */
sec('Preparar negocios');
await db.aplicar({ props: { PANEL_CLAVE: 'clave-vic', TAREAS_CLAVE: 'tt', VAPID_PUBLICA: 'a', VAPID_PRIVADA: 'b' } });
const reg = async (negocio, nombre, giro, wa, pin, extra) => { const r = await api('registrar', Object.assign({ negocio, nombre, giro, whatsapp: wa, pin }, extra || {})); ok('registrar ' + negocio, r.ok, r.error); const tok = r.data.token; const b = await api('bootstrap', {}, tok); return { tok, id: b.data.negocioId, boot: b.data }; };
const A = await reg('Pulpería La Bendición', 'Vic', 'tienda', '33130265', '1234');
const B = await reg('Norey Beauty', 'Noemí', 'catalogo', '31111111', '1111');
const C = await reg('Ferretería El Tornillo', 'Carlos', 'ferreteria', '32222222', '2222');
const D = await reg('Comedor Doña Mary', 'Mary', 'comida', '34444444', '4444');
for (const N of [A, B, C]) { const e = await api('cargarEjemplos', {}, N.tok); ok('cargarEjemplos ' + N.id, e.ok && e.data.agregados > 0, e.error); }
const prodsA = (await api('bootstrap', {}, A.tok)).data.productos;
const pA = prodsA.find(p => p.tipo === 'producto' && p.stock > 2);
const cliA = (await api('guardar', { entidad: 'Clientes', registro: { nombre: 'Doña Marta', telefono: '9999-0000', limite: 5000, activo: true } }, A.tok)).data;
const cidA = (cliA.registro || cliA).id;
let r = await api('venta', { items: [{ productoId: pA.id, cantidad: 2, precio: pA.precio }], metodo: 'Efectivo', recibido: 500, clave: 'A1' }, A.tok); ok('venta contado A', r.ok, r.error);
r = await api('venta', { clienteId: cidA, items: [{ productoId: pA.id, cantidad: 1, precio: pA.precio }], metodo: 'Crédito', recibido: 0, clave: 'A2' }, A.tok); ok('venta crédito A', r.ok, r.error);
const prodsB = (await api('bootstrap', {}, B.tok)).data.productos; const pB = prodsB.find(p => p.tipo === 'producto' && p.stock > 0) || prodsB[0];
r = await api('venta', { items: [{ productoId: pB.id, cantidad: 1, precio: pB.precio }], metodo: 'Efectivo', recibido: 5000, clave: 'B1' }, B.tok); ok('venta B', r.ok, r.error);

/* ========== Licencia (prueba 7 días) ========== */
sec('Licencia: prueba gratis, vencida, tienda vencida');
ok('bootstrap: licencia en prueba con 6–7 días', A.boot.licencia.estado === 'prueba' && A.boot.licencia.diasRestantes >= 6 && A.boot.licencia.diasRestantes <= 7, A.boot.licencia);
ok('en prueba el Plus viene incluido', A.boot.plus === true && A.boot.plusIncluido === true, [A.boot.plus, A.boot.plusIncluido]);
ok('en prueba la contabilidad NO viene', A.boot.contab === false, A.boot.contab);
const venceD = lic(D.id).vencePrueba; lic(D.id).vencePrueba = dia(-2);
r = await api('bootstrap', {}, D.tok); ok('prueba vencida → PRUEBA_VENCIDA', !r.ok && /^PRUEBA_VENCIDA\|/.test(r.error), r.error);
ok('el error trae el nombre y el contacto', !r.ok && /Comedor Doña Mary/.test(r.error) && /contacto/.test(r.error), r.error);
ok('la ficha quedó «Vencida»', String(lic(D.id).estado).toLowerCase() === 'vencida', lic(D.id).estado);
r = await api('login', { whatsapp: '34444444', pin: '4444' }); ok('login con prueba vencida → PRUEBA_VENCIDA', !r.ok && /PRUEBA_VENCIDA/.test(r.error), r.error);
r = await api('tiendaInfo', { negocio: D.id }); ok('tienda del negocio vencido → TIENDA_CERRADA (vencida)', !r.ok && /^TIENDA_CERRADA\|/.test(r.error) && /"vencida":"vencida"/.test(r.error), r.error);
r = await api('visita', { p: 'negocio', o: 'directo', v: 'visitante01' }); ok('las acciones públicas siguen (visita)', r.ok && r.data === true, r.error);

/* ========== Panel: login y bloqueo ========== */
sec('panelLogin');
r = await api('panelLogin', { clave: 'mala' }, undefined, { ip: IPA }); ok('clave mala rechazada', !r.ok && /Clave incorrecta/.test(r.error), r.error);
r = await api('panelLogin', { clave: 'clave-vic' }, undefined, { ip: IPA }); ok('clave buena entra y trae plantillas', r.ok && r.data.token && r.data.plantillas && r.data.plantillas.dia3, r.error);
const pt = r.data.token;
const P = (a, d) => api(a, d, undefined, { panel: pt });
r = await P('panelResumen'); ok('token del panel sirve', r.ok, r.error);
r = await api('panelResumen', {}, undefined, { panel: 'token-falso' }); ok('token falso → PANEL', !r.ok && r.error === 'PANEL', r.error);
r = await api('panelResumen', {}); ok('sin token → PANEL', !r.ok && r.error === 'PANEL', r.error);
let ult; for (let i = 0; i < 4; i++) ult = await api('panelLogin', { clave: 'x' }, undefined, { ip: IPB });
ok('4 fallos: solo «Clave incorrecta»', !ult.ok && ult.error === 'Clave incorrecta', ult.error);
ult = await api('panelLogin', { clave: 'x' }, undefined, { ip: IPB }); ok('5.º fallo → bloqueo 10 minutos', !ult.ok && /10 minutos/.test(ult.error), ult.error);
ult = await api('panelLogin', { clave: 'clave-vic' }, undefined, { ip: IPB }); ok('conexión bloqueada no entra ni con la clave buena', !ult.ok && /Demasiados intentos/.test(ult.error), ult.error);
ult = await api('panelLogin', { clave: 'clave-vic' }, undefined, { ip: IPA }); ok('otra conexión entra normal', ult.ok, ult.error);
ok('el bloqueo queda en Seguimiento (seguridad-panel)', db.T.Seguimiento.some(s => s.tipo === 'seguridad-panel'));
const clavePanel = db.props.PANEL_CLAVE; delete db.props.PANEL_CLAVE;
r = await api('panelLogin', { clave: 'clave-vic' }, undefined, { ip: IPA }); ok('sin PANEL_CLAVE configurada avisa', !r.ok && /Falta la clave del panel/.test(r.error), r.error);
db.props.PANEL_CLAVE = clavePanel;

/* ========== panelResumen ========== */
sec('panelResumen');
r = await P('panelResumen'); const res = r.data;
ok('resumen ok', r.ok, r.error);
ok('kpis: 3 en prueba, 1 vencido', res.kpis.prueba === 3 && res.kpis.vencidos === 1 && res.kpis.activos === 0, res.kpis);
ok('conversión 0 % (1 terminada, 0 compraron)', res.kpis.terminadas === 1 && res.kpis.compraron === 0 && res.kpis.conversion === 0, [res.kpis.terminadas, res.kpis.compraron, res.kpis.conversion]);
ok('4 negocios en la lista', res.negocios.length === 4, res.negocios.length);
ok('orden por última conexión (más reciente primero)', res.negocios.every((x, i, a) => !i || a[i - 1].ultimaConexion >= x.ultimaConexion), res.negocios.map(x => x.ultimaConexion));
ok('registrosSemana 4 · porMes trae el mes actual', res.kpis.registrosSemana === 4 && res.porMes.some(m => m.mes === MES && m.registros === 4), [res.kpis.registrosSemana, res.porMes]);
ok('salud: A (vendió hoy, entró hoy) > D (vencido, sin ventas)', res.negocios.find(x => x.id === A.id).salud.n > res.negocios.find(x => x.id === D.id).salud.n, res.negocios.map(x => x.negocio + ':' + x.salud.n));
ok('ventas7 de A = 2', res.negocios.find(x => x.id === A.id).ventas7 === 2, res.negocios.find(x => x.id === A.id).ventas7);
ok('contactar: el vencido sale como «vencida»', res.contactar.some(x => x.id === D.id && x.contactar === 'vencida'), res.contactar);
ok('trae appVer, hoy, visitas, plantillas, comprobantes', res.appVer && res.hoy === HOY && res.visitas && res.plantillas && Array.isArray(res.comprobantes), Object.keys(res));

/* ========== panelNegocio ========== */
sec('panelNegocio');
r = await P('panelNegocio', { id: A.id }); const fA = r.data;
ok('ficha ok', r.ok, r.error);
ok('ficha: datos básicos', fA.negocio === 'Pulpería La Bendición' && fA.dueno === 'Vic' && fA.whatsapp === '50433130265' && fA.estado === 'prueba' && fA.giroId === 'tienda', [fA.negocio, fA.dueno, fA.whatsapp, fA.estado, fA.giroId]);
ok('ficha: uso (ventas30=2, productos>0, clientes=1, usuarios=1)', fA.uso && fA.uso.ventas30 === 2 && fA.uso.productos > 0 && fA.uso.clientes === 1 && fA.uso.usuarios === 1, fA.uso);
ok('ficha: listas vacías (pagos, contratos, cuotas, soporte) y grupo con él mismo', fA.pagos.length === 0 && fA.contratos.length === 0 && fA.cuotas.length === 0 && fA.soporte.length === 0 && fA.grupo.length === 1 && fA.grupo[0].yo, [fA.pagos.length, fA.grupo]);
ok('ficha: girosTodos y llego', Array.isArray(fA.girosTodos) && fA.girosTodos.length > 10 && fA.llego && 'directo' in fA.llego, fA.llego);
r = await P('panelNegocio', { id: 'NNOEXISTE' }); ok('negocio inexistente → error', !r.ok && /no existe/.test(r.error), r.error);

/* ========== panelVerApp (modo soporte) ========== */
sec('panelVerApp · modo soporte');
r = await P('panelVerApp', { id: A.id }); ok('panel entra a ver la app', r.ok && r.data.token && r.data.negocio === 'Pulpería La Bendición', r.error);
const ver = r.data.token;
r = await api('bootstrap', { inicio: true }, ver); ok('soporte: bootstrap marca soporte y ve productos', r.ok && r.data.soporte && r.data.soporte.negocio === 'Pulpería La Bendición' && r.data.productos.length === prodsA.length, r.error);
r = await api('ventas', { desde: dia(-30), hasta: HOY }, ver); ok('soporte: puede leer ventas', r.ok, r.error);
r = await api('reporte', { desde: dia(-30), hasta: HOY }, ver); ok('soporte: puede leer reporte', r.ok, r.error);
r = await api('caja', {}, ver); ok('soporte: puede leer caja', r.ok, r.error);
const MSJ = /^Modo soporte: aquí solo puedes ver/;
r = await api('guardar', { entidad: 'Productos', registro: { nombre: 'Hack', categoria: 'X', precio: 1 } }, ver); ok('soporte: guardar producto → «Modo soporte»', !r.ok && MSJ.test(r.error), r.error);
r = await api('venta', { items: [{ productoId: pA.id, cantidad: 1, precio: pA.precio }], metodo: 'Efectivo', recibido: 100, clave: 'S1' }, ver); ok('soporte: venta → «Modo soporte»', !r.ok && MSJ.test(r.error), r.error);
r = await api('abono', { clienteId: cidA, monto: 10, metodo: 'Efectivo' }, ver); ok('soporte: abono → «Modo soporte»', !r.ok && MSJ.test(r.error), r.error);
r = await api('guardar', { entidad: 'Config', registro: { nombre: 'Hack' } }, ver); ok('soporte: ajustes → «Modo soporte»', !r.ok && MSJ.test(r.error), r.error);
r = await api('eliminar', { entidad: 'Clientes', id: cidA }, ver); ok('soporte: eliminar → «Modo soporte»', !r.ok && MSJ.test(r.error), r.error);
r = await api('guardarGasto', { registro: { categoria: 'Servicios', detalle: 'Luz', monto: 10, metodo: 'Efectivo' } }, ver); ok('soporte: gasto → «Modo soporte»', !r.ok && MSJ.test(r.error), r.error);
r = await api('cambiarClave', { actual: '1234', nueva: '9999' }, ver); ok('soporte: cambiar PIN → «Modo soporte»', !r.ok && MSJ.test(r.error), r.error);
r = await api('cargarEjemplos', {}, ver); ok('soporte: cargarEjemplos → «Modo soporte»', !r.ok && MSJ.test(r.error), r.error);
r = await api('borrarDatos', { confirmar: 'BORRAR', pin: '1234', alcance: 'todo' }, ver); ok('soporte: borrarDatos → «Modo soporte»', !r.ok && MSJ.test(r.error), r.error);
r = await api('eliminarCuenta', { confirmar: 'ELIMINAR', pin: '1234' }, ver); ok('soporte: eliminarCuenta → «Modo soporte»', !r.ok && MSJ.test(r.error), r.error);
r = await api('bootstrap', {}, A.tok); ok('el dueño sigue intacto (mismos productos y clientes)', r.ok && r.data.productos.length === prodsA.length && r.data.clientes.length === 1, r.error);
r = await P('panelNegocio', { id: A.id }); ok('queda anotado en Seguimiento «Vic entró a ver la app»', r.ok && r.data.seguimiento.some(s => /entró a ver la app/.test(s.nota)), r.data && r.data.seguimiento);
r = await P('panelVerApp', { id: D.id }); ok('panelVerApp de un negocio vencido da token', r.ok && r.data.token, r.error);
r = await api('bootstrap', {}, r.data.token); console.log('   · soporte en negocio vencido: ' + (r.ok ? 'entra' : r.error.slice(0, 60)));

/* ========== Anuncios ========== */
sec('panelAnunciar · panelAnuncios · panelAnuncioQuitar · anuncioVisto');
r = await P('panelAnunciar', { texto: 'Hola', titulo: 'T', filtro: 'todos' }); ok('sin canal → error', !r.ok && /Elige cómo enviarlo/.test(r.error), r.error);
r = await P('panelAnunciar', { texto: 'Hi', filtro: 'todos', banner: true }); ok('texto muy corto → error', !r.ok && /Escribe el mensaje/.test(r.error), r.error);
r = await P('panelAnunciar', { texto: 'x', filtro: 'giro:streaming', banner: true }); ok('filtro sin negocios → error', !r.ok, r.error);
r = await P('panelAnunciar', { texto: 'Nueva función: comprobantes', titulo: 'Novedad', filtro: 'giro:catalogo', banner: true, dias: 7 }); ok('anuncio solo a Beauty & Moda', r.ok && r.data[0].enviados === 1 && r.data[0].activo, r.error || r.data);
const anId = r.data[0].id;
let bA = (await api('bootstrap', {}, A.tok)).data, bB = (await api('bootstrap', {}, B.tok)).data;
ok('Norey lo ve en bootstrap, La Bendición no', !!bB.anuncio && bB.anuncio.id === anId && !bA.anuncio, [bA.anuncio, bB.anuncio]);
r = await api('anuncioVisto', { id: anId }, B.tok); ok('anuncioVisto', r.ok, r.error);
ok('ya no sale', !(await api('bootstrap', {}, B.tok)).data.anuncio);
r = await P('panelAnuncios'); ok('panelAnuncios: 1 enviado, 1 visto', r.ok && r.data[0].id === anId && r.data[0].vistos === 1, r.data);
r = await P('panelAnunciar', { texto: 'Mantenimiento hoy 10 pm', filtro: 'ids', ids: [A.id, C.id], banner: true, dias: 99 }); ok('anuncio por ids (2) · días se acota a 30', r.ok && r.data[0].enviados === 2 && r.data[0].vence === dia(30), r.data && r.data[0]);
const an2 = r.data[0].id;
ok('A lo ve, B no', !!(await api('bootstrap', {}, A.tok)).data.anuncio && !(await api('bootstrap', {}, B.tok)).data.anuncio);
r = await P('panelAnunciar', { texto: 'Solo a los que están en prueba', filtro: 'prueba', banner: true, push: true }); ok('filtro prueba → 3 negocios (el vencido no)', r.ok && r.data[0].enviados === 3 && r.data[0].canales === 'push,banner', r.data && r.data[0]);
const an3 = r.data[0].id;
r = await P('panelAnuncioQuitar', { id: an2 }); ok('quitar anuncio → queda inactivo', r.ok && r.data.find(x => x.id === an2).activo === false, r.error);
bA = (await api('bootstrap', {}, A.tok)).data; ok('A ya no ve el quitado; ve el de prueba', bA.anuncio && bA.anuncio.id === an3, bA.anuncio);
r = await P('panelAnuncioQuitar', { id: 'ANX' }); ok('quitar inexistente → error', !r.ok, r.error);
r = await P('panelAnuncioQuitar', { id: an3 });

/* ========== panelAccion ========== */
sec('panelAccion');
r = await P('panelAccion', { id: B.id, accion: 'activar', monto: 1500, concepto: 'Licencia', metodo: 'Transferencia' }); ok('activar licencia', r.ok && r.data.estado === 'activa' && r.data.pagos.length === 1 && Number(r.data.pagos[0].monto) === 1500 && r.data.pagos[0].metodo === 'Transferencia', r.error || [r.data.estado, r.data.pagos]);
bB = (await api('bootstrap', {}, B.tok)).data; ok('el negocio ve licencia completa; Plus ya no incluido', bB.licencia.estado === 'completa' && bB.plus === false && bB.plusIncluido === false, [bB.licencia, bB.plus]);
r = await P('panelAccion', { id: B.id, accion: 'plus', monto: 500 }); ok('activar Plus', r.ok && r.data.plus === true && r.data.pagos.length === 2, r.error);
ok('el negocio ve Plus', (await api('bootstrap', {}, B.tok)).data.plus === true);
r = await P('panelAccion', { id: B.id, accion: 'quitarPlus' }); ok('quitar Plus', r.ok && r.data.plus === false, r.error);
ok('el negocio ya no tiene Plus', (await api('bootstrap', {}, B.tok)).data.plus === false);
r = await P('panelAccion', { id: C.id, accion: 'contab', monto: 800 }); ok('activar Contabilidad (C)', r.ok && r.data.contab === true, r.error);
ok('C ve contab en bootstrap', (await api('bootstrap', {}, C.tok)).data.contab === true);
r = await P('panelAccion', { id: B.id, accion: 'contab' }); ok('activar Contabilidad (B) sin monto: no anota pago', r.ok && r.data.contab === true && r.data.pagos.length === 2, r.error);
r = await P('panelAccion', { id: B.id, accion: 'quitarContab' }); ok('quitar Contabilidad (B)', r.ok && r.data.contab === false, r.error);
// pausar / reanudar: vuelve al estado exacto
r = await P('panelAccion', { id: B.id, accion: 'pausar', nota: 'no ha pagado' }); ok('pausar (activa)', r.ok && r.data.estado === 'bloqueada', r.error);
r = await api('bootstrap', {}, B.tok); ok('pausado → PRUEBA_VENCIDA tipo bloqueada', !r.ok && /PRUEBA_VENCIDA/.test(r.error) && /"tipo":"bloqueada"/.test(r.error), r.error);
r = await api('tiendaInfo', { negocio: B.id }); ok('tienda pausada → TIENDA_CERRADA', !r.ok && /TIENDA_CERRADA/.test(r.error), r.error);
r = await P('panelAccion', { id: B.id, accion: 'reanudar' }); ok('reanudar → vuelve a «activa»', r.ok && r.data.estado === 'activa' && lic(B.id).estado === 'Activa', r.error || [r.data.estado, lic(B.id).estado]);
ok('el negocio vuelve a entrar', (await api('bootstrap', {}, B.tok)).ok);
r = await P('panelAccion', { id: A.id, accion: 'pausar' }); ok('pausar (prueba)', r.ok && r.data.estado === 'bloqueada', r.error);
r = await P('panelAccion', { id: A.id, accion: 'reanudar' }); ok('reanudar → vuelve a «prueba»', r.ok && r.data.estado === 'prueba' && lic(A.id).estado === 'Prueba', r.error || [r.data.estado, lic(A.id).estado]);
r = await P('panelAccion', { id: D.id, accion: 'pausar' }); ok('pausar (vencida)', r.ok && r.data.estado === 'bloqueada', r.error);
r = await P('panelAccion', { id: D.id, accion: 'reanudar' }); ok('reanudar → vuelve a «vencida»', r.ok && r.data.estado === 'vencida', r.error || r.data.estado);
// pausar/reanudar una VENCIDA que tiene pagos anotados
r = await P('panelPago', { id: D.id, monto: 100, concepto: 'Anticipo' });
r = await P('panelAccion', { id: D.id, accion: 'pausar' }); ok('pausar (vencida con pago anotado) anota «estaba Vencida»', r.ok && r.data.seguimiento[0].nota.indexOf('estaba Vencida') >= 0, r.data && r.data.seguimiento[0]);
r = await P('panelAccion', { id: D.id, accion: 'reanudar' }); ok('reanudar → debe volver a «vencida» (no «activa»)', r.ok && r.data.estado === 'vencida', r.error || ('estado=' + r.data.estado + ' lic=' + lic(D.id).estado));
if (r.ok && r.data.estado !== 'vencida') { lic(D.id).estado = 'Vencida'; }
// extender
r = await P('panelAccion', { id: D.id, accion: 'extender', dias: 10 }); ok('extender prueba 10 días al vencido', r.ok && r.data.estado === 'prueba' && r.data.vencePrueba === dia(10), r.error || [r.data.estado, r.data.vencePrueba]);
ok('D vuelve a entrar', (await api('bootstrap', {}, D.tok)).ok);
// colaborador
r = await P('panelAccion', { id: D.id, accion: 'colaborador', nota: 'demo' }); ok('colaborador: todo activo', r.ok && r.data.colab && r.data.estado === 'colaborador' && r.data.plus && r.data.contab && r.data.cobro === null, r.error);
let bD = (await api('bootstrap', {}, D.tok)).data; ok('colaborador ve licencia completa, Plus y contab', bD.licencia.estado === 'completa' && bD.plus && bD.contab, [bD.licencia, bD.plus, bD.contab]);
r = await P('panelResumen'); ok('colaborador no cuenta en los KPIs', r.data.colaboradores === 1 && r.data.kpis.prueba === 2, [r.data.colaboradores, r.data.kpis]);
r = await P('panelAccion', { id: D.id, accion: 'quitarColab' }); ok('quitar colaborador → prueba (fecha futura)', r.ok && r.data.estado === 'prueba', r.error || r.data.estado);
// giros extra
r = await P('panelAccion', { id: A.id, accion: 'giros', giros: ['comida'] }); ok('giros extra en prueba → rechazado', !r.ok && /solo se permite un giro/.test(r.error), r.error);
r = await P('panelAccion', { id: B.id, accion: 'giros', giros: ['belleza', 'catalogo', 'belleza'], monto: 300 }); ok('giros extra en activa: belleza (el principal no cuenta, sin repetir)', r.ok && JSON.stringify(r.data.giros) === '["belleza"]' && r.data.pagos.length === 3 && /Giro extra/.test(r.data.pagos[0].concepto), r.error || [r.data.giros, r.data.pagos]);
ok('el negocio ve el giro activo', (await api('bootstrap', {}, B.tok)).data.girosActivos.indexOf('belleza') >= 0);
r = await P('panelAccion', { id: B.id, accion: 'giros', giros: [] }); ok('quitar giros', r.ok && r.data.giros.length === 0, r.error);
// etiqueta / nota / contacto
r = await P('panelAccion', { id: A.id, accion: 'etiqueta', etiqueta: 'Interesado' }); ok('etiqueta', r.ok && r.data.etiqueta === 'Interesado', r.error);
r = await P('panelAccion', { id: A.id, accion: 'etiqueta', etiqueta: 'Inventada' }); ok('etiqueta no válida → se quita', r.ok && r.data.etiqueta === '', r.error);
r = await P('panelAccion', { id: A.id, accion: 'rara' }); ok('acción no válida → error', !r.ok, r.error);
r = await P('panelAccion', { id: A.id, accion: 'recuperar' }); ok('recuperar una cuenta no eliminada → error', !r.ok && /no la eliminó/.test(r.error), r.error);
sec('panelNota · panelContacto');
r = await P('panelNota', { id: A.id, notas: 'Cliente amable' }); ok('nota', r.ok && r.data.notas === 'Cliente amable', r.error);
r = await P('panelContacto', { id: A.id, tipo: 'dia3', nota: 'Le escribí' }); ok('contacto anota seguimiento dia3', r.ok && r.data.seguimiento.some(s => s.tipo === 'dia3' && s.nota === 'Le escribí'), r.error);
r = await P('panelContacto', { id: A.id }); ok('contacto sin tipo → manual con texto por defecto', r.ok && r.data.seguimiento.some(s => s.tipo === 'manual' && /WhatsApp/.test(s.nota)), r.error);

/* ========== panelPago ========== */
sec('panelPago');
r = await P('panelPago', { id: A.id, monto: 0 }); ok('monto 0 → error', !r.ok && /Escribe el monto/.test(r.error), r.error);
r = await P('panelPago', { id: A.id, monto: 500, concepto: 'Anticipo licencia', metodo: 'Efectivo', nota: 'en L' }); ok('pago en lempiras', r.ok && Number(r.data.pagos[0].monto) === 500 && r.data.pagos[0].concepto === 'Anticipo licencia', r.error);
r = await P('panelPago', { id: A.id, monto: 530, concepto: 'Licencia · US$ 20 × 26.50', metodo: 'Dólares', nota: 'US$ 20 al cambio del día' }); ok('pago en dólares (convertido a L)', r.ok && r.data.pagos.length === 2 && r.data.pagos[0].metodo === 'Dólares' && Number(r.data.pagos[0].monto) === 530, r.error);
r = await P('panelResumen'); ok('ingresos del mes suman 1500+500+800+100+300+500+530 = 4230', r.data.kpis.ingresosMes === 4230 && r.data.kpis.pagosMes === 7, r.data.kpis);
ok('observación: pagos de la ficha traen monto como texto (la app lo convierte con num())', typeof r.data.kpis.ingresosMes === 'number');
ok('sinPago: A tiene pago pero no licencia activa → no sale; B activa con pago → no sale', !r.data.sinPago.some(x => x.que === 'Licencia'), r.data.sinPago);

/* ========== panelCuotas ========== */
sec('panelCuotas · calendario de pagos');
r = await P('panelCuotas', { id: A.id, accion: 'programar', monto: 0, fecha: HOY }); ok('programar sin monto → error', !r.ok, r.error);
r = await P('panelCuotas', { id: A.id, accion: 'programar', monto: 350, fecha: 'ayer' }); ok('programar fecha mala → error', !r.ok, r.error);
r = await P('panelCuotas', { id: A.id, accion: 'programar', monto: 350, fecha: HOY, veces: 2, gracia: 3, concepto: 'Licencia' }); ok('programar 2 cuotas desde hoy', r.ok && r.data.cuotas.length === 2 && r.data.cuotas[0].fecha === HOY && r.data.cuotas[0].concepto === 'Licencia 1/2' && r.data.cuotas[1].fecha > HOY, r.error || r.data.cuotas);
const q1 = r.data.cuotas[0].id, q2 = r.data.cuotas[1].id;
bA = (await api('bootstrap', {}, A.tok)).data;
ok('desde el día de pago el dueño ve el aviso (vencida hoy, no pausado)', bA.cobroVM && bA.cobroVM.vencidas.length === 1 && bA.cobroVM.total === 350 && bA.cobroVM.pausado === false && bA.cobroVM.pausaEl === dia(4), bA.cobroVM);
r = await P('panelDatosPago', { texto: 'BAC 123-456 · a nombre de Vic Molina' }); ok('panelDatosPago', r.ok && r.data.datosPago === 'BAC 123-456 · a nombre de Vic Molina', r.error);
ok('el dueño ve los datos de pago junto al cobro', (await api('bootstrap', {}, A.tok)).data.cobroVM.datosPago === 'BAC 123-456 · a nombre de Vic Molina');
r = await P('panelCuotas', { id: A.id, accion: 'mover', cuotaId: q1, fecha: dia(2) }); ok('prórroga (mover) → ya no hay vencidas', r.ok && r.data.cuotas.find(c => c.id === q1).fecha === dia(2) && r.data.cobro.vencidas.length === 0 && r.data.cobro.proxima.id === q1, r.error);
bA = (await api('bootstrap', {}, A.tok)).data; ok('el dueño ve la próxima (≤5 días) sin vencidas', bA.cobroVM && bA.cobroVM.vencidas.length === 0 && bA.cobroVM.proxima.m === 350, bA.cobroVM);
// pausa tras días de gracia
r = await P('panelCuotas', { id: A.id, accion: 'mover', cuotaId: q1, fecha: dia(-4) }); ok('cuota con 4 días de atraso y 3 de gracia', r.ok && r.data.cobro.pausado === true && r.data.cobro.atraso === 4, r.data && r.data.cobro);
r = await api('bootstrap', {}, A.tok); ok('programa pausado por pago → PRUEBA_VENCIDA tipo pago', !r.ok && /PRUEBA_VENCIDA/.test(r.error) && /"tipo":"pago"/.test(r.error) && /"total":350/.test(r.error), r.error);
r = await api('tiendaInfo', { negocio: A.id }); ok('tienda cerrada mientras está pausado', !r.ok && /TIENDA_CERRADA/.test(r.error), r.error);
r = await P('panelCuotas', { id: A.id, accion: 'pagar', cuotaId: q1, metodo: 'Transferencia' }); ok('marcar pagada → pago anotado y cuota pagada', r.ok && r.data.cuotas.find(c => c.id === q1).estado === 'pagada' && r.data.pagos.some(p => p.concepto === 'Licencia 1/2' && Number(p.monto) === 350), r.error);
ok('el dueño vuelve a entrar', (await api('bootstrap', {}, A.tok)).ok);
r = await P('panelCuotas', { id: A.id, accion: 'pagar', cuotaId: q1 }); ok('pagar dos veces → error', !r.ok && /ya está marcado/.test(r.error), r.error);
r = await P('panelCuotas', { id: A.id, accion: 'quitar', cuotaId: q1 }); ok('quitar una pagada → error', !r.ok, r.error);
r = await P('panelCuotas', { id: A.id, accion: 'quitar', cuotaId: q2 }); ok('quitar la pendiente', r.ok && !r.data.cuotas.some(c => c.id === q2) && r.data.cobro === null, r.error);
r = await P('panelCuotas', { id: A.id, accion: 'pagar', cuotaId: q2 }); ok('pagar una anulada → error', !r.ok && /ya no existe/.test(r.error), r.error);
// comprobantes
sec('panelComprobantes');
r = await P('panelCuotas', { id: A.id, accion: 'programar', monto: 200, fecha: dia(1), concepto: 'Plus' });
const q3 = r.data.cuotas.find(c => c.estado === 'pendiente').id;
r = await api('cobroComprobante', { foto: FOTO }, A.tok); ok('dueño manda comprobante', r.ok && r.data.proxima.r === 'revisar', r.error);
r = await P('panelComprobantes'); ok('panelComprobantes: 1 por revisar', r.ok && r.data.length === 1 && r.data[0].id === q3 && r.data[0].negocio === 'Pulpería La Bendición' && r.data[0].monto === 200 && r.data[0].comprobante, r.data);
r = await P('panelCuotas', { id: A.id, accion: 'rechazar', cuotaId: q3, nota: 'borroso' }); ok('rechazar', r.ok && r.data.seguimiento.some(s => /Comprobante rechazado/.test(s.nota)), r.error);
ok('el dueño ve el rechazo', (await api('bootstrap', {}, A.tok)).data.cobroVM.proxima.r === 'no');
ok('ya no está por revisar', (await P('panelComprobantes')).data.length === 0);
r = await api('cobroComprobante', { foto: FOTO }, A.tok);
r = await P('panelCuotas', { id: A.id, accion: 'pagar', cuotaId: q3 }); ok('aprobar → pagada y sin pendientes', r.ok && (await P('panelComprobantes')).data.length === 0 && !(await api('bootstrap', {}, A.tok)).data.cobroVM, r.error);

/* ========== panelContrato ========== */
sec('panelContrato');
r = await P('panelContrato', { id: B.id, accion: 'previa', monto: 1500 }); ok('previa: html y texto con los campos rellenos', r.ok && /Norey Beauty/.test(r.data.texto) && /Noemí/.test(r.data.texto) && /1,500/.test(r.data.texto) && !/\{dueno\}/.test(r.data.texto) && /<div class="cdoc">/.test(r.data.html), r.error);
ok('previa no guarda nada', db.T.Contratos.length === 0);
r = await P('panelContrato', { id: B.id, accion: 'crear', monto: 1500, desde: HOY, hasta: dia(-1) }); ok('hasta antes de desde → error', !r.ok, r.error);
r = await P('panelContrato', { id: B.id, accion: 'crear', monto: 1500, titulo: 'Contrato Norey' }); ok('crear contrato', r.ok && r.data.contratos.length === 1 && r.data.contratos[0].estado === 'pendiente' && r.data.contratos[0].monto === 1500, r.error);
const kId = r.data.contratos[0].id;
r = await P('panelContrato', { id: B.id, accion: 'crear', monto: 10 }); ok('segundo pendiente → error', !r.ok && /Ya hay un contrato pendiente/.test(r.error), r.error);
bB = (await api('bootstrap', {}, B.tok)).data; ok('el dueño ve el contrato pendiente', bB.contratoVM && bB.contratoVM.pendiente && bB.contratoVM.pendiente.id === kId, bB.contratoVM);
r = await P('panelContrato', { id: B.id, accion: 'ver', contratoId: kId }); ok('ver contrato', r.ok && r.data.contrato.id === kId && /Recibo de pago/.test(r.data.html), r.error);
r = await api('contratoFirmar', { id: kId, acepto: true, firma: FOTO, nombre: 'Noemí R.' }, B.tok); ok('dueño firma', r.ok && r.data.contrato.estado === 'firmado' && r.data.contrato.huella.length === 12 && r.data.contrato.pdf, r.error);
r = await P('panelContrato', { id: B.id, accion: 'pdf', contratoId: kId }); ok('regenerar PDF', r.ok && r.data.contrato.pdf, r.error);
r = await P('panelContrato', { id: B.id, accion: 'anular', contratoId: kId }); ok('anular firmado sin confirmar → error', !r.ok && /Confirma/.test(r.error), r.error);
r = await P('panelContrato', { id: B.id, accion: 'anular', contratoId: kId, confirmar: true }); ok('anular firmado con confirmar', r.ok && r.data.contratos[0].estado === 'anulado', r.error);
r = await P('panelContrato', { id: B.id, accion: 'ver', contratoId: 'KX' }); ok('contrato inexistente → error', !r.ok, r.error);

/* ========== Plantillas ========== */
sec('panelPlantillas · panelPlantillasGuardar');
r = await P('panelPlantillas'); ok('plantillas por defecto', r.ok && r.data.dia3 && r.data.contrato && /PRIMERA/.test(r.data.contrato), r.error);
r = await P('panelPlantillasGuardar', { plantillas: { dia3: 'Hola {dueno}, ¿todo bien con {negocio}?', contrato: 'Contrato corto para {negocio} con {dueno}. Monto {monto}.', inventada: 'x' } }); ok('guardar plantillas', r.ok && r.data.dia3 === 'Hola {dueno}, ¿todo bien con {negocio}?' && /Contrato corto/.test(r.data.contrato) && r.data.inventada === undefined, r.error);
r = await P('panelPlantillas'); ok('persisten', r.data.dia3 === 'Hola {dueno}, ¿todo bien con {negocio}?' && /Contrato corto/.test(r.data.contrato) && r.data.vence);
r = await P('panelContrato', { id: B.id, accion: 'crear', monto: 900 }); ok('crear contrato usa la plantilla nueva (texto ≥ 50 letras)', r.ok && /Contrato corto para Norey Beauty con Noemí/.test(db.T.Contratos[db.T.Contratos.length - 1].texto), r.error);
r = await P('panelPlantillasGuardar', { plantillas: { contrato: '' } }); ok('contrato vacío → vuelve al de fábrica', r.ok && /PRIMERA/.test(r.data.contrato), r.error);

/* ========== Soporte ========== */
sec('panelSoporte · Ver · Responder · Estado');
r = await api('soporteCrear', { motivo: 'error', modulo: 'Ventas', texto: 'No me imprime el ticket', foto: '', version: '1.9.38' }, A.tok); ok('cliente abre soporte', r.ok, r.error);
const sopId = r.data.chat.id;
r = await api('soporteCrear', { motivo: 'duda', texto: '¿Cómo cargo fotos?' }, B.tok); const sopB = r.data.chat.id;
r = await P('panelSoporte'); ok('panelSoporte: 2 chats, sin leer 1 cada uno, el más reciente primero', r.ok && r.data.length === 2 && r.data.every(c => c.sinLeer === 1) && r.data[0].id === sopB, r.data);
r = await P('panelResumen'); ok('resumen: soporteSin 2, erroresAbiertos 1, tarjeta de A con sop', r.data.soporteSin === 2 && r.data.erroresAbiertos === 1 && r.data.negocios.find(x => x.id === A.id).sop && r.data.negocios.find(x => x.id === A.id).sop.sin === 1, [r.data.soporteSin, r.data.erroresAbiertos]);
r = await P('panelSoporteVer', { id: sopId }); ok('panelSoporteVer: mensajes y ficha; marca leído', r.ok && r.data.mensajes.length === 1 && r.data.mensajes[0].de === 'cli' && r.data.chat.sinLeer === 0 && r.data.negocio && r.data.negocio.id === A.id, r.error);
r = await P('panelSoporteResponder', { id: sopId, texto: '' }); ok('responder vacío → error', !r.ok, r.error);
r = await P('panelSoporteResponder', { id: sopId, texto: 'Revisa el ancho del papel en Ajustes' }); ok('responder', r.ok && r.data.mensajes.length === 2 && r.data.mensajes[1].de === 'adm' && r.data.chat.deCliente === false, r.error);
r = await api('soporteLista', {}, A.tok); ok('el cliente ve 1 sin leer', r.ok && r.data[0].sinLeer === 1 && r.data[0].ultimoTexto === 'Revisa el ancho del papel en Ajustes', r.data);
r = await api('soporteVer', { id: sopId }, A.tok); ok('cliente lee → sinLeer 0', r.ok && r.data.chat.sinLeer === 0 && r.data.mensajes.length === 2, r.error);
r = await api('soporteEnviar', { id: sopId, texto: 'Ya funcionó, gracias' }, A.tok); ok('cliente responde', r.ok, r.error);
r = await P('panelSoporteEstado', { id: sopId, estado: 'resuelto' }); ok('marcar resuelto', r.ok && r.data.chat.estado === 'resuelto', r.error);
r = await P('panelSoporteEstado', { id: sopId, estado: 'cualquiera' }); ok('estado raro → abierto', r.ok && r.data.chat.estado === 'abierto', r.error);
r = await P('panelSoporteEstado', { id: sopId, estado: 'resuelto' });
r = await P('panelSoporteVer', { id: 'TX' }); ok('chat inexistente → error', !r.ok, r.error);
r = await api('soporteVer', { id: sopB }, A.tok); ok('un negocio no ve el soporte de otro', !r.ok, r.error);

/* ========== Tasa, gastos, publicidad, llegó ========== */
sec('panelTasa · panelGastos · panelGastoGuardar · panelGastoAnular · panelLlego');
r = await P('panelTasa', { forzar: true }); ok('tasa del dólar 26.5', r.ok && r.data.tasa === 26.5, r.data);
r = await P('panelTasa'); ok('tasa en caché', r.ok && r.data.tasa === 26.5, r.data);
r = await P('panelGastos'); ok('panelGastos vacío', r.ok && r.data.campanas.length === 0 && r.data.otros.length === 0 && r.data.tasa === 26.5, r.error);
r = await P('panelGastoGuardar', { tipo: 'otro', moneda: 'HNL', montoOrig: 0, nombre: 'Dominio' }); ok('gasto sin monto → error', !r.ok, r.error);
r = await P('panelGastoGuardar', { tipo: 'otro', moneda: 'HNL', montoOrig: 250, nombre: 'Dominio .com', fecha: HOY }); ok('gasto en L', r.ok && r.data.otros.length === 1 && r.data.otros[0].monto === 250 && r.data.otros[0].tasa === 1, r.error);
r = await P('panelGastoGuardar', { tipo: 'otro', moneda: 'USD', montoOrig: 10, nombre: 'Supabase' }); ok('gasto en US$ con la tasa del día (10 × 26.5 = 265)', r.ok && r.data.otros.length === 2 && r.data.otros.find(g => g.nombre === 'Supabase').monto === 265, r.error || r.data.otros);
r = await P('panelGastoGuardar', { tipo: 'publicidad', moneda: 'USD', montoOrig: 20, tasa: 25, nombre: 'Campaña noviembre', plataforma: 'Facebook', desde: dia(-3), hasta: dia(3) }); ok('publicidad en US$ con tasa manual (20 × 25 = 500)', r.ok && r.data.campanas.length === 1 && r.data.campanas[0].monto === 500 && r.data.campanas[0].enCurso, r.error || r.data.campanas);
const campId = r.data.campanas[0].id;
ok('la publicidad atribuye los negocios registrados en sus fechas (4)', r.data.campanas[0].registros === 4 && r.data.invertido === 500, r.data.campanas[0]);
r = await P('panelGastoGuardar', { tipo: 'publicidad', moneda: 'HNL', montoOrig: 100, nombre: 'Mal', desde: dia(2), hasta: dia(1) }); ok('publicidad con hasta < desde → error', !r.ok, r.error);
r = await P('panelGastoGuardar', { id: campId, tipo: 'publicidad', moneda: 'HNL', montoOrig: 600, nombre: 'Campaña noviembre (edit)', plataforma: 'Facebook', desde: dia(-3), hasta: dia(3) }); ok('editar gasto por id', r.ok && r.data.campanas.length === 1 && r.data.campanas[0].monto === 600 && /edit/.test(r.data.campanas[0].nombre), r.error);
r = await P('panelResumen'); ok('resumen: gastosMes 250+265+600 = 1115, resultadoMes = 4780 − 1115', r.data.kpis.gastosMes === 1115 && r.data.kpis.resultadoMes === 3665 && r.data.kpis.invertidoPub === 600 && r.data.kpis.recuperadoPub === 4780, r.data.kpis);
r = await P('panelLlego', { id: A.id, llegoPor: 'PXNOEXISTE' }); ok('llegó por publicidad inexistente → error', !r.ok, r.error);
r = await P('panelLlego', { id: A.id, llegoPor: 'directo' }); ok('llegó directo', r.ok && r.data.llego.directo === true && r.data.llego.id === '', r.error || r.data.llego);
r = await P('panelLlego', { id: A.id, llegoPor: campId }); ok('llegó por la publicidad (a mano)', r.ok && r.data.llego.id === campId && r.data.llego.auto === false, r.error || r.data.llego);
r = await P('panelGastoAnular', { id: campId }); ok('anular publicidad → desaparece y el cliente vuelve a automático', r.ok && r.data.campanas.length === 0 && lic(A.id).llegoPor === '', r.error);
r = await P('panelGastoAnular', { id: 'PX' }); ok('anular inexistente → error', !r.ok, r.error);

/* ========== Visitas y vendedores ========== */
sec('visita · panelVisitas · panelVendedores');
r = await P('panelVendedorGuardar', { nombre: '' }); ok('vendedor sin nombre → error', !r.ok, r.error);
r = await P('panelVendedorGuardar', { nombre: 'Juan Pérez', whatsapp: '9988-7766' }); ok('vendedor nuevo → código v-juan', r.ok && r.data.codigo === 'v-juan' && r.data.whatsapp === '99887766', r.data);
r = await P('panelVendedorGuardar', { nombre: 'Juan López' }); ok('otro Juan → v-juan-lopez', r.ok && r.data.codigo === 'v-juan-lopez', r.data);
r = await P('panelVendedorGuardar', { codigo: 'v-juan', nombre: 'Juan Pérez G.' }); ok('editar vendedor conserva el código', r.ok && r.data.codigo === 'v-juan' && r.data.nombre === 'Juan Pérez G.', r.data);
r = await api('visita', { p: 'negocio', o: 'v-juan', v: 'navJuan001', d: 'cel' }); ok('visita por enlace del vendedor', r.ok && r.data === true, r.error);
r = await api('visita', { p: 'negocio', o: 'v-juan', v: 'navJuan001', d: 'cel' }); ok('misma visita en 30 min no se repite (pero responde true)', r.ok && r.data === true && db.T.Visitas.filter(v => v.vid === 'navJuan001').length === 1, db.T.Visitas.length);
r = await api('visita', { p: 'catalogo', o: 'tiktok', v: 'navJuan001', d: 'pc', r: 'www.tiktok.com' }); ok('otra página sí cuenta', r.ok && db.T.Visitas.filter(v => v.vid === 'navJuan001').length === 2);
r = await api('visita', { p: '', v: 'navX' }); ok('sin página → false', r.ok && r.data === false, r.data);
const E = await reg('Barbería Juan', 'Pedro', 'belleza', '35555555', '5555', { origen: { o: 'v-juan', v: 'navJuan001' } });
r = await P('panelVendedores'); ok('panelVendedores: 1 visita por su enlace, 1 persona, 1 registro para v-juan', r.ok && r.data.vendedores.length === 2 && r.data.vendedores[0].visitas === 1 && r.data.vendedores[0].personas === 1 && r.data.vendedores[0].registros === 1 && r.data.vendedores[0].negocios[0].id === E.id, r.data && r.data.vendedores[0]);
r = await P('panelNegocio', { id: E.id }); ok('ficha: origen canal v-juan', r.ok && r.data.origen.canal === 'v-juan' && r.data.origen.visitas === 2, r.data && r.data.origen);
r = await P('panelVendedorQuitar', { codigo: 'v-juan-lopez' }); ok('quitar vendedor', r.ok && (await P('panelVendedores')).data.vendedores.length === 1, r.error);
r = await P('panelVisitas'); ok('panelVisitas 7 días: total, únicos, hoyN, barras, origen', r.ok && r.data.dias === 7 && r.data.total === 3 && r.data.unicos === 2 && r.data.hoyN === 3 && r.data.barras.length === 7 && r.data.origen.some(o => o.k === 'v-juan' && o.n === 1) && r.data.paginas.some(p => p.k === 'negocio' && p.n === 2) && r.data.registros === 5, r.data && [r.data.total, r.data.hoyN, r.data.origen, r.data.registros]);
r = await P('panelVisitas', { dias: 90 }); ok('90 días → barras por semana', r.ok && r.data.dias === 90 && r.data.barras.every(b => b.semana), r.data && r.data.barras);
r = await P('panelVisitas', { dia: HOY }); ok('un día: 24 barras por hora y lista', r.ok && r.data.dia === HOY && r.data.barras.length === 24 && r.data.lista.length === 3 && r.data.conversion > 0, r.data && [r.data.barras.length, r.data.lista.length]);
r = await P('panelVisitas', { dia: dia(5) }); ok('día futuro → cae al resumen de 7 días', r.ok && r.data.dias === 7, r.data && r.data.dias);
// topes
for (let i = 0; i < 20; i++) await api('visita', { p: 'negocio', o: 'wa' });
r = await api('visita', { p: 'negocio', o: 'wa' }); ok('sin número de navegador: tope 20 por minuto', r.ok && r.data === false, r.data);
r = await api('visita', { p: 'negocio', o: 'wa', v: 'navNuevo01' }); ok('con número de navegador sigue contando', r.ok && r.data === true, r.data);
const HHmm = fmt(Date.now(), true).slice(11).replace(':', ''), YMD = HOY.replace(/-/g, '');
db.cache['VIM_' + HHmm] = { v: '150', e: Date.now() + 120000 };
r = await api('visita', { p: 'negocio', o: 'wa', v: 'navNuevo02' }); ok('tope 150 por minuto', r.ok && r.data === false, r.data);
delete db.cache['VIM_' + HHmm];
db.cache['VID_' + YMD] = { v: '5000', e: Date.now() + 90000000 };
r = await api('visita', { p: 'negocio', o: 'wa', v: 'navNuevo03' }); ok('tope 5,000 por día', r.ok && r.data === false, r.data);
delete db.cache['VID_' + YMD];
r = await api('visita', { p: 'negocio', o: 'wa', v: 'navNuevo03' }); ok('sin tope vuelve a contar', r.ok && r.data === true, r.data);

/* ========== panelImportar ========== */
sec('panelImportar');
const nProdC = (await api('bootstrap', {}, C.tok)).data.productos.length;
const filas = [
  { _fila: 2, nombre: 'Taladro 1/2"', categoria: 'Herramientas', precio: 1850, costo: 1200, existencia: 4, codigo: 'TAL-12' },
  { _fila: 3, nombre: '', categoria: 'Herramientas', precio: 10 },
  { _fila: 4, nombre: 'Sin precio', categoria: 'Herramientas' },
  { _fila: 5, nombre: 'Guantes', categoria: 'Seguridad', precio: 120, op1: 'Talla', val1: 'M, L', existOp: 'M = 3; L = 2', preciosOp: 'L = 130' },
  { _fila: 6, nombre: 'Guantes', categoria: 'Seguridad', precio: 120 },
  { _fila: 7, nombre: 'Brocha 2"', categoria: 'Pintura', precio: 45, costo: 20, existencia: '', tienda: 'no' },
  { _fila: 8, nombre: 'Precio especial mal', categoria: 'Pintura', precio: 45, precioEsp: 50, minEsp: 3 }
];
r = await P('panelImportar', { negocio: C.id, filas, revisar: true }); ok('revisar: 3 válidas, 4 errores, no guarda', r.ok && r.data.nuevos === 3 && r.data.actualizados === 0 && r.data.errores.length === 4 && r.data.cargados === undefined && (await api('bootstrap', {}, C.tok)).data.productos.length === nProdC, r.error || r.data);
ok('errores con fila y motivo', r.ok && r.data.errores.some(e => e.fila === 3 && /nombre/.test(e.error)) && r.data.errores.some(e => e.fila === 4 && /precio/.test(e.error)) && r.data.errores.some(e => e.fila === 6 && /repetido/.test(e.error)) && r.data.errores.some(e => e.fila === 8 && /menor/.test(e.error)), r.data && r.data.errores);
ok('lista: guantes con 5 de existencia y precio por opción', r.ok && r.data.lista.some(x => x.nombre === 'Guantes' && x.existencia === 5 && /precio por opción/.test(x.det)), r.data && r.data.lista);
r = await P('panelImportar', { negocio: C.id, filas }); ok('importar: cargados 3', r.ok && r.data.cargados === 3, r.error || r.data);
let prodsC = (await api('bootstrap', {}, C.tok)).data.productos;
const tal = prodsC.find(p => p.nombre === 'Taladro 1/2"'), gua = prodsC.find(p => p.nombre === 'Guantes'), bro = prodsC.find(p => p.nombre === 'Brocha 2"');
ok('taladro: stock 4, costo 1200, código', tal && tal.stock === 4 && tal.costo === 1200 && tal.codigo === 'TAL-12', tal);
ok('guantes: opciones y variantes', gua && /Talla/.test(gua.opciones) && /"p":130/.test(gua.variantes) && gua.stock === 5, gua && [gua.opciones, gua.variantes, gua.stock]);
ok('brocha: fuera de la tienda', bro && bro.tienda === false, bro && bro.tienda);
r = await P('panelImportar', { negocio: C.id, filas: [{ nombre: 'taladro 1/2"', categoria: 'Herramientas', precio: 1900, existencia: 10 }] }); ok('reimportar: actualiza por nombre y ajusta existencia', r.ok && r.data.actualizados === 1 && r.data.nuevos === 0, r.error || r.data);
prodsC = (await api('bootstrap', {}, C.tok)).data.productos; const tal2 = prodsC.find(p => p.id === tal.id);
ok('taladro actualizado: precio 1900, stock 10 (ajuste por conteo)', tal2 && tal2.precio === 1900 && tal2.stock === 10, tal2 && [tal2.precio, tal2.stock]);
r = await P('panelImportar', { negocio: C.id, filas: [] }); ok('sin filas → error', !r.ok, r.error);

/* ========== Duplicados ========== */
sec('panelLimpiarDuplicados');
const copia = Object.assign({}, lic(A.id), { id: 'NDUPLICADO1', hojaId: 'SDUP1', negocio: 'Pulpería La Bendición', _fila: undefined }); delete copia._fila; db.T.Licencias.push(copia);
r = await P('panelResumen'); ok('el resumen detecta el repetido (sin acceso)', r.data.duplicados.length === 1 && r.data.duplicados[0].id === 'NDUPLICADO1' && !r.data.duplicados[0].limpiada && r.data.negocios.length === 5, r.data.duplicados);
r = await P('panelLimpiarDuplicados'); ok('limpiar: 1 marcada', r.ok && r.data.marcadas === 1 && r.data.total === 1, r.error || r.data);
ok('queda «Duplicada» con nota', lic('NDUPLICADO1').estado === 'Duplicada' && /Registro repetido/.test(lic('NDUPLICADO1').notas), lic('NDUPLICADO1'));
r = await P('panelLimpiarDuplicados'); ok('segunda vez: 0 nuevas', r.ok && r.data.marcadas === 0 && r.data.total === 1, r.data);
r = await P('panelResumen'); ok('la duplicada no se cuenta como negocio', r.data.negocios.length === 5 && r.data.duplicados[0].limpiada, r.data.negocios.length);

/* ========== Eliminar cliente ========== */
sec('panelAccion eliminar');
r = await P('panelAccion', { id: E.id, accion: 'eliminar', confirmar: 'Barberia Juanito', motivo: 'prueba' }); ok('nombre que no coincide → error', !r.ok && /no coincide/.test(r.error), r.error);
r = await P('panelAccion', { id: E.id, accion: 'eliminar', confirmar: ' barbería JUAN ', motivo: 'Se fue a otro sistema' }); ok('eliminar con el nombre (sin importar mayúsculas/acentos)', r.ok && r.data.eliminado && r.data.negocio === 'Barbería Juan', r.error);
ok('estado Eliminada y nota', lic(E.id).estado === 'Eliminada' && /Eliminado .* · Se fue a otro sistema/.test(lic(E.id).notas), lic(E.id));
r = await api('bootstrap', {}, E.tok); ok('su sesión muere', !r.ok, r.error);
r = await api('login', { whatsapp: '35555555', pin: '5555' }); ok('ya no puede entrar', !r.ok, r.error);
ok('sus accesos se borraron', !db.T.Accesos.some(a => a.negocioId === E.id));
r = await P('panelResumen'); ok('ya no aparece en el resumen (ni en eliminadas, que son las del cliente)', !r.data.negocios.some(x => x.id === E.id) && r.data.eliminadas.length === 0, r.data.eliminadas);
r = await api('registrar', { negocio: 'Barbería Juan 2', nombre: 'Pedro', giro: 'belleza', whatsapp: '35555555', pin: '5555' }); ok('su WhatsApp queda libre para registrarse de nuevo', r.ok, r.error);
r = await P('panelVerApp', { id: E.id }); ok('ver app de un eliminado → error', !r.ok, r.error);

/* ========== panelSalir ========== */
sec('panelSalir');
const pt2 = (await api('panelLogin', { clave: 'clave-vic' }, undefined, { ip: IPA })).data.token;
r = await api('panelSalir', {}, undefined, { panel: pt2 }); ok('salir', r.ok && r.data === true, r.error);
r = await api('panelResumen', {}, undefined, { panel: pt2 }); ok('el token murió', !r.ok && r.error === 'PANEL', r.error);
r = await P('panelResumen'); ok('el otro token sigue vivo', r.ok, r.error);

/* ========== Contabilidad ========== */
sec('Contabilidad: negocio sin módulo');
const CONTAB_ACC = ['contabilidad', 'contabPlan', 'guardarCuenta', 'guardarMapeo', 'guardarAsiento', 'anularAsiento', 'cerrarPeriodo', 'guardarConcil'];
for (const a of CONTAB_ACC) { r = await api(a, { registro: { codigo: '6111', nombre: 'x' }, mes: mesAnt, id: 'x', mapeo: {} }, A.tok); ok(a + ' sin contab → rechazado', !r.ok && /Contabilidad no está activada/.test(r.error), r.error); }

sec('Contabilidad: plan, cuentas y mapeo (negocio C)');
r = await api('contabPlan', {}, C.tok); ok('contabPlan: 32 cuentas base y mapeo', r.ok && r.data.plan.length === 32 && r.data.mapeo.caja === '1101' && r.data.mapeo.metodos.Efectivo === 'caja' && Array.isArray(r.data.gastoCats), r.error || (r.data && r.data.plan.length));
r = await api('guardarCuenta', { registro: { codigo: '12', nombre: 'Mal' } }, C.tok); ok('código corto → error', !r.ok && /4 a 6 dígitos/.test(r.error), r.error);
r = await api('guardarCuenta', { registro: { codigo: '1101', nombre: 'Caja 2' } }, C.tok); ok('código repetido → error', !r.ok && /Ya existe/.test(r.error), r.error);
r = await api('guardarCuenta', { registro: { codigo: '6111', nombre: 'Internet' } }, C.tok); ok('cuenta nueva 6111 (tipo gasto, deudora, por el 1.er dígito)', r.ok && r.data.plan.some(c => c.codigo === '6111' && c.tipo === 'gasto' && c.naturaleza === 'deudora'), r.error);
const cta6111 = r.data.plan.find(c => c.codigo === '6111');
r = await api('guardarCuenta', { registro: { id: cta6111.id, codigo: '6111', nombre: 'Internet y teléfono' } }, C.tok); ok('renombrar cuenta', r.ok && r.data.plan.find(c => c.id === cta6111.id).nombre === 'Internet y teléfono', r.error);
r = await api('guardarMapeo', { mapeo: { caja: '9999' } }, C.tok); ok('mapeo a cuenta inexistente → error', !r.ok && /no existe/.test(r.error), r.error);
r = await api('guardarMapeo', { mapeo: { gastos: { Servicios: { cuenta: '8888' } } } }, C.tok); ok('mapeo de gasto a cuenta inexistente → error', !r.ok, r.error);
const mapeoBase = (await api('contabPlan', {}, C.tok)).data.mapeo;
r = await api('guardarMapeo', { mapeo: Object.assign({}, mapeoBase, { gastoDefault: '6111', gastos: { Servicios: { cuenta: '6103', isv: 'si' } } }), inventario: 'perpetuo', isvCompras: true }, C.tok); ok('guardar mapeo (gastoDefault 6111, Servicios con ISV)', r.ok && r.data.mapeo.gastoDefault === '6111' && r.data.config.inventario === 'perpetuo' && r.data.config.isvCompras === true, r.error);
r = await api('guardarCuenta', { registro: { id: cta6111.id, codigo: '6112', nombre: 'Internet' } }, C.tok); ok('cambiar código de una cuenta en el mapeo → rechazado', !r.ok && /ya se usa/.test(r.error), r.error);

sec('Contabilidad: asientos automáticos');
prodsC = (await api('bootstrap', {}, C.tok)).data.productos;
const pC = prodsC.find(p => p.tipo === 'producto' && p.stock >= 3 && !p.opciones && p.costo > 0);
const cliC = (await api('guardar', { entidad: 'Clientes', registro: { nombre: 'Don Pepe', telefono: '9999-1111', limite: 9000, activo: true } }, C.tok)).data; const cidC = (cliC.registro || cliC).id;
const provC = (await api('guardar', { entidad: 'Proveedores', registro: { nombre: 'Distribuidora Norte', telefono: '2222-0000', activo: true } }, C.tok)).data; const pvC = (provC.registro || provC).id;
const vC1 = (await api('venta', { items: [{ productoId: pC.id, cantidad: 2, precio: pC.precio }], metodo: 'Efectivo', recibido: 10000, clave: 'C1' }, C.tok)); ok('venta contado C', vC1.ok, vC1.error);
const vC2 = (await api('venta', { clienteId: cidC, items: [{ productoId: pC.id, cantidad: 1, precio: pC.precio }], metodo: 'Crédito', recibido: 0, clave: 'C2' }, C.tok)); ok('venta crédito C', vC2.ok, vC2.error);
const ventaC1 = vC1.data.venta || vC1.data, ventaC2 = vC2.data.venta || vC2.data;
r = await api('abono', { clienteId: cidC, monto: 100, metodo: 'Transferencia' }, C.tok); ok('abono C', r.ok, r.error);
r = await api('compra', { items: [{ productoId: pC.id, cantidad: 10, costo: pC.costo }], proveedorId: pvC, metodo: 'Crédito', factura: 'F-001' }, C.tok); ok('compra al crédito C', r.ok, r.error);
const compraTotal = Math.round(10 * pC.costo * 100) / 100;
r = await api('compra', { items: [{ productoId: pC.id, cantidad: 2, costo: pC.costo }], metodo: 'Efectivo' }, C.tok); ok('compra de contado C', r.ok, r.error);
r = await api('pago', { proveedorId: pvC, monto: 200, metodo: 'Efectivo' }, C.tok); ok('pago a proveedor C', r.ok, r.error);
r = await api('guardarGasto', { registro: { categoria: 'Servicios', detalle: 'Energía eléctrica', monto: 230, metodo: 'Efectivo', fechaGasto: HOY } }, C.tok); ok('gasto Servicios (con ISV en el mapeo)', r.ok, r.error);
r = await api('guardarGasto', { registro: { categoria: 'Varios', detalle: 'Bolsas', monto: 50, metodo: 'Efectivo', fechaGasto: HOY } }, C.tok); ok('gasto sin mapeo → gastoDefault', r.ok, r.error);
r = await api('contabilidad', { desde: MES + '-01', hasta: HOY }, C.tok); ok('contabilidad (mes actual)', r.ok, r.error);
const ct = r.data; const as = ct.asientos;
const cuadra = a => Math.abs(a.lineas.reduce((s, l) => s + l.debe - l.haber, 0)) < 0.005;
ok('todos los asientos cuadran', as.length > 0 && as.every(cuadra), as.filter(a => !cuadra(a)).map(a => a.concepto));
ok('trae plan, mapeo, config, saldosIniciales, cobrar/pagar, cerrado, inicio', ct.plan && ct.mapeo && ct.config && ct.saldosIniciales && ct.cobrar && ct.pagar && ct.cerrado === '' && ct.inicio === '2000-01-01' && ct.aperturaHecha === false, Object.keys(ct));
const aV1 = as.find(a => a.id === 'D' + ventaC1.id), aV2 = as.find(a => a.id === 'D' + ventaC2.id);
ok('venta contado: caja al debe por el total, ventas al haber (neto) e ISV por pagar', aV1 && aV1.tipo === 'venta' && aV1.lineas.some(l => l.cuenta === '1101' && l.debe === ventaC1.total) && aV1.lineas.some(l => l.cuenta === '4101' && l.haber === Math.round((ventaC1.total - ventaC1.isv) * 100) / 100) && (ventaC1.isv > 0 ? aV1.lineas.some(l => l.cuenta === '2102' && l.haber === ventaC1.isv) : true), aV1 && aV1.lineas);
ok('la venta llevó ISV 15 % (precios con ISV incluido)', ventaC1.isv > 0 && Math.abs(ventaC1.isv - (ventaC1.total - ventaC1.total / 1.15)) < 0.02, [ventaC1.total, ventaC1.isv]);
ok('venta contado: costo de ventas e inventario (perpetuo)', aV1 && aV1.lineas.some(l => l.cuenta === '5101' && l.debe === ventaC1.costo) && aV1.lineas.some(l => l.cuenta === '1104' && l.haber === ventaC1.costo), aV1 && aV1.lineas);
ok('venta crédito: cuentas por cobrar al debe con el nombre del cliente', aV2 && aV2.lineas.some(l => l.cuenta === '1103' && l.debe === ventaC2.total && l.detalle === 'Don Pepe') && aV2.tercero === 'Don Pepe', aV2 && aV2.lineas);
const aAb = as.find(a => a.tipo === 'cobro'); ok('abono: banco (transferencia) al debe, CxC al haber', aAb && aAb.lineas.some(l => l.cuenta === '1102' && l.debe === 100) && aAb.lineas.some(l => l.cuenta === '1103' && l.haber === 100), aAb && aAb.lineas);
const aCo = as.filter(a => a.tipo === 'compra'); const aCoC = aCo.find(a => a.lineas.some(l => l.cuenta === '2101'));
ok('compra crédito: inventario (base) + ISV crédito fiscal, CxP por el total', aCoC && aCoC.lineas.some(l => l.cuenta === '1104' && l.debe === Math.round(compraTotal / 1.15 * 100) / 100) && aCoC.lineas.some(l => l.cuenta === '1105' && l.debe > 0) && aCoC.lineas.some(l => l.cuenta === '2101' && l.haber === compraTotal && l.detalle === 'Distribuidora Norte') && /Fact\. F-001/.test(aCoC.concepto), aCoC && aCoC.lineas);
ok('compra contado: sale de caja', aCo.some(a => a.lineas.some(l => l.cuenta === '1101' && l.haber > 0)), aCo.map(a => a.lineas));
const aPg = as.find(a => a.tipo === 'pago'); ok('pago a proveedor: CxP al debe, caja al haber', aPg && aPg.lineas.some(l => l.cuenta === '2101' && l.debe === 200) && aPg.lineas.some(l => l.cuenta === '1101' && l.haber === 200), aPg && aPg.lineas);
const aG = as.filter(a => a.tipo === 'gasto'); const aGS = aG.find(a => /Servicios/.test(a.concepto)), aGV = aG.find(a => /Bolsas/.test(a.concepto));
ok('gasto Servicios: 6103 base 200 + ISV 30, caja 230', aGS && aGS.lineas.some(l => l.cuenta === '6103' && l.debe === 200) && aGS.lineas.some(l => l.cuenta === '1105' && l.debe === 30) && aGS.lineas.some(l => l.cuenta === '1101' && l.haber === 230), aGS && aGS.lineas);
ok('gasto sin mapeo: va a gastoDefault 6111 sin ISV', aGV && aGV.lineas.some(l => l.cuenta === '6111' && l.debe === 50) && aGV.lineas.length === 2, aGV && aGV.lineas);
ok('asientos de existencia inicial (ejemplos) e importación NO aparecen (tipo inicial)', !as.some(a => /Existencia inicial/.test(a.concepto)), as.filter(a => a.tipo === 'inventario').map(a => a.concepto));
// estado de resultados: saldos por cuenta
const sal = {}; as.forEach(a => { if (a.anulado) return; a.lineas.forEach(l => { sal[l.cuenta] = Math.round(((sal[l.cuenta] || 0) + l.debe - l.haber) * 100) / 100; }); });
const ventasNeto = Math.round((ventaC1.total - ventaC1.isv + ventaC2.total - ventaC2.isv) * 100) / 100;
ok('estado de resultados: ventas netas = suma de ventas sin ISV', Math.abs(-sal['4101'] - ventasNeto) < 0.02, [-sal['4101'], ventasNeto]);
ok('costo de ventas = costo de las 2 ventas', Math.abs(sal['5101'] - (ventaC1.costo + ventaC2.costo)) < 0.02, [sal['5101'], ventaC1.costo + ventaC2.costo]);
ok('gastos: 200 + 50', sal['6103'] === 200 && sal['6111'] === 50, [sal['6103'], sal['6111']]);
ok('ISV por pagar = ISV de las ventas', Math.abs(-sal['2102'] - (ventaC1.isv + ventaC2.isv)) < 0.02, [-sal['2102'], ventaC1.isv + ventaC2.isv]);
// inventario periódico / sin ISV en compras
r = await api('guardarMapeo', { mapeo: Object.assign({}, mapeoBase, { gastoDefault: '6111' }), inventario: 'periodico', isvCompras: false }, C.tok); ok('cambiar a periódico sin ISV en compras', r.ok && r.data.config.inventario === 'periodico' && r.data.config.isvCompras === false, r.error);
r = await api('contabilidad', { desde: MES + '-01', hasta: HOY }, C.tok); const as2 = r.data.asientos;
const aV1b = as2.find(a => a.id === 'D' + ventaC1.id), aCoCb = as2.find(a => a.tipo === 'compra' && a.lineas.some(l => l.cuenta === '2101'));
ok('periódico: la venta ya no lleva costo/inventario', aV1b && !aV1b.lineas.some(l => l.cuenta === '5101'), aV1b && aV1b.lineas);
ok('periódico sin ISV: la compra va a 5102 por el total y sin 1105', aCoCb && aCoCb.lineas.some(l => l.cuenta === '5102' && l.debe === compraTotal) && !aCoCb.lineas.some(l => l.cuenta === '1105'), aCoCb && aCoCb.lineas);
ok('gasto Servicios ya sin mapeo → 6111 sin ISV', as2.find(a => /Servicios/.test(a.concepto)).lineas.some(l => l.cuenta === '6111' && l.debe === 230), as2.find(a => /Servicios/.test(a.concepto)).lineas);
r = await api('guardarMapeo', { mapeo: Object.assign({}, mapeoBase, { gastoDefault: '6111' }), inventario: 'perpetuo', isvCompras: true }, C.tok);

sec('Contabilidad: asientos manuales');
r = await api('guardarAsiento', { registro: { fecha: HOY, concepto: 'Aporte del dueño', lineas: [{ cuenta: '1101', debe: 1000 }, { cuenta: '3101', haber: 900 }] } }, C.tok); ok('descuadrado → rechazado', !r.ok && /no cuadra/.test(r.error), r.error);
r = await api('guardarAsiento', { registro: { fecha: HOY, concepto: 'X', lineas: [{ cuenta: '1101', debe: 1000, haber: 1000 }, { cuenta: '3101', haber: 0 }] } }, C.tok); ok('línea con debe y haber → rechazado', !r.ok, r.error);
r = await api('guardarAsiento', { registro: { fecha: HOY, concepto: 'X', lineas: [{ cuenta: '1101', debe: 1000 }, { cuenta: '9999', haber: 1000 }] } }, C.tok); ok('cuenta inexistente → rechazado', !r.ok && /no existe/.test(r.error), r.error);
r = await api('guardarAsiento', { registro: { fecha: HOY, concepto: 'X', lineas: [{ cuenta: '1101', debe: 1000 }] } }, C.tok); ok('una sola línea → rechazado', !r.ok && /al menos dos/.test(r.error), r.error);
r = await api('guardarAsiento', { registro: { fecha: HOY, lineas: [{ cuenta: '1101', debe: 1000 }, { cuenta: '3101', haber: 1000 }] } }, C.tok); ok('sin concepto → rechazado', !r.ok && /concepto/.test(r.error), r.error);
r = await api('guardarAsiento', { registro: { fecha: HOY, concepto: 'Aporte del dueño', ref: 'DEP-1', lineas: [{ cuenta: '1101', debe: 1000, detalle: 'Efectivo' }, { cuenta: '3101', haber: 1000 }] } }, C.tok); ok('asiento cuadrado se guarda con número', r.ok && r.data.asiento.numero && r.data.asiento.tipo === 'manual' && /T12:00$/.test(r.data.asiento.fecha), r.error || r.data);
const asId = r.data.asiento.id;
r = await api('guardarAsiento', { registro: { fecha: mesAnt + '-15', tipo: 'apertura', concepto: 'Apertura', lineas: [{ cuenta: '1101', debe: 5000 }, { cuenta: '3101', haber: 5000 }] } }, C.tok); ok('asiento de apertura (mes anterior)', r.ok && r.data.asiento.tipo === 'apertura', r.error);
const apId = r.data.asiento.id;
r = await api('guardarAsiento', { registro: { fecha: HOY, tipo: 'apertura', concepto: 'Otra apertura', lineas: [{ cuenta: '1101', debe: 1 }, { cuenta: '3101', haber: 1 }] } }, C.tok); ok('segunda apertura → rechazada', !r.ok && /Ya existe un asiento de apertura/.test(r.error), r.error);
r = await api('contabilidad', { desde: MES + '-01', hasta: HOY }, C.tok);
ok('con apertura: inicio = fecha de apertura; saldo inicial de caja 5000', r.data.inicio === mesAnt + '-15' && r.data.aperturaHecha && r.data.saldosIniciales['1101'] === 5000 && r.data.asientos.some(a => a.id === asId && !a.auto), [r.data.inicio, r.data.saldosIniciales]);
r = await api('anularAsiento', { id: asId, motivo: 'error' }, C.tok); ok('anular asiento manual', r.ok, r.error);
r = await api('anularAsiento', { id: asId }, C.tok); ok('anular dos veces → error', !r.ok && /ya está anulado/.test(r.error), r.error);
r = await api('anularAsiento', { id: 'LX' }, C.tok); ok('anular inexistente → error', !r.ok, r.error);
r = await api('contabilidad', { desde: MES + '-01', hasta: HOY }, C.tok); ok('el anulado sale marcado', r.data.asientos.find(a => a.id === asId).anulado === true);
r = await api('anularAsiento', { id: apId }, C.tok); // se quita la apertura para que los derivados del mes anterior cuenten abajo

sec('Contabilidad: cerrar y reabrir período');
// una venta «de un mes anterior» (se le cambia la fecha en la base) para probar la reversión
const ventaVieja = db.T.Ventas.find(v => v.id === ventaC1.id); ventaVieja.fecha = mesAnt + '-20T10:00';
r = await api('cerrarPeriodo', { mes: MES }, C.tok); ok('cerrar el mes en curso → error', !r.ok && /en curso/.test(r.error), r.error);
r = await api('cerrarPeriodo', { mes: '2026/10' }, C.tok); ok('mes mal escrito → error', !r.ok, r.error);
r = await api('cerrarPeriodo', { mes: mesAnt }, C.tok); ok('cerrar ' + mesAnt, r.ok && r.data.cerrado === mesAnt, r.error);
r = await api('cerrarPeriodo', { mes: mesAnt2 }, C.tok); ok('cerrar uno ya cerrado (anterior) → error', !r.ok && /ya está cerrado/.test(r.error), r.error);
r = await api('compra', { items: [{ productoId: pC.id, cantidad: 1, costo: pC.costo }], metodo: 'Efectivo', fecha: mesAnt + '-15' }, C.tok); ok('compra con fecha del mes cerrado → rechazada', !r.ok && /ya está cerrado en Contabilidad/.test(r.error), r.error);
r = await api('guardarGasto', { registro: { categoria: 'Varios', detalle: 'Viejo', monto: 10, metodo: 'Efectivo', fechaGasto: mesAnt + '-15' } }, C.tok); ok('gasto con fecha del mes cerrado → rechazado', !r.ok && /ya está cerrado en Contabilidad/.test(r.error), r.error);
r = await api('guardarAsiento', { registro: { fecha: mesAnt + '-15', concepto: 'Viejo', lineas: [{ cuenta: '1101', debe: 1 }, { cuenta: '3101', haber: 1 }] } }, C.tok); ok('asiento manual en mes cerrado → rechazado', !r.ok && /ya está cerrado/.test(r.error), r.error);
r = await api('guardarConcil', { mes: mesAnt, nuevos: [{ tipo: 'comision', monto: 20 }] }, C.tok); ok('partidas de conciliación en mes cerrado → rechazadas', !r.ok && /está cerrado/.test(r.error), r.error);
r = await api('compra', { items: [{ productoId: pC.id, cantidad: 1, costo: pC.costo }], metodo: 'Efectivo', fecha: HOY }, C.tok); ok('compra de hoy sí pasa', r.ok, r.error);
r = await api('contabilidad', { desde: mesAnt + '-01', hasta: mesAnt + '-31' }, C.tok); ok('mes cerrado: la venta vieja está, cerrado = ' + mesAnt, r.ok && r.data.cerrado === mesAnt && r.data.asientos.some(a => a.id === 'D' + ventaC1.id && !a.anulado), r.error || r.data.asientos.map(a => a.id));
r = await api('anularVenta', { id: ventaC1.id, motivo: 'devolución' }, C.tok); ok('anular la venta del mes cerrado (la app lo permite)', r.ok, r.error);
r = await api('contabilidad', { desde: mesAnt + '-01', hasta: mesAnt + '-31' }, C.tok); const vMesC = r.data.asientos.find(a => a.id === 'D' + ventaC1.id);
ok('el mes cerrado no cambia: la venta original sigue vigente (no anulada)', vMesC && vMesC.anulado === false, vMesC);
r = await api('contabilidad', { desde: MES + '-01', hasta: HOY }, C.tok); const rev = r.data.asientos.find(a => a.id === 'D' + ventaC1.id + 'R');
ok('la anulación entra como reversión en el mes abierto (debe/haber invertidos)', rev && /^Anulación · Venta/.test(rev.concepto) && rev.fecha.slice(0, 10) === HOY && rev.lineas.some(l => l.cuenta === '1101' && l.haber === ventaC1.total) && rev.lineas.some(l => l.cuenta === '4101' && l.debe > 0) && cuadra(rev), rev);
r = await api('cerrarPeriodo', { mes: mesAnt2, reabrir: true }, C.tok); ok('reabrir otro mes → error', !r.ok && /Solo se puede reabrir/.test(r.error), r.error);
r = await api('cerrarPeriodo', { mes: mesAnt, reabrir: true }, C.tok); ok('reabrir ' + mesAnt + ' → cerrado = ' + mesAnt2, r.ok && r.data.cerrado === mesAnt2, r.error || r.data);
r = await api('guardarGasto', { registro: { categoria: 'Varios', detalle: 'Viejo ok', monto: 10, metodo: 'Efectivo', fechaGasto: mesAnt + '-15' } }, C.tok); ok('reabierto: el gasto del mes anterior ya pasa', r.ok, r.error);
r = await api('guardarGasto', { registro: { categoria: 'Varios', detalle: 'Más viejo', monto: 10, metodo: 'Efectivo', fechaGasto: mesAnt2 + '-15' } }, C.tok); ok('pero ' + mesAnt2 + ' sigue cerrado', !r.ok, r.error);

sec('Contabilidad: conciliación bancaria');
r = await api('contabilidad', { desde: MES + '-01', hasta: HOY }, C.tok); ok('sin conciliación aún', r.data.concil === null, r.data.concil);
r = await api('guardarConcil', { mes: MES, saldoBanco: 1234.5, marcados: ['D' + ventaC1.id, 'Dxyz'], nuevos: [{ tipo: 'comision', monto: 35, detalle: 'Manejo de cuenta' }, { tipo: 'interes', monto: 12.5 }, { tipo: 'otro', monto: 0 }], nota: 'Noviembre', listo: true }, C.tok);
ok('guardarConcil: 2 partidas creadas, marcados y saldo', r.ok && r.data.creados.length === 2 && r.data.concil.saldoBanco === 1234.5 && r.data.concil.marcados.length === 2 && r.data.concil.listo === true && r.data.concil.nota === 'Noviembre', r.error || r.data);
r = await api('contabilidad', { desde: MES + '-01', hasta: HOY }, C.tok); ok('observación: las partidas sin fecha se fechan el día 28 (no salen si «hasta» es hoy)', r.data.asientos.filter(a => a.tipo === 'concil').length === 0);
r = await api('contabilidad', { desde: MES + '-01', hasta: MES + '-30' }, C.tok);
const aCn = r.data.asientos.filter(a => a.tipo === 'concil');
ok('contabilidad trae la conciliación del mes y los asientos concil', r.data.concil && r.data.concil.listo && aCn.length === 2, [r.data.concil, aCn.length]);
ok('comisión: 6105 al debe, banco al haber · interés: banco al debe, 4102 al haber', aCn.some(a => a.lineas.some(l => l.cuenta === '6105' && l.debe === 35) && a.lineas.some(l => l.cuenta === '1102' && l.haber === 35)) && aCn.some(a => a.lineas.some(l => l.cuenta === '1102' && l.debe === 12.5) && a.lineas.some(l => l.cuenta === '4102' && l.haber === 12.5)), aCn.map(a => a.lineas));
r = await api('guardarConcil', { mes: MES, saldoBanco: 2000 }, C.tok); ok('guardar solo el saldo conserva los marcados', r.ok && r.data.concil.saldoBanco === 2000 && r.data.concil.marcados.length === 2 && r.data.concil.listo === false && r.data.creados.length === 0, r.error || r.data.concil);
// cajero no entra a contabilidad
r = await api('guardarUsuario', { registro: { nombre: 'Caja 1', usuario: '38887777', rol: 'cajero', activo: true }, clave: '4321' }, C.tok);
if (r.ok) { const lc = await api('login', { whatsapp: '38887777', pin: '4321' }); if (lc.ok) { r = await api('contabilidad', {}, lc.data.token); ok('cajero no puede ver contabilidad', !r.ok && /permiso/.test(r.error), r.error); } else console.log('· (login de cajero no disponible: ' + lc.error + ')'); } else console.log('· (no se pudo crear cajero: ' + r.error + ')');
// modo soporte tampoco escribe en contabilidad
const verC = (await P('panelVerApp', { id: C.id })).data.token;
r = await api('contabilidad', { desde: MES + '-01', hasta: HOY }, verC); ok('soporte: puede ver la contabilidad', r.ok, r.error);
r = await api('guardarAsiento', { registro: { fecha: HOY, concepto: 'Hack', lineas: [{ cuenta: '1101', debe: 1 }, { cuenta: '3101', haber: 1 }] } }, verC); ok('soporte: guardarAsiento → «Modo soporte»', !r.ok && MSJ.test(r.error), r.error);
r = await api('cerrarPeriodo', { mes: mesAnt }, verC); ok('soporte: cerrarPeriodo → «Modo soporte»', !r.ok && MSJ.test(r.error), r.error);
// al quitar la contabilidad desde el Panel, el negocio pierde el acceso
r = await P('panelAccion', { id: C.id, accion: 'quitarContab' });
r = await api('contabilidad', {}, C.tok); ok('tras quitar Contabilidad en el Panel, C ya no entra', !r.ok && /no está activada/.test(r.error), r.error);
r = await api('compra', { items: [{ productoId: pC.id, cantidad: 1, costo: pC.costo }], metodo: 'Efectivo', fecha: mesAnt2 + '-15' }, C.tok); ok('sin contabilidad, el cierre de mes ya no frena compras', r.ok, r.error);

/* ========== Resumen ========== */
console.log('\n══════════════════════════════');
console.log('Pasadas: ' + pasadas + ' · Fallidas: ' + fallidas);
if (fallos.length) console.log('Fallos:\n - ' + fallos.join('\n - '));
const errLog = logs.filter(l => /error|Error|excepci/i.test(l) && !/ ms /.test(l));
if (errLog.length) console.log('\nLog con errores:\n' + errLog.join('\n'));
console.log('Tablas maestras:', ['Licencias', 'Accesos', 'Seguimiento', 'PagosLic', 'CuotasLic', 'Anuncios', 'Contratos', 'Soporte', 'SoporteMsg', 'GastosPanel', 'Visitas'].map(t => t + ':' + (db.T[t] || []).length).join(' '));
process.exitCode = fallidas ? 1 : 0;
