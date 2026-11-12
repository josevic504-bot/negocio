// Panel Molina · la ficha dice si el cliente ya creó productos propios o solo tiene los de ejemplo
import { nuevaPagina, ok, cerrar, api, db, OUT } from './base.mjs';
import fs from 'node:fs';
const f64 = (fam, w, p) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync('node_modules/@fontsource/'+p).toString('base64')})}`;
const css = [400,500,600,700].map(w=>f64('Jost',w,`jost/files/jost-latin-${w}-normal.woff2`)).join('')+[500,600].map(w=>f64('Cormorant Garamond',w,`cormorant-garamond/files/cormorant-garamond-latin-${w}-normal.woff2`)).join('');
db.props.PANEL_CLAVE = 'clave-panel';
const reg = async (neg, nom, wa) => (await api('registrar', { negocio: neg, nombre: nom, giro: 'variedades', whatsapp: wa, pin: '1234' })).data.token;
const tA = await reg('Variedades Ana', 'Ana Rivera', '98765432'), tB = await reg('Tienda Beto', 'Beto Cruz', '97001122'), tC = await reg('Kiosko Caro', 'Caro Díaz', '96003344');
const ejA = await api('cargarEjemplos', {}, tA); const ejB = await api('cargarEjemplos', {}, tB);
const nEj = ejA.data.agregados;
for (const n of ['Camisa polo azul', 'Gorra negra', 'Perfume 100 ml']) await api('guardar', { entidad: 'Productos', registro: { nombre: n, categoria: 'Ropa', precio: 250, costo: 120, tipo: 'producto', stock: 5, activo: true } }, tB);
// Beto además desactivó un producto propio y editó uno de ejemplo: no cambian la cuenta de propios activos
const pb = (await api('guardar', { entidad: 'Productos', registro: { nombre: 'Viejo', categoria: 'Ropa', precio: 10, costo: 5, tipo: 'producto', stock: 0, activo: false } }, tB));
const tp = (await api('panelLogin', { clave: 'clave-panel' })).data.token, P = (a, d) => api(a, d, undefined, { panel: tp });
const L = n => db.T.Licencias.find(l => l.negocio === n).id;
const fA = (await P('panelNegocio', { id: L('Variedades Ana') })).data.uso, fB = (await P('panelNegocio', { id: L('Tienda Beto') })).data.uso, fC = (await P('panelNegocio', { id: L('Kiosko Caro') })).data.uso;
ok('Solo ejemplos: 0 propios', fA.propios === 0 && fA.ejemplos === nEj && fA.ultimoPropio === '', JSON.stringify(fA));
ok('Creó 3 propios (el desactivado no cuenta)', fB.propios === 3 && fB.ejemplos === nEj && fB.ultimoPropio.slice(0, 4) === String(new Date().getFullYear()) && fB.productos === nEj + 3, JSON.stringify(fB));
ok('Sin productos', fC.propios === 0 && fC.ejemplos === 0, JSON.stringify(fC));
// Pantalla
const pg = await nuevaPagina({}); await pg.goto('http://localhost:8765/?panel'); await pg.waitForTimeout(1500); await pg.addStyleTag({ content: css });
await pg.fill('#pn-clave', 'clave-panel'); await pg.evaluate(() => [...document.querySelectorAll('button')].find(x => /Entrar/.test(x.textContent)).click()); await pg.waitForTimeout(2500);
const ver = async (neg, n) => { await pg.evaluate(() => cerrarHojas()); await pg.waitForTimeout(300); await pg.evaluate(id => ACC.panelVer({ dataset: { id } }), L(neg)); await pg.waitForTimeout(1800);
  const t = await pg.evaluate(() => { const k = [...document.querySelectorAll('.sheet .kpi')].find(x => /Productos propios/.test(x.innerText)); return k ? k.innerText.replace(/\s+/g, ' ') : ''; });
  await pg.evaluate(() => { const k = [...document.querySelectorAll('.sheet .kpi')].find(x => /Productos propios/.test(x.innerText)); if (k) { k.scrollIntoView({ block: 'center' }); } }); await pg.waitForTimeout(400); await pg.screenshot({ path: `${OUT}/${n}.png` }); return t; };
const a = await ver('Variedades Ana', '1-solo-ejemplo'); ok('Ficha: solo los de ejemplo', /Ninguno todavía/.test(a) && a.includes('solo tiene los ' + nEj + ' de ejemplo'), a);
const b = await ver('Tienda Beto', '2-creo-propios'); ok('Ficha: creó propios', /3 creados/.test(b) && /el último hoy/.test(b) && b.includes(nEj + ' de ejemplo'), b);
const c = await ver('Kiosko Caro', '3-sin-productos'); ok('Ficha: sin productos', /no tiene productos/.test(c), c);
await cerrar();
