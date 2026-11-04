// Panel Molina (súper administrador) en pantalla
import { nuevaPagina, ok, cerrar, esperar, api, db } from './base.mjs';
import { paso, texto, tiene, btn, dump } from './lib.mjs';
db.props.PANEL_CLAVE = 'clave-panel';
const toks = [];
for (let i = 1; i <= 3; i++) { const r = await api('registrar', { negocio: 'Cliente ' + i, nombre: 'Dueño ' + i, giro: ['tienda', 'comida', 'streaming'][i - 1], whatsapp: '9600000' + i, pin: '1234' }); toks.push(r.data.token); await api('cargarEjemplos', {}, r.data.token); const b = (await api('bootstrap', {}, r.data.token)).data; await api('venta', { items: [{ productoId: b.productos[0].id, cantidad: 1, precio: b.productos[0].precio }], metodo: 'Efectivo', recibido: 1000, clave: 'Q' + i }, r.data.token); if (i === 2) await api('soporteCrear', { motivo: 'Error del programa', modulo: '🛒 Vender y cobrar', texto: 'No me deja cobrar con tarjeta', version: '1.9.41' }, r.data.token); }
await api('visita', { p: 'negocio', v: 'v1', o: 'tiktok' });
const pg = await nuevaPagina({ pc: true });
await pg.goto('http://localhost:8765/?panel'); await pg.waitForTimeout(1500);
await paso(pg, 'Panel · clave incorrecta se rechaza', async () => { await pg.fill('#pn-clave', 'mala'); await btn(pg, 'Entrar', 1000); return !(await tiene(pg, /Dashboard/)) && (await tiene(pg, /incorrecta|Clave/)); });
await paso(pg, 'Panel · entra con la clave y muestra el Dashboard (KPIs, pendientes)', async () => { await pg.fill('#pn-clave', 'clave-panel'); await btn(pg, 'Entrar', 2500); return tiene(pg, /Dashboard.*En prueba 3.*Soporte sin leer/); });
await pg.cap('panel-dashboard');
const volver = async () => { await pg.evaluate(() => { try { cerrarHojas(); } catch (e) {} }); await pg.waitForTimeout(400); if (await pg.evaluate(() => !![...document.querySelectorAll('[data-a=panelInicio]')].find(e => e.getBoundingClientRect().width > 0))) await pg.accion('panelInicio', 1200); };
const tab = async k => { await pg.tocar(`[data-a=panelTab][data-k="${k}"]:not([data-f])`, 1200); };
await paso(pg, 'Panel · Clientes: lista ordenada por recientes con fecha de registro y filtros', async () => { await tab('cli'); await pg.tocar('[data-a=panelFiltro][data-k=""]', 800); const t = await texto(pg); await pg.cap('panel-clientes'); return /Cliente 3.*Cliente 2.*Cliente 1/.test(t) && /Ordenar: recientes/i.test(t) && /3 nov/.test(t); });
await paso(pg, 'Panel · filtro «Sin vender 7 días» y búsqueda', async () => { await pg.tocar('[data-a=panelFiltro][data-k="sin"]', 800); const t1 = await texto(pg); await pg.tocar('[data-a=panelFiltro][data-k=""]', 600); await pg.fill('#pn-q', 'Dueño 3'); await pg.waitForTimeout(600); const t2 = await texto(pg); await pg.fill('#pn-q', ''); await pg.waitForTimeout(400); return /0 NEGOCIO|Ning|No hay/i.test(t1) && /Cliente 3/.test(t2) && !/Cliente 1/.test(t2); });
await paso(pg, 'Panel · ficha del cliente (uso, última venta, licencia, acciones)', async () => { await pg.texto('Cliente 1', 1200); await pg.cap('panel-tarjeta'); await pg.clic('[data-a=panelVer]'); await pg.waitForTimeout(1500); await pg.cap('panel-ficha'); const t = await texto(pg); const d2 = await dump(pg); console.log('     [ficha] ' + d2.slice(-1500)); if (!/Dueño 1/.test(t)) throw new Error(t.slice(0, 300)); return /Activar/.test(t); });
await paso(pg, 'Panel · activar licencia con pago anotado', async () => {
  await pg.clic('[data-x="activar"]'); await pg.waitForTimeout(800);
  const d = await dump(pg); console.log('     [activar] ' + d.slice(-900));
  const m = pg.locator('input[inputmode=decimal], #pf-monto, #pg-m').first(); if (await m.count()) await m.fill('3000');
  await btn(pg, /Activar|Guardar|Confirmar|Aceptar/, 1500);
  const l = db.T.Licencias.find(x => x.negocio === 'Cliente 1');
  if (l.estado !== 'Activa') throw new Error('estado ' + l.estado + ' · ' + (await texto(pg)).slice(0, 150));
  return db.T.PagosLic.length >= 1;
});
await pg.cap('panel-activada');
await paso(pg, 'Panel · nota de seguimiento y etiqueta', async () => {
  await pg.fill('#pn-notas', 'Llamé y quedó contento'); await pg.clic('[data-x="nota"]'); await pg.waitForTimeout(1000);
  await pg.clic('[data-x="etiqueta"][data-e="Interesado"]'); await pg.waitForTimeout(1000);
  const l = db.T.Licencias.find(x => x.negocio === 'Cliente 1');
  if (!/contento/.test(JSON.stringify(l) + JSON.stringify(db.T.Seguimiento || []))) throw new Error('nota no guardada: ' + JSON.stringify(l).slice(0, 200));
  return /Interesado/.test(l.etiqueta || l.etiquetas || JSON.stringify(l));
});
await paso(pg, 'Panel · Soporte: ver el mensaje del cliente y responder', async () => {
  await volver(); await pg.accion('panelSoporteLista', 1200); const t = await texto(pg); await pg.cap('panel-soporte');
  if (!/cobrar con tarjeta/.test(t)) throw new Error('no aparece el mensaje');
  await pg.clic('[data-a=panelSoporteVer]'); await pg.waitForTimeout(800);
  const d = await dump(pg); console.log('     [soporte] ' + d.slice(-700));
  await pg.fill('#pc-in', 'Revisa que la tarjeta esté habilitada en Ajustes.');
  await pg.evaluate(() => { const ta = document.getElementById('pc-in'); const b = ta.parentElement.querySelector('button') || [...document.querySelectorAll('button')].filter(x => x.getBoundingClientRect().width > 0 && !x.innerText.trim() && !x.dataset.a && !x.dataset.cerrar).pop(); b && b.click(); });
  await pg.waitForTimeout(1200);
  const sp = (db.T.Soporte || []).concat(db.T.SoporteMsj || []);
  return JSON.stringify(db.T).includes('habilitada en Ajustes');
});
await pg.cap('panel-soporte-resp');
await paso(pg, 'Panel · Marketing: visitas por canal, gastos y vendedores', async () => { await volver(); await tab('mkt'); await pg.waitForTimeout(1200); const t = await texto(pg); await pg.cap('panel-marketing'); return /tiktok|TikTok|Visitas/i.test(t); });
await paso(pg, 'Panel · Gastos: registrar un gasto de publicidad en dólares', async () => {
  await volver(); await tab('mkt'); await pg.tocar('[data-a=panelGastosLista]', 1000); await pg.accion('panelGasto', 800);
  const d = await dump(pg); console.log('     [gasto panel] ' + d.slice(-1200));
  await pg.clic('button[data-t="publicidad"]'); await pg.clic('button[data-m="USD"]'); await pg.fill('#g-n1', 'Prueba 7 días'); await pg.fill('#g-d', '2026-11-01'); await pg.fill('#g-h', '2026-11-03'); await pg.fill('#g-m', '31.51');
  await pg.cap('panel-gasto-form'); await btn(pg, 'Guardar gasto', 1500);
  const g = (db.T.PanelGastos || db.T.Gastos_Panel || []).concat(); const todo = JSON.stringify(db.T);
  if (!/31\.51/.test(todo)) throw new Error('gasto no grabado');
  await pg.cap('panel-gastos'); return tiene(pg, /Prueba 7 días/);
});
await paso(pg, 'Panel · Respaldos', async () => { await volver(); await tab('resp'); await pg.waitForTimeout(1200); await pg.cap('panel-respaldos'); return !(await tiene(pg, /No se pudo cargar/)); });
await paso(pg, 'Panel · ver la app del cliente en modo soporte (solo lectura)', async () => {
  await volver(); await tab('cli');
  const r = await api('panelVerApp', { id: db.T.Licencias.find(x => x.negocio === 'Cliente 2').id }, null, { panel: (await api('panelLogin', { clave: 'clave-panel' })).data.token });
  if (!r.ok) throw new Error(r.error);
  const s = await nuevaPagina({}); await s.goto('http://localhost:8765/?soporte=' + (r.data.token || r.data)); await esperar(s, 8000); await s.waitForTimeout(1500);
  const t = await texto(s); await s.cap('modo-soporte');
  await s.ir('productos'); await s.accion('nuevoProducto'); await s.fill('#pf-nom', 'Prueba soporte'); await s.fill('#pf-precio', '10'); await btn(s, /Guardar/, 1000);
  const t2 = await texto(s); await s.cap('modo-soporte-bloqueo'); await s.context().close();
  if (db.T.Productos.some(p => p.nombre === 'Prueba soporte')) throw new Error('el modo soporte pudo guardar');
  return /Cliente 2/.test(t) && /Modo soporte|solo puedes ver/i.test(t2 + t);
});
await paso(pg, 'Panel · salir cierra la sesión del panel', async () => { await pg.accion('panelSalir', 1200); const c = pg.locator('button', { hasText: /Salir|Sí/ }); if (await c.count()) await btn(pg, /Salir|Sí|Aceptar/, 1000); return tiene(pg, /Clave del panel/); });
await cerrar();
