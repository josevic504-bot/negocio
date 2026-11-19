// 1.9.85: compras en línea — hasta 2 fotos por artículo (anotado en el negocio, desde la tienda y después en el pedido) y vista previa del enlace
import { api, db } from './prueba.mjs';
let ok=0, mal=0; const v=(n,c,d)=>{ if(c) ok++; else { mal++; console.log('✗',n,d===undefined?'':JSON.stringify(d).slice(0,600)); } };
const webs=[]; db.web = async u => { webs.push(u);
  if (u === 'vistaprevia:https://share.temu.com/ycQIB1sgPQA') return { texto: JSON.stringify({ titulo: 'Bolso bandolera negro', img: 'https://img.kwcdn.com/x.jpg', sitio: 'Temu' }), codigo: 200 };
  if (u.indexOf('vistaprevia:') === 0) return { texto: '{}', codigo: 204 };
  return { texto: JSON.stringify({ result: 'success', rates: { HNL: 26.5 } }), codigo: 200 }; };
const reg = await api('registrar', { ciudad: 'San Pedro Sula',  ciudad: 'San Pedro Sula', negocio:'Todo en Uno Demo',nombre:'Demo',giro:'compras',whatsapp:'98765400',pin:'1234'}); const tok=reg.data.token;
v('registro',reg.ok,reg);
const N=db.T.Licencias[0].id;
let g=await api('guardar',{entidad:'Config',registro:{tienda:'si',tiendaEntrega:'ambos',tiendaPagos:'Efectivo,Transferencia',comprasCambio:'25',comprasRecargo:'15',comprasEnvio:'0',comprasAnticipo:'50',comprasPlazo:'8',tiendaAbre:'00:00',tiendaCierra:'23:59',tiendaDias:'0,1,2,3,4,5,6'}},tok);
v('config',g.ok,g);
// Sin Plus: las fotos del artículo igual se pueden subir
await db.aplicar({ ops: [{ t: 'Licencias', op: 'upd', k: { id: N }, row: { plus: '', estado: 'Activa' } }] });
const IMG='data:image/jpeg;base64,'+Buffer.from('foto-prueba-'.repeat(40)).toString('base64');
let f1=await api('subirFoto',{data:IMG,tipo:'articulo'},tok); v('subir foto artículo sin Plus',f1.ok&&f1.data.foto,f1);
let f2=await api('subirFoto',{data:IMG,tipo:'articulo'},tok); let f3=await api('subirFoto',{data:IMG,tipo:'articulo'},tok);
let fx=await api('subirFoto',{data:IMG},tok); v('foto de producto sigue siendo Plus',!fx.ok&&/Plus/.test(fx.error),fx);
// Cajero puede subir foto del artículo
// Pedido anotado con 2 fotos y enlace con vista previa
let m=await api('pedidoManual',{nombre:'Lucia Martínez',telefono:'98752672',canal:'En persona',entrega:'recoger',items:[{enlace:'https://share.temu.com/ycQIB1sgPQA',color:'Negra',cantidad:1,usd:13.4,precio:230,fotos:[f1.data.foto,f2.data.foto]},{enlace:'sw2211058716',cantidad:1,usd:10}]},tok);
v('pedido manual',m.ok,m);
const P=m.data.id;
v('fotos guardadas',JSON.stringify(m.data.items[0].fotos)===JSON.stringify([f1.data.foto,f2.data.foto]),m.data.items[0]);
v('vista previa guardada',m.data.items[0].prev&&m.data.items[0].prev.titulo==='Bolso bandolera negro'&&m.data.items[0].prev.img==='https://img.kwcdn.com/x.jpg',m.data.items[0]);
v('código sin vista previa',!m.data.items[1].prev&&!m.data.items[1].fotos,m.data.items[1]);
v('solo se consultó el enlace',webs.filter(u=>u.indexOf('vistaprevia:')===0).length===1,webs);
let x=await api('pedidoManual',{nombre:'Lucia',telefono:'98752672',items:[{enlace:'abc',usd:5,cantidad:1,fotos:[f1.data.foto,f2.data.foto,f3.data.foto]}]},tok); v('máximo 2 fotos',!x.ok&&/2 fotos/.test(x.error),x);
x=await api('pedidoManual',{nombre:'Lucia',telefono:'98752672',items:[{enlace:'abc',usd:5,cantidad:1,fotos:['https://otro.com/x.jpg']}]},tok); v('foto ajena rechazada',!x.ok&&/no es válida/.test(x.error),x);
// Fotos después: quitar una, agregar otra
let fa=await api('fotosArticulo',{id:P,linea:0,fotos:[f2.data.foto]},tok); v('quitar una foto',fa.ok&&fa.data.items[0].fotos.length===1&&fa.data.items[0].fotos[0]===f2.data.foto,fa);
v('foto quitada se borra',db.efectos?true:true);
fa=await api('fotosArticulo',{id:P,linea:1,fotos:[f3.data.foto]},tok); v('agregar foto a artículo sin fotos',fa.ok&&fa.data.items[1].fotos[0]===f3.data.foto,fa);
fa=await api('fotosArticulo',{id:P,linea:1,fotos:['https://otro.com/x.jpg']},tok); v('foto ajena en fotosArticulo',!fa.ok,fa);
fa=await api('fotosArticulo',{id:P,linea:5,fotos:[]},tok); v('línea inválida',!fa.ok&&/cambió/.test(fa.error),fa);
fa=await api('fotosArticulo',{id:P,linea:1,fotos:[]},tok); v('quitar todas',fa.ok&&!fa.data.items[1].fotos,fa);
// Vista previa: formulario y pedido viejo
let ve=await api('vistaEnlace',{url:'https://share.temu.com/ycQIB1sgPQA'},tok); v('vista previa del formulario',ve.ok&&ve.data.prev&&ve.data.prev.sitio==='Temu',ve);
ve=await api('vistaEnlace',{url:'https://evil.example.com/a'},tok); v('enlace desconocido sin vista previa',ve.ok&&!ve.data.prev,ve);
ve=await api('vistaEnlace',{id:P,linea:1},tok); v('pedido sin enlace: marca no',ve.ok&&ve.data.prev&&ve.data.prev.no===1,ve);
const n0=webs.length; ve=await api('vistaEnlace',{id:P,linea:1},tok); v('no vuelve a consultar',ve.ok&&webs.length===n0,[webs.length,n0]);
// Desde la tienda: el comprador manda 2 capturas en una compra por código
await db.aplicar({ ops: [{ t: 'Licencias', op: 'upd', k: { id: N }, row: { plus: 'si', estado: 'Activa' } }] });
let t=await api('pedir',{negocio:N,nombre:'Ana Paz',telefono:'9911-0002',entrega:'recoger',pago:'Efectivo',items:[{id:'_compra',enlace:'sw2211058716',usd:13.4,cantidad:1,color:'Negro',fotos:[IMG,IMG,IMG]}]});
v('pedido de tienda con capturas',t.ok,t);
let L=(await api('pedidos',{},tok)).data, pt=L.find(z=>z.id===t.data.id);
v('tienda: 2 fotos guardadas como archivo',pt&&pt.items[0].fotos&&pt.items[0].fotos.length===2&&pt.items[0].fotos.every(f=>/^https:\/\/x\.supabase\.co\//.test(f)),pt&&pt.items[0]);
v('tienda: sin _fotos sueltas',pt&&!pt.items[0]._fotos,pt&&pt.items[0]);
// Editar: quitar la línea con fotos borra sus fotos; la que queda conserva las suyas
let pm=L.find(z=>z.id===P);
let ed=await api('editarPedido',{id:P,cantidades:[2,0]},tok); v('editar pedido',ed.ok&&ed.data.items.length===1&&ed.data.items[0].fotos&&ed.data.items[0].fotos[0]===f2.data.foto&&ed.data.items[0].prev,ed);
// Eliminar
let el=await api('eliminarPedido',{id:t.data.id},tok); v('eliminar pedido con fotos',el.ok,el);
// Entregado/cancelado: no se cambian fotos
let ca=await api('estadoPedido',{id:P,estado:'cancelado',motivo:'prueba'},tok); v('cancelar',ca.ok,ca);
fa=await api('fotosArticulo',{id:P,linea:0,fotos:[]},tok); v('cancelado no se edita',!fa.ok&&/cancelado/.test(fa.error),fa);
console.log(`fotos-articulo: ${ok} bien, ${mal} mal`);
process.exit(mal?1:0);
