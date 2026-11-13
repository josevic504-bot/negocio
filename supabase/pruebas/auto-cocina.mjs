import { api, db } from './prueba.mjs';
let ok=0,mal=0; const v=(n,c,d)=>{ if(c) ok++; else { mal++; console.log('✗',n,JSON.stringify(d||'').slice(0,400)); } };
const r = await api('registrar', { negocio: 'Comedor Sol', nombre: 'Vic', giro: 'comida', whatsapp: '98111111', pin: '1234' }); const A = r.data.token;
await api('cargarEjemplos', {}, A);
await api('guardar',{entidad:'Config',registro:{tienda:'si',tiendaEntrega:'ambos'}},A);
const N=db.T.Licencias[0].id; const p=db.T.Productos.find(x=>x.activo&&x.tienda);
let q=await api('pedir',{negocio:N,nombre:'Mario Paz',telefono:'9900-1122',entrega:'recoger',pago:'Efectivo',items:[{id:p.id,cantidad:1}]}); v('pedido',q.ok,q);
const clave=q.data.chatClave, id=q.data.id;
let x=await api('estadoPedido',{id,estado:'confirmado'},A); v('confirmar',x.ok&&x.data.avisado,x);
const k=db.T.Comandas.find(c=>c.pedidoId===id); v('comanda',!!k,db.T.Comandas);
x=await api('comandaAccion',{id:k.id,estado:'lista'},A); v('comanda lista',x.ok,x);
v('pedido listo',db.T.Pedidos.find(z=>z.id===id).estado==='listo');
const c=await api('chatVer',{negocio:N,clave}); v('aviso listo desde cocina',/ya está listo/.test(c.data.mensajes.slice(-1)[0].texto),c.data.mensajes);
// mesa: sin chat ni avisos
q=await api('pedir',{negocio:N,nombre:'Ana',telefono:'9900-3344',entrega:'mesa',mesa:'2',pago:'En la mesa',items:[{id:p.id,cantidad:1}]}); v('pedido mesa',q.ok&&!q.data.chatClave,q);
console.log(ok+' bien · '+mal+' mal');
