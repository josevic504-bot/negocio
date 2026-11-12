// 1.9.67 · Cocina (comandas nueva → preparando → lista → 🔔 en la mesa) y pedidos para llevar / a domicilio desde Mesas
import { nuevaPagina, ok, cerrar, esperar, api, db } from './base.mjs';
import { paso, texto, tiene, btn } from './lib.mjs';
const r = await api('registrar', { negocio: 'Comedor La Ceiba', nombre: 'Vic', giro: 'comida', whatsapp: '98111111', pin: '1234' }); const A = r.data.token;
await api('cargarEjemplos', {}, A);
await api('guardarUsuario', { registro: { usuario: '98222222', nombre: 'Karla', rol: 'mesero', activo: true }, clave: '1111' }, A);
await api('guardarUsuario', { registro: { usuario: '98555555', nombre: 'Doña Rosa', rol: 'cocina', activo: true }, clave: '5555' }, A);
const M = (await api('login', { whatsapp: '98222222', pin: '1111' })).data.token, K = (await api('login', { whatsapp: '98555555', pin: '5555' })).data.token;
const P = (await api('bootstrap', {}, A)).data.productos; const pid = n => P.find(p => p.nombre === n).id;
// Mesa 6 con Ana y Luis mandada a cocina
const c6 = (await api('mesaAccion', { op: 'abrir', mesa: '6', personas: 2, items: [{ productoId: pid('Baleada con todo'), cantidad: 2, quien: 'Ana', nota: 'Sin cebolla' }, { productoId: pid('Plato típico'), cantidad: 1, quien: 'Luis' }] }, M)).data.cuenta;
await api('mesaAccion', { op: 'cocina', id: c6.id }, M);
const pg = await nuevaPagina({ token: A }); await pg.goto('http://localhost:8765/'); await esperar(pg, 8000); await pg.waitForTimeout(1000);
await paso(pg, 'Barra del restaurante: Inicio · Cocina · Mesas · Pedidos · Más', async () => /Inicio Cocina Mesas Pedidos Más/.test((await pg.locator('#bnav').innerText()).replace(/\s+/g, ' ')));
await pg.ir('mesas'); await pg.waitForTimeout(800);
await paso(pg, 'Mesas: botones Para llevar y A domicilio', async () => tiene(pg, /Para llevar.*A domicilio/));
await paso(pg, 'Para llevar: crear con el nombre del cliente y tomar pedido', async () => {
  await pg.accion('mesaLlevar', 600); await pg.fill('#ll-n', 'Juan Pérez'); await btn(pg, /Crear y tomar pedido/, 1200);
  const t = await pg.hojaTxt(); await pg.evaluate(n => [...document.querySelectorAll('#pp-l .li')].find(x => x.querySelector('b').textContent === n).click(), 'Combo familiar'); await pg.waitForTimeout(400);
  await btn(pg, /Agregar y mandar a cocina/, 1500); const t2 = await texto(pg); await btn(pg, /^Listo$/, 800); await pg.evaluate(() => cerrarHojas()); await pg.waitForTimeout(600);
  return /Agregar a Llevar 1 · Juan Pérez/.test(t) && /Comanda · Llevar 1 · Juan Pérez/.test(t2);
});
await paso(pg, 'Tablero: tarjeta morada «Llevar 1» arriba, en cocina', async () => { await pg.cap('tablero-llevar'); return (await pg.locator('.ms-t.ms-ll').count()) === 1 && tiene(pg, /Para llevar y a domicilio.*Llevar 1.*En cocina.*Juan Pérez/); });
await paso(pg, 'A domicilio: pide dirección', async () => { await pg.evaluate(() => document.querySelector('[data-a="mesaLlevar"][data-t="domicilio"]').click()); await pg.waitForTimeout(600); await pg.fill('#ll-n', 'María López'); await btn(pg, /Crear y tomar pedido/, 800); const t = await texto(pg); await pg.evaluate(() => cerrarHojas()); return /Escribe la dirección/.test(t); });
await pg.context().close();
/* Cocina */
const pk = await nuevaPagina({ token: K, pc: true }); await pk.goto('http://localhost:8765/'); await esperar(pk, 8000); await pk.waitForTimeout(1500);
await paso(pk, 'Cocina: entra directo a su pantalla con 2 comandas nuevas en orden', async () => { await pk.cap('cocina-pc'); const t = await pk.txt(); return (await pk.evaluate(() => S.vista)) === 'cocina' && (await pk.locator('.kc-nueva').count()) === 2 && /Mesa 6.*Llevar 1 · Juan Pérez/.test(t) && /Baleada con todo Ana.*Sin cebolla/.test(t); });
await paso(pk, 'Cocina: Empezar a preparar → Listo', async () => { await pk.tocar('.kc-nueva [data-e="preparando"]', 900); await pk.cap('cocina-preparando'); const p = await pk.locator('.kc-preparando').count(); await pk.tocar('.kc-preparando [data-e="lista"]', 900); return p === 1 && (await pk.locator('.kc-lista').count()) === 1; });
await paso(pk, 'Cocina: no ve Vender ni Mesas en el menú', async () => { await pk.accion('mas', 600); const t = await pk.hojaTxt(); await pk.evaluate(() => cerrarHojas()); return /Cocina/.test(t) && !/Vender|Mesas|Productos|Caja/.test(t); });
await pk.context().close();
/* Mesero ve 🔔 y entrega */
const pm = await nuevaPagina({ token: M }); await pm.goto('http://localhost:8765/'); await esperar(pm, 8000); await pm.waitForTimeout(1200);
await paso(pm, 'Mesero: la mesa 6 muestra 🔔 Listo', async () => { await pm.cap('mesero-listo'); return (await pm.locator('.ms-t .pend.ok').count()) === 1 && /Listo/.test(await pm.locator('.ms-t .pend.ok').innerText()); });
await paso(pm, 'Mesero: dentro de la mesa «Listo en cocina» y «Ya lo llevé»', async () => { await pm.tocar('.ms-t:has(.pend.ok)', 900); await pm.cap('mesa-listo'); const t = await pm.hojaTxt(); await pm.accion('msEntregado', 900); return /Listo en cocina.*Baleada con todo \(Ana\)/.test(t) && (await pm.locator('.ms-listo').count()) === 0; });
await pm.context().close();
/* Cobrar para llevar: desaparece del tablero y la comanda lista queda entregada */
const pa = await nuevaPagina({ token: A }); await pa.goto('http://localhost:8765/#mesas'); await esperar(pa, 8000); await pa.waitForTimeout(1200);
await paso(pa, 'Cobrar «Llevar 1»: la venta queda «para llevar» y la tarjeta desaparece', async () => {
  await pa.tocar('.ms-t.ms-ll', 900); await btn(pa, /^Cobrar L/, 1200); await btn(pa, /^Cobrar L/, 2200); await pa.evaluate(() => cerrarHojas()); await pa.waitForTimeout(1500);
  const v = db.T.Ventas.find(x => /Llevar 1/.test(x.nota)); return v && v.servicio === 'llevar' && v.mesa === '' && (await pa.locator('.ms-t.ms-ll').count()) === 0;
});
await cerrar();
