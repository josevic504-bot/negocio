// 1.9.66 · Mesas: lo que pidió cada persona (¿para quién?), cuenta por persona, «Cobrar a…», comanda con nombres
import { nuevaPagina, ok, cerrar, esperar, api, db } from './base.mjs';
import { paso, texto, tiene, btn } from './lib.mjs';
const r = await api('registrar', { negocio: 'Comedor La Ceiba', nombre: 'Vic', giro: 'comida', whatsapp: '98111111', pin: '1234' }); const A = r.data.token;
await api('cargarEjemplos', {}, A);
await api('guardarUsuario', { registro: { usuario: '98222222', nombre: 'Karla', rol: 'mesero', activo: true }, clave: '1111' }, A);
const P = (await api('bootstrap', {}, A)).data.productos; const pid = n => P.find(p => p.nombre === n).id;
const pg = await nuevaPagina({ token: A }); await pg.goto('http://localhost:8765/'); await esperar(pg, 8000); await pg.waitForTimeout(1000);
await pg.ir('mesas'); await pg.waitForTimeout(800);
const tocaProd = async n => { await pg.evaluate(n => [...document.querySelectorAll('#pp-l .li')].find(x => x.querySelector('b').textContent === n).click(), n); await pg.waitForTimeout(350); };
const nuevoNombre = async n => { await pg.tocar('[data-pnuevo]', 500); await pg.fill('#pt-in', n); await btn(pg, /^Listo$/, 500); };
await paso(pg, 'Abrir mesa 4 y tomar pedido', async () => { await pg.tocar('.ms-t[data-m="4"]', 700); await pg.tocar('#am-p [data-p="3"]', 200); await btn(pg, /Abrir y tomar pedido/, 1200); return tiene(pg, /¿Para quién es\?.*Toda la mesa/); });
await paso(pg, 'Para Ana: Baleada con todo y Licuado', async () => { await nuevoNombre('Ana'); await tocaProd('Baleada con todo'); await tocaProd('Licuado de frutas'); return (await pg.locator('#pp-p .chip.on').innerText()) === 'Ana'; });
await paso(pg, 'Para Luis: Plato típico y Café', async () => { await nuevoNombre('Luis'); await tocaProd('Plato típico'); await tocaProd('Café'); return true; });
await paso(pg, 'Para toda la mesa: Combo familiar', async () => { await pg.tocar('[data-pq=""]', 300); await tocaProd('Combo familiar'); await pg.cap('menu-por-persona'); return tiene(pg, /Pedido de la mesa.*Ana.*Ana.*Luis.*Luis/); });
await paso(pg, 'Mandar a cocina: la comanda dice de quién es cada plato', async () => { await btn(pg, /Agregar y mandar a cocina/, 1500); await pg.cap('comanda-nombres'); const t = await pg.hojaTxt(); return /Baleada con todo Ana/.test(t) && /Plato típico Luis/.test(t) && /Combo familiar(?! Ana| Luis)/.test(t); });
await paso(pg, 'Cuenta agrupada por persona con subtotales', async () => { await btn(pg, /^Listo$/, 900); await pg.cap('cuenta-por-persona'); const t = await pg.hojaTxt(); return /Ana L 95\.00 Cobrar a Ana/.test(t) && /Luis L 170\.00 Cobrar a Luis/.test(t) && /Toda la mesa L 420\.00/.test(t) && /Total de la mesa L 685\.00/.test(t); });
await paso(pg, 'Cambiar persona: el Café pasa de Luis a Ana', async () => {
  const k = await pg.evaluate(() => cuentaDe(S.hMesa.id).items.find(i => i.descripcion === 'Café').k);
  await pg.tocar(`[data-a="msQuien"][data-k="${k}"]`, 600); await pg.evaluate(() => { const sh = [...document.querySelectorAll('.sheet')].pop(); [...sh.querySelectorAll('.chip[data-q]')].find(x => x.dataset.q === 'Ana').click(); }); await pg.waitForTimeout(1200);
  return /Ana L 115\.00/.test(await pg.hojaTxt());
});
await paso(pg, 'Cobrar a Ana: solo lo suyo; Luis y la mesa siguen', async () => {
  await pg.tocar('[data-a="msCobrarA"][data-q="Ana"]', 1200); const t = await pg.hojaTxt(); await pg.cap('cobro-ana'); await btn(pg, /^Cobrar L/, 2200); await pg.evaluate(() => cerrarHojas()); await pg.waitForTimeout(1200);
  const c = await pg.evaluate(() => S.mesasD.cuentas.find(x => x.mesa === '4')); const v = db.T.Ventas.find(x => x.mesa === '4');
  return /Cobrar L.115\.00/.test(t) && c.estado === 'abierta' && !c.items.some(i => i.quien === 'Ana') && c.items.length === 2 && v && v.total === 115 && /Ana/.test(v.nota);
});
await paso(pg, 'Precuenta lleva subtotales por persona', async () => { await pg.tocar('.ms-t[data-m="4"]', 900); await pg.evaluate(() => { window.print = () => {}; }); await pg.accion('msPrecuenta', 400); const t = await pg.evaluate(() => document.querySelector('#print-area').textContent.replace(/\s+/g, ' ')); console.log('     precuenta:', t.slice(0, 300)); return /Plato típico \(Luis\)/.test(t) && /Luis\s*L.150\.00Toda la mesa\s*L.420\.00/.test(t); });
await paso(pg, 'Sin nombres la cuenta se ve como antes', async () => {
  await pg.evaluate(() => cerrarHojas()); await api('mesaAccion', { op: 'abrir', mesa: '7', personas: 2, items: [{ productoId: pid('Café'), cantidad: 2 }] }, A); await pg.evaluate(() => R.mesas(true)); await pg.waitForTimeout(900);
  await pg.tocar('.ms-t[data-m="7"]', 900); return (await pg.locator('.ms-per').count()) === 0 && /Café/.test(await pg.hojaTxt());
});
await cerrar();
