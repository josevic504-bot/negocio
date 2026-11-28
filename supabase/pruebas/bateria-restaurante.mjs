// Batería: restaurante — despiece, plato con receta, margen del día y compras para un evento (1.9.95)
// Ejecutar: cd supabase/pruebas && node bateria-restaurante.mjs
import { api, db } from './prueba.mjs';

let pasadas = 0, fallidas = 0; const fallos = [];
const ok = (nombre, cond, detalle) => { if (cond) { pasadas++; console.log('✓ ' + nombre); } else { fallidas++; fallos.push(nombre); console.log('✗ ' + nombre + (detalle !== undefined ? ' → ' + (typeof detalle === 'string' ? detalle : JSON.stringify(detalle)).slice(0, 300) : '')); } return !!cond; };
const mal = (nombre, r, re) => ok(nombre, !r.ok && re.test(r.error || ''), r.error || r);
const sec = t => console.log('\n── ' + t + ' ──');
const cerca = (a, b) => Math.abs(Number(a) - Number(b)) < 0.006;
let n = 0; const K = () => 'k' + (++n);

const reg = await api('registrar', { ciudad: 'San Pedro Sula', negocio: 'Comedor Doña Tere', nombre: 'Tere', giro: 'comida', whatsapp: '44000001', pin: '1234' });
const tok = reg.data.token;
const prod = async (r) => { const g = await api('guardar', { entidad: 'Productos', registro: r }, tok); if (!g.ok) throw new Error(g.error); return g.data; };
const P = async id => (await api('bootstrap', {}, tok)).data.productos.find(p => p.id === id);

sec('Módulos del giro');
let b = (await api('bootstrap', {}, tok)).data;
ok('restaurante trae Cotizaciones encendido', (b.modulos || b.config && b.config.modulos || true) && (await api('cotizaciones', {}, tok)).ok);

sec('Despiece');
const pechuga = await prod({ nombre: 'Pechuga de pollo', categoria: 'Piezas', tipo: 'producto', precio: 0 });
const pierna = await prod({ nombre: 'Pierna de pollo', categoria: 'Piezas', tipo: 'producto', precio: 0 });
const muslo = await prod({ nombre: 'Muslo de pollo', categoria: 'Piezas', tipo: 'producto', precio: 0 });
const ala = await prod({ nombre: 'Ala de pollo', categoria: 'Piezas', tipo: 'producto', precio: 0 });
const plato0 = await prod({ nombre: 'Sopa del día', categoria: 'Platos', tipo: 'servicio', precio: 60 });
mal('despiece: pieza que no controla existencias', await api('guardar', { entidad: 'Productos', registro: { nombre: 'Pollo raro', tipo: 'producto', precio: 0, despiece: { m: 'peso', v: [{ id: plato0.id, n: 2, p: 1 }] } } }, tok), /no controla existencias/);
mal('despiece: pieza inexistente', await api('guardar', { entidad: 'Productos', registro: { nombre: 'Pollo raro 2', tipo: 'producto', precio: 0, despiece: { v: [{ id: 'nada', n: 2 }] } } }, tok), /ya no existe/);
mal('despiece: pieza repetida', await api('guardar', { entidad: 'Productos', registro: { nombre: 'Pollo raro 3', tipo: 'producto', precio: 0, despiece: { v: [{ id: ala.id, n: 2 }, { id: ala.id, n: 1 }] } } }, tok), /dos veces/);
mal('despiece: cantidad cero', await api('guardar', { entidad: 'Productos', registro: { nombre: 'Pollo raro 4', tipo: 'producto', precio: 0, despiece: { v: [{ id: ala.id, n: 0 }] } } }, tok), /cuántas/);
const pollo = await prod({ nombre: 'Pollo entero', categoria: 'Compras', tipo: 'producto', precio: 0,
  despiece: { m: 'peso', v: [{ id: pechuga.id, n: 2, p: 2.2 }, { id: pierna.id, n: 2, p: 1.5 }, { id: muslo.id, n: 2, p: 1.5 }, { id: ala.id, n: 2, p: 0.8 }] } });
ok('despiece guardado', JSON.parse(pollo.despiece).v.length === 4, pollo.despiece);
mal('despiece: pieza de sí mismo', await api('guardar', { entidad: 'Productos', registro: { id: pollo.id, despiece: { v: [{ id: pollo.id, n: 2 }] } } }, tok), /sí mismo/);
const chuleta = await prod({ nombre: 'Chuleta de cerdo', categoria: 'Piezas', tipo: 'producto', precio: 0 });
const chuletaLb = await prod({ nombre: 'Chuleta (libra)', categoria: 'Compras', tipo: 'producto', precio: 0, despiece: { m: 'igual', v: [{ id: chuleta.id, n: 2, p: 9 }] } });
ok('partes iguales: peso queda en 1', JSON.parse(chuletaLb.despiece).v[0].p === 1, chuletaLb.despiece);

let r = await api('compra', { items: [{ productoId: pollo.id, cantidad: 3, costo: 150 }, { productoId: chuletaLb.id, cantidad: 5, costo: 80 }], metodo: 'Efectivo', clave: K() }, tok);
ok('compra con despiece', r.ok, r.error);
const compra1 = r.data && r.data.compra;
let pe = await P(pechuga.id), pi = await P(pierna.id), mu = await P(muslo.id), al = await P(ala.id), ch = await P(chuleta.id), po = await P(pollo.id);
ok('pechugas: 6 a L 27.50', pe.stock === 6 && cerca(pe.costo, 27.5), [pe.stock, pe.costo]);
ok('piernas: 6 a L 18.75', pi.stock === 6 && cerca(pi.costo, 18.75), [pi.stock, pi.costo]);
ok('muslos: 6 a L 18.75', mu.stock === 6 && cerca(mu.costo, 18.75), [mu.stock, mu.costo]);
ok('alas: 6 a L 10.00', al.stock === 6 && cerca(al.costo, 10), [al.stock, al.costo]);
ok('piezas suman lo comprado (L 450)', cerca(6 * (pe.costo + pi.costo + mu.costo + al.costo), 450));
ok('el pollo entero no sube existencias', po.stock === 0, po.stock);
ok('el pollo entero guarda su último costo', cerca(po.costo, 150), po.costo);
ok('chuletas: 10 a L 40', ch.stock === 10 && cerca(ch.costo, 40), [ch.stock, ch.costo]);
const kx = await api('kardex', { id: pierna.id }, tok);
ok('kárdex de la pierna muestra la compra', kx.ok && JSON.stringify(kx.data).includes(compra1.numero), kx.error);

// Segunda compra a otro precio: promedio ponderado de las piezas
r = await api('compra', { items: [{ productoId: pollo.id, cantidad: 1, costo: 170 }], metodo: 'Efectivo', clave: K() }, tok);
pi = await P(pierna.id);
ok('promedio ponderado de la pierna', pi.stock === 8 && cerca(pi.costo, (6 * 18.75 + 2 * 170 * 1.5 / 12) / 8), [pi.stock, pi.costo]);
const compra2 = r.data.compra;
r = await api('anularCompra', { id: compra2.id }, tok);
ok('anular compra con despiece', r.ok, r.error);
pi = await P(pierna.id); pe = await P(pechuga.id);
ok('anular devuelve piezas y costo', pi.stock === 6 && cerca(pi.costo, 18.75) && pe.stock === 6 && cerca(pe.costo, 27.5), [pi.stock, pi.costo, pe.stock, pe.costo]);

sec('Plato con receta');
mal('receta: plato apuntando a un servicio', await api('guardar', { entidad: 'Productos', registro: { nombre: 'Plato raro', tipo: 'servicio', precio: 50, receta: [{ id: plato0.id, n: 1 }] } }, tok), /no controla existencias/);
mal('receta: lo demás negativo', await api('guardar', { entidad: 'Productos', registro: { nombre: 'Plato raro 2', tipo: 'servicio', precio: 50, recetaExtra: -5 } }, tok), /negativos/);
const ptaj = await prod({ nombre: 'Pollo con tajadas', categoria: 'Platos', tipo: 'servicio', precio: 120, receta: [{ id: pierna.id, n: 1 }], recetaExtra: 15 });
ok('costo del plato = pierna + lo demás (L 33.75)', cerca(ptaj.costo, 33.75), ptaj.costo);
const pchu = await prod({ nombre: 'Chuleta con arroz', categoria: 'Platos', tipo: 'servicio', precio: 140, receta: [{ id: chuleta.id, n: 1 }], recetaExtra: 10 });
r = await api('venta', { items: [{ productoId: ptaj.id, cantidad: 2 }, { productoId: pchu.id, cantidad: 1 }], metodo: 'Efectivo', clave: K() }, tok);
ok('venta de platos', r.ok, r.error);
const v1 = r.data.venta;
ok('costo de la venta = 2×33.75 + 50', cerca(v1.costo, 2 * 33.75 + 50), v1.costo);
pi = await P(pierna.id); ch = await P(chuleta.id);
ok('salen 2 piernas y 1 chuleta', pi.stock === 4 && ch.stock === 9, [pi.stock, ch.stock]);
r = await api('anularVenta', { id: v1.id, motivo: 'prueba' }, tok);
pi = await P(pierna.id); ch = await P(chuleta.id);
ok('anular la venta devuelve las piezas', r.ok && pi.stock === 6 && ch.stock === 10, [r.error, pi.stock, ch.stock]);
// Editar venta no duplica piezas
r = await api('venta', { items: [{ productoId: ptaj.id, cantidad: 1 }], metodo: 'Efectivo', clave: K() }, tok);
const v2 = r.data.venta;
r = await api('editarVenta', { id: v2.id, motivo: 'eran 3', items: [{ productoId: ptaj.id, cantidad: 3 }], metodo: 'Efectivo' }, tok);
pi = await P(pierna.id);
ok('editar venta 1 → 3 platos deja 3 piernas', r.ok && pi.stock === 3, [r.error, pi.stock]);
// Las piezas no frenan la venta
r = await api('venta', { items: [{ productoId: ptaj.id, cantidad: 5 }], metodo: 'Efectivo', clave: K() }, tok);
pi = await P(pierna.id);
ok('sin piernas suficientes la venta pasa y la existencia queda negativa', r.ok && pi.stock === -2, [r.error, pi.stock]);
// Nueva compra cambia el costo de la pierna → el plato se actualiza
r = await api('compra', { items: [{ productoId: pollo.id, cantidad: 2, costo: 180 }], metodo: 'Efectivo', clave: K() }, tok);
const ptaj2 = await P(ptaj.id), pi2 = await P(pierna.id);
ok('el plato toma el costo nuevo de la pierna', cerca(ptaj2.costo, r2(pi2.costo + 15)), [ptaj2.costo, pi2.costo]);
// Pieza borrada dentro de la receta: no rompe la venta
const ex = await prod({ nombre: 'Encurtido', categoria: 'Piezas', tipo: 'producto', precio: 0 });
const pex = await prod({ nombre: 'Tacos', categoria: 'Platos', tipo: 'servicio', precio: 80, receta: [{ id: ex.id, n: 1 }], recetaExtra: 20 });
await api('eliminar', { entidad: 'Productos', id: ex.id }, tok);
r = await api('venta', { items: [{ productoId: pex.id, cantidad: 1 }], metodo: 'Efectivo', clave: K() }, tok);
ok('pieza borrada en la receta: la venta pasa', r.ok, r.error);

sec('¿Cómo me fue hoy?');
const rep = await api('reporte', {}, tok);
ok('reporte trae insumos', rep.ok && rep.data.insumos, rep.error || Object.keys(rep.data || {}));
const ins = rep.data.insumos || {};
ok('insumos: compras del día', cerca(ins.compras, rep.data.kpi.compras) && ins.compras > 0, ins);
ok('insumos: usado > 0 y queda ≥ 0', ins.usado > 0 && ins.queda >= 0, ins);
ok('insumos: avisa lo que falta (pierna en negativo)', ins.faltan && ins.faltan.length === 0 || ins.faltan.includes('Pierna de pollo') || (pi2.stock >= 0), ins.faltan);

sec('Evento desde la cotización');
r = await api('cotizacionGuardar', { registro: { cliente: 'Lic. Marta Reyes', proyecto: 'Graduación Instituto Central', items: [{ n: 'Plato graduación', cant: 150, precio: 180 }] } }, tok);
ok('cotización de 150 platos', r.ok, r.error);
const Q = r.data;
r = await api('cotizacionAceptar', { id: Q.id, pagos: [{ n: 'Anticipo', f: hoyF(), pct: 50 }, { n: 'Saldo', f: hoyF(), pct: 50 }] }, tok);
ok('aceptar crea el evento', r.ok, r.error);
const pjId = (r.data && (r.data.proyectoId || (r.data.cotizacion && r.data.cotizacion.proyectoId))) || (await api('cotizacion', { id: Q.id }, tok)).data.proyectoId;
ok('evento ligado', !!pjId, r.data && Object.keys(r.data));
const st0 = (await P(pierna.id)).stock;
r = await api('compra', { proyectoId: pjId, items: [{ productoId: pollo.id, cantidad: 10, costo: 320 }], metodo: 'Efectivo', clave: K() }, tok);
ok('compra para el evento', r.ok, r.error);
const ce = r.data && r.data.compra;
ok('la compra queda ligada al evento', ce && ce.proyectoId === pjId, ce);
ok('no entra al inventario', (await P(pierna.id)).stock === st0);
const rep2 = await api('reporte', {}, tok);
ok('no suma a «Compraste hoy»', cerca(rep2.data.kpi.compras, rep.data.kpi.compras + (rep2.data.kpi.compras - rep.data.kpi.compras)) && cerca(rep2.data.kpi.compras, rep.data.kpi.compras), [rep.data.kpi.compras, rep2.data.kpi.compras]);
await api('gastoProyecto', { registro: { proyectoId: pjId, monto: 1350, descripcion: 'Desechables', categoria: 'Otros' } }, tok);
await api('gastoProyecto', { registro: { proyectoId: pjId, productoId: pechuga.id, cantidad: 4, descripcion: 'Pechugas' } }, tok);
let pj = (await api('proyecto', { id: pjId }, tok)).data;
const gComp = pj.gastos.find(g => g.compraId === ce.id);
ok('la compra aparece como gasto del evento', gComp && cerca(gComp.monto, 3200) && gComp.categoria === 'Compras del evento', gComp);
ok('costo total del evento', cerca(pj.r.costo, 3200 + 1350 + 4 * (await P(pechuga.id)).costo), pj.r.costo);
ok('costo por plato = total ÷ 150', cerca(pj.r.productos[0].costoUnit, pj.r.costo / 150), [pj.r.productos[0].costoUnit, pj.r.costo]);
ok('el evento trae el subtotal de la cotización', cerca(pj.cot.subtotal, 27000), pj.cot);
mal('no se anula el gasto que viene de la compra', await api('anularGastoProyecto', { id: gComp.id }, tok), /anula esa compra/);
mal('no se edita el gasto que viene de la compra', await api('gastoProyecto', { registro: { id: gComp.id, proyectoId: pjId, monto: 10, descripcion: 'x' } }, tok), /viene de una compra/);
r = await api('anularCompra', { id: ce.id }, tok);
pj = (await api('proyecto', { id: pjId }, tok)).data;
ok('anular la compra anula su gasto del evento', r.ok && pj.gastos.find(g => g.id === gComp.id).anulado, r.error);
await api('estadoProyecto', { id: pjId, estado: 'cancelado' }, tok);
mal('compra para un evento cancelado', await api('compra', { proyectoId: pjId, items: [{ productoId: pollo.id, cantidad: 1, costo: 150 }], metodo: 'Efectivo', clave: K() }, tok), /cancelado/);

sec('Insumos por paquete');
const vaso = await prod({ nombre: 'Vaso desechable 16 oz', categoria: 'Insumos', tipo: 'producto', precio: 0, paquete: '50' });
ok('paquete guardado como número', vaso.paquete === 50, vaso.paquete);
r = await api('guardar', { entidad: 'Productos', registro: { id: vaso.id, paquete: -3 } }, tok);
ok('paquete negativo queda en 0', r.ok && r.data.paquete === 0, r.data && r.data.paquete);
// La app manda 2 paquetes de 50 a L 95 como 100 unidades a L 1.90, con el tamaño del paquete
r = await api('compra', { items: [{ productoId: vaso.id, cantidad: 100, costo: 1.9, paquete: 50 }], metodo: 'Efectivo', clave: K() }, tok);
let va = await P(vaso.id);
ok('compra por paquete: 100 vasos a L 1.90', r.ok && va.stock === 100 && cerca(va.costo, 1.9), [r.error, va.stock, va.costo]);
ok('recuerda el tamaño del paquete', va.paquete === 50, va.paquete);
const cdv = (await api('compras', {}, tok)).data.lista.find(c => c.id === r.data.compra.id);
ok('el detalle dice «2 paquetes de 50»', cdv && /2 paquetes de 50/.test(cdv.detalle[0].descripcion), cdv && cdv.detalle[0].descripcion);
r = await api('compra', { items: [{ productoId: vaso.id, cantidad: 100, costo: 1.6, paquete: 100 }], metodo: 'Efectivo', clave: K() }, tok);
va = await P(vaso.id);
ok('otro tamaño (paquete de 100) cambia el sugerido y promedia el costo', va.paquete === 100 && va.stock === 200 && cerca(va.costo, 1.75), [va.paquete, va.stock, va.costo]);
const pll = await prod({ nombre: 'Pollo para llevar', categoria: 'Platos', tipo: 'servicio', precio: 130, receta: [{ id: pierna.id, n: 1 }, { id: vaso.id, n: 1 }], recetaExtra: 15 });
ok('el vaso entra al costo del plato', cerca(pll.costo, r2((await P(pierna.id)).costo + 1.75 + 15)), pll.costo);

function r2(x) { return Math.round(x * 100) / 100; }
function hoyF() { const d = new Date(Date.now() - 6 * 3600e3); return d.toISOString().slice(0, 10); }
console.log(`\n==== RESULTADO: ${pasadas} pasadas · ${fallidas} fallidas ====`);
if (fallos.length) console.log(fallos.join('\n'));
