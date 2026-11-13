// 1.9.77: mensajes automáticos de la tienda al comprador (pedido recibido, confirmado, listo, pago, cancelado, precio de ramo, fuera de horario, bienvenida)
import { api, db } from './prueba.mjs';
let ok=0, mal=0; const v=(n,c,d)=>{ if(c) ok++; else { mal++; console.log('✗',n,d===undefined?'':JSON.stringify(d)); } };
const reg = await api('registrar',{negocio:'Variedades Demo',nombre:'Demo',giro:'variedades',whatsapp:'98765432',pin:'1234'}); const tok=reg.data.token;
await api('cargarEjemplos',{},tok);
const N=db.T.Licencias[0].id;
const g=await api('guardar',{entidad:'Config',registro:{tienda:'si',tiendaEntrega:'ambos',tiendaPagos:'Efectivo,Transferencia',tiendaAbre:'00:00',tiendaCierra:'23:59',tiendaDias:'0,1,2,3,4,5,6'}},tok);
v('config guardada',g.ok,g);
const prod=db.T.Productos.find(x=>x.activo&&x.tienda&&x.tipo==='producto'&&x.stock>3);
const tel='9911-2233';
const pedir=x=>api('pedir',Object.assign({negocio:N,nombre:'María Rodríguez',telefono:tel,entrega:'recoger',pago:'Efectivo',items:[{id:prod.id,cantidad:1}]},x||{}));
const msgs=clave=>api('chatVer',{negocio:N,clave});
let r=await pedir(); v('pedido',r.ok,r);
const clave=r.data.chatClave; v('trae clave del chat',!!clave,r.data);
let c=await msgs(clave); v('mensaje recibido',c.ok&&c.data.mensajes.length===1&&c.data.mensajes[0].auto&&/Recibimos tu pedido/.test(c.data.mensajes[0].texto)&&/María!/.test(c.data.mensajes[0].texto),c.data);
const id=r.data.id;
v('pedido ligado al chat',db.T.Pedidos.find(x=>x.id===id).chatId===db.T.Chats.find(x=>x.clave===clave).id);
r=await api('estadoPedido',{id,estado:'confirmado'},tok); v('confirmar avisa',r.ok&&r.data.avisado===true,r);
r=await api('estadoPedido',{id,estado:'listo'},tok); v('listo avisa',r.ok&&r.data.avisado===true,r);
c=await msgs(clave); v('3 automáticos',c.data.mensajes.length===3,c.data.mensajes);
v('texto listo recoger',/Puedes pasar a recogerlo\. Total: L/.test(c.data.mensajes[2].texto),c.data.mensajes[2]);
// Lista de chats del negocio: se ve con el último texto, sin «sin leer»
let L=await api('chats',{},tok); const ch=L.data.find(x=>x.telefono.endsWith('99112233'));
v('chat en la lista',ch&&ch.sinLeer===0&&/listo/.test(ch.ultimoTexto),ch);
let A=await api('chat',{id:ch.id},tok); v('negocio ve marca auto',A.data.mensajes.every(m=>m.auto===true),A.data.mensajes);
// cliente responde y negocio contesta: no es automático
r=await api('chatEnviar',{negocio:N,clave,texto:'¿Puedo pasar a las 4?'}); v('cliente escribe',r.ok&&r.data.mensajes.length===4,r);
v('sin bienvenida (apagada) ni cerrado (abierto)',r.data.mensajes.filter(m=>m.auto).length===3,r.data.mensajes);
r=await api('chatResponder',{id:ch.id,texto:'¡Claro!'},tok); v('respuesta manual sin auto',r.ok&&!r.data.mensajes[4].auto,r.data.mensajes[4]);
// segundo pedido desde el mismo teléfono con su clave: mismo chat
r=await pedir({chatClave:clave}); v('mismo chat con su clave',r.ok&&r.data.chatClave===clave,r.data);
const id2=r.data.id;
// clave ajena (otro número) no se reutiliza
const r3=await pedir({chatClave:clave,telefono:'3344-5566',nombre:'Pedro Pérez'}); v('clave ajena: chat nuevo',r3.ok&&r3.data.chatClave&&r3.data.chatClave!==clave,r3.data);
// cancelar con motivo
r=await api('estadoPedido',{id:id2,estado:'cancelado',motivo:'Se agotó'},tok); v('cancelado avisa',r.ok&&r.data.avisado,r);
c=await msgs(clave); v('motivo en texto',/cancelado\. Motivo: Se agotó\. Si tienes/.test(c.data.mensajes[c.data.mensajes.length-1].texto),c.data.mensajes.slice(-1));
// apagar confirmado: no avisa
await api('guardar',{entidad:'Config',registro:{autoConfirmado:'no',msjAutoListo:'Ya está {numero} — {entrega}'}},tok);
r=await pedir({chatClave:clave,entrega:'domicilio',direccion:'Col. Moderna, 3 calle'}); const id4=r.data.id;
r=await api('estadoPedido',{id:id4,estado:'confirmado'},tok); v('apagado no avisa',r.ok&&r.data.avisado===false,r.data.avisado);
r=await api('estadoPedido',{id:id4,estado:'listo'},tok); c=await msgs(clave);
v('texto editado + domicilio',/^Ya está P-\d+ — Va en camino/.test(c.data.mensajes[c.data.mensajes.length-1].texto),c.data.mensajes.slice(-1));
// pago
r=await pedir({chatClave:clave,pago:'Transferencia'}); const id5=r.data.id;
db.T.Pedidos.find(x=>x.id===id5).comprobante='x.jpg'; db.T.Pedidos.find(x=>x.id===id5).pagoEstado='revisar';
r=await api('pedidoPago',{id:id5,ok:false},tok); v('pago no coincide avisa',r.ok&&r.data.avisado,r);
r=await api('pedidoPago',{id:id5,ok:true},tok); v('pago ok avisa',r.ok&&r.data.avisado,r);
c=await msgs(clave); v('textos de pago',/no coincide/.test(c.data.mensajes.slice(-2)[0].texto)&&/Recibimos tu pago/.test(c.data.mensajes.slice(-1)[0].texto),c.data.mensajes.slice(-2));
// chats apagados: sin clave ni avisos
await api('guardar',{entidad:'Config',registro:{tiendaChat:'no'}},tok);
r=await pedir({telefono:'5566-7788',nombre:'Ana Gómez'}); v('chat apagado sin clave',r.ok&&!r.data.chatClave,r.data);
r=await api('estadoPedido',{id:r.data.id,estado:'confirmado'},tok); v('chat apagado no avisa',r.ok&&!r.data.avisado,r.data.avisado);
await api('guardar',{entidad:'Config',registro:{tiendaChat:'si'}},tok);
// pedido sin avisos encendidos: chat vacío no sale en la lista
await api('guardar',{entidad:'Config',registro:{autoRecibido:'no'}},tok);
r=await pedir({telefono:'7788-9900',nombre:'Luis Mejía'}); v('clave aunque no avise',r.ok&&!!r.data.chatClave,r.data);
L=await api('chats',{},tok); v('chat vacío oculto',!L.data.some(x=>x.telefono.endsWith('77889900')),L.data.map(x=>x.telefono));
r=await api('estadoPedido',{id:r.data.id,estado:'cancelado'},tok); L=await api('chats',{},tok);
v('con aviso ya sale',L.data.some(x=>x.telefono.endsWith('77889900')),L.data.map(x=>x.telefono));
// fuera de horario (cerrado todo el día de hoy) y bienvenida
await api('guardar',{entidad:'Config',registro:{tiendaAbre:'23:58',tiendaCierra:'23:59',tiendaDias:'0,1,2,3,4,5,6',autoBienvenida:'si'}},tok);
r=await api('chatEnviar',{negocio:N,nombre:'Rosa Díaz',telefono:'3322-1100',texto:'Hola, ¿tienen envíos?'});
v('fuera de horario responde',r.ok&&r.data.mensajes.length===2&&r.data.mensajes[1].auto&&/cerrados\. Abrimos hoy a las 11:58 p\. m\./.test(r.data.mensajes[1].texto),r.data.mensajes);
const k2=r.data.clave;
r=await api('chatEnviar',{negocio:N,clave:k2,texto:'¿y a Choloma?'}); v('una sola vez',r.ok&&r.data.mensajes.length===3,r.data.mensajes);
L=await api('chats',{},tok); const rc=L.data.find(x=>x.telefono.endsWith('33221100'));
v('sigue sin leer para el negocio',rc&&rc.sinLeer===2&&rc.deCliente===true,rc);
await api('guardar',{entidad:'Config',registro:{autoCerrado:'no'}},tok);
r=await api('chatEnviar',{negocio:N,nombre:'Juan Paz',telefono:'2211-0099',texto:'Buenas'});
v('bienvenida al primer mensaje',r.ok&&r.data.mensajes.length===2&&/Hola Juan 👋 Gracias por escribirnos/.test(r.data.mensajes[1].texto),r.data.mensajes);
r=await api('chatEnviar',{negocio:N,clave:r.data.clave,texto:'otra cosa'}); v('bienvenida solo una vez',r.data.mensajes.length===3,r.data.mensajes);
// ramo (floristería)
const reg2 = await api('registrar',{negocio:'Flores Demo',nombre:'Demo',giro:'floristeria',whatsapp:'98760000',pin:'1234'}); const tok2=reg2.data.token;
await api('cargarEjemplos',{},tok2); const N2=db.T.Licencias.find(x=>x.negocio==='Flores Demo').id;
await api('guardar',{entidad:'Config',registro:{tienda:'si',tiendaEntrega:'ambos'}},tok2);
const fl=db.T.Productos.filter(x=>x.negocio_id===N2&&x.activo&&/flores sueltas/i.test(x.categoria))[0];
r=await api('pedir',{negocio:N2,ramo:true,presupuesto:800,items:[{id:fl.id,cantidad:6}],nombre:'Carla Núñez',telefono:'9988-7766',entrega:'recoger',pago:'Efectivo',nota:'x'});
v('ramo pedido con clave',r.ok&&!!r.data.chatClave,r);
const kr=r.data.chatClave; c=await api('chatVer',{negocio:N2,clave:kr}); v('ramo: solicitud recibida',/Recibimos tu solicitud/.test(c.data.mensajes[0].texto),c.data);
r=await api('cotizarRamo',{id:r.data.id,precio:950},tok2); v('precio enviado avisa',r.ok&&r.data.avisado,r);
c=await api('chatVer',{negocio:N2,clave:kr}); v('texto precio',/Ya tenemos el precio de tu pedido .*: L 950\.00/.test(c.data.mensajes[1].texto),c.data.mensajes);
console.log(`\n${ok} bien · ${mal} mal`);
process.exit(mal?1:0);
