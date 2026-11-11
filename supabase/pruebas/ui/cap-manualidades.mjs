// Capturas: imagen de la guía (formulario de la Taza) y lista de giros en el registro
import { nuevaPagina, cerrar, esperar, api, db, OUT } from './base.mjs';
import fs from 'node:fs';
const f64 = (fam, w, p) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync('node_modules/@fontsource/'+p).toString('base64')})}`;
const css = [400,500,600,700].map(w=>f64('Jost',w,`jost/files/jost-latin-${w}-normal.woff2`)).join('')+[500,600].map(w=>f64('Cormorant Garamond',w,`cormorant-garamond/files/cormorant-garamond-latin-${w}-normal.woff2`)).join('');
const reg = await api('registrar', { negocio: 'Detalles Mágicos', nombre: 'Demo', giro: 'manualidades', whatsapp: '98765432', pin: '1234' }); const tok = reg.data.token;
await api('cargarEjemplos', {}, tok);
const taza = db.T.Productos.find(x => x.nombre === 'Taza personalizada');
const pg = await nuevaPagina({ token: tok }); await pg.goto('http://localhost:8765/'); await esperar(pg, 8000); await pg.waitForTimeout(600); await pg.addStyleTag({ content: css });
await pg.setViewportSize({ width: 330, height: 2400 });
await pg.evaluate(id => formProducto(byId(S.productos, id)), taza.id); await pg.waitForTimeout(800);
// Recortes: campo Nombre, Opciones que elige el cliente, Existencia y precio por opción
const caja = async (txt, sel) => pg.evaluate(([t, s]) => { const els = [...document.querySelectorAll(s)].filter(e => e.innerText.trim().startsWith(t) && e.getBoundingClientRect().width > 0);
  const e = els.sort((a, b) => a.innerText.length - b.innerText.length)[0]; if (!e) return null; e.scrollIntoView({ block: 'start' }); const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, [txt, sel]);
const recorte = async (n, txt, sel) => { const b = await caja(txt, sel); if (!b) { console.log('no encontré', txt); return null; } await pg.waitForTimeout(200); const b2 = await caja(txt, sel); const f = `${OUT}/g-${n}.png`; await pg.screenshot({ path: f, clip: { x: Math.max(0, b2.x - 4), y: Math.max(0, b2.y - 4), width: Math.min(330, b2.w + 8), height: b2.h + 8 } }); return f; };
await recorte(1, 'Nombre', 'label.fld');
await pg.evaluate(() => { document.querySelectorAll('details').forEach(d => d.open = true); document.querySelectorAll('[hidden]').forEach(e => { if (e.querySelector('.pf-on')) e.hidden = false; }); }); await pg.waitForTimeout(300);
await recorte(2, 'Opciones que elige el cliente', '.precio-box');
await recorte(3, 'Existencia y precio por opción', '.precio-box');
await pg.evaluate(() => cerrarHojas());
// Registro: lista de tipos de negocio
const r = await nuevaPagina({}); await r.goto('http://localhost:8765/?registro'); await r.waitForTimeout(1500); await r.addStyleTag({ content: css });
await r.screenshot({ path: `${OUT}/registro.png` });
console.log(await r.evaluate(() => [...document.querySelectorAll('select option')].map(o => o.textContent).filter(t => /Manual/.test(t)).join('|')));
await cerrar();
