import { nuevaPagina, ok, cerrar, api, db, OUT } from './base.mjs';
import fs from 'node:fs';
const f64 = (fam, w, p) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync('node_modules/@fontsource/'+p).toString('base64')})}`;
const css = [400,500,600,700].map(w=>f64('Jost',w,`jost/files/jost-latin-${w}-normal.woff2`)).join('')+[500,600].map(w=>f64('Cormorant Garamond',w,`cormorant-garamond/files/cormorant-garamond-latin-${w}-normal.woff2`)).join('');
const reg = await api('registrar', { negocio: 'Variedades Demo', nombre: 'Demo', giro: 'variedades', whatsapp: '98765432', pin: '1234' }); const tok = reg.data.token;
await api('guardar', { entidad: 'Config', registro: { tienda: 'si', tiendaModo: 'oscuro' } }, tok);
const N = db.T.Licencias[0].id;
const t = await nuevaPagina({}); await t.goto('http://localhost:8765/?tienda=' + N); await t.waitForTimeout(2000); await t.addStyleTag({ content: css });
const tx = async () => (await t.locator('body').innerText()).replace(/\s+/g, ' ');
ok('Tienda vacía: mensaje y WhatsApp', /Pronto verás aquí nuestros productos/.test(await tx()) && await t.locator('.t-vacio a.btn.wa').count() === 1 && !/con esa búsqueda/.test(await tx()));
await t.evaluate(() => { document.querySelector('.t-vacio').scrollIntoView({ block: 'center' }); }); await t.waitForTimeout(400); await t.screenshot({ path: `${OUT}/1-vacia.png` });
// Con productos: búsqueda sin resultados
await api('cargarEjemplos', {}, tok);
await t.reload(); await t.waitForTimeout(2000); await t.addStyleTag({ content: css });
await t.locator('#t-q').fill('zzzz'); await t.waitForTimeout(500);
ok('Búsqueda sin resultados', /No encontramos productos con esa búsqueda/.test(await tx()));
await cerrar(); process.exit(0);
