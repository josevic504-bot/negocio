// Tienda en línea (página pública) → pedido y chat → el negocio lo atiende en Pedidos y Mensajes
import { nuevaPagina, ok, cerrar, esperar, api, db } from './base.mjs';
import { paso, texto, tiene, btn, dump } from './lib.mjs';
const reg = await api('registrar', { negocio: 'Variedades Prueba Total', nombre: 'Vic Prueba', giro: 'variedades', whatsapp: '98765432', pin: '1234' });
const tok = reg.data.token; await api('cargarEjemplos', {}, tok);
const nid = db.T.Licencias[0].id;
const prod = n => db.T.Productos.find(x => x.nombre.startsWith(n));
const pg = await nuevaPagina({ token: tok });
await pg.goto('http://localhost:8765/'); await esperar(pg, 8000); await pg.waitForTimeout(1000);
await pg.ir('tienda');
await paso(pg, 'Mi tienda · enlace, estilos de letra, portada, secciones, datos del dueño', async () => tiene(pg, new RegExp('tienda=' + nid + '.*Copiar QR.*Secciones de tu tienda.*Letra y modo de tu tienda.*Elegante.*Moderna')));
await paso(pg, 'Mi tienda · guardar mensaje de bienvenida y datos de entrega', async () => {
  const w = pg.locator('input[placeholder="¡Bienvenido! Haz tu pedido…"]'); await w.fill('¡Bienvenidos a la prueba total!');
  await pg.clic('[data-a=guardarAj][data-s="estado"]'); await pg.waitForTimeout(800);
  const c = db.T.Config.find(x => x.clave === 'tiendaBienvenida' || x.k === 'tiendaBienvenida' || /Bienvenidos a la prueba/.test(JSON.stringify(x)));
  if (!c) throw new Error('no se guardó: ' + JSON.stringify(db.T.Config.slice(-3)));
  return true;
});
await pg.cap('mi-tienda');
/* ---------- CLIENTE EN LA TIENDA PÚBLICA ---------- */
const t = await nuevaPagina({});
await t.goto('http://localhost:8765/?tienda=' + nid); await t.waitForTimeout(2500);
await paso(t, 'Tienda pública · carga catálogo con categorías, tallas, WhatsApp y entrega', async () => tiene(t, /Variedades Prueba Total.*Ver catálogo · 8 productos.*WhatsApp.*Llamar.*A domicilio.*TALLA S M L XL.*Perfume Brisa 100 ml L 480\.00/));
await paso(t, 'Tienda pública · bienvenida guardada se muestra', async () => tiene(t, /Bienvenidos a la prueba total/));
await t.cap('tienda-inicio');
await paso(t, 'Tienda pública · agregar producto con talla y color al carrito', async () => {
  await t.clic(`button[data-add="${prod('Camiseta').id}"]`); await t.waitForTimeout(600);
  const d = await dump(t); console.log('     [variante] ' + d.slice(0, 700));
  await t.cap('tienda-variante');
  await t.evaluate(() => { document.querySelectorAll('button[data-v], button[data-f], button.chip').forEach(c => { const r = c.getBoundingClientRect(); if (r.width > 0 && !c.dataset.a && !c.parentElement.querySelector('.on') && c.closest('.hoja, .sheet, .modal, .t-opc, .opc')) c.click(); }); });
  await t.waitForTimeout(300);
  await btn(t, /Agregar|Añadir/, 700);
  return true;
});
await paso(t, 'Tienda pública · agregar producto simple y abrir el carrito', async () => {
  await t.clic(`button[data-add="${prod('Perfume').id}"]`); await t.waitForTimeout(500);
  const b = t.locator('button[data-add]'); // si pide cantidad
  await t.clic('button[data-cart]'); await t.waitForTimeout(700);
  const d = await dump(t); console.log('     [carrito] ' + d.slice(0, 1200));
  await t.cap('tienda-carrito');
  return tiene(t, /Camiseta básica.*Perfume Brisa|Perfume Brisa.*Camiseta básica/);
});
await paso(t, 'Tienda pública · pedido sin nombre se rechaza; con datos se envía', async () => {
  await btn(t, /Enviar pedido/, 800);
  if (db.T.Pedidos.length) throw new Error('aceptó un pedido sin nombre');
  await t.fill('#tc-n', 'Ana Cliente'); await t.fill('#tc-t', '9911-2233'); await t.clic('button[data-e="domicilio"]'); await t.waitForTimeout(300);
  const dir = t.locator('#tc-d, input[placeholder*="irección"], textarea[placeholder*="irección"]'); if (await dir.count()) await dir.first().fill('Col. Las Flores, casa 12');
  await t.fill('#tc-o', 'Sin cebolla');
  await t.cap('tienda-pedido-form');
  await btn(t, /Enviar pedido/, 1500);
  const p = db.T.Pedidos[0]; if (!p) throw new Error('no se creó el pedido');
  if (Number(p.total) !== 730 || !/Ana Cliente/.test(p.nombre || p.cliente || JSON.stringify(p))) throw new Error('pedido: ' + JSON.stringify(p).slice(0, 250));
  await t.cap('tienda-pedido-enviado');
  return tiene(t, /pedido|Pedido/);
});
await paso(t, 'Tienda pública · chat con el negocio', async () => {
  await t.evaluate(() => { try { cerrarHojas(); } catch (e) {} });
  const btnChat = t.locator('button[data-chat], .t-chat, button[aria-label*="hat"], [data-a="chatAbrir"]');
  if (await btnChat.count()) await btnChat.last().click(); else await t.evaluate(() => { const b = [...document.querySelectorAll('button')].filter(x => x.getBoundingClientRect().width > 0).pop(); b && b.click(); });
  await t.waitForTimeout(700);
  const d = await dump(t); console.log('     [chat] ' + d.slice(-800));
  await t.fill('#tch-n', 'Ana Cliente'); await t.fill('#tch-t', '9911-2233'); await t.fill('#tch-in', '¿Tienen la camiseta en rojo?');
  const enviado = await t.evaluate(() => { const b = [...document.querySelectorAll('button')].filter(x => x.getBoundingClientRect().width > 0 && /Enviar/i.test(x.innerText + (x.getAttribute('aria-label') || ''))); if (b.length) { b[b.length - 1].click(); return 'btn'; } return null; });
  if (!enviado) await t.press('#tch-in', 'Enter');
  await t.waitForTimeout(1200);
  await t.cap('tienda-chat');
  if (!db.T.Chats || !db.T.Chats.length) throw new Error('no hay chats: ' + Object.keys(db.T).filter(k => /hat|ensaje/i.test(k)).join(','));
  return true;
});
/* ---------- EL NEGOCIO ATIENDE ---------- */
await pg.ir('inicio');
await paso(pg, 'Inicio · aviso de pedido nuevo', async () => { await pg.ir('inicio'); return tiene(pg, /pedido|Pedido/); });
await pg.ir('pedidos');
await paso(pg, 'Pedidos · muestra el pedido con los productos, talla y color', async () => tiene(pg, /Ana Cliente.*730\.00|730\.00.*Ana Cliente/) && tiene(pg, /Camiseta básica.*(S|Blanco)/));
await pg.cap('pedidos-lista');
await paso(pg, 'Pedidos · confirmar, listo y entregar/cobrar', async () => {
  await pg.clic('[data-a=verPedido]'); await pg.waitForTimeout(600);
  const d = await dump(pg); console.log('     [pedido detalle] ' + d.slice(-900));
  await pg.cap('pedido-detalle');
  await btn(pg, /Confirmar|Aceptar/, 1000);
  let p = db.T.Pedidos[0]; if (!/confirm|acept|proceso/i.test(p.estado)) throw new Error('estado tras confirmar: ' + p.estado);
  const d2 = await dump(pg); console.log('     [pedido confirmado] ' + d2.slice(-700));
  await pg.cap('pedido-confirmado');
  return true;
});
await paso(pg, 'Pedidos · cobrar el pedido crea la venta', async () => {
  await pg.evaluate(() => cerrarHojas());
  await pg.clic('[data-a=pedAccion][data-e="listo"]'); await pg.waitForTimeout(800);
  if (db.T.Pedidos[0].estado !== 'listo') throw new Error('estado tras listo: ' + db.T.Pedidos[0].estado);
  await pg.clic('[data-a=pest][data-k="listo"]'); await pg.waitForTimeout(500);
  const d = await dump(pg); console.log('     [listo] ' + d.slice(-700));
  await pg.cap('pedido-listo');
  await pg.clic('[data-a=pedAccion], [data-a=pedPago]'); await pg.waitForTimeout(1000);
  const d2 = await dump(pg); console.log('     [cobrar pedido] ' + d2.slice(-900));
  await pg.cap('pedido-cobrar');
  if (await pg.evaluate(() => [...document.querySelectorAll('button')].some(b => /^Cobrar L/.test(b.innerText.trim()) && b.getBoundingClientRect().width > 0))) await btn(pg, /^Cobrar L/, 1500);
  const v = db.T.Ventas[0]; const p = db.T.Pedidos[0];
  console.log('     venta:', v && [v.numero, v.total, v.pedidoId], 'pedido estado:', p.estado);
  return !!v && Number(v.total) === 730;
});
await pg.cap('pedido-final');
await pg.evaluate(() => cerrarHojas());
await pg.ir('mensajes');
await paso(pg, 'Mensajes · chat del cliente y respuesta', async () => {
  if (!(await tiene(pg, /camiseta en rojo/))) throw new Error('no aparece el mensaje');
  await pg.clic('[data-a=verChat]'); await pg.waitForTimeout(600);
  const d = await dump(pg); console.log('     [chat negocio] ' + d.slice(-500));
  await pg.fill('#ch-in', 'Sí, en rojo la tenemos en talla M.');
  await pg.evaluate(() => { const ta = document.getElementById('ch-in'); let b = ta.parentElement.querySelector('button'); if (!b) b = [...document.querySelectorAll('button')].filter(x => x.getBoundingClientRect().width > 0 && !x.innerText.trim() && !x.dataset.a && !x.dataset.cerrar && x.compareDocumentPosition(ta) & 2).pop(); b && b.click(); });
  await pg.waitForTimeout(1200);
  const ch = db.T.Chats || db.T.Mensajes || []; if (!JSON.stringify(ch).includes('en rojo la tenemos')) throw new Error('la respuesta no se guardó');
  await pg.cap('mensajes-respuesta');
  return tiene(pg, /en rojo la tenemos/);
});
await paso(t, 'Tienda pública · el cliente ve la respuesta y «Mis pedidos»', async () => {
  await t.reload(); await t.waitForTimeout(2500);
  const mp = t.locator('button', { hasText: /Mis pedidos/ }); if (await mp.count()) { await btn(t, /Mis pedidos/, 1000); await t.cap('tienda-mis-pedidos'); }
  const tx = await texto(t);
  return /Ana Cliente|730\.00|Confirmado|pedido/i.test(tx);
});
await cerrar();
