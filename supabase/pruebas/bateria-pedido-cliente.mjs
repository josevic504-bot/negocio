// 1.9.49: el cliente cambia su pedido desde «Tus pedidos»; precio por cantidad; el negocio baja cantidades
import { api, db } from './prueba.mjs';
let ok=0, mal=0; const v=(n,c,d)=>{ if(c) ok++; else { mal++; console.log('✗',n,d===undefined?'':JSON.stringify(d)); } };
const reg = await api('registrar',{negocio:'Belleza Demo',nombre:'Demo',giro:'catalogo',whatsapp:'98765432',pin:'1234'}); const tok=reg.data.token;
await api('cargarEjemplos',{},tok);
const N=db.T.Licencias[0].id, P=n=>db.T.Productos.find(x=>x.nombre.startsWith(n));
const polvo=P('Polvo'), blush=P('Blush');
await api('guardarConfig',{tienda:'si',tiendaEntrega:'recoger',tiendaPagos:'Efectivo,Transferencia'},tok).catch(()=>{});
const tel='9876-5432';
const pedir=async(items,x={})=>api('pedir',Object.assign({negocio:N,nombre:'María López',telefono:tel,entrega:'recoger',pago:'Efectivo',items},x));
const mis=async id=>(await api('misPedidos',{negocio:N,telefono:tel,ids:[id]})).data[0];
const ed=(id,m,o)=>api('pedidoClienteEditar',Object.assign({negocio:N,id,telefono:tel,version:m.version},o));
const fila=id=>db.T.Pedidos.find(x=>x.id===id), its=id=>JSON.parse(fila(id).items);
let r=await pedir([{id:polvo.id,cantidad:3,opcion:'Tono: Oscuro'},{id:blush.id,cantidad:1,opcion:'Tono: Rosa'}]);
v('pedido creado',r.ok,r); const id=r.data.id;
v('descuento del pedido',r.data.descuento===(polvo.precio-polvo.precioEsp)*3,r.data.descuento);
let m=await mis(id);
v('editable y con líneas',m.editable&&m.lineas.length===2,m);
v('línea trae opción y normal',m.lineas[0].opcion==='Tono: Oscuro'&&m.lineas[0].normal===polvo.precio&&m.lineas[0].precio===polvo.precioEsp,m.lineas[0]);
// teléfono ajeno
r=await api('pedidoClienteEditar',{negocio:N,id,telefono:'3333-3333',version:m.version,linea:0,cantidad:1,opcion:'Tono: Oscuro'});
v('rechaza otro WhatsApp',!r.ok,r); v('sin cambios',its(id)[0].cantidad===3);
// bajar a 2: vuelve al precio normal
r=await ed(id,m,{linea:0,cantidad:2,opcion:'Tono: Oscuro'}); v('bajar cantidad',r.ok,r);
v('regresa a precio normal',its(id)[0].precio===polvo.precio&&!its(id)[0].normal,its(id)[0]);
v('total recalculado',fila(id).total===polvo.precio*2+blush.precio,fila(id).total);
v('nota del cambio',/Cambio del cliente .*eran 3/.test(fila(id).nota),fila(id).nota);
// versión vieja
r=await ed(id,m,{linea:0,cantidad:4,opcion:'Tono: Oscuro'}); v('versión vieja rechazada',!r.ok&&/cambió/.test(r.error),r);
// subir a 3 y cambiar tono
m=await mis(id); r=await ed(id,m,{linea:0,cantidad:3,opcion:'Tono: Claro'}); v('cambiar tono y subir',r.ok,r);
v('precio especial de nuevo',its(id)[0].precio===polvo.precioEsp&&its(id)[0].normal===polvo.precio&&/Claro/.test(its(id)[0].nombre),its(id)[0]);
// dos tonos del mismo producto suman
r=await pedir([{id:polvo.id,cantidad:2,opcion:'Tono: Claro'},{id:polvo.id,cantidad:1,opcion:'Tono: Medio'}]); const id2=r.data.id;
v('suman para el especial',its(id2).every(i=>i.precio===polvo.precioEsp),its(id2));
m=await mis(id2); r=await ed(id2,m,{linea:1,cantidad:0}); v('quitar línea',r.ok,r);
v('quedó una y volvió al normal',its(id2).length===1&&its(id2)[0].precio===polvo.precio,its(id2));
m=await mis(id2); r=await ed(id2,m,{linea:0,cantidad:0}); v('no quita el último',!r.ok&&/único/.test(r.error),r);
// unir líneas al elegir el mismo tono
r=await pedir([{id:polvo.id,cantidad:1,opcion:'Tono: Claro'},{id:polvo.id,cantidad:1,opcion:'Tono: Medio'}]); const id3=r.data.id;
m=await mis(id3); r=await ed(id3,m,{linea:1,cantidad:2,opcion:'Tono: Claro'}); v('une líneas iguales',r.ok&&its(id3).length===1&&its(id3)[0].cantidad===3&&its(id3)[0].precio===polvo.precioEsp,its(id3));
// existencia
m=await mis(id3); r=await ed(id3,m,{linea:0,cantidad:polvo.stock+1,opcion:'Tono: Claro'}); v('no pasa la existencia',!r.ok&&/Solo quedan/.test(r.error),r);
r=await ed(id3,m,{linea:0,cantidad:3,opcion:'Tono: Claro'}); v('sin cambios se avisa',!r.ok&&/No cambiaste/.test(r.error),r);
// comprobante bloquea
r=await pedir([{id:blush.id,cantidad:1,opcion:'Tono: Rosa'}],{pago:'Transferencia'}); const id4=r.data.id;
m=await mis(id4); v('transferencia sin comprobante editable',m.editable,m);
fila(id4).pagoEstado='revisar'; m=await mis(id4); v('comprobante: ya no editable',!m.editable&&!m.lineas,m);
r=await api('pedidoClienteEditar',{negocio:N,id:id4,telefono:tel,version:'x',linea:0,cantidad:2,opcion:'Tono: Rosa'}); v('servidor bloquea con pago',!r.ok&&/pago/.test(r.error),r);
fila(id4).pagoEstado='no'; m=await mis(id4); v('pago rechazado: editable otra vez',m.editable,m);
// confirmado bloquea
r=await api('estadoPedido',{id,estado:'confirmado'},tok); v('confirmar',r.ok,r);
m=await mis(id); v('confirmado no editable',!m.editable,m);
r=await api('pedidoClienteEditar',{negocio:N,id,telefono:tel,version:'x',linea:0,cantidad:1,opcion:'Tono: Claro'}); v('servidor bloquea confirmado',!r.ok&&/escríbele/i.test(r.error),r);
// negocio baja cantidad
r=await pedir([{id:polvo.id,cantidad:3,opcion:'Tono: Oscuro'}]); const id5=r.data.id;
r=await api('editarPedido',{id:id5,cantidades:[2],motivo:'Se agotó'},tok); v('negocio edita',r.ok,r);
v('negocio: vuelve a normal',its(id5)[0].precio===polvo.precio&&fila(id5).total===polvo.precio*2,its(id5));
r=await api('editarPedido',{id:id5,cantidades:[3],motivo:'Se agotó'},tok); v('negocio: sube a especial',r.ok&&its(id5)[0].precio===polvo.precioEsp,its(id5));
// precio acordado distinto no se toca
r=await pedir([{id:polvo.id,cantidad:2,opcion:'Tono: Oscuro'},{id:blush.id,cantidad:1,opcion:'Tono: Rosa'}]); const id6=r.data.id;
const pp=db.T.Productos.find(x=>x.id===polvo.id), viejo=pp.precio; pp.precio=viejo+50;
r=await api('editarPedido',{id:id6,cantidades:[1,1],motivo:'Se agotó'},tok); v('precio acordado se conserva',r.ok&&its(id6)[0].precio===viejo,its(id6)); pp.precio=viejo;
console.log(`\n== ${ok} pasadas · ${mal} fallidas ==`); process.exit(0);
