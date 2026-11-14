// 1.9.83: círculo de primeros pasos en la lista del Panel, embudo de cada publicidad y aviso de fin de prueba en la app (negocios de ejemplo)
import { nuevaPagina, ok, cerrar, api, db } from './base.mjs';
db.props.PANEL_CLAVE = 'clave-panel';
const dia = n => new Date(Date.now() - 6 * 3600000 + n * 86400000).toISOString().slice(0, 10);
const pt = (await api('panelLogin', { clave: 'clave-panel' })).data.token;
await api('panelGastoGuardar', { tipo: 'publicidad', plataforma: 'TikTok', nombre: 'Noviembre', moneda: 'USD', montoOrig: 25, tasa: 26.9, fecha: dia(-3), desde: dia(-3) }, null, { panel: pt });
const NEG = [['Variedades El Sol', 3, 2], ['Pulpería La Esquina', 1, 0], ['Boutique Lucía', 0, 1], ['Farmacia San José', 0, 0]];
const toks = [];
for (const [i, [n, ventas, extra]] of NEG.entries()) {
  const r = await api('registrar', { negocio: n, nombre: 'Dueño ' + (i + 1), giro: 'tienda', whatsapp: '9700000' + i, pin: '1234' }); const t = r.data.token; toks.push(t);
  if (ventas || extra) await api('guardar', { entidad: 'Productos', registro: { nombre: 'Artículo ' + i, categoria: 'General', precio: 50, tipo: 'producto', stock: 20 } }, t);
  const b = (await api('bootstrap', {}, t)).data, p = b.productos.find(x => x.nombre === 'Artículo ' + i);
  for (let k = 0; k < ventas; k++) await api('venta', { items: [{ productoId: p.id, cantidad: 1 }], metodo: 'Efectivo', recibido: 100, clave: 'v' + i + k }, t);
  if (extra > 1) await api('guardar', { entidad: 'Clientes', registro: { nombre: 'Cliente frecuente', telefono: '99990000' } }, t);
  if (i < 3) await api('inicio', {}, t); // la Farmacia nunca abre Inicio: queda «sin datos de uso»
}
const L = db.T.Licencias; L[0].vencePrueba = dia(1); L[0].registro = dia(-2) + ' 10:00'; L[1].registro = dia(-1) + ' 09:00'; L[2].registro = dia(-1) + ' 15:00';
const pg = await nuevaPagina({});
await pg.goto('http://localhost:8765/?panel'); await pg.waitForTimeout(1500);
await pg.fill('#pn-clave', 'clave-panel'); await pg.evaluate(() => [...document.querySelectorAll('button')].find(b => /Entrar/.test(b.innerText)).click()); await pg.waitForTimeout(2500);
await pg.tocar('[data-a=panelTab][data-k="cli"]:not([data-f])', 1500);
const aros = await pg.evaluate(() => [...document.querySelectorAll('.pp-aro span')].map(x => x.textContent));
ok('lista: círculo con el día de prueba', aros.length === 4 && aros.every(x => /^\d+D$/.test(x)), JSON.stringify(aros));
const sinX = await pg.evaluate(() => ({ mini: document.querySelectorAll('.cc2 .pp-mini').length, b: [...document.querySelectorAll('.cc2 .badge')].map(b => b.textContent) })); ok('lista: sin «Prueba Xd» ni pasos en la vista principal', await pg.evaluate(() => !document.querySelector('.cc2 .pp-mini') && ![...document.querySelectorAll('.cc2 .badge')].some(b => /Prueba \d/.test(b.textContent))), JSON.stringify(sinX));
await pg.cap('lista-clientes');
await pg.texto('Variedades El Sol', 800);
ok('al tocar: día, vence y lo que falta', /Día \d.*vence mañana/.test(await pg.txt()) && /pasos · falta/.test(await pg.txt()));
await pg.cap('cliente-abierto');
await pg.tocar('[data-a=panelTab][data-k="mkt"]:not([data-f])', 1200); await pg.tocar('[data-a=panelGastosLista]', 1500);
const emb = await pg.evaluate(() => [...document.querySelectorAll('.emb-f')].map(x => x.innerText.replace(/\s+/g, ' ')).join(' | '));
ok('embudo de la publicidad', /Se registraron 4.*Cargaron productos 3.*Hicieron ventas 2.*Activaron 0/.test(emb), emb);
ok('costo por cliente que vendió y sin datos', /por cliente que vendió.*1 sin datos de uso/.test(await pg.evaluate(() => document.querySelector('.emb small').innerText)));
await pg.evaluate(() => document.querySelector('.emb').closest('.card, .cc, div').scrollIntoView({ block: 'center' })); await pg.waitForTimeout(300);
await pg.cap('embudo');
// App del cliente en su último día
const ap = await nuevaPagina({ token: toks[0] });
await ap.goto('http://localhost:8765/'); await ap.waitForTimeout(3500);
const hoja = await ap.hojaTxt();
ok('ventana del último día con lo que registró', /Tu prueba termina mañana/.test(hoja) && /3/.test(hoja), hoja.slice(0, 200));
await ap.cap('ventana-ultimo-dia');
await ap.evaluate(() => { try { cerrarHojas(); } catch (e) {} }); await ap.waitForTimeout(500);
ok('tarjeta en Inicio', /Mañana termina tu prueba/.test(await ap.txt()));
await ap.cap('tarjeta-inicio');
await cerrar();
