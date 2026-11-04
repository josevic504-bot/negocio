// Verifica en pantalla las correcciones 1, 5, 11 y las de servidor 3, 4, 7 (con capturas para Vic)
import { nuevaPagina, ok, cerrar, esperar, api, db } from './base.mjs';
import { paso, texto, tiene, btn, dump } from './lib.mjs';
db.props.PANEL_CLAVE = 'clave-panel';
const ptok = (await api('panelLogin', { clave: 'clave-panel' })).data.token;
const reg = await api('registrar', { negocio: 'Multi Prueba', nombre: 'Vic', giro: 'tienda', whatsapp: '98009999', pin: '1234' }); const tok = reg.data.token; await api('cargarEjemplos', {}, tok);
const nid = db.T.Licencias[0].id;
for (const a of [{ accion: 'activar' }, { accion: 'contab' }, { accion: 'plus' }, { accion: 'giros', giros: ['streaming', 'recargas'] }]) { const r = await api('panelAccion', Object.assign({ id: nid }, a), null, { panel: ptok }); if (!r.ok) console.log('   panel', a.accion, r.error); }
const pg = await nuevaPagina({ token: tok, verApi: false });
await pg.goto('http://localhost:8765/'); await esperar(pg, 8000); await pg.waitForTimeout(1500);
try { await pg.texto('Todas', 900); } catch (e) {}
await paso(pg, 'FIX 1 · menú «Más» abre con Contabilidad activada y muestra Contabilidad', async () => { await pg.ir('inicio'); await pg.accion('mas', 800); const t = await texto(pg); await pg.cap('fix1-menu-mas-contabilidad'); await pg.evaluate(() => cerrarHojas()); return /Ayuda y novedades/.test(t) && /Contab/.test(t); });
await paso(pg, 'FIX 11 · aviso de apertura en una sola línea', async () => { await pg.ir('contabilidad'); await pg.cap('fix11-aviso-apertura'); return tiene(pg, /Aún no hay saldos de apertura/); });
await paso(pg, 'FIX 5 · cambiar el giro principal con varias tiendas conserva las 3 secciones', async () => {
  const r = await api('cambiarGiro', { giro: 'streaming' }, tok); if (!r.ok) throw new Error(r.error);
  const act = r.data.girosActivos; const lic = db.T.Licencias[0];
  if (act.length !== 3 || !act.includes('tienda') || act[0] !== 'streaming') throw new Error('activos: ' + act.join(',') + ' · extras: ' + lic.giros);
  const arroz = db.T.Productos.find(p => /Arroz/.test(p.nombre)); if (arroz.giro !== 'tienda') throw new Error('el arroz quedó en giro ' + JSON.stringify(arroz.giro));
  const t = await nuevaPagina({}); await t.goto('http://localhost:8765/?tienda=' + nid); await t.waitForTimeout(2500); await t.cap('fix5-tienda-3-secciones'); const tx = await texto(t); await t.context().close();
  return /3 SECCIONES/i.test(tx) && /Abarrotes/.test(tx) && /Streaming/.test(tx);
});
await paso(pg, 'FIX 7 · Panel: reanudar una licencia Vencida con pago anotado vuelve a Vencida', async () => {
  const r2 = await api('registrar', { negocio: 'Vencido SA', nombre: 'Ana', giro: 'comida', whatsapp: '98008888', pin: '1234' }); const id2 = db.T.Licencias[1].id;
  const l = db.T.Licencias[1]; l.vencePrueba = '2026-10-01'; l.estado = 'Prueba';
  await api('panelPago', { id: id2, monto: 100, concepto: 'Anticipo' }, null, { panel: ptok });
  let a = await api('panelAccion', { id: id2, accion: 'pausar' }, null, { panel: ptok }); if (!a.ok) throw new Error('pausar: ' + a.error);
  a = await api('panelAccion', { id: id2, accion: 'reanudar' }, null, { panel: ptok }); if (!a.ok) throw new Error('reanudar: ' + a.error);
  const est = db.T.Licencias[1].estado; if (est === 'Activa') throw new Error('quedó Activa');
  return /Prueba|Vencida/.test(est);
});
await paso(pg, 'FIX 4 · el cajero no recibe la clave de la cuenta de streaming', async () => {
  const r3 = await api('registrar', { negocio: 'Stream SA', nombre: 'Luis', giro: 'streaming', whatsapp: '98007777', pin: '1234' }); const t3 = r3.data.token;
  await api('guardar', { entidad: 'Cuentas', registro: { plataforma: 'Netflix', nombre: 'Netflix 1', perfiles: 5, correo: 'a@b.c', clave: 'secreta', activo: true } }, t3);
  const uc = await api('guardarUsuario', { registro: { nombre: 'Caja', usuario: '9800-6666', rol: 'cajero', activo: true }, clave: '2222' }, t3); if (!uc.ok) throw new Error(uc.error);
  const lc = await api('login', { whatsapp: '98006666', pin: '2222' }); if (!lc.ok) throw new Error(lc.error);
  const s = await api('suscripciones', {}, lc.data.token); const c = await api('susCuentas', {}, lc.data.token);
  return !JSON.stringify(s.data).includes('secreta') && !JSON.stringify(c.data).includes('secreta');
});
await paso(pg, 'FIX 3 · editar pedido respeta la existencia por talla/color', async () => {
  const r4 = await api('registrar', { negocio: 'Ropa SA', nombre: 'Mia', giro: 'boutique', whatsapp: '98005555', pin: '1234' }); const t4 = r4.data.token; await api('cargarEjemplos', {}, t4);
  const nid4 = db.T.Licencias[db.T.Licencias.length - 1].id;
  const blusa = db.T.Productos.find(p => p.negocio_id === nid4 && /Blusa/.test(p.nombre));
  const V = {}; V['Talla: S, Color: Blanco'] = { s: 1 }; V['Talla: S, Color: Rosa'] = { s: 5 };
  const g = await api('guardar', { entidad: 'Productos', registro: { id: blusa.id, tienda: true, variantes: JSON.stringify(V), stock: 6 } }, t4); if (!g.ok) throw new Error('guardar: ' + g.error);
  const ped = await api('pedir', { nombre: 'Ana', telefono: '99990000', entrega: 'recoger', pago: 'Efectivo', items: [{ id: blusa.id, cantidad: 1, opcion: 'Talla: S, Color: Blanco' }], negocio: nid4, t: nid4 }, null); if (!ped.ok) throw new Error('pedir: ' + ped.error);
  const pid = db.T.Pedidos.find(p => p.negocio_id === nid4).id;
  const e = await api('editarPedido', { id: pid, cantidades: [2], motivo: 'prueba' }, t4);
  return !e.ok && /Solo quedan 1/.test(e.error);
});
await cerrar();
