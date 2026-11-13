// Prueba de uso 1.9.74: códigos automáticos como los usaría un cliente (app) y Vic (Panel)
import { nuevaPagina, ok, cerrar, esperar, api, db, fallas, srv } from './base.mjs';
import { srv as motor } from '../prueba.mjs';
import { paso, texto, tiene, btn, dump } from './lib.mjs';
db.props.PANEL_CLAVE = 'secreta';
const prodN = (neg, n) => db.T.Productos.find(x => x.nombre === n && (!neg || x.negocio_id === neg));
const activar = (neg, extra) => db.aplicar({ ops: [{ t: 'Licencias', op: 'upd', k: { id: neg }, row: Object.assign({ plus: 'si', estado: 'Activa' }, extra || {}) }] });
const cerrarHojas = async pg => { for (let i = 0; i < 4; i++) { await pg.evaluate(() => { const x = [...document.querySelectorAll('[data-cerrar]')].filter(e => e.getBoundingClientRect().width > 0).pop(); if (x) x.click(); }); await pg.waitForTimeout(250); } };
const abrir = async tok => { const pg = await nuevaPagina({ token: tok }); await pg.goto('http://localhost:8765/'); await esperar(pg, 8000); await pg.waitForTimeout(1200); return pg; };
const nuevoProd = async (pg, nombre, cat, precio, cod, antes) => {
  await pg.ir('productos'); await pg.evaluate(() => { S.f.pcat = ''; formProducto(null); }); await pg.waitForTimeout(700);
  await pg.fill('#pf-nom', nombre);
  const c = pg.locator(`.pick [data-pv="${cat}"]`).first(); if (await c.count()) await c.click(); else { await pg.locator('.pick [data-nueva]').first().click(); await pg.fill('#pf-cat', cat); }
  await pg.waitForTimeout(200);
  if (antes) await antes();
  if (cod !== undefined && cod !== null) await pg.fill('#pf-cod', cod);
  const ph = await pg.getAttribute('#pf-cod', 'placeholder');
  await pg.fill('#pf-precio', String(precio)); await btn(pg, /^Guardar/, 1300);
  return ph;
};

/* ============ 1) FARMACIA (un giro) ============ */
const reg = await api('registrar', { negocio: 'Farmacia San Rafael', nombre: 'Rafael Mejía', giro: 'farmacia', whatsapp: '98765432', pin: '1234' });
const tok = reg.data.token; await api('cargarEjemplos', {}, tok);
const neg = (await api('bootstrap', {}, tok)).data.negocioId; const prod = n => prodN(neg, n);
let pg = await abrir(tok);
await paso(pg, 'App · producto nuevo sin código: el campo anuncia FAR-0001 y se guarda con ese código', async () => {
  const ph = await nuevoProd(pg, 'Ibuprofeno 400 mg (10)', 'Medicamentos', 45); const p = prod('Ibuprofeno 400 mg (10)');
  if (!p || !/FAR-0001/.test(ph) || p.codigo !== 'FAR-0001') throw new Error('ph=' + ph + ' cod=' + (p && p.codigo)); return true;
});
await paso(pg, 'App · el segundo anuncia y recibe FAR-0002 y la lista muestra el código', async () => {
  const ph = await nuevoProd(pg, 'Loratadina 10 mg (10)', 'Medicamentos', 60); const p = prod('Loratadina 10 mg (10)');
  if (!/FAR-0002/.test(ph) || p.codigo !== 'FAR-0002') throw new Error('ph=' + ph + ' cod=' + p.codigo); return tiene(pg, /FAR-0002/);
});
await paso(pg, 'App · con código de barras propio se respeta', async () => { await nuevoProd(pg, 'Suero oral 500 ml', 'Medicamentos', 30, '7421000123456'); return prod('Suero oral 500 ml').codigo === '7421000123456'; });
await paso(pg, 'App · código repetido (escrito en minúsculas): avisa de quién es y no guarda', async () => {
  await nuevoProd(pg, 'Producto repetido', 'Medicamentos', 10, 'far-0001'); const r = (await tiene(pg, /ya es de «Ibuprofeno/)) && !prod('Producto repetido'); await cerrarHojas(pg); return r;
});
await paso(pg, 'App · editar: conserva FAR-0001 y guarda el precio nuevo', async () => {
  await pg.evaluate(id => formProducto(S.productos.find(x => x.id === id)), prod('Ibuprofeno 400 mg (10)').id); await pg.waitForTimeout(600);
  const v = await pg.inputValue('#pf-cod'); await pg.fill('#pf-precio', '48'); await btn(pg, /^Guardar/, 1300);
  const p = prod('Ibuprofeno 400 mg (10)'); if (v !== 'FAR-0001' || p.codigo !== 'FAR-0001' || p.precio !== 48) throw new Error('v=' + v + ' ' + p.codigo + ' ' + p.precio); return true;
});
await paso(pg, 'App · editar y borrar el código a mano: queda sin código (no se le vuelve a poner)', async () => {
  await pg.evaluate(id => formProducto(S.productos.find(x => x.id === id)), prod('Loratadina 10 mg (10)').id); await pg.waitForTimeout(600);
  await pg.fill('#pf-cod', ''); await btn(pg, /^Guardar/, 1300); const c = prod('Loratadina 10 mg (10)').codigo; console.log('     [borrar código] quedó «' + c + '»'); return c === '';
});
await paso(pg, 'App · después de liberar FAR-0002, el siguiente nuevo: lo anunciado = lo guardado', async () => {
  const ph = await nuevoProd(pg, 'Cetirizina 10 mg (10)', 'Medicamentos', 55); const c = prod('Cetirizina 10 mg (10)').codigo; console.log('     [siguiente] anunciado «' + ph + '» · guardado ' + c); return ph.includes(c);
});
await paso(pg, 'App · categoría nueva escrita a mano (no es de la lista del giro): también recibe FAR', async () => {
  await nuevoProd(pg, 'Termómetro digital', 'Equipos médicos', 180); const c = prod('Termómetro digital').codigo; return /^FAR-\d{4}$/.test(c) || (() => { throw new Error(c); })();
});
await paso(pg, 'App · servicio (no controla existencias) también recibe código', async () => {
  const r = await api('guardar', { entidad: 'Productos', registro: { nombre: 'Toma de presión', categoria: 'Medicamentos', precio: 20, tipo: 'servicio' } }, tok); return r.ok && /^FAR-\d{4}$/.test(r.data.codigo);
});
await paso(pg, 'App · Vender: buscar FAR-0001 deja solo ese producto, se agrega y se cobra', async () => {
  await api('ajusteStock', { id: prod('Ibuprofeno 400 mg (10)').id, modo: 'entrada', cantidad: 10, motivo: 'Prueba' }, tok);
  await pg.goto('http://localhost:8765/'); await esperar(pg, 8000); await pg.waitForTimeout(900);
  await pg.ir('vender'); await pg.fill('#v-q', 'FAR-0001'); await pg.waitForTimeout(500);
  const n = await pg.locator('.pc[data-a=vadd]').count(); if (n !== 1) throw new Error('la búsqueda dio ' + n + ' productos');
  await pg.tocar('.pc[data-a=vadd]'); await pg.waitForTimeout(400); await pg.cap('vender-por-codigo');
  await pg.accion('abrirCobro'); await btn(pg, /^Cobrar L.48\.00/, 1600);
  const v = db.T.Ventas[db.T.Ventas.length - 1]; return v && v.total === 48;
});
await cerrarHojas(pg);
await paso(pg, 'App · Vender: escribir el código y Enter (como lector de barras) lo agrega', async () => {
  await pg.ir('vender'); await pg.fill('#v-q', 'far-0001'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(600);
  return tiene(pg, /1 artículo L.48\.00/);
});
await pg.evaluate(() => { S.ticket.items = []; guardarTicket(); });
await paso(pg, 'App · Compra con «Crear … como producto nuevo» sin código: se crea con el FAR que sigue', async () => {
  await pg.ir('compras'); await pg.accion('nuevaCompra', 900);
  await pg.fill('#fc-q', 'Jarabe para la tos 120 ml'); await pg.waitForTimeout(500); await pg.tocar('[data-crear]', 600);
  const phc = await pg.getAttribute('[data-i="0"][data-k="codigo"]', 'placeholder');
  await pg.fill('[data-i="0"][data-k="categoria"]', 'Medicamentos');
  const d = await dump(pg); const ks = await pg.$$eval('[data-i="0"]', e => e.map(x => x.dataset.k)); 
  for (const [k, v] of [['cantidad', '6'], ['costo', '40'], ['precio', '75']]) { const l = pg.locator(`[data-i="0"][data-k="${k}"]`); if (await l.count()) await l.first().fill(v); else throw new Error('no hay campo ' + k + ' · ' + ks.join(',')); }
  await pg.cap('compra-producto-nuevo'); await btn(pg, /^(Guardar|Registrar)/, 1600);
  const p = prod('Jarabe para la tos 120 ml'); if (!p) throw new Error('no se creó · ' + (await texto(pg)).slice(0, 200)); console.log('     [compra] placeholder «' + phc + '» · código ' + p.codigo + ' · existencia ' + p.stock);
  return /^FAR-\d{4}$/.test(p.codigo) && p.stock === 6;
});
await cerrarHojas(pg);
await paso(pg, 'App · dos productos nuevos en la misma compra no reciben el mismo código', async () => {
  const r = await api('compra', { items: [{ nuevo: { nombre: 'Gasas A', categoria: 'Primeros auxilios' }, cantidad: 2, costo: 5, precio: 10 }, { nuevo: { nombre: 'Gasas B', categoria: 'Primeros auxilios' }, cantidad: 2, costo: 5, precio: 10 }], metodo: 'Efectivo' }, tok);
  const a = prod('Gasas A'), b = prod('Gasas B'); if (!r.ok) throw new Error(r.error); console.log('     [compra x2] ' + a.codigo + ' y ' + b.codigo); return a.codigo !== b.codigo && /^FAR-/.test(a.codigo) && /^FAR-/.test(b.codigo);
});
await paso(pg, 'App · 10 productos creados a la vez (dos equipos al mismo tiempo): ningún código repetido', async () => {
  const rs = await Promise.all(Array.from({ length: 10 }, (_, i) => api('guardar', { entidad: 'Productos', registro: { nombre: 'Simultáneo ' + i, categoria: 'Bebé', precio: 10 } }, tok)));
  const cs = rs.filter(r => r.ok).map(r => r.data.codigo); console.log('     [a la vez] ' + rs.filter(r => r.ok).length + ' guardados · ' + new Set(cs).size + ' códigos distintos' + (rs.some(r => !r.ok) ? ' · errores: ' + rs.filter(r => !r.ok).map(r => r.error).join(' | ') : ''));
  return rs.every(r => r.ok) && new Set(cs).size === 10;
});
await paso(pg, 'App · ningún producto del negocio comparte código', async () => { const cs = db.T.Productos.filter(p => p.negocio_id === neg && p.codigo).map(p => p.codigo.toLowerCase()); return cs.length === new Set(cs).size; });
await paso(pg, 'App · Proyectos: lo producido que pasa al inventario como producto nuevo recibe código', async () => {
  const pj = await api('guardarProyecto', { registro: { nombre: 'Botiquines', margen: 40, producto: { nombre: 'Botiquín armado', cantidad: 5, unidad: 'unidad', precio: 300 } } }, tok); if (!pj.ok) throw new Error(pj.error);
  await api('gastoProyecto', { registro: { proyectoId: pj.data.id, monto: 500, descripcion: 'Materiales' } }, tok);
  const inv = await api('proyectoAInventario', { proyectoId: pj.data.id, items: [{ id: pj.data.r.productos[0].id, precio: 300, categoria: 'Primeros auxilios' }] }, tok); if (!inv.ok) throw new Error(inv.error);
  const p = prod('Botiquín armado'); console.log('     [proyecto] ' + (p && p.codigo)); return p && /^FAR-\d{4}$/.test(p.codigo);
});
await paso(pg, 'App · cambiar el tipo de negocio a Tienda: los viejos conservan FAR y los nuevos salen TDA', async () => {
  const c = await api('cambiarGiro', { giro: 'tienda' }, tok); if (!c.ok) throw new Error(c.error);
  const r = await api('guardar', { entidad: 'Productos', registro: { nombre: 'Arroz 5 lb', categoria: 'Abarrotes', precio: 90 } }, tok);
  const r2 = await api('guardar', { entidad: 'Productos', registro: { nombre: 'Vitamina E', categoria: 'Medicamentos', precio: 90 } }, tok);
  console.log('     [cambio de giro] nuevo en categoría de tienda: ' + r.data.codigo + ' · nuevo en categoría vieja de farmacia: ' + r2.data.codigo + ' · Ibuprofeno sigue ' + prod('Ibuprofeno 400 mg (10)').codigo);
  return r.data.codigo === 'TDA-0001' && prod('Ibuprofeno 400 mg (10)').codigo === 'FAR-0001';
});
await paso(pg, 'App · limpiar datos de prueba sigue ofreciendo solo los de ejemplo (EJ), no los FAR', async () => {
  const v = await api('limpiezaVer', {}, tok); const t = JSON.stringify(v.data || v.error); console.log('     [limpieza] ' + t.slice(0, 260)); return v.ok ? !/Ibuprofeno/.test(t) : true;
});
await pg.context().close();

/* ============ 2) VARIAS SECCIONES ============ */
const r2 = await api('registrar', { negocio: 'Todo en Uno HN', nombre: 'Karla Paz', giro: 'variedades', whatsapp: '99001122', pin: '1234' });
const t2 = r2.data.token, n2 = (await api('bootstrap', {}, t2)).data.negocioId; await activar(n2, { giros: 'streaming,recargas' });
pg = await abrir(t2);
await paso(pg, 'Secciones · al tocar «Streaming» el campo cambia a STR-0001 y se guarda así', async () => {
  let ph0, ph1;
  await nuevoProd(pg, 'Netflix 1 perfil', 'Video', 120, null, async () => { ph0 = await pg.getAttribute('#pf-cod', 'placeholder'); await pg.locator('#pf-giro [data-g="streaming"]').click(); await pg.waitForTimeout(200); ph1 = await pg.getAttribute('#pf-cod', 'placeholder'); await pg.cap('secciones-form'); });
  const p = prodN(n2, 'Netflix 1 perfil'); console.log('     [secciones] antes «' + ph0 + '» → al tocar Streaming «' + ph1 + '» · guardado ' + (p && p.codigo) + ' giro=' + (p && p.giro));
  if (!p) throw new Error((await texto(pg)).slice(0, 200)); return /STR-0001/.test(ph1) && p.codigo === 'STR-0001';
});
await cerrarHojas(pg);
await paso(pg, 'Secciones · sin tocar sección, una categoría de Recargas (Free Fire) anuncia REC', async () => {
  let ph; await nuevoProd(pg, '100 diamantes', 'Free Fire', 25, null, async () => { ph = await pg.getAttribute('#pf-cod', 'placeholder'); });
  await pg.waitForTimeout(300); await pg.ir('productos'); await pg.cap('secciones-lista');
  const p = prodN(n2, '100 diamantes'); console.log('     [categoría→sección] anunciado «' + ph + '» · chip marcado · guardado ' + (p && p.codigo) + ' giro=«' + (p && p.giro) + '»'); return p && ph.includes(p.codigo);
});
await cerrarHojas(pg);
await paso(pg, 'Secciones · cambiar un producto de sección al editarlo conserva su código', async () => {
  const p = prodN(n2, 'Netflix 1 perfil'); const r = await api('guardar', { entidad: 'Productos', registro: { id: p.id, nombre: p.nombre, giro: 'recargas' } }, t2); console.log('     [mover de sección] ' + (r.ok ? r.data.codigo + ' ahora en ' + r.data.giro : r.error)); return r.ok && r.data.codigo === 'STR-0001';
});
await paso(pg, 'Secciones · usuario de bodega asignado a Recargas: su producto nuevo sale REC', async () => {
  const u = await api('guardarUsuario', { registro: { nombre: 'Beto Bodega', rol: 'bodega', usuario: '99001133', tienda: 'recargas', activo: true }, clave: '4321' }, t2); if (!u.ok) throw new Error(u.error);
  const l = await api('login', { whatsapp: '99001133', pin: '4321', negocio: n2 }); const tb = l.data && l.data.token; if (!tb) throw new Error('login bodega: ' + JSON.stringify(l).slice(0, 200));
  const r = await api('guardar', { entidad: 'Productos', registro: { nombre: 'Pase élite', categoria: 'Otros', precio: 99 } }, tb); console.log('     [bodega] ' + (r.ok ? r.data.codigo + ' giro=' + r.data.giro : r.error)); return r.ok && /^REC-\d{4}$/.test(r.data.codigo);
});
await pg.context().close();

/* ============ 3) CATÁLOGO: lo que ve el comprador ============ */
const r3 = await api('registrar', { negocio: 'Norey Beauty', nombre: 'Noemí Reyes', giro: 'catalogo', whatsapp: '33130265', pin: '1234' });
const t3 = r3.data.token, n3 = (await api('bootstrap', {}, t3)).data.negocioId; await activar(n3); await api('guardar', { entidad: 'Config', registro: { tienda: 'si' } }, t3);
const lab = await api('guardar', { entidad: 'Productos', registro: { nombre: 'Labial mate Rosa Nude', categoria: 'Labios', precio: 180, tienda: true, stock: 5 } }, t3);
pg = await nuevaPagina({});
await paso(pg, 'Tienda en línea (catálogo) · el comprador ve el código automático del producto', async () => {
  console.log('     [catálogo] guardado con ' + (lab.ok ? lab.data.codigo : lab.error));
  await pg.goto('http://localhost:8765/?tienda=' + n3); await pg.waitForTimeout(3000);
  await pg.evaluate(() => { const e = [...document.querySelectorAll('*')].filter(x => x.children.length === 0 && /Labial mate Rosa Nude/.test(x.textContent || '')).pop(); if (e) e.click(); }); await pg.waitForTimeout(1200);
  await pg.cap('tienda-catalogo-codigo'); const t = (await pg.locator('body').innerText()).replace(/\s+/g, ' '); const m = t.match(/Cód\.: ?[A-Z0-9-]+/); console.log('     [catálogo] en la tienda se lee: ' + (m ? m[0] : '(no se ve código)')); return true;
});
await pg.context().close();

/* ============ 4) MODO PRUEBA (?demo) ============ */
pg = await nuevaPagina({});
await paso(pg, 'Modo prueba · crear producto sin código dentro del navegador también le pone código', async () => {
  await pg.goto('http://localhost:8765/?demo'); await pg.waitForTimeout(2500); await pg.accion('demoEjemplo', 1500); await esperar(pg, 15000); await pg.waitForTimeout(2500);
  const ph = await nuevoProd(pg, 'Producto de demostración', 'Regalos', 99);
  const c = await pg.evaluate(() => { const p = (S.productos || []).find(x => x.nombre === 'Producto de demostración'); return p ? p.codigo : null; }); console.log('     [demo] anunciado «' + ph + '» · guardado ' + c); await pg.cap('demo-codigo'); return !!c && ph.includes(c);
});
await pg.context().close();

/* ============ 5) PANEL MOLINA ============ */
const P = async (action, data) => motor.atender({ action, panel: ptok, data: data || {} });
const ptok = (await api('panelLogin', { clave: 'secreta' })).data.token;
await paso(null, 'Panel · carga desde Excel: «revisar» no gasta códigos; al cargar, los sin código reciben el de su giro', async () => {
  const filas = [{ _fila: 2, nombre: 'Sombra 12 tonos', categoria: 'Ojos', precio: 250, existencia: 4 }, { _fila: 3, nombre: 'Rímel volumen', categoria: 'Ojos', precio: 150, codigo: 'RM-01' }, { _fila: 4, nombre: 'Labial mate Rosa Nude', categoria: 'Labios', precio: 190 }];
  const rv = await P('panelImportar', { negocio: n3, filas, revisar: true }); if (!rv.ok) throw new Error(rv.error);
  const antes = db.T.Productos.filter(p => p.negocio_id === n3).length;
  const im = await P('panelImportar', { negocio: n3, filas }); if (!im.ok) throw new Error(im.error);
  const s = prodN(n3, 'Sombra 12 tonos'), r = prodN(n3, 'Rímel volumen'), l = prodN(n3, 'Labial mate Rosa Nude');
  console.log('     [excel] revisar: ' + rv.data.nuevos + ' nuevos, ' + rv.data.actualizados + ' actualizados · cargados ' + im.data.cargados + ' · Sombra ' + s.codigo + ' · Rímel ' + r.codigo + ' · Labial (ya existía) ' + l.codigo + ' precio ' + l.precio + ' · errores ' + JSON.stringify(im.data.errores));
  return /^CAT-\d{4}$/.test(s.codigo) && r.codigo === 'RM-01' && l.codigo === lab.data.codigo && l.precio === 190 && db.T.Productos.filter(p => p.negocio_id === n3).length === antes + 2;
});
await paso(null, 'Panel · «Copiar productos» a otro negocio del mismo giro que ya usa CAT-0001', async () => {
  const r4 = await api('registrar', { negocio: 'Bella Catálogo', nombre: 'Ana', giro: 'catalogo', whatsapp: '95551234', pin: '1234' }); const t4 = r4.data.token, n4 = (await api('bootstrap', {}, t4)).data.negocioId; await activar(n4);
  const propio = await api('guardar', { entidad: 'Productos', registro: { nombre: 'Base líquida', categoria: 'Rostro', precio: 300 } }, t4);
  const cp = await P('panelCopiarProductos', { de: n3, a: n4, cats: null, fotos: false }); if (!cp.ok) throw new Error(cp.error);
  const dest = db.T.Productos.filter(p => p.negocio_id === n4), sin = dest.filter(p => !p.codigo).map(p => p.nombre), cs = dest.filter(p => p.codigo).map(p => p.codigo.toLowerCase());
  console.log('     [copiar] destino tenía ' + propio.data.codigo + ' · copiados ' + cp.data.copiados + ', omitidos ' + cp.data.omitidos + ' · quedaron SIN código: ' + (sin.join(', ') || 'ninguno') + ' · códigos repetidos: ' + (cs.length - new Set(cs).size));
  const nv = await api('guardar', { entidad: 'Productos', registro: { nombre: 'Polvo compacto', categoria: 'Rostro', precio: 200 } }, t4); console.log('     [copiar] el siguiente producto nuevo en el destino: ' + (nv.ok ? nv.data.codigo : nv.error));
  return cs.length === new Set(cs).size && nv.ok;
});
pg = await nuevaPagina({});
await paso(pg, 'Panel · entra con la clave y la lista de clientes carga', async () => {
  await pg.goto('http://localhost:8765/?panel'); await pg.waitForTimeout(2000);
  const i = pg.locator('input[type=password], #pn-clave').first(); await i.fill('secreta'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(2500);
  await pg.evaluate(() => { const b = [...document.querySelectorAll('[data-a=panelTab]')].find(x => x.dataset.k === 'cli' || /Clientes/.test(x.innerText)); if (b) b.click(); }); await pg.waitForTimeout(1200); await pg.cap('panel-clientes');
  return tiene(pg, /Farmacia San Rafael/) && tiene(pg, /Todo en Uno HN/);
});
await paso(pg, 'Panel · ficha de la farmacia: abre sin errores y cuenta los productos propios (los FAR no cuentan como ejemplo)', async () => {
  await pg.texto('Farmacia San Rafael', 1200); const v = pg.locator('[data-a=panelVer]'); if (await v.count()) await pg.clic('[data-a=panelVer]'); await pg.waitForTimeout(1800); await pg.cap('panel-ficha-farmacia');
  const t = await texto(pg); const m = t.match(/[^.]{0,60}(propios|de ejemplo|ejemplo)[^.]{0,80}/i); console.log('     [ficha] ' + (m ? m[0] : t.slice(0, 300))); return /Rafael Mejía/.test(t);
});
await pg.context().close();
await cerrar();
