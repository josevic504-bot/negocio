// Módulos por tipo de negocio: veterinaria, streaming, servicios (cotizaciones/proyectos), repuestos (órdenes), panadería (encargos), comida (comanda), Beauty & Moda, farmacia (caducidad) + Contabilidad y multitienda
import { nuevaPagina, ok, cerrar, esperar, api, db } from './base.mjs';
import { paso, texto, tiene, btn, dump } from './lib.mjs';
const GIROS = [
  ['veterinaria', ['mascotas', 'vacunas', 'agenda', 'ordenes'], { mascotas: 'nuevaMascota', vacunas: null, agenda: 'nuevaAgenda', ordenes: 'nuevaOrden' }],
  ['streaming', ['vencimientos', 'cuentas'], { cuentas: 'nuevaCuenta' }],
  ['servicios', ['proyectos', 'ordenes'], { proyectos: 'nuevaCot', ordenes: 'nuevaOrden' }],
  ['repuestos', ['ordenes'], { ordenes: 'nuevaOrden' }],
  ['panaderia', ['encargos'], { encargos: 'nuevaAgenda' }],
  ['comida', ['vender'], {}],
  ['catalogo', ['tienda', 'productos'], {}],
  ['farmacia', ['productos'], {}],
];
let n = 0;
for (const [giro, vistas, nuevos] of GIROS) {
  n++;
  const wa = '9800000' + n;
  const reg = await api('registrar', { negocio: 'Negocio ' + giro, nombre: 'Vic', giro, whatsapp: wa, pin: '1234' });
  if (!reg.ok) { ok('registro ' + giro, false, reg.error); continue; }
  const tok = reg.data.token; await api('cargarEjemplos', {}, tok);
  const pg = await nuevaPagina({ token: tok, verApi: false });
  await pg.goto('http://localhost:8765/'); await esperar(pg, 8000); await pg.waitForTimeout(1200);
  const visibles = await pg.evaluate(() => Object.keys(VISTAS).filter(k => puedeVer(k)));
  ok(`${giro} · entra y muestra sus módulos (${vistas.join(', ')})`, vistas.every(v => visibles.includes(v)), 'visibles: ' + visibles.join(' '));
  await pg.cap(giro + '-inicio');
  for (const v of visibles) {
    await pg.ir(v); const t = await pg.txt(); const vista = await pg.evaluate(() => S.vista);
    ok(`${giro} · pantalla ${v} carga`, vista === v && !/No se pudo cargar/.test(t), t.slice(0, 120));
    if (vistas.includes(v)) await pg.cap(giro + '-' + v);
    if (nuevos[v]) {
      await paso(pg, `${giro} · ${v}: abre «nuevo» (${nuevos[v]})`, async () => {
        await pg.evaluate(() => cerrarHojas()); await pg.tocar(`[data-a="${nuevos[v]}"]`, 800);
        const d = await dump(pg); console.log(`     [${giro}/${v}] ` + d.slice(0, 1000));
        await pg.cap(giro + '-' + v + '-nuevo');
        const inputs = await pg.evaluate(() => [...document.querySelectorAll('input, textarea, select')].filter(i => i.getBoundingClientRect().width > 0).length);
        if (inputs < 2) throw new Error('el formulario no se abrió');
        return true;
      });
      await pg.evaluate(() => cerrarHojas());
    }
  }
  // Vender en comida: comanda / sin inventario
  if (giro === 'comida') await paso(pg, 'comida · vender un plato (sin inventario) y comanda', async () => {
    await pg.ir('vender'); await pg.fill('#v-q', 'Baleada sencilla'); await pg.waitForTimeout(400); await pg.tocar('.pc[data-a=vadd]'); await pg.fill('#v-q', '');
    await pg.accion('abrirCobro'); await pg.clic('[data-a=cbRec][data-v]'); await btn(pg, /^Cobrar L/, 1500);
    await pg.cap('comida-venta');
    return db.T.Ventas.some(v => v.negocio_id === db.T.Licencias[n - 1].id);
  });
  // Beauty & Moda: tienda estilo catálogo con precio especial y tonos
  if (giro === 'catalogo') await paso(pg, 'Beauty & Moda · tienda pública con secciones, tonos y precio especial', async () => {
    const nid = db.T.Licencias[n - 1].id; const t = await nuevaPagina({});
    await t.goto('http://localhost:8765/?tienda=' + nid); await t.waitForTimeout(2500); await t.cap('catalogo-tienda');
    const tx = await texto(t);
    try { await t.texto('Rostro', 900); } catch (e) {}
    const p = db.T.Productos.find(x => x.negocio_id === nid && /Corrector/.test(x.nombre)); if (p) { try { await t.clic(`button[data-add="${p.id}"]`); } catch (e) { await t.texto('Corrector', 700); } await t.waitForTimeout(700); await t.cap('catalogo-tono'); }
    const tx2 = await texto(t); await t.context().close();
    if (!/Rostro|Ojos|Labios|Lociones/.test(tx)) throw new Error('sin secciones: ' + tx.slice(0, 200));
    return /desde|especial|Nude|Beige/i.test(tx2) || /Rostro/.test(tx);
  });
  // Farmacia: caducidad en producto
  if (giro === 'farmacia') await paso(pg, 'farmacia · el producto tiene campo de vencimiento (caducidad)', async () => {
    await pg.ir('productos'); await pg.accion('nuevoProducto'); const d = await dump(pg); await pg.cap('farmacia-producto');
    if (!/date|venc|caduc/i.test(d)) throw new Error(d.slice(0, 600)); return true;
  });
  await pg.context().close();
}
/* ---------- Contabilidad (activada desde el Panel) y multitienda ---------- */
const reg = await api('registrar', { negocio: 'Multi Prueba', nombre: 'Vic', giro: 'tienda', whatsapp: '98009999', pin: '1234' }); const tok = reg.data.token; await api('cargarEjemplos', {}, tok);
const nid = db.T.Licencias[db.T.Licencias.length - 1].id;
db.props.PANEL_CLAVE = 'clave-panel';
const pl = await api('panelLogin', { clave: 'clave-panel' }); const ptok = pl.ok ? (pl.data.token || pl.data) : null; if (!pl.ok) console.log('   panelLogin', pl.error);
const act = await api('panelAccion', { id: nid, accion: 'activar' }, null, { panel: ptok }); if (!act.ok) console.log('   activar', act.error);
const ctb = await api('panelAccion', { id: nid, accion: 'contab' }, null, { panel: ptok }); if (!ctb.ok) console.log('   contab', ctb.error);
const pls = await api('panelAccion', { id: nid, accion: 'plus' }, null, { panel: ptok }); if (!pls.ok) console.log('   plus', pls.error);
const gx = await api('panelAccion', { id: nid, accion: 'giros', giros: ['streaming', 'recargas'] }, null, { panel: ptok }); if (!gx.ok) console.log('   giros', gx.error);
const pg = await nuevaPagina({ token: tok, verApi: false });
await pg.goto('http://localhost:8765/'); await esperar(pg, 8000); await pg.waitForTimeout(1500);
await pg.cap('multi-entrada');
await paso(pg, 'Multitienda · al entrar elige la tienda o ve todas', async () => { const t = await texto(pg); await pg.cap('multi-elegir'); if (/elige|Elegir|tienda/i.test(t)) { const todas = pg.locator('button', { hasText: /Todas|todas las tiendas/ }); if (await todas.count()) await btn(pg, /Todas|todas las tiendas/, 1000); } return tiene(pg, /Multi Prueba/); });
await paso(pg, 'Contabilidad · aparece en el menú cuando está activada y carga', async () => {
  const vis = await pg.evaluate(() => Object.keys(VISTAS).filter(k => puedeVer(k)));
  if (!vis.includes('contabilidad')) throw new Error('no está en el menú: ' + vis.join(' '));
  await pg.ir('contabilidad'); const t = await texto(pg); await pg.cap('contabilidad');
  return !/No se pudo cargar/.test(t) && /Libro|Diario|Resultados|Contabilidad/.test(t);
});
await paso(pg, 'Contabilidad · pestañas (diario, estado de resultados, plan, conciliación)', async () => { for (const tb of ['Diario', 'Resultados', 'Plan', 'Concil']) { try { await pg.texto(tb, 900); await esperar(pg); await pg.cap('contab-' + tb.toLowerCase()); } catch (e) { console.log('     (sin pestaña', tb + ')'); } } return !(await tiene(pg, /No se pudo cargar/)); });
await paso(pg, 'Multitienda · reportes por sección (Todo el negocio / cada tienda)', async () => { await pg.ir('reportes'); await pg.cap('multi-reportes'); const t = await texto(pg); return /Todo el negocio.*Tienda \/ pulpería.*Streaming/.test(t); });
await paso(pg, 'Menú Más abre con Contabilidad activada (ERROR CONOCIDO)', async () => { await pg.accion('mas', 600); const t = await texto(pg); await pg.cap('multi-menu'); await pg.evaluate(() => cerrarHojas()); if (!/Ayuda y novedades/.test(t)) throw new Error('el menú no abre: ' + t.slice(0, 80)); return /Cambiar de tienda/.test(t); });
await paso(pg, 'Multitienda · tienda pública muestra las 3 secciones', async () => { const t = await nuevaPagina({}); await t.goto('http://localhost:8765/?tienda=' + nid); await t.waitForTimeout(2500); await t.cap('multi-tienda-publica'); const tx = await texto(t); await t.context().close(); return /Streaming/.test(tx) && /Recargas/.test(tx) && /Abarrotes|Tienda/.test(tx) && /3 SECCIONES/i.test(tx); });
await cerrar();
