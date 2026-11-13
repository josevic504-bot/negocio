// 1.9.81: compras en línea — factura (varios pedidos), en camino, llegó (apartado), entrega con costo real y segundo pago, liberar
import { api, db } from './prueba.mjs';
let ok=0, mal=0; const v=(n,c,d)=>{ if(c) ok++; else { mal++; console.log('✗',n,d===undefined?'':JSON.stringify(d).slice(0,600)); } };
const reg = await api('registrar',{negocio:'Todo en Uno Demo',nombre:'Demo',giro:'compras',whatsapp:'98765400',pin:'1234'}); const tok=reg.data.token;
v('registro',reg.ok,reg);
const N=db.T.Licencias[0].id;
let g=await api('guardar',{entidad:'Config',registro:{tienda:'si',tiendaEntrega:'ambos',tiendaPagos:'Efectivo,Transferencia',comprasCambio:'25',comprasRecargo:'15',comprasEnvio:'0',comprasAnticipo:'50',comprasPlazo:'8',tiendaAbre:'00:00',tiendaCierra:'23:59',tiendaDias:'0,1,2,3,4,5,6'}},tok);
v('config',g.ok,g);
await api('bootstrap',{},tok);
const pedir=(nombre,tel,arts)=>api('pedir',{negocio:N,nombre,telefono:tel,entrega:'recoger',pago:'Efectivo',items:arts.map(a=>Object.assign({id:'_compra',cantidad:1},a))});
let r1=await pedir('María López','9911-0001',[{enlace:'SH-BLUSA-1',usd:18,talla:'M',color:'Negro'},{enlace:'SH-SAND-2',usd:21,talla:'38'}]); v('pedido 1',r1.ok,r1);
let r2=await pedir('Ana Paz','9911-0002',[{enlace:'SH-VEST-3',usd:30,cantidad:2}]); v('pedido 2',r2.ok,r2);
const P1=r1.data.id, P2=r2.data.id;
let L=(await api('pedidos',{},tok)).data; const p1=L.find(x=>x.id===P1), p2=L.find(x=>x.id===P2);
v('items compra',p1.items.length===2&&p1.items.every(i=>i.tipo==='compra'),p1.items);
// anticipo de María
let a=await api('anticipoPedido',{id:P1,monto:p1.anticipo,metodo:'Efectivo'},tok); v('anticipo',a.ok&&a.data.anticipoPagado===p1.anticipo,a);
// Validaciones
let x=await api('compraFactura',{pedidos:[{id:P1,costos:[210]}]},tok); v('costos incompletos',!x.ok&&/cambió/.test(x.error),x);
x=await api('compraFactura',{pedidos:[{id:P1,costos:[210,'']}]},tok); v('costo vacío',!x.ok&&/costo/.test(x.error),x);
// Factura con 2 pedidos, envío sumado al costo, en camino
const comprasAntes=(db.T.Compras||[]).length, stockAntes=JSON.stringify((db.T.Productos||[]).map(p=>[p.id,p.stock]));
let f=await api('compraFactura',{pedidos:[{id:P1,costos:[210,280]},{id:P2,costos:[400]}],proveedor:'Shein',factura:'GSHN7X2K',metodo:'Tarjeta',envio:130,modo:'costo',llego:false},tok);
v('factura ok',f.ok,f);
const C=f.data.compra;
// costos con envío: valor 210+280+800=1290 → 130 se reparte
const pf1=f.data.pedidos.find(x=>x.id===P1), pf2=f.data.pedidos.find(x=>x.id===P2);
const esperado1=210+130*210/1290, esperado3=400+130*800/1290/2;
v('costo con envío',Math.abs(pf1.recibo.costos[0]-esperado1)<0.01&&Math.abs(pf2.recibo.costos[0]-esperado3)<0.01,[pf1.recibo.costos,pf2.recibo.costos]);
v('total compra = costos + envío',Math.abs(C.total-1420)<0.02,C);
v('proveedor Shein creado',db.T.Proveedores.some(p=>p.nombre==='Shein'&&p.id===C.proveedorId));
v('detalle sin producto',db.T.CompraDetalle.filter(x=>x.compraId===C.id).length===3&&db.T.CompraDetalle.filter(x=>x.compraId===C.id).every(x=>!x.productoId));
v('sin gasto en modo costo',!f.data.gasto&&!(db.T.Gastos||[]).some(x=>/Envío Shein/.test(x.detalle)));
v('existencias del catálogo no cambian',JSON.stringify((db.T.Productos||[]).map(p=>[p.id,p.stock]))===stockAntes);
v('en camino = confirmado',pf1.estado==='confirmado'&&!pf1.recibo.llego,pf1);
v('aviso en camino',pf1.avisado===true,pf1.avisado);
x=await api('compraFactura',{pedidos:[{id:P1,costos:[1,1]}]},tok); v('no dos veces',!x.ok&&/ya tiene su factura/.test(x.error),x);
x=await api('editarPedido',{id:P1,cantidades:[1,0]},tok); v('no editar con factura',!x.ok&&/factura/.test(x.error),x);
x=await api('estadoPedido',{id:P1,estado:'cancelado'},tok); v('no cancelar con factura',!x.ok&&/Liberar/.test(x.error),x);
x=await api('estadoPedido',{id:P1,estado:'listo'},tok); v('listo pide Ya llegó',!x.ok&&/Ya llegó/.test(x.error),x);
x=await api('eliminarPedido',{id:P2},tok); v('no eliminar con factura',!x.ok&&/factura/.test(x.error),x);
// Cobrar en camino: no
const ticket=p=>({pedidoId:p.id,clienteId:p.clienteId||'',metodo:'Efectivo',items:p.items.map(i=>({productoId:'',descripcion:i.nombre,cantidad:i.cantidad,precio:i.precio}))});
x=await api('venta',ticket(p1),tok); v('no entregar en camino',!x.ok&&/en camino/.test(x.error),x);
let res=(await api('inicio',{},tok)).data.apartados; v('inicio: 2 en camino',res&&res.camino===2&&res.apartados===0,res);
// Llegó
let ll=await api('compraLlego',{ids:[P1,P2]},tok); v('llegó',ll.ok&&ll.data.length===2&&ll.data.every(x=>x.estado==='listo'&&x.recibo.vence),ll);
v('vence en 8 días',ll.data[0].recibo.vence===new Date(Date.now()+8*864e5-6*36e5).toISOString().slice(0,10),ll.data[0].recibo.vence);
v('aviso llegó',ll.data[0].avisado===true,ll.data[0]);
const chat=db.T.Mensajes.filter(m=>m.chatId===db.T.Pedidos.find(p=>p.id===P1).chatId).map(m=>m.texto);
v('textos camino y llegó',chat.some(t=>/Va en camino/.test(t))&&chat.some(t=>/Llegó tu pedido .* apartado .* hasta el \d+ de \w+\. Te falta pagar L/.test(t)),chat);
res=(await api('inicio',{},tok)).data.apartados; v('inicio: 2 apartados',res.apartados===2&&res.camino===0&&res.valor>1400,res);
// El catálogo de la tienda no los muestra
const cat=await api('tiendaInfo',{negocio:N}); v('tienda sin apartados',cat.ok&&!(cat.data.productos||[]).some(p=>/Compra en línea|GSHN/.test(p.nombre)),cat.ok?cat.data.productos.length:cat);
// Entregar a María: costo real y segundo pago
L=(await api('pedidos',{},tok)).data; const q1=L.find(x=>x.id===P1);
const t1=ticket(q1); t1.items.forEach(i=>i.costo=0); // aunque la app mande otro costo, vale el de la factura
let vta=await api('venta',t1,tok); v('entrega ok',vta.ok,vta);
const V=vta.data.venta;
v('costo real',Math.abs(V.costo-(pf1.recibo.costos[0]+pf1.recibo.costos[1]))<0.02,[V.costo,pf1.recibo.costos]);
v('segundo pago = total − anticipo',Math.abs(V.recibido-(V.total-p1.anticipo))<0.01&&V.anticipo===p1.anticipo,V);
v('pedido entregado',db.T.Pedidos.find(p=>p.id===P1).estado==='entregado');
// Recordatorio un día antes: forzamos vence = mañana
const p2db=db.T.Pedidos.find(p=>p.id===P2); const rb=JSON.parse(p2db.recibo); const man=new Date(Date.now()+864e5-6*36e5).toISOString().slice(0,10); rb.vence=man; p2db.recibo=JSON.stringify(rb);
db.T.Config.filter(c=>c.clave==='sysApartados').forEach(c=>c.valor='');
await api('pendientes',{},tok);
const chat2=db.T.Mensajes.filter(m=>m.chatId===p2db.chatId).map(m=>m.texto);
v('recordatorio enviado',chat2.some(t=>/sigue apartado .* hasta mañana/.test(t)),chat2);
v('recordatorio una vez',JSON.parse(db.T.Pedidos.find(p=>p.id===P2).recibo).recordado);
// Vencido → aviso
rb.vence='2026-01-01'; rb.recordado='x'; p2db.recibo=JSON.stringify(rb);
let pend=await api('pendientes',{},tok); v('aviso vencidos',pend.data.avisos&&pend.data.avisos.apVenc===1,pend.data.avisos);
// No se puede anular la compra: ya se entregó uno
x=await api('anularCompra',{id:C.id},tok); v('anular compra bloqueado',!x.ok&&/ya se entregó/.test(x.error),x);
// Liberar a Ana (sin anticipo) → existencia, visible en tienda
const prodAntes=db.T.Productos.length;
let lb=await api('liberarApartado',{id:P2,motivo:'noReclamo',tienda:true,productos:[{nombre:'Vestido largo floreado',precio:950}]},tok);
v('liberar ok',lb.ok,lb);
const nv=db.T.Productos.find(p=>p.nombre==='Vestido largo floreado');
v('producto creado con stock y costo',nv&&nv.stock===2&&Math.abs(nv.costo-pf2.recibo.costos[0])<0.01&&nv.precio===950&&nv.tienda===true,nv);
v('kardex apartado',db.T.Inventario.some(m=>m.productoId===nv.id&&m.tipo==='apartado'&&m.cantidad===2));
v('pedido cancelado y liberado',db.T.Pedidos.find(p=>p.id===P2).estado==='cancelado'&&JSON.parse(db.T.Pedidos.find(p=>p.id===P2).recibo).liberado.motivo==='noReclamo');
const cat2=await api('tiendaInfo',{negocio:N}); v('ahora sale en la tienda',cat2.data.productos.some(p=>p.nombre==='Vestido largo floreado'),cat2.data.productos.map(p=>p.nombre));
x=await api('liberarApartado',{id:P2},tok); v('no liberar dos veces',!x.ok,x);
// Otro pedido con anticipo, factura con envío como gasto en efectivo, llegó, liberar con anticipo como ingreso
let r3=await pedir('Luis Mejía','9911-0003',[{enlace:'TM-ZAP-9',usd:40}]); const P3=r3.data.id;
L=(await api('pedidos',{},tok)).data; const p3=L.find(x=>x.id===P3);
await api('anticipoPedido',{id:P3,monto:p3.anticipo,metodo:'Efectivo'},tok);
f=await api('compraFactura',{pedidos:[{id:P3,costos:[1000]}],proveedor:'Temu',factura:'T-55',metodo:'Efectivo',envio:90,modo:'gasto',llego:true},tok);
v('factura con gasto y ya llegó',f.ok&&f.data.gasto&&f.data.gasto.monto===90&&f.data.gasto.categoria==='Envíos de compras en línea'&&f.data.pedidos[0].estado==='listo'&&f.data.pedidos[0].recibo.vence,f);
v('costo sin envío',f.data.pedidos[0].recibo.costos[0]===1000);
v('proveedor Temu',db.T.Proveedores.some(p=>p.nombre==='Temu'));
const ventasAntes=db.T.Ventas.length;
lb=await api('liberarApartado',{id:P3,motivo:'noPago',anticipo:'ingreso',tienda:false,productos:[{nombre:'Zapatos deportivos',precio:1500}]},tok);
v('liberar con ingreso',lb.ok&&lb.data.venta&&Math.abs(lb.data.venta.total-p3.anticipo)<0.02&&lb.data.venta.costo===0,lb);
v('venta de anticipo retenido',db.T.Ventas.length===ventasAntes+1&&/Anticipo retenido/.test(db.T.VentaDetalle.find(d=>d.ventaId===lb.data.venta.id).descripcion));
v('pedido 3 cancelado',db.T.Pedidos.find(p=>p.id===P3).estado==='cancelado');
const zap=db.T.Productos.find(p=>p.nombre==='Zapatos deportivos'); v('zapatos ocultos en tienda',zap&&zap.tienda===false&&zap.stock===1&&zap.costo===1000,zap);
// Anular la compra 3: bloqueado (liberado)
x=await api('anularCompra',{id:f.data.compra.id},tok); v('anular compra liberada bloqueado',!x.ok&&/liberó/.test(x.error),x);
// Devolver anticipo
let r4=await pedir('Rosa Díaz','9911-0004',[{enlace:'SH-BOLSO',usd:20}]); const P4=r4.data.id;
L=(await api('pedidos',{},tok)).data; const p4=L.find(x=>x.id===P4);
await api('anticipoPedido',{id:P4,monto:p4.anticipo,metodo:'Efectivo'},tok);
f=await api('compraFactura',{pedidos:[{id:P4,costos:[500]}],factura:'',metodo:'Crédito',envio:0,llego:true},tok);
v('al crédito con el primer proveedor de la lista',f.ok&&f.data.compra.saldo===500&&db.T.Proveedores.find(p=>p.id===f.data.compra.proveedorId).nombre==='Shein',f);
lb=await api('liberarApartado',{id:P4,motivo:'noReclamo',anticipo:'devolver',productos:[{nombre:'Vestido largo floreado',precio:999}]},tok);
v('devolver anticipo',lb.ok&&db.T.Abonos.filter(a=>a.ref===P4).every(a=>a.anulado),lb);
const nv2=db.T.Productos.find(p=>p.nombre==='Vestido largo floreado'); v('se suma al producto existente',nv2.stock===3&&nv2.precio===950,nv2);
// Anular una compra sin usar: pedido vuelve a por pedir y se anula el gasto
let r5=await pedir('Juan Paz','9911-0005',[{enlace:'SH-GORRA',usd:10}]); const P5=r5.data.id;
f=await api('compraFactura',{pedidos:[{id:P5,costos:[250]}],envio:40,modo:'gasto',metodo:'Efectivo'},tok); const G5=f.data.gasto.id;
x=await api('anularCompra',{id:f.data.compra.id},tok); v('anular compra sin usar',x.ok,x);
const p5=db.T.Pedidos.find(p=>p.id===P5); v('pedido vuelve a por pedir',!p5.recibo&&p5.estado==='confirmado',p5);
v('gasto anulado',db.T.Gastos.find(g=>g.id===G5).anulado===true);
// Ahora se puede editar y cancelar
x=await api('estadoPedido',{id:P5,estado:'cancelado',motivo:'x'},tok); v('cancelar luego de anular',x.ok,x);
// Cajero: no registra factura
console.log(`\n${ok} bien · ${mal} mal`); process.exit(mal?1:0);
