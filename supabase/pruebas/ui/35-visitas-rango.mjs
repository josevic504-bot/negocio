// Panel Molina · Visitas por rango de fechas (desde–hasta)
import { nuevaPagina, ok, cerrar, api, db, OUT } from './base.mjs';
import fs from 'node:fs';
const f64 = (fam, w, p) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync('node_modules/@fontsource/'+p).toString('base64')})}`;
const css = [400,500,600,700].map(w=>f64('Jost',w,`jost/files/jost-latin-${w}-normal.woff2`)).join('')+[500,600].map(w=>f64('Cormorant Garamond',w,`cormorant-garamond/files/cormorant-garamond-latin-${w}-normal.woff2`)).join('');
const tiro = async (pg, n) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${n}.png` }); };
db.props.PANEL_CLAVE = 'clave-panel';
await api('registrar', { negocio: 'Variedades Ana', nombre: 'Ana Rivera', giro: 'variedades', whatsapp: '98765432', pin: '1234' });
await api('visita', { p: 'negocio', v: 'v0', o: 'tiktok' });
const base = db.T.Visitas[0]; console.log('fila:', JSON.stringify(base));
// Visitas de ejemplo en los últimos 60 días (hora de Honduras)
const hn = n => { const d = new Date(Date.now() - 6 * 3600000 - n * 86400000); return d.toISOString().slice(0, 10); };
const oris = ['tiktok', 'facebook', 'wa', 'directo', 'estado'], pags = ['negocio', 'demo', 'catalogo']; let k = 0;
const pon = (dia, n) => { for (let i = 0; i < n; i++) { k++; db.T.Visitas.push(Object.assign({}, base, { id: 'VI' + k, _fila: 1000 + k, fecha: dia + ' ' + String(8 + (k % 12)).padStart(2, '0') + ':15', pagina: pags[k % 3], origen: oris[k % 5], disp: k % 4 ? 'cel' : 'pc', vid: 'p' + (k % 37) })); } };
for (let n = 1; n <= 60; n++) pon(hn(n), 3 + ((n * 7) % 11));
const tok = (await api('panelLogin', { clave: 'clave-panel' })).data.token;
const P = d => api('panelVisitas', d, undefined, { panel: tok });
// Servidor
const a = hn(12), b = hn(6); const r = await P({ desde: a, hasta: b });
const esperado = db.T.Visitas.filter(x => x.fecha.slice(0, 10) >= a && x.fecha.slice(0, 10) <= b && !String(x.pagina).startsWith('t-')).length;
ok('Rango de 7 días: total exacto y barras por día', r.ok && r.data.rango && r.data.dias === 7 && r.data.desde === a && r.data.hasta === b && r.data.total === esperado && r.data.barras.length === 7 && r.data.barras[0].k === a && r.data.barras[6].k === b && r.data.barras.reduce((s, x) => s + x.n, 0) === esperado, JSON.stringify(r).slice(0, 300));
const ant = db.T.Visitas.filter(x => x.fecha.slice(0, 10) >= hn(19) && x.fecha.slice(0, 10) < a).length;
ok('Compara con los mismos días antes', r.data.anterior === ant, r.data.anterior + ' vs ' + ant);
const r2 = await P({ desde: b, hasta: a }); ok('Fechas al revés se intercambian', r2.data.desde === a && r2.data.hasta === b && r2.data.total === esperado);
const r3 = await P({ desde: hn(50), hasta: hn(5) }); ok('Rango largo: barras por semana que suman el total', r3.data.dias === 46 && r3.data.barras.every(x => x.semana) && r3.data.barras.length === 7 && r3.data.barras.reduce((s, x) => s + x.n, 0) === r3.data.total, JSON.stringify(r3.data.barras));
const r4 = await P({ desde: '2020-01-01', hasta: '2099-01-01' }); ok('Fuera de límites se recorta a 180 días y hoy', r4.data.desde === r4.data.min && r4.data.hasta === r4.data.hoy && r4.data.dias === 180, r4.data.desde + ' ' + r4.data.hasta + ' ' + r4.data.dias);
const r5 = await P({ dias: 30 }); const r5e = db.T.Visitas.filter(x => x.fecha.slice(0, 10) >= hn(29)).length;
ok('7/30/90 días siguen igual', !r5.data.rango && r5.data.dias === 30 && r5.data.barras.length === 30 && r5.data.total === r5e, r5.data.total + ' vs ' + r5e);
const r6 = await P({ desde: 'x', hasta: b }); ok('Fecha inválida → 7 días', !r6.data.rango && r6.data.dias === 7);
// Pantalla
const pg = await nuevaPagina({}); await pg.goto('http://localhost:8765/?panel'); await pg.waitForTimeout(1500); await pg.addStyleTag({ content: css });
await pg.fill('#pn-clave', 'clave-panel'); await pg.evaluate(() => [...document.querySelectorAll('button')].find(x => /Entrar/.test(x.textContent)).click()); await pg.waitForTimeout(2500);
await pg.evaluate(() => ACC.panelVisitas({ dataset: {} })); await pg.waitForTimeout(1200);
ok('Chip «Rango de fechas»', await pg.locator('[data-a="panelVisRango"]').count() === 1);
await tiro(pg, '1-visitas-chip');
await pg.evaluate(() => document.querySelector('[data-a="panelVisRango"]').click()); await pg.waitForTimeout(500);
await pg.fill('#vr-a', a); await pg.fill('#vr-b', b); await pg.evaluate(() => document.querySelector('#vr-b').dispatchEvent(new Event('change')));
ok('Cuenta los días del rango', /7 día/.test(await pg.locator('#vr-n').innerText()));
await tiro(pg, '2-elegir-rango');
await pg.evaluate(() => [...document.querySelectorAll('.sheet-f button')].pop().click()); await pg.waitForTimeout(1200);
const tx = await pg.evaluate(() => document.querySelector('#main').innerText.replace(/\s+/g, ' '));
ok('Pantalla del rango', /Promedio por día/.test(tx) && tx.includes(String(esperado)) && /vs\. 7 días antes/.test(tx) && await pg.locator('[data-a="panelVisRango"].on').count() === 1, tx.slice(0, 300));
await pg.evaluate(() => window.scrollTo(0, 0)); await tiro(pg, '3-rango-7-dias');
// Tocar una barra abre el día y se puede volver al rango
await pg.evaluate(() => document.querySelectorAll('#main [data-dia][role=button]')[2].click()); await pg.waitForTimeout(1000);
ok('Día dentro del rango con «Ver rango»', await pg.locator('#main a[data-desde]').count() === 1);
await pg.evaluate(() => document.querySelector('#main a[data-desde]').click()); await pg.waitForTimeout(1000);
ok('Vuelve al rango', /Promedio por día/.test(await pg.evaluate(() => document.querySelector('#main').innerText)));
// Atajo «Mes pasado» y rango largo por semana
await pg.evaluate(() => document.querySelector('[data-a="panelVisRango"]').click()); await pg.waitForTimeout(400);
await pg.evaluate(() => [...document.querySelectorAll('[data-rr]')].find(x => /Mes pasado/.test(x.textContent)).click());
await pg.evaluate(() => [...document.querySelectorAll('.sheet-f button')].pop().click()); await pg.waitForTimeout(1200);
ok('Mes pasado', /Promedio por día/.test(await pg.evaluate(() => document.querySelector('#main').innerText)) && await pg.evaluate(() => P.visRango.desde.slice(8) === '01'));
await pg.evaluate(() => window.scrollTo(0, 0)); await tiro(pg, '4-mes-pasado');
// Actualización automática mantiene el rango; 7 días lo quita
await pg.evaluate(() => panelAuto()); await pg.waitForTimeout(800);
ok('La actualización automática conserva el rango', await pg.evaluate(() => !!P.visRango) && await pg.locator('[data-a="panelVisRango"].on').count() === 1);
await pg.evaluate(() => document.querySelector('[data-a="panelVisitas"][data-k="7"]').click()); await pg.waitForTimeout(1000);
ok('«7 días» quita el rango', await pg.evaluate(() => !P.visRango) && /Hoy/.test(await pg.evaluate(() => document.querySelector('#main .kpis').innerText)));
await cerrar();
