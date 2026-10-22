/*****************************************************************
 * GESTIÓN DE NEGOCIO VM · Servidor (Google Apps Script + Google Sheets)
 * Versión 1.7 · Software creado por José Vicdonio Molina · WhatsApp +504 3313-0265
 *
 * 1) Crea una Hoja de cálculo nueva → Extensiones → Apps Script
 * 2) Pega este archivo como Code.gs, guarda y ejecuta instalar()
 * 3) Implementar → Nueva implementación → App web
 *    Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario
 * 4) Copia la URL /exec y pégala en index.html (API_URL_DEFAULT)
 *****************************************************************/

/* ---------------- MODO MULTI-NEGOCIO ----------------
 * MULTI_NEGOCIO = true → un solo enlace para muchos negocios. Cada negocio se registra
 * con su nombre, su WhatsApp y un PIN; se le crea su propia hoja de datos en tu Drive
 * y aparece en la hoja «Licencias». Ahí lo activas (Estado = Activa), extiendes la
 * prueba (cambia «vencePrueba») o lo bloqueas (Estado = Bloqueada).
 * MULTI_NEGOCIO = false → un solo negocio en esta hoja (usuario admin / admin123).
 */
const MULTI_NEGOCIO = true;
const DIAS_PRUEBA = 7;              // días de prueba gratis (0 = sin límite en modo un solo negocio)
const CONTACTO_WA = '50433130265';  // WhatsApp para activar el sistema (con código de país)
const URL_APP = 'https://josevic504-bot.github.io/negocio/'; // dirección pública de la app (para enlaces en correos)
const CARPETA_DATOS = 'Gestión de Negocio VM – Datos';
const VERSION = '1.9';
const DIAS_FOTO = 90;               // las fotos de productos agotados y sin movimiento por más de estos días se borran solas
/* PLAN PLUS (tienda en línea + fotos de productos)
 * Se activa aparte de la licencia: en la hoja «Licencias» pon «Sí» en la columna «plus»,
 * o en Configuración del proyecto → Propiedades del script crea PLUS_PASSWORD con tu contraseña
 * y escríbela en Ajustes › Plan Plus del equipo del cliente.
 */

const SCHEMA_M = {
  Licencias:   ['id','negocio','giro','dueno','whatsapp','registro','vencePrueba','estado','usuarios','ultimaConexion','hojaId','plus','notas'],
  Accesos:     ['whatsapp','negocioId','usuarioId','activo'],
  // Panel Molina (súper admin): soporte, seguimiento y pagos de licencias
  Soporte:     ['id','negocioId','negocio','dueno','whatsapp','motivo','modulo','estado','version','diaPrueba','ultimo','ultimoTexto','deCliente','sinLeerAdm','sinLeerCli','creado'],
  SoporteMsg:  ['id','chatId','de','texto','foto','quien','fecha'],
  Seguimiento: ['id','negocioId','tipo','fecha','nota'],
  PagosLic:    ['id','negocioId','fecha','monto','concepto','metodo','nota']
};
const PANEL_SEG = 21600;
// Motivos de contacto con el administrador (el cliente elige antes de abrir el chat)
const MOTIVOS = { error: 'Error del programa', duda: 'No sé cómo hacer algo', prueba: 'Prueba y activación', idea: 'Sugerencia', app: 'App Android / instalación', otro: 'Otro' };
let NEG = null; // negocio de la solicitud actual (modo multi)

const TZ = 'America/Tegucigalpa';
const SESION_SEG = 21600; // 6 horas (máximo permitido por CacheService)

const SCHEMA = {
  Usuarios:       ['id','usuario','nombre','rol','color','hash','salt','activo','creado'],
  Productos:      ['id','codigo','nombre','categoria','tipo','unidad','precio','costo','margen','stock','stockMin','tasaIsv','icono','foto','fotoFecha','descripcion','tienda','activo','creado','opciones','plataforma','entrega','incluye','caduca','garantia'],
  Cuentas:        ['id','plataforma','nombre','correo','clave','perfiles','costo','vence','nota','activo','creado'],
  Suscripciones:  ['id','ventaId','clienteId','cliente','telefono','productoId','producto','plataforma','cuentaId','perfil','pin','inicio','vence','meses','precio','estado','nota','creado'],
  Clientes:       ['id','nombre','telefono','rtn','direccion','correo','limite','notas','activo','creado','equipo'],
  Proveedores:    ['id','nombre','telefono','contacto','rtn','direccion','notas','activo','creado'],
  Ventas:         ['id','numero','fecha','clienteId','usuarioId','subtotal','descuento','isv','total','costo','metodo','recibido','cambio','saldo','pedidoId','anulada','nota','factura','fiscal','anulacion','servicio','mesa','cocina','anticipo'],
  VentaDetalle:   ['id','ventaId','productoId','descripcion','cantidad','precio','costo','total','serie','garantia'],
  Ordenes:        ['id','numero','clienteId','cliente','telefono','equipo','placa','falla','diagnostico','estado','promesa','anticipo','presupuesto','ventaId','nota','usuarioId','creado','actualizado'],
  Agenda:         ['id','tipo','clienteId','cliente','telefono','dia','hora','detalle','productoId','monto','anticipo','atiende','estado','ventaId','nota','usuarioId','creado','actualizado'],
  Abonos:         ['id','fecha','clienteId','monto','metodo','aplicado','usuarioId','nota','anulado','anulacion','ref'],
  Compras:        ['id','numero','fecha','proveedorId','factura','total','saldo','metodo','usuarioId','anulada','nota','anulacion'],
  CompraDetalle:  ['id','compraId','productoId','descripcion','cantidad','costo','total','precioAnt','precio'],
  Pagos:          ['id','fecha','proveedorId','monto','metodo','aplicado','usuarioId','nota','anulado','anulacion'],
  Gastos:         ['id','fechaGasto','categoria','detalle','proveedor','monto','metodo','usuarioId','nota','anulado','creado','anulacion'],
  Inventario:     ['id','fecha','productoId','tipo','cantidad','stock','refId','usuarioId','nota'],
  Pedidos:        ['id','numero','fecha','nombre','telefono','clienteId','entrega','direccion','pago','items','subtotal','envio','total','estado','ventaId','nota','actualizado'],
  Cierres:        ['id','desde','hasta','usuarioId','fondo','ventas','cobros','gastos','pagos','esperado','contado','diferencia','nota','marca'],
  Distribuciones: ['id','mes','tipo','destino','detalle','monto','usuarioId','nota','anulado','creado'],
  Proyectos:      ['id','nombre','cliente','descripcion','estado','inicio','fin','margen','presupuesto','usuarioId','nota','creado','actualizado'],
  ProyectoGastos: ['id','proyectoId','dia','categoria','descripcion','cantidad','costoUnit','monto','productoId','caja','usuarioId','anulado','creado','anulacion'],
  ProyectoProductos: ['id','proyectoId','nombre','cantidad','unidad','peso','precio','productoId','inventario','creado'],
  Chats:          ['id','telefono','nombre','clienteId','clave','productoId','producto','ultimo','ultimoTexto','deCliente','sinLeer','creado'],
  Mensajes:       ['id','chatId','de','texto','usuarioId','fecha'],
  Config:         ['clave','valor']
};
const PREFIJO = { Usuarios:'U', Productos:'R', Clientes:'C', Proveedores:'B', Ventas:'V', VentaDetalle:'D', Abonos:'A', Compras:'K', CompraDetalle:'E',
  Pagos:'G', Gastos:'X', Inventario:'I', Pedidos:'P', Cierres:'Z', Distribuciones:'Q', Proyectos:'J', ProyectoGastos:'Y', ProyectoProductos:'W', Chats:'H', Mensajes:'M', Ordenes:'O', Agenda:'T', Cuentas:'N', Suscripciones:'S' };
const NUMS = new Set(['sinLeer','margen','precio','costo','stock','stockMin','limite','subtotal','descuento','isv','total','recibido','cambio','saldo','cantidad','monto',
  'envio','fondo','ventas','cobros','gastos','pagos','esperado','contado','diferencia','costoUnit','peso','presupuesto','precioAnt','anticipo','garantia']);
const BOOLS = new Set(['activo','anulada','anulado','tienda','caja','deCliente']);
const SOLO_FECHA = new Set(['fechaGasto','dia','inicio','fin','inventario','vence','caduca','promesa']);
const TEXTO = new Set(['fotoFecha','tasaIsv','codigo','telefono','rtn','fecha','fechaGasto','creado','valor','mes','desde','hasta','actualizado','isv','numero','factura','usuario','clave','dia','inicio','fin','inventario','factura','fiscal','anulacion','marca','opciones','clave','ultimo','vence','pin','perfil','correo','incluye','caduca','promesa','hora','serie','placa','equipo','mesa','cocina','servicio']);
const ROLES = ['admin','cajero','bodega'];
const METODOS = ['Efectivo','Tarjeta','Transferencia','Crédito'];
const EST_PEDIDO = ['nuevo','confirmado','listo','entregado','cancelado'];

const CONFIG_DEF = {
  nombre: 'Mi Negocio', giro: 'otro', eslogan: '', rtn: '', telefono: '', direccion: '', correo: '',
  moneda: 'L', isv: '0.15', preciosConISV: 'si', venderSinStock: 'no',
  mensajeRecibo: '¡Gracias por su compra!', tema: 'fucsia', logo: '', fondoCaja: '0',
  tienda: 'no', tiendaMensaje: '', tiendaEntrega: 'ambos', tiendaEnvio: '0', tiendaMinimo: '0', tiendaHorario: '',
  tiendaPagos: 'Efectivo,Transferencia', tiendaDatosPago: '', tiendaMostrarStock: 'no', tiendaSinStock: 'no',
  // Información del negocio en la tienda y sección del propietario
  tiendaSobre: '', tiendaInstagram: '', tiendaFacebook: '', tiendaMapa: '', tiendaAbre: '', tiendaCierra: '', tiendaDias: '1,2,3,4,5,6', tiendaChat: 'si', tiendaFuente: 'elegante', tiendaModo: 'auto', tiendaPortada: '', venderInicio: 'catalogo', suscripciones: '', plataformas: '', susAviso: '7', msjSusPorVencer: 'Hola {cliente} 👋 Tu suscripción de *{plataforma}*{perfil} vence el *{vence}*. ¿La renovamos? Son {precio} por mes. — {negocio}', msjSusVencida: 'Hola {cliente} 👋 Tu suscripción de *{plataforma}*{perfil} venció el {vence}. Si quieres seguir disfrutándola, renuévala por {precio} al mes. — {negocio}', caducidad: '', comanda: '', ordenes: '', series: '', variantes: '', encargos: '', agenda: '',
  duenoNombre: '', duenoCargo: '', duenoMensaje: '', duenoFoto: '', duenoDatos: '', duenoWhatsapp: '',
  msjPedido: 'Hola {cliente} 👋, ¡gracias por tu pedido {numero} en {negocio}! El total es {total}. Te avisamos cuando esté listo.',
  msjListo: 'Hola {cliente} 😊, tu pedido {numero} ya está listo. Total: {total}.',
  msjCobro: 'Hola {cliente} 👋, te saluda {negocio}. Te recordamos tu saldo pendiente de {saldo}. ¡Gracias por tu preferencia!',
  // Facturación SAR (autoimpresor): apagada por defecto
  sarActivo: 'no', sarRazon: '', sarRtn: '', sarDireccion: '', sarCai: '', sarEst: '000', sarPunto: '001', sarDesde: '', sarHasta: '', sarLimite: '',
  seqV: '0', seqC: '0', seqP: '0', seqO: '0', seqF: '', sysLimpieza: '', sysChats: '', sysVer: ''
};
// Ajustes que el administrador puede cambiar desde la app
const CONFIG_EDITABLE = Object.keys(CONFIG_DEF).filter(k => k.indexOf('seq') !== 0 && k.indexOf('sys') !== 0 && k.indexOf('sar') !== 0);
function sinInternos_(c) { Object.keys(c).forEach(k => { if (k.indexOf('seq') === 0 || k.indexOf('sys') === 0) delete c[k]; }); return c; }

const ESCRITURA = {
  Productos: ['admin','bodega'],
  Cuentas: ['admin'],
  Clientes: ['admin','cajero'],
  Proveedores: ['admin','bodega']
};

/* Categorías sugeridas y productos de ejemplo por tipo de negocio */
const GIROS = {
  tienda:     { n: 'Tienda / pulpería', cats: ['Abarrotes','Bebidas','Lácteos','Snacks','Limpieza','Higiene','Panadería'],
    ej: [['Arroz 1 lb','Abarrotes','🍚',18,13,40],['Frijoles rojos 1 lb','Abarrotes','🫘',25,19,35],['Aceite 750 ml','Abarrotes','🫗',68,55,15],['Refresco 2 L','Bebidas','🥤',55,42,24,'Sabor: Cola, Naranja, Uva'],['Agua purificada 1 L','Bebidas','💧',15,9,30],['Leche entera 1 L','Lácteos','🥛',34,27,18],['Churros de maíz','Snacks','🌽',12,8,40],['Jabón de lavar','Limpieza','🧼',22,16,20]] },
  variedades: { n: 'Tienda de variedades', cats: ['Ropa','Belleza','Hogar','Tecnología','Escolar','Regalos'],
    ej: [['Camiseta básica','Ropa','👕',250,140,24,'Talla: S, M, L, XL | Color: Blanco, Negro, Gris'],['Perfume Brisa 100 ml','Belleza','🧴',480,290,8],['Termo de acero 750 ml','Hogar','🥤',320,190,15],['Audífonos inalámbricos','Tecnología','🎧',650,410,6,'Color: Negro, Blanco'],['Mochila escolar','Escolar','🎒',590,350,11],['Set de maquillaje','Belleza','💄',420,240,9],['Lámpara LED recargable','Hogar','💡',280,160,20],['Cargador rápido USB-C','Tecnología','🔌',230,120,14]] },
  ferreteria: { n: 'Ferretería', cats: ['Herramientas','Electricidad','Plomería','Pintura','Construcción','Tornillería'],
    ej: [['Martillo de uña 16 oz','Herramientas','🔨',220,140,10],['Desarmador de estrías','Herramientas','🪛',85,50,20],['Cinta métrica 5 m','Herramientas','📏',120,70,12],['Foco LED 9 W','Electricidad','💡',45,28,50],['Cable eléctrico #12 (m)','Electricidad','🔌',18,11,200,'Color: Negro, Rojo, Blanco'],['Tubo PVC 1/2"','Plomería','🚰',95,62,30],['Pintura galón blanco','Pintura','🎨',620,430,8],['Cemento bolsa 42.5 kg','Construcción','🧱',245,215,40]] },
  comida:     { n: 'Restaurante / comida', cats: ['Platos','Desayunos','Bebidas','Postres','Combos','Extras'],
    ej: [['Baleada sencilla','Desayunos','🌮',25,10,0],['Baleada con todo','Desayunos','🌯',45,20,0],['Plato típico','Platos','🍛',150,70,0,'Carne: Res, Pollo, Cerdo'],['Pollo frito (2 piezas)','Platos','🍗',120,55,0],['Licuado de frutas','Bebidas','🥤',50,20,0],['Café','Bebidas','☕',20,6,0],['Pastel de chocolate','Postres','🍰',60,25,0],['Combo familiar','Combos','🍽️',420,200,0]] },
  boutique:   { n: 'Boutique / ropa y calzado', cats: ['Damas','Caballeros','Niños','Calzado','Accesorios'],
    ej: [['Blusa casual','Damas','👚',380,210,12,'Talla: S, M, L | Color: Blanco, Rosa'],['Vestido de verano','Damas','👗',650,360,8],['Camisa formal','Caballeros','👔',520,290,10],['Jeans','Caballeros','👖',690,400,14,'Talla: 28, 30, 32, 34, 36'],['Tenis deportivos','Calzado','👟',1150,700,6,'Talla: 38, 39, 40, 41, 42'],['Sandalias','Calzado','👡',450,250,10],['Bolso de mano','Accesorios','👜',780,420,5],['Gorra','Accesorios','🧢',220,110,15]] },
  farmacia:   { n: 'Farmacia', cats: ['Medicamentos','Vitaminas','Cuidado personal','Bebé','Primeros auxilios'],
    ej: [['Acetaminofén 500 mg (10)','Medicamentos','💊',35,20,40],['Antigripal (sobre)','Medicamentos','🤧',18,10,60],['Vitamina C 1 g (10)','Vitaminas','🍊',95,55,25,'Presentación: Tabletas, Efervescente'],['Suero oral','Medicamentos','🧃',42,26,30],['Alcohol 250 ml','Primeros auxilios','🧴',48,30,20],['Curitas (caja)','Primeros auxilios','🩹',55,32,15],['Pañales talla M (20)','Bebé','👶',260,190,10],['Protector solar','Cuidado personal','🧴',320,200,8]] },
  repuestos:  { n: 'Repuestos / taller', cats: ['Motor','Frenos','Eléctrico','Aceites','Llantas','Servicios'],
    ej: [['Aceite 20W-50 (litro)','Aceites','🛢️',190,130,30],['Filtro de aceite','Motor','🧰',150,90,20,'Vehículo: Toyota, Nissan, Honda'],['Pastillas de freno','Frenos','🛞',650,420,8],['Bujía','Motor','⚡',95,55,40],['Batería 12 V','Eléctrico','🔋',2300,1700,4],['Cambio de aceite (mano de obra)','Servicios','🔧',250,0,0],['Alineado y balanceo','Servicios','🛠️',450,0,0],['Llanta rin 14','Llantas','🛞',1650,1150,6]] },
  tecnologia: { n: 'Tecnología / celulares', cats: ['Celulares','Accesorios','Audio','Cargadores','Reparaciones'],
    ej: [['Celular gama media','Celulares','📱',4800,3600,5,'Capacidad: 128 GB, 256 GB | Color: Negro, Azul'],['Protector de pantalla','Accesorios','📲',150,40,40],['Funda de silicona','Accesorios','🛡️',180,60,30],['Cargador 20 W','Cargadores','🔌',350,180,15],['Audífonos Bluetooth','Audio','🎧',690,400,10],['Bocina portátil','Audio','🔊',950,580,6],['Memoria USB 64 GB','Accesorios','💾',260,150,20],['Cambio de pantalla','Reparaciones','🧑‍🔧',1200,600,0]] },
  belleza:    { n: 'Belleza / cosméticos', cats: ['Maquillaje','Cuidado de piel','Cabello','Uñas','Perfumes'],
    ej: [['Base líquida','Maquillaje','💄',420,250,10,'Tono: Claro, Medio, Oscuro'],['Labial mate','Maquillaje','💋',180,90,20],['Crema hidratante','Cuidado de piel','🧴',350,200,12],['Shampoo 500 ml','Cabello','🧴',260,150,15],['Esmalte de uñas','Uñas','💅',95,45,30],['Perfume 100 ml','Perfumes','🌸',890,520,6],['Mascarilla facial','Cuidado de piel','🧖',120,60,25],['Delineador','Maquillaje','✏️',150,75,18]] },
  panaderia:  { n: 'Panadería / repostería', cats: ['Pan dulce','Pan salado','Pasteles','Galletas','Bebidas'],
    ej: [['Pan blanco (bolsa)','Pan salado','🍞',35,18,30],['Semita','Pan dulce','🥯',15,6,40],['Cachitos','Pan dulce','🥐',12,5,50],['Rosquillas (bolsa)','Galletas','🍩',45,22,25],['Pastel de cumpleaños','Pasteles','🎂',650,300,3,'Sabor: Chocolate, Vainilla, Tres leches'],['Galletas de mantequilla','Galletas','🍪',60,28,20],['Café con leche','Bebidas','☕',25,8,0],['Pan de coco','Pan dulce','🥥',20,9,30]] },
  servicios:  { n: 'Servicios', cats: ['Servicios','Paquetes','Materiales'],
    ej: [['Servicio básico','Servicios','🛎️',300,0,0],['Servicio premium','Servicios','⭐',650,0,0],['Visita a domicilio','Servicios','🏠',200,0,0,'Modalidad: A domicilio, En el local'],['Paquete mensual','Paquetes','📦',1500,0,0],['Materiales','Materiales','🧰',120,70,20]] },
  streaming:  { n: 'Streaming y suscripciones', cats: ['Netflix','Disney+','HBO Max','Prime Video','Spotify','YouTube Premium','IPTV','Combos'],
    ej: [['Netflix · 1 perfil','Netflix','📺',120,58,0,'Plan: 1 mes, 3 meses, 6 meses',{ plataforma: 'Netflix', entrega: 'perfil' }],['Netflix · cuenta completa','Netflix','📺',450,290,0,'Plan: 1 mes, 3 meses',{ plataforma: 'Netflix', entrega: 'cuenta' }],
      ['Disney+ · 1 perfil','Disney+','🏰',100,45,0,'Plan: 1 mes, 3 meses, 6 meses',{ plataforma: 'Disney+', entrega: 'perfil' }],['HBO Max · 1 perfil','HBO Max','🎬',90,40,0,'Plan: 1 mes, 3 meses',{ plataforma: 'HBO Max', entrega: 'perfil' }],
      ['Prime Video · 1 perfil','Prime Video','🎥',80,35,0,'Plan: 1 mes, 3 meses',{ plataforma: 'Prime Video', entrega: 'perfil' }],['Spotify Premium','Spotify','🎵',90,40,0,'Plan: 1 mes, 3 meses, 6 meses',{ plataforma: 'Spotify', entrega: 'perfil' }],
      ['YouTube Premium','YouTube Premium','▶️',80,35,0,'Plan: 1 mes, 3 meses',{ plataforma: 'YouTube Premium', entrega: 'perfil' }],['IPTV · 1 dispositivo','IPTV','📡',150,60,0,'Plan: 1 mes, 3 meses, 6 meses, 12 meses',{ plataforma: 'IPTV', entrega: 'perfil' }],
      ['Combo Netflix + Disney+','Combos','🍿',200,100,0,'Plan: 1 mes, 3 meses',{ incluye: 'Netflix:1|Disney+:1' }],['Combo total (Netflix, Disney+, HBO Max)','Combos','🎁',280,135,0,'Plan: 1 mes, 3 meses',{ incluye: 'Netflix:1|Disney+:1|HBO Max:1' }]] },
  otro:       { n: 'Otro tipo de negocio', cats: ['General'],
    ej: [['Producto de ejemplo 1','General','📦',100,60,10],['Producto de ejemplo 2','General','🛍️',250,150,10],['Servicio de ejemplo','General','🛎️',300,0,0]] }
};

/* ===================== ENTRADA HTTP ===================== */

function doGet() {
  return json_({ ok: true, app: 'Gestión de Negocio VM', version: VERSION, multi: MULTI_NEGOCIO });
}

function doPost(e) {
  let out;
  try {
    const req = JSON.parse(e.postData.contents || '{}');
    out = { ok: true, data: route_(req) };
  } catch (err) {
    out = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return json_(out);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function route_(req) {
  Object.keys(MEMO).forEach(k => { delete MEMO[k]; });
  NEG = null;
  const a = req.action, d = req.data || {};
  if (!MULTI_NEGOCIO && ['tiendaInfo', 'pedir', 'misPedidos', 'chatEnviar', 'chatVer'].indexOf(a) < 0) {
    const lic = licencia_();
    if (lic.estado === 'vencida') throw new Error('PRUEBA_VENCIDA|' + JSON.stringify({ contacto: CONTACTO_WA, nombre: config_().nombre }));
  }
  if (a === 'login') return lock_(() => MULTI_NEGOCIO ? loginMulti_(d) : login_(d));
  if (a === 'registrar') return registrar_(d);
  if (a === 'info') return { multi: MULTI_NEGOCIO, version: VERSION };
  // Tienda en línea (página pública, sin usuario)
  if (a === 'tiendaInfo') return tiendaInfo_(d);
  if (a === 'pedir') { pedirLimites_(d); return lock_(() => pedir_(d)); }
  if (a === 'misPedidos') return misPedidos_(d);
  if (a === 'chatEnviar') { chatLimites_(d); return lock_(() => chatEnviar_(d)); }
  if (a === 'chatVer') return chatVer_(d);
  // Panel Molina (súper admin)
  if (a === 'panelLogin') return panelLogin_(d);
  if (a.indexOf('panel') === 0) { panelAuth_(req); return lock_(() => rutaPanel_(a, d)); }
  const u = auth_(req.token);
  const res = rutaUsuario_(a, u, d, req);
  return u.rol === 'cajero' ? sinCostos_(res) : res;
}

function sinCostos_(x) {
  if (Array.isArray(x)) return x.map(sinCostos_);
  if (!x || typeof x !== 'object') return x;
  const o = {};
  Object.keys(x).forEach(k => { if (k !== 'costo' && k !== 'margen' && k !== 'ganancia' && k !== 'costoUnit' && k !== 'precioAnt') o[k] = sinCostos_(x[k]); });
  return o;
}

function rutaUsuario_(a, u, d, req) {
  switch (a) {
    case 'logout':          CacheService.getScriptCache().remove('S_' + req.token); return true;
    case 'bootstrap':       return bootstrap_(u, d);
    case 'inicio':          return inicio_(u);
    case 'pendientes':      return pendientes_(u);
    case 'guardar':         return lock_(() => guardar_(u, d));
    case 'eliminar':        return lock_(() => eliminar_(u, d));
    case 'guardarUsuario':  d._token = req.token; return lock_(() => guardarUsuario_(u, d));
    case 'cambiarClave':    d._token = req.token; return lock_(() => cambiarClave_(u, d));
    case 'subirFoto':       return subirFoto_(u, d);
    case 'cargarEjemplos':  return lock_(() => cargarEjemplos_(u, d));
    case 'precios':         return lock_(() => precios_(u, d));
    case 'activarPlus':     return lock_(() => activarPlus_(u, d));
    case 'venta':           return lock_(() => venta_(u, d));
    case 'ventas':          return ventas_(u, d);
    case 'anularVenta':     return lock_(() => anularVenta_(u, d));
    case 'abono':           return lock_(() => abono_(u, d));
    case 'anularAbono':     return lock_(() => anularAbono_(u, d));
    case 'cuentaCliente':   return cuentaCliente_(u, d);
    case 'compra':          return lock_(() => compra_(u, d));
    case 'compras':         return compras_(u, d);
    case 'anularCompra':    return lock_(() => anularCompra_(u, d));
    case 'pago':            return lock_(() => pago_(u, d));
    case 'anularPago':      return lock_(() => anularPago_(u, d));
    case 'cuentaProveedor': return cuentaProveedor_(u, d);
    case 'ajusteStock':     return lock_(() => ajusteStock_(u, d));
    case 'kardex':          return kardex_(u, d);
    case 'gastos':          return gastos_(u, d);
    case 'guardarGasto':    return lock_(() => guardarGasto_(u, d));
    case 'anularGasto':     return lock_(() => anularGasto_(u, d));
    case 'pedidos':         return pedidos_(u, d);
    case 'estadoPedido':    return lock_(() => estadoPedido_(u, d));
    case 'chats':           return chats_(u);
    case 'chat':            return lock_(() => chat_(u, d));
    case 'chatResponder':   return lock_(() => chatResponder_(u, d));
    case 'chatBorrar':      return lock_(() => chatBorrar_(u, d));
    case 'soporteCrear':    return lock_(() => soporteCrear_(u, d));
    case 'soporteLista':    return soporteLista_(u);
    case 'soporteVer':      return soporteVer_(u, d);
    case 'soporteEnviar':   return lock_(() => soporteEnviar_(u, d));
    case 'susCuentas':      return susCuentas_(u);
    case 'suscripciones':   return suscripciones_(u);
    case 'susEstado':       return lock_(() => susEstado_(u, d));
    case 'cambiarGiro':     return lock_(() => cambiarGiro_(u, d));
    case 'ordenes':         return ordenes_(u, d);
    case 'ordenGuardar':    return lock_(() => ordenGuardar_(u, d));
    case 'agenda':          return agenda_(u, d);
    case 'agendaGuardar':   return lock_(() => agendaGuardar_(u, d));
    case 'caja':            return caja_(u, d);
    case 'cerrarCaja':      return lock_(() => cerrarCaja_(u, d));
    case 'reporte':         return reporte_(u, d);
    case 'diario':          return diario_(u, d);
    case 'historial':       return historial_(u);
    case 'guardarDistribucion': return lock_(() => guardarDistribucion_(u, d));
    case 'anularDistribucion':  return lock_(() => anularDistribucion_(u, d));
    case 'inventario':      return inventario_(u, d);
    case 'cuentas':         return cuentas_(u, d);
    case 'proyectos':       return proyectos_(u, d);
    case 'proyecto':        return proyecto_(u, d);
    case 'guardarProyecto': return lock_(() => guardarProyecto_(u, d));
    case 'estadoProyecto':  return lock_(() => estadoProyecto_(u, d));
    case 'duplicarProyecto': return lock_(() => duplicarProyecto_(u, d));
    case 'gastoProyecto':   return lock_(() => gastoProyecto_(u, d));
    case 'anularGastoProyecto': return lock_(() => anularGastoProyecto_(u, d));
    case 'productoProyecto': return lock_(() => productoProyecto_(u, d));
    case 'quitarProductoProyecto': return lock_(() => quitarProductoProyecto_(u, d));
    case 'proyectoAInventario': return lock_(() => proyectoAInventario_(u, d));
    case 'guardarSAR':      return lock_(() => guardarSAR_(u, d));
    case 'libroSAR':        return libroSAR_(u, d);
    default: throw new Error('Acción no válida: ' + a);
  }
}

let EN_LOCK = 0; // profundidad del candado: dentro de él siempre se lee la hoja (nunca la caché)
function lock_(fn) {
  const l = LockService.getScriptLock();
  l.waitLock(25000);
  if (!EN_LOCK) Object.keys(MEMO).forEach(k => { if (k !== '_ss' && k.indexOf('_m_') !== 0) delete MEMO[k]; }); // lo leído antes del candado puede estar viejo
  EN_LOCK++;
  try { return fn(); } finally { EN_LOCK--; l.releaseLock(); }
}
function own_(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

/* ===================== HOJAS (BASE DE DATOS) ===================== */

const MEMO = {};

function ss_() {
  if (MULTI_NEGOCIO && NEG) {
    if (!MEMO._ss) MEMO._ss = SpreadsheetApp.openById(NEG.hojaId);
    return MEMO._ss;
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}
function ck_(name) { return 'H_' + (NEG ? NEG.id + '_' : '') + name; }

function sh_(name) {
  const ss = ss_();
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    const h = SCHEMA[name];
    s.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#d10f6f').setFontColor('#ffffff');
    s.setFrozenRows(1);
    h.forEach((k, i) => { if (TEXTO.has(k)) s.getRange(2, i + 1, s.getMaxRows() - 1, 1).setNumberFormat('@'); });
  }
  return s;
}

function obj_(h, r) {
  const o = {};
  h.forEach((k, i) => {
    let x = r[i];
    if (x instanceof Date) x = Utilities.formatDate(x, TZ, k === 'mes' ? 'yyyy-MM' : SOLO_FECHA.has(k) ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm");
    if (NUMS.has(k)) x = Number(x) || 0;
    else if (BOOLS.has(k)) x = (x === true || x === 'true' || x === 'TRUE' || x === 1 || x === 'SI');
    else x = (x === null || x === undefined) ? '' : String(x);
    o[k] = x;
  });
  return o;
}

// Hojas pequeñas que se guardan en caché unos minutos para responder más rápido
const CACHE_HOJAS = ['Usuarios','Productos','Clientes','Proveedores','Config'];
const CACHE_SEG = 600;

function rows_(name) {
  if (!MEMO[name]) {
    const cacheable = CACHE_HOJAS.indexOf(name) >= 0;
    let data = null, ver0 = null, cs = null;
    if (cacheable) {
      try {
        cs = CacheService.getScriptCache();
        // Dentro del candado (escrituras) siempre se lee la hoja: así las existencias y los consecutivos nunca salen de una copia vieja
        if (!EN_LOCK) { const c = cs.get(ck_(name)); if (c) data = JSON.parse(c); else ver0 = cs.get('V' + ck_(name)) || '0'; }
      } catch (e) { data = null; }
    }
    if (!data) {
      const s = sh_(name), n = s.getLastRow(), h = SCHEMA[name];
      data = n < 2 ? [] : s.getRange(2, 1, n - 1, h.length).getValues()
        .filter(r => r[0] !== '' && r[0] !== null)
        .map(r => obj_(h, r));
      if (cacheable && cs) {
        try {
          // Fuera del candado solo se guarda si nadie escribió mientras se leía la hoja
          const j = JSON.stringify(data);
          if (j.length < 95000 && (EN_LOCK || (cs.get('V' + ck_(name)) || '0') === ver0)) cs.put(ck_(name), j, CACHE_SEG);
        } catch (e) {}
      }
    }
    MEMO[name] = data;
  }
  return MEMO[name].map(o => Object.assign({}, o));
}

/* ===== Lectura por ventana de tiempo =====
 * Las hojas de movimientos (Ventas, VentaDetalle, Abonos, Gastos, Pagos, Compras, ProyectoGastos, Inventario)
 * crecen al final y cada id lleva su fecha de creación. Las pantallas que solo necesitan lo reciente
 * (Inicio y Caja) leen únicamente la cola de la hoja: con un año de datos es varias veces más rápido. */
const DIAS_VENTANA = 90;
function ventanaMs_() { return msDeLocal_(diasAtras_(DIAS_VENTANA) + 'T00:00'); }
// Primera fila de la hoja (contando desde 1) cuyo id es de desdeMs en adelante. Se recuerda unas horas.
function filaDesde_(name, n, desdeMs) {
  const s = sh_(name), cs = CacheService.getScriptCache(), key = 'W_' + ck_(name) + '_' + Math.floor(desdeMs / 3600000);
  try { const c = cs.get(key); if (c && Number(c) >= 2 && Number(c) <= n + 1) return Number(c); } catch (e) {}
  const ids = s.getRange(2, 1, n - 1, 1).getValues();
  // De atrás hacia adelante hasta ver 50 filas seguidas más viejas que la ventana (tolera ids fuera de orden)
  let inicio = ids.length, viejos = 0;
  for (let i = ids.length - 1; i >= 0; i--) { const t = idMs_(ids[i][0]); if (t && t < desdeMs) { if (++viejos >= 50) break; } else { viejos = 0; inicio = i; } }
  const fila = inicio + 2;
  try { cs.put(key, String(fila), 21600); } catch (e) {}
  return fila;
}
function rowsDesde_(name, desdeMs) {
  const k = '_w_' + name + '_' + desdeMs;
  if (!MEMO[k]) {
    if (MEMO[name]) MEMO[k] = MEMO[name].filter(o => { const t = idMs_(o.id); return !t || t >= desdeMs; });
    else {
      const s = sh_(name), n = s.getLastRow(), h = SCHEMA[name];
      const r0 = n < 2 ? 2 : filaDesde_(name, n, desdeMs);
      MEMO[k] = n < r0 ? [] : s.getRange(r0, 1, n - r0 + 1, h.length).getValues().filter(r => r[0] !== '' && r[0] !== null).map(r => obj_(h, r)).filter(o => { const t = idMs_(o.id); return !t || t >= desdeMs; });
    }
  }
  return MEMO[k].map(o => Object.assign({}, o));
}
// Una sola columna de la hoja (mucho más liviano que leerla completa)
function columna_(name, col) {
  const k = '_c_' + name + '_' + col;
  if (!MEMO[k]) {
    if (MEMO[name]) MEMO[k] = MEMO[name].map(o => o[col]);
    else {
      const s = sh_(name), n = s.getLastRow(), h = SCHEMA[name], ci = h.indexOf(col) + 1;
      MEMO[k] = n < 2 || !ci ? [] : s.getRange(2, ci, n - 1, 1).getValues().map(r => { const o = obj_([col], r); return o[col]; });
    }
  }
  return MEMO[k];
}
function invalidar_(name) {
  delete MEMO[name];
  Object.keys(MEMO).forEach(k => { if (k.indexOf('_w_' + name + '_') === 0 || k.indexOf('_c_' + name + '_') === 0) delete MEMO[k]; });
  if (name === 'Ventas' || name === 'Gastos' || name === 'Distribuciones') { try { CacheService.getScriptCache().remove('RM_' + (NEG ? NEG.id : '')); } catch (e) {} }
  try { const cs = CacheService.getScriptCache(); cs.remove(ck_(name)); cs.put('V' + ck_(name), String(Date.now()) + Math.random(), 21600); } catch (e) {}
}

// Texto que empieza con = + - @ se guarda como texto (si no, la hoja lo toma como fórmula)
function cell_(v, k) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string' && /^[=+\-@]/.test(v) && !(k && TEXTO.has(k))) return "'" + v;
  return v;
}

function findRow_(s, id) {
  const n = s.getLastRow();
  if (n < 2 || !id) return 0;
  const f = s.getRange(2, 1, n - 1, 1).createTextFinder(String(id)).matchEntireCell(true).matchCase(true).findNext();
  return f ? f.getRow() : 0;
}

// Asegura que la hoja tenga filas para escribir n filas más y que las columnas de texto queden como texto
function filasLibres_(s, name, n) {
  const desde = s.getLastRow() + 1, max = s.getMaxRows(), falta = desde + n - 1 - max;
  if (falta > 0) {
    s.insertRowsAfter(max, falta + 200);
    SCHEMA[name].forEach((k, i) => { if (TEXTO.has(k)) s.getRange(max + 1, i + 1, falta + 200, 1).setNumberFormat('@'); });
  }
  return desde;
}

let SEQ_ = 0, RELOJ_ = null; // RELOJ_: solo para crear el negocio de ejemplo con fechas pasadas
function newId_(name) {
  SEQ_ = (SEQ_ + 1) % 1296;
  const ms = RELOJ_ && RELOJ_.f ? msDeLocal_(RELOJ_.f) : Date.now();
  return (PREFIJO[name] || 'X') + ms.toString(36).toUpperCase() + SEQ_.toString(36).toUpperCase().padStart(2, '0') +
    Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, '0');
}

function upsert_(name, rec) {
  const s = sh_(name), h = SCHEMA[name];
  const r = rec.id ? findRow_(s, rec.id) : 0;
  let full = rec;
  if (r) {
    const prev = obj_(h, s.getRange(r, 1, 1, h.length).getValues()[0]);
    full = Object.assign(prev, rec);
  } else if (!full.id) {
    full.id = newId_(name);
  }
  const row = h.map(k => cell_(full[k], k));
  if (r) s.getRange(r, 1, 1, h.length).setValues([row]);
  else s.getRange(filasLibres_(s, name, 1), 1, 1, h.length).setValues([row]);
  invalidar_(name);
  return obj_(h, h.map(k => cell_(full[k])));
}

function appendRows_(name, objs) {
  if (!objs.length) return;
  const s = sh_(name), h = SCHEMA[name];
  const vals = objs.map(o => h.map(k => cell_(o[k], k)));
  s.getRange(filasLibres_(s, name, vals.length), 1, vals.length, h.length).setValues(vals);
  invalidar_(name);
}

function deleteRow_(name, id) {
  const s = sh_(name), r = findRow_(s, id);
  if (!r) throw new Error('Registro no encontrado');
  s.deleteRow(r);
  invalidar_(name);
}

function ahora_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm"); }
function hoy_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function diasAtras_(n) { return Utilities.formatDate(new Date(Date.now() - n * 86400000), TZ, 'yyyy-MM-dd'); }
function r2_(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function r3_(n) { return Math.round((Number(n) || 0) * 1000) / 1000; }
function r4_(n) { return Math.round((Number(n) || 0) * 10000) / 10000; } // costos unitarios (0.125 por tornillo)
function esNum_(x) { return x !== '' && x !== null && x !== undefined && typeof x !== 'boolean' && isFinite(Number(x)); }
// Momento exacto (ms) en que se creó un registro: va dentro de su id
function idMs_(id) { const n = parseInt(String(id || '').slice(1, 9), 36); return n > 0 ? n : 0; }
// 'YYYY-MM-DDTHH:MM[:SS]' (hora de Honduras, sin horario de verano) → ms
function msDeLocal_(f) { const x = String(f || ''); if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(x)) return 0; return Date.parse(x.slice(0, 16) + ':' + (x.slice(17, 19) || '00') + '-06:00') || 0; }
function marca_() { return String(RELOJ_ && RELOJ_.f ? msDeLocal_(RELOJ_.f) : Date.now()); }
// Opciones del producto para la tienda: «Talla: S, M, L | Color: Negro, Blanco»
function opciones_(t) {
  return String(t || '').split('|').map(g => {
    const i = g.indexOf(':'); if (i < 0) return '';
    const n = txt_(g.slice(0, i), 30), v = g.slice(i + 1).split(',').map(x => txt_(x, 30)).filter(Boolean).slice(0, 20);
    return n && v.length ? n + ': ' + v.join(', ') : '';
  }).filter(Boolean).slice(0, 3).join(' | ').slice(0, 400);
}
function txt_(s, max) { return String(s === undefined || s === null ? '' : s).trim().replace(/\s+/g, ' ').slice(0, max || 200); }
function tel8_(t) { return String(t || '').replace(/\D/g, '').slice(-8); }
function porId_(lista) { const m = Object.create(null); lista.forEach(x => { m[x.id] = x; }); return m; }
// Ordena de más reciente a más antiguo (los del mismo minuto: el último registrado primero)
function desc_(lista, campo) { return lista.slice().reverse().sort((a, b) => a[campo] < b[campo] ? 1 : a[campo] > b[campo] ? -1 : 0); }
function parseJ_(s, def) { try { return s ? JSON.parse(s) : def; } catch (e) { return def; } }
function money_(n, cfg) { return (cfg.moneda || 'L') + ' ' + r2_(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

/* ===================== SEGURIDAD ===================== */

function hash_(clave, salt) {
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + clave, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(b);
}

function publico_(u) { const o = Object.assign({}, u); delete o.hash; delete o.salt; return o; }

function req_(u, roles) {
  if (roles.indexOf(u.rol) < 0) throw new Error('No tienes permiso para esta acción');
}

function login_(d) {
  const c = CacheService.getScriptCache();
  const usuario = String(d.usuario || '').trim().toLowerCase();
  const kf = 'F_' + usuario;
  const fallos = Number(c.get(kf) || 0);
  if (fallos >= 5) throw new Error('Demasiados intentos fallidos. Espera 10 minutos.');
  const u = rows_('Usuarios').find(x => String(x.usuario).toLowerCase() === usuario);
  if (!u || !u.activo || hash_(String(d.clave || ''), u.salt) !== u.hash) {
    c.put(kf, String(fallos + 1), 600);
    throw new Error('Usuario o contraseña incorrectos');
  }
  c.remove(kf);
  return { token: nuevoToken_(u.id + '|' + String(u.salt).slice(0, 8)), usuario: publico_(u) };
}

function auth_(token) {
  if (!token) throw new Error('SESION');
  const c = CacheService.getScriptCache();
  const val = c.get('S_' + token);
  if (!val) throw new Error('SESION');
  const p = val.split('|');
  let uid = p[0], firma = p[1];
  if (MULTI_NEGOCIO) {
    const lic = negocioPorId_(p[0]);
    if (!lic) throw new Error('SESION');
    setNegocio_(lic); uid = p[1]; firma = p[2];
    bloquearSiVence_();
  }
  const u = rows_('Usuarios').find(x => x.id === uid);
  if (!u || !u.activo) throw new Error('SESION');
  if (firma && String(u.salt).slice(0, 8) !== firma) throw new Error('SESION'); // le cambiaron el PIN: se cierran las sesiones abiertas
  c.put('S_' + token, val, SESION_SEG); // sesión deslizante
  return u;
}

function nuevoToken_(valor) {
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put('S_' + token, valor, SESION_SEG);
  return token;
}

function cambiarClave_(u, d) {
  const c = CacheService.getScriptCache(), kf = 'FC_' + (NEG ? NEG.id : '') + u.id, fallos = Number(c.get(kf) || 0);
  if (fallos >= 5) throw new Error('Demasiados intentos fallidos. Espera 10 minutos.');
  if (hash_(String(d.actual || ''), u.salt) !== u.hash) { c.put(kf, String(fallos + 1), 600); throw new Error(MULTI_NEGOCIO ? 'El PIN actual no es correcto' : 'La contraseña actual no es correcta'); }
  c.remove(kf);
  if (MULTI_NEGOCIO ? !/^\d{4,6}$/.test(String(d.nueva || '')) : String(d.nueva || '').length < 6) throw new Error(MULTI_NEGOCIO ? 'El PIN debe tener de 4 a 6 números' : 'La nueva contraseña debe tener al menos 6 caracteres');
  const salt = Utilities.getUuid();
  upsert_('Usuarios', { id: u.id, salt: salt, hash: hash_(d.nueva, salt) });
  // Esta sesión sigue abierta con la firma nueva; las demás se cierran
  const val = MULTI_NEGOCIO && NEG ? NEG.id + '|' + u.id + '|' + salt.slice(0, 8) : u.id + '|' + salt.slice(0, 8);
  if (d._token) c.put('S_' + d._token, val, SESION_SEG);
  return true;
}

function guardarUsuario_(u, d) {
  req_(u, ['admin']);
  const r = Object.assign({}, d.registro || {});
  const todos = rows_('Usuarios');
  r.usuario = MULTI_NEGOCIO ? waNorm_(r.usuario) : String(r.usuario || '').trim().toLowerCase();
  r.nombre = txt_(r.nombre, 60);
  if (!r.usuario || !r.nombre) throw new Error(MULTI_NEGOCIO ? 'Nombre y WhatsApp son obligatorios' : 'Usuario y nombre son obligatorios');
  if (MULTI_NEGOCIO) {
    if (r.usuario.length < 10) throw new Error('Escribe un número de WhatsApp válido');
    if (mRows_('Accesos').some(x => String(x.whatsapp) === r.usuario && !(x.negocioId === NEG.id && x.usuarioId === r.id))) throw new Error('Ese WhatsApp ya está registrado en otra cuenta');
  }
  if (/\s/.test(r.usuario)) throw new Error('El usuario no debe tener espacios');
  if (todos.some(x => x.usuario === r.usuario && x.id !== r.id)) throw new Error('Ese usuario ya existe');
  if (ROLES.indexOf(r.rol) < 0) throw new Error('Rol no válido');
  if (r.id === u.id && (r.rol !== 'admin' || r.activo === false)) throw new Error('No puedes quitarte el rol de administrador ni desactivarte');
  delete r.hash; delete r.salt;
  if (d.clave) {
    if (MULTI_NEGOCIO && !/^\d{4,6}$/.test(String(d.clave))) throw new Error('El PIN debe tener de 4 a 6 números');
    if (!MULTI_NEGOCIO && String(d.clave).length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');
    r.salt = Utilities.getUuid();
    r.hash = hash_(d.clave, r.salt);
  } else if (!r.id) {
    throw new Error(MULTI_NEGOCIO ? 'Asigna un PIN al nuevo usuario' : 'Asigna una contraseña al nuevo usuario');
  }
  if (!r.id) { r.creado = ahora_(); if (r.activo === undefined) r.activo = true; }
  const g = upsert_('Usuarios', r);
  // Si el administrador cambió su propio PIN, esta sesión sigue abierta (las demás se cierran)
  if (g.id === u.id && r.salt && d._token) { try { CacheService.getScriptCache().put('S_' + d._token, (MULTI_NEGOCIO && NEG ? NEG.id + '|' : '') + u.id + '|' + r.salt.slice(0, 8), SESION_SEG); } catch (e) {} }
  if (MULTI_NEGOCIO) {
    const acc = mRows_('Accesos').find(x => x.negocioId === NEG.id && x.usuarioId === g.id);
    if (acc) mSet_('Accesos', acc, { whatsapp: g.usuario, activo: g.activo });
    else mAppend_('Accesos', { whatsapp: g.usuario, negocioId: NEG.id, usuarioId: g.id, activo: g.activo });
    mSet_('Licencias', NEG.lic, { usuarios: rows_('Usuarios').filter(x => x.activo).length });
  }
  return publico_(g);
}

/* ===================== CONFIGURACIÓN ===================== */

function config_() {
  const o = Object.assign({}, CONFIG_DEF);
  rows_('Config').forEach(r => { o[r.clave] = String(r.valor); });
  return o;
}

function guardarConfig_(reg) {
  if (reg && reg.logo && String(reg.logo).length > 48000) throw new Error('El logo es muy pesado. Usa una imagen más sencilla o más pequeña.');
  const s = sh_('Config');
  invalidar_('Config');
  const actual = Object.assign(config_(), reg || {});
  const vals = Object.keys(actual).map(k => [k, String(actual[k])]);
  const antes = Math.max(0, s.getLastRow() - 1);
  filasLibres_(s, 'Config', Math.max(0, vals.length - antes));
  s.getRange(2, 1, vals.length, 2).setValues(vals);
  if (antes > vals.length) s.getRange(2 + vals.length, 1, antes - vals.length, 2).clearContent();
  invalidar_('Config');
  return actual;
}

// Número consecutivo para ventas (V), compras (C) y pedidos (P)
function siguiente_(letra) {
  const k = 'seq' + letra, cfg = config_();
  const n = (Number(cfg[k]) || 0) + 1;
  const o = {}; o[k] = String(n);
  guardarConfig_(o);
  return letra + '-' + String(n).padStart(5, '0');
}

/* ===================== DATOS GENERALES ===================== */

function saldosClientes_() {
  const m = {};
  // Solo tres columnas de Ventas: con miles de ventas es mucho más rápido que leer la hoja entera
  const cli = columna_('Ventas', 'clienteId'), saldo = columna_('Ventas', 'saldo'), anul = columna_('Ventas', 'anulada');
  for (let i = 0; i < cli.length; i++) { if (!anul[i] && saldo[i] > 0.004 && cli[i]) m[cli[i]] = r2_((m[cli[i]] || 0) + saldo[i]); }
  return m;
}
function saldosProveedores_() {
  const m = {};
  rows_('Compras').forEach(c => { if (!c.anulada && c.saldo > 0.004 && c.proveedorId) m[c.proveedorId] = r2_((m[c.proveedorId] || 0) + c.saldo); });
  return m;
}

function bootstrap_(u, d) {
  // Una vez al día: borra las fotos de productos sin movimiento por más de 3 meses
  if (u.rol === 'admin' && config_().sysLimpieza !== hoy_()) { try { lock_(() => limpiarFotos_()); } catch (e) {} }
  // Después de actualizar el sistema: agrega las columnas nuevas a las hojas de este negocio
  if (config_().sysVer !== VERSION) { try { lock_(() => asegurarEncabezados_()); } catch (e) {} }
  const sc = u.rol === 'bodega' ? {} : saldosClientes_();
  const sp = u.rol === 'cajero' ? {} : saldosProveedores_();
  const r = {
    usuario: publico_(u),
    config: config_(),
    usuarios: rows_('Usuarios').map(publico_),
    productos: rows_('Productos'),
    clientes: u.rol === 'bodega' ? [] : rows_('Clientes').map(c => { c.saldo = sc[c.id] || 0; return c; }),
    proveedores: u.rol === 'cajero' ? [] : rows_('Proveedores').map(p => { p.saldo = sp[p.id] || 0; return p; }),
    gastoCats: ['admin','cajero'].indexOf(u.rol) >= 0 ? catalogoGastos_() : [],
    giros: Object.keys(GIROS).map(k => ({ id: k, n: GIROS[k].n, cats: GIROS[k].cats })),
    licencia: licencia_(),
    plus: plus_(),
    plusIncluido: plusIncluido_(),
    negocioId: MULTI_NEGOCIO && NEG ? NEG.id : '',
    multi: MULTI_NEGOCIO,
    version: VERSION,
    sar: estadoSAR_()
  };
  sinInternos_(r.config);
  if (MULTI_NEGOCIO && NEG) { try { mSet_('Licencias', NEG.lic, { ultimaConexion: ahora_().replace('T', ' ') }); } catch (e) {} }
  if (d && d.inicio) r.inicio = inicio_(u);
  return r;
}

/* ===================== LICENCIA ===================== */

function licencia_() {
  if (MULTI_NEGOCIO) return NEG ? licNegocio_(NEG.lic) : { estado: 'completa' };
  if (!DIAS_PRUEBA) return { estado: 'completa' };
  const pr = PropertiesService.getScriptProperties();
  if (pr.getProperty('LICENCIA') === 'activa') return { estado: 'completa' };
  let ini = pr.getProperty('PRUEBA_INICIO');
  if (!ini) { ini = String(Date.now()); pr.setProperty('PRUEBA_INICIO', ini); }
  const extra = Number(pr.getProperty('PRUEBA_EXTRA') || 0);
  const vence = Number(ini) + (DIAS_PRUEBA + extra) * 86400000;
  const resta = Math.ceil((vence - Date.now()) / 86400000);
  return { estado: resta > 0 ? 'prueba' : 'vencida', diasRestantes: Math.max(0, resta),
    vence: Utilities.formatDate(new Date(vence), TZ, 'yyyy-MM-dd'), contacto: CONTACTO_WA };
}

// Ejecútala desde el editor (modo un solo negocio) cuando el cliente pague
function activarLicencia() {
  PropertiesService.getScriptProperties().setProperty('LICENCIA', 'activa');
  Logger.log('Sistema activado: licencia completa');
}

// Agrega días a la prueba (modo un solo negocio)
function extenderPrueba(dias) {
  const pr = PropertiesService.getScriptProperties();
  const n = Number(dias) || 7;
  pr.setProperty('PRUEBA_EXTRA', String(Number(pr.getProperty('PRUEBA_EXTRA') || 0) + n));
  Logger.log('Prueba extendida ' + n + ' días');
}

/* ===================== MULTI-NEGOCIO: LICENCIAS Y ACCESOS ===================== */

function master_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function masterSheet_(name) {
  const m = master_();
  let s = m.getSheetByName(name);
  if (s && !MEMO['_hm_' + name]) {
    // Después de actualizar el sistema: agrega al final las columnas nuevas del esquema
    MEMO['_hm_' + name] = 1;
    try {
      const h = SCHEMA_M[name], nc = s.getLastColumn(), cur = nc ? s.getRange(1, 1, 1, nc).getValues()[0].filter(x => x !== '') : [];
      if (cur.length && cur.length < h.length && cur.every((k, i) => k === h[i])) s.getRange(1, cur.length + 1, 1, h.length - cur.length).setValues([h.slice(cur.length)]).setFontWeight('bold').setBackground('#d10f6f').setFontColor('#ffffff');
    } catch (e) {}
  }
  if (!s) {
    s = m.insertSheet(name);
    const h = SCHEMA_M[name];
    s.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#d10f6f').setFontColor('#ffffff');
    s.setFrozenRows(1);
    h.forEach((k, i) => { if (M_TEXTO.indexOf(k) >= 0) s.getRange(2, i + 1, s.getMaxRows() - 1, 1).setNumberFormat('@'); });
    if (['Accesos', 'SoporteMsg', 'Seguimiento'].indexOf(name) >= 0) { try { s.hideSheet(); } catch (e) {} }
    if (name === 'Licencias') {
      try {
        const regla = SpreadsheetApp.newDataValidation().requireValueInList(['Prueba', 'Activa', 'Vencida', 'Bloqueada'], true).build();
        s.getRange(2, h.indexOf('estado') + 1, s.getMaxRows() - 1, 1).setDataValidation(regla);
        s.getRange(2, h.indexOf('vencePrueba') + 1, s.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd');
      } catch (e) {}
    }
  }
  return s;
}

function mRows_(name) {
  const key = '_m_' + name;
  if (!MEMO[key]) {
    const s = masterSheet_(name), n = s.getLastRow(), h = SCHEMA_M[name];
    MEMO[key] = n < 2 ? [] : s.getRange(2, 1, n - 1, h.length).getValues().map((r, i) => {
      const o = { _fila: i + 2 };
      h.forEach((k, j) => {
        let v = r[j];
        if (v instanceof Date) v = Utilities.formatDate(v, TZ, k === 'vencePrueba' ? 'yyyy-MM-dd' : 'yyyy-MM-dd HH:mm');
        o[k] = (v === null || v === undefined) ? '' : (k === 'activo' ? !(v === false || v === 'false' || v === 'FALSE') : String(v));
      });
      return o;
    }).filter(o => o[h[0]] !== '');
  }
  return MEMO[key];
}

const M_TEXTO = ['whatsapp','id','negocioId','usuarioId','hojaId','registro','ultimaConexion','chatId','fecha','ultimo','creado','version'];
function mId_(p) { return p + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, '0'); }
// Día de prueba en que va el negocio (1 = el día que se registró)
function diaPrueba_(l) { const ms = msDeLocal_(String(l.registro || '').replace(' ', 'T')); return ms ? Math.floor((Date.now() - ms) / 86400000) + 1 : 0; }
function mCell_(v, k) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string' && /^[=+\-@]/.test(v) && M_TEXTO.indexOf(k) < 0) return "'" + v;
  return v;
}
// Busca la fila del registro en la hoja maestra (la fila guardada puede haber cambiado si alguien borró filas)
function mFila_(name, rec) {
  if (!rec) return 0;
  const s = masterSheet_(name), h = SCHEMA_M[name], claves = name === 'Accesos' ? ['negocioId', 'usuarioId'] : ['id'];
  const coincide = r => claves.every(k => String(r[h.indexOf(k)]) === String(rec[k]));
  const f = Number(rec._fila);
  if (f >= 2 && f <= s.getLastRow() && coincide(s.getRange(f, 1, 1, h.length).getValues()[0])) return f;
  delete MEMO['_m_' + name];
  const x = mRows_(name).find(o => claves.every(k => String(o[k]) === String(rec[k])));
  if (x && rec) rec._fila = x._fila;
  return x ? x._fila : 0;
}
function mSet_(name, rec, campos) {
  const fila = mFila_(name, rec);
  if (!fila) return;
  const s = masterSheet_(name), h = SCHEMA_M[name];
  Object.keys(campos).forEach(k => { const c = h.indexOf(k); if (c >= 0) s.getRange(fila, c + 1).setValue(mCell_(campos[k], k)); });
  delete MEMO['_m_' + name];
}

function mAppend_(name, o) {
  masterSheet_(name).appendRow(SCHEMA_M[name].map(k => mCell_(o[k], k)));
  delete MEMO['_m_' + name];
}

// Normaliza el WhatsApp: solo números y con código de Honduras si vienen 8 dígitos
function waNorm_(w) {
  let d = String(w || '').replace(/\D/g, '');
  if (d.length === 8) d = '504' + d;
  return d;
}

function negocioPorId_(id) {
  const c = CacheService.getScriptCache();
  try { const x = c.get('L_' + id); if (x) return JSON.parse(x); } catch (e) {}
  const l = mRows_('Licencias').find(x => x.id === id) || null;
  if (l) { try { c.put('L_' + id, JSON.stringify(l), 120); } catch (e) {} }
  return l;
}

function setNegocio_(lic) {
  if (!NEG || NEG.id !== lic.id) delete MEMO._ss;
  NEG = { id: lic.id, hojaId: lic.hojaId, lic: lic };
}

function licNegocio_(l) {
  const est = String(l.estado || '').trim().toLowerCase();
  if (est === 'activa') return { estado: 'completa' };
  if (est === 'bloqueada') return { estado: 'bloqueada', contacto: CONTACTO_WA };
  const vence = String(l.vencePrueba || '').slice(0, 10);
  const fin = /^\d{4}-\d{2}-\d{2}$/.test(vence) ? new Date(vence + 'T00:00:00').getTime() : 0;
  const resta = Math.ceil((fin - Date.now()) / 86400000);
  const r = { estado: resta > 0 ? 'prueba' : 'vencida', diasRestantes: Math.max(0, resta), vence: vence, dia: diaPrueba_(l), contacto: CONTACTO_WA };
  const debe = r.estado === 'prueba' ? 'Prueba' : 'Vencida';
  if (l.estado !== debe && l.id) {
    try { mSet_('Licencias', l, { estado: debe }); CacheService.getScriptCache().remove('L_' + l.id); } catch (e) {}
    l.estado = debe;
  }
  return r;
}

function bloquearSiVence_() {
  const lic = licencia_();
  if (lic.estado === 'vencida' || lic.estado === 'bloqueada') {
    throw new Error('PRUEBA_VENCIDA|' + JSON.stringify({ contacto: CONTACTO_WA, nombre: NEG ? NEG.lic.negocio : '', tipo: lic.estado }));
  }
}

function loginMulti_(d) {
  const c = CacheService.getScriptCache(), wa = waNorm_(d.whatsapp), kf = 'F_' + wa;
  const fallos = Number(c.get(kf) || 0);
  if (fallos >= 5) throw new Error('Demasiados intentos fallidos. Espera 10 minutos.');
  const falla = () => { c.put(kf, String(fallos + 1), 600); return new Error('WhatsApp o PIN incorrectos'); };
  const acc = mRows_('Accesos').find(x => String(x.whatsapp) === wa && x.activo);
  if (!acc) throw falla();
  const lic = negocioPorId_(acc.negocioId);
  if (!lic) throw falla();
  setNegocio_(lic);
  const u = rows_('Usuarios').find(x => x.id === acc.usuarioId);
  if (!u || !u.activo || hash_(String(d.pin || ''), u.salt) !== u.hash) throw falla();
  c.remove(kf);
  bloquearSiVence_();
  return { token: nuevoToken_(lic.id + '|' + u.id + '|' + String(u.salt).slice(0, 8)), usuario: publico_(u) };
}

function carpeta_() {
  const it = DriveApp.getFoldersByName(CARPETA_DATOS);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA_DATOS);
}

function registrar_(d) {
  if (!MULTI_NEGOCIO) throw new Error('Acción no válida');
  const negocio = txt_(d.negocio, 60), nombre = txt_(d.nombre, 60);
  const giro = own_(GIROS, d.giro) ? d.giro : 'otro';
  const wa = waNorm_(d.whatsapp), pin = String(d.pin || '');
  if (!negocio) throw new Error('Escribe el nombre de tu negocio');
  if (!nombre) throw new Error('Escribe tu nombre');
  if (wa.length < 10) throw new Error('Escribe tu número de WhatsApp');
  if (!/^\d{4,6}$/.test(pin)) throw new Error('El PIN debe tener de 4 a 6 números');
  const yaExiste = () => { delete MEMO._m_Accesos; return mRows_('Accesos').some(x => String(x.whatsapp) === wa); };
  if (yaExiste()) throw new Error('Ese WhatsApp ya tiene una cuenta. Toca «Ya tengo cuenta» para ingresar.');
  const cs = CacheService.getScriptCache(), nReg = Number(cs.get('REG_H') || 0);
  if (nReg >= 30) throw new Error('Hay muchos registros en este momento. Intenta de nuevo en una hora o escríbenos por WhatsApp.');
  // La hoja del negocio se crea y se prepara fuera del candado (tarda): así no detiene las ventas de los demás negocios
  const libro = SpreadsheetApp.create('Negocio – ' + negocio);
  try { DriveApp.getFileById(libro.getId()).moveTo(carpeta_()); } catch (e) {}
  const id = 'N' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase();
  const ahora = ahora_().replace('T', ' ');
  const lic = { id: id, negocio: negocio, giro: GIROS[giro].n, dueno: nombre, whatsapp: wa, registro: ahora,
    vencePrueba: Utilities.formatDate(new Date(Date.now() + DIAS_PRUEBA * 86400000), TZ, 'yyyy-MM-dd'),
    estado: 'Prueba', usuarios: 1, ultimaConexion: ahora, hojaId: libro.getId() };
  NEG = { id: id, hojaId: libro.getId(), lic: lic };
  MEMO._ss = libro;
  instalarNegocio_({ nombre: negocio, giro: giro, telefono: wa.length === 11 && wa.indexOf('504') === 0 ? wa.slice(3, 7) + '-' + wa.slice(7) : wa,
    admin: { usuario: wa, nombre: nombre, pin: pin } });
  const adm = rows_('Usuarios').find(x => x.usuario === wa);
  return lock_(() => {
    if (yaExiste()) { try { DriveApp.getFileById(libro.getId()).setTrashed(true); } catch (e) {} throw new Error('Ese WhatsApp ya tiene una cuenta. Toca «Ya tengo cuenta» para ingresar.'); }
    mAppend_('Licencias', lic);
    mAppend_('Accesos', { whatsapp: wa, negocioId: id, usuarioId: adm.id, activo: true });
    cs.put('REG_H', String(nReg + 1), 3600);
    return { token: nuevoToken_(id + '|' + adm.id + '|' + String(adm.salt).slice(0, 8)), usuario: publico_(adm) };
  });
}

/* ===================== FUNCIONES POR TIPO DE NEGOCIO ===================== */
/* Cada giro trae encendidas las funciones que le sirven; cualquier negocio puede encender las demás desde Ajustes. */
const MODULOS_GIRO = { farmacia: ['caducidad'], tienda: ['caducidad'], comida: ['comanda'], repuestos: ['ordenes'], servicios: ['ordenes'], tecnologia: ['series'], boutique: ['variantes'], variedades: ['variantes'], panaderia: ['encargos'], belleza: ['agenda'], streaming: ['suscripciones'] };
const MODULOS = ['caducidad', 'comanda', 'ordenes', 'series', 'variantes', 'encargos', 'agenda', 'suscripciones'];
function modOn_(k) { const cfg = config_(); return (MODULOS_GIRO[cfg.giro] || []).indexOf(k) >= 0 || cfg[k] === 'si'; }
const EST_ORDEN = ['recibido', 'proceso', 'listo', 'entregado', 'cancelado'];
const EST_AGENDA = ['pendiente', 'atendido', 'cancelado'];

/* ---- Caducidad: productos por vencer (farmacia, pulpería) ---- */
function caducan_() {
  const h = hoy_(), lim = diasAtras_(-30);
  const l = rows_('Productos').filter(p => p.activo && p.caduca && p.caduca <= lim && (Number(p.stock) > 0 || p.tipo !== 'producto'))
    .map(p => ({ id: p.id, nombre: p.nombre, caduca: p.caduca, stock: p.stock, vencido: p.caduca < h }))
    .sort((a, b) => a.caduca < b.caduca ? -1 : 1);
  return { n: l.length, vencidos: l.filter(x => x.vencido).length, lista: l.slice(0, 8) };
}

/* ---- Órdenes de trabajo (taller, repuestos, servicios técnicos) ---- */
function ordenes_(u, d) {
  req_(u, ['admin', 'cajero', 'bodega']);
  const lim = diasAtras_(90) + 'T00:00';
  const l = rows_('Ordenes').filter(o => ['recibido', 'proceso', 'listo'].indexOf(o.estado) >= 0 || o.creado >= lim);
  return desc_(l, 'creado');
}
function ordenGuardar_(u, d) {
  req_(u, ['admin', 'cajero', 'bodega']);
  const r = Object.assign({}, d.registro || {});
  const prev = r.id ? rows_('Ordenes').find(x => x.id === r.id) : null;
  if (r.id && !prev) throw new Error('La orden ya no existe');
  if (prev && ['entregado', 'cancelado'].indexOf(prev.estado) >= 0 && r.estado !== undefined && r.estado !== prev.estado && u.rol !== 'admin') throw new Error('Una orden ' + (prev.estado === 'entregado' ? 'entregada' : 'cancelada') + ' ya no se cambia');
  if (prev && r.presupuesto !== undefined && u.rol === 'bodega') delete r.presupuesto;
  ['cliente', 'telefono', 'equipo', 'placa'].forEach(k => { if (r[k] !== undefined) r[k] = txt_(r[k], 80); });
  ['falla', 'diagnostico', 'nota'].forEach(k => { if (r[k] !== undefined) r[k] = txt_(r[k], 400); });
  if (prev && r.clienteId === '' && r.cliente === prev.cliente) { delete r.clienteId; delete r.cliente; delete r.telefono; }
  if (r.clienteId !== undefined) {
    const c = r.clienteId ? rows_('Clientes').find(x => x.id === r.clienteId) : null;
    if (r.clienteId && !c) throw new Error('El cliente ya no existe');
    if (c) { r.cliente = c.nombre; r.telefono = c.telefono; if (r.equipo && !c.equipo) upsert_('Clientes', { id: c.id, equipo: r.equipo + (r.placa ? ' · ' + r.placa : '') }); }
  }
  if (!prev && !r.cliente && !r.clienteId) throw new Error('Escribe el nombre del cliente');
  if (!prev && !r.equipo) throw new Error('Escribe qué equipo o vehículo recibes');
  if (r.estado !== undefined && EST_ORDEN.indexOf(r.estado) < 0) throw new Error('Estado no válido');
  if (r.anticipo !== undefined) r.anticipo = r2_(r.anticipo);
  if (r.presupuesto !== undefined) r.presupuesto = r2_(r.presupuesto);
  if (r.promesa !== undefined && r.promesa && !/^\d{4}-\d{2}-\d{2}$/.test(String(r.promesa))) r.promesa = '';
  if (!prev) { r.numero = siguiente_('O'); r.estado = r.estado || 'recibido'; r.usuarioId = u.id; r.creado = ahora_(); }
  r.actualizado = ahora_();
  if (prev && r.anticipo !== undefined && Number(prev.anticipo) > 0) delete r.anticipo; // el anticipo ya cobrado no se edita
  const o = upsert_('Ordenes', r);
  if (!prev && o.anticipo > 0) anticipoRegistrar_(u, o.anticipo, o.clienteId, 'Anticipo orden ' + o.numero, o.id, d.metodo);
  return o;
}
function ordenResumen_() {
  const l = rows_('Ordenes'), h = hoy_();
  return { recibido: l.filter(o => o.estado === 'recibido').length, proceso: l.filter(o => o.estado === 'proceso').length, listo: l.filter(o => o.estado === 'listo').length,
    atrasadas: l.filter(o => ['recibido', 'proceso'].indexOf(o.estado) >= 0 && o.promesa && o.promesa < h).length };
}

/* ---- Agenda: citas (belleza, servicios) y encargos (panadería, comida) ---- */
function agenda_(u, d) {
  req_(u, ['admin', 'cajero', 'bodega']);
  const desde = d.desde && /^\d{4}-\d{2}-\d{2}$/.test(d.desde) ? d.desde : diasAtras_(7), hasta = d.hasta && /^\d{4}-\d{2}-\d{2}$/.test(d.hasta) ? d.hasta : diasAtras_(-60);
  const tipo = d.tipo === 'encargo' ? 'encargo' : d.tipo === 'cita' ? 'cita' : '';
  return rows_('Agenda').filter(a => (!tipo || a.tipo === tipo) && ((a.dia >= desde && a.dia <= hasta) || a.estado === 'pendiente'))
    .sort((a, b) => (a.dia + ' ' + a.hora) < (b.dia + ' ' + b.hora) ? -1 : 1);
}
function agendaGuardar_(u, d) {
  req_(u, ['admin', 'cajero', 'bodega']);
  const r = Object.assign({}, d.registro || {});
  const prev = r.id ? rows_('Agenda').find(x => x.id === r.id) : null;
  if (r.id && !prev) throw new Error('El registro ya no existe');
  if (r.tipo !== undefined) r.tipo = r.tipo === 'encargo' ? 'encargo' : 'cita';
  if (!prev && !r.tipo) r.tipo = 'cita';
  ['cliente', 'telefono', 'atiende'].forEach(k => { if (r[k] !== undefined) r[k] = txt_(r[k], 80); });
  ['detalle', 'nota'].forEach(k => { if (r[k] !== undefined) r[k] = txt_(r[k], 400); });
  if (prev && r.clienteId === '' && r.cliente === prev.cliente) { delete r.clienteId; delete r.cliente; delete r.telefono; }
  if (r.clienteId !== undefined) {
    const c = r.clienteId ? rows_('Clientes').find(x => x.id === r.clienteId) : null;
    if (r.clienteId && !c) throw new Error('El cliente ya no existe');
    if (c) { r.cliente = c.nombre; r.telefono = c.telefono; }
  }
  if (!prev && !r.cliente && !r.clienteId) throw new Error('Escribe el nombre del cliente');
  if (r.dia !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(r.dia))) throw new Error('Elige el día');
  if (!prev && !r.dia) throw new Error('Elige el día');
  if (r.hora !== undefined) { r.hora = String(r.hora || '').slice(0, 5); if (r.hora && !/^\d{2}:\d{2}$/.test(r.hora)) throw new Error('Hora no válida'); }
  if (r.productoId !== undefined) { const p = r.productoId ? rows_('Productos').find(x => x.id === r.productoId) : null; if (r.productoId && !p) throw new Error('El producto ya no existe'); if (p && !r.detalle) r.detalle = p.nombre; if (p && r.monto === undefined) r.monto = p.precio; }
  if (!prev && !r.detalle) throw new Error((r.tipo === 'encargo' ? 'Escribe qué encargó' : 'Escribe el servicio'));
  if (r.monto !== undefined) r.monto = r2_(r.monto);
  if (r.anticipo !== undefined) r.anticipo = r2_(r.anticipo);
  if (r.estado !== undefined && EST_AGENDA.indexOf(r.estado) < 0) throw new Error('Estado no válido');
  if (!prev) { r.estado = r.estado || 'pendiente'; r.usuarioId = u.id; r.creado = ahora_(); }
  if (prev && r.anticipo !== undefined && Number(prev.anticipo) > 0) delete r.anticipo;
  r.actualizado = ahora_();
  const a = upsert_('Agenda', r);
  if (!prev && a.anticipo > 0) anticipoRegistrar_(u, a.anticipo, a.clienteId, 'Anticipo ' + (a.tipo === 'encargo' ? 'encargo' : 'cita') + ' · ' + a.detalle, a.id, d.metodo);
  return a;
}
function agendaResumen_(tipo) {
  const h = hoy_(), l = rows_('Agenda').filter(a => a.tipo === tipo && a.estado === 'pendiente');
  const hoyL = l.filter(a => a.dia === h).sort((a, b) => a.hora < b.hora ? -1 : 1), man = l.filter(a => a.dia === diasAtras_(-1)).length, atras = l.filter(a => a.dia < h).length;
  return { hoy: hoyL.length, manana: man, atrasados: atras, lista: hoyL.slice(0, 6).map(a => ({ id: a.id, hora: a.hora, cliente: a.cliente, detalle: a.detalle, atiende: a.atiende, anticipo: a.anticipo, monto: a.monto })), montoHoy: r2_(hoyL.reduce((t, a) => t + (Number(a.monto) || 0), 0)) };
}
// El anticipo entra a caja como un abono (sin venta todavía) ligado a la orden o encargo
function anticipoRegistrar_(u, monto, clienteId, nota, ref, metodo) {
  metodo = ['Efectivo','Tarjeta','Transferencia'].indexOf(metodo) >= 0 ? metodo : 'Efectivo';
  upsert_('Abonos', { fecha: ahora_(), clienteId: clienteId || '', monto: r2_(monto), metodo: metodo, aplicado: '[]', usuarioId: u.id, nota: txt_(nota, 200), anulado: false, ref: ref });
}
// Anticipo pendiente de aplicar de una orden/cita (lo que ya pagó el cliente y aún no se descontó de una venta)
function anticipoDe_(ref) {
  if (!ref) return 0;
  const o = rows_('Ordenes').find(x => x.id === ref) || rows_('Agenda').find(x => x.id === ref);
  if (!o || o.ventaId) return 0;
  return r2_(rows_('Abonos').filter(a => a.ref === ref && !a.anulado).reduce((t, a) => t + (Number(a.monto) || 0), 0));
}
// Al cobrar una venta ligada a una orden, cita o encargo, se cierra solo
function cerrarLigados_(d, venta) {
  if (d.ordenId) { const o = rows_('Ordenes').find(x => x.id === d.ordenId); if (o && o.estado !== 'entregado') upsert_('Ordenes', { id: o.id, estado: 'entregado', ventaId: venta.id, actualizado: ahora_() }); }
  if (d.agendaId) { const a = rows_('Agenda').find(x => x.id === d.agendaId); if (a && a.estado === 'pendiente') upsert_('Agenda', { id: a.id, estado: 'atendido', ventaId: venta.id, actualizado: ahora_() }); }
}

/* ===================== SUSCRIPCIONES (streaming, mensualidades) ===================== */
/* Para negocios que venden Netflix, Disney+, IPTV, gimnasio, internet…: cada venta de una suscripción queda con fecha de vencimiento,
 * la cuenta/perfil que se entregó y los datos de acceso. Las cuentas madre viven en la hoja «Cuentas». */
const PLATAFORMAS_DEF = [['Netflix', '#e50914'], ['Disney+', '#113ccf'], ['HBO Max', '#5822b4'], ['Prime Video', '#00a8e1'], ['Spotify', '#1db954'], ['YouTube Premium', '#ff0000'], ['Crunchyroll', '#f47521'], ['Paramount+', '#0064ff'], ['IPTV', '#111111']];
function susActivas_() { return modOn_('suscripciones'); }
// "Netflix:1|Disney+:1" → [{ plataforma, n }]
function incluye_(t) { return String(t || '').split('|').map(x => x.trim()).filter(Boolean).map(x => { const p = x.split(':'); return { plataforma: txt_(p[0], 40), n: Math.max(1, Math.min(10, parseInt(p[1], 10) || 1)) }; }).filter(x => x.plataforma).slice(0, 6); }
function susDeProducto_(p) { // qué se entrega al vender este producto: una lista de plataformas
  if (!p) return [];
  if (p.incluye) return incluye_(p.incluye).map(x => ({ plataforma: x.plataforma, n: x.n, entrega: 'perfil' }));
  if (p.plataforma) return [{ plataforma: p.plataforma, n: 1, entrega: p.entrega === 'cuenta' ? 'cuenta' : 'perfil' }];
  return [];
}
function mesesSumar_(fechaIso, meses) {
  const d = new Date(fechaIso + 'T12:00:00'); const dia = d.getDate();
  d.setMonth(d.getMonth() + meses); if (d.getDate() !== dia) d.setDate(0);
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}
function perfilN_(p) { return p === '' || p === undefined || p === null ? '' : Number(p); }
function susEstadoDe_(s, h) { if (s.estado === 'cancelada' || s.estado === 'renovada') return s.estado; return s.vence < h ? 'vencida' : 'activa'; }
// Perfiles ocupados: { cuentaId: { perfil: suscripción } } (solo activas o vencidas hace menos de 7 días, para dar margen a renovar)
function ocupados_() {
  const h = hoy_(), lim = diasAtras_(7), o = {};
  rows_('Suscripciones').forEach(s => { if (!s.cuentaId || s.estado === 'cancelada' || s.estado === 'renovada' || s.vence < lim) return; (o[s.cuentaId] = o[s.cuentaId] || {})[String(s.perfil || '0')] = s; });
  return o;
}
function susCuentas_(u) {
  req_(u, ['admin', 'cajero']);
  const oc = ocupados_(), h = hoy_(), cl = porId_(rows_('Clientes'));
  return rows_('Cuentas').map(c => {
    const n = Math.max(1, Number(c.perfiles) || 1), perfiles = [];
    for (let i = 1; i <= n; i++) { const s = (oc[c.id] || {})[String(i)]; perfiles.push(s ? { n: i, susId: s.id, cliente: s.cliente || (cl[s.clienteId] ? cl[s.clienteId].nombre : ''), vence: s.vence, estado: susEstadoDe_(s, h), pin: s.pin } : { n: i }); }
    const completa = (oc[c.id] || {})['0'];
    const o = Object.assign({}, c, { perfilesL: perfiles, ocupados: perfiles.filter(p => p.susId).length, completa: completa ? { susId: completa.id, cliente: completa.cliente, vence: completa.vence, estado: susEstadoDe_(completa, h) } : null });
    if (u.rol !== 'admin') { o.clave = o.clave ? '••••' : ''; }
    return o;
  });
}
function suscripciones_(u) {
  req_(u, ['admin', 'cajero']);
  const h = hoy_(), cu = porId_(rows_('Cuentas')), cl = porId_(rows_('Clientes'));
  return rows_('Suscripciones').map(s => {
    const c = cu[s.cuentaId], cli = cl[s.clienteId];
    return Object.assign({}, s, { perfil: perfilN_(s.perfil), estadoR: susEstadoDe_(s, h), dias: Math.ceil((msDeLocal_(s.vence + 'T00:00') - msDeLocal_(h + 'T00:00')) / 86400000),
      cuentaNombre: c ? c.nombre : '', correo: c ? c.correo : '', clave: c ? (u.rol === 'admin' || true ? c.clave : '') : '', telefono: cli ? cli.telefono : s.telefono, cliente: cli ? cli.nombre : s.cliente });
  }).sort((a, b) => a.vence < b.vence ? -1 : a.vence > b.vence ? 1 : 0);
}
function susEstado_(u, d) {
  req_(u, ['admin', 'cajero']);
  const s = rows_('Suscripciones').find(x => x.id === d.id); if (!s) throw new Error('La suscripción no existe');
  const r = { id: s.id };
  if (d.estado !== undefined) r.estado = d.estado === 'cancelada' ? 'cancelada' : 'activa';
  if (d.nota !== undefined) r.nota = txt_(d.nota, 120);
  if (d.pin !== undefined) r.pin = txt_(d.pin, 12);
  if (d.vence !== undefined) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.vence))) throw new Error('Fecha no válida'); r.vence = String(d.vence); }
  upsert_('Suscripciones', r);
  return suscripciones_(u);
}
// Al registrar una venta: crea las suscripciones que vienen en d.sus = [{ idx, meses, vence, renuevaId, asig: [{ plataforma, cuentaId, perfil, pin }] }]
function susRegistrar_(u, d, venta, items, pm) {
  if (!Array.isArray(d.sus) || !d.sus.length) return [];
  const h = hoy_(), oc = ocupados_(), cu = porId_(rows_('Cuentas')), cli = venta.clienteId ? rows_('Clientes').find(x => x.id === venta.clienteId) : null;
  const nuevas = [];
  d.sus.forEach(sd => {
    const it = items[Number(sd.idx)]; if (!it || !it.p) return;
    const entregas = susDeProducto_(it.p); if (!entregas.length) return;
    const meses = Math.max(1, Math.min(24, parseInt(sd.meses, 10) || 1));
    const vence = /^\d{4}-\d{2}-\d{2}$/.test(String(sd.vence || '')) ? String(sd.vence) : mesesSumar_(h, meses);
    if (vence < h) throw new Error('La fecha de vencimiento de «' + it.p.nombre + '» ya pasó');
    const asig = Array.isArray(sd.asig) ? sd.asig : [];
    const veces = Math.max(1, Math.min(10, Math.round(it.cantidad) || 1)), total = entregas.reduce((t, x) => t + x.n, 0) * veces;
    let k = 0;
    entregas.forEach(e => {
      for (let i = 0; i < e.n * veces; i++) {
        const a = asig[k++] || {};
        const venceA = /^\d{4}-\d{2}-\d{2}$/.test(String(a.vence || '')) ? String(a.vence) : vence;
        if (venceA < h) throw new Error('La fecha de vencimiento de ' + e.plataforma + ' ya pasó');
        const c = a.cuentaId ? cu[a.cuentaId] : null;
        if (a.cuentaId && !c) throw new Error('La cuenta elegida para ' + e.plataforma + ' ya no existe');
        const perfil = c ? (e.entrega === 'cuenta' ? 0 : Math.max(1, Math.min(Number(c.perfiles) || 1, parseInt(a.perfil, 10) || 1))) : '';
        if (c) {
          const ya = (oc[c.id] || {})[String(perfil)];
          if (ya && ya.id !== sd.renuevaId) throw new Error((perfil ? 'El perfil ' + perfil + ' de ' : 'La cuenta ') + c.nombre + ' ya está ocupado por ' + (ya.cliente || 'otro cliente'));
          if (perfil === 0 && Object.keys(oc[c.id] || {}).some(p => p !== '0' && (oc[c.id][p].id !== sd.renuevaId))) throw new Error('La cuenta ' + c.nombre + ' tiene perfiles vendidos por separado');
          (oc[c.id] = oc[c.id] || {})[String(perfil)] = { id: '_', cliente: cli ? cli.nombre : '' };
        }
        const s = upsert_('Suscripciones', { ventaId: venta.id, clienteId: venta.clienteId || '', cliente: cli ? cli.nombre : txt_(sd.cliente, 60), telefono: cli ? cli.telefono : '',
          productoId: it.p.id, producto: it.p.nombre, plataforma: e.plataforma, cuentaId: c ? c.id : '', perfil: perfil, pin: txt_(a.pin, 12), inicio: h, vence: venceA, meses: meses,
          precio: r2_(it.precio * it.cantidad / total), estado: 'activa', nota: '', creado: ahora_() });
        nuevas.push(s);
      }
    });
    if (sd.renuevaId) { const prev = rows_('Suscripciones').find(x => x.id === sd.renuevaId); if (prev) upsert_('Suscripciones', { id: prev.id, estado: 'renovada' }); }
  });
  return nuevas;
}
// Datos de acceso para el comprobante del cliente
function susAccesos_(lista) {
  const cu = porId_(rows_('Cuentas'));
  return lista.map(s => { const c = cu[s.cuentaId]; return { plataforma: s.plataforma, producto: s.producto, vence: s.vence, perfil: perfilN_(s.perfil), pin: s.pin, correo: c ? c.correo : '', clave: c ? c.clave : '', cuenta: c ? c.nombre : '' }; });
}
function susResumen_() {
  const h = hoy_(), dias = Math.max(1, Math.min(30, parseInt(config_().susAviso, 10) || 7)), sem = diasAtras_(-dias), l = rows_('Suscripciones').filter(s => s.estado !== 'cancelada' && s.estado !== 'renovada');
  const venc = l.filter(s => s.vence < h), hoyL = l.filter(s => s.vence === h), semL = l.filter(s => s.vence > h && s.vence <= sem);
  const suma = a => r2_(a.reduce((t, s) => t + (Number(s.precio) || 0), 0));
  const cu = rows_('Cuentas').filter(c => c.activo), oc = ocupados_();
  const perfiles = cu.reduce((t, c) => t + Math.max(1, Number(c.perfiles) || 1), 0), ocupados = cu.reduce((t, c) => t + (oc[c.id] ? (oc[c.id]['0'] ? Math.max(1, Number(c.perfiles) || 1) : Object.keys(oc[c.id]).length) : 0), 0);
  return { vencidas: venc.length, montoVencidas: suma(venc), hoy: hoyL.length, semana: semL.length, montoSemana: suma(semL.concat(hoyL)), activas: l.filter(s => s.vence >= h).length, cuentas: cu.length, perfiles: perfiles, ocupados: ocupados, dias: dias };
}
// Cambiar el tipo de negocio desde Ajustes: conserva todos los datos; opcionalmente carga ejemplos y desactiva los productos del tipo anterior
function cambiarGiro_(u, d) {
  req_(u, ['admin']);
  if (!own_(GIROS, d.giro)) throw new Error('Tipo de negocio no válido');
  const cfg = config_(), ant = cfg.giro;
  if (ant === d.giro) return { config: sinInternos_(config_()), productos: rows_('Productos') };
  let desactivados = 0;
  if (d.desactivar && own_(GIROS, ant)) {
    const cats = GIROS[ant].cats.map(c => c.toLowerCase());
    rows_('Productos').forEach(p => { if (p.activo && cats.indexOf(String(p.categoria).toLowerCase()) >= 0) { upsert_('Productos', { id: p.id, activo: false }); desactivados++; } });
  }
  guardarConfig_({ giro: d.giro });
  let agregados = 0;
  if (d.ejemplos) agregados = cargarEjemplos_(u, { giro: d.giro }).agregados;
  if (MULTI_NEGOCIO && NEG) { try { mSet_('Licencias', NEG.lic, { giro: GIROS[d.giro].n }); CacheService.getScriptCache().remove('L_' + NEG.id); } catch (e) {} }
  return { config: sinInternos_(config_()), productos: rows_('Productos'), agregados: agregados, desactivados: desactivados };
}

/* ===================== PANEL MOLINA (súper admin) Y SOPORTE ===================== */
/* El panel se abre en …/?panel con la clave guardada en Propiedades del script → PANEL_CLAVE.
 * Desde ahí se administran todos los negocios: licencias, Plus, prueba, pagos, seguimiento y el chat de soporte. */
function panelClave_() { return String(PropertiesService.getScriptProperties().getProperty('PANEL_CLAVE') || ''); }
function panelLogin_(d) {
  if (!MULTI_NEGOCIO) throw new Error('El panel solo funciona en modo multi-negocio');
  const c = CacheService.getScriptCache(), fallos = Number(c.get('FPANEL') || 0);
  if (fallos >= 5) throw new Error('Demasiados intentos. Espera 10 minutos.');
  const clave = panelClave_();
  if (!clave) throw new Error('Falta la clave del panel: en el Apps Script, Configuración del proyecto → Propiedades del script, crea PANEL_CLAVE.');
  if (String(d.clave || '') !== clave) { c.put('FPANEL', String(fallos + 1), 600); throw new Error('Clave incorrecta'); }
  c.remove('FPANEL');
  const tok = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  c.put('P_' + tok, '1', PANEL_SEG);
  return { token: tok, plantillas: plantillas_() };
}
function panelAuth_(req) {
  const t = String(req.panel || ''), c = CacheService.getScriptCache();
  if (!t || !c.get('P_' + t)) throw new Error('PANEL');
  c.put('P_' + t, '1', PANEL_SEG);
}
function rutaPanel_(a, d) {
  switch (a) {
    case 'panelResumen':           return panelResumen_();
    case 'panelNegocio':           return panelNegocio_(d);
    case 'panelAccion':            return panelAccion_(d);
    case 'panelContacto':          return panelContacto_(d);
    case 'panelPago':              return panelPago_(d);
    case 'panelNota':              return panelNota_(d);
    case 'panelPlantillas':        return plantillas_();
    case 'panelPlantillasGuardar': return plantillasGuardar_(d);
    case 'panelSoporte':           return panelSoporte_();
    case 'panelSoporteVer':        return panelSoporteVer_(d);
    case 'panelSoporteResponder':  return panelSoporteResponder_(d);
    case 'panelSoporteEstado':     return panelSoporteEstado_(d);
    case 'panelSalir':             return true;
  }
  throw new Error('Acción no válida: ' + a);
}
const PLANTILLAS_DEF = {
  dia3: 'Hola {dueno}, ¿qué tal te ha parecido Gestión de Negocio VM en {negocio}? Si algo no te cuadra, me decís y lo vemos 🙂',
  vence: 'Hola {dueno}, mañana termina tu prueba gratis de Gestión de Negocio VM. Si querés seguir usándolo en {negocio}, activamos tu licencia hoy mismo: es pago único, sin mensualidades.',
  inactivo: 'Hola {dueno}, vi que no has vuelto a entrar a Gestión de Negocio VM. ¿Te trabó algo? Te ayudo por acá.',
  vencida: 'Hola {dueno}, tu prueba de Gestión de Negocio VM ya terminó, pero tus datos de {negocio} siguen guardados. Cuando querás, activamos tu licencia y seguís donde lo dejaste.',
  activada: '¡Listo {dueno}! Tu licencia de Gestión de Negocio VM para {negocio} ya está activa. Gracias por confiar 🙌 Cualquier duda, me escribís.',
  bienvenida: '¡Bienvenido a Gestión de Negocio VM, {dueno}! Tenés 7 días para probarlo todo en {negocio}, incluida la tienda en línea. Si necesitás ayuda, escribime por aquí o desde Ayuda en la app.'
};
function plantillas_() {
  let p = {}; try { p = JSON.parse(PropertiesService.getScriptProperties().getProperty('PANEL_PLANTILLAS') || '{}'); } catch (e) { p = {}; }
  return Object.assign({}, PLANTILLAS_DEF, p);
}
function plantillasGuardar_(d) {
  const p = {}; Object.keys(PLANTILLAS_DEF).forEach(k => { if (d.plantillas && d.plantillas[k] !== undefined) p[k] = txt_(d.plantillas[k], 600); });
  PropertiesService.getScriptProperties().setProperty('PANEL_PLANTILLAS', JSON.stringify(p));
  return plantillas_();
}
function diasDesde_(f) { const ms = msDeLocal_(String(f || '').replace(' ', 'T')); return ms ? (Date.now() - ms) / 86400000 : 9999; }
// Ficha resumida de un negocio para el panel
function panelFicha_(l, segs) {
  const lic = licNegocio_(l), mis = segs.filter(x => x.negocioId === l.id);
  const hecho = tipo => mis.filter(x => x.tipo === tipo).map(x => x.fecha).sort().pop() || '';
  const est = lic.estado === 'completa' ? 'activa' : lic.estado, dia = diaPrueba_(l), sin = diasDesde_(l.ultimaConexion);
  const o = { id: l.id, negocio: l.negocio, giro: l.giro, dueno: l.dueno, whatsapp: l.whatsapp, registro: l.registro, vencePrueba: l.vencePrueba, estado: est, diasRestantes: lic.diasRestantes || 0, dia: dia,
    usuarios: Number(l.usuarios) || 1, ultimaConexion: l.ultimaConexion, sinEntrar: Math.floor(sin), plus: ['sí', 'si'].indexOf(String(l.plus).toLowerCase()) >= 0, notas: l.notas || '', contactar: '' };
  // ¿Toca contactarlo hoy?
  if (est === 'prueba' && dia >= 3 && !hecho('dia3')) o.contactar = 'dia3';
  else if (est === 'prueba' && lic.diasRestantes <= 1 && !hecho('vence')) o.contactar = 'vence';
  else if (est === 'vencida' && diasDesde_(hecho('vencida')) > 14) o.contactar = 'vencida';
  else if ((est === 'prueba' || est === 'activa') && sin >= 5 && diasDesde_(hecho('inactivo')) > 7) o.contactar = 'inactivo';
  return o;
}
function panelResumen_() {
  const segs = mRows_('Seguimiento'), lics = mRows_('Licencias').map(l => panelFicha_(l, segs));
  lics.sort((a, b) => a.ultimaConexion < b.ultimaConexion ? 1 : -1);
  const mes = hoy_().slice(0, 7), pagos = mRows_('PagosLic').filter(p => String(p.fecha).slice(0, 7) === mes);
  const sop = mRows_('Soporte');
  const n = k => lics.filter(x => x.estado === k).length;
  const orden = { dia3: 0, vence: 1, inactivo: 2, vencida: 3 };
  return { kpis: { activos: n('activa'), prueba: n('prueba'), vencidos: n('vencida'), bloqueados: n('bloqueada'), plus: lics.filter(x => x.plus).length, venceManana: lics.filter(x => x.estado === 'prueba' && x.diasRestantes <= 1).length,
      ingresosMes: r2_(pagos.reduce((a, p) => a + (Number(p.monto) || 0), 0)), pagosMes: pagos.length, registrosSemana: lics.filter(x => diasDesde_(x.registro) <= 7).length },
    contactar: lics.filter(x => x.contactar).sort((a, b) => orden[a.contactar] - orden[b.contactar]),
    negocios: lics, soporteSin: sop.filter(c => Number(c.sinLeerAdm) > 0).length, erroresAbiertos: sop.filter(c => c.motivo === 'error' && c.estado !== 'resuelto').length, plantillas: plantillas_(), hoy: hoy_() };
}
function licDe_(id) { const l = mRows_('Licencias').find(x => x.id === id); if (!l) throw new Error('Ese negocio no existe'); return l; }
function panelNegocio_(d) {
  const l = licDe_(d.id), f = panelFicha_(l, mRows_('Seguimiento'));
  f.seguimiento = mRows_('Seguimiento').filter(x => x.negocioId === l.id).sort((a, b) => a.fecha < b.fecha ? 1 : -1);
  f.pagos = mRows_('PagosLic').filter(x => x.negocioId === l.id).sort((a, b) => a.fecha < b.fecha ? 1 : -1);
  f.soporte = mRows_('Soporte').filter(x => x.negocioId === l.id).sort((a, b) => a.ultimo < b.ultimo ? 1 : -1).map(c => sopPublico_(c, 'adm'));
  // Uso (solo conteos, nunca sus datos): se lee la hoja del negocio
  f.uso = null;
  try {
    Object.keys(MEMO).forEach(k => { if (k.indexOf('_m_') !== 0 && k.indexOf('_hm_') !== 0) delete MEMO[k]; });
    setNegocio_(l);
    const lim = Date.now() - 30 * 86400000, v30 = rowsDesde_('Ventas', lim).filter(v => !v.anulada && msDeLocal_(v.fecha) >= lim);
    f.uso = { ventas30: v30.length, monto30: r2_(v30.reduce((a, v) => a + (Number(v.total) || 0), 0)), productos: rows_('Productos').filter(p => p.activo).length, clientes: rows_('Clientes').filter(c => c.activo).length,
      pedidos: rows_('Pedidos').length, tienda: config_().tienda === 'si', usuarios: rows_('Usuarios').filter(u => u.activo).length };
  } catch (e) { f.usoError = String(e.message || e); }
  NEG = null; delete MEMO._ss;
  return f;
}
function panelAccion_(d) {
  const l = licDe_(d.id), f = ahora_().replace('T', ' ');
  const upd = {}; let nota = '';
  const pago = (concepto) => { if (Number(d.monto) > 0) mAppend_('PagosLic', { id: mId_('G'), negocioId: l.id, fecha: f, monto: r2_(Number(d.monto)), concepto: txt_(d.concepto, 60) || concepto, metodo: txt_(d.metodo, 20) || 'Efectivo', nota: '' }); };
  switch (d.accion) {
    case 'activar':    upd.estado = 'Activa'; nota = 'Licencia activada'; pago('Licencia'); break;
    case 'plus':       upd.plus = 'Sí'; nota = 'Plus activado'; pago('Plus'); break;
    case 'quitarPlus': upd.plus = ''; nota = 'Plus desactivado'; break;
    case 'extender': { const dias = Math.max(1, Math.min(90, Number(d.dias) || 7)); const base = Math.max(Date.now(), msDeLocal_(String(l.vencePrueba).slice(0, 10) + 'T00:00') || 0);
      upd.vencePrueba = Utilities.formatDate(new Date(base + dias * 86400000), TZ, 'yyyy-MM-dd'); upd.estado = 'Prueba'; nota = 'Prueba extendida ' + dias + ' días'; break; }
    case 'pausar':     upd.estado = 'Bloqueada'; nota = 'Acceso pausado'; break;
    case 'reanudar':   upd.estado = (msDeLocal_(String(l.vencePrueba).slice(0, 10) + 'T23:59') || 0) > Date.now() ? 'Prueba' : 'Activa'; nota = 'Acceso reanudado'; break;
    default: throw new Error('Acción no válida');
  }
  mSet_('Licencias', l, upd);
  CacheService.getScriptCache().remove('L_' + l.id);
  mAppend_('Seguimiento', { id: mId_('S'), negocioId: l.id, tipo: 'accion', fecha: f, nota: nota + (d.nota ? ' · ' + txt_(d.nota, 120) : '') });
  return panelNegocio_({ id: l.id });
}
function panelContacto_(d) {
  const l = licDe_(d.id), tipo = String(d.tipo || 'manual').replace(/[^a-z0-9]/gi, '').slice(0, 20);
  mAppend_('Seguimiento', { id: mId_('S'), negocioId: l.id, tipo: tipo, fecha: ahora_().replace('T', ' '), nota: txt_(d.nota, 160) || 'Contactado por WhatsApp' });
  return panelNegocio_({ id: l.id });
}
function panelPago_(d) {
  const l = licDe_(d.id), monto = r2_(Number(d.monto) || 0);
  if (!(monto > 0)) throw new Error('Escribe el monto');
  mAppend_('PagosLic', { id: mId_('G'), negocioId: l.id, fecha: ahora_().replace('T', ' '), monto: monto, concepto: txt_(d.concepto, 60) || 'Pago', metodo: txt_(d.metodo, 20) || 'Efectivo', nota: txt_(d.nota, 120) });
  return panelNegocio_({ id: l.id });
}
function panelNota_(d) { const l = licDe_(d.id); mSet_('Licencias', l, { notas: txt_(d.notas, 500) }); return panelNegocio_({ id: l.id }); }

/* ---- Soporte: chat del negocio con el administrador ---- */
function sopPublico_(c, lado) {
  return { id: c.id, negocioId: c.negocioId, negocio: c.negocio, dueno: c.dueno, whatsapp: c.whatsapp, motivo: c.motivo, motivoT: MOTIVOS[c.motivo] || c.motivo, modulo: c.modulo, estado: c.estado || 'abierto', version: c.version, diaPrueba: c.diaPrueba,
    ultimo: c.ultimo, ultimoTexto: c.ultimoTexto, deCliente: String(c.deCliente) === 'true', sinLeer: Number(lado === 'adm' ? c.sinLeerAdm : c.sinLeerCli) || 0, creado: c.creado };
}
function sopMsgs_(id) { return mRows_('SoporteMsg').filter(m => m.chatId === id).sort((a, b) => a.fecha < b.fecha ? -1 : 1).map(m => ({ id: m.id, de: m.de, texto: m.texto, foto: m.foto || '', quien: m.quien, fecha: m.fecha })); }
function fotoChat_(f) { f = String(f || ''); if (!f) return ''; if (f.indexOf('data:image/') !== 0 || f.length > 48000) throw new Error('La captura es muy grande. Prueba con una más pequeña.'); return f; }
function soporteCrear_(u, d) {
  if (!MULTI_NEGOCIO || !NEG) throw new Error('El chat con el administrador solo funciona en la versión multi-negocio');
  const motivo = own_(MOTIVOS, d.motivo) ? d.motivo : 'otro', texto = String(d.texto || '').trim().slice(0, 800);
  if (texto.length < 3) throw new Error('Cuéntanos qué pasó');
  if (mRows_('Soporte').filter(c => c.negocioId === NEG.id && c.estado !== 'resuelto').length >= 5) throw new Error('Ya tienes 5 conversaciones abiertas. Continúa en una de ellas.');
  const f = ahora_().replace('T', ' '), lic = NEG.lic, id = mId_('T');
  const c = { id: id, negocioId: NEG.id, negocio: lic.negocio, dueno: u.nombre || lic.dueno, whatsapp: lic.whatsapp, motivo: motivo, modulo: txt_(d.modulo, 40), estado: 'abierto', version: txt_(d.version, 12),
    diaPrueba: licNegocio_(lic).estado === 'prueba' ? diaPrueba_(lic) : '', ultimo: f, ultimoTexto: texto.slice(0, 120), deCliente: true, sinLeerAdm: 1, sinLeerCli: 0, creado: f };
  mAppend_('Soporte', c);
  mAppend_('SoporteMsg', { id: mId_('M'), chatId: id, de: 'cli', texto: texto, foto: fotoChat_(d.foto), quien: u.nombre || '', fecha: f });
  return { chat: sopPublico_(c, 'cli'), mensajes: sopMsgs_(id) };
}
function soporteLista_(u) {
  if (!MULTI_NEGOCIO || !NEG) return [];
  return mRows_('Soporte').filter(c => c.negocioId === NEG.id).sort((a, b) => a.ultimo < b.ultimo ? 1 : -1).map(c => sopPublico_(c, 'cli'));
}
function sopDe_(id, negocioId) { const c = mRows_('Soporte').find(x => x.id === id && (!negocioId || x.negocioId === negocioId)); if (!c) throw new Error('Esta conversación ya no existe'); return c; }
function soporteVer_(u, d) {
  const c = sopDe_(d.id, NEG ? NEG.id : '');
  if (Number(c.sinLeerCli) > 0) { mSet_('Soporte', c, { sinLeerCli: 0 }); c.sinLeerCli = 0; }
  return { chat: sopPublico_(c, 'cli'), mensajes: sopMsgs_(c.id) };
}
function soporteEnviar_(u, d) {
  const c = sopDe_(d.id, NEG ? NEG.id : ''), texto = String(d.texto || '').trim().slice(0, 800);
  if (!texto && !d.foto) throw new Error('Escribe tu mensaje');
  const f = ahora_().replace('T', ' ');
  mAppend_('SoporteMsg', { id: mId_('M'), chatId: c.id, de: 'cli', texto: texto, foto: fotoChat_(d.foto), quien: u.nombre || '', fecha: f });
  mSet_('Soporte', c, { ultimo: f, ultimoTexto: (texto || '📷 Captura').slice(0, 120), deCliente: true, sinLeerAdm: (Number(c.sinLeerAdm) || 0) + 1, sinLeerCli: 0, estado: 'abierto' });
  return soporteVer_(u, { id: c.id });
}
function panelSoporte_() { return mRows_('Soporte').sort((a, b) => a.ultimo < b.ultimo ? 1 : -1).map(c => sopPublico_(c, 'adm')); }
function panelSoporteVer_(d) {
  const c = sopDe_(d.id);
  if (Number(c.sinLeerAdm) > 0) { mSet_('Soporte', c, { sinLeerAdm: 0 }); c.sinLeerAdm = 0; }
  const l = mRows_('Licencias').find(x => x.id === c.negocioId);
  return { chat: sopPublico_(c, 'adm'), mensajes: sopMsgs_(c.id), negocio: l ? panelFicha_(l, mRows_('Seguimiento')) : null };
}
function panelSoporteResponder_(d) {
  const c = sopDe_(d.id), texto = String(d.texto || '').trim().slice(0, 800);
  if (!texto) throw new Error('Escribe tu respuesta');
  const f = ahora_().replace('T', ' ');
  mAppend_('SoporteMsg', { id: mId_('M'), chatId: c.id, de: 'adm', texto: texto, foto: '', quien: 'Soporte', fecha: f });
  mSet_('Soporte', c, { ultimo: f, ultimoTexto: texto.slice(0, 120), deCliente: false, sinLeerAdm: 0, sinLeerCli: (Number(c.sinLeerCli) || 0) + 1 });
  return panelSoporteVer_({ id: c.id });
}
function panelSoporteEstado_(d) { const c = sopDe_(d.id); mSet_('Soporte', c, { estado: d.estado === 'resuelto' ? 'resuelto' : 'abierto' }); return panelSoporteVer_({ id: c.id }); }

/* ---- Correo diario al administrador: a quién contactar y soporte pendiente ---- */
function resumenPanelDiario() {
  const r = panelResumen_(), P = r.plantillas;
  const correo = PropertiesService.getScriptProperties().getProperty('PANEL_CORREO') || Session.getEffectiveUser().getEmail();
  const sop = mRows_('Soporte').filter(c => Number(c.sinLeerAdm) > 0);
  if (!r.contactar.length && !sop.length) return;
  const wa = (x, t) => 'https://wa.me/' + x.whatsapp + '?text=' + encodeURIComponent(String(P[t] || '').replace(/\{dueno\}/g, String(x.dueno || '').split(' ')[0]).replace(/\{negocio\}/g, x.negocio));
  const T = { dia3: 'Día 3 de prueba · ¿qué tal?', vence: 'Vence mañana', inactivo: 'Sin entrar hace días', vencida: 'Prueba vencida' };
  let h = '<h2 style="font-family:sans-serif">Gestión de Negocio VM · ' + r.hoy + '</h2>';
  h += '<p style="font-family:sans-serif">Activos ' + r.kpis.activos + ' · En prueba ' + r.kpis.prueba + ' · Vencidos ' + r.kpis.vencidos + ' · Ingresos del mes L ' + r.kpis.ingresosMes + '</p>';
  if (r.contactar.length) h += '<h3 style="font-family:sans-serif">Para contactar hoy</h3><ul style="font-family:sans-serif">' + r.contactar.map(x => '<li><b>' + x.negocio + '</b> (' + x.dueno + ') · ' + T[x.contactar] + ' · <a href="' + wa(x, x.contactar) + '">WhatsApp</a></li>').join('') + '</ul>';
  if (sop.length) h += '<h3 style="font-family:sans-serif">Soporte sin responder</h3><ul style="font-family:sans-serif">' + sop.map(c => '<li><b>' + c.negocio + '</b> · ' + (MOTIVOS[c.motivo] || c.motivo) + (c.modulo ? ' · ' + c.modulo : '') + ': ' + c.ultimoTexto + '</li>').join('') + '</ul>';
  h += '<p style="font-family:sans-serif"><a href="' + URL_APP + '?panel">Abrir el Panel Molina</a></p>';
  MailApp.sendEmail({ to: correo, subject: 'Negocio VM · ' + r.contactar.length + ' por contactar · ' + sop.length + ' en soporte', htmlBody: h });
}
// Ejecútala una vez: el resumen llega cada mañana a las 7
function instalarResumenDiario() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'resumenPanelDiario').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('resumenPanelDiario').timeBased().everyDays(1).atHour(7).create();
  Logger.log('Listo: el resumen del panel llegará cada día a las 7 a. m.');
}

/* ===================== CATÁLOGOS (productos, clientes, proveedores) ===================== */

function guardar_(u, d) {
  const ent = d.entidad;
  if (ent === 'Config') {
    req_(u, ['admin']);
    const reg = {};
    Object.keys(d.registro || {}).forEach(k => { if (CONFIG_EDITABLE.indexOf(k) >= 0) reg[k] = String(d.registro[k]); });
    Object.keys(reg).forEach(k => { if (k !== 'logo' && k !== 'duenoFoto' && k !== 'tiendaPortada' && reg[k].length > 3000) throw new Error('Uno de los textos es demasiado largo'); });
    if (reg.duenoFoto && (reg.duenoFoto.length > 48000 || reg.duenoFoto.indexOf('data:image/') !== 0)) throw new Error('La foto del propietario no es válida. Súbela de nuevo.');
    if (reg.tiendaPortada !== undefined) {
      const prev = config_().tiendaPortada;
      if (reg.tiendaPortada && !(reg.tiendaPortada.indexOf('data:image/') === 0 ? reg.tiendaPortada.length <= 160000 : fotoPropia_(reg.tiendaPortada))) throw new Error('La foto de portada no es válida. Súbela de nuevo.');
      if (prev && prev !== reg.tiendaPortada) borrarFoto_(prev);
    }
    ['tiendaAbre', 'tiendaCierra'].forEach(k => { if (reg[k] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(reg[k])) throw new Error('Escribe la hora con el formato 08:00'); });
    if (reg.nombre !== undefined && !txt_(reg.nombre)) throw new Error('Escribe el nombre del negocio');
    if (reg.isv !== undefined && !(Number(reg.isv) >= 0 && Number(reg.isv) < 1)) throw new Error('ISV no válido');
    if (reg.tienda === 'si' && !plus_()) throw new Error('La tienda en línea es parte del plan Plus');
    if (reg.tiendaFuente !== undefined && ['elegante', 'moderna', 'clasica', 'amigable', 'urbana', 'manuscrita'].indexOf(reg.tiendaFuente) < 0) reg.tiendaFuente = 'elegante';
    if (reg.tiendaModo !== undefined && ['auto', 'claro', 'oscuro'].indexOf(reg.tiendaModo) < 0) reg.tiendaModo = 'auto';
    const c = guardarConfig_(reg);
    if (MULTI_NEGOCIO && NEG && reg.nombre) { try { mSet_('Licencias', NEG.lic, { negocio: txt_(reg.nombre, 60) }); CacheService.getScriptCache().remove('L_' + NEG.id); } catch (e) {} }
    return sinInternos_(c);
  }
  if (!own_(ESCRITURA, ent)) throw new Error('Entidad no válida');
  req_(u, ESCRITURA[ent]);
  const r = Object.assign({}, d.registro || {});
  const prev = r.id ? rows_(ent).find(x => x.id === r.id) : null;
  if (r.id && !prev) throw new Error('El registro ya no existe');
  if (r.nombre !== undefined) r.nombre = txt_(r.nombre, 80);
  if (!prev && !r.nombre) throw new Error('El nombre es obligatorio');
  if (!prev) { r.creado = ahora_(); if (r.activo === undefined) r.activo = true; }
  if (ent === 'Cuentas') {
    if (r.plataforma !== undefined) r.plataforma = txt_(r.plataforma, 40);
    if (!prev && !r.plataforma) throw new Error('Elige la plataforma');
    ['correo', 'clave', 'nota'].forEach(k => { if (r[k] !== undefined) r[k] = txt_(r[k], k === 'nota' ? 200 : 80); });
    if (r.perfiles !== undefined) { r.perfiles = Math.max(1, Math.min(20, parseInt(r.perfiles, 10) || 1)); if (prev && r.perfiles < Number(prev.perfiles)) { const oc = ocupados_()[prev.id] || {}; if (Object.keys(oc).some(p => Number(p) > r.perfiles)) throw new Error('Hay perfiles vendidos con un número mayor; no se puede reducir'); } }
    if (r.costo !== undefined) r.costo = r2_(r.costo);
    if (r.vence !== undefined && r.vence && !/^\d{4}-\d{2}-\d{2}$/.test(String(r.vence))) r.vence = '';
    return upsert_('Cuentas', r);
  }
  if (ent === 'Productos') {
    if (r.codigo !== undefined) r.codigo = txt_(r.codigo, 40);
    if (r.codigo && rows_('Productos').some(p => p.codigo && String(p.codigo).toLowerCase() === r.codigo.toLowerCase() && p.id !== r.id)) throw new Error('Ya existe un producto con ese código');
    if (r.categoria !== undefined) r.categoria = txt_(r.categoria, 40) || 'General';
    if (!prev && !r.categoria) r.categoria = 'General';
    if (r.tipo !== undefined && ['producto','servicio'].indexOf(r.tipo) < 0) r.tipo = 'producto';
    if (!prev && !r.tipo) r.tipo = 'producto';
    ['precio','costo','stockMin','margen'].forEach(k => { if (r[k] !== undefined) { r[k] = k === 'costo' ? r4_(r[k]) : r2_(r[k]); if (r[k] < 0) throw new Error('Los montos no pueden ser negativos'); } });
    if (prev && r.tipo && r.tipo !== prev.tipo && Math.abs(prev.stock) > 0.0005) throw new Error('«' + prev.nombre + '» todavía tiene existencias (' + prev.stock + '). Déjalas en cero con un ajuste antes de cambiar si controla existencias.');
    if (r.tasaIsv !== undefined && ['', '0', '15', '18'].indexOf(String(r.tasaIsv)) < 0) r.tasaIsv = '';
    delete r.isv;
    if (r.foto && String(r.foto).length > 60000) throw new Error('La foto es muy pesada');
    if (r.foto && (!prev || r.foto !== prev.foto)) { if (!plus_()) throw new Error('Las fotos de productos son parte del plan Plus'); if (!fotoPropia_(r.foto)) throw new Error('La foto no es válida. Súbela de nuevo.'); r.fotoFecha = ahora_(); }
    if (r.foto === '') r.fotoFecha = '';
    if (r.opciones !== undefined) r.opciones = opciones_(r.opciones);
    if (r.plataforma !== undefined) r.plataforma = txt_(r.plataforma, 40);
    if (r.entrega !== undefined) r.entrega = r.entrega === 'cuenta' ? 'cuenta' : (r.entrega ? 'perfil' : '');
    if (r.incluye !== undefined) r.incluye = incluye_(r.incluye).map(x => x.plataforma + ':' + x.n).join('|');
    if (r.caduca !== undefined && r.caduca && !/^\d{4}-\d{2}-\d{2}$/.test(String(r.caduca))) r.caduca = '';
    if (r.garantia !== undefined) r.garantia = Math.max(0, Math.min(3650, parseInt(r.garantia, 10) || 0));
    // Las existencias solo cambian con compras, ventas y ajustes (queda registrado)
    const stockIni = r.stock;
    delete r.stock;
    if (!prev) r.stock = 0;
    if (r.tienda === undefined && !prev) r.tienda = true;
    // Unificar la categoría con las existentes (evita "Bebidas" y "bebidas")
    if (r.categoria) { const ex = rows_('Productos').find(p => p.categoria.toLowerCase() === r.categoria.toLowerCase()); if (ex) r.categoria = ex.categoria; }
    if (prev && prev.foto && r.foto !== undefined && r.foto !== prev.foto) borrarFoto_(prev.foto);
    const g = upsert_('Productos', r);
    if (!prev && g.tipo === 'producto' && Number(stockIni) > 0) {
      moverStock_({ [g.id]: r3_(stockIni) }, 'inicial', '', u, 'Existencia inicial');
      return rows_('Productos').find(p => p.id === g.id);
    }
    return g;
  }
  if (ent === 'Clientes' && r.equipo !== undefined) r.equipo = txt_(r.equipo, 120);
  if (ent === 'Clientes') {
    if (u.rol !== 'admin') delete r.limite; // el límite de crédito lo pone solo el administrador
    if (r.limite !== undefined) r.limite = Math.max(0, r2_(r.limite));
    if (r.telefono !== undefined) r.telefono = txt_(r.telefono, 30);
    if (r.telefono && rows_('Clientes').some(c => c.id !== r.id && tel8_(c.telefono) && tel8_(c.telefono) === tel8_(r.telefono))) throw new Error('Ya hay un cliente con ese teléfono');
    const g = upsert_('Clientes', r);
    g.saldo = saldosClientes_()[g.id] || 0;
    return g;
  }
  if (ent === 'Proveedores') {
    const g = upsert_('Proveedores', r);
    g.saldo = saldosProveedores_()[g.id] || 0;
    return g;
  }
}

function eliminar_(u, d) {
  req_(u, ['admin']);
  const ent = d.entidad;
  if (['Productos','Clientes','Proveedores','Cuentas'].indexOf(ent) < 0) throw new Error('No se puede eliminar este tipo de registro');
  if (!d.id || !rows_(ent).some(x => x.id === d.id)) throw new Error('El registro ya no existe');
  // Si ya tiene movimientos, se desactiva en lugar de borrarse (para no perder la historia)
  let usado = false;
  if (ent === 'Productos') usado = rows_('VentaDetalle').some(x => x.productoId === d.id) || rows_('CompraDetalle').some(x => x.productoId === d.id);
  if (ent === 'Clientes') usado = rows_('Ventas').some(x => x.clienteId === d.id) || rows_('Abonos').some(x => x.clienteId === d.id);
  if (ent === 'Proveedores') usado = rows_('Compras').some(x => x.proveedorId === d.id) || rows_('Pagos').some(x => x.proveedorId === d.id);
  if (ent === 'Cuentas') usado = rows_('Suscripciones').some(x => x.cuentaId === d.id);
  if (usado) { upsert_(ent, { id: d.id, activo: false }); return { desactivado: true }; }
  if (ent === 'Productos') { const p = rows_('Productos').find(x => x.id === d.id); if (p && p.foto) borrarFoto_(p.foto); }
  deleteRow_(ent, d.id);
  return { eliminado: true };
}

function cargarEjemplos_(u, d) {
  req_(u, ['admin']);
  const cfg = config_();
  const g = own_(GIROS, d.giro) ? GIROS[d.giro] : own_(GIROS, cfg.giro) ? GIROS[cfg.giro] : GIROS.otro;
  const existentes = rows_('Productos').map(p => p.nombre.toLowerCase());
  let n = 0;
  g.ej.forEach((x, i) => {
    if (existentes.indexOf(x[0].toLowerCase()) >= 0) return;
    const p = upsert_('Productos', { codigo: 'EJ' + String(i + 1).padStart(3, '0'), nombre: x[0], categoria: x[1], icono: x[2], precio: x[3], costo: x[4],
      tipo: x[5] > 0 ? 'producto' : 'servicio', unidad: 'unidad', stock: 0, stockMin: x[5] > 0 ? Math.max(1, Math.round(x[5] / 5)) : 0,
      tasaIsv: '', foto: '', descripcion: '', opciones: x[6] || '', tienda: true, activo: true, creado: ahora_(), plataforma: x[7] && x[7].plataforma || '', entrega: x[7] && x[7].entrega || '', incluye: x[7] && x[7].incluye || '' });
    if (p.tipo === 'producto' && x[5] > 0) moverStock_({ [p.id]: x[5] }, 'inicial', '', u, 'Existencia inicial (ejemplo)');
    n++;
  });
  return { agregados: n, productos: rows_('Productos') };
}

/* ===================== FOTOS DE PRODUCTOS ===================== */

function carpetaFotos_() {
  const nombre = MULTI_NEGOCIO && NEG ? 'Fotos – ' + NEG.lic.negocio + ' (' + NEG.id + ')' : 'Gestión de Negocio VM – Fotos';
  const it = DriveApp.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : DriveApp.createFolder(nombre);
}

function subirFoto_(u, d) {
  req_(u, ['admin','bodega']);
  if (!plus_()) throw new Error('Las fotos de productos son parte del plan Plus');
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(d.data || ''));
  if (!m) throw new Error('La foto no es válida');
  if (m[2].length > 900000) throw new Error('La foto es muy pesada');
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], 'producto-' + Date.now() + '.jpg');
  const f = carpetaFotos_().createFile(blob);
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  return { foto: f.getId() };
}

function enCarpetaFotos_(f) {
  const fin = MULTI_NEGOCIO && NEG ? '(' + NEG.id + ')' : 'Gestión de Negocio VM – Fotos';
  const it = f.getParents();
  while (it.hasNext()) { const n = it.next().getName(); if (MULTI_NEGOCIO && NEG ? n.slice(-fin.length) === fin : n === fin) return true; }
  return false;
}
function fotoPropia_(id) {
  if (String(id).indexOf('data:') === 0) return String(id).length <= 60000;
  try { return enCarpetaFotos_(DriveApp.getFileById(id)); } catch (e) { return false; }
}
function borrarFoto_(id) {
  if (!id || String(id).indexOf('data:') === 0) return;
  try { const f = DriveApp.getFileById(id); if (enCarpetaFotos_(f)) f.setTrashed(true); } catch (e) {}
}

// Ejecútala una vez desde el editor si Apps Script pide permisos de Drive para las fotos
function autorizar() {
  DriveApp.getRootFolder();
  Logger.log('Permisos listos.');
}

/* ===================== PLAN PLUS ===================== */

// Plus pagado (tienda en línea y fotos): columna «plus» en Licencias o propiedad PLUS
function plusReal_() {
  if (MULTI_NEGOCIO) {
    if (!NEG) return false;
    const v = String(NEG.lic.plus || '').trim().toLowerCase();
    return ['sí','si','activo','activa','true','1','x'].indexOf(v) >= 0;
  }
  return PropertiesService.getScriptProperties().getProperty('PLUS') === 'activo';
}
// Durante la prueba gratis, Plus va incluido. Al activar la licencia, Plus se activa aparte.
function plus_() { return plusReal_() || licencia_().estado === 'prueba'; }
function plusIncluido_() { return !plusReal_() && licencia_().estado === 'prueba'; }

function activarPlus_(u, d) {
  req_(u, ['admin']);
  if (plusReal_()) return { plus: true };
  const c = CacheService.getScriptCache(), k = 'FP_' + (NEG ? NEG.id : 'uno'), fallos = Number(c.get(k) || 0);
  if (fallos >= 5) throw new Error('Demasiados intentos. Espera 10 minutos.');
  const clave = PropertiesService.getScriptProperties().getProperty('PLUS_PASSWORD');
  if (!clave || String(d.clave || '') !== clave) { c.put(k, String(fallos + 1), 600); throw new Error('Contraseña Plus incorrecta'); }
  c.remove(k);
  if (MULTI_NEGOCIO) {
    mSet_('Licencias', NEG.lic, { plus: 'Sí' });
    CacheService.getScriptCache().remove('L_' + NEG.id);
    NEG.lic.plus = 'Sí';
  } else {
    PropertiesService.getScriptProperties().setProperty('PLUS', 'activo');
  }
  return { plus: true };
}

// Modo un solo negocio: actívalo desde el editor
function activarPlus() { PropertiesService.getScriptProperties().setProperty('PLUS', 'activo'); Logger.log('Plan Plus activado'); }

/* ===================== PRECIOS ===================== */

// Cambia precios (y margen objetivo) de varios productos a la vez
function precios_(u, d) {
  req_(u, ['admin','bodega']);
  const pm = porId_(rows_('Productos'));
  const l = Array.isArray(d.cambios) ? d.cambios : [];
  if (!l.length) throw new Error('No hay precios para cambiar');
  const upds = l.map(x => {
    const p = x && typeof x === 'object' ? pm[x.id] : null;
    if (!p) throw new Error('Un producto ya no existe');
    if (!esNum_(x.precio) || !(r2_(x.precio) > 0)) throw new Error('Precio no válido en «' + p.nombre + '»');
    const upd = { id: p.id, precio: r2_(x.precio) };
    if (esNum_(x.margen)) { if (!(Number(x.margen) >= 0 && Number(x.margen) <= 10000)) throw new Error('% de ganancia no válido en «' + p.nombre + '»'); upd.margen = r2_(x.margen); }
    if (esNum_(x.costo) && Number(x.costo) >= 0) upd.costo = r4_(x.costo);
    return upd;
  });
  upds.forEach(upd => upsert_('Productos', upd));
  return { productos: rows_('Productos'), cambiados: l.length };
}

/* ===================== LIMPIEZA DE FOTOS ===================== */

// Borra la foto de los productos que llevan más de DIAS_FOTO días sin movimiento (una vez al día).
// Nunca toca la foto de un producto que todavía tiene existencias.
function limpiarFotos_(forzar) {
  const cfg = config_(), h = hoy_();
  if (!forzar && cfg.sysLimpieza === h) return 0;
  guardarConfig_({ sysLimpieza: h });
  const limite = diasAtras_(DIAS_FOTO) + 'T00:00';
  const conFoto = rows_('Productos').filter(p => p.foto && !(p.tipo === 'producto' && Number(p.stock) > 0));
  if (!conFoto.length) return 0;
  const ultimo = {};
  const marca = (id, f) => { if (id && f && (!ultimo[id] || f > ultimo[id])) ultimo[id] = f; };
  rows_('Inventario').forEach(m => marca(m.productoId, m.fecha));
  const vf = {};
  rows_('Ventas').forEach(v => { if (!v.anulada) vf[v.id] = v.fecha; });
  rows_('VentaDetalle').forEach(x => marca(x.productoId, vf[x.ventaId]));
  let n = 0;
  conFoto.forEach(p => {
    const ref = [ultimo[p.id] || '', p.creado || '', p.fotoFecha || ''].sort().pop();
    if (ref && ref < limite) { borrarFoto_(p.foto); upsert_('Productos', { id: p.id, foto: '', fotoFecha: '' }); n++; }
  });
  return n;
}

// Para ejecutar desde el editor o con un activador diario: limpia las fotos de todos los negocios
function limpiarFotosTodos() {
  let total = 0;
  if (!MULTI_NEGOCIO) { total = lock_(() => limpiarFotos_(true)); Logger.log('Fotos borradas: ' + total); return total; }
  mRows_('Licencias').forEach(l => {
    if (!l.hojaId) return;
    try { Object.keys(MEMO).forEach(k => { if (k.indexOf('_m_') !== 0) delete MEMO[k]; }); setNegocio_(l); total += lock_(() => limpiarFotos_(true)); } catch (e) { Logger.log(l.negocio + ': ' + e.message); }
  });
  Logger.log('Fotos borradas: ' + total);
  return total;
}

// Ejecútala una vez para que la limpieza corra sola cada madrugada
function instalarLimpiezaDiaria() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'limpiarFotosTodos').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('limpiarFotosTodos').timeBased().everyDays(1).atHour(3).create();
  Logger.log('Listo: la limpieza de fotos correrá todos los días a las 3 a. m.');
}

/* ===================== INVENTARIO ===================== */

// Cambia existencias y deja registro en la hoja Inventario. cambios = { productoId: +/-cantidad }
function moverStock_(cambios, tipo, refId, u, nota, fecha) {
  const ids = Object.keys(cambios);
  if (!ids.length) return;
  const pm = porId_(rows_('Productos')), mov = [], f = fecha || ahora_();
  ids.forEach(id => {
    const p = pm[id];
    if (!p || p.tipo !== 'producto') return;
    const nuevo = r3_(p.stock + cambios[id]);
    upsert_('Productos', { id: id, stock: nuevo });
    mov.push({ id: newId_('Inventario'), fecha: f, productoId: id, tipo: tipo, cantidad: r3_(cambios[id]), stock: nuevo, refId: refId || '', usuarioId: u ? u.id : '', nota: nota || '' });
  });
  appendRows_('Inventario', mov);
}

function ajusteStock_(u, d) {
  req_(u, ['admin','bodega']);
  const p = rows_('Productos').find(x => x.id === d.id);
  if (!p) throw new Error('El producto no existe');
  if (p.tipo !== 'producto') throw new Error('Este artículo no controla existencias');
  const modo = d.modo; // 'entrada' | 'salida' | 'conteo'
  if (!esNum_(d.cantidad)) throw new Error('Escribe la cantidad');
  const n = r3_(d.cantidad);
  if (!(n >= 0)) throw new Error('Cantidad no válida');
  let delta;
  if (modo === 'conteo') delta = r3_(n - p.stock);
  else if (modo === 'entrada') delta = n;
  else if (modo === 'salida') delta = -n;
  else throw new Error('Tipo de ajuste no válido');
  if (!delta) return rows_('Productos').find(x => x.id === p.id);
  if (modo !== 'conteo' && !(n > 0)) throw new Error('La cantidad debe ser mayor a cero');
  const motivo = txt_(d.motivo, 120) || (modo === 'conteo' ? 'Conteo físico' : modo === 'entrada' ? 'Entrada' : 'Salida');
  moverStock_({ [p.id]: delta }, 'ajuste', '', u, motivo);
  return rows_('Productos').find(x => x.id === p.id);
}

function kardex_(u, d) {
  req_(u, ['admin','bodega']);
  const us = porId_(rows_('Usuarios'));
  return desc_(rows_('Inventario').filter(m => m.productoId === d.id), 'fecha').slice(0, 200)
    .map(m => { m.usuario = us[m.usuarioId] ? us[m.usuarioId].nombre : ''; return m; });
}

/* ===================== VENTAS ===================== */

function tasaLinea_(p, cfg) {
  if (p && p.tasaIsv !== '' && p.tasaIsv !== undefined && p.tasaIsv !== null) return Number(p.tasaIsv) / 100;
  return Number(cfg.isv) || 0;
}

function venta_(u, d) {
  req_(u, ['admin','cajero']);
  const cfg = config_();
  const incl = cfg.preciosConISV !== 'no';
  // Si la misma venta llega dos veces (se cortó la conexión y se volvió a tocar Cobrar), se devuelve la primera
  const clave = txt_(d.clave, 60), kc = clave ? 'VK_' + (NEG ? NEG.id : '') + '_' + clave : '';
  if (kc) {
    let vid = null; try { vid = CacheService.getScriptCache().get(kc); } catch (e) {}
    const ya = vid ? rows_('Ventas').find(x => x.id === vid) : null;
    if (ya) return { venta: ya, detalle: rows_('VentaDetalle').filter(x => x.ventaId === ya.id), productos: rows_('Productos'), repetida: true,
      saldoCliente: ya.clienteId ? (saldosClientes_()[ya.clienteId] || 0) : 0, sar: cfg.sarActivo === 'si' ? estadoSAR_() : null };
  }
  // Pedido en línea: debe estar pendiente; sus precios son los que vio el cliente
  const preciosPedido = Object.create(null);
  // Venta ligada a una cita/encargo: vale el precio acordado en la cita (lo puso quien la agendó)
  const precioLigado = !!(d.agendaId && rows_('Agenda').some(x => x.id === d.agendaId && x.estado === 'pendiente'));
  if (d.pedidoId) {
    const pe = rows_('Pedidos').find(x => x.id === d.pedidoId);
    if (!pe) throw new Error('El pedido en línea ya no existe');
    if (pe.ventaId || pe.estado === 'entregado') throw new Error('Este pedido ya se cobró');
    if (pe.estado === 'cancelado') throw new Error('Este pedido está cancelado');
    parseJ_(pe.items, []).forEach(x => { if (x && x.productoId) preciosPedido[x.productoId] = r2_(x.precio); });
  }
  const pm = porId_(rows_('Productos'));
  if (!Array.isArray(d.items)) throw new Error('El ticket está vacío');
  if (Array.isArray(d.sus)) { // las fechas se validan antes de escribir nada
    const h0 = hoy_();
    d.sus.forEach(sd => { if (sd.vence && sd.vence < h0) throw new Error('Una fecha de vencimiento ya pasó'); (Array.isArray(sd.asig) ? sd.asig : []).forEach(a => { if (a.vence && a.vence < h0) throw new Error('La fecha de vencimiento de ' + (a.plataforma || 'una plataforma') + ' ya pasó'); }); });
  }
  const items = d.items.map(i => {
    if (!i || typeof i !== 'object') throw new Error('Un artículo del ticket no es válido');
    const p = i.productoId ? pm[i.productoId] : null;
    if (i.productoId && !p) throw new Error('Un producto del ticket ya no existe');
    if (!esNum_(i.cantidad)) throw new Error('Cantidad no válida');
    const cant = r3_(i.cantidad);
    if (!(cant > 0)) throw new Error('Cantidad no válida');
    if (!(i.precio === undefined || i.precio === '' || i.precio === null) && !esNum_(i.precio)) throw new Error('Precio no válido');
    let precio = (i.precio === undefined || i.precio === '' || i.precio === null) ? (p ? p.precio : 0) : r2_(i.precio);
    if (p && u.rol !== 'admin' && !precioLigado) { // solo el administrador cambia precios (en un pedido en línea vale el precio del pedido)
      const delPedido = preciosPedido[p.id];
      if (Math.abs(precio - p.precio) > 0.004 && !(delPedido !== undefined && Math.abs(precio - delPedido) < 0.005)) precio = delPedido !== undefined ? delPedido : p.precio;
    }
    if (precio < 0) throw new Error('Precio no válido');
    const desc = p ? p.nombre + (i.variante ? ' · ' + txt_(i.variante, 60) : '') : txt_(i.descripcion, 80);
    if (!desc) throw new Error('Escribe la descripción del artículo');
    if (!p && !(i.costo === undefined || i.costo === '' || i.costo === null) && !(Number(i.costo) >= 0)) throw new Error('El costo de «' + desc + '» no es válido');
    return { p: p, productoId: p ? p.id : '', descripcion: desc, cantidad: cant, precio: precio, costo: p ? p.costo : r4_(Math.max(0, Number(i.costo) || 0)), serie: txt_(i.serie, 60), garantia: p && p.garantia ? Number(p.garantia) : (parseInt(i.garantia, 10) || 0) };
  });
  if (!items.length) throw new Error('El ticket está vacío');
  // Existencias
  const pedido = {};
  items.forEach(i => { if (i.p && i.p.tipo === 'producto') pedido[i.productoId] = r3_((pedido[i.productoId] || 0) + i.cantidad); });
  if (cfg.venderSinStock !== 'si') {
    Object.keys(pedido).forEach(id => { const p = pm[id]; if (p.stock < pedido[id]) throw new Error('No hay suficiente «' + p.nombre + '» (quedan ' + p.stock + ')'); });
  }
  const metodo = METODOS.indexOf(d.metodo) >= 0 ? d.metodo : 'Efectivo';
  // Facturación SAR (solo si el negocio la activó en Ajustes)
  const sar = cfg.sarActivo === 'si', fd = d.fiscal || {};
  if (sar) {
    const est = estadoSAR_(cfg);
    if (est.estado === 'incompleto') throw new Error('Faltan los datos de facturación SAR. Complétalos en Ajustes › Facturación SAR.');
    if (est.estado === 'vencido') throw new Error('La fecha límite de emisión del CAI ya pasó (' + cfg.sarLimite + '). Pide un CAI nuevo al SAR y actualízalo en Ajustes › Facturación SAR.');
    if (est.estado === 'agotado') throw new Error('Se terminaron los números de factura autorizados. Pide un rango nuevo al SAR y actualízalo en Ajustes › Facturación SAR.');
  }
  const exo = sar && !!fd.exonerado;
  if (exo && !txt_(fd.oce) && !txt_(fd.cre) && !txt_(fd.sag)) throw new Error('Para una venta exonerada escribe el número de la orden de compra exenta, de la constancia de exonerado o del registro SAG');
  // Las líneas se redondean primero: así el detalle siempre suma el subtotal
  const subtotal = r2_(items.reduce((a, i) => a + r2_(i.cantidad * i.precio), 0));
  const descuento = r2_(Math.min(Math.max(0, Number(d.descuento) || 0), subtotal));
  const factor = subtotal ? (subtotal - descuento) / subtotal : 1;
  const F = { exento: 0, exonerado: 0, g15: 0, g18: 0, i15: 0, i18: 0 }, B = { 15: 0, 18: 0 };
  items.forEach(i => {
    const base = r2_(i.cantidad * i.precio) * factor, t = tasaLinea_(i.p, cfg);
    const neto = incl && t ? base / (1 + t) : base, imp = incl ? base - neto : base * t;
    if (!t) F.exento += neto;
    else if (exo) F.exonerado += neto;
    else if (Math.abs(t - 0.18) < 0.001) { F.g18 += neto; F.i18 += imp; B[18] += base; }
    else { F.g15 += neto; F.i15 += imp; B[15] += base; }
  });
  // Cada parte se redondea y el total es la suma de las partes (en la factura todo cuadra al centavo)
  ['exento', 'exonerado', 'g15', 'g18'].forEach(k => { F[k] = r2_(F[k]); });
  if (incl) { F.i15 = r2_(r2_(B[15]) - F.g15); F.i18 = r2_(r2_(B[18]) - F.g18); } else { F.i15 = r2_(F.i15); F.i18 = r2_(F.i18); }
  const isv = r2_(F.i15 + F.i18);
  const total = r2_(F.exento + F.exonerado + F.g15 + F.g18 + F.i15 + F.i18);
  const costo = r2_(items.reduce((a, i) => a + i.cantidad * (i.costo || 0), 0));
  let recibido = 0, cambio = 0, saldo = 0;
  const clienteId = d.clienteId && rows_('Clientes').some(c => c.id === d.clienteId) ? d.clienteId : '';
  // Anticipo ya pagado (orden de trabajo, cita o encargo): se descuenta de lo que falta por pagar, no del total de la venta
  const anticipo = r2_(Math.min(anticipoDe_(d.ordenId || d.agendaId), total));
  const porPagar = r2_(total - anticipo);
  if (metodo === 'Crédito') {
    if (!clienteId) throw new Error('Para vender al crédito selecciona un cliente registrado');
    recibido = r2_(Math.min(Math.max(0, Number(d.recibido) || 0), porPagar));
    saldo = r2_(porPagar - recibido);
    const cli = rows_('Clientes').find(c => c.id === clienteId);
    const debe = saldosClientes_()[clienteId] || 0;
    if (cli.limite > 0 && debe + saldo > cli.limite + 0.004) throw new Error('Supera el límite de crédito de ' + cli.nombre + ' (' + money_(cli.limite, cfg) + '). Ya debe ' + money_(debe, cfg) + '.');
  } else if (metodo === 'Efectivo') {
    recibido = d.recibido === undefined || d.recibido === '' || d.recibido === null ? porPagar : r2_(d.recibido);
    if (recibido + 0.004 < porPagar) throw new Error('El efectivo recibido es menor que lo que falta por pagar');
    cambio = r2_(recibido - porPagar);
  } else {
    recibido = porPagar;
  }
  // Número de factura: se toma al final, cuando ya pasaron todas las validaciones (no deja huecos)
  let factura = '', fiscal = '';
  if (sar) {
    const cli = clienteId ? rows_('Clientes').find(c => c.id === clienteId) : null;
    const rtnC = String(fd.rtn !== undefined && fd.rtn !== null ? fd.rtn : (cli && cli.rtn) || '').replace(/\D/g, '');
    if (rtnC && rtnC.length !== 14) throw new Error('El RTN del cliente debe tener 14 números');
    const n = Number(cfg.seqF) || Number(cfg.sarDesde);
    factura = numFactura_(cfg, n);
    guardarConfig_({ seqF: String(n + 1) });
    fiscal = JSON.stringify(Object.assign({ cai: cfg.sarCai, desde: numFactura_(cfg, Number(cfg.sarDesde)), hasta: numFactura_(cfg, Number(cfg.sarHasta)), limite: cfg.sarLimite,
      razon: cfg.sarRazon || cfg.nombre, rtnE: cfg.sarRtn, dir: cfg.sarDireccion, nombre: txt_(fd.nombre || (cli && cli.nombre) || '', 100) || 'Consumidor Final', rtn: rtnC,
      oce: exo ? txt_(fd.oce, 40) : '', cre: exo ? txt_(fd.cre, 40) : '', sag: exo ? txt_(fd.sag, 40) : '', letras: letras_(total) }, F));
  }
  const fecha = ahora_();
  const venta = {
    id: newId_('Ventas'), numero: siguiente_('V'), fecha: fecha, clienteId: clienteId, usuarioId: u.id,
    subtotal: subtotal, descuento: descuento, isv: isv, total: total, costo: costo, metodo: metodo,
    recibido: recibido, cambio: cambio, saldo: saldo, pedidoId: d.pedidoId || '', anulada: false, nota: txt_(d.nota, 200),
    factura: factura, fiscal: fiscal, servicio: ['mesa', 'llevar', 'domicilio'].indexOf(d.servicio) >= 0 && (d.servicio !== 'mesa' || d.mesa || d.cocina) ? d.servicio : '', mesa: txt_(d.mesa, 20), cocina: txt_(d.cocina, 200), anticipo: anticipo
  };
  const detalle = items.map((i, k) => ({
    id: newId_('VentaDetalle') + k, ventaId: venta.id, productoId: i.productoId, descripcion: i.descripcion,
    cantidad: i.cantidad, precio: r2_(i.precio), costo: r4_(i.costo || 0), total: r2_(i.cantidad * i.precio), serie: i.serie || '', garantia: i.garantia || ''
  }));
  appendRows_('Ventas', [venta]);
  appendRows_('VentaDetalle', detalle);
  const cambios = {};
  Object.keys(pedido).forEach(id => { cambios[id] = -pedido[id]; });
  moverStock_(cambios, 'venta', venta.id, u, venta.numero, fecha);
  if (d.pedidoId) upsert_('Pedidos', { id: d.pedidoId, estado: 'entregado', ventaId: venta.id, actualizado: ahora_() });
  const nuevasSus = susRegistrar_(u, d, venta, items, pm);
  cerrarLigados_(d, venta);
  if (kc) { try { CacheService.getScriptCache().put(kc, venta.id, 21600); } catch (e) {} }
  return { venta: venta, detalle: detalle, productos: rows_('Productos'), saldoCliente: clienteId ? (saldosClientes_()[clienteId] || 0) : 0, sar: sar ? estadoSAR_() : null, accesos: nuevasSus.length ? susAccesos_(nuevasSus) : [] };
}

function rango_(d) {
  const desde = d.desde ? (d.desde.length === 10 ? d.desde + 'T00:00' : d.desde) : '';
  const hasta = d.hasta ? (d.hasta.length === 10 ? d.hasta + 'T23:59' : d.hasta) : '';
  return { desde: desde, hasta: hasta };
}

function ventas_(u, d) {
  req_(u, ['admin','cajero']);
  const r = rango_(d);
  let v = rows_('Ventas').filter(x => (!r.desde || x.fecha >= r.desde) && (!r.hasta || x.fecha <= r.hasta));
  if (d.clienteId) v = v.filter(x => x.clienteId === d.clienteId);
  if (u.rol === 'cajero' && !d.clienteId) v = v.filter(x => x.usuarioId === u.id || x.fecha.slice(0, 10) === hoy_());
  const ids = {};
  v.forEach(x => { x.detalle = []; ids[x.id] = x; });
  rows_('VentaDetalle').forEach(det => { if (ids[det.ventaId]) ids[det.ventaId].detalle.push(det); });
  const act = v.filter(x => !x.anulada);
  const lista = desc_(v, 'fecha');
  return { lista: lista.slice(0, 500), n: v.length, recortada: lista.length > 500,
    resumen: { total: r2_(act.reduce((a, x) => a + x.total, 0)), n: act.length, anuladas: v.length - act.length,
      credito: r2_(act.filter(x => x.metodo === 'Crédito').reduce((a, x) => a + x.saldo, 0)) } };
}

function anularVenta_(u, d) {
  req_(u, ['admin']);
  const v = rows_('Ventas').find(x => x.id === d.id);
  if (!v) throw new Error('La venta no existe');
  if (v.anulada) throw new Error('La venta ya está anulada');
  if (rows_('Abonos').some(a => !a.anulado && parseJ_(a.aplicado, []).some(x => x.id === v.id))) throw new Error('Esta venta tiene abonos. Anula primero los abonos del cliente.');
  const det = rows_('VentaDetalle').filter(x => x.ventaId === v.id);
  const cambios = {};
  det.forEach(i => { if (i.productoId) cambios[i.productoId] = r3_((cambios[i.productoId] || 0) + i.cantidad); });
  moverStock_(cambios, 'anulación', v.id, u, 'Anulación ' + v.numero);
  upsert_('Ventas', { id: v.id, anulada: true, saldo: 0, anulacion: marca_(), nota: (v.nota ? v.nota + ' · ' : '') + 'Anulada por ' + u.nombre + ' ' + ahora_().replace('T', ' ') + (d.motivo ? ': ' + txt_(d.motivo, 120) : '') });
  if (v.pedidoId) { const pe = rows_('Pedidos').find(x => x.id === v.pedidoId && x.ventaId === v.id); if (pe) upsert_('Pedidos', { id: pe.id, estado: 'listo', ventaId: '', actualizado: ahora_() }); }
  try { rows_('Suscripciones').filter(x => x.ventaId === d.id && x.estado === 'activa').forEach(x => upsert_('Suscripciones', { id: x.id, estado: 'cancelada', nota: 'Venta anulada' })); } catch (e) {}
  return { productos: rows_('Productos') };
}

/* ===================== CUENTAS POR COBRAR (abonos) ===================== */

function abono_(u, d) {
  req_(u, ['admin','cajero']);
  const cli = rows_('Clientes').find(c => c.id === d.clienteId);
  if (!cli) throw new Error('Selecciona un cliente');
  const monto = r2_(d.monto);
  if (!(monto > 0)) throw new Error('El monto debe ser mayor a cero');
  const pend = rows_('Ventas').filter(v => v.clienteId === cli.id && !v.anulada && v.saldo > 0.004).sort((a, b) => a.fecha < b.fecha ? -1 : 1);
  const deuda = r2_(pend.reduce((a, v) => a + v.saldo, 0));
  if (monto > deuda + 0.004) throw new Error('El abono es mayor que el saldo (' + money_(deuda, config_()) + ')');
  let resta = monto;
  const aplicado = [];
  pend.forEach(v => {
    if (resta <= 0.004) return;
    const x = r2_(Math.min(resta, v.saldo));
    upsert_('Ventas', { id: v.id, saldo: r2_(v.saldo - x) });
    aplicado.push({ id: v.id, numero: v.numero, monto: x });
    resta = r2_(resta - x);
  });
  const metodo = ['Efectivo','Tarjeta','Transferencia'].indexOf(d.metodo) >= 0 ? d.metodo : 'Efectivo';
  const a = upsert_('Abonos', { fecha: ahora_(), clienteId: cli.id, monto: monto, metodo: metodo, aplicado: JSON.stringify(aplicado), usuarioId: u.id, nota: txt_(d.nota, 200), anulado: false });
  return { abono: a, saldo: saldosClientes_()[cli.id] || 0 };
}

function anularAbono_(u, d) {
  req_(u, ['admin']);
  const a = rows_('Abonos').find(x => x.id === d.id);
  if (!a) throw new Error('El abono no existe');
  if (a.anulado) throw new Error('El abono ya está anulado');
  const vm = porId_(rows_('Ventas'));
  parseJ_(a.aplicado, []).forEach(x => { const v = vm[x.id]; if (v && !v.anulada) upsert_('Ventas', { id: v.id, saldo: r2_(v.saldo + x.monto) }); });
  upsert_('Abonos', { id: a.id, anulado: true, anulacion: marca_(), nota: (a.nota ? a.nota + ' · ' : '') + 'Anulado por ' + u.nombre + ' ' + ahora_().replace('T', ' ') });
  return { saldo: saldosClientes_()[a.clienteId] || 0 };
}

function cuentaCliente_(u, d) {
  req_(u, ['admin','cajero']);
  const cli = rows_('Clientes').find(c => c.id === d.id);
  if (!cli) throw new Error('El cliente no existe');
  const ventas = desc_(rows_('Ventas').filter(v => v.clienteId === cli.id), 'fecha');
  const ids = {};
  ventas.forEach(v => { v.detalle = []; ids[v.id] = v; });
  rows_('VentaDetalle').forEach(x => { if (ids[x.ventaId]) ids[x.ventaId].detalle.push(x); });
  const abonos = desc_(rows_('Abonos').filter(a => a.clienteId === cli.id), 'fecha');
  const act = ventas.filter(v => !v.anulada);
  return { ventas: ventas.slice(0, 200), abonos: abonos.slice(0, 200), saldo: saldosClientes_()[cli.id] || 0,
    totalComprado: r2_(act.reduce((a, v) => a + v.total, 0)), compras: act.length, ultima: act.length ? act[0].fecha : '' };
}

/* ===================== COMPRAS Y PROVEEDORES ===================== */

function compra_(u, d) {
  req_(u, ['admin','bodega']);
  const prods = rows_('Productos'), pm = porId_(prods);
  // Para crear productos dentro de la compra sin repetir nombres ni códigos
  const nombres = {}, codigos = {};
  prods.forEach(p => { nombres[String(p.nombre).trim().toLowerCase()] = p; if (p.codigo) codigos[String(p.codigo).toLowerCase()] = p; });
  const vacio = x => x === undefined || x === null || String(x).trim() === '';
  const items = (d.items || []).map(i => {
    const precio = vacio(i.precio) ? null : r2_(i.precio);
    let margen = vacio(i.margen) || !isFinite(Number(i.margen)) ? null : r2_(i.margen);
    if (margen !== null && !(margen >= 0 && margen <= 10000)) margen = null;
    let p;
    if (i.nuevo) {
      const n = i.nuevo, nombre = txt_(n.nombre, 80), clave = nombre.toLowerCase(), codigo = txt_(n.codigo, 40);
      if (!nombre) throw new Error('Escribe el nombre del producto nuevo');
      if (nombres[clave]) throw new Error(nombres[clave]._nuevo ? '«' + nombre + '» está dos veces en la compra' : 'Ya existe un producto llamado «' + nombres[clave].nombre + '». Búscalo en la lista para agregarlo.');
      if (codigo && codigos[codigo.toLowerCase()]) throw new Error('El código ' + codigo + ' ya es de «' + codigos[codigo.toLowerCase()].nombre + '»');
      if (!(precio > 0)) throw new Error('Ponle el precio de venta a «' + nombre + '»');
      const tasa = ['', '0', '15', '18'].indexOf(String(n.tasaIsv === undefined ? '' : n.tasaIsv)) >= 0 ? String(n.tasaIsv === undefined ? '' : n.tasaIsv) : '';
      p = { _nuevo: true, nombre: nombre, codigo: codigo, categoria: txt_(n.categoria, 40) || 'General', unidad: txt_(n.unidad, 20) || 'unidad', tasaIsv: tasa, tipo: 'producto', stock: 0, costo: 0 };
      nombres[clave] = p; if (codigo) codigos[codigo.toLowerCase()] = p;
    } else {
      p = pm[i.productoId];
      if (!p) throw new Error('Un producto de la compra ya no existe');
      if (p.tipo !== 'producto') throw new Error('«' + p.nombre + '» no controla existencias');
    }
    if (!esNum_(i.cantidad) || !(r3_(i.cantidad) > 0)) throw new Error('Cantidad no válida en «' + p.nombre + '»');
    if (!esNum_(i.costo) || Number(i.costo) < 0) throw new Error('Costo no válido en «' + p.nombre + '»');
    if (!vacio(i.precio) && (!esNum_(i.precio) || precio < 0)) throw new Error('Precio no válido en «' + p.nombre + '»');
    const cant = r3_(i.cantidad), costo = r4_(i.costo);
    return { p: p, cantidad: cant, costo: costo, precio: precio, margen: margen };
  });
  if (!items.length) throw new Error('Agrega al menos un producto');
  const prov = d.proveedorId ? rows_('Proveedores').find(x => x.id === d.proveedorId) : null;
  const metodo = METODOS.indexOf(d.metodo) >= 0 ? d.metodo : 'Efectivo';
  if (metodo === 'Crédito' && !prov) throw new Error('Para comprar al crédito selecciona un proveedor');
  const total = r2_(items.reduce((a, i) => a + r2_(i.cantidad * i.costo), 0));
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(d.fecha || '')) && d.fecha <= hoy_() ? (d.fecha === hoy_() ? ahora_() : d.fecha + 'T12:00') : ahora_();
  // Ya validado todo: se crean los productos nuevos (sin existencias; las suma la compra)
  const cats = {};
  prods.forEach(p => { if (p.categoria) cats[String(p.categoria).toLowerCase()] = p.categoria; });
  const nuevos = [];
  items.forEach(i => {
    if (!i.p._nuevo) return;
    const x = i.p, cat = cats[x.categoria.toLowerCase()] || x.categoria;
    cats[cat.toLowerCase()] = cat;
    const g = upsert_('Productos', { codigo: x.codigo, nombre: x.nombre, categoria: cat, tipo: 'producto', unidad: x.unidad, precio: i.precio, costo: 0, margen: i.margen === null ? 0 : i.margen,
      stock: 0, stockMin: 0, tasaIsv: x.tasaIsv, icono: '', foto: '', fotoFecha: '', descripcion: '', tienda: true, activo: true, creado: ahora_() });
    i.p = g; nuevos.push(g.id);
  });
  const c = {
    id: newId_('Compras'), numero: siguiente_('C'), fecha: fecha, proveedorId: prov ? prov.id : '', factura: txt_(d.factura, 40),
    total: total, saldo: metodo === 'Crédito' ? total : 0, metodo: metodo, usuarioId: u.id, anulada: false, nota: txt_(d.nota, 200)
  };
  appendRows_('Compras', [c]);
  appendRows_('CompraDetalle', items.map((i, k) => ({ id: newId_('CompraDetalle') + k, compraId: c.id, productoId: i.p.id, descripcion: i.p.nombre,
    cantidad: i.cantidad, costo: i.costo, total: r2_(i.cantidad * i.costo),
    precioAnt: i.precio !== null && i.precio > 0 && Math.abs(i.precio - (i.p.precio || 0)) > 0.004 ? (nuevos.indexOf(i.p.id) >= 0 ? 0 : i.p.precio) : '',
    precio: i.precio !== null && i.precio > 0 && Math.abs(i.precio - (i.p.precio || 0)) > 0.004 ? i.precio : '' })));
  // Costo promedio ponderado y nuevo precio de venta (si se indicó)
  const agr = {};
  items.forEach(i => { const x = agr[i.p.id] || (agr[i.p.id] = { p: i.p, cant: 0, valor: 0, precio: null, margen: null }); x.cant += i.cantidad; x.valor += i.cantidad * i.costo; if (i.precio !== null) x.precio = i.precio; if (i.margen !== null) x.margen = i.margen; });
  const cambios = {};
  Object.keys(agr).forEach(id => {
    const x = agr[id], st = Math.max(0, x.p.stock);
    const nuevoCosto = st + x.cant > 0 ? r4_((st * x.p.costo + x.valor) / (st + x.cant)) : x.p.costo;
    const upd = { id: id, costo: nuevoCosto };
    if (x.precio !== null && x.precio > 0) upd.precio = x.precio;
    if (x.margen !== null) upd.margen = x.margen;
    upsert_('Productos', upd);
    cambios[id] = r3_(x.cant);
  });
  moverStock_(cambios, 'compra', c.id, u, c.numero + (c.factura ? ' · Fact. ' + c.factura : ''), fecha);
  return { compra: c, productos: rows_('Productos'), proveedores: proveedoresConSaldo_(), nuevos: nuevos };
}

function proveedoresConSaldo_() { const sp = saldosProveedores_(); return rows_('Proveedores').map(p => { p.saldo = sp[p.id] || 0; return p; }); }
function clientesConSaldo_() { const sc = saldosClientes_(); return rows_('Clientes').map(c => { c.saldo = sc[c.id] || 0; return c; }); }

function compras_(u, d) {
  req_(u, ['admin','bodega']);
  const r = rango_(d);
  let l = rows_('Compras').filter(x => (!r.desde || x.fecha >= r.desde) && (!r.hasta || x.fecha <= r.hasta));
  if (d.proveedorId) l = l.filter(x => x.proveedorId === d.proveedorId);
  const ids = {};
  l.forEach(x => { x.detalle = []; ids[x.id] = x; });
  rows_('CompraDetalle').forEach(x => { if (ids[x.compraId]) ids[x.compraId].detalle.push(x); });
  const act = l.filter(x => !x.anulada), lista = desc_(l, 'fecha');
  return { lista: lista.slice(0, 300), n: l.length, recortada: lista.length > 300,
    resumen: { total: r2_(act.reduce((a, x) => a + x.total, 0)), n: act.length, pendiente: r2_(act.reduce((a, x) => a + x.saldo, 0)) } };
}

function anularCompra_(u, d) {
  req_(u, ['admin']);
  const c = rows_('Compras').find(x => x.id === d.id);
  if (!c) throw new Error('La compra no existe');
  if (c.anulada) throw new Error('La compra ya está anulada');
  if (rows_('Pagos').some(p => !p.anulado && parseJ_(p.aplicado, []).some(x => x.id === c.id))) throw new Error('Esta compra tiene pagos. Anula primero los pagos al proveedor.');
  const det = rows_('CompraDetalle').filter(x => x.compraId === c.id), pm = porId_(rows_('Productos')), cambios = {}, agr = {};
  det.forEach(i => {
    cambios[i.productoId] = r3_((cambios[i.productoId] || 0) - i.cantidad);
    const x = agr[i.productoId] || (agr[i.productoId] = { cant: 0, valor: 0, precioAnt: null, precio: null });
    x.cant += i.cantidad; x.valor += i.cantidad * i.costo;
    if (i.precio > 0) { x.precio = i.precio; if (x.precioAnt === null) x.precioAnt = i.precioAnt; }
  });
  const falta = Object.keys(cambios).filter(id => pm[id] && pm[id].stock + cambios[id] < -0.0005);
  if (falta.length) throw new Error('No se puede anular: ya se vendió parte de «' + pm[falta[0]].nombre + '». Haz un ajuste de inventario si es necesario.');
  Object.keys(agr).forEach(id => {
    const p = pm[id], x = agr[id]; if (!p) return;
    const upd = { id: id }, resto = p.stock - x.cant;
    if (resto > 0.0005) { const c0 = (p.stock * p.costo - x.valor) / resto; if (isFinite(c0) && c0 >= 0) upd.costo = r4_(c0); }
    if (x.precio > 0 && x.precioAnt > 0 && Math.abs(p.precio - x.precio) < 0.005) upd.precio = x.precioAnt; // nadie lo cambió después
    if (Object.keys(upd).length > 1) upsert_('Productos', upd);
  });
  moverStock_(cambios, 'anulación', c.id, u, 'Anulación ' + c.numero);
  upsert_('Compras', { id: c.id, anulada: true, saldo: 0, anulacion: marca_(), nota: (c.nota ? c.nota + ' · ' : '') + 'Anulada por ' + u.nombre + ' ' + ahora_().replace('T', ' ') });
  return { productos: rows_('Productos'), proveedores: proveedoresConSaldo_() };
}

function pago_(u, d) {
  req_(u, ['admin']);
  const pr = rows_('Proveedores').find(x => x.id === d.proveedorId);
  if (!pr) throw new Error('Selecciona un proveedor');
  const monto = r2_(d.monto);
  if (!(monto > 0)) throw new Error('El monto debe ser mayor a cero');
  const pend = rows_('Compras').filter(c => c.proveedorId === pr.id && !c.anulada && c.saldo > 0.004).sort((a, b) => a.fecha < b.fecha ? -1 : 1);
  const deuda = r2_(pend.reduce((a, c) => a + c.saldo, 0));
  if (monto > deuda + 0.004) throw new Error('El pago es mayor que el saldo (' + money_(deuda, config_()) + ')');
  let resta = monto;
  const aplicado = [];
  pend.forEach(c => {
    if (resta <= 0.004) return;
    const x = r2_(Math.min(resta, c.saldo));
    upsert_('Compras', { id: c.id, saldo: r2_(c.saldo - x) });
    aplicado.push({ id: c.id, numero: c.numero, monto: x });
    resta = r2_(resta - x);
  });
  const metodo = ['Efectivo','Tarjeta','Transferencia'].indexOf(d.metodo) >= 0 ? d.metodo : 'Efectivo';
  const p = upsert_('Pagos', { fecha: ahora_(), proveedorId: pr.id, monto: monto, metodo: metodo, aplicado: JSON.stringify(aplicado), usuarioId: u.id, nota: txt_(d.nota, 200), anulado: false });
  return { pago: p, proveedores: proveedoresConSaldo_() };
}

function anularPago_(u, d) {
  req_(u, ['admin']);
  const p = rows_('Pagos').find(x => x.id === d.id);
  if (!p) throw new Error('El pago no existe');
  if (p.anulado) throw new Error('El pago ya está anulado');
  const cm = porId_(rows_('Compras'));
  parseJ_(p.aplicado, []).forEach(x => { const c = cm[x.id]; if (c && !c.anulada) upsert_('Compras', { id: c.id, saldo: r2_(c.saldo + x.monto) }); });
  upsert_('Pagos', { id: p.id, anulado: true, anulacion: marca_(), nota: (p.nota ? p.nota + ' · ' : '') + 'Anulado por ' + u.nombre + ' ' + ahora_().replace('T', ' ') });
  return { proveedores: proveedoresConSaldo_() };
}

function cuentaProveedor_(u, d) {
  req_(u, ['admin','bodega']);
  const pr = rows_('Proveedores').find(x => x.id === d.id);
  if (!pr) throw new Error('El proveedor no existe');
  return { compras: compras_(u, { proveedorId: pr.id }).lista, pagos: desc_(rows_('Pagos').filter(p => p.proveedorId === pr.id), 'fecha').slice(0, 200),
    saldo: saldosProveedores_()[pr.id] || 0 };
}

/* ===================== GASTOS ===================== */

// Categorías, detalles y proveedores ya usados, ordenados por frecuencia (para sugerirlos)
function catalogoGastos_() {
  const m = {};
  rows_('Gastos').filter(g => !g.anulado).forEach(g => {
    const c = String(g.categoria || '').trim();
    if (!c) return;
    const x = m[c] || (m[c] = { usos: 0, ultimo: '', det: {}, prov: {}, montos: {}, fdet: {} });
    x.usos++;
    if (g.fechaGasto > x.ultimo) x.ultimo = g.fechaGasto;
    const dd = String(g.detalle || '').trim();
    if (dd) {
      x.det[dd] = (x.det[dd] || 0) + 1;
      if (!x.fdet[dd] || g.fechaGasto >= x.fdet[dd]) { x.fdet[dd] = g.fechaGasto; x.montos[dd] = g.monto; }
    }
    const p = String(g.proveedor || '').trim();
    if (p) x.prov[p] = (x.prov[p] || 0) + 1;
  });
  const orden = o => Object.keys(o).sort((a, b) => o[b] - o[a] || a.localeCompare(b));
  return Object.keys(m).map(k => ({ categoria: k, usos: m[k].usos, ultimo: m[k].ultimo,
    detalles: orden(m[k].det), proveedores: orden(m[k].prov), montos: m[k].montos }))
    .sort((a, b) => b.usos - a.usos || a.categoria.localeCompare(b.categoria));
}

function gastos_(u, d) {
  req_(u, ['admin','cajero']);
  const desde = String(d.desde || '').slice(0, 10), hasta = String(d.hasta || '').slice(0, 10);
  let l = rows_('Gastos').filter(g => (!desde || g.fechaGasto >= desde) && (!hasta || g.fechaGasto <= hasta));
  if (u.rol === 'cajero') l = l.filter(g => g.usuarioId === u.id);
  return desc_(l.map(g => { g._k = g.fechaGasto + g.creado; return g; }), '_k');
}

function guardarGasto_(u, d) {
  req_(u, ['admin','cajero']);
  const r = Object.assign({}, d.registro || {});
  const prev = r.id ? rows_('Gastos').find(g => g.id === r.id) : null;
  if (r.id && !prev) throw new Error('El gasto ya no existe');
  if (prev && prev.anulado) throw new Error('No se puede modificar un gasto anulado');
  if (prev && u.rol !== 'admin' && prev.usuarioId !== u.id) throw new Error('Solo puedes modificar los gastos que registraste');
  ['categoria','detalle','proveedor','nota','metodo'].forEach(k => { r[k] = txt_(r[k], 120); });
  if (!esNum_(r.monto)) throw new Error('Escribe el monto del gasto');
  if (!r.categoria) throw new Error('Selecciona o escribe una categoría');
  if (!r.detalle) throw new Error('Escribe el detalle del gasto');
  r.monto = r2_(r.monto);
  if (!(r.monto > 0)) throw new Error('El monto debe ser mayor a cero');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.fechaGasto || ''))) r.fechaGasto = hoy_();
  if (r.fechaGasto > hoy_()) throw new Error('La fecha del gasto no puede ser futura');
  const cats = catalogoGastos_();
  const cat = cats.find(c => c.categoria.toLowerCase() === r.categoria.toLowerCase());
  if (cat) {
    r.categoria = cat.categoria;
    const det = cat.detalles.find(x => x.toLowerCase() === r.detalle.toLowerCase());
    if (det) r.detalle = det;
  }
  const prov = [].concat.apply([], cats.map(c => c.proveedores)).find(x => r.proveedor && x.toLowerCase() === r.proveedor.toLowerCase());
  if (prov) r.proveedor = prov;
  r.metodo = ['Efectivo','Tarjeta','Transferencia'].indexOf(r.metodo) >= 0 ? r.metodo : 'Efectivo';
  if (prev && (prev.metodo === 'Efectivo' || r.metodo === 'Efectivo') && (Math.abs(prev.monto - r.monto) > 0.004 || prev.metodo !== r.metodo) && idMs_(prev.id) <= ventanaCaja_().desdeMs)
    throw new Error('Este gasto ya entró en un cierre de caja. Para cambiar el monto o la forma de pago, anúlalo y regístralo de nuevo.');
  if (!prev) { r.usuarioId = u.id; r.creado = ahora_(); r.anulado = false; }
  else { delete r.usuarioId; delete r.creado; delete r.anulado; }
  const g = upsert_('Gastos', r);
  return { gasto: g, cats: catalogoGastos_() };
}

function anularGasto_(u, d) {
  req_(u, ['admin']);
  const g = rows_('Gastos').find(x => x.id === d.id);
  if (!g) throw new Error('El gasto no existe');
  if (g.anulado) throw new Error('El gasto ya está anulado');
  upsert_('Gastos', { id: g.id, anulado: true, anulacion: marca_(), nota: (g.nota ? g.nota + ' · ' : '') + 'Anulado por ' + u.nombre + ' ' + ahora_().replace('T', ' ') });
  return { cats: catalogoGastos_() };
}

/* ===================== PEDIDOS EN LÍNEA (sistema) ===================== */

function pedidos_(u, d) {
  req_(u, ['admin','cajero']);
  const lim = diasAtras_(45) + 'T00:00';
  const l = rows_('Pedidos').filter(p => ['nuevo','confirmado','listo'].indexOf(p.estado) >= 0 || p.fecha >= lim);
  return desc_(l, 'fecha').map(p => { p.items = parseJ_(p.items, []); return p; });
}

function pendientes_(u) {
  if (u.rol === 'bodega') return { nuevos: 0, mensajes: 0 };
  if (config_().sysChats !== hoy_()) { try { lock_(() => limpiarChats_()); } catch (e) {} }
  const n = rows_('Pedidos').filter(p => p.estado === 'nuevo');
  let sop = 0; try { if (MULTI_NEGOCIO && NEG) sop = mRows_('Soporte').filter(c => c.negocioId === NEG.id && Number(c.sinLeerCli) > 0).length; } catch (e) {}
  const out = { nuevos: n.length, ultimo: n.length ? n.map(p => p.fecha).sort().pop() : '', mensajes: rows_('Chats').filter(c => c.sinLeer > 0).length, soporte: sop };
  try { out.avisos = avisosDia_(); } catch (e) {}
  return out;
}
// Avisos del día para las notificaciones del teléfono (la app los muestra una sola vez por día)
function avisosDia_() {
  const h = hoy_(), a = {};
  if (modOn_('suscripciones')) { const l = rows_('Suscripciones').filter(s => s.estado !== 'cancelada' && s.estado !== 'renovada'); a.susHoy = l.filter(s => s.vence === h).length; a.susVenc = l.filter(s => s.vence < h && s.vence >= diasAtras_(3)).length; }
  if (modOn_('agenda') || modOn_('encargos')) {
    const l = rows_('Agenda').filter(x => x.estado === 'pendiente' && x.dia === h), ahora = ahora_().slice(11, 16);
    const prox = x => x.hora && x.hora >= ahora && (msDeLocal_(h + 'T' + x.hora) - Date.now()) <= 3600000;
    if (modOn_('agenda')) { const c = l.filter(x => x.tipo === 'cita'); a.citasHoy = c.length; a.citasProx = c.filter(prox).map(x => ({ hora: x.hora, cliente: x.cliente, detalle: x.detalle })); }
    if (modOn_('encargos')) { const e = l.filter(x => x.tipo === 'encargo'); a.encHoy = e.length; a.encProx = e.filter(prox).map(x => ({ hora: x.hora, cliente: x.cliente, detalle: x.detalle })); }
  }
  if (modOn_('caducidad')) { const c = caducan_(); a.cadVenc = c.vencidos; a.cadProx = c.n - c.vencidos; }
  if (modOn_('ordenes')) a.ordAtras = rows_('Ordenes').filter(o => ['recibido', 'proceso'].indexOf(o.estado) >= 0 && o.promesa && o.promesa < h).length;
  return a;
}

function estadoPedido_(u, d) {
  req_(u, ['admin','cajero']);
  const p = rows_('Pedidos').find(x => x.id === d.id);
  if (!p) throw new Error('El pedido no existe');
  if (EST_PEDIDO.indexOf(d.estado) < 0 || d.estado === 'entregado') throw new Error('Estado no válido');
  if (p.estado === 'entregado' || p.estado === 'cancelado') throw new Error('Este pedido ya está ' + p.estado);
  const upd = { id: p.id, estado: d.estado, actualizado: ahora_() };
  if (d.estado === 'cancelado' && d.motivo) upd.nota = (p.nota ? p.nota + ' · ' : '') + 'Cancelado: ' + txt_(d.motivo, 120);
  const g = upsert_('Pedidos', upd);
  g.items = parseJ_(g.items, []);
  return g;
}

/* ===================== CAJA ===================== */

// La caja abierta empieza donde terminó el último cierre (o hoy a las 00:00)
function ventanaCaja_() {
  const cierres = desc_(rows_('Cierres'), 'hasta'), u = cierres[0];
  const desde = u ? u.hasta : hoy_() + 'T00:00';
  const desdeMs = u ? (Number(u.marca) || msDeLocal_(u.hasta) + (String(u.hasta).length > 16 ? 999 : 59999)) : msDeLocal_(hoy_() + 'T00:00') - 1;
  return { desde: desde, desdeMs: desdeMs, hastaMs: Infinity, cierres: cierres };
}

// Efectivo de la ventana: cada movimiento cuenta en el momento exacto en que se registró (va en su id).
// Si se anula algo que ya entró en un cierre anterior, la devolución se refleja en la caja abierta.
function cajaCalc_(w) {
  const en = t => t > w.desdeMs && t <= w.hastaMs;
  const k = { ventas: 0, cobros: 0, gastos: 0, pagos: 0, compras: 0, tarjeta: 0, transferencia: 0, credito: 0, nVentas: 0, proyectos: 0, anulaciones: 0 };
  // Solo se leen los movimientos desde el último cierre (y, por si una anulación toca algo anterior, hasta 90 días atrás)
  const vent = Math.min(w.desdeMs, ventanaMs_()), rows_ = name => rowsDesde_(name, vent);
  // signo: +1 entra efectivo, -1 sale. Devuelve true si el movimiento se cuenta normalmente.
  const mira = (x, anulado, efectivo, aplicar) => {
    const t = idMs_(x.id), ta = Number(x.anulacion) || 0;
    if (en(t)) { if (!anulado || ta > w.hastaMs) aplicar(1); return; }
    if (t <= w.desdeMs && anulado && en(ta) && efectivo) { aplicar(-1); k.anulaciones += 1; }
  };
  rows_('Ventas').forEach(v => mira(v, v.anulada, v.metodo === 'Efectivo' || (v.metodo === 'Crédito' && v.recibido > 0), s => {
    if (s > 0) k.nVentas++;
    const ant = Number(v.anticipo) || 0; // el anticipo ya entró a caja como abono cuando se recibió
    if (v.metodo === 'Efectivo') k.ventas += s * (v.total - ant);
    else if (v.metodo === 'Crédito') { k.ventas += s * v.recibido; if (s > 0) k.credito += v.total - ant - v.recibido; }
    else if (v.metodo === 'Tarjeta') k.tarjeta += v.total - ant;
    else if (v.metodo === 'Transferencia') k.transferencia += v.total - ant;
  }));
  rows_('Abonos').forEach(a => mira(a, a.anulado, a.metodo === 'Efectivo', s => { if (a.metodo === 'Efectivo') k.cobros += s * a.monto; else if (a.metodo === 'Tarjeta') k.tarjeta += a.monto; else k.transferencia += a.monto; }));
  rows_('Gastos').forEach(g => { if (g.metodo === 'Efectivo') mira(g, g.anulado, true, s => { k.gastos += s * g.monto; }); });
  rows_('Pagos').forEach(p => { if (p.metodo === 'Efectivo') mira(p, p.anulado, true, s => { k.pagos += s * p.monto; }); });
  rows_('Compras').forEach(c => { if (c.metodo === 'Efectivo') mira(c, c.anulada, true, s => { k.compras += s * c.total; }); });
  // Gastos de proyectos pagados con el efectivo de la caja (cuentan como gasto en efectivo)
  rows_('ProyectoGastos').forEach(g => { if (g.caja) mira(g, g.anulado, true, s => { k.gastos += s * g.monto; k.proyectos += s * g.monto; }); });
  Object.keys(k).forEach(x => { k[x] = r2_(k[x]); });
  return k;
}

function caja_(u, d) {
  req_(u, ['admin','cajero']);
  const w = ventanaCaja_(), cierres = w.cierres, desde = w.desde;
  const k = cajaCalc_(w);
  const us = porId_(rows_('Usuarios'));
  return { desde: desde, ahora: ahora_(), fondo: Number(config_().fondoCaja) || 0, k: k, ventasHoy: ventasDelDia_(hoy_()),
    cierres: cierres.slice(0, 30).map(c => { c.usuario = us[c.usuarioId] ? us[c.usuarioId].nombre : ''; return c; }) };
}

// Ventas de un día con cliente, artículos y si vinieron de un pedido en línea (para Caja)
function ventasDelDia_(dia) {
  const cm = porId_(rows_('Clientes')), us = porId_(rows_('Usuarios')), pm = porId_(rows_('Pedidos'));
  const vent = msDeLocal_(dia + 'T00:00') - 60000;
  const v = rowsDesde_('Ventas', vent).filter(x => String(x.fecha).slice(0, 10) === dia);
  const ids = {};
  v.forEach(x => { x.detalle = []; ids[x.id] = x; });
  rowsDesde_('VentaDetalle', vent).forEach(x => { if (ids[x.ventaId]) ids[x.ventaId].detalle.push({ descripcion: x.descripcion, cantidad: x.cantidad, total: x.total, productoId: x.productoId }); });
  return desc_(v, 'fecha').map(x => ({ id: x.id, numero: x.numero, factura: x.factura, fecha: x.fecha, total: x.total, metodo: x.metodo, saldo: x.saldo, anulada: x.anulada,
    cliente: x.clienteId && cm[x.clienteId] ? cm[x.clienteId].nombre : 'Consumidor final', usuario: us[x.usuarioId] ? us[x.usuarioId].nombre : '',
    pedido: x.pedidoId && pm[x.pedidoId] ? pm[x.pedidoId].numero : (x.pedidoId ? 'en línea' : ''), detalle: x.detalle }));
}

function cerrarCaja_(u, d) {
  req_(u, ['admin','cajero']);
  const marca = Number(marca_());
  const w = ventanaCaja_();
  if (marca - w.desdeMs < 3000) throw new Error('Espera unos segundos antes de hacer otro cierre');
  w.hastaMs = marca;
  const k = cajaCalc_(w);
  if (!esNum_(d.contado) || !(Number(d.contado) >= 0)) throw new Error('Escribe cuánto efectivo contaste');
  if (d.fondo !== undefined && d.fondo !== '' && (!esNum_(d.fondo) || Number(d.fondo) < 0)) throw new Error('El fondo de caja no es válido');
  const fondo = d.fondo === undefined || d.fondo === '' ? (Number(config_().fondoCaja) || 0) : r2_(d.fondo);
  const contado = r2_(d.contado);
  const esperado = r2_(fondo + k.ventas + k.cobros - k.gastos - k.pagos - k.compras);
  const hasta = ahora_() + ':59';
  const c = upsert_('Cierres', { desde: w.desde, hasta: hasta < w.desde ? w.desde : hasta, usuarioId: u.id, fondo: fondo, ventas: k.ventas, cobros: k.cobros,
    gastos: r2_(k.gastos + k.compras), pagos: k.pagos, esperado: esperado, contado: contado, diferencia: r2_(contado - esperado), nota: txt_(d.nota, 200), marca: String(marca) });
  return { cierre: c, caja: caja_(u, d) };
}

/* ===================== INICIO ===================== */

function inicio_(u) {
  const h = hoy_(), mes = h.slice(0, 7), out = { rol: u.rol }, vent = ventanaMs_();
  if (u.rol !== 'bodega' && susActivas_()) { try { out.sus = susResumen_(); } catch (e) {} }
  try {
    if (modOn_('caducidad')) out.caducan = caducan_();
    if (modOn_('ordenes')) out.ordenes = ordenResumen_();
    if (modOn_('agenda')) out.agenda = agendaResumen_('cita');
    if (modOn_('encargos')) out.encargos = agendaResumen_('encargo');
  } catch (e) {}
  if (u.rol === 'admin' || u.rol === 'cajero') {
    const ventas = rowsDesde_('Ventas', vent).filter(v => !v.anulada);
    const vh = ventas.filter(v => v.fecha.slice(0, 10) === h && (u.rol === 'admin' || v.usuarioId === u.id));
    out.hoy = { ventas: r2_(vh.reduce((a, v) => a + v.total, 0)), n: vh.length };
    if (u.rol === 'admin') out.hoy.ganancia = r2_(vh.reduce((a, v) => a + v.total - v.isv - v.costo, 0));
    const spark = [];
    for (let i = 6; i >= 0; i--) { const f = diasAtras_(i); spark.push(r2_(ventas.filter(v => v.fecha.slice(0, 10) === f && (u.rol === 'admin' || v.usuarioId === u.id)).reduce((a, v) => a + v.total, 0))); }
    out.spark = spark;
    const cm = porId_(rows_('Clientes'));
    out.ultimas = desc_(rowsDesde_('Ventas', vent).filter(v => u.rol === 'admin' || v.usuarioId === u.id), 'fecha').slice(0, 5)
      .map(v => ({ id: v.id, numero: v.numero, fecha: v.fecha, total: v.total, metodo: v.metodo, anulada: v.anulada, cliente: v.clienteId && cm[v.clienteId] ? cm[v.clienteId].nombre : 'Consumidor final' }));
    const ped = rows_('Pedidos').filter(p => p.estado === 'nuevo');
    out.pedidos = { nuevos: ped.length, total: r2_(ped.reduce((a, p) => a + p.total, 0)), activos: rows_('Pedidos').filter(p => ['confirmado','listo'].indexOf(p.estado) >= 0).length };
    const sc = saldosClientes_();
    out.porCobrar = { total: r2_(Object.keys(sc).reduce((a, k) => a + sc[k], 0)), clientes: Object.keys(sc).length };
    const k = cajaCalc_(ventanaCaja_());
    out.caja = r2_((Number(config_().fondoCaja) || 0) + k.ventas + k.cobros - k.gastos - k.pagos - k.compras);
  }
  if (u.rol === 'admin') {
    const ventasMes = rowsDesde_('Ventas', vent).filter(v => !v.anulada && v.fecha.slice(0, 7) === mes);
    const gastosMes = rowsDesde_('Gastos', vent).filter(g => !g.anulado && g.fechaGasto.slice(0, 7) === mes);
    const vs = ventasMes.reduce((a, v) => a + v.total, 0), gb = ventasMes.reduce((a, v) => a + v.total - v.isv - v.costo, 0), gs = gastosMes.reduce((a, g) => a + g.monto, 0);
    out.mes = { ventas: r2_(vs), ganancia: r2_(gb - gs), gastos: r2_(gs), n: ventasMes.length };
    const sp = saldosProveedores_();
    out.porPagar = { total: r2_(Object.keys(sp).reduce((a, k) => a + sp[k], 0)), proveedores: Object.keys(sp).length };
    out.aviso = resumenMeses_().find(m => !m.enCurso && m.pendiente > 0.009) || null;
  }
  if (u.rol === 'admin' || u.rol === 'bodega') {
    const prods = rows_('Productos').filter(p => p.activo && p.tipo === 'producto');
    const bajos = prods.filter(p => p.stock <= p.stockMin);
    out.stock = { bajos: bajos.length, agotados: prods.filter(p => p.stock <= 0).length, lista: bajos.sort((a, b) => a.stock - b.stock).slice(0, 6).map(p => ({ id: p.id, nombre: p.nombre, stock: p.stock, stockMin: p.stockMin, icono: p.icono, foto: p.foto })),
      valor: r2_(prods.reduce((a, p) => a + Math.max(0, p.stock) * p.costo, 0)), productos: prods.length };
    const cm = rowsDesde_('Compras', vent).filter(c => !c.anulada && c.fecha.slice(0, 7) === mes);
    out.comprasMes = { total: r2_(cm.reduce((a, c) => a + c.total, 0)), n: cm.length };
    const pj = rows_('Proyectos').filter(p => p.estado === 'curso');
    if (pj.length) {
      const dt = datosProyectos_(), cfg = config_();
      out.proyectosN = pj.length;
      out.proyectos = desc_(pj, 'actualizado').slice(0, 3).map(p => { const c = calcProyecto_(p, dt.G[p.id] || [], dt.P[p.id] || [], cfg); return { id: p.id, nombre: p.nombre, semaforo: c.semaforo, pct: c.pct, costo: c.costo, unidades: c.unidades }; });
    }
  }
  if (u.rol === 'bodega') {
    const pm = porId_(rows_('Productos'));
    out.movimientos = desc_(rowsDesde_('Inventario', vent), 'fecha').slice(0, 8)
      .map(m => ({ fecha: m.fecha, tipo: m.tipo, cantidad: m.cantidad, nombre: pm[m.productoId] ? pm[m.productoId].nombre : '—', nota: m.nota }));
  }
  return out;
}

/* ===================== REPORTES ===================== */

function reporte_(u, d) {
  req_(u, ['admin']);
  const r = rango_({ desde: d.desde || hoy_(), hasta: d.hasta || hoy_() });
  const ventas = rows_('Ventas').filter(v => !v.anulada && v.fecha >= r.desde && v.fecha <= r.hasta);
  const ids = new Set(ventas.map(v => v.id));
  const det = rows_('VentaDetalle').filter(x => ids.has(x.ventaId));
  // Factor de cada venta: lo que de verdad entró sin ISV, repartido entre sus líneas
  const lineas = {}; det.forEach(x => { lineas[x.ventaId] = (lineas[x.ventaId] || 0) + x.total; });
  const fac = {}; ventas.forEach(v => { fac[v.id] = lineas[v.id] > 0 ? (v.total - v.isv) / lineas[v.id] : 1; });
  const pm = porId_(rows_('Productos')), us = porId_(rows_('Usuarios'));
  const k = { ventas: 0, n: ventas.length, ticket: 0, isv: 0, descuentos: 0, costo: 0, bruta: 0, gastos: 0, neta: 0, margen: 0,
    credito: 0, cobros: 0, compras: 0, anuladas: 0, clientesNuevos: 0, articulos: 0 };
  const porDia = {}, gastosDia = {}, porMetodo = {}, porCat = {}, top = {}, porUsuario = {}, porHora = {};
  ventas.forEach(v => {
    k.ventas += v.total; k.isv += v.isv; k.descuentos += v.descuento; k.costo += v.costo;
    if (v.metodo === 'Crédito') k.credito += v.total - v.recibido;
    const dia = v.fecha.slice(0, 10);
    porDia[dia] = (porDia[dia] || 0) + v.total;
    porMetodo[v.metodo] = (porMetodo[v.metodo] || 0) + v.total;
    const hr = v.fecha.slice(11, 13);
    porHora[hr] = (porHora[hr] || 0) + 1;
    const x = porUsuario[v.usuarioId] || (porUsuario[v.usuarioId] = { nombre: us[v.usuarioId] ? us[v.usuarioId].nombre : '—', ventas: 0, n: 0 });
    x.ventas += v.total; x.n++;
  });
  det.forEach(i => {
    k.articulos += i.cantidad;
    const p = pm[i.productoId];
    const cat = p ? p.categoria : 'Otros';
    const neto = i.total * (fac[i.ventaId] !== undefined ? fac[i.ventaId] : 1);
    porCat[cat] = (porCat[cat] || 0) + neto;
    const key = i.productoId || ('*' + i.descripcion);
    const t = top[key] || (top[key] = { nombre: i.descripcion, cantidad: 0, total: 0, ganancia: 0 });
    t.cantidad += i.cantidad; t.total += i.total; t.ganancia += neto - i.cantidad * i.costo;
  });
  const gastosCat = {};
  rows_('Gastos').filter(g => !g.anulado && g.fechaGasto >= r.desde.slice(0, 10) && g.fechaGasto <= r.hasta.slice(0, 10)).forEach(g => {
    k.gastos += g.monto;
    gastosDia[g.fechaGasto] = (gastosDia[g.fechaGasto] || 0) + g.monto;
    gastosCat[g.categoria] = (gastosCat[g.categoria] || 0) + g.monto;
  });
  rows_('Abonos').forEach(a => { if (!a.anulado && a.fecha >= r.desde && a.fecha <= r.hasta) k.cobros += a.monto; });
  rows_('Compras').forEach(c => { if (!c.anulada && c.fecha >= r.desde && c.fecha <= r.hasta) k.compras += c.total; });
  k.anuladas = rows_('Ventas').filter(v => v.anulada && v.fecha >= r.desde && v.fecha <= r.hasta).length;
  k.clientesNuevos = rows_('Clientes').filter(c => c.creado >= r.desde && c.creado <= r.hasta).length;
  k.ticket = ventas.length ? k.ventas / ventas.length : 0;
  k.bruta = k.ventas - k.isv - k.costo;
  k.neta = k.bruta - k.gastos;
  k.margen = (k.ventas - k.isv) > 0 ? k.neta / (k.ventas - k.isv) * 100 : 0;
  Object.keys(k).forEach(x => { k[x] = r2_(k[x]); });
  const lista = o => Object.keys(o).map(c => ({ nombre: c, total: r2_(o[c]) })).sort((a, b) => b.total - a.total);
  return {
    kpi: k, porDia: porDia, gastosDia: gastosDia, porMetodo: lista(porMetodo), porCategoria: lista(porCat), gastosCategoria: lista(gastosCat),
    top: Object.keys(top).map(x => { const t = top[x]; t.total = r2_(t.total); t.ganancia = r2_(t.ganancia); t.cantidad = r3_(t.cantidad); return t; }).sort((a, b) => b.total - a.total).slice(0, 15),
    usuarios: Object.keys(porUsuario).map(x => { const o = porUsuario[x]; o.ventas = r2_(o.ventas); return o; }).sort((a, b) => b.ventas - a.ventas),
    porHora: porHora
  };
}

// Resumen por mes: ventas, ISV, costo, gastos, ganancia y cuánto de ella ya tiene destino
function resumenMeses_(fresco) {
  const cs = CacheService.getScriptCache(), key = 'RM_' + (NEG ? NEG.id : '');
  if (!fresco && !EN_LOCK) { try { const c = cs.get(key); if (c) return JSON.parse(c); } catch (e) {} }
  const r = resumenMesesCalc_();
  try { const j = JSON.stringify(r); if (j.length < 95000) cs.put(key, j, 600); } catch (e) {}
  return r;
}
function resumenMesesCalc_() {
  const m = {};
  const mes = k => m[k] || (m[k] = { mes: k, ventas: 0, isv: 0, costo: 0, gastos: 0, n: 0, nGastos: 0, asignado: 0, cuentas: 0, pagos: 0 });
  rows_('Ventas').forEach(v => { if (v.anulada || !v.fecha) return; const x = mes(v.fecha.slice(0, 7)); x.ventas += v.total; x.isv += v.isv; x.costo += v.costo; x.n++; });
  rows_('Gastos').forEach(g => { if (g.anulado || !g.fechaGasto) return; const x = mes(g.fechaGasto.slice(0, 7)); x.gastos += g.monto; x.nGastos++; });
  rows_('Distribuciones').forEach(d => { if (d.anulado) return; const x = mes(d.mes); x.asignado += d.monto; if (d.tipo === 'pago') x.pagos += d.monto; else x.cuentas += d.monto; });
  const actual = hoy_().slice(0, 7);
  return Object.keys(m).sort().reverse().map(k => {
    const x = m[k];
    ['ventas','isv','costo','gastos','asignado','cuentas','pagos'].forEach(f => { x[f] = r2_(x[f]); });
    x.utilidad = r2_(x.ventas - x.isv - x.costo - x.gastos);
    x.pendiente = r2_(Math.max(0, x.utilidad - x.asignado));
    x.enCurso = k >= actual;
    return x;
  });
}

function historial_(u) {
  req_(u, ['admin']);
  const dist = rows_('Distribuciones');
  const activos = dist.filter(d => !d.anulado);
  const uso = t => { const n = {}; activos.filter(d => d.tipo === t).forEach(d => { n[d.destino] = (n[d.destino] || 0) + 1; }); return Object.keys(n).sort((a, b) => n[b] - n[a]); };
  const total = t => { const n = {}; activos.filter(d => d.tipo === t).forEach(d => { n[d.destino] = r2_((n[d.destino] || 0) + d.monto); }); return Object.keys(n).map(k => ({ destino: k, total: n[k] })).sort((a, b) => b.total - a.total); };
  return {
    meses: resumenMeses_(true),
    distribuciones: desc_(dist, 'creado'),
    cuentas: total('cuenta'), pagos: total('pago'),
    destinos: { cuenta: uso('cuenta'), pago: uso('pago') }
  };
}

function guardarDistribucion_(u, d) {
  req_(u, ['admin']);
  const r = Object.assign({}, d.registro || {});
  delete r.id;
  r.mes = String(r.mes || '');
  if (!/^\d{4}-\d{2}$/.test(r.mes)) throw new Error('Mes no válido');
  if (r.mes >= hoy_().slice(0, 7)) throw new Error('Solo se puede decidir la ganancia de meses ya cerrados');
  r.tipo = r.tipo === 'pago' ? 'pago' : 'cuenta';
  ['destino','detalle','nota'].forEach(k => { r[k] = txt_(r[k], 120); });
  if (!r.destino) throw new Error(r.tipo === 'pago' ? 'Indica qué se va a pagar' : 'Indica a qué cuenta va el dinero');
  r.monto = r2_(r.monto);
  if (!(r.monto > 0)) throw new Error('El monto debe ser mayor a cero');
  const m = resumenMeses_().find(x => x.mes === r.mes);
  if (!m || m.utilidad <= 0) throw new Error('Ese mes no dejó ganancia para asignar');
  if (r.monto > m.pendiente + 0.001) throw new Error('El monto supera la ganancia disponible de ese mes (' + m.pendiente.toFixed(2) + ')');
  const igual = rows_('Distribuciones').find(x => !x.anulado && x.tipo === r.tipo && x.destino.toLowerCase() === r.destino.toLowerCase());
  if (igual) r.destino = igual.destino;
  r.usuarioId = u.id; r.creado = ahora_(); r.anulado = false;
  upsert_('Distribuciones', r);
  return historial_(u);
}

function anularDistribucion_(u, d) {
  req_(u, ['admin']);
  const x = rows_('Distribuciones').find(z => z.id === d.id);
  if (!x) throw new Error('El registro no existe');
  if (x.anulado) throw new Error('Ya estaba anulado');
  upsert_('Distribuciones', { id: x.id, anulado: true, nota: (x.nota ? x.nota + ' · ' : '') + 'Anulado por ' + u.nombre + ' ' + ahora_().replace('T', ' ') });
  return historial_(u);
}

// Todos los movimientos de dinero del mes, día por día
function diario_(u, d) {
  req_(u, ['admin']);
  const mes = /^\d{4}-\d{2}$/.test(String(d.mes || '')) ? d.mes : hoy_().slice(0, 7);
  const us = porId_(rows_('Usuarios')), cm = porId_(rows_('Clientes')), pv = porId_(rows_('Proveedores'));
  const det = {};
  const ventas = rows_('Ventas').filter(v => v.fecha.slice(0, 7) === mes);
  ventas.forEach(v => { det[v.id] = []; });
  rows_('VentaDetalle').forEach(x => { if (det[x.ventaId]) det[x.ventaId].push(x.descripcion + (x.cantidad !== 1 ? ' ×' + x.cantidad : '')); });
  const mov = ventas.map(v => ({ id: v.id, fecha: v.fecha, tipo: 'venta', numero: v.numero, concepto: det[v.id].join(', ') || 'Venta', categoria: 'Venta',
    tercero: v.clienteId && cm[v.clienteId] ? cm[v.clienteId].nombre : 'Consumidor final', metodo: v.metodo, usuario: us[v.usuarioId] ? us[v.usuarioId].nombre : '',
    monto: v.total, cobrado: v.metodo === 'Crédito' ? v.recibido : v.total, anulado: v.anulada }));
  rows_('Abonos').filter(a => a.fecha.slice(0, 7) === mes).forEach(a => mov.push({ id: a.id, fecha: a.fecha, tipo: 'cobro', numero: '', concepto: 'Abono a cuenta', categoria: 'Cobro',
    tercero: cm[a.clienteId] ? cm[a.clienteId].nombre : 'Cliente', metodo: a.metodo, usuario: us[a.usuarioId] ? us[a.usuarioId].nombre : '', monto: a.monto, cobrado: a.monto, anulado: a.anulado }));
  rows_('Gastos').filter(g => g.fechaGasto.slice(0, 7) === mes).forEach(g => mov.push({ id: g.id,
    fecha: g.fechaGasto + 'T' + (String(g.creado).slice(0, 10) === g.fechaGasto ? String(g.creado).slice(11, 16) : '00:00'),
    tipo: 'gasto', numero: '', concepto: g.detalle, categoria: g.categoria, tercero: g.proveedor, metodo: g.metodo, usuario: us[g.usuarioId] ? us[g.usuarioId].nombre : '',
    monto: g.monto, cobrado: g.monto, anulado: g.anulado }));
  const pj = porId_(rows_('Proyectos'));
  rows_('ProyectoGastos').filter(g => g.caja && String(g.dia).slice(0, 7) === mes).forEach(g => mov.push({ id: g.id,
    fecha: g.dia + 'T' + (String(g.creado).slice(0, 10) === g.dia ? String(g.creado).slice(11, 16) : '00:00'),
    tipo: 'gasto', numero: '', concepto: g.descripcion + (pj[g.proyectoId] ? ' · proyecto ' + pj[g.proyectoId].nombre : ''), categoria: 'Proyecto · ' + g.categoria, tercero: '', metodo: 'Efectivo',
    usuario: us[g.usuarioId] ? us[g.usuarioId].nombre : '', monto: g.monto, cobrado: g.monto, anulado: g.anulado, proyecto: true }));
  rows_('Compras').filter(c => c.fecha.slice(0, 7) === mes).forEach(c => mov.push({ id: c.id, fecha: c.fecha, tipo: 'compra', numero: c.numero, concepto: 'Compra de mercadería' + (c.factura ? ' · Fact. ' + c.factura : ''),
    categoria: 'Compra', tercero: pv[c.proveedorId] ? pv[c.proveedorId].nombre : '', metodo: c.metodo, usuario: us[c.usuarioId] ? us[c.usuarioId].nombre : '', monto: c.total, cobrado: c.metodo === 'Crédito' ? 0 : c.total, anulado: c.anulada }));
  rows_('Pagos').filter(p => p.fecha.slice(0, 7) === mes).forEach(p => mov.push({ id: p.id, fecha: p.fecha, tipo: 'pago', numero: '', concepto: 'Pago a proveedor', categoria: 'Pago',
    tercero: pv[p.proveedorId] ? pv[p.proveedorId].nombre : '', metodo: p.metodo, usuario: us[p.usuarioId] ? us[p.usuarioId].nombre : '', monto: p.monto, cobrado: p.monto, anulado: p.anulado }));
  mov.sort((a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0);
  const resumen = resumenMeses_(true).find(x => x.mes === mes) || { mes: mes, ventas: 0, isv: 0, costo: 0, gastos: 0, n: 0, utilidad: 0, pendiente: 0, asignado: 0, enCurso: mes >= hoy_().slice(0, 7) };
  return { mes: mes, movimientos: mov, resumen: resumen };
}

function inventario_(u, d) {
  req_(u, ['admin','bodega']);
  const prods = rows_('Productos').filter(p => p.tipo === 'producto');
  const desde = diasAtras_(30) + 'T00:00';
  const vend = {};
  const vids = new Set(rows_('Ventas').filter(v => !v.anulada && v.fecha >= desde).map(v => v.id));
  rows_('VentaDetalle').forEach(x => { if (vids.has(x.ventaId) && x.productoId) vend[x.productoId] = r3_((vend[x.productoId] || 0) + x.cantidad); });
  const pm = porId_(prods), us = porId_(rows_('Usuarios'));
  return {
    productos: prods.map(p => ({ id: p.id, codigo: p.codigo, nombre: p.nombre, categoria: p.categoria, stock: p.stock, stockMin: p.stockMin, costo: p.costo, precio: p.precio, activo: p.activo,
      icono: p.icono, foto: p.foto, valorCosto: r2_(Math.max(0, p.stock) * p.costo), valorVenta: r2_(Math.max(0, p.stock) * p.precio), vendidos30: vend[p.id] || 0 })),
    movimientos: desc_(rows_('Inventario'), 'fecha').slice(0, 150)
      .map(m => ({ fecha: m.fecha, tipo: m.tipo, cantidad: m.cantidad, stock: m.stock, nombre: pm[m.productoId] ? pm[m.productoId].nombre : '—', nota: m.nota, usuario: us[m.usuarioId] ? us[m.usuarioId].nombre : '' }))
  };
}

function antiguedad_(lista, campoTercero, campoFecha) {
  const h = new Date(hoy_() + 'T12:00:00').getTime(), m = {};
  lista.forEach(x => {
    const dias = Math.max(0, Math.floor((h - new Date(x[campoFecha].slice(0, 10) + 'T12:00:00').getTime()) / 86400000));
    const o = m[x[campoTercero]] || (m[x[campoTercero]] = { id: x[campoTercero], total: 0, a30: 0, a60: 0, a90: 0, mas: 0, docs: 0, antigua: '' });
    o.total += x.saldo; o.docs++;
    if (dias <= 30) o.a30 += x.saldo; else if (dias <= 60) o.a60 += x.saldo; else if (dias <= 90) o.a90 += x.saldo; else o.mas += x.saldo;
    if (!o.antigua || x[campoFecha] < o.antigua) o.antigua = x[campoFecha];
  });
  return Object.keys(m).map(k => { const o = m[k]; ['total','a30','a60','a90','mas'].forEach(f => { o[f] = r2_(o[f]); }); return o; }).sort((a, b) => b.total - a.total);
}

function cuentas_(u, d) {
  req_(u, ['admin']);
  const cm = porId_(rows_('Clientes')), pv = porId_(rows_('Proveedores'));
  const cxc = antiguedad_(rows_('Ventas').filter(v => !v.anulada && v.saldo > 0.004 && v.clienteId), 'clienteId', 'fecha')
    .map(o => { const c = cm[o.id] || {}; o.nombre = c.nombre || 'Cliente'; o.telefono = c.telefono || ''; return o; });
  const cxp = antiguedad_(rows_('Compras').filter(c => !c.anulada && c.saldo > 0.004 && c.proveedorId), 'proveedorId', 'fecha')
    .map(o => { const p = pv[o.id] || {}; o.nombre = p.nombre || 'Proveedor'; o.telefono = p.telefono || ''; return o; });
  return { cobrar: cxc, pagar: cxp };
}

/* ===================== FACTURACIÓN SAR (autoimpresor) =====================
 * Opcional: se enciende en Ajustes › Facturación SAR. Mientras esté apagada, las ventas
 * salen como comprobante (no fiscal), igual que siempre.
 * Encendida: cada venta toma el siguiente número del rango autorizado (000-001-01-00000001),
 * guarda el CAI, el rango, la fecha límite, el cliente (nombre y RTN) y el desglose del ISV.
 */
function pad3_(x) { return String(x || '').replace(/\D/g, '').padStart(3, '0').slice(-3); }
function numFactura_(cfg, n) { return pad3_(cfg.sarEst) + '-' + pad3_(cfg.sarPunto) + '-01-' + String(n).padStart(8, '0'); }

function estadoSAR_(cfg) {
  cfg = cfg || config_();
  const o = { activo: cfg.sarActivo === 'si' };
  const desde = Number(cfg.sarDesde), hasta = Number(cfg.sarHasta);
  if (!cfg.sarCai || !/^\d{14}$/.test(cfg.sarRtn) || !(desde >= 1) || !(hasta >= desde) || !/^\d{4}-\d{2}-\d{2}$/.test(cfg.sarLimite)) return Object.assign(o, { estado: 'incompleto' });
  const sig = Number(cfg.seqF) || desde;
  const dias = Math.round((new Date(cfg.sarLimite + 'T12:00:00') - new Date(hoy_() + 'T12:00:00')) / 86400000);
  Object.assign(o, { siguiente: sig <= hasta ? numFactura_(cfg, sig) : '', quedan: Math.max(0, hasta - sig + 1), usados: Math.max(0, sig - desde), total: hasta - desde + 1,
    dias: dias, limite: cfg.sarLimite, cai: cfg.sarCai, desde: numFactura_(cfg, desde), hasta: numFactura_(cfg, hasta) });
  o.estado = dias < 0 ? 'vencido' : o.quedan <= 0 ? 'agotado' : (dias <= 15 || o.quedan <= 50) ? 'aviso' : 'ok';
  return o;
}

function guardarSAR_(u, d) {
  req_(u, ['admin']);
  const cfg = config_(), r = d.registro || {};
  if (!r.activo) {
    guardarConfig_({ sarActivo: 'no' });
    const c = config_();
    return { config: sinInternos_(Object.assign({}, c)), sar: estadoSAR_(c) };
  }
  const o = {
    sarRazon: txt_(r.razon, 100) || cfg.nombre, sarRtn: String(r.rtn || '').replace(/\D/g, ''), sarDireccion: txt_(r.direccion, 160),
    sarCai: String(r.cai || '').toUpperCase().replace(/[^0-9A-Z-]/g, ''), sarEst: pad3_(r.est), sarPunto: pad3_(r.punto), sarLimite: String(r.limite || '').slice(0, 10)
  };
  const desde = parseInt(String(r.desde || '').replace(/\D/g, ''), 10), hasta = parseInt(String(r.hasta || '').replace(/\D/g, ''), 10);
  if (!/^\d{14}$/.test(o.sarRtn)) throw new Error('El RTN del negocio debe tener 14 números');
  if (!o.sarDireccion) throw new Error('Escribe la dirección del punto de emisión');
  if (!/^[0-9A-F]{6}(-[0-9A-F]{6}){4}-[0-9A-F]{2}$/.test(o.sarCai)) throw new Error('Revisa el CAI: son 37 caracteres con este formato XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XX');
  if (!(desde >= 1 && hasta >= desde && hasta <= 99999999)) throw new Error('Revisa el rango autorizado: el número final debe ser mayor o igual que el inicial');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.sarLimite)) throw new Error('Escribe la fecha límite de emisión');
  if (o.sarLimite < hoy_()) throw new Error('La fecha límite de emisión ya pasó: pide un CAI nuevo al SAR');
  o.sarDesde = String(desde); o.sarHasta = String(hasta);
  // Siguiente número: si cambió la autorización empieza en el inicio del rango
  const cambio = o.sarCai !== cfg.sarCai || o.sarDesde !== cfg.sarDesde || o.sarHasta !== cfg.sarHasta || o.sarEst !== pad3_(cfg.sarEst) || o.sarPunto !== pad3_(cfg.sarPunto);
  let sig = cambio ? desde : (Number(cfg.seqF) || desde);
  if (r.ultimo !== undefined && r.ultimo !== null && String(r.ultimo).trim() !== '') {
    const ul = parseInt(String(r.ultimo).replace(/\D/g, '').slice(-8), 10);
    if (!(ul >= desde - 1 && ul <= hasta)) throw new Error('El último número usado debe estar dentro del rango autorizado');
    sig = ul + 1;
  }
  // Nunca se repite un número ya emitido con este CAI
  const emitidas = rows_('Ventas').filter(v => v.factura && parseJ_(v.fiscal, {}).cai === o.sarCai).map(v => Number(String(v.factura).slice(-8)));
  const max = emitidas.length ? Math.max.apply(null, emitidas) : 0;
  if (sig <= max) throw new Error('Ya se emitió la factura ' + numFactura_(o, max) + ' con este CAI: el siguiente número tiene que ser mayor');
  o.seqF = String(sig);
  o.sarActivo = 'si';
  guardarConfig_(o);
  const c = config_();
  return { config: sinInternos_(Object.assign({}, c)), sar: estadoSAR_(c) };
}

// Libro de ventas del mes (para la declaración del ISV)
function libroSAR_(u, d) {
  req_(u, ['admin']);
  const mes = /^\d{4}-\d{2}$/.test(String(d.mes || '')) ? d.mes : hoy_().slice(0, 7);
  const filas = rows_('Ventas').filter(v => v.factura && String(v.fecha).slice(0, 7) === mes).map(v => {
    const f = parseJ_(v.fiscal, {});
    return { id: v.id, factura: v.factura, fecha: v.fecha, nombre: f.nombre || 'Consumidor Final', rtn: f.rtn || '', exento: f.exento || 0, exonerado: f.exonerado || 0,
      g15: f.g15 || 0, i15: f.i15 || 0, g18: f.g18 || 0, i18: f.i18 || 0, total: v.total, anulada: v.anulada, cai: f.cai || '' };
  }).sort((a, b) => a.factura < b.factura ? -1 : a.factura > b.factura ? 1 : 0);
  const tot = { exento: 0, exonerado: 0, g15: 0, i15: 0, g18: 0, i18: 0, total: 0 };
  filas.filter(x => !x.anulada).forEach(x => Object.keys(tot).forEach(k => { tot[k] += x[k]; }));
  Object.keys(tot).forEach(k => { tot[k] = r2_(tot[k]); });
  return { mes: mes, filas: filas, tot: tot, emitidas: filas.filter(x => !x.anulada).length, anuladas: filas.filter(x => x.anulada).length,
    primera: filas.length ? filas[0].factura : '', ultima: filas.length ? filas[filas.length - 1].factura : '', sar: estadoSAR_() };
}

// Total en letras para la factura: «UN MIL DOSCIENTOS TREINTA Y CINCO LEMPIRAS CON 50/100»
function letras_(x) {
  const cents = Math.round((Number(x) || 0) * 100), ent = Math.floor(cents / 100), cen = cents % 100;
  const U = ['CERO','UN','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE','DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO','DIECINUEVE',
    'VEINTE','VEINTIÚN','VEINTIDÓS','VEINTITRÉS','VEINTICUATRO','VEINTICINCO','VEINTISÉIS','VEINTISIETE','VEINTIOCHO','VEINTINUEVE'];
  const D = ['','','','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA'];
  const C = ['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS','SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS'];
  const m100 = n => n < 30 ? U[n] : D[Math.floor(n / 10)] + (n % 10 ? ' Y ' + U[n % 10] : '');
  const m1000 = n => n === 100 ? 'CIEN' : n > 100 ? C[Math.floor(n / 100)] + (n % 100 ? ' ' + m100(n % 100) : '') : m100(n);
  let s = '';
  if (!ent) s = 'CERO';
  else {
    const mill = Math.floor(ent / 1e6), mil = Math.floor(ent / 1000) % 1000, r = ent % 1000;
    if (mill) s += mill === 1 ? 'UN MILLÓN' : m1000(mill) + ' MILLONES';
    if (mil) s += (s ? ' ' : '') + (mil === 1 ? 'UN MIL' : m1000(mil) + ' MIL');
    if (r) s += (s ? ' ' : '') + m1000(r);
    if (mill && !mil && !r) s += ' DE';
  }
  return s + (ent === 1 ? ' LEMPIRA' : ' LEMPIRAS') + ' CON ' + String(cen).padStart(2, '0') + '/100';
}

// Agrega a las hojas existentes las columnas nuevas de esta versión (una vez por versión)
function asegurarEncabezados_() {
  const ss = ss_();
  Object.keys(SCHEMA).forEach(n => {
    const sh = ss.getSheetByName(n); if (!sh) { sh_(n); return; }
    const h = SCHEMA[n], ancho = Math.max(1, sh.getLastColumn());
    const actual = sh.getRange(1, 1, 1, Math.max(ancho, h.length)).getValues()[0];
    if (h.some((k, i) => actual[i] !== k)) {
      sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#d10f6f').setFontColor('#ffffff');
      h.forEach((k, i) => { if (i >= ancho && TEXTO.has(k)) sh.getRange(2, i + 1, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat('@'); });
    }
  });
  guardarConfig_({ sysVer: VERSION });
}

/* ===================== PROYECTOS =====================
 * Un proyecto junta todo lo que se gasta para producir algo (materiales, mano de obra,
 * alimentación, transporte…) y los productos finales que salen de él. Con eso calcula
 * el costo por unidad, el precio sugerido y cuánto se gana.
 */
const VERDE_PROY = 30;   // % de ganancia sobre el costo desde el que un proyecto se ve en verde
const EST_PROY = ['curso', 'terminado', 'cancelado'];

function sugerido_(x) {
  if (!(x > 0)) return 0;
  return x >= 10 ? Math.ceil(x - 1e-9) : Math.ceil(x * 2 - 1e-9) / 2;
}
function tasaProy_(cfg) { return cfg.preciosConISV !== 'no' ? (Number(cfg.isv) || 0) : 0; }

// Calcula costos, precio sugerido y ganancia de un proyecto
function calcProyecto_(p, gastos, prods, cfg) {
  const g = gastos.filter(x => !x.anulado);
  const tasa = tasaProy_(cfg);
  const costo = r2_(g.reduce((a, x) => a + x.monto, 0));
  const unidades = r3_(prods.reduce((a, x) => a + x.cantidad, 0));
  const base = prods.reduce((a, x) => a + x.cantidad * (x.peso > 0 ? x.peso : 1), 0);
  const margen = Number(p.margen) >= 0 ? Number(p.margen) : VERDE_PROY;
  let ingreso = 0, conPrecio = 0;
  const productos = prods.map(x => {
    const peso = x.peso > 0 ? x.peso : 1;
    const asignado = base > 0 ? costo * x.cantidad * peso / base : 0;
    const cu = x.cantidad > 0 ? asignado / x.cantidad : 0;
    if (x.precio > 0) { ingreso += x.precio * x.cantidad; conPrecio++; }
    return Object.assign({}, x, { peso: peso, costoAsignado: r2_(asignado), costoUnit: r4_(cu), sugerido: sugerido_(cu * (1 + margen / 100) * (1 + tasa)),
      ganUnit: x.precio > 0 ? r2_(x.precio / (1 + tasa) - cu) : null });
  });
  const conTodo = prods.length > 0 && conPrecio === prods.length && costo > 0;
  const neto = ingreso / (1 + tasa);
  const ganancia = conTodo ? r2_(neto - costo) : null;
  const pct = conTodo ? r2_(ganancia / costo * 100) : null;
  let semaforo = 'gris';
  if (pct !== null) semaforo = ganancia < 0 ? 'rojo' : pct >= VERDE_PROY ? 'verde' : 'amarillo';
  const precioProm = conTodo && unidades > 0 ? neto / unidades : 0;
  const cats = {};
  g.forEach(x => { const c = x.categoria || 'Otros'; const y = cats[c] || (cats[c] = { categoria: c, monto: 0, n: 0 }); y.monto += x.monto; y.n++; });
  return {
    costo: costo, unidades: unidades, nProductos: prods.length, nGastos: g.length, margen: margen, tasa: tasa,
    costoUnit: prods.length === 1 && unidades > 0 ? productos[0].costoUnit : null,
    sugerido: prods.length === 1 ? productos[0].sugerido : null,
    ingreso: r2_(ingreso), ingresoNeto: r2_(neto), ganancia: ganancia, pct: pct,
    margenVenta: conTodo && neto > 0 ? r2_(ganancia / neto * 100) : null, semaforo: semaforo,
    equilibrio: precioProm > 0 ? Math.ceil(costo / precioProm - 1e-9) : null,
    presupuestoPct: p.presupuesto > 0 ? r2_(costo / p.presupuesto * 100) : null,
    porCategoria: Object.keys(cats).map(k => ({ categoria: k, monto: r2_(cats[k].monto), n: cats[k].n, pct: costo > 0 ? r2_(cats[k].monto / costo * 100) : 0 }))
      .sort((a, b) => b.monto - a.monto),
    productos: productos
  };
}

function datosProyectos_() {
  const G = {}, P = {};
  rows_('ProyectoGastos').forEach(x => { (G[x.proyectoId] || (G[x.proyectoId] = [])).push(x); });
  rows_('ProyectoProductos').forEach(x => { (P[x.proyectoId] || (P[x.proyectoId] = [])).push(x); });
  return { G: G, P: P };
}

function proyectos_(u, d) {
  req_(u, ['admin','bodega']);
  const cfg = config_(), dt = datosProyectos_();
  const l = desc_(rows_('Proyectos'), 'actualizado').map(p => {
    const c = calcProyecto_(p, dt.G[p.id] || [], dt.P[p.id] || [], cfg);
    delete c.porCategoria;
    c.productos = c.productos.map(x => ({ nombre: x.nombre, cantidad: x.cantidad, unidad: x.unidad }));
    return Object.assign(p, { r: c });
  });
  return l;
}

function proyecto_(u, d) {
  req_(u, ['admin','bodega']);
  const p = rows_('Proyectos').find(x => x.id === d.id);
  if (!p) throw new Error('El proyecto ya no existe');
  const us = porId_(rows_('Usuarios'));
  const gastos = rows_('ProyectoGastos').filter(x => x.proyectoId === p.id);
  const prods = rows_('ProyectoProductos').filter(x => x.proyectoId === p.id);
  p.r = calcProyecto_(p, gastos, prods, config_());
  p.gastos = desc_(gastos.map(g => { g._k = g.dia + g.creado; g.usuario = us[g.usuarioId] ? us[g.usuarioId].nombre : ''; return g; }), '_k');
  return p;
}

function proyectoValido_(id, editable) {
  const p = rows_('Proyectos').find(x => x.id === id);
  if (!p) throw new Error('El proyecto ya no existe');
  if (editable && p.estado === 'cancelado') throw new Error('El proyecto está cancelado. Reábrelo para hacer cambios.');
  return p;
}
function tocarProyecto_(id) { upsert_('Proyectos', { id: id, actualizado: ahora_() }); }

function guardarProyecto_(u, d) {
  req_(u, ['admin','bodega']);
  const r = d.registro || {};
  const prev = r.id ? proyectoValido_(r.id) : null;
  const rec = {
    nombre: txt_(r.nombre, 80), cliente: txt_(r.cliente, 80), descripcion: txt_(r.descripcion, 300), nota: txt_(r.nota, 300),
    margen: r.margen === '' || r.margen === undefined || r.margen === null ? VERDE_PROY : r2_(r.margen),
    presupuesto: r2_(r.presupuesto) > 0 ? r2_(r.presupuesto) : 0,
    inicio: /^\d{4}-\d{2}-\d{2}$/.test(String(r.inicio || '')) ? r.inicio : (prev ? prev.inicio : hoy_()),
    actualizado: ahora_()
  };
  if (!rec.nombre) throw new Error('Escribe el nombre del proyecto');
  if (!(rec.margen >= 0 && rec.margen <= 1000)) throw new Error('El % de ganancia deseado no es válido');
  if (prev) rec.id = prev.id;
  else Object.assign(rec, { estado: 'curso', fin: '', usuarioId: u.id, creado: ahora_() });
  const p = upsert_('Proyectos', rec);
  // Al crear, se puede indicar de una vez el producto final
  if (!prev && r.producto && txt_(r.producto.nombre, 80)) {
    const cant = r3_(r.producto.cantidad);
    if (!(cant > 0)) throw new Error('Escribe la cantidad que vas a producir');
    upsert_('ProyectoProductos', { proyectoId: p.id, nombre: txt_(r.producto.nombre, 80), cantidad: cant, unidad: txt_(r.producto.unidad, 20) || 'unidad',
      peso: 1, precio: r2_(r.producto.precio) > 0 ? r2_(r.producto.precio) : 0, productoId: '', inventario: '', creado: ahora_() });
  }
  return proyecto_(u, { id: p.id });
}

function estadoProyecto_(u, d) {
  req_(u, ['admin','bodega']);
  const p = proyectoValido_(d.id);
  if (EST_PROY.indexOf(d.estado) < 0) throw new Error('Estado no válido');
  upsert_('Proyectos', { id: p.id, estado: d.estado, fin: d.estado === 'curso' ? '' : hoy_(), actualizado: ahora_() });
  return proyecto_(u, { id: p.id });
}

function duplicarProyecto_(u, d) {
  req_(u, ['admin','bodega']);
  const p = proyectoValido_(d.id);
  const n = upsert_('Proyectos', { nombre: txt_(d.nombre, 80) || (p.nombre + ' (otra vez)').slice(0, 80), cliente: p.cliente, descripcion: p.descripcion, nota: '',
    margen: p.margen, presupuesto: p.presupuesto, inicio: hoy_(), estado: 'curso', fin: '', usuarioId: u.id, creado: ahora_(), actualizado: ahora_() });
  rows_('ProyectoProductos').filter(x => x.proyectoId === p.id).forEach(x => {
    upsert_('ProyectoProductos', { proyectoId: n.id, nombre: x.nombre, cantidad: x.cantidad, unidad: x.unidad, peso: x.peso, precio: x.precio, productoId: '', inventario: '', creado: ahora_() });
  });
  let omitidos = 0;
  if (d.gastos) {
    const copia = rows_('ProyectoGastos').filter(x => x.proyectoId === p.id && !x.anulado).filter(x => { if (x.productoId) { omitidos++; return false; } return true; });
    appendRows_('ProyectoGastos', copia.map((x, i) => ({ id: newId_('ProyectoGastos') + i, proyectoId: n.id, dia: hoy_(), categoria: x.categoria, descripcion: x.descripcion,
      cantidad: x.cantidad, costoUnit: x.costoUnit, monto: x.monto, productoId: '', caja: false, usuarioId: u.id, anulado: false, creado: ahora_() })));
  }
  const r = proyecto_(u, { id: n.id });
  r.omitidos = omitidos;
  return r;
}

const CAT_PROY = ['Materiales','Mano de obra','Alimentación','Transporte','Servicios','Alquiler','Empaque','Herramientas','Publicidad','Otros'];

function gastoProyecto_(u, d) {
  req_(u, ['admin','bodega']);
  const r = d.registro || {};
  const p = proyectoValido_(r.proyectoId, true);
  const prev = r.id ? rows_('ProyectoGastos').find(x => x.id === r.id && x.proyectoId === p.id) : null;
  if (r.id && !prev) throw new Error('El gasto ya no existe');
  if (prev && prev.anulado) throw new Error('No se puede modificar un gasto anulado');
  if (prev && prev.productoId) throw new Error('El material tomado del inventario no se puede modificar. Anúlalo y regístralo de nuevo.');
  if (prev && u.rol !== 'admin' && prev.usuarioId !== u.id) throw new Error('Solo el administrador o quien lo registró puede modificarlo');
  let cat = txt_(r.categoria, 40) || 'Otros';
  const ci = CAT_PROY.find(c => c.toLowerCase() === cat.toLowerCase()); if (ci) cat = ci;
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(String(r.dia || '')) ? r.dia : hoy_();
  if (dia > hoy_()) throw new Error('La fecha no puede ser futura');
  const rec = { proyectoId: p.id, dia: dia, categoria: cat, descripcion: txt_(r.descripcion, 120), caja: !!r.caja && u.rol !== 'bodega' };
  let mover = null;
  if (!prev && r.productoId) {
    // Material tomado del inventario: sale de las existencias al costo promedio
    const pr = rows_('Productos').find(x => x.id === r.productoId);
    if (!pr) throw new Error('Ese producto ya no existe');
    if (pr.tipo !== 'producto') throw new Error('«' + pr.nombre + '» no controla existencias');
    const cant = r3_(r.cantidad);
    if (!(cant > 0)) throw new Error('Escribe la cantidad que usaste');
    if (cant > pr.stock && config_().venderSinStock !== 'si') throw new Error('Solo hay ' + pr.stock + ' de «' + pr.nombre + '» en inventario');
    const cu = pr.costo > 0 ? pr.costo : r4_(r.costoUnit);
    if (!(cu > 0)) throw new Error('«' + pr.nombre + '» no tiene costo registrado: escribe cuánto te costó cada uno');
    Object.assign(rec, { productoId: pr.id, cantidad: cant, costoUnit: cu, monto: r2_(cant * cu), descripcion: rec.descripcion || pr.nombre, caja: false });
    mover = { pid: pr.id, cant: cant };
  } else {
    const cant = r3_(r.cantidad) > 0 ? r3_(r.cantidad) : 1, cu = r4_(r.costoUnit);
    rec.cantidad = cant;
    rec.costoUnit = cu > 0 ? cu : r4_(r2_(r.monto) / cant);
    rec.monto = cu > 0 ? r2_(cant * cu) : r2_(r.monto);
    rec.productoId = '';
  }
  if (!rec.descripcion) throw new Error('Escribe qué fue el gasto');
  if (!(rec.monto > 0)) throw new Error('El monto debe ser mayor a cero');
  if (prev && (prev.caja || rec.caja) && (Math.abs(prev.monto - rec.monto) > 0.004 || !!prev.caja !== rec.caja) && idMs_(prev.id) <= ventanaCaja_().desdeMs)
    throw new Error('Este gasto ya entró en un cierre de caja. Para cambiar el monto o si se pagó con la caja, anúlalo y regístralo de nuevo.');
  if (prev) rec.id = prev.id;
  else Object.assign(rec, { usuarioId: u.id, anulado: false, creado: ahora_() });
  const g = upsert_('ProyectoGastos', rec);
  if (mover) moverStock_({ [mover.pid]: -mover.cant }, 'proyecto', g.id, u, p.nombre);
  tocarProyecto_(p.id);
  const out = proyecto_(u, { id: p.id });
  if (mover) out.catalogo = rows_('Productos');
  return out;
}

function anularGastoProyecto_(u, d) {
  req_(u, ['admin','bodega']);
  const g = rows_('ProyectoGastos').find(x => x.id === d.id);
  if (!g) throw new Error('El gasto no existe');
  if (g.anulado) throw new Error('El gasto ya está anulado');
  if (u.rol !== 'admin' && g.usuarioId !== u.id) throw new Error('Solo el administrador o quien lo registró puede anularlo');
  const p = proyectoValido_(g.proyectoId);
  upsert_('ProyectoGastos', { id: g.id, anulado: true, anulacion: marca_() });
  let prods = null;
  if (g.productoId) { moverStock_({ [g.productoId]: g.cantidad }, 'proyecto', g.id, u, 'Anulado · ' + p.nombre); prods = rows_('Productos'); }
  tocarProyecto_(p.id);
  const out = proyecto_(u, { id: p.id });
  if (prods) out.catalogo = prods;
  return out;
}

function productoProyecto_(u, d) {
  req_(u, ['admin','bodega']);
  const r = d.registro || {};
  const p = proyectoValido_(r.proyectoId, true);
  const prev = r.id ? rows_('ProyectoProductos').find(x => x.id === r.id && x.proyectoId === p.id) : null;
  if (r.id && !prev) throw new Error('El producto ya no existe');
  const rec = { proyectoId: p.id, nombre: txt_(r.nombre, 80), unidad: txt_(r.unidad, 20) || 'unidad',
    peso: r2_(r.peso) > 0 ? r2_(r.peso) : 1, precio: r2_(r.precio) > 0 ? r2_(r.precio) : 0 };
  const cant = r3_(r.cantidad);
  if (!rec.nombre) throw new Error('Escribe el nombre del producto final');
  if (prev && prev.inventario) { if (cant !== prev.cantidad) throw new Error('Este producto ya pasó al inventario: su cantidad no se puede cambiar'); }
  if (!(cant > 0)) throw new Error('Escribe la cantidad producida');
  rec.cantidad = cant;
  if (prev) rec.id = prev.id; else Object.assign(rec, { productoId: '', inventario: '', creado: ahora_() });
  upsert_('ProyectoProductos', rec);
  tocarProyecto_(p.id);
  return proyecto_(u, { id: p.id });
}

function quitarProductoProyecto_(u, d) {
  req_(u, ['admin','bodega']);
  const x = rows_('ProyectoProductos').find(y => y.id === d.id);
  if (!x) throw new Error('El producto ya no existe');
  if (x.inventario) throw new Error('Este producto ya pasó al inventario y no se puede quitar');
  proyectoValido_(x.proyectoId, true);
  deleteRow_('ProyectoProductos', x.id);
  tocarProyecto_(x.proyectoId);
  return proyecto_(u, { id: x.proyectoId });
}

// Pasa los productos finales al inventario: suben las existencias al costo calculado del proyecto
function proyectoAInventario_(u, d) {
  req_(u, ['admin','bodega']);
  const p = proyectoValido_(d.proyectoId, true);
  const det = proyecto_(u, { id: p.id });
  if (!(det.r.costo > 0)) throw new Error('Primero registra los gastos del proyecto');
  const items = Array.isArray(d.items) ? d.items : [];
  if (!items.length) throw new Error('Selecciona al menos un producto');
  // Primero se valida toda la lista (sin repetidos); después se escribe
  const vistos = {}, plan = items.map(it => {
    if (!it || typeof it !== 'object') throw new Error('Selección no válida');
    if (vistos[it.id]) throw new Error('Un producto está repetido en la lista');
    vistos[it.id] = 1;
    const x = det.r.productos.find(y => y.id === it.id);
    if (!x) throw new Error('Un producto del proyecto ya no existe');
    if (x.inventario) throw new Error('«' + x.nombre + '» ya pasó al inventario');
    const prod = it.productoId ? rows_('Productos').find(y => y.id === it.productoId) : null;
    if (it.productoId && !prod) throw new Error('El producto del inventario ya no existe');
    if (prod && prod.tipo !== 'producto') throw new Error('«' + prod.nombre + '» no controla existencias');
    return { it: it, x: x, prod: prod };
  });
  const destinos = plan.filter(z => z.prod).map(z => z.prod.id);
  if (destinos.some((id, i) => destinos.indexOf(id) !== i)) throw new Error('Dos productos del proyecto van al mismo producto del inventario. Pásalos por separado.');
  let n = 0;
  plan.forEach(z => {
    const it = z.it, x = z.x;
    const cu = x.costoUnit, precio = r2_(it.precio) > 0 ? r2_(it.precio) : (x.precio > 0 ? x.precio : x.sugerido);
    let prod = z.prod ? rows_('Productos').find(y => y.id === z.prod.id) : null;
    if (prod) {
      const st = Math.max(0, prod.stock);
      const upd = { id: prod.id, costo: r4_((st * prod.costo + x.cantidad * cu) / (st + x.cantidad)) };
      if (it.cambiarPrecio && precio > 0) upd.precio = precio;
      upsert_('Productos', upd);
    } else {
      prod = upsert_('Productos', { codigo: '', nombre: x.nombre, categoria: txt_(it.categoria, 40) || 'Producción', tipo: 'producto', unidad: x.unidad || 'unidad',
        precio: precio, costo: cu, margen: det.r.margen, stock: 0, stockMin: 0, tasaIsv: '', icono: txt_(it.icono, 4), foto: '', fotoFecha: '', descripcion: '',
        tienda: false, activo: true, creado: ahora_() });
    }
    moverStock_({ [prod.id]: x.cantidad }, 'producción', p.id, u, p.nombre);
    upsert_('ProyectoProductos', { id: x.id, productoId: prod.id, inventario: hoy_() });
    n++;
  });
  tocarProyecto_(p.id);
  const out = proyecto_(u, { id: p.id });
  out.catalogo = rows_('Productos');
  out.pasados = n;
  return out;
}

/* ===================== TIENDA EN LÍNEA (página pública) ===================== */

function tiendaNeg_(d) {
  if (MULTI_NEGOCIO) {
    const lic = negocioPorId_(String(d.negocio || ''));
    if (!lic) throw new Error('Este enlace de tienda no es válido');
    setNegocio_(lic);
    const L = licencia_();
    if (L.estado === 'vencida' || L.estado === 'bloqueada') { const c0 = config_(); throw new Error('TIENDA_CERRADA|' + JSON.stringify({ vencida: L.estado, nombre: c0.nombre, telefono: c0.telefono, tema: c0.tema, logo: c0.logo, fuente: c0.tiendaFuente, modo: c0.tiendaModo, contacto: CONTACTO_WA })); }
  } else {
    const L = licencia_();
    if (L.estado === 'vencida') { const c0 = config_(); throw new Error('TIENDA_CERRADA|' + JSON.stringify({ vencida: 'vencida', nombre: c0.nombre, telefono: c0.telefono, tema: c0.tema, logo: c0.logo, fuente: c0.tiendaFuente, modo: c0.tiendaModo, contacto: CONTACTO_WA })); }
  }
  const cfg = config_();
  if (cfg.tienda !== 'si' || !plus_()) throw new Error('TIENDA_CERRADA|' + JSON.stringify({ nombre: cfg.nombre, telefono: cfg.telefono, tema: cfg.tema, logo: cfg.logo, fuente: cfg.tiendaFuente, modo: cfg.tiendaModo }));
  return cfg;
}

function tiendaInfo_(d) {
  const cfg = tiendaNeg_(d);
  const ver = cfg.tiendaMostrarStock === 'si', sin = cfg.tiendaSinStock === 'si', nuevoDesde = diasAtras_(15);
  return {
    negocio: { nombre: cfg.nombre, gid: own_(GIROS, cfg.giro) ? cfg.giro : 'otro', giro: (own_(GIROS, cfg.giro) ? GIROS[cfg.giro] : GIROS.otro).n, eslogan: cfg.eslogan, logo: cfg.logo, tema: cfg.tema, telefono: cfg.telefono, direccion: cfg.direccion,
      moneda: cfg.moneda, mensaje: cfg.tiendaMensaje, horario: cfg.tiendaHorario, entrega: cfg.tiendaEntrega, envio: Number(cfg.tiendaEnvio) || 0,
      minimo: Number(cfg.tiendaMinimo) || 0, pagos: String(cfg.tiendaPagos || 'Efectivo').split(',').filter(Boolean), datosPago: cfg.tiendaDatosPago,
      sobre: cfg.tiendaSobre, instagram: cfg.tiendaInstagram, facebook: cfg.tiendaFacebook, mapa: cfg.tiendaMapa,
      abre: cfg.tiendaAbre, cierra: cfg.tiendaCierra, dias: cfg.tiendaDias, chat: cfg.tiendaChat !== 'no', fuente: cfg.tiendaFuente || 'elegante', modo: cfg.tiendaModo || 'auto', portada: cfg.tiendaPortada || '',
      dueno: cfg.duenoNombre ? { nombre: cfg.duenoNombre, cargo: cfg.duenoCargo, mensaje: cfg.duenoMensaje, foto: cfg.duenoFoto,
        datos: String(cfg.duenoDatos || '').split('|').map(x => x.trim()).filter(Boolean).slice(0, 3), whatsapp: cfg.duenoWhatsapp } : null },
    productos: rows_('Productos').filter(p => p.activo && p.tienda).map(p => {
      const o = { id: p.id, nombre: p.nombre, categoria: p.categoria, precio: p.precio, icono: p.icono, foto: p.foto, descripcion: p.descripcion, unidad: p.unidad, opciones: p.opciones || '' };
      if (String(p.creado).slice(0, 10) >= nuevoDesde) o.nuevo = true;
      if (p.tipo === 'producto') { o.agotado = !sin && p.stock <= 0; if (ver) o.stock = Math.max(0, p.stock); else if (!sin) o.max = Math.max(0, Math.floor(p.stock)); }
      return o;
    }).sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre)),
    hoy: hoy_()
  };
}

// Antes de esperar el candado: el negocio existe, la tienda está abierta y no hay una avalancha de pedidos
function pedirLimites_(d) {
  tiendaNeg_(d);
  if (!Array.isArray(d.items) || !d.items.length) throw new Error('Tu pedido está vacío');
  const c = CacheService.getScriptCache(), tel = String(d.telefono || '').replace(/\D/g, '');
  if (Number(c.get('PD_' + (NEG ? NEG.id : '') + tel.slice(-8)) || 0) >= 6) throw new Error('Ya hiciste varios pedidos. Si necesitas otro, escríbele al negocio por WhatsApp.');
  if (Number(c.get('PH_' + (NEG ? NEG.id : '')) || 0) >= 150) throw new Error('La tienda está recibiendo muchos pedidos. Intenta de nuevo en unos minutos.');
}

function pedir_(d) {
  const cfg = tiendaNeg_(d);
  const nombre = txt_(d.nombre, 60), tel = String(d.telefono || '').replace(/\D/g, '');
  if (nombre.length < 3) throw new Error('Escribe tu nombre');
  if (tel.length < 8) throw new Error('Escribe tu número de WhatsApp');
  const ent = cfg.tiendaEntrega || 'ambos';
  const entrega = d.entrega === 'domicilio' ? 'domicilio' : 'recoger';
  if (ent !== 'ambos' && ent !== entrega) throw new Error(entrega === 'domicilio' ? 'Este negocio no hace entregas a domicilio' : 'Este negocio solo hace entregas a domicilio');
  const direccion = txt_(d.direccion, 200);
  if (entrega === 'domicilio' && direccion.length < 5) throw new Error('Escribe la dirección de entrega');
  const c = CacheService.getScriptCache(), k = 'PD_' + (NEG ? NEG.id : '') + tel.slice(-8), n = Number(c.get(k) || 0);
  if (n >= 6) throw new Error('Ya hiciste varios pedidos. Si necesitas otro, escríbele al negocio por WhatsApp.');
  const pm = porId_(rows_('Productos'));
  const sin = cfg.tiendaSinStock === 'si' || cfg.venderSinStock === 'si';
  const lista = Array.isArray(d.items) ? d.items.slice(0, 40) : [];
  const items = [], suma = {};
  lista.forEach(i => {
    const p = i && typeof i === 'object' ? pm[i.id] : null, cant = Math.floor(Number(i && i.cantidad) || 0);
    if (!p || !p.activo || !p.tienda) throw new Error('Uno de los productos ya no está disponible. Actualiza la página.');
    if (cant < 1 || cant > 999) throw new Error('Cantidad no válida en «' + p.nombre + '»');
    suma[p.id] = (suma[p.id] || 0) + cant;
    if (p.tipo === 'producto' && !sin && p.stock < suma[p.id]) throw new Error(p.stock > 0 ? 'Solo quedan ' + Math.floor(p.stock) + ' de «' + p.nombre + '»' : '«' + p.nombre + '» se agotó');
    const op = txt_(i.opcion, 160), nom = op ? txt_(p.nombre + ' (' + op + ')', 240) : p.nombre;
    const ya = items.find(x => x.productoId === p.id && x.nombre === nom);
    if (ya) { ya.cantidad += cant; ya.total = r2_(ya.cantidad * p.precio); }
    else items.push({ productoId: p.id, nombre: nom, cantidad: cant, precio: p.precio, total: r2_(cant * p.precio) });
  });
  if (!items.length) throw new Error('Tu pedido está vacío');
  const subtotal = r2_(items.reduce((a, i) => a + i.total, 0));
  const min = Number(cfg.tiendaMinimo) || 0;
  if (min > 0 && subtotal < min) throw new Error('El pedido mínimo es de ' + money_(min, cfg));
  const envio = entrega === 'domicilio' ? r2_(Number(cfg.tiendaEnvio) || 0) : 0;
  const pagos = String(cfg.tiendaPagos || 'Efectivo').split(',');
  const pago = pagos.indexOf(d.pago) >= 0 ? d.pago : pagos[0];
  let cli = rows_('Clientes').find(x => tel8_(x.telefono) && tel8_(x.telefono) === tel.slice(-8));
  if (!cli) {
    const t8 = tel.slice(-8);
    cli = upsert_('Clientes', { nombre: nombre, telefono: tel.length === 8 || (tel.length === 11 && tel.indexOf('504') === 0) ? t8.slice(0, 4) + '-' + t8.slice(4) : '+' + tel,
      direccion: direccion, notas: 'Se registró en la tienda en línea', activo: true, limite: 0, creado: ahora_() });
  } else if (entrega === 'domicilio' && direccion && !cli.direccion) {
    upsert_('Clientes', { id: cli.id, direccion: direccion });
  }
  const p = upsert_('Pedidos', { numero: siguiente_('P'), fecha: ahora_(), nombre: nombre, telefono: tel, clienteId: cli.id, entrega: entrega, direccion: direccion,
    pago: pago, items: JSON.stringify(items), subtotal: subtotal, envio: envio, total: r2_(subtotal + envio), estado: 'nuevo', ventaId: '', nota: txt_(d.nota, 300), actualizado: ahora_() });
  c.put(k, String(n + 1), 21600);
  const kh = 'PH_' + (NEG ? NEG.id : ''); c.put(kh, String(Number(c.get(kh) || 0) + 1), 3600);
  return { id: p.id, numero: p.numero, fecha: p.fecha, total: p.total, subtotal: subtotal, envio: envio, items: items, entrega: entrega, pago: pago,
    negocio: cfg.nombre, telefonoNegocio: cfg.telefono, datosPago: pago === 'Transferencia' ? cfg.tiendaDatosPago : '' };
}

/* ===================== MENSAJES DIRECTOS (tienda ↔ negocio) =====================
 * El cliente escribe desde la tienda en línea y el negocio responde desde el programa.
 * Cada conversación tiene una clave que solo guarda el teléfono del cliente (nadie más la puede leer).
 * Las conversaciones sin mensajes nuevos en 2 meses se borran solas (una revisión al día).
 */
const DIAS_CHAT = 60;
function venceChat_(ultimo) { return Utilities.formatDate(new Date((msDeLocal_(ultimo) || Date.now()) + DIAS_CHAT * 86400000), TZ, 'yyyy-MM-dd'); }
function mensajesDe_(id) { return rows_('Mensajes').filter(m => m.chatId === id).sort((a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0); }
function chatPublico_(c) {
  return { nombre: c.nombre, producto: c.producto, productoId: c.productoId, vence: venceChat_(c.ultimo),
    mensajes: mensajesDe_(c.id).map(m => ({ id: m.id, de: m.de, texto: m.texto, fecha: m.fecha })) };
}
function chatLimites_(d) {
  const cfg = tiendaNeg_(d);
  if (cfg.tiendaChat === 'no') throw new Error('Este negocio no recibe mensajes por aquí. Escríbele por WhatsApp.');
  const c = CacheService.getScriptCache(), nid = NEG ? NEG.id : '', tel = String(d.telefono || d.clave || '').replace(/[^0-9a-z]/gi, '').slice(-12);
  if (Number(c.get('CM_' + nid + tel) || 0) >= 40) throw new Error('Enviaste muchos mensajes seguidos. Espera un rato o escríbele al negocio por WhatsApp.');
  if (Number(c.get('CN_' + nid) || 0) >= 400) throw new Error('El negocio está recibiendo muchos mensajes. Intenta de nuevo en unos minutos.');
}
function chatEnviar_(d) {
  const cfg = tiendaNeg_(d);
  if (cfg.tiendaChat === 'no') throw new Error('Este negocio no recibe mensajes por aquí. Escríbele por WhatsApp.');
  const texto = String(d.texto || '').trim().replace(/\n{3,}/g, '\n\n').slice(0, 600);
  if (!texto) throw new Error('Escribe tu mensaje');
  let c = d.clave ? rows_('Chats').find(x => x.clave === String(d.clave)) : null;
  const f = ahora_(), prod = d.productoId ? rows_('Productos').find(x => x.id === d.productoId && x.activo && x.tienda) : null;
  if (!c) {
    const nombre = txt_(d.nombre, 60); let tel = String(d.telefono || '').replace(/\D/g, '');
    if (nombre.length < 3) throw new Error('Escribe tu nombre');
    if (tel.length < 8) throw new Error('Escribe tu número de WhatsApp');
    if (tel.length === 8) tel = '504' + tel;
    const cli = rows_('Clientes').find(x => tel8_(x.telefono) && tel8_(x.telefono) === tel.slice(-8));
    c = upsert_('Chats', { telefono: tel, nombre: nombre, clienteId: cli ? cli.id : '', clave: Utilities.getUuid().replace(/-/g, ''), productoId: '', producto: '',
      ultimo: f, ultimoTexto: '', deCliente: true, sinLeer: 0, creado: f });
  }
  upsert_('Mensajes', { chatId: c.id, de: 'cliente', texto: texto, usuarioId: '', fecha: f });
  const upd = { id: c.id, ultimo: f, ultimoTexto: texto.slice(0, 120), deCliente: true, sinLeer: (Number(c.sinLeer) || 0) + 1 };
  if (prod) { upd.productoId = prod.id; upd.producto = prod.nombre; }
  c = upsert_('Chats', upd);
  const cs = CacheService.getScriptCache(), nid = NEG ? NEG.id : '', k1 = 'CM_' + nid + String(d.telefono || d.clave || '').replace(/[^0-9a-z]/gi, '').slice(-12), k2 = 'CN_' + nid;
  cs.put(k1, String(Number(cs.get(k1) || 0) + 1), 3600); cs.put(k2, String(Number(cs.get(k2) || 0) + 1), 3600);
  return Object.assign(chatPublico_(c), { clave: c.clave });
}
function chatVer_(d) {
  tiendaNeg_(d);
  const c = d.clave ? rows_('Chats').find(x => x.clave === String(d.clave)) : null;
  return c ? chatPublico_(c) : { borrado: true };
}
function chatAdmin_(c) {
  const o = Object.assign({}, c); delete o.clave; o.vence = venceChat_(c.ultimo); return o;
}
function chats_(u) {
  req_(u, ['admin', 'cajero']);
  if (config_().sysChats !== hoy_()) { try { lock_(() => limpiarChats_()); } catch (e) {} }
  return rows_('Chats').sort((a, b) => a.ultimo < b.ultimo ? 1 : a.ultimo > b.ultimo ? -1 : 0).map(chatAdmin_);
}
function chat_(u, d) {
  req_(u, ['admin', 'cajero']);
  let c = rows_('Chats').find(x => x.id === d.id);
  if (!c) throw new Error('Esta conversación ya no existe (se borra a los 2 meses)');
  if (c.sinLeer > 0) c = upsert_('Chats', { id: c.id, sinLeer: 0 });
  const us = porId_(rows_('Usuarios')), p = c.productoId ? rows_('Productos').find(x => x.id === c.productoId) : null;
  return { chat: chatAdmin_(c), mensajes: mensajesDe_(c.id).map(m => Object.assign(m, { quien: m.usuarioId && us[m.usuarioId] ? us[m.usuarioId].nombre : '' })),
    producto: p ? { id: p.id, nombre: p.nombre, precio: p.precio, stock: p.tipo === 'producto' ? p.stock : null, icono: p.icono, foto: p.foto, categoria: p.categoria } : null };
}
function chatResponder_(u, d) {
  req_(u, ['admin', 'cajero']);
  const c = rows_('Chats').find(x => x.id === d.id);
  if (!c) throw new Error('Esta conversación ya no existe (se borra a los 2 meses)');
  const texto = String(d.texto || '').trim().slice(0, 600);
  if (!texto) throw new Error('Escribe tu respuesta');
  const f = ahora_();
  upsert_('Mensajes', { chatId: c.id, de: 'negocio', texto: texto, usuarioId: u.id, fecha: f });
  upsert_('Chats', { id: c.id, ultimo: f, ultimoTexto: texto.slice(0, 120), deCliente: false, sinLeer: 0 });
  return chat_(u, d);
}
function chatBorrar_(u, d) {
  req_(u, ['admin']);
  if (!rows_('Chats').some(x => x.id === d.id)) throw new Error('Esta conversación ya no existe');
  reescribir_('Mensajes', rows_('Mensajes').filter(m => m.chatId !== d.id));
  reescribir_('Chats', rows_('Chats').filter(c => c.id !== d.id));
  return true;
}
// Borra las conversaciones sin mensajes en los últimos 2 meses (una vez al día)
function limpiarChats_(forzar) {
  const h = hoy_();
  if (!forzar && config_().sysChats === h) return 0;
  guardarConfig_({ sysChats: h });
  const lim = diasAtras_(DIAS_CHAT), chats = rows_('Chats');
  const viejos = new Set(chats.filter(c => String(c.ultimo).slice(0, 10) < lim).map(c => c.id));
  if (!viejos.size) return 0;
  reescribir_('Mensajes', rows_('Mensajes').filter(m => !viejos.has(m.chatId)));
  reescribir_('Chats', chats.filter(c => !viejos.has(c.id)));
  return viejos.size;
}
// Vuelve a escribir toda la hoja con las filas que quedan (más rápido que borrar fila por fila)
function reescribir_(name, objs) {
  const s = sh_(name), h = SCHEMA[name], n = s.getLastRow();
  if (n > 1) s.getRange(2, 1, n - 1, h.length).clearContent();
  if (objs.length) s.getRange(2, 1, objs.length, h.length).setValues(objs.map(o => h.map(k => cell_(o[k], k))));
  invalidar_(name);
}

function misPedidos_(d) {
  tiendaNeg_(d);
  const t8 = tel8_(d.telefono);
  const ids = Array.isArray(d.ids) ? d.ids.slice(0, 20) : [];
  if (!t8 || !ids.length) return [];
  return rows_('Pedidos').filter(p => ids.indexOf(p.id) >= 0 && tel8_(p.telefono) === t8)
    .map(p => ({ id: p.id, numero: p.numero, fecha: p.fecha, estado: p.estado, total: p.total, entrega: p.entrega }))
    .sort((a, b) => a.fecha < b.fecha ? 1 : -1);
}

/* ===================== INSTALACIÓN ===================== */

function instalar() {
  if (MULTI_NEGOCIO) {
    // En modo multi-negocio solo se preparan las hojas de control; cada negocio se crea al registrarse
    masterSheet_('Licencias'); masterSheet_('Accesos');
    try { carpeta_(); } catch (e) {}
    Logger.log('Listo. Publica la App web; cada negocio se registra solo desde el enlace.');
    return;
  }
  licencia_(); // en la versión de prueba, aquí empieza a contar
  instalarNegocio_({});
  Logger.log('Instalación lista. Usuario: admin · Contraseña: admin123');
}

function instalarNegocio_(op) {
  const ss = ss_();
  ss.setSpreadsheetTimeZone(TZ);
  Object.keys(SCHEMA).forEach(n => {
    // Crea las hojas que falten y actualiza encabezados si la versión nueva agregó columnas
    const sh = sh_(n), h = SCHEMA[n];
    const actual = sh.getRange(1, 1, 1, h.length).getValues()[0];
    if (h.some((k, i) => actual[i] !== k)) sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#d10f6f').setFontColor('#ffffff');
  });
  if (rows_('Config').length === 0) guardarConfig_(op.nombre ? { nombre: op.nombre, giro: op.giro || 'otro', telefono: op.telefono || '', tienda: 'si' } : {});
  if (rows_('Usuarios').length === 0) {
    const salt = Utilities.getUuid(), a = op.admin || { usuario: 'admin', nombre: 'Administrador', pin: 'admin123' };
    upsert_('Usuarios', { usuario: a.usuario, nombre: a.nombre, rol: 'admin', color: '#d10f6f',
      salt: salt, hash: hash_(a.pin, salt), activo: true, creado: ahora_() });
  }
  ['Hoja 1','Sheet1','Hoja1'].forEach(n => {
    const s = ss.getSheetByName(n);
    if (s && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });
}

/* ===================== DATOS DE EJEMPLO (solo para el modo prueba) =====================
 * No se usa en tu servidor real: el modo prueba del navegador la llama para llenar
 * un negocio ficticio con historia (ventas, compras, gastos, pedidos…).
 */
function sembrarEjemplo_(adminId) {
  let semilla = 20261011;
  const rnd = () => { semilla |= 0; semilla = semilla + 0x6D2B79F5 | 0; let t = Math.imul(semilla ^ semilla >>> 15, 1 | semilla); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const fechaHace = (dias, hh, mm) => Utilities.formatDate(new Date(Date.now() - dias * 86400000), TZ, 'yyyy-MM-dd') + 'T' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  const reloj = { f: null };
  const origAhora = ahora_;
  ahora_ = () => reloj.f || origAhora();
  RELOJ_ = reloj;
  try {
    const admin = rows_('Usuarios').find(x => x.id === adminId);
    if (MULTI_NEGOCIO && NEG) { mSet_('Licencias', NEG.lic, { plus: 'Sí' }); NEG.lic.plus = 'Sí'; CacheService.getScriptCache().remove('L_' + NEG.id); }
    else PropertiesService.getScriptProperties().setProperty('PLUS', 'activo');
    guardarConfig_({ eslogan: 'Todo lo que buscas, en un solo lugar', direccion: 'Barrio Guamilito, 5 calle, San Pedro Sula', telefono: '9999-0000',
      tienda: 'si', tiendaEnvio: '60', tiendaMinimo: '100', tiendaHorario: 'Lunes a sábado · 8:00 a. m. a 7:00 p. m.',
      tiendaMensaje: '¡Bienvenido! Arma tu pedido y te lo llevamos a tu casa o pasas a recogerlo.',
      tiendaDatosPago: 'BAC Credomatic · Cuenta 7300-1234-5 · a nombre de Sofía Hernández', fondoCaja: '500',
      tiendaSobre: 'Negocio familiar desde 2015. Ropa, belleza y regalos con precios justos y atención de casa.', tiendaInstagram: 'variedadessofia',
      tiendaMapa: 'https://maps.google.com/?q=Barrio+Guamilito+San+Pedro+Sula', tiendaAbre: '08:00', tiendaCierra: '19:00', tiendaDias: '1,2,3,4,5,6',
      duenoNombre: 'Sofía Hernández', duenoCargo: 'Propietaria', duenoMensaje: 'Cada producto lo escojo pensando en mis clientes. Si no encuentras algo, escríbeme y te lo consigo.',
      duenoDatos: '10 años de experiencia | Atención personal | San Pedro Sula' });
    // Equipo
    const wa = MULTI_NEGOCIO ? n => '504' + n : n => n;
    guardarUsuario_(admin, { registro: { usuario: wa(MULTI_NEGOCIO ? '88881111' : 'carla'), nombre: 'Carla Mejía', rol: 'cajero', color: '#1f7cff', activo: true }, clave: MULTI_NEGOCIO ? '1111' : 'carla123' });
    guardarUsuario_(admin, { registro: { usuario: wa(MULTI_NEGOCIO ? '88882222' : 'bruno'), nombre: 'Bruno Paz', rol: 'bodega', color: '#00b56e', activo: true }, clave: MULTI_NEGOCIO ? '2222' : 'bruno123' });
    const cajera = rows_('Usuarios').find(x => x.rol === 'cajero');
    // Productos
    reloj.f = fechaHace(60, 8, 0);
    const extra = [['Peluche osito','Regalos','🧸',350,190,10],['Taza decorada','Regalos','☕',150,70,18],['Cuaderno profesional','Escolar','📓',85,45,40],
      ['Gorra deportiva','Ropa','🧢',220,110,12,'Color: Negro, Azul, Rojo'],['Bocina portátil','Tecnología','🔊',890,560,5],['Envoltura de regalo','Regalos','🎁',40,10,0]];
    GIROS.variedades.ej.concat(extra).forEach((x, i) => {
      upsert_('Productos', { codigo: '750' + String(1000 + i * 37), nombre: x[0], categoria: x[1], icono: x[2], precio: x[3], costo: x[4],
        tipo: x[5] > 0 ? 'producto' : 'servicio', unidad: 'unidad', stock: 0, stockMin: x[5] > 0 ? Math.max(2, Math.round(x[5] / 4)) : 0, tasaIsv: '', foto: '',
        descripcion: '', opciones: x[6] || '', tienda: true, activo: true, creado: reloj.f });
    });
    const prods = rows_('Productos');
    const ini = {};
    prods.forEach(p => { if (p.tipo === 'producto') { const x = GIROS.variedades.ej.concat(extra).find(e => e[0] === p.nombre); ini[p.id] = x[5] * 3 + 6; } });
    moverStock_(ini, 'inicial', '', admin, 'Existencia inicial', reloj.f);
    // Clientes y proveedores
    const C = [['Ana Martínez','9876-5432','Col. Jardines del Valle, casa 14',3000],['Carlos Reyes','3345-1122','Res. Los Álamos',5000],['María José Paz','9512-7788','',0],
      ['Luis Fernández','8890-2233','Col. Trejo',2000],['Gabriela Pineda','3178-4545','',0],['Jorge Castillo','9990-1010','Barrio Paz Barahona',4000],['Daniela Castro','3221-6677','',0]]
      .map(c => upsert_('Clientes', { nombre: c[0], telefono: c[1], direccion: c[2], limite: c[3], rtn: '', correo: '', notas: '', activo: true, creado: fechaHace(55, 9, 0) }));
    const P = [['Distribuidora El Sol','2550-1000','Mario López'],['Importadora Tecno HN','2557-3300','Karla Díaz'],['Novedades Escolares','2553-8800','Pedro Rivera']]
      .map(p => upsert_('Proveedores', { nombre: p[0], telefono: p[1], contacto: p[2], rtn: '', direccion: 'San Pedro Sula', notas: '', activo: true, creado: fechaHace(58, 9, 0) }));
    const conStock = () => rows_('Productos').filter(p => p.activo && (p.tipo !== 'producto' || p.stock > 2));
    // Historia de 45 días
    for (let dia = 45; dia >= 0; dia--) {
      const n = dia === 0 ? 9 : 5 + Math.floor(rnd() * 7) + (dia % 7 === 1 ? 4 : 0);
      const horas = [];
      for (let j = 0; j < n; j++) horas.push((8 + Math.floor(rnd() * 10)) * 60 + Math.floor(rnd() * 60));
      horas.sort((x, y) => x - y);
      const ya = Number(origAhora().slice(11, 13)) * 60 + Number(origAhora().slice(14, 16));
      for (let j = 0; j < horas.length; j++) {
        if (dia === 0 && horas[j] > ya - 3) continue;
        reloj.f = fechaHace(dia, Math.floor(horas[j] / 60), horas[j] % 60);
        const disp = conStock(), items = [], usados = {};
        const k = 1 + Math.floor(rnd() * 3);
        for (let q = 0; q < k; q++) { const p = pick(disp); if (usados[p.id]) continue; usados[p.id] = 1; items.push({ productoId: p.id, cantidad: p.precio < 120 ? 1 + Math.floor(rnd() * 3) : 1 }); }
        const r = rnd(), cli = rnd() < 0.55 ? pick(C) : null;
        let metodo = r < 0.58 ? 'Efectivo' : r < 0.74 ? 'Tarjeta' : r < 0.9 ? 'Transferencia' : 'Crédito';
        if (metodo === 'Crédito' && (!cli || !cli.limite)) metodo = 'Efectivo';
        try {
          venta_(rnd() < 0.6 ? cajera : admin, { items: items, clienteId: cli ? cli.id : '', metodo: metodo, recibido: metodo === 'Crédito' ? 0 : '', descuento: rnd() < 0.08 ? 20 : 0 });
        } catch (e) { /* sin crédito disponible o sin stock: se omite */ }
      }
      if (dia % 10 === 3) { // compra de mercadería
        reloj.f = fechaHace(dia, 10, 15);
        const prov = pick(P), lista = rows_('Productos').filter(p => p.tipo === 'producto').sort((a, b) => a.stock - b.stock).slice(0, 4);
        compra_(admin, { proveedorId: prov.id, factura: '000-001-01-' + String(1200 + dia), metodo: dia > 20 ? 'Efectivo' : 'Crédito',
          items: lista.map(p => ({ productoId: p.id, cantidad: 6 + Math.floor(rnd() * 10), costo: p.costo })) });
      }
      if (dia % 9 === 4) { // abonos de clientes
        reloj.f = fechaHace(dia, 16, 20);
        const deudores = clientesConSaldo_().filter(c => c.saldo > 0);
        if (deudores.length) { const c = pick(deudores); abono_(admin, { clienteId: c.id, monto: r2_(Math.min(c.saldo, 200 + Math.floor(rnd() * 6) * 100)), metodo: 'Efectivo' }); }
      }
    }
    // Pago a un proveedor
    reloj.f = fechaHace(6, 11, 0);
    const deudas = proveedoresConSaldo_().filter(p => p.saldo > 0);
    if (deudas.length) pago_(admin, { proveedorId: deudas[0].id, monto: r2_(deudas[0].saldo / 2), metodo: 'Transferencia', nota: 'Abono a factura' });
    // Gastos
    const G = [];
    [0, 1, 2].forEach(m => {
      const base = new Date(Date.now() - m * 30 * 86400000);
      const mes = Utilities.formatDate(base, TZ, 'yyyy-MM');
      G.push([mes + '-01', 'Alquiler', 'Alquiler del local', 'Inversiones Romero', 6500, 'Transferencia']);
      G.push([mes + '-05', 'Servicios', 'Energía eléctrica', 'ENEE', 1150 + m * 60, 'Efectivo']);
      G.push([mes + '-06', 'Servicios', 'Internet', 'Tigo', 890, 'Tarjeta']);
      G.push([mes + '-15', 'Planilla', 'Pago quincenal', '', 4500, 'Transferencia']);
      G.push([mes + '-28', 'Planilla', 'Pago quincenal', '', 4500, 'Transferencia']);
      G.push([mes + '-10', 'Publicidad', 'Redes sociales', 'Meta', 600, 'Tarjeta']);
      G.push([mes + '-12', 'Insumos', 'Bolsas y empaques', 'Distribuidora El Sol', 350, 'Efectivo']);
    });
    const inicioHist = fechaHace(45, 0, 0).slice(0, 10);
    G.forEach(g => {
      if (g[0] > hoy_() || g[0] < inicioHist) return;
      reloj.f = g[0] + 'T09:30';
      guardarGasto_(admin, { registro: { fechaGasto: g[0], categoria: g[1], detalle: g[2], proveedor: g[3], monto: g[4], metodo: g[5], nota: '' } });
    });
    reloj.f = null;
    // Cierre de caja de ayer
    reloj.f = fechaHace(1, 19, 5);
    const desde = fechaHace(1, 7, 0), mk = msDeLocal_(reloj.f) + 59999, k = cajaCalc_({ desdeMs: msDeLocal_(desde), hastaMs: mk });
    upsert_('Cierres', { desde: desde, hasta: reloj.f + ':59', usuarioId: cajera.id, fondo: 500, ventas: k.ventas, cobros: k.cobros, gastos: r2_(k.gastos + k.compras), pagos: k.pagos,
      esperado: r2_(500 + k.ventas + k.cobros - k.gastos - k.pagos - k.compras), contado: r2_(500 + k.ventas + k.cobros - k.gastos - k.pagos - k.compras - 20), diferencia: -20, nota: 'Faltaron L 20 de cambio', marca: String(mk) });
    // Pedidos en línea
    const pe = (hace, cli, lista, entrega, estado) => {
      reloj.f = Utilities.formatDate(new Date(Date.now() - hace * 60000), TZ, "yyyy-MM-dd'T'HH:mm");
      const its = lista.map(([nom, cant]) => { const p = rows_('Productos').find(x => x.nombre === nom); return { productoId: p.id, nombre: p.nombre, cantidad: cant, precio: p.precio, total: r2_(p.precio * cant) }; });
      const sub = r2_(its.reduce((a, i) => a + i.total, 0)), env = entrega === 'domicilio' ? 60 : 0;
      return upsert_('Pedidos', { numero: siguiente_('P'), fecha: reloj.f, nombre: cli.nombre, telefono: '504' + cli.telefono.replace(/\D/g, ''), clienteId: cli.id, entrega: entrega,
        direccion: entrega === 'domicilio' ? (cli.direccion || 'Col. Moderna, 3 calle') : '', pago: entrega === 'domicilio' ? 'Efectivo' : 'Transferencia', items: JSON.stringify(its),
        subtotal: sub, envio: env, total: r2_(sub + env), estado: estado, ventaId: '', nota: '', actualizado: reloj.f });
    };
    pe(185, C[4], [['Mochila escolar', 1], ['Cuaderno profesional', 3]], 'recoger', 'listo');
    pe(95, C[2], [['Termo de acero 750 ml', 1], ['Taza decorada', 2]], 'recoger', 'confirmado');
    pe(31, C[3], [['Perfume Brisa 100 ml', 1]], 'recoger', 'nuevo');
    pe(12, C[6], [['Set de maquillaje', 1], ['Peluche osito', 1], ['Envoltura de regalo', 1]], 'domicilio', 'nuevo');
    pe(4, C[0], [['Camiseta básica', 2], ['Audífonos inalámbricos', 1]], 'domicilio', 'nuevo');
    // Mensajes directos desde la tienda
    const hace = m => Utilities.formatDate(new Date(Date.now() - m * 60000), TZ, "yyyy-MM-dd'T'HH:mm");
    const ch = (cli, prod, msgs) => {
      const p = prod ? rows_('Productos').find(x => x.nombre === prod) : null, ult = msgs[msgs.length - 1];
      let sin = 0; for (let i = msgs.length - 1; i >= 0 && msgs[i][1] === 'cliente'; i--) sin++;
      reloj.f = hace(msgs[0][0]);
      const c = upsert_('Chats', { telefono: '504' + cli.telefono.replace(/\D/g, ''), nombre: cli.nombre, clienteId: cli.id, clave: Utilities.getUuid().replace(/-/g, ''),
        productoId: p ? p.id : '', producto: p ? p.nombre : '', ultimo: hace(ult[0]), ultimoTexto: ult[2].slice(0, 120), deCliente: ult[1] === 'cliente', sinLeer: sin, creado: reloj.f });
      msgs.forEach(([m, de, t]) => { reloj.f = hace(m); upsert_('Mensajes', { chatId: c.id, de: de, texto: t, usuarioId: de === 'negocio' ? admin.id : '', fecha: reloj.f }); });
    };
    ch(C[0], 'Camiseta básica', [[18, 'cliente', 'Hola, ¿la camiseta negra talla M la tienen disponible?'], [10, 'negocio', '¡Hola! Sí, me quedan 4 en talla M. ¿Te la aparto?'], [9, 'cliente', 'Sí por favor, paso hoy en la tarde 🙌']]);
    ch(C[5], '', [[52, 'cliente', 'Buenas, ¿hacen envíos a Choloma?'], [50, 'cliente', '¿Cuánto sale el envío?']]);
    ch(C[3], 'Perfume Brisa 100 ml', [[1500, 'cliente', '¿El perfume viene también en 50 ml?'], [1440, 'negocio', 'Por ahora solo en 100 ml, pero la otra semana nos llega el de 50 ml 😊'], [1430, 'cliente', 'Perfecto, muchas gracias']]);
    // Ganancia de hace dos meses ya distribuida
    const meses = resumenMeses_().filter(m => !m.enCurso && m.utilidad > 0);
    if (meses.length > 1) {
      const m2 = meses[meses.length - 1];
      reloj.f = m2.mes + '-28T18:00';
      upsert_('Distribuciones', { mes: m2.mes, tipo: 'cuenta', destino: 'Ahorro', detalle: 'Fondo de emergencia', monto: r2_(m2.utilidad * 0.4), usuarioId: admin.id, nota: '', anulado: false, creado: reloj.f });
      upsert_('Distribuciones', { mes: m2.mes, tipo: 'pago', destino: 'Retiro de la dueña', detalle: '', monto: r2_(m2.utilidad * 0.6), usuarioId: admin.id, nota: '', anulado: false, creado: reloj.f });
    }
    // Proyectos (uno en cada color del semáforo y uno sin precio todavía)
    const proy = (dias, reg, gastos, estado) => {
      reloj.f = fechaHace(dias, 9, 0);
      reg.inicio = reloj.f.slice(0, 10);
      const p = guardarProyecto_(admin, { registro: reg });
      gastos.forEach((g, i) => {
        const dd = Math.max(0, dias - (g[6] || i));
        reloj.f = fechaHace(dd, 10 + (i % 7), 15);
        const prod = g[5] ? rows_('Productos').find(x => x.nombre === g[5]) : null;
        const r = { proyectoId: p.id, dia: reloj.f.slice(0, 10), categoria: g[0], descripcion: g[1], cantidad: g[2], costoUnit: g[3], caja: !!g[4] };
        if (prod && prod.stock >= g[2]) r.productoId = prod.id;
        gastoProyecto_(bodega || admin, { registro: r });
      });
      if (estado) { reloj.f = fechaHace(Math.max(0, dias - gastos.length - 2), 17, 0); estadoProyecto_(admin, { id: p.id, estado: estado }); }
      return p;
    };
    const bodega = rows_('Usuarios').find(x => x.rol === 'bodega');
    // Compras de material para los proyectos
    [[27, 'Taza decorada', 24, 70], [19, 'Camiseta básica', 30, 140]].forEach(c => {
      reloj.f = fechaHace(c[0], 9, 30);
      const pr = rows_('Productos').find(x => x.nombre === c[1]);
      compra_(bodega || admin, { proveedorId: P[0].id, metodo: 'Efectivo', factura: 'F-' + (8800 + c[0]), items: [{ productoId: pr.id, cantidad: c[2], costo: c[3] }] });
    });
    proy(26, { nombre: 'Canastas navideñas', cliente: 'Agrícola del Valle', descripcion: 'Canastas con taza, dulces y tarjeta para los empleados', margen: 35, presupuesto: 6000,
      producto: { nombre: 'Canasta navideña', cantidad: 40, unidad: 'unidad', precio: 220 } }, [
      ['Materiales', 'Canastas de mimbre', 40, 45], ['Materiales', 'Taza decorada', 15, 70, false, 'Taza decorada'], ['Empaque', 'Papel celofán y moños', 1, 520],
      ['Mano de obra', 'Ayudante para armar (2 días)', 2, 400], ['Alimentación', 'Almuerzo del equipo', 1, 300, true], ['Empaque', 'Etiquetas personalizadas', 40, 6],
      ['Transporte', 'Flete de entrega', 1, 450]]);
    proy(40, { nombre: 'Kits escolares Escuela Morazán', cliente: 'Escuela Francisco Morazán', descripcion: 'Precio acordado con la escuela', margen: 30,
      producto: { nombre: 'Kit escolar', cantidad: 60, unidad: 'unidad', precio: 185 } }, [
      ['Materiales', 'Útiles escolares al por mayor', 60, 112], ['Empaque', 'Bolsas con logo', 60, 9], ['Mano de obra', 'Armado de kits', 1, 600],
      ['Transporte', 'Entrega en la escuela', 1, 350], ['Alimentación', 'Refrigerio el día de la entrega', 1, 180]], 'terminado');
    proy(18, { nombre: 'Camisetas Club Deportivo Real', cliente: 'Club Deportivo Real', descripcion: 'Camisetas estampadas con número', margen: 30,
      producto: { nombre: 'Camiseta estampada', cantidad: 25, unidad: 'unidad', precio: 260 } }, [
      ['Materiales', 'Camiseta básica', 25, 140, false, 'Camiseta básica'], ['Servicios', 'Estampado frente y número', 25, 85], ['Publicidad', 'Diseño del escudo', 1, 500],
      ['Transporte', 'Ida al taller de estampado', 1, 150]]);
    const dm = proy(3, { nombre: 'Arreglos Día de la Madre', descripcion: 'Arreglo con peluche y flores para vender en la tienda', margen: 40, presupuesto: 4500,
      producto: { nombre: 'Arreglo con peluche', cantidad: 30, unidad: 'unidad' } }, [
      ['Materiales', 'Peluches pequeños', 30, 60], ['Materiales', 'Flores artificiales', 1, 900], ['Alimentación', 'Café y pan para la tarde de armado', 1, 120]]);
    reloj.f = fechaHace(2, 15, 0);
    productoProyecto_(admin, { registro: { proyectoId: dm.id, nombre: 'Tarjeta con dedicatoria', cantidad: 30, unidad: 'unidad', peso: 0.15 } });
  } finally { ahora_ = origAhora; RELOJ_ = null; }
  return true;
}

