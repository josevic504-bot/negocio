// Conteo físico de inventario (conteoAplicar / conteoDetalle) y carga de Excel del Panel (precios, categoría por defecto, historial)
import { api, db } from './prueba.mjs';
db.push = q => (q.lista ? [] : true);
let pasadas = 0, fallidas = 0; const fallos = [];
const ok = (n, c, det) => { if (c) { pasadas++; console.log('✓ ' + n); } else { fallidas++; fallos.push(n); console.log('✗ ' + n + (det !== undefined ? ' → ' + JSON.stringify(det).slice(0, 300) : '')); } };
await db.aplicar({ props: { PANEL_CLAVE: 'clave-vic', TAREAS_CLAVE: 'tt', VAPID_PUBLICA: 'a', VAPID_PRIVADA: 'b' } });
let r = await api('registrar', { negocio: 'Variedades Prueba', nombre: 'Vic', giro: 'variedades', ciudad: 'San Pedro Sula', whatsapp: '33130265', pin: '1234' });
ok('registro', r.ok, r.error); const tok = r.data.token, nid = r.data.negocio ? r.data.negocio.id : (r.data.licencia && r.data.licencia.id);
r = await api('cargarEjemplos', {}, tok); ok('ejemplos', r.ok, r.error);
let boot = (await api('bootstrap', {}, tok)).data; const P = boot.productos.filter(p => p.tipo === 'producto');
const a = P[0], b = P[1], c = P[2];
// Producto con opciones (tallas) para contar por opción
r = await api('guardar', { entidad: 'Productos', registro: { nombre: 'Blusa prueba', categoria: 'Ropa', precio: 300, costo: 150, tipo: 'producto', opciones: 'Talla: S, M', variantes: JSON.stringify({ 'Talla: S': { p: 0, s: 5 }, 'Talla: M': { p: 0, s: 3 } }), activo: true } }, tok);
ok('producto con tallas', r.ok, r.error); const vp = (r.data.registro || r.data);
boot = (await api('bootstrap', {}, tok)).data; const blusa = boot.productos.find(p => p.id === vp.id);
ok('blusa con 8 en total', Number(blusa.stock) === 8, blusa.stock);
const sa = Number(a.stock), sb = Number(b.stock), sc = Number(c.stock);
const lineas = [{ id: a.id, c: sa - 2, m: 'Dañado' }, { id: b.id, c: sb + 1, m: 'Error de registro' }, { id: c.id, c: sc },
  { id: blusa.id, v: 'Talla: S', c: 4, m: 'Pérdida' }, { id: blusa.id, v: 'Talla: M', c: 3 }];
r = await api('conteoAplicar', { lineas, alcance: 'Todo el inventario', ciego: true, quien: 'Sofía', sinContar: 2, clave: 'ct1' }, tok);
ok('conteo aplicado', r.ok, r.error);
const R = r.data.conteo;
ok('resumen: 5 contados, 2 cuadran, 3 diferencias', R.contados === 5 && R.cuadran === 2 && R.dif === 3, R);
ok('faltan 3 unidades (2 + 1 talla S)', R.faltanU === 3, R.faltanU);
ok('faltan en lempiras al costo', Math.abs(R.faltanL - (2 * Number(a.costo) + 150)) < 0.01, [R.faltanL, a.costo]);
ok('sobra 1 al costo', R.sobranU === 1 && Math.abs(R.sobranL - Number(b.costo)) < 0.01, R);
ok('quién contó y a ciegas', R.quien === 'Sofía' && R.ciego === true && R.sinContar === 2, R);
const pa = r.data.productos.find(p => p.id === a.id), pb = r.data.productos.find(p => p.id === b.id), pc = r.data.productos.find(p => p.id === c.id), pbl = r.data.productos.find(p => p.id === blusa.id);
ok('existencias quedan como se contaron', Number(pa.stock) === sa - 2 && Number(pb.stock) === sb + 1 && Number(pc.stock) === sc, [pa.stock, pb.stock, pc.stock]);
const V = JSON.parse(pbl.variantes);
ok('talla S quedó en 4 y M en 3; total 7', V['Talla: S'].s === 4 && V['Talla: M'].s === 3 && Number(pbl.stock) === 7, [V, pbl.stock]);
r = await api('conteoAplicar', { lineas, alcance: 'Todo el inventario', ciego: true, quien: 'Sofía', clave: 'ct1' }, tok);
ok('mismo toque dos veces: no se aplica dos veces', r.ok && r.data.repetida === true, r);
boot = (await api('bootstrap', {}, tok)).data;
ok('bootstrap trae el último conteo y no el historial interno', boot.ultimoConteo && boot.ultimoConteo.id === R.id && boot.config.sysConteos === undefined, [boot.ultimoConteo, boot.config.sysConteos]);
r = await api('conteos', {}, tok); ok('historial de conteos (1)', r.ok && r.data.length === 1 && r.data[0].id === R.id, r.data || r.error);
r = await api('conteoDetalle', { id: R.id }, tok);
ok('detalle: 3 movimientos con motivo', r.ok && r.data.length === 3 && r.data.some(x => x.motivo === 'Dañado' && x.cantidad === -2) && r.data.some(x => x.variante && x.motivo === 'Pérdida'), r.data || r.error);
r = await api('kardex', { id: a.id }, tok);
ok('kardex del producto: «Conteo físico · Dañado»', r.ok && r.data.some(m => m.nota === 'Conteo físico · Dañado' && m.tipo === 'ajuste'), r.data && r.data.slice(0, 2));
r = await api('conteoAplicar', { lineas: [{ id: blusa.id, c: 5 }], clave: 'ct2' }, tok); ok('producto con tallas sin talla → error claro', !r.ok && /Falta la opción/.test(r.error), r.error);
r = await api('conteoAplicar', { lineas: [{ id: a.id, c: -1 }], clave: 'ct3' }, tok); ok('cantidad negativa → error', !r.ok, r.error);
r = await api('conteoAplicar', { lineas: [], clave: 'ct4' }, tok); ok('sin líneas → error', !r.ok && /ningún producto/.test(r.error), r.error);
r = await api('guardar', { entidad: 'Config', registro: { sysConteos: '[]' } }, tok);
r = await api('conteos', {}, tok); ok('el cliente no puede borrar el historial desde Ajustes', r.ok && r.data.length === 1, r.data);
// Cajero no puede contar
r = await api('guardar', { entidad: 'Usuarios', registro: { usuario: 'caja1', nombre: 'Caja', rol: 'cajero', pin: '5555', activo: true } }, tok);
// ===== Panel: carga desde Excel =====
r = await api('panelLogin', { clave: 'clave-vic' }, undefined, { ip: 'aaaa000000000001' }); const pt = r.data.token;
const PN = (x, d) => api(x, d, undefined, { panel: pt });
const res = await PN('panelResumen'); const neg = (res.data.negocios || res.data.lista || []).find(n => /Variedades Prueba/.test(n.negocio));
const NID = neg ? neg.id : nid; ok('negocio en el panel', !!NID, res.data && Object.keys(res.data));
const filas = [
  { _fila: 2, nombre: 'Sombrilla', categoria: 'Hogar', precio: 'L 1,200.50', existencia: '3' },
  { _fila: 3, nombre: 'Cartera', categoria: 'Accesorios', precio: '1.250,75', costo: '600,5' },
  { _fila: 4, nombre: 'Toalla', precio: 210, existencia: 12 },
  { _fila: 5, nombre: 'Llavero', categoria: 'Regalos', precio: '1.200' },
  { _fila: 6, nombre: 'Gorra', categoria: 'Ropa', precio: 'abc' },
  { _fila: 7, nombre: 'Termo', categoria: 'Hogar', precio: '' },
  { _fila: 8, nombre: 'Peine', categoria: 'Belleza', precio: '35', costo: '12.125' }];
r = await PN('panelImportar', { negocio: NID, filas, revisar: true, catDefecto: 'Varios' });
ok('revisar: responde', r.ok, r.error);
const rv = r.data, item = n => rv.lista.find(x => x.nombre === n), errDe = n => (rv.errores.find(e => e.nombre === n) || {}).error || '';
ok('«L 1,200.50» → 1200.50', item('Sombrilla') && item('Sombrilla').precio === 1200.5, item('Sombrilla'));
ok('«1.250,75» → 1250.75', item('Cartera') && item('Cartera').precio === 1250.75, item('Cartera'));
ok('sin categoría → «Varios» y marcado', item('Toalla') && item('Toalla').categoria === 'Varios' && item('Toalla').catDef === true, item('Toalla'));
ok('«1.200» ambiguo → error claro', /mil o uno/.test(errDe('Llavero')), errDe('Llavero'));
ok('«abc» → no se entiende', /no se entiende/.test(errDe('Gorra')), errDe('Gorra'));
ok('precio vacío → falta el precio', /falta el precio/.test(errDe('Termo')), errDe('Termo'));
ok('costo con 3 decimales tras cero sigue sirviendo (12.125)', !!item('Peine'), rv.errores);
r = await PN('panelImportar', { negocio: NID, filas, catDefecto: 'Varios' });
ok('carga real: 4 cargados, 3 con error', r.ok && r.data.cargados === 4 && r.data.errores.length === 3, r.data || r.error);
boot = (await api('bootstrap', {}, tok)).data;
const somb = boot.productos.find(p => p.nombre === 'Sombrilla'), toal = boot.productos.find(p => p.nombre === 'Toalla');
ok('Sombrilla guardada con 1200.50 y 3 en existencia', somb && somb.precio === 1200.5 && Number(somb.stock) === 3, somb);
ok('Toalla guardada en «Varios»', toal && toal.categoria === 'Varios', toal);
r = await PN('panelNegocio', { id: NID }); const seg = r.ok ? (r.data.seguimiento || []) : [];
ok('historial de la ficha: «Carga desde Excel · 4 productos»', seg.some(x => /Carga desde Excel · 4 productos/.test(x.nota)), r.ok ? seg.slice(0, 3) : r.error);
r = await PN('panelImportar', { negocio: NID, filas: [{ _fila: 2, nombre: 'Sin cat', precio: 50 }], revisar: true });
ok('sin categoría por defecto: sigue pidiendo categoría', r.ok && r.data.errores.length === 1 && /categoría/.test(r.data.errores[0].error), r.data);
console.log(`\n${pasadas} pasadas · ${fallidas} fallidas`); if (fallidas) { console.log('Fallos: ' + fallos.join(' | ')); process.exit(1); }
