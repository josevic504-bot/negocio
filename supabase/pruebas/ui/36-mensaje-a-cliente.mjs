// Panel Molina · mensaje dentro de la app para un solo negocio
import { nuevaPagina, ok, cerrar, esperar, api, db, OUT } from './base.mjs';
import fs from 'node:fs';
const f64 = (fam, w, p) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync('node_modules/@fontsource/'+p).toString('base64')})}`;
const css = [400,500,600,700].map(w=>f64('Jost',w,`jost/files/jost-latin-${w}-normal.woff2`)).join('')+[500,600].map(w=>f64('Cormorant Garamond',w,`cormorant-garamond/files/cormorant-garamond-latin-${w}-normal.woff2`)).join('');
const tiro = async (pg, n) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${n}.png` }); };
db.props.PANEL_CLAVE = 'clave-panel';
const r1 = await api('registrar', { negocio: 'Variedades Ana', nombre: 'Ana Rivera', giro: 'variedades', whatsapp: '98765432', pin: '1234' }); const tok1 = r1.data.token;
const r2 = await api('registrar', { negocio: 'Ferretería Luis', nombre: 'Luis Paz', giro: 'ferreteria', whatsapp: '97001122', pin: '1234' }); const tok2 = r2.data.token;
const lic1 = db.T.Licencias.find(l => l.negocio === 'Variedades Ana'), lic2 = db.T.Licencias.find(l => l.negocio === 'Ferretería Luis');
// Panel → ficha → mensaje
const pg = await nuevaPagina({}); await pg.goto('http://localhost:8765/?panel'); await pg.waitForTimeout(1500); await pg.addStyleTag({ content: css });
await pg.fill('#pn-clave', 'clave-panel'); await pg.evaluate(() => [...document.querySelectorAll('button')].find(x => /Entrar/.test(x.textContent)).click()); await pg.waitForTimeout(2500);
await pg.evaluate(id => ACC.panelVer({ dataset: { id } }), lic1.id); await pg.waitForTimeout(1800);
ok('Botón en la ficha', await pg.locator('[data-x="mensaje"]').count() === 1);
await pg.evaluate(() => document.querySelector('[data-x="mensaje"]').scrollIntoView({ block: 'center' })); await tiro(pg, '1-ficha-boton');
await pg.evaluate(() => document.querySelector('[data-x="mensaje"]').click()); await pg.waitForTimeout(800);
await pg.fill('#ma-x', 'Hola Ana, no logro contactarte al número con el que te registraste. ¿Me confirmas tu WhatsApp para ayudarte con tu programa?');
await tiro(pg, '2-escribir-mensaje');
await pg.evaluate(() => [...document.querySelectorAll('.sheet-f button')].pop().click()); await pg.waitForTimeout(1000);
const an = db.T.Anuncios[0];
ok('Mensaje solo para ese negocio', an && an.destinos === lic1.id && an.filtro === 'ids' && an.canales === 'push,banner', JSON.stringify(an).slice(0, 300));
ok('Lista: todavía no lo ha visto', /Todavía no lo ha visto/.test(await pg.locator('#ma-l').innerText()));
// El cliente lo ve en su Inicio, con Responder; el otro negocio no
const c1 = await nuevaPagina({ token: tok1 }); await c1.goto('http://localhost:8765/'); await esperar(c1, 8000); await c1.waitForTimeout(700); await c1.addStyleTag({ content: css });
const t1 = await c1.txt();
ok('Cliente ve el mensaje con Responder', /no logro contactarte/.test(t1) && await c1.locator('.anuncio-b [data-a="soporteNuevo"]').count() === 1 && await c1.locator('.anuncio-b [data-a="anuncioOk"]').count() === 1, t1.slice(0, 200));
await c1.evaluate(() => { const b = document.querySelector('.anuncio-b'); b.scrollIntoView({ block: 'start' }); window.scrollBy(0, -90); }); await tiro(c1, '3-cliente-ve-mensaje');
const c2 = await nuevaPagina({ token: tok2 }); await c2.goto('http://localhost:8765/'); await esperar(c2, 8000); await c2.waitForTimeout(700);
ok('El otro negocio no lo ve', await c2.locator('.anuncio-b').count() === 0);
// Responder abre el chat de soporte
await c1.evaluate(() => document.querySelector('.anuncio-b [data-a="soporteNuevo"]').click()); await c1.waitForTimeout(700);
ok('Responder abre el chat con soporte', await c1.locator('.sheet').count() >= 1, (await c1.hojaTxt()).slice(0, 120));
await tiro(c1, '4-cliente-responde');
await c1.evaluate(() => cerrarHojas()); await c1.waitForTimeout(300);
await c1.evaluate(() => document.querySelector('.anuncio-b [data-a="anuncioOk"]').click()); await c1.waitForTimeout(800);
ok('Entendido lo marca como visto', db.T.Anuncios[0].vistos === lic1.id && await c1.locator('.anuncio-b').count() === 0, db.T.Anuncios[0].vistos);
// Panel: ya lo vio
await pg.evaluate(() => cerrarHojas()); await pg.waitForTimeout(300);
await pg.evaluate(id => ACC.panelVer({ dataset: { id } }), lic1.id); await pg.waitForTimeout(1800);
await pg.evaluate(() => document.querySelector('[data-x="mensaje"]').click()); await pg.waitForTimeout(1000);
ok('Panel: «Ya lo vio»', /Ya lo vio/.test(await pg.locator('#ma-l').innerText()));
await pg.evaluate(() => document.querySelector('#ma-l').scrollIntoView({ block: 'center' })); await tiro(pg, '5-panel-ya-lo-vio');
// Mensaje general sigue funcionando y no trae «Responder»
const tokP = (await api('panelLogin', { clave: 'clave-panel' })).data.token;
const g = await api('panelAnunciar', { filtro: 'todos', push: false, banner: true, titulo: 'Novedad', texto: 'Mensaje para todos' }, undefined, { panel: tokP });
ok('Mensaje a todos sigue igual', g.ok && g.data[0].enviados === 2 && !g.data[0].para && g.data[1].para === 'Variedades Ana', JSON.stringify(g).slice(0, 300));
await c2.reload(); await esperar(c2, 8000); await c2.waitForTimeout(700);
ok('Mensaje general sin «Responder»', await c2.locator('.anuncio-b').count() === 1 && await c2.locator('.anuncio-b [data-a="soporteNuevo"]').count() === 0);
await cerrar();
