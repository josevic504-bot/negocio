// Borrar datos: el campo del nombre no se autocompleta con el WhatsApp, las opciones se ven alineadas y el borrado funciona
import { nuevaPagina, ok, cerrar, esperar, api, db } from './base.mjs';
import { paso, texto, tiene, btn } from './lib.mjs';
const r = await api('registrar', { negocio: 'Comedor La Ceiba', nombre: 'Vic', giro: 'comida', whatsapp: '98111111', pin: '1234' }); const A = r.data.token;
await api('cargarEjemplos', {}, A);
const pg = await nuevaPagina({ token: A }); await pg.goto('http://localhost:8765/'); await esperar(pg, 8000); await pg.waitForTimeout(1000);
await paso(pg, 'Abrir «Borrar los datos de mi negocio»', async () => { await pg.evaluate(() => ACC.borrarDatos()); await pg.waitForTimeout(800); await pg.cap('borrar-datos'); return tiene(pg, /escribe el nombre de tu negocio: Comedor La Ceiba/); });
await paso(pg, 'Las opciones van alineadas a la izquierda con la letra de la app', async () => pg.evaluate(() => { const b = document.querySelector('#bd-a .li'); const cs = getComputedStyle(b); return cs.textAlign === 'left' && getComputedStyle(b.querySelector('b')).fontFamily === getComputedStyle(document.body).fontFamily; }));
await paso(pg, 'Simula el autocompletado del navegador: el WhatsApp se borra solo', async () => { await pg.evaluate(() => { const i = document.querySelector('#bd-n'); i.value = '+50433130265'; }); await pg.evaluate(() => new Promise(r => setTimeout(r, 50))); const h = await pg.evaluate(() => ACC.borrarDatos()); await pg.waitForTimeout(100); await pg.evaluate(() => { [...document.querySelectorAll('#bd-n')].forEach(i => i.value = '+50433130265'); }); await pg.waitForTimeout(600); return (await pg.evaluate(() => [...document.querySelectorAll('#bd-n')].pop().value)) === ''; });
await paso(pg, 'Escribiendo el nombre y el PIN borra los movimientos', async () => {
  await pg.evaluate(() => cerrarHojas()); await pg.evaluate(() => ACC.borrarDatos()); await pg.waitForTimeout(800);
  await pg.click('#bd-n'); await pg.fill('#bd-n', 'Comedor La Ceiba'); await pg.fill('#bd-p', '1234'); await btn(pg, /Borrar movimientos/, 800); await btn(pg, /Sí, borrar/, 2500);
  return !/El nombre no coincide/.test(await texto(pg));
});
await cerrar();
