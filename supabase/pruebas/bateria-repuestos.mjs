// Batería: giro «Repuestos y taller (carro y moto)» — compatibilidad por vehículo y órdenes apagables (1.9.94)
// Ejecutar: cd supabase/pruebas && node bateria-repuestos.mjs
import { api, db } from './prueba.mjs';

let pasadas = 0, fallidas = 0; const fallos = [];
const ok = (nombre, cond, detalle) => { if (cond) { pasadas++; console.log('✓ ' + nombre); } else { fallidas++; fallos.push(nombre); console.log('✗ ' + nombre + (detalle !== undefined ? ' → ' + (typeof detalle === 'string' ? detalle : JSON.stringify(detalle)).slice(0, 300) : '')); } return !!cond; };
const bien = (nombre, r) => ok(nombre, r.ok, r.error);
const sec = t => console.log('\n── ' + t + ' ──');

await db.aplicar({ props: { PANEL_CLAVE: 'clave-panel' } });
const PT = (await api('panelLogin', { clave: 'clave-panel' })).data.token;
const P = (a, d) => api(a, d, undefined, { panel: PT });

let nWa = 41000000;
async function negocio(giro, nombre, extra) {
  const r = await api('registrar', Object.assign({ ciudad: 'San Pedro Sula', negocio: nombre, nombre: 'Dueño ' + nombre, giro, whatsapp: String(nWa++), pin: '1234' }, extra || {}));
  if (!r.ok) throw new Error('registrar: ' + r.error);
  const tok = r.data.token, b = (await api('bootstrap', {}, tok)).data;
  return { tok, neg: b.negocioId, cfg: b.config };
}

sec('Registro y órdenes de trabajo');
const A = await negocio('repuestos', 'Repuestos El Pistón', { taller: 'no' });
ok('taller:no → sinOrdenes = si', A.cfg.sinOrdenes === 'si', A.cfg.sinOrdenes);
let ini = await api('inicio', {}, A.tok);
ok('sin taller: Inicio no trae órdenes', ini.ok && ini.data.ordenes === undefined, ini.data && ini.data.ordenes);
const B = await negocio('repuestos', 'Taller Don Beto');
ok('sin respuesta → órdenes encendidas', !B.cfg.sinOrdenes, B.cfg.sinOrdenes);
ini = await api('inicio', {}, B.tok);
ok('con taller: Inicio trae órdenes', ini.ok && ini.data.ordenes !== undefined, ini.error);
// Encender de nuevo desde Ajustes
await api('guardar', { entidad: 'Config', registro: { sinOrdenes: '' } }, A.tok);
ini = await api('inicio', {}, A.tok);
ok('al quitar sinOrdenes vuelven las órdenes', ini.ok && ini.data.ordenes !== undefined);
await api('guardar', { entidad: 'Config', registro: { sinOrdenes: 'si' } }, A.tok);
// sinOrdenes no afecta a otro giro con órdenes (servicios)
const S = await negocio('servicios', 'Servicios Prueba');
await api('guardar', { entidad: 'Config', registro: { sinOrdenes: 'si' } }, S.tok);
ini = await api('inicio', {}, S.tok);
ok('sinOrdenes no apaga las órdenes de Servicios', ini.ok && ini.data.ordenes !== undefined);

sec('Ficha de compatibilidad');
let g = await api('guardar', { entidad: 'Productos', registro: { nombre: 'Pastillas de freno delanteras', categoria: 'Frenos', precio: 850, costo: 500, tipo: 'producto',
  parte: ' 04465-02220 ', alterno: 'BP-1234', marcaRep: 'Bosch', descripcion: 'Juego de 4 pastillas',
  compat: { t: 'carro', v: [['Toyota', 'Corolla', 2013, 2009], ['toyota', 'Yaris', '2010', ''], ['', 'SinMarca', 2010, 2011], ['Honda', 'Civic', 1800, 3000]] } } }, A.tok);
bien('guardar repuesto con compat', g);
const pid = g.data && g.data.id;
let c = g.ok ? JSON.parse(g.data.compat) : null;
ok('compat: años en orden', c && c.v[0][2] === 2009 && c.v[0][3] === 2013, c);
ok('compat: año solo → desde = hasta', c && c.v[1][2] === 2010 && c.v[1][3] === 2010, c && c.v[1]);
ok('compat: fila sin marca se descarta', c && !c.v.some(x => x[1] === 'SinMarca'), c && c.v);
ok('compat: años fuera de rango se recortan', c && c.v.some(x => x[1] === 'Civic' && x[2] === 1950 && x[3] <= new Date().getFullYear() + 1), c && c.v);
ok('compat: tipo carro', c && c.t === 'carro');
ok('parte sin espacios', g.ok && g.data.parte === '04465-02220', g.data && g.data.parte);
// Editar sin mandar compat la conserva
g = await api('guardar', { entidad: 'Productos', registro: { id: pid, precio: 880 } }, A.tok);
ok('editar sin compat la conserva', g.ok && JSON.parse(g.data.compat).v.length === c.v.length, g.data && g.data.compat);
// compat vacío = universal
g = await api('guardar', { entidad: 'Productos', registro: { nombre: 'Aceite 20W-50 (litro)', categoria: 'Aceites', precio: 190, tipo: 'producto', compat: { t: 'ambos', v: [] } } }, A.tok);
ok('compat sin vehículos guarda solo el tipo', g.ok && JSON.parse(g.data.compat || '{}').t === 'ambos', g.data && g.data.compat);
g = await api('guardar', { entidad: 'Productos', registro: { nombre: 'Basura', categoria: 'X', precio: 1, compat: 'no es json' } }, A.tok);
ok('compat inválido queda vacío', g.ok && g.data.compat === '', g.data && g.data.compat);

sec('Tienda en línea');
await api('guardar', { entidad: 'Config', registro: { tienda: 'si' } }, A.tok);
const t = await api('tiendaInfo', { negocio: A.neg });
bien('tiendaInfo abre', t);
const tp = t.ok && t.data.productos.find(p => p.id === pid);
ok('tiendaInfo trae parte, alterno, marcaRep', tp && tp.parte === '04465-02220' && tp.alterno === 'BP-1234' && tp.marcaRep === 'Bosch', tp);
ok('tiendaInfo trae compat como objeto', tp && tp.compat && Array.isArray(tp.compat.v) && tp.compat.v.length === c.v.length, tp && tp.compat);
ok('tiendaInfo: nombre nuevo del giro', t.ok && /Repuestos y taller/.test(t.data.negocio.giro), t.data && t.data.negocio.giro);

sec('Ejemplos del giro');
const C = await negocio('repuestos', 'Repuestos Ejemplo');
await api('cargarEjemplos', {}, C.tok);
const ejs = (await api('bootstrap', {}, C.tok)).data.productos;
const conC = ejs.filter(p => p.compat && JSON.parse(p.compat).v.length);
ok('al menos 3 ejemplos con compatibilidad', conC.length >= 3, conC.length);
ok('hay ejemplos de moto', ejs.some(p => p.compat && JSON.parse(p.compat).t === 'moto'));
ok('los ejemplos traen nº de parte', ejs.filter(p => p.parte).length >= 3);

sec('Carga desde Excel (Panel)');
const imp = await P('panelImportar', { negocio: C.neg, filas: [
  { _fila: 2, nombre: 'Filtro de aire', categoria: 'Filtros', precio: 320, parte: '17801-0D060', marcaRep: 'Sakura', espara: 'Carro', lequeda: 'Toyota Corolla 2009-2013; Honda XR150L 2015; Mercedes Benz Clase C 2010 – 2012' },
  { _fila: 3, nombre: 'Cadena 428', categoria: 'Motos', precio: 450, espara: 'moto', lequeda: 'Yamaha' }] });
bien('panelImportar', imp);
ok('Excel: sin errores en fila 2', imp.ok && !imp.data.errores.some(e => e.fila === 2), imp.data && imp.data.errores);
ok('Excel: «Yamaha» sin año da error claro', imp.ok && imp.data.errores.some(e => e.fila === 3 && /año/.test(e.error)), imp.data && imp.data.errores);
const fa = (await api('bootstrap', {}, C.tok)).data.productos.find(p => p.nombre === 'Filtro de aire');
const fc = fa && JSON.parse(fa.compat);
ok('Excel: 3 vehículos', fc && fc.v.length === 3, fc);
ok('Excel: Honda XR150L 2015 → 2015–2015', fc && fc.v.some(x => x[0] === 'Honda' && x[1] === 'XR150L' && x[2] === 2015 && x[3] === 2015), fc);
ok('Excel: marca de dos palabras conocida (Mercedes Benz)', fc && fc.v.some(x => x[0] === 'Mercedes Benz' && x[1] === 'Clase C'), fc);
ok('Excel: espara carro y nº de parte', fa && fc.t === 'carro' && fa.parte === '17801-0D060' && fa.marcaRep === 'Sakura', fa);

console.log(`\n==== RESULTADO: ${pasadas} pasadas · ${fallidas} fallidas ====`);
if (fallidas) { console.log('FALLOS:\n - ' + fallos.join('\n - ')); process.exit(1); }
