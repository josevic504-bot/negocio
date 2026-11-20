// Ficha del cliente del Panel por grupos (20 nov 2026): accesos arriba, 5 grupos y sugerencias de WhatsApp
import { nuevaPagina, cerrar, ok, api, db, OUT } from './base.mjs';
import { btn } from './lib.mjs';
db.props.PANEL_CLAVE = 'clave-panel';
const r = await api('registrar', { ciudad: 'San Pedro Sula', negocio: 'Boutique Karla', nombre: 'Karla Mejía', giro: 'boutique', whatsapp: '96000011', pin: '1234' }); const tok = r.data.token;
await api('cargarEjemplos', {}, tok); const b = (await api('bootstrap', {}, tok)).data; const p = b.productos.find(x => !x.opciones && x.stock > 2) || b.productos[0];
await api('venta', { items: [{ productoId: p.id, cantidad: 1, precio: p.precio }], metodo: 'Efectivo', recibido: 5000, clave: 'f1' }, tok);
const neg = db.T.Licencias[0].id.toLowerCase(); for (let i = 0; i < 4; i++) await api('visita', { p: 't-' + neg, o: 'wa', d: 'cel', v: 'visitante' + i + 'xxxx' }, undefined, { ip: 'dddddddddddddd0' + i });
await api('soporteCrear', { motivo: 'consulta', texto: '¿Cómo activo mi tienda?' }, tok);
const pg = await nuevaPagina({});
await pg.goto('http://localhost:8765/?panel'); await pg.waitForTimeout(1500);
await pg.fill('#pn-clave', 'clave-panel'); await btn(pg, 'Entrar', 2500);
const id = db.T.Licencias[0].id; await pg.evaluate(id => panelFicha(id), id); await pg.waitForTimeout(2500);


const q = sel => pg.evaluate(s => document.querySelectorAll(s).length, sel);
await pg.screenshot({ path: OUT + '/ficha-nueva-1.png' });
ok('Ficha: bloque «Entrar y contactar» con 6 accesos', (await q('.sheet-b .fx-acc .fx-a')) === 6);
ok('Ficha: 5 grupos, abiertos Resumen y Licencia', (await q('.sheet-b .fx-g')) === 5 && (await q('.sheet-b .fx-g.cerrado')) === 3);
const t0 = await pg.hojaTxt();
ok('Ficha: ya no hay dos secciones «Soporte» ni la fila de WhatsApp suelta', !/Escribirle por WhatsApp/.test(t0) && (t0.match(/Soporte/g) || []).length <= 3, String((t0.match(/Soporte/g) || []).length));
ok('Ficha: «Ver su tienda» apunta a la tienda del cliente', await pg.evaluate(() => /\/boutique-karla|tienda=/.test(document.querySelector('.fx-acc a.fx-a').href)), await pg.evaluate(() => document.querySelector('.fx-acc a.fx-a').href));
await pg.tocar('[data-gf="3"]', 400); await pg.tocar('[data-gf="1"]', 400);
ok('Ficha: los grupos se abren y cierran al tocarlos', await pg.evaluate(() => { const g = [...document.querySelectorAll('.sheet-b .fx-g')]; return g[0].classList.contains('cerrado') && !g[2].classList.contains('cerrado'); }));
ok('Ficha: Respaldos carga dentro de «Su negocio»', await pg.evaluate(() => !!document.querySelector('.fx-g #pf-resp')));
await pg.tocar('[data-x="etiqueta"][data-e="Interesado"]', 1800).catch(async () => { await pg.tocar('[data-gf="4"]', 400); await pg.tocar('[data-x="etiqueta"][data-e="Interesado"]', 1800); });
ok('Ficha: tras una acción se conserva qué grupos estaban abiertos', await pg.evaluate(() => { const g = [...document.querySelectorAll('.sheet-b .fx-g')]; return g[0].classList.contains('cerrado') && !g[2].classList.contains('cerrado'); }));
ok('Ficha: la etiqueta se guardó y sale en el título del grupo', /Interesado/.test(await pg.evaluate(() => document.querySelectorAll('.sheet-b .fx-gh')[3].textContent)));
await pg.tocar('[data-x="waSug"]', 900); const tw = await pg.hojaTxt();
ok('WhatsApp: se abren las sugerencias de mensaje', /Escribirle por WhatsApp/.test(tw) && /¿Qué tal la prueba\?/.test(tw) && /Vence mañana/.test(tw) && /Bienvenida \+ imagen/.test(tw) && /sin mensaje/.test(tw), tw.slice(0, 200));
ok('WhatsApp: cada sugerencia lleva al número del cliente con el texto', await pg.evaluate(() => { const a = [...document.querySelectorAll('.sheet a[data-t="dia3"]')].pop(); return /wa\.me\/50496000011\?text=/.test(a.href); }));
await pg.screenshot({ path: OUT + '/ficha-nueva-whatsapp.png' });
await pg.evaluate(() => { const hs = document.querySelectorAll('.sheet'); hs[hs.length - 1].querySelector('[data-a="cerrarHoja"], .sheet-x, .sheet-h button').click(); }); await pg.waitForTimeout(500);
await pg.tocar('.fx-acc [data-a="panelSoporteVer"]', 1500); const tc = await pg.hojaTxt();
ok('Chat de soporte: abre la conversación del cliente', /Cómo activo mi tienda/.test(tc), tc.slice(0, 160));
await cerrar(); process.exit(0);
