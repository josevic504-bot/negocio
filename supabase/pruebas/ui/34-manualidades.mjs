import { nuevaPagina, ok, cerrar, esperar, api, db, OUT } from './base.mjs';
import fs from 'node:fs';
const F = JSON.parse(fs.readFileSync(process.env.FOTOS, 'utf8'));
const f64 = (fam, w, p) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync('node_modules/@fontsource/'+p).toString('base64')})}`;
const css = [400,500,600,700].map(w=>f64('Jost',w,`jost/files/jost-latin-${w}-normal.woff2`)).join('')+[500,600].map(w=>f64('Cormorant Garamond',w,`cormorant-garamond/files/cormorant-garamond-latin-${w}-normal.woff2`)).join('');
const tiro = async (pg, n) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${n}.png` }); };
// Sirve las fotos guardadas en el almacenamiento simulado (para que se vean en las capturas)
const servirFotos = async pg => pg.route(/archivos\//, rt => { const ruta = decodeURIComponent(rt.request().url().split('/archivos/')[1].split('?')[0]); const e = (db.efectos || []).find(x => x.subir && x.subir.ruta === ruta);
  return e ? rt.fulfill({ status: 200, contentType: e.subir.mime, body: Buffer.from(e.subir.b64, 'base64') }) : rt.abort(); });
const subir = async (pg, sel, data) => { const b = Buffer.from(data.split(',')[1], 'base64'); await pg.setInputFiles(sel, { name: 'ejemplo.jpg', mimeType: 'image/jpeg', buffer: b }); await pg.waitForTimeout(700); };
// Registro con el giro nuevo y ejemplos
const reg = await api('registrar', { negocio: 'Detalles Mágicos', nombre: 'Demo', giro: 'manualidades', whatsapp: '98765432', pin: '1234' }); const tok = reg.data.token;
ok('Registro con giro Manualidades', reg.ok, JSON.stringify(reg).slice(0, 150));
const ej = await api('cargarEjemplos', {}, tok); ok('Ejemplos del giro', ej.ok && ej.data.agregados === 8, JSON.stringify(ej).slice(0, 150));
await api('guardar', { entidad: 'Config', registro: { tienda: 'si', tiendaEntrega: 'ambos', tiendaEnvio: '80', tiendaPagos: 'Efectivo,Transferencia' } }, tok);
const N = db.T.Licencias[0].id, P = n => db.T.Productos.find(x => x.nombre.startsWith(n));
// Tienda: botón de diseño personalizado
const t = await nuevaPagina({}); await servirFotos(t); await t.goto('http://localhost:8765/?tienda=' + N); await t.waitForTimeout(1500); await t.addStyleTag({ content: css });
ok('Botón Pide tu diseño', await t.locator('[data-pers]').count() === 1);
ok('No sale Arma tu ramo', await t.locator('[data-ramo]').count() === 0);
await t.evaluate(() => { document.querySelector('[data-pers]').scrollIntoView({ block: 'center' }); }); await tiro(t, '1-tienda');
// Pedir diseño
await t.evaluate(() => document.querySelector('[data-pers]').click()); await t.waitForTimeout(500);
await t.evaluate(() => [...document.querySelectorAll('#rd-c .chip')].find(c => c.dataset.c === 'Cajas y regalos').click());
await t.fill('#rd-d', 'Caja de madera con 6 fotos por dentro, luces y un mensaje de cumpleaños. Colores rosado y dorado.');
await subir(t, '#rd-in', F.caja); await subir(t, '#rd-in', F.estrella);
await t.fill('#rd-q', '2'); await t.fill('#rd-pre', '1200'); await t.fill('#rd-fe', '2026-11-20');
await t.fill('#rd-n', 'Karla Mejía'); await t.fill('#rd-t', '9812-3456');
await t.evaluate(() => document.querySelector('#rd-ent [data-e="domicilio"]').click()); await t.fill('#rd-dir', 'Col. Los Álamos, casa 8');
await t.evaluate(() => document.querySelector('.sheet-b').scrollTo(0, 0)); await tiro(t, '2-pide-diseno');
await t.evaluate(() => [...document.querySelectorAll('.sheet-f button')].pop().click()); await t.waitForTimeout(1000);
let ped = db.T.Pedidos[0], cot = JSON.parse(ped.cotiza || '{}');
ok('Solicitud por cotizar', ped && ped.estado === 'cotizar' && Number(ped.presupuesto) === 1200 && cot.personal === 1 && cot.cat === 'Cajas y regalos' && cot.cant === 2 && cot.fotos.length === 2 && /Para el/.test(ped.nota), JSON.stringify(ped).slice(0, 400));
ok('Tus pedidos: esperando precio', /Esperando precio/.test(await t.locator('#t-mis').innerText()) && /Diseño personalizado/.test(await t.locator('#t-mis').innerText()));
// Producto con «Personalízalo»: texto + imagen
await t.evaluate(id => tProducto(id), P('Taza personalizada').id); await t.waitForTimeout(600);
ok('Producto: recuadro Personalízalo', await t.locator('.pers-box').count() === 1 && await t.locator('#tp-fi').count() === 1);
await t.evaluate(() => [...document.querySelectorAll('[data-v]')].find(b => b.dataset.v === 'Mágica').click());
await t.fill('#tp-fe', '2026-11-18'); await t.fill('#tp-no', 'Feliz día, mamá'); await subir(t, '#tp-fi', F.taza);
await t.evaluate(() => document.querySelector('.pers-box').scrollIntoView({ block: 'center' })); await tiro(t, '3-producto-personalizalo');
await t.evaluate(() => [...document.querySelectorAll('.sheet-f button')].pop().click()); await t.waitForTimeout(500);
// Segunda taza con otra imagen y el mismo texto: línea aparte
await t.evaluate(id => tProducto(id), P('Taza personalizada').id); await t.waitForTimeout(500);
await t.evaluate(() => [...document.querySelectorAll('[data-v]')].find(b => b.dataset.v === 'Blanca').click());
await t.fill('#tp-fe', '2026-11-18'); await subir(t, '#tp-fi', F.estrella);
await t.evaluate(() => [...document.querySelectorAll('.sheet-f button')].pop().click()); await t.waitForTimeout(500);
// Llavero sin imagen
await t.evaluate(id => tProducto(id), P('Llavero').id); await t.waitForTimeout(500); await t.fill('#tp-fe', '2026-11-18'); await t.fill('#tp-no', 'Sofía');
await t.evaluate(() => [...document.querySelectorAll('.sheet-f button')].pop().click()); await t.waitForTimeout(500);
const cartN = await t.evaluate(() => Object.keys(T.cart).length), fotosN = await t.evaluate(() => Object.keys(T.fotos).length);
ok('Carrito con 3 líneas y 2 imágenes', cartN === 3 && fotosN === 2, cartN + ' / ' + fotosN);
// Recargar la página: las imágenes siguen
await t.reload(); await t.waitForTimeout(1500); await t.addStyleTag({ content: css });
ok('Imágenes se conservan al recargar', await t.evaluate(() => Object.keys(T.fotos).length) === 2);
// Hacer el pedido
await t.evaluate(() => { const b = document.querySelector('#t-carbtn, .cart-b, [data-carrito]'); if (b) b.click(); else tCarrito(); }); await t.waitForTimeout(600);
await tiro(t, '4-carrito');
const btn = await t.evaluate(() => { const b = [...document.querySelectorAll('.sheet-f button')].pop(); return b ? b.textContent : ''; }); console.log('botón carrito:', btn);
await t.evaluate(() => [...document.querySelectorAll('.sheet-f button')].pop().click()); await t.waitForTimeout(700);
const sh = await t.evaluate(() => [...document.querySelectorAll('.sheet')].pop().innerText.slice(0, 200)); console.log('hoja:', sh.replace(/\s+/g, ' '));
if (await t.$('#tc-n')) { await t.fill('#tc-n', 'Karla Mejía'); await t.fill('#tc-t', '9812-3456'); }
await t.evaluate(() => [...document.querySelectorAll('.sheet-f button')].pop().click()); await t.waitForTimeout(1200);
const p2 = db.T.Pedidos.find(x => x.id !== ped.id); const its = p2 ? JSON.parse(p2.items) : [];
ok('Pedido con imágenes por línea', p2 && its.length === 3 && its.filter(i => i.foto).length === 2 && its.some(i => /Feliz día, mamá/.test(i.nombre) && i.foto), p2 ? p2.items : 'sin pedido');
ok('Pedido normal no se vuelve cotización', p2 && p2.estado === 'nuevo' && !p2.cotiza, p2 && (p2.estado + ' ' + p2.cotiza));
ok('Carrito e imágenes se vacían', await t.evaluate(() => Object.keys(T.fotos).length + Object.keys(T.cart).length) === 0);
// Programa: por cotizar y poner precio
const pg = await nuevaPagina({ token: tok }); await servirFotos(pg); await pg.goto('http://localhost:8765/'); await esperar(pg, 8000); await pg.waitForTimeout(600); await pg.addStyleTag({ content: css });
await pg.ir('pedidos');
const tp = await pg.txt();
ok('App: Por cotizar con descripción y presupuesto', /Por cotizar/.test(tp) && /Diseño personalizado · Cajas y regalos/.test(tp) && /a cotizar/.test(tp) && /Presupuesto del cliente/.test(tp), tp.slice(0, 400));
ok('App: fotos de ejemplo en la tarjeta', await pg.locator('.ramo-fotos img').count() === 2);
await tiro(pg, '5-app-por-cotizar');
await pg.evaluate(id => document.querySelector(`[data-a="pedAccion"][data-e="cotizar"][data-id="${id}"]`).click(), ped.id); await pg.waitForTimeout(500);
const hs = await pg.hojaTxt();
ok('Hoja de precio del diseño', /Diseño personalizado ·/.test(hs) && /Precio total/.test(hs) && !/Editar flores/.test(hs) && !/Flores a precio/.test(hs), hs.slice(0, 300));
await pg.fill('#cr-p', '1150'); await pg.fill('#cr-n', 'Incluye luces LED y tarjeta.');
await tiro(pg, '6-poner-precio');
await pg.evaluate(() => [...document.querySelectorAll('.sheet-f button')].filter(b => /Enviar precio/.test(b.textContent)).pop().click()); await pg.waitForTimeout(800);
const msj = await pg.evaluate(() => document.querySelector('.msg-prev').textContent);
ok('WhatsApp habla del diseño', /Tu diseño personalizado queda en L 1,150\.00 \+ envío L 80\.00/.test(msj.replace(/\s/g, ' ')) && /&ramo=/.test(msj), msj);
await pg.evaluate(() => cerrarHojas());
ped = db.T.Pedidos.find(x => x.id === ped.id); const its1 = JSON.parse(ped.items);
ok('Cotizado: una línea con precio total', ped.estado === 'cotizado' && its1.length === 1 && its1[0].tipo === 'ramo' && its1[0].precio === 1150 && /\(2 unidades\)/.test(its1[0].nombre) && Number(ped.total) === 1230, ped.items + ' ' + ped.total);
const er = await api('editarRamo', { id: ped.id, nombres: [], cantidades: [] }, tok); ok('No edita flores en un diseño', !er.ok && /diseño/.test(er.error));
// Cliente ve y pregunta, luego acepta
await t.evaluate(() => misPedidosTienda()); await t.waitForTimeout(700);
const tw = (await t.locator('#t-mis').innerText()).replace(/\s+/g, ' ');
ok('Tienda: precio del diseño', /La tienda te propone L 1,150\.00/.test(tw) && /Cajas y regalos · 2 unidades/.test(tw) && /Dudas sobre tu diseño/.test(tw), tw.slice(0, 400));
await t.evaluate(() => { document.querySelector('#t-mis').scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); }); await tiro(t, '7-tienda-precio');
await t.evaluate(() => document.querySelector('[data-pq]').click()); await t.waitForTimeout(500);
await t.fill('#tch-in', '¿Puede llevar mi nombre en la tapa?'); await t.evaluate(() => document.querySelector('#tch-send').click()); await t.waitForTimeout(900);
ok('Mensaje con etiqueta de diseño', /^⟦✨ Cotización de diseño P-00001 · L 1,230\.00⟧/.test(db.T.Mensajes[0].texto), db.T.Mensajes[0].texto);
await t.evaluate(() => cerrarHojas()); await t.waitForTimeout(300);
await t.evaluate(() => document.querySelector('[data-rr][data-si="1"]').click()); await t.waitForTimeout(900);
ok('Aceptado → Nuevo', db.T.Pedidos.find(x => x.id === ped.id).estado === 'nuevo');
// Ver pedido normal: imágenes por línea; cobrar el diseño
await pg.evaluate(() => { S.pedidosL = null; S.f.pest = 'nuevo'; R.pedidos(); }); await pg.waitForTimeout(700);
await pg.evaluate(id => document.querySelector(`[data-a="verPedido"][data-id="${id}"]`).click(), p2.id); await pg.waitForTimeout(500);
ok('Ver pedido: imágenes del cliente', await pg.locator('.sheet .it-foto').count() === 2);
await tiro(pg, '8-ver-pedido-imagenes');
await pg.evaluate(() => cerrarHojas());
for (const s of ['confirmado', 'listo']) await api('estadoPedido', { id: ped.id, estado: s }, tok);
await pg.evaluate(() => { S.pedidosL = null; S.f.pest = 'listo'; R.pedidos(); }); await pg.waitForTimeout(700);
await pg.evaluate(id => document.querySelector(`[data-a="pedAccion"][data-e="cobrar"][data-id="${id}"]`).click(), ped.id); await pg.waitForTimeout(900);
const tk = await pg.evaluate(() => S.ticket.items.map(i => [i.descripcion, i.precio]));
ok('Cobro: diseño + envío', tk.length === 2 && tk[0][1] === 1150 && tk[1][1] === 80, JSON.stringify(tk));
// El cliente cambia la cantidad de su taza con imagen: la imagen sigue en la línea
const mp = await api('misPedidos', { negocio: N, telefono: '9812-3456', ids: [p2.id] });
const lp = mp.data[0], li = lp.lineas.findIndex(x => /Imagen: 1/.test(x.opcion || x.nombre));
const ce = await api('pedidoClienteEditar', { negocio: N, id: p2.id, telefono: '9812-3456', version: lp.version, linea: li, cantidad: 2, opcion: lp.lineas[li].opcion });
const its2 = JSON.parse(db.T.Pedidos.find(x => x.id === p2.id).items);
ok('Cliente edita cantidad y la imagen se queda', ce.ok && its2.find(i => /Imagen: 1/.test(i.nombre)).cantidad === 2 && !!its2.find(i => /Imagen: 1/.test(i.nombre)).foto, JSON.stringify(ce).slice(0, 200));
// Eliminar borra también las imágenes de las líneas (no da error)
const el = await api('eliminarPedido', { id: p2.id }, tok); ok('Eliminar pedido con imágenes', el.ok);
// Imagen de la guía: formulario del producto
await pg.evaluate(() => { cerrarHojas(); S.ticket = { items: [], clienteId: '', pedidoId: '', descuento: 0 }; });
fs.writeFileSync(OUT + '/taza-id.txt', P('Taza personalizada').id);
await cerrar();
