import { nuevaPagina, ok, cerrar, esperar, api, db, OUT } from './base.mjs';
import fs from 'node:fs';
const f64 = (fam, w, p) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync('node_modules/@fontsource/'+p).toString('base64')})}`;
const css = [400,500,600,700].map(w=>f64('Jost',w,`jost/files/jost-latin-${w}-normal.woff2`)).join('')+[500,600].map(w=>f64('Cormorant Garamond',w,`cormorant-garamond/files/cormorant-garamond-latin-${w}-normal.woff2`)).join('');
const tiro = async (pg, n) => { await pg.waitForTimeout(400); await pg.screenshot({ path: `${OUT}/${n}.png` }); };
const reg = await api('registrar', { negocio: 'Flores del Valle', nombre: 'Demo', giro: 'floristeria', whatsapp: '98765432', pin: '1234' }); const tok = reg.data.token;
await api('cargarEjemplos', {}, tok); await api('guardar', { entidad: 'Config', registro: { tienda: 'si' } }, tok);
const N = db.T.Licencias[0].id;
// apagar desde la app
const pg = await nuevaPagina({ token: tok }); await pg.goto('http://localhost:8765/'); await esperar(pg, 8000); await pg.waitForTimeout(800); await pg.addStyleTag({ content: css });
await pg.ir('tienda');
const sw = pg.locator('input[data-k="ramoPrecios"]'); ok('Interruptor en Mi tienda', await sw.count() === 1 && await sw.isChecked());
await pg.evaluate(() => document.querySelector('input[data-k="ramoPrecios"]').closest('label').scrollIntoView({ block: 'center' }));
await pg.evaluate(() => document.querySelector('input[data-k="ramoPrecios"]').click()); await pg.waitForTimeout(300); await tiro(pg, '1-ajuste');
await pg.evaluate(() => document.querySelector('#aj-info [data-a="guardarAj"]').click()); await pg.waitForTimeout(900);
const cfg = db.T.Config.find(x => x.clave === 'ramoPrecios'); ok('Se guardó apagado', cfg && cfg.valor === 'no', JSON.stringify(cfg));
// tienda
const t = await nuevaPagina({}); await t.goto('http://localhost:8765/?tienda=' + N); await t.waitForTimeout(2000); await t.addStyleTag({ content: css });
await t.evaluate(() => document.querySelector('[data-ramo]').click()); await t.waitForTimeout(500);
const rosa = db.T.Productos.find(x => x.nombre.startsWith('Rosa')).id;
for (let i = 0; i < 6; i++) await t.evaluate(id => document.querySelector(`[data-rq="${id}"][data-d="1"]`).click(), rosa);
const tx = (await t.locator('.sheet').last().innerText()).replace(/\s+/g, ' ');
ok('Sin precios en el ramo', !/L 45\.00/.test(tx) && /Precio a cotizar/.test(tx) && /La tienda te dirá el precio/.test(tx), tx.slice(0, 300));
await tiro(t, '2-tienda');
await cerrar(); process.exit(0);
