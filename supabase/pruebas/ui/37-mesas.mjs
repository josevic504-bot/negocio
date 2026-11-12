// 1.9.65 · Restaurante: tablero de mesas, rol Mesero, cuenta por mesa, cocina, dividir y cobrar, ventas por mesero
import { nuevaPagina, ok, cerrar, esperar, api, db } from './base.mjs';
import { paso, texto, tiene, btn } from './lib.mjs';
const r = await api('registrar', { negocio: 'Comedor La Ceiba', nombre: 'Vic', giro: 'comida', whatsapp: '98111111', pin: '1234' }); const A = r.data.token;
await api('cargarEjemplos', {}, A);
await api('guardar', { entidad: 'Config', registro: { mesasZonas: JSON.stringify([{ z: 'Salón', n: 8 }, { z: 'Terraza', n: 4 }]) } }, A);
await api('guardarUsuario', { registro: { usuario: '98222222', nombre: 'Karla', rol: 'mesero', activo: true }, clave: '1111' }, A);
await api('guardarUsuario', { registro: { usuario: '98444444', nombre: 'Ana', rol: 'mesero', activo: true }, clave: '4444' }, A);
await api('guardarUsuario', { registro: { usuario: '98333333', nombre: 'Luis', rol: 'cajero', activo: true }, clave: '2222' }, A);
const M = (await api('login', { whatsapp: '98222222', pin: '1111' })).data, Mid = M.usuario.id;
const N = (await api('login', { whatsapp: '98444444', pin: '4444' })).data;
const C = (await api('login', { whatsapp: '98333333', pin: '2222' })).data.token;
const P = (await api('bootstrap', {}, A)).data.productos; const pr = n => P.find(p => p.nombre.includes(n)) || P[0];
console.log('   productos:', P.map(p => p.nombre + ':' + p.tipo).join(' | '));
// Mesas de ejemplo en distintos estados
const ab = async (tok, mesa, zona, personas, items) => (await api('mesaAccion', { op: 'abrir', mesa, zona, personas, items }, tok)).data.cuenta;
const c1 = await ab(M.token, '1', 'Salón', 4, [{ productoId: P[0].id, cantidad: 2 }, { productoId: P[2].id, cantidad: 3 }]); await api('mesaAccion', { op: 'cocina', id: c1.id }, M.token);
const c3 = await ab(N.token, '3', 'Salón', 2, [{ productoId: P[1].id, cantidad: 2 }]); await api('mesaAccion', { op: 'cocina', id: c3.id }, N.token); await api('mesaAccion', { op: 'estado', id: c3.id, estado: 'cuenta' }, N.token);
const c5 = await ab(M.token, '5', 'Salón', 3, [{ productoId: P[3].id, cantidad: 1 }]); await api('mesaAccion', { op: 'cocina', id: c5.id }, M.token);
await api('venta', { cuentaId: c5.id, items: [{ productoId: P[3].id, cantidad: 1, mk: '' }], metodo: 'Efectivo' }, C); // pagada → por limpiar
const c10 = await ab(N.token, '10', 'Terraza', 5, [{ productoId: P[0].id, cantidad: 5 }, { productoId: P[4].id, cantidad: 2 }]);
// lo de c10 queda sin mandar a cocina (número rojo)

/* ---- Administrador ---- */
const pg = await nuevaPagina({ token: A }); await pg.goto('http://localhost:8765/'); await esperar(pg, 8000); await pg.waitForTimeout(1200);
await paso(pg, 'Inicio · tarjeta Mesas con ocupadas', async () => { await pg.evaluate(() => { const t = [...document.querySelectorAll('.tile')].find(x => /Mesas/.test(x.innerText)); t && t.scrollIntoView({ block: 'center' }); }); await pg.waitForTimeout(300); await pg.cap('inicio-tarjeta-mesas'); return tiene(pg, /Mesas.*3 de 12 ocupadas/); });
await paso(pg, 'Barra de abajo: Inicio · Cocina · Mesas · Pedidos · Más', async () => /Inicio Cocina Mesas Pedidos Más/.test((await pg.locator('#bnav').innerText()).replace(/\s+/g, ' ')));
await pg.ir('mesas'); await pg.waitForTimeout(800);
await paso(pg, 'Tablero · 12 mesas con colores, zonas y meseros', async () => { await pg.cap('tablero-admin'); return (await pg.locator('.ms-t').count()) === 12 && (await pg.locator('.ms-t.ms-ocu').count()) === 2 && (await pg.locator('.ms-t.ms-cue').count()) === 1 && (await pg.locator('.ms-t.ms-pag').count()) === 1 && tiene(pg, /Vendido hoy por mesero.*Karla/); });
await paso(pg, 'Tablero · mesa 10 con número rojo de platos sin mandar a cocina', async () => (await pg.locator('.ms-t[data-m="10"] .pend').innerText()).trim() === '7');
await paso(pg, 'Zona Terraza filtra 4 mesas', async () => { await pg.texto('Terraza'); const n = await pg.locator('.ms-t').count(); await pg.texto('Todas'); return n === 4; });
// Abrir mesa 4 y tomar pedido
await paso(pg, 'Mesa libre · abrir con personas y mesero', async () => { await pg.tocar('.ms-t[data-m="4"]', 700); await pg.tocar('#am-p [data-p="4"]', 200); await pg.cap('abrir-mesa'); return tiene(pg, /Mesa 4 · Salón.*¿Cuántas personas\?.*Mesero que atiende.*Karla.*Ana/); });
await paso(pg, 'Mesa libre · elegir a Karla y «Abrir y tomar pedido» abre el menú', async () => { await pg.evaluate(() => { [...document.querySelectorAll('#am-m .chip')].find(x => x.innerText === 'Karla').click(); }); await btn(pg, /Abrir y tomar pedido/, 1200); return tiene(pg, /Agregar a la mesa 4/); });
await paso(pg, 'Menú · tocar platos los suma al pedido con nota', async () => {
  const ids = await pg.$$eval('#pp-l .li', l => l.slice(0, 3).map(x => x.dataset.pp));
  await pg.tocar(`[data-pp="${ids[0]}"]`, 400); await pg.tocar(`[data-pp="${ids[0]}"]`, 400); await pg.tocar(`[data-pp="${ids[1]}"]`, 600);
  const v = await pg.$$eval('.hoja, .sheet', () => 1); // noop
  const sel = await pg.locator('#pp-sel .tk').count();
  // nota a la primera línea
  await pg.tocar('[data-sn="0"]', 500); await pg.fill('#pt-in', 'Sin cebolla'); await btn(pg, /^Guardar$/, 600);
  await pg.cap('menu-pedido'); return sel === 2 && tiene(pg, /Pedido de la mesa.*Sin cebolla/);
});
await paso(pg, 'Agregar y mandar a cocina · sale la comanda sin precios', async () => { await btn(pg, /Agregar y mandar a cocina/, 1500); await pg.cap('comanda'); const t = await texto(pg); return /Comanda · Mesa 4/.test(t) && /2 × .*Sin cebolla/.test(t); });
await paso(pg, 'Cuenta de la mesa 4 · líneas en cocina, total y acciones', async () => { await btn(pg, /^Listo$/, 900); await pg.cap('cuenta-mesa'); return tiene(pg, /Mesa 4 · Salón.*Ocupada.*Karla.*En cocina.*Total de la mesa.*Agregar.*A cocina.*Pidió la cuenta.*Precuenta.*Dividir.*Cambiar mesa.*Cobrar/); });
await paso(pg, 'Pidió la cuenta · la mesa 4 se pone amarilla', async () => { await pg.accion('msEstado', 900); return tiene(pg, /Pidió la cuenta/) && (await pg.evaluate(() => cuentaDe(S.hMesa.id).estado)) === 'cuenta'; });
await paso(pg, 'Cambiar mesa · pasa la cuenta de la 4 a la 6', async () => { await pg.accion('msMover', 800); await pg.cap('cambiar-mesa'); await pg.tocar('[data-mv="6"]', 1200); return tiene(pg, /Mesa 6 · Salón/); });
await pg.evaluate(() => cerrarHojas()); await pg.waitForTimeout(500);
await paso(pg, 'Tablero después: mesa 6 amarilla, 4 libre', async () => { await pg.cap('tablero-despues'); return (await pg.locator('.ms-t[data-m="6"].ms-cue').count()) === 1 && (await pg.locator('.ms-t[data-m="4"].ms-lib').count()) === 1; });
// Dividir y cobrar la mesa 1
await paso(pg, 'Dividir · cobrar solo una parte de la mesa 1', async () => {
  await pg.tocar('.ms-t[data-m="1"]', 900); await pg.accion('msDividir', 800);
  const k = await pg.$$eval('[data-dq]', l => l[0].dataset.dq); await pg.tocar(`[data-dq="${k}"][data-d="1"]`, 300);
  await pg.cap('dividir'); await btn(pg, /Cobrar L/, 1200); await pg.cap('cobro-parte');
  const t = await pg.hojaTxt(); await btn(pg, /^Cobrar L/, 2000);
  return /Cobrar/.test(t);
});
await paso(pg, 'Mesa 1 sigue abierta con el resto', async () => { await pg.evaluate(() => cerrarHojas()); await pg.ir('mesas'); await pg.waitForTimeout(900); const c = await pg.evaluate(() => S.mesasD.cuentas.find(x => x.mesa === '1')); return c && c.estado === 'abierta' && c.ventaIds.length === 1 && c.items.reduce((a, i) => a + i.cantidad, 0) === 4; });
await paso(pg, 'Cobrar el resto · la mesa 1 queda por limpiar y la venta a nombre de Karla', async () => { await pg.tocar('.ms-t[data-m="1"]', 900); await btn(pg, /^Cobrar L/, 1200); await btn(pg, /^Cobrar L/, 2200); await pg.evaluate(() => cerrarHojas()); await pg.waitForTimeout(1500); const v = db.T.Ventas.filter(x => x.mesa === '1'); return v.length === 2 && v.every(x => x.mesero === Mid) && (await pg.evaluate(() => S.mesasD.cuentas.find(x => x.mesa === '1').estado)) === 'pagada'; });
await paso(pg, 'Mesa por limpiar · tocarla la deja libre', async () => { await pg.tocar('.ms-t[data-m="1"]', 700); await btn(pg, /Sí, mesa libre/, 1200); return (await pg.locator('.ms-t[data-m="1"].ms-lib').count()) === 1; });
await paso(pg, 'Configurar mesas y zonas (administrador)', async () => { await pg.accion('mesasConfig', 700); await pg.cap('config-mesas'); const t = await pg.hojaTxt(); await pg.evaluate(() => cerrarHojas()); return /Salón.*Terraza/.test(await pg.evaluate(() => [...document.querySelectorAll('[data-zz]')].map(x => x.value).join(' ')) + ' Salón Terraza') && /Mesas/.test(t); });
await paso(pg, 'Reportes · Ventas por mesero', async () => { await pg.ir('reportes'); await pg.waitForTimeout(1500); await pg.evaluate(() => { const h = [...document.querySelectorAll('h3')].find(x => /Ventas por mesero/.test(x.textContent)); h && h.scrollIntoView({ block: 'center' }); }); await pg.waitForTimeout(400); await pg.cap('reporte-meseros'); return tiene(pg, /Ventas por mesero.*Karla/); });
await paso(pg, 'Usuarios · rol Mesero disponible', async () => { await pg.ir('usuarios'); await pg.texto('Karla', 800); await pg.cap('usuario-mesero'); return tiene(pg, /Mesero.*Abre mesas, toma los pedidos/); });
await pg.context().close();

/* ---- Mesero ---- */
const pm = await nuevaPagina({ token: M.token }); await pm.goto('http://localhost:8765/'); await esperar(pm, 8000); await pm.waitForTimeout(1500);
await paso(pm, 'Mesero · entra directo a Mesas con sus ventas de hoy', async () => { await pm.cap('mesero-tablero'); return (await pm.evaluate(() => S.vista)) === 'mesas' && tiene(pm, /Tus ventas de hoy.*L/); });
await paso(pm, 'Mesero · solo ve Mesas en el menú', async () => { await pm.accion('mas', 700); const t = await pm.hojaTxt(); await pm.cap('mesero-menu'); await pm.evaluate(() => cerrarHojas()); return /Mesas/.test(t) && !/Vender|Productos|Caja|Reportes|Clientes/.test(t); });
await paso(pm, 'Mesero · en la mesa no hay «Cobrar» ni «Dividir»', async () => { await pm.tocar('.ms-t[data-m="10"]', 900); await pm.cap('mesero-mesa'); const t = await pm.hojaTxt(); return !/Cobrar|Dividir|Cancelar mesa/.test(t) && /Agregar platos/.test(t); });
await paso(pm, 'Mesero · manda lo pendiente de la mesa 10 a cocina', async () => { await pm.accion('msCocina', 1200); const t = await pm.hojaTxt(); await btn(pm, /^Listo$/, 800); return /Comanda · Mesa 10/.test(t); });
await paso(pm, 'Mesero · no puede quitar lo que ya salió a cocina', async () => { await pm.evaluate(() => document.querySelector('[data-a="msQ"][data-d="-1"]').click()); await pm.waitForTimeout(700); return tiene(pm, /ya salió a cocina/); });
await paso(pm, 'Mesero · intentar ir a Vender lo regresa a Mesas', async () => { await pm.evaluate(() => { cerrarHojas(); ir('vender'); }); await pm.waitForTimeout(600); return (await pm.evaluate(() => S.vista)) === 'mesas'; });
await pm.context().close();
await cerrar();
