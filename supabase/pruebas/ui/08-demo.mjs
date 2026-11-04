// Modo prueba (?demo): el negocio de ejemplo corre dentro del navegador con el mismo Codigo.gs
import { nuevaPagina, ok, cerrar, esperar, api, db } from './base.mjs';
import { paso, texto, tiene, btn, dump } from './lib.mjs';
const pg = await nuevaPagina({});
await pg.goto('http://localhost:8765/?demo'); await pg.waitForTimeout(2500);
await paso(pg, 'Demo · pantalla «Conoce el sistema» con negocio de ejemplo', async () => { await pg.cap('demo-login'); return tiene(pg, /Entrar al negocio de ejemplo/); });
await paso(pg, 'Demo · entra al negocio de ejemplo con ventas y productos', async () => { await pg.accion('demoEjemplo', 1500); await esperar(pg, 15000); await pg.waitForTimeout(2500); await pg.cap('demo-inicio'); const t = await texto(pg); return /MODO PRUEBA/.test(t) && /Ventas de hoy/.test(t); });
await paso(pg, 'Demo · vender funciona dentro del navegador', async () => {
  await pg.ir('vender'); const n0 = await pg.evaluate(() => (DEMO.db && DEMO.db.Ventas ? DEMO.db.Ventas.length : -1));
  await pg.tocar('.pc[data-a=vadd]'); await pg.waitForTimeout(400);
  if (await pg.evaluate(() => [...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'Agregar' && b.getBoundingClientRect().width > 0))) { await pg.evaluate(() => { document.querySelectorAll('button.chip[data-v]:not([data-a])').forEach(c => { if (!c.parentElement.querySelector('.on')) c.click(); }); }); await btn(pg, 'Agregar'); }
  await pg.accion('abrirCobro'); await pg.clic('[data-a=cbRec][data-v]'); await btn(pg, /^Cobrar L/, 2000); await pg.cap('demo-venta');
  return tiene(pg, /Venta registrada|Factura emitida/);
});
await paso(pg, 'Demo · reportes y «¿Cómo me fue hoy?» con datos de ejemplo', async () => { await pg.evaluate(() => cerrarHojas()); await pg.ir('reportes'); await pg.cap('demo-reportes'); const t = await texto(pg); if (/No se pudo cargar/.test(t)) throw new Error(t.slice(0, 100)); await pg.ir('inicio'); await pg.texto('¿Cómo me fue hoy?', 1500); await pg.cap('demo-como-me-fue'); return tiene(pg, /Tu negocio te cuenta/); });
await paso(pg, 'Demo · menú del modo prueba: reiniciar datos', async () => { await pg.evaluate(() => cerrarHojas()); await pg.ir('inicio'); await pg.accion('menuDemo', 800); await pg.cap('demo-menu'); const t = await texto(pg); return /Reiniciar|reiniciar/.test(t); });
await paso(pg, 'Demo · no toca el servidor real', async () => Object.keys(db.T).length === 0 || (db.T.Licencias || []).length === 0);
await cerrar();
