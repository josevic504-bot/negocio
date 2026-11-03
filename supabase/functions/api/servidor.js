/*****************************************************************
 * GESTIÓN DE NEGOCIO VM · Servidor sobre Supabase
 * Ejecuta el mismo Codigo.gs de siempre. Los servicios de Google se simulan:
 *  - SpreadsheetApp: cada hoja es una tabla de Supabase. Al empezar se cargan las tablas que pide
 *    la acción; si el código pide otra que no está, se carga y la acción se repite desde cero (nada se guardó aún).
 *  - Al terminar se comparan las tablas con lo que se cargó y se guarda solo lo que cambió, todo junto
 *    en una transacción. Si otro equipo del mismo negocio guardó mientras tanto, se repite la acción.
 *  - CacheService → tabla Cache · PropertiesService → tabla Propiedades · DriveApp → Storage (fotos)
 *****************************************************************/

export function crearServidor(SRC, db, opciones = {}) {
  const log = opciones.log || (() => {});
  const Q = v => typeof v === 'string' && v[0] === "'" ? v.slice(1) : v; // como Sheets: el apóstrofo inicial solo marca texto
  const TZ = 'America/Tegucigalpa';

  /* ---------- Fechas y utilidades (Utilities) ---------- */
  const partes = (d, tz) => {
    const p = {};
    new Intl.DateTimeFormat('en-CA', { timeZone: tz || TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).forEach(x => { p[x.type] = x.value; });
    return p;
  };
  function formatDate(d, tz, fmt) {
    const p = partes(d instanceof Date ? d : new Date(d), tz);
    const T = { yyyy: p.year, yy: p.year.slice(2), MM: p.month, dd: p.day, HH: p.hour, mm: p.minute, ss: p.second };
    let out = '', i = 0;
    while (i < fmt.length) {
      if (fmt[i] === "'") { const j = fmt.indexOf("'", i + 1); out += fmt.slice(i + 1, j < 0 ? fmt.length : j); i = j < 0 ? fmt.length : j + 1; continue; }
      const tok = ['yyyy', 'yy', 'MM', 'dd', 'HH', 'mm', 'ss'].find(t => fmt.startsWith(t, i));
      if (tok) { out += T[tok]; i += tok.length; } else { out += fmt[i]; i++; }
    }
    return out;
  }
  const b64 = bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b & 255); return btoa(s); };
  const Utilities = {
    DigestAlgorithm: { SHA_256: 'SHA-256' }, Charset: { UTF_8: 'UTF-8' },
    computeDigest: (alg, txt) => Array.from(opciones.sha256(new TextEncoder().encode(String(txt)))).map(b => b > 127 ? b - 256 : b),
    base64Encode: x => (x && x.__b64 !== undefined) ? x.__b64 : typeof x === 'string' ? b64(new TextEncoder().encode(x)) : b64(x),
    base64Decode: s => ({ __b64: String(s) }),
    newBlob: (data, mime, name) => {
      const blob = { data: data && data.__b64 !== undefined ? data.__b64 : b64(new TextEncoder().encode(String(data))), mime, name,
        getContentType: () => blob.mime, getName: () => blob.name, setName: n => { blob.name = n; return blob; },
        // HTML → PDF (contratos): el PDF se arma después, al subir el archivo
        getAs: m => { if (m === 'application/pdf' && /html/.test(mime) && typeof data === 'string') return Object.assign({}, blob, { mime: m, html: data, setName: n => { blob.name = n; return Object.assign({}, blob, { mime: m, html: data }); } }); return blob; } };
      return blob;
    },
    getUuid: () => crypto.randomUUID(),
    formatDate,
    sleep: () => {}
  };

  /* ---------- Estado de una petición ---------- */
  // R: lo que se cargó de Supabase (no se toca); C: la corrida actual (copias que el código modifica)
  let R = null, C = null;
  class Falta extends Error { constructor(q) { super('__FALTA__'); this.q = q; } }
  const falta = q => { C.faltan.push(q); throw new Falta(q); };

  let SCHEMA = null, SCHEMA_M = null, NUMS = null, BOOLS = null, SOLO_FECHA = null;
  const claves = (t, maestra) => t === 'Accesos' ? ['negocioId', 'usuarioId'] : t === 'Config' && !maestra ? ['clave'] : ['id'];

  // Tabla → cuadrícula como la de Sheets (fila 1 = encabezados)
  function aCuadricula(t, filas, maestra) {
    const h = (maestra ? SCHEMA_M : SCHEMA)[t];
    return [h.slice()].concat(filas.map(o => h.map(k => o[k] === undefined || o[k] === null ? '' : o[k])));
  }
  const copia = g => g.map(r => r.slice());

  function negDeHoja(hojaId) {
    if (C.libros[hojaId]) return C.libros[hojaId].neg;
    const lic = (R.mFilas.Licencias || []).find(l => l.hojaId === hojaId) ||
      (C.m.Licencias ? C.m.Licencias.slice(1).map(r => ({ id: r[0], hojaId: r[SCHEMA_M.Licencias.indexOf('hojaId')] })).find(l => l.hojaId === hojaId) : null);
    return lic ? lic.id : null;
  }
  function cuadricula(libro, t) {
    if (libro.maestra) {
      if (!C.m[t]) { if (!R.m[t]) falta({ m: t }); C.m[t] = copia(R.m[t]); C.tocadas.m.add(t); }
      return C.m[t];
    }
    const neg = libro.neg, k = neg + '|' + t;
    if (!C.n[k]) {
      if (libro.nuevo) C.n[k] = aCuadricula(t, [], false);
      else { const N = R.n[neg]; if (!N || !N.t[t]) falta({ n: neg, t }); C.n[k] = copia(N.t[t]); }
      C.tocadas.n.add(k);
    }
    return C.n[k];
  }

  function Rango(libro, nombre, r, c, nr, nc) {
    const g = () => cuadricula(libro, nombre);
    const enc = () => ((libro.maestra ? SCHEMA_M : SCHEMA)[nombre] || []).slice();
    // La fila 1 son los encabezados: se responden sin cargar la tabla
    const soloEnc = r === 1 && nr === 1;
    this.getValue = () => { if (soloEnc) return enc()[c - 1] === undefined ? '' : enc()[c - 1]; const row = g()[r - 1] || []; const v = row[c - 1]; return v === undefined || v === null ? '' : v; };
    this.setValue = v => { const rs = g(); while (rs.length < r) rs.push([]); (rs[r - 1] = rs[r - 1] || [])[c - 1] = Q(v); return this; };
    this.getValues = () => { if (soloEnc) { const h = enc(), o = []; for (let j = 0; j < nc; j++) o.push(h[c - 1 + j] === undefined ? '' : h[c - 1 + j]); return [o]; } const rs = g(), out = []; for (let i = 0; i < nr; i++) { const row = rs[r - 1 + i] || [], o = []; for (let j = 0; j < nc; j++) { const v = row[c - 1 + j]; o.push(v === undefined || v === null ? '' : v); } out.push(o); } return out; };
    this.setValues = v => { if (soloEnc) return this; const rs = g(); while (rs.length < r - 1 + v.length) rs.push([]); v.forEach((row, i) => { const t = rs[r - 1 + i] || (rs[r - 1 + i] = []); row.forEach((x, j) => { t[c - 1 + j] = Q(x); }); }); return this; };
    this.clearContent = () => { const rs = g(); for (let i = 0; i < nr; i++) { const t = rs[r - 1 + i]; if (t) for (let j = 0; j < nc; j++) t[c - 1 + j] = ''; } return this; };
    this.createTextFinder = txt => { const tf = { matchEntireCell: () => tf, matchCase: () => tf, findNext: () => { const rs = g(); for (let i = 0; i < nr; i++) { const row = rs[r - 1 + i]; if (row && String(row[c - 1] === undefined || row[c - 1] === null ? '' : row[c - 1]) === txt) return { getRow: () => r + i }; } return null; } }; return tf; };
    this.getRow = () => r; this.getNumRows = () => nr;
    ['setFontWeight', 'setBackground', 'setFontColor', 'setNumberFormat', 'setDataValidation', 'setFontSize', 'setHorizontalAlignment'].forEach(m => { this[m] = () => this; });
  }
  function Hoja(libro, nombre) {
    const g = () => cuadricula(libro, nombre);
    const ultima = () => { const r = g(); let k = r.length; while (k > 0 && (r[k - 1] || []).every(v => v === '' || v === null || v === undefined)) k--; return k; };
    const ancho = () => ((libro.maestra ? SCHEMA_M : SCHEMA)[nombre] || []).length;
    this.getName = () => nombre;
    this.hideSheet = () => this;
    this.getLastRow = () => ultima();
    this.getMaxRows = () => Math.max(1000, g().length);
    this.getLastColumn = () => ancho();
    this.getMaxColumns = () => Math.max(26, ancho());
    this.insertColumnsAfter = () => this;
    this.getRange = (r, c, nr, nc) => new Rango(libro, nombre, r, c, nr || 1, nc || 1);
    this.setFrozenRows = () => {};
    this.appendRow = row => {
      // Agregar al final de una hoja maestra grande (visitas, mensajes) no necesita leerla
      if (libro.maestra && !C.m[nombre] && !R.m[nombre]) { (C.mApp[nombre] = C.mApp[nombre] || []).push(row.map(Q)); return this; }
      const rs = g(); rs.length = ultima(); rs.push(row.map(Q)); return this; };
    this.insertRowsAfter = () => this;
    this.deleteRow = r => { g().splice(r - 1, 1); };
    this.getSheetId = () => nombre;
  }
  function Libro(libro) {
    const lista = () => Object.keys(libro.maestra ? SCHEMA_M : SCHEMA);
    return {
      getId: () => libro.id,
      getName: () => libro.nombre || libro.id,
      getSheetByName: n => lista().indexOf(n) >= 0 ? new Hoja(libro, n) : null,
      insertSheet: n => { if (lista().indexOf(n) < 0) log('Hoja desconocida (no se guarda): ' + n); return new Hoja(libro, n); },
      getSheets: () => lista().map(n => new Hoja(libro, n)),
      deleteSheet: () => {},
      setSpreadsheetTimeZone: () => {},
      getUrl: () => ''
    };
  }
  const validacion = { requireValueInList: () => validacion, build: () => ({}) };
  const SpreadsheetApp = {
    getActiveSpreadsheet: () => Libro({ maestra: true, id: 'principal' }),
    openById: id => {
      const neg = negDeHoja(String(id));
      if (!neg) throw new Error('No se encontró la hoja del negocio');
      const nuevo = C.libros[id] && C.libros[id].nuevo;
      return Libro({ id: String(id), neg, nuevo });
    },
    create: nombre => {
      const id = 'S' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
      // El negocio queda ligado a esta «hoja» cuando su ficha aparece en Licencias (se resuelve al guardar)
      const libro = { id, neg: '@' + id, nuevo: true, nombre };
      C.libros[id] = libro;
      return Libro(libro);
    },
    newDataValidation: () => validacion,
    flush: () => {}
  };

  /* ---------- Caché (CacheService) ---------- */
  // Estas claves solo aceleraban la lectura de hojas en Apps Script: aquí no hacen falta
  const SIN_CACHE = ['H_', 'VH_', 'W_', 'L_', 'RM_'];
  const sinCache = k => SIN_CACHE.some(p => String(k).indexOf(p) === 0);
  const cache = {
    get: k => {
      k = String(k); if (sinCache(k)) return null;
      if (k in C.cache) { const x = C.cache[k]; return x && x.e > Date.now() ? x.v : null; }
      // Clave no cargada: casi siempre está vacía (contadores de intentos, límites, visitas). Se supone vacía y
      // se comprueba al guardar, en la misma consulta; si resultó tener valor, la acción se repite con el valor real.
      if (!(k in R.c)) { C.supuestos[k] = 1; return null; }
      const x = R.c[k]; return x && x.e > Date.now() ? x.v : null;
    },
    getAll: ks => { const o = {}; (ks || []).forEach(k => { const v = cache.get(k); if (v !== null) o[k] = v; }); return o; },
    put: (k, v, s) => {
      k = String(k); if (sinCache(k)) return; s = Math.min(Number(s) || 600, 21600);
      // La sesión se renueva en cada acción: si el valor es el mismo y le queda casi todo el tiempo, no se vuelve a guardar (ahorra una escritura por clic)
      const prev = (k in C.cache) ? C.cache[k] : R.c[k];
      if (prev && prev.v === String(v) && s >= 3600 && prev.e - Date.now() > (s - 3600) * 1000) return;
      C.cache[k] = { v: String(v), e: Date.now() + s * 1000 }; C.cacheOps.push({ op: 'put', k, v: String(v), s }); },
    putAll: (o, s) => Object.keys(o || {}).forEach(k => cache.put(k, o[k], s)),
    remove: k => { k = String(k); if (sinCache(k)) return; C.cache[k] = null; C.cacheOps.push({ op: 'del', k }); },
    removeAll: ks => (ks || []).forEach(k => cache.remove(k))
  };
  const CacheService = { getScriptCache: () => cache };

  /* ---------- Propiedades, candado, correo, Drive, internet ---------- */
  const props = {
    getProperty: k => { k = String(k); if (k in C.props) return C.props[k]; const v = R.props[k]; return v === undefined ? null : v; },
    setProperty: (k, v) => { C.props[String(k)] = String(v); return props; },
    deleteProperty: k => { C.props[String(k)] = null; return props; },
    getProperties: () => Object.assign({}, R.props, C.props)
  };
  const PropertiesService = { getScriptProperties: () => props };
  const candado = { waitLock: () => {}, tryLock: () => true, releaseLock: () => {}, hasLock: () => true };
  const LockService = { getScriptLock: () => candado };
  const Logger = { log: m => log(String(m)) };
  const ContentService = { createTextOutput: t => ({ setMimeType: () => t, getContent: () => t }), MimeType: { JSON: 'json', TEXT: 'text' } };
  const MailApp = { sendEmail: o => { C.efectos.push({ correo: o }); }, getRemainingDailyQuota: () => 100 };
  const Session = { getEffectiveUser: () => ({ getEmail: () => opciones.correo || '' }), getScriptTimeZone: () => TZ };
  const disparador = { timeBased: () => disparador, everyDays: () => disparador, everyHours: () => disparador, atHour: () => disparador, nearMinute: () => disparador, everyMinutes: () => disparador, create: () => ({}) };
  const ScriptApp = { getProjectTriggers: () => [], deleteTrigger: () => {}, newTrigger: () => disparador };
  const UrlFetchApp = {
    fetch: (url) => {
      url = String(url);
      if (!(url in R.web)) falta({ u: url });
      const w = R.web[url];
      return { getContentText: () => w.texto, getResponseCode: () => w.codigo };
    }
  };
  // Fotos y archivos: se suben a Supabase Storage después de guardar; el «id» del archivo es su dirección pública
  const carpeta = nombre => ({
    getName: () => nombre,
    createFile: blob => {
      const ruta = (C.negActual() || 'general') + '/' + crypto.randomUUID() + (/png/.test(blob.mime) ? '.png' : /webp/.test(blob.mime) ? '.webp' : /pdf/.test(blob.mime) ? '.pdf' : '.jpg');
      C.efectos.push({ subir: { ruta, mime: blob.mime, b64: blob.html ? '' : blob.data, html: blob.html || '' } });
      const url = opciones.urlArchivo(ruta);
      return { getId: () => url, getUrl: () => url, setSharing: () => {}, setName: () => {}, moveTo: () => {} };
    },
    getFoldersByName: n => ({ hasNext: () => true, next: () => carpeta(n) }),
    createFolder: n => carpeta(n)
  });
  const DriveApp = {
    Access: { ANYONE_WITH_LINK: 1 }, Permission: { VIEW: 1 },
    getFoldersByName: n => ({ hasNext: () => true, next: () => carpeta(n) }),
    createFolder: n => carpeta(n),
    getRootFolder: () => carpeta('raiz'),
    getFileById: id => {
      const ruta = opciones.rutaDeUrl ? opciones.rutaDeUrl(String(id)) : null;
      const neg = ruta ? ruta.split('/')[0] : '';
      return {
        getId: () => id, moveTo: () => {}, setSharing: () => {},
        setTrashed: v => { if (v && ruta) C.efectos.push({ borrar: ruta }); },
        // La carpeta de fotos de un negocio termina en «(ID)»: así fotoPropia_ reconoce las fotos de cada negocio
        getParents: () => { let x = !!ruta; return { hasNext: () => x, next: () => { x = false; return carpeta('Fotos (' + neg + ')'); } }; }
      };
    }
  };

  /* ---------- Compilar Codigo.gs una sola vez ---------- */
  const TAREAS = ['resumenPanelDiario', 'limpiarFotosTodos'];
  const EXP = ['route_', 'SCHEMA', 'SCHEMA_M', 'NUMS', 'BOOLS', 'SOLO_FECHA', 'NEG_', 'LIMPIAR_', 'VERSION', 'ESQUEMA', 'RECORDATORIOS_'].concat(TAREAS);
  // Resumen de las 7 a. m. de cada negocio: usa las mismas funciones de la app (avisos del día, saldos y existencias)
  const RECORD_SRC = `
function RECORDATORIOS_(ids) {
  var out = [];
  ids.forEach(function (id) {
    try {
      Object.keys(MEMO).forEach(function (k) { if (k.indexOf('_m_') !== 0) delete MEMO[k]; });
      var l = negocioPorId_(id); if (!l) return;
      setNegocio_(l);
      // Recordatorio del pago de la licencia (unos días antes y mientras esté pendiente)
      try { var cb = cobroDe_(l); if (cb && (cb.vencidas.length || (cb.proxima && cb.proxima.f <= addDiasIso_(hoy_(), 3)))) {
        var ml = function (n) { return money_(n, { moneda: 'L' }); };
        out.push({ neg: id, tipo: 'licencia', titulo: '💳 Pago de tu licencia', cuerpo: (cb.vencidas.length ? 'Tienes un pago pendiente de ' + ml(cb.total) : 'Tu pago de ' + ml(cb.proxima.m) + ' vence el ' + cb.proxima.f.slice(8, 10) + '/' + cb.proxima.f.slice(5, 7)) + ' · Toca para enviar tu comprobante' }); } } catch (e) { if (e && e.message === '__FALTA__') throw e; }
      try { bloquearSiVence_(); } catch (e) { if (e && e.message === '__FALTA__') throw e; return; }
      var cfg = config_(), a = avisosDia_(), p = [];
      var pl = function (n, uno, varios) { return n === 1 ? uno : n + ' ' + varios; };
      if (a.susHoy) p.push(pl(a.susHoy, '1 suscripción vence hoy', 'suscripciones vencen hoy'));
      if (a.susVenc) p.push(pl(a.susVenc, '1 suscripción ya venció', 'suscripciones ya vencieron'));
      if (a.citasHoy) p.push(pl(a.citasHoy, '1 cita hoy', 'citas hoy'));
      if (a.encHoy) p.push(pl(a.encHoy, '1 entrega hoy', 'entregas hoy'));
      if (a.ordAtras) p.push(pl(a.ordAtras, '1 orden atrasada', 'órdenes atrasadas'));
      if (a.vacHoy) p.push(pl(a.vacHoy, '1 vacuna toca hoy', 'vacunas tocan hoy'));
      if (a.cotHoy) p.push(pl(a.cotHoy, '1 pago de proyecto hoy', 'pagos de proyectos hoy'));
      if (a.cotAtras) p.push(pl(a.cotAtras, '1 pago de proyecto atrasado', 'pagos de proyectos atrasados'));
      if (a.cadVenc) p.push(pl(a.cadVenc, '1 producto vencido', 'productos vencidos'));
      var sal = saldosClientes_(), ks = Object.keys(sal), tot = 0;
      ks.forEach(function (k) { tot += sal[k]; });
      if (ks.length) p.push('te deben ' + money_(tot, cfg) + ' (' + pl(ks.length, '1 cliente', 'clientes') + ')');
      var ago = rows_('Productos').filter(function (x) { return x.activo && x.tipo === 'producto' && x.stock <= 0; }).length;
      if (ago) p.push(pl(ago, '1 producto agotado', 'productos agotados'));
      var ped = rows_('Pedidos').filter(function (x) { return x.estado === 'nuevo'; }).length;
      if (ped) p.push(pl(ped, '1 pedido sin confirmar', 'pedidos sin confirmar'));
      if (!p.length) return;
      var t = p.join(' · ');
      out.push({ neg: id, titulo: '☀️ Tu día en ' + (cfg.nombre || l.negocio || 'tu negocio'), cuerpo: t.charAt(0).toUpperCase() + t.slice(1) });
    } catch (e) { if (e && e.message === '__FALTA__') throw e; Logger.log('recordatorio ' + id + ': ' + e); }
  });
  return out;
}`;
  const B = new Function('SpreadsheetApp', 'Utilities', 'CacheService', 'LockService', 'Logger', 'ContentService', 'PropertiesService', 'DriveApp', 'MailApp', 'Session', 'ScriptApp', 'UrlFetchApp',
    SRC + RECORD_SRC + '\nfunction NEG_(){return NEG;}\nfunction LIMPIAR_(){Object.keys(MEMO).forEach(function(k){delete MEMO[k];});NEG=null;}\nreturn {' + EXP.map(n => n + ':' + n).join(',') + '};')(
    SpreadsheetApp, Utilities, CacheService, LockService, Logger, ContentService, PropertiesService, DriveApp, MailApp, Session, ScriptApp, UrlFetchApp);
  SCHEMA = B.SCHEMA; SCHEMA_M = B.SCHEMA_M; NUMS = B.NUMS; BOOLS = B.BOOLS; SOLO_FECHA = B.SOLO_FECHA;

  /* ---------- Normalizar valores para guardar (igual que obj_ y mRows_ al leer) ---------- */
  function fechaTxt(v, k) { return formatDate(v, TZ, k === 'mes' ? 'yyyy-MM' : SOLO_FECHA.has(k) ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm"); }
  function valor(v, k, maestra) {
    if (maestra) {
      if (k === 'activo') return !(v === false || v === 'false' || v === 'FALSE');
      if (v instanceof Date) return k === 'version' ? '' : formatDate(v, TZ, k === 'vencePrueba' || k === 'desde' || k === 'hasta' ? 'yyyy-MM-dd' : 'yyyy-MM-dd HH:mm');
      return v === null || v === undefined ? '' : String(Q(v));
    }
    if (v instanceof Date) v = fechaTxt(v, k);
    if (NUMS.has(k)) { const n = Number(v); return isFinite(n) ? n : 0; }
    if (BOOLS.has(k)) return v === true || v === 'true' || v === 'TRUE' || v === 1 || v === 'SI';
    return v === null || v === undefined ? '' : String(Q(v));
  }
  function filaObj(h, r, maestra) { const o = {}; h.forEach((k, i) => { o[k] = valor(r[i], k, maestra); }); return o; }

  // Diferencias entre lo cargado y lo que quedó: insertar, actualizar (solo columnas cambiadas) y borrar
  function diferencias(t, antes, despues, maestra, neg) {
    const h = (maestra ? SCHEMA_M : SCHEMA)[t], ks = claves(t, maestra), ki = ks.map(k => h.indexOf(k));
    const llave = r => ki.map(i => String(r[i] === undefined || r[i] === null ? '' : Q(r[i]))).join('\u0001');
    const mapa = g => { const m = new Map(); g.slice(1).forEach(r => { if (!r) return; const kk = llave(r); if (ki.every(i => r[i] !== '' && r[i] !== undefined && r[i] !== null) && !m.has(kk)) m.set(kk, r); }); return m; };
    const A = mapa(antes), D = mapa(despues), ops = [], base = maestra ? {} : { n: neg };
    const kObj = r => { const o = {}; ks.forEach((k, j) => { o[k] = String(Q(r[ki[j]])); }); return o; };
    A.forEach((r, kk) => { if (!D.has(kk)) ops.push(Object.assign({ t, op: 'del', k: kObj(r) }, base)); });
    D.forEach((r, kk) => {
      const nuevo = filaObj(h, r, maestra);
      if (!A.has(kk)) { ops.push(Object.assign({ t, op: 'ins', k: kObj(r), row: nuevo }, base)); return; }
      const viejo = filaObj(h, A.get(kk), maestra), cambio = {};
      h.forEach(k => { if (viejo[k] !== nuevo[k]) cambio[k] = nuevo[k]; });
      if (Object.keys(cambio).length) ops.push(Object.assign({ t, op: 'upd', k: kObj(r), row: cambio }, base));
    });
    // Orden: borrar, actualizar y luego insertar (las nuevas quedan al final, como en la hoja)
    const ord = { del: 0, upd: 1, ins: 2 };
    return ops.sort((a, b) => ord[a.op] - ord[b.op]);
  }

  /* ---------- Qué tablas suele pedir cada acción (se aprende solo) ---------- */
  const APRENDIDO = {};
  const MAPA = opciones.mapa || crearMapa(SRC);
  const BASE_M = ['Licencias', 'Accesos'];
  const BASE_N = ['Usuarios', 'Config'];

  // Cada petición lleva sus propios datos (Rq): varias peticiones pueden estar esperando a la base de datos a la vez
  async function cargar(R, p) {
    const t = Date.now();
    const r = await db.cargar(p);
    R.tLeer = (R.tLeer || 0) + (Date.now() - t);
    Object.keys(r.m || {}).forEach(t => { R.m[t] = aCuadricula(t, r.m[t], true); R.mFilas[t] = r.m[t]; });
    Object.keys(r.n || {}).forEach(neg => {
      const N = R.n[neg] || (R.n[neg] = { v: r.n[neg]._v, t: {} });
      Object.keys(r.n[neg]).forEach(t => { if (t !== '_v') N.t[t] = aCuadricula(t, r.n[neg][t], false); });
    });
    Object.assign(R.c, r.c || {});
    if (r.props) R.props = r.props;
    if (r.sesionNeg) R.sesionNeg = r.sesionNeg;
    R.viajes++;
  }

  /* Importación desde Google (fase 5): el script Exportar.gs del Apps Script manda cada hoja; la tabla del negocio se reemplaza completa */
  const PROPS_INTERNAS = ['IMPORTAR_CLAVE', 'TAREAS_CLAVE', 'EXP_HECHOS', 'EXP_INICIO', 'MIGRADO', 'VAPID_PUBLICA', 'VAPID_PRIVADA', 'RT_SECRETO'];
  async function importar(im, Rq) {
    if (!Rq.props.IMPORTAR_CLAVE || im.clave !== Rq.props.IMPORTAR_CLAVE) return { ok: false, error: 'Clave de importación no válida' };
    const ops = [], props = {};
    Object.keys(im.props || {}).forEach(k => { if (PROPS_INTERNAS.indexOf(k) < 0) props[k] = String(im.props[k]); });
    const t = String(im.tabla || ''), maestra = !!(t && SCHEMA_M[t]);
    if (t) {
      if (!maestra && !SCHEMA[t]) return { ok: false, error: 'Tabla desconocida: ' + t };
      if (!maestra && !/^N[0-9A-Z]{4,20}$/.test(String(im.negocio || ''))) return { ok: false, error: 'Falta el negocio' };
      const h = maestra ? SCHEMA_M[t] : SCHEMA[t], ks = claves(t, maestra), base = maestra ? {} : { n: String(im.negocio) };
      if (im.limpiar) ops.push(Object.assign({ t, op: 'del', k: {} }, base));
      (im.filas || []).forEach(o => {
        const fila = filaObj(h, h.map(k => o[k]), maestra);
        if (ks.some(k => fila[k] === '')) return;
        const k = {}; ks.forEach(x => { k[x] = String(fila[x]); });
        ops.push(Object.assign({ t, op: 'ins', k, row: fila }, base));
      });
    }
    await db.aplicar({ ops, props });
    const n = ops.filter(o => o.op === 'ins').length;
    log('importar ' + (t || 'propiedades') + (im.negocio ? ' ' + im.negocio : '') + ' · ' + n + ' filas');
    return { ok: true, data: { tabla: t, filas: n, propiedades: Object.keys(props).length } };
  }

  /* ---------- Avisos con la app cerrada (Web Push) y cambios al instante (Realtime) ---------- */
  const hex = b => Array.from(b).map(x => (x & 255).toString(16).padStart(2, '0')).join('');
  // Canal del negocio: nombre secreto (no se adivina), solo avisa QUÉ tablas cambiaron, nunca los datos
  const canal = (Rq, neg) => Rq.props.RT_SECRETO && neg ? 'n' + hex(opciones.sha256(new TextEncoder().encode(Rq.props.RT_SECRETO + '|' + neg))).slice(0, 32) : '';
  const vigente = (Rq, k) => { const x = Rq.c[k]; return x && x.e > Date.now() ? x.v : null; };
  const objFila = (g, id, col) => {
    if (!g) return null; const h = g[0], i = h.indexOf(col || 'id'); if (i < 0) return null;
    const r = g.slice(1).find(r => r && String(Q(r[i])) === String(id)); if (!r) return null;
    const o = {}; h.forEach((k, j) => { o[k] = r[j] === undefined || r[j] === null ? '' : Q(r[j]); }); return o;
  };
  const corto = (t, n) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  async function avisosPush(body, Rq) {
    if (!db.push) return { ok: false, error: 'Los avisos aún no están listos en el servidor' };
    const d = body.data || {}, accion = body.action;
    let neg = '', uid = '';
    if (body.panel && vigente(Rq, 'P_' + body.panel)) neg = '_panel';
    else if (body.token) { const v = vigente(Rq, 'S_' + body.token); const p = v ? v.split('|') : []; if (p[3] === 'ver') return { ok: false, error: 'Modo soporte: los avisos no se activan aquí' }; if (p.length >= 3) { neg = p[0]; uid = p[1]; } }
    if (!neg) return { ok: false, error: body.panel ? 'PANEL' : 'SESION' };
    const sub = d.sub || {}, ep = String(sub.endpoint || d.endpoint || '');
    if (!/^https:\/\/[^\s]{10,900}$/.test(ep)) return { ok: false, error: 'Este equipo no dio un permiso de avisos válido' };
    if (accion === 'pushQuitar') { await db.push({ quitar: { endpoint: ep, negocio: neg } }); return { ok: true, data: true }; }
    if (accion === 'pushProbar') {
      await db.efecto({ push: { endpoint: ep, negocio: neg, tipo: 'prueba', titulo: '¡Listo! Los avisos funcionan', cuerpo: 'Te avisaremos aquí aunque la app esté cerrada.', vista: 'inicio', url: neg === '_panel' ? 'panel' : '' }, vapid: { pub: Rq.props.VAPID_PUBLICA, priv: Rq.props.VAPID_PRIVADA } });
      return { ok: true, data: true };
    }
    const k = sub.keys || {}, ok = x => typeof x === 'string' && /^[A-Za-z0-9_=-]{8,200}$/.test(x);
    if (!ok(k.p256dh) || !ok(k.auth)) return { ok: false, error: 'Este equipo no dio un permiso de avisos válido' };
    const apag = (Array.isArray(d.apagados) ? d.apagados : []).map(x => String(x).replace(/[^a-z]/g, '').slice(0, 20)).filter(Boolean).slice(0, 20).join(',');
    await db.push({ guardar: { endpoint: ep, negocio: neg, usuario: uid, p256dh: k.p256dh, auth: k.auth, apagados: apag } });
    log('avisos guardados ' + neg);
    return { ok: true, data: { llave: Rq.props.VAPID_PUBLICA || '' } };
  }
  /* ---------- Respaldos de cada negocio y copiar productos entre negocios (Panel) ----------
   * Respaldos (lista) y RespaldoDatos (la copia completa en JSON) son tablas por negocio que el Codigo.gs no usa.
   * Copia diaria automática (tarea respaldosDia, 2 a. m.): se guardan 7 diarias, 4 semanales y 4 manuales/«antes de restaurar». */
  const HERR = ['panelRespaldos', 'panelRespaldoHacer', 'panelRespaldoRestaurar', 'panelRespaldoDatos', 'panelCopiarInfo', 'panelCopiarProductos'];
  const GUARDA = { diario: 7, semanal: 4, manual: 4, antes: 4 };
  const ahoraHN = () => new Date(Date.now() - 6 * 3600000).toISOString().slice(0, 16).replace('T', ' ');
  const rid = p => p + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 46656).toString(36).toUpperCase().padStart(3, '0');
  const sinFila = o => { const y = Object.assign({}, o); delete y._fila; return y; };
  const negValido = x => /^N[0-9A-Z]{4,20}$/.test(String(x || ''));
  const cuentaN = (l, f) => (l || []).filter(f || (() => true)).length;
  const activoP = p => !(p.activo === false || p.activo === 'false');
  async function hacerRespaldo(neg, tipo, lic) {
    const tabs = Object.keys(SCHEMA);
    const r = await db.cargar({ n: { [neg]: tabs.concat(['Respaldos']) } }), x = r.n[neg] || {};
    const datos = {}; let filas = 0;
    tabs.forEach(t => { const f = (x[t] || []).map(sinFila); if (f.length) { datos[t] = f; filas += f.length; } });
    const txt = JSON.stringify(datos), id = rid('R'), fecha = ahoraHN();
    const res = { productos: cuentaN(x.Productos, activoP), clientes: cuentaN(x.Clientes), ventas: cuentaN(x.Ventas, v => !v.anulada) };
    const ops = [
      { t: 'Respaldos', op: 'ins', k: { id }, n: neg, row: { id, fecha, tipo, kb: Math.round(txt.length / 102.4) / 10, filas, resumen: JSON.stringify(res) } },
      { t: 'RespaldoDatos', op: 'ins', k: { id }, n: neg, row: { id, datos: txt } }];
    // Se guardan solo los más recientes de cada tipo
    (x.Respaldos || []).filter(o => o.tipo === tipo).sort((a, b) => a.fecha < b.fecha ? 1 : -1).slice(GUARDA[tipo] - 1).forEach(o => {
      ops.push({ t: 'Respaldos', op: 'del', k: { id: o.id }, n: neg }, { t: 'RespaldoDatos', op: 'del', k: { id: o.id }, n: neg });
    });
    // Números para la salud del negocio en el Panel
    const st = { nProductos: String(res.productos), nClientes: String(res.clientes) };
    if (tipo === 'diario' || tipo === 'semanal') st.respaldo = fecha.slice(0, 10);
    if (lic !== false) ops.push({ t: 'Licencias', op: 'upd', k: { id: neg }, row: st });
    await db.aplicar({ ops });
    return { id, fecha, tipo, kb: ops[0].row.kb, filas, resumen: res };
  }
  const listaR = async neg => ((await db.cargar({ n: { [neg]: ['Respaldos'] } })).n[neg] || {}).Respaldos || [];
  const verLista = l => l.map(o => { let r = {}; try { r = JSON.parse(o.resumen || '{}'); } catch (e) {} return { id: o.id, fecha: o.fecha, tipo: o.tipo, kb: Number(o.kb) || 0, filas: Number(o.filas) || 0, resumen: r }; }).sort((a, b) => a.fecha < b.fecha ? 1 : -1);
  async function datosR(neg, id) {
    const g = ((await db.cargar({ n: { [neg]: ['RespaldoDatos'] } })).n[neg] || {}).RespaldoDatos || [];
    const o = g.find(x => x.id === id); if (!o) throw new Error('Ese respaldo ya no existe');
    return JSON.parse(o.datos || '{}');
  }
  const ALCANCE = { productos: ['Productos'], clientes: ['Clientes'] };
  async function restaurar(neg, id, alcance, Rq) {
    const datos = await datosR(neg, id);
    const antes = await hacerRespaldo(neg, 'antes');
    const tabs = ALCANCE[alcance] || Object.keys(SCHEMA);
    for (let i = 0; i < 4; i++) {
      const v = ((await db.cargar({ n: { [neg]: [] } })).n[neg] || {})._v || 0, ops = [];
      tabs.forEach(t => {
        ops.push({ t, op: 'del', k: {}, n: neg });
        const ks = claves(t, false);
        (datos[t] || []).forEach(row => { const k = {}; ks.forEach(c => { k[c] = String(row[c] === undefined || row[c] === null ? '' : row[c]); }); ops.push({ t, op: 'ins', k, n: neg, row }); });
      });
      const r = await db.aplicar({ ops, v: { [neg]: v } });
      if (r && r.conflicto) continue;
      const cn = canal(Rq, neg); if (cn) await db.efecto({ rt: { canal: cn, t: tabs, dev: '' } });
      log('restaurado ' + neg + ' ' + id + ' ' + (alcance || 'todo'));
      return { tablas: tabs.length, filas: ops.filter(o => o.op === 'ins').length, antes: antes.id };
    }
    throw new Error('El negocio está guardando cambios en este momento. Intenta de nuevo en un minuto.');
  }
  const b64de = buf => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };
  async function copiarFoto(url, neg) {
    const ruta = opciones.rutaDeUrl ? opciones.rutaDeUrl(String(url)) : null;
    if (!ruta) return String(url).indexOf('data:') === 0 ? url : '';
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) }); if (!r.ok) return '';
      const mime = r.headers.get('content-type') || 'image/jpeg', nueva = neg + '/' + crypto.randomUUID() + (/png/.test(mime) ? '.png' : /webp/.test(mime) ? '.webp' : '.jpg');
      await db.efecto({ subir: { ruta: nueva, mime, b64: b64de(await r.arrayBuffer()) } });
      return opciones.urlArchivo(nueva);
    } catch (e) { log('foto no copiada ' + e); return ''; }
  }
  async function copiarProductos(d, Rq) {
    const de = String(d.de || ''), a = String(d.a || '');
    if (!negValido(de) || !negValido(a) || de === a) throw new Error('Elige un negocio de origen y otro de destino');
    const r = await db.cargar({ n: { [de]: ['Productos'], [a]: ['Productos'] } });
    const cats = Array.isArray(d.cats) ? d.cats.map(String) : null;
    const src = ((r.n[de] || {}).Productos || []).filter(p => activoP(p) && (!cats || cats.indexOf(String(p.categoria || '')) >= 0));
    const ya = {}; ((r.n[a] || {}).Productos || []).forEach(p => { ya[String(p.nombre).trim().toLowerCase()] = 1; });
    const nuevos = src.filter(p => !ya[String(p.nombre).trim().toLowerCase()]).slice(0, 1500), hoy = ahoraHN().replace(' ', 'T');
    const filas = [];
    for (let i = 0; i < nuevos.length; i += 6) {
      await Promise.all(nuevos.slice(i, i + 6).map(async p => {
        const o = sinFila(p); o.id = rid('P'); o.creado = hoy; o.codigo = p.codigo || '';
        if (!d.costos) { o.costo = 0; o.margen = 0; }
        if (!d.existencias) {
          o.stock = 0;
          let V = p.variantes; try { if (typeof V === 'string') V = V ? JSON.parse(V) : null; } catch (e) { V = null; }
          if (V && typeof V === 'object') { Object.keys(V).forEach(k => { if (V[k] && typeof V[k] === 'object') V[k].s = 0; }); o.variantes = typeof p.variantes === 'string' ? JSON.stringify(V) : V; }
        }
        if (d.fotos && p.foto) { o.foto = await copiarFoto(p.foto, a); o.fotoFecha = o.foto ? hoy : ''; } else { o.foto = ''; o.fotoFecha = ''; }
        filas.push(o);
      }));
    }
    for (let i = 0; i < 4; i++) {
      const v = ((await db.cargar({ n: { [a]: [] } })).n[a] || {})._v || 0;
      const res = await db.aplicar({ ops: filas.map(o => ({ t: 'Productos', op: 'ins', k: { id: o.id }, n: a, row: o })), v: { [a]: v } });
      if (res && res.conflicto) continue;
      const cn = canal(Rq, a); if (cn && filas.length) await db.efecto({ rt: { canal: cn, t: ['Productos'], dev: '' } });
      log('copiados ' + filas.length + ' productos ' + de + ' → ' + a);
      return { copiados: filas.length, omitidos: src.length - nuevos.length, fotos: filas.filter(o => o.foto).length };
    }
    throw new Error('El negocio está guardando cambios en este momento. Intenta de nuevo en un minuto.');
  }
  async function respaldosDia(Rq) {
    const hoy = ahoraHN().slice(0, 10), dom = new Date(hoy + 'T12:00:00Z').getUTCDay() === 0;
    const lics = ((await db.cargar({ m: ['Licencias'] })).m.Licencias || []).filter(l => negValido(l.id) && ['eliminada', 'duplicada'].indexOf(String(l.estado).toLowerCase()) < 0);
    const dias = f => { const t = Date.parse(String(f || '').slice(0, 10) + 'T12:00:00Z'); return isFinite(t) ? (Date.parse(hoy + 'T12:00:00Z') - t) / 86400000 : 999; };
    const pend = lics.filter(l => l.respaldo !== hoy && (!l.respaldo || dias(l.ultimaConexion) <= 10)).slice(0, Number(Rq.props.RESPALDOS_LOTE) || 12);
    let n = 0;
    for (const l of pend) { try { await hacerRespaldo(l.id, dom ? 'semanal' : 'diario'); n++; } catch (e) { log('respaldo ' + l.id + ': ' + e); } }
    log('respaldos del día: ' + n + ' de ' + pend.length);
    return { ok: true, data: { hechos: n, pendientes: pend.length } };
  }
  async function herramientas(body, Rq) {
    if (body.tarea === 'respaldosDia') {
      if (!Rq.props.TAREAS_CLAVE || body.clave !== Rq.props.TAREAS_CLAVE) return { ok: false, error: 'Tarea no permitida' };
      return respaldosDia(Rq);
    }
    if (!body.panel || !vigente(Rq, 'P_' + body.panel)) return { ok: false, error: 'PANEL' };
    const d = body.data || {}, a = body.action;
    try {
      if (a === 'panelCopiarProductos') return { ok: true, data: await copiarProductos(d, Rq) };
      if (a === 'panelCopiarInfo') {
        if (!negValido(d.de)) throw new Error('Elige el negocio de origen');
        const ps = (((await db.cargar({ n: { [d.de]: ['Productos'] } })).n[d.de] || {}).Productos || []).filter(activoP), c = {};
        ps.forEach(p => { const k = String(p.categoria || ''); c[k] = (c[k] || 0) + 1; });
        return { ok: true, data: { total: ps.length, fotos: ps.filter(p => p.foto).length, cats: Object.keys(c).sort().map(k => ({ cat: k, n: c[k] })) } };
      }
      const neg = String(d.id || '');
      if (!negValido(neg)) throw new Error('Negocio no válido');
      if (a === 'panelRespaldos') return { ok: true, data: verLista(await listaR(neg)) };
      if (a === 'panelRespaldoHacer') return { ok: true, data: await hacerRespaldo(neg, 'manual') };
      if (a === 'panelRespaldoDatos') return { ok: true, data: await datosR(neg, String(d.rid || '')) };
      if (a === 'panelRespaldoRestaurar') return { ok: true, data: await restaurar(neg, String(d.rid || ''), String(d.alcance || 'todo'), Rq) };
    } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
    return { ok: false, error: 'Acción desconocida' };
  }
  // Qué avisar según lo que se acaba de guardar
  function avisosDe(ops, Rq, Cq) {
    const out = [], money = (neg, n) => {
      const g = Cq.n[neg + '|Config'] || (Rq.n[neg] && Rq.n[neg].t.Config), m = objFila(g, 'moneda', 'clave');
      return (m && m.valor || 'L') + ' ' + (Number(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };
    const tablaN = (neg, t) => Cq.n[neg + '|' + t] || (Rq.n[neg] && Rq.n[neg].t[t]);
    const tablaM = t => Cq.m[t] || Rq.m[t];
    ops.forEach(o => {
      // El cliente mandó el comprobante de pago de un pedido que ya existía
      if (o.op === 'upd' && o.t === 'Pedidos' && o.n && o.row && o.row.comprobante && o.row.pagoEstado === 'revisar') {
        const pe = objFila(tablaN(o.n, 'Pedidos'), o.k && o.k.id) || {};
        out.push({ negocio: o.n, tipo: 'pedidos', titulo: '💳 Comprobante de pago' + (pe.numero ? ' · ' + pe.numero : ''), cuerpo: corto((pe.nombre || 'Un cliente') + ' envió su comprobante' + (pe.total ? ' · ' + money(o.n, pe.total) : ''), 140), vista: 'pedidos', tag: 'comp-' + (o.k && o.k.id) });
        return;
      }
      // Vic: el negocio mandó el comprobante del pago de su licencia
      if (o.op === 'upd' && o.t === 'CuotasLic' && !o.n && o.row && o.row.compEstado === 'revisar') {
        const cu = objFila(tablaM('CuotasLic'), o.k && o.k.id) || {}, li = objFila(tablaM('Licencias'), cu.negocioId) || {};
        out.push({ negocio: '_panel', tipo: 'pagos', titulo: '💳 Pago de licencia · ' + corto(li.negocio || 'Un negocio', 40), cuerpo: corto((cu.concepto || 'Pago') + ' · L ' + (Number(cu.monto) || 0).toFixed(2) + ' · envió su comprobante', 140), url: 'panel', tag: 'lic-' + (cu.negocioId || '') });
        return;
      }
      if (o.op !== 'ins' || !o.row) return;
      const r = o.row;
      if (o.t === 'Pedidos' && o.n) {
        let n = 0; try { n = (JSON.parse(r.items || '[]') || []).reduce((s, x) => s + (Number(x.cantidad) || 1), 0); } catch (e) {}
        out.push({ negocio: o.n, tipo: 'pedidos', titulo: '🛍️ ¡Nuevo pedido en línea!', cuerpo: corto((r.nombre || 'Un cliente') + ' · ' + (n === 1 ? '1 producto' : n + ' productos') + ' · ' + money(o.n, r.total) + (r.comprobante ? ' · con comprobante de pago' : ''), 140), vista: 'pedidos' });
      } else if (o.t === 'Mensajes' && o.n && r.de === 'cliente') {
        const ch = objFila(tablaN(o.n, 'Chats'), r.chatId);
        out.push({ negocio: o.n, tipo: 'mensajes', titulo: '💬 Mensaje nuevo en tu tienda', cuerpo: corto((ch && ch.nombre ? ch.nombre + ': ' : '') + (r.texto || '📷 Foto'), 140), vista: 'mensajes', tag: 'msg-' + r.chatId });
      } else if (o.t === 'SoporteMsg' && !o.n) {
        const ch = objFila(tablaM('Soporte'), r.chatId);
        if (r.de === 'cli') out.push({ negocio: '_panel', tipo: 'soporte', titulo: '🆘 Soporte · ' + corto(ch && ch.negocio || r.quien || 'Un negocio', 40), cuerpo: corto(r.texto || '📷 Foto', 140), url: 'panel', tag: 'sop-' + r.chatId });
        else if (r.de === 'adm' && ch && ch.negocioId) out.push({ negocio: ch.negocioId, tipo: 'soporte', titulo: '💬 El administrador te respondió', cuerpo: corto(r.texto || 'Ábrelo en Ayuda › Contactar al administrador', 140), vista: 'inicio' });
      } else if (o.t === 'Anuncios' && !o.n && String(r.canales).indexOf('push') >= 0) {
        String(r.destinos || '').split(',').filter(Boolean).forEach(neg => out.push({ negocio: neg, tipo: 'anuncio', titulo: '📣 ' + corto(r.titulo || 'Gestión de Negocio VM', 50), cuerpo: corto(r.texto, 160), vista: 'inicio', tag: 'an-' + r.id }));
      } else if (o.t === 'Licencias' && !o.n) {
        out.push({ negocio: '_panel', tipo: 'registros', titulo: '🎉 Nuevo registro: ' + corto(r.negocio || 'Negocio', 50), cuerpo: corto([r.dueno, r.giro, r.origen ? 'llegó por ' + r.origen : ''].filter(Boolean).join(' · '), 140), url: 'panel', tag: 'reg-' + r.id });
      }
    });
    return out;
  }

  async function atender(body) {
    const t0 = Date.now();
    const accion = String(body && body.action || '');
    const mp = MAPA[accion] || (accion.indexOf('panel') === 0 ? MAPA.panel : null) || { m: [], n: [] };
    const ap = APRENDIDO[accion] || { m: new Set(mp.m), n: new Set(mp.n) };
    let intento = 0;
    const nuevoR = () => ({ m: {}, mFilas: {}, n: {}, c: {}, props: {}, web: {}, viajes: 0, sesionNeg: null, pedidosNeg: {} });
    let Rq = nuevoR();
    const primeraCarga = async () => {
      const c = [];
      if (body.token) c.push('S_' + body.token);
      if (body.panel) c.push('P_' + body.panel);
      const d = (body && body.data) || {}, wa = String(d.whatsapp || '').replace(/\D/g, ''), wa2 = wa.length === 8 ? '504' + wa : wa;
      if (accion === 'login') c.push('F_' + wa2);
      if (accion === 'registrar') c.push('REG_H', 'REG_' + wa2);
      const cSesion = accion === 'venta' && d.clave ? ['VK_{neg}_' + String(d.clave).trim().replace(/\s+/g, ' ').slice(0, 60)] : [];
      // Tienda en línea y chat del cliente: llegan sin sesión pero dicen de qué negocio son
      const n = {};
      if (!body.token && typeof d.negocio === 'string' && /^N[0-9A-Z]{4,20}$/.test(d.negocio)) n[d.negocio] = BASE_N.concat([...ap.n]);
      await cargar(Rq, { m: BASE_M.concat([...ap.m]), n, sesion: body.token || '', nSesion: BASE_N.concat([...ap.n]), c, cSesion, props: true,
        nWa: accion === 'login' && wa2 ? { wa: wa2, t: BASE_N.concat([...ap.n]) } : undefined });
    };
    await primeraCarga();
    if (body.importar) return importar(body.importar, Rq);
    if (/^push(Guardar|Quitar|Probar)$/.test(accion)) return avisosPush(body, Rq);
    if (HERR.indexOf(accion) >= 0 || body.tarea === 'respaldosDia') return herramientas(body, Rq);
    let negsRec = null;
    if (body.tarea === 'recordatoriosDia') {
      if (!Rq.props.TAREAS_CLAVE || body.clave !== Rq.props.TAREAS_CLAVE || !db.push) return { ok: false, error: 'Tarea no permitida' };
      const subs = await db.push({ lista: true });
      negsRec = [...new Set((subs || []).filter(s => s.negocio !== '_panel' && (',' + s.apagados + ',').indexOf(',resumen,') < 0).map(s => s.negocio))];
      // Todas las tablas de esos negocios de una vez (así no se repite la corrida por cada tabla)
      if (negsRec.length) { const n = {}; negsRec.forEach(x => { n[x] = Object.keys(SCHEMA); }); await cargar(Rq, { m: ['Soporte'], n }); }
    }

    while (true) {
      if (++intento > 40) throw new Error('El servidor no pudo completar la acción. Intenta de nuevo.');
      // Desde aquí hasta calcular los cambios todo es sincrónico: R y C son de esta petición
      R = Rq;
      const Cq = C = {
        m: {}, mApp: {}, n: {}, libros: {}, cache: {}, cacheOps: [], props: {}, efectos: [], faltan: [], supuestos: {},
        tocadas: { m: new Set(), n: new Set() },
        negActual: () => { const N = B.NEG_(); return N ? N.id : null; }
      };
      let out;
      const tc = Date.now();
      try {
        const req = JSON.parse(JSON.stringify(body || {}));
        // Tareas programadas (resumen diario, limpieza de fotos): las llama pg_cron con la clave TAREAS_CLAVE
        if (negsRec) { B.LIMPIAR_(); out = { ok: true, data: B.RECORDATORIOS_(negsRec) }; }
        else if (body.tarea) {
          if (!Rq.props.TAREAS_CLAVE || body.clave !== Rq.props.TAREAS_CLAVE || TAREAS.indexOf(body.tarea) < 0) throw new Error('Tarea no permitida');
          B.LIMPIAR_(); B[body.tarea](); out = { ok: true, data: true };
        } else out = { ok: true, data: B.route_(req) };
      } catch (err) {
        if (!(err instanceof Falta)) out = { ok: false, error: String(err && err.message ? err.message : err) };
      }
      Rq.tCorrer = (Rq.tCorrer || 0) + (Date.now() - tc);
      if (Cq.faltan.length) {
        log('carga extra ' + accion + ' ' + JSON.stringify(Cq.faltan));
        // Cargar lo que faltó (y, si el negocio ya pidió varias tablas, todas las suyas de una vez)
        const p = { m: [], n: {}, c: [] };
        Cq.faltan.forEach(q => {
          if (q.m) { p.m.push(q.m); ap.m.add(q.m); }
          if (q.n) {
            const pedidas = (Rq.pedidosNeg[q.n] = (Rq.pedidosNeg[q.n] || 0) + 1);
            const ya = Rq.n[q.n] ? Object.keys(Rq.n[q.n].t) : [];
            const lista = pedidas > 2 ? Object.keys(SCHEMA).filter(t => ya.indexOf(t) < 0) : BASE_N.concat([...ap.n]).filter(t => ya.indexOf(t) < 0);
            if (lista.indexOf(q.t) < 0) lista.push(q.t);
            p.n[q.n] = (p.n[q.n] || []).concat(lista);
            ap.n.add(q.t);
          }
          if (q.c) p.c.push(q.c);
          if (q.u) p.u = q.u;
        });
        if (p.u) { Rq.web[p.u] = await db.web(p.u); delete p.u; }
        if (p.m.length || Object.keys(p.n).length || p.c.length) await cargar(Rq, p);
        continue;
      }

      // Guardar lo que cambió
      const ops = [], versiones = {};
      // Negocios creados en esta corrida: su id sale de la ficha nueva en Licencias
      const licFinal = Cq.m.Licencias ? Cq.m.Licencias.slice(1) : null;
      const hojaANeg = {};
      Object.keys(Cq.libros).forEach(id => {
        const hi = SCHEMA_M.Licencias.indexOf('hojaId');
        const fila = (licFinal || []).find(r => r && r[hi] === id);
        if (fila) hojaANeg['@' + id] = String(fila[0]);
      });
      [...Cq.tocadas.m].forEach(t => { ops.push(...diferencias(t, Rq.m[t], Cq.m[t], true)); });
      Object.keys(Cq.mApp).forEach(t => { ops.push(...diferencias(t, aCuadricula(t, [], true), aCuadricula(t, [], true).concat(Cq.mApp[t]), true)); });
      [...Cq.tocadas.n].forEach(k => {
        let [neg, t] = k.split('|');
        if (neg[0] === '@') { if (!hojaANeg[neg]) return; neg = hojaANeg[neg]; }
        const antes = Rq.n[neg] && Rq.n[neg].t[t] ? Rq.n[neg].t[t] : aCuadricula(t, [], false);
        const d = diferencias(t, antes, Cq.n[k], false, neg);
        if (d.length) { ops.push(...d); versiones[neg] = Rq.n[neg] ? Rq.n[neg].v : 0; }
      });
      // Las fichas maestras van primero (un negocio nuevo necesita su ficha en Licencias)
      ops.sort((a, b) => (a.n ? 1 : 0) - (b.n ? 1 : 0));
      const props = {}; Object.keys(Cq.props).forEach(k => { props[k] = Cq.props[k]; });
      const chk = Object.keys(Cq.supuestos);
      if (ops.length || Cq.cacheOps.length || Object.keys(props).length || chk.length) {
        const tg = Date.now();
        const res = await db.aplicar({ v: versiones, ops, c: Cq.cacheOps, props, chk });
        Rq.tGuardar = (Rq.tGuardar || 0) + (Date.now() - tg);
        // Alguna clave de caché que se supuso vacía sí tenía valor: no se guardó nada; se repite con el valor real
        if (res && res.cache) { chk.forEach(k => { Rq.c[k] = res.cache[k] || null; }); log('caché con valor ' + accion + ' ' + Object.keys(res.cache).join(',')); continue; }
        if (res && res.conflicto) {
          // Otro equipo del mismo negocio guardó primero: se vuelve a leer y se repite la acción
          Rq = nuevoR(); await primeraCarga();
          continue;
        }
      }
      if (negsRec && out.ok) { out.data.forEach(r => Cq.efectos.push({ push: { negocio: r.neg, tipo: r.tipo || 'resumen', titulo: r.titulo, cuerpo: r.cuerpo, vista: 'inicio', tag: r.tipo || 'resumen' } })); out = { ok: true, data: out.data.length }; }
      if (!negsRec && db.push) avisosDe(ops, Rq, Cq).forEach(p => Cq.efectos.push({ push: p }));
      // Avisar a los otros equipos del negocio que algo cambió (solo los nombres de las tablas)
      const tocados = {};
      ops.forEach(o => { if (o.n && o.n[0] !== '@') (tocados[o.n] = tocados[o.n] || new Set()).add(o.t); });
      // Las lecturas (arranque, inicio, pendientes) a veces ordenan datos internos: eso no es un cambio para los otros equipos
      if (db.push && ['bootstrap', 'inicio', 'pendientes', 'login'].indexOf(accion) < 0) Object.keys(tocados).forEach(neg => { const cn = canal(Rq, neg); if (cn) Cq.efectos.push({ rt: { canal: cn, t: [...tocados[neg]], dev: String(body.dev || '').slice(0, 16) } }); });
      if (accion === 'bootstrap' && out && out.ok && out.data && typeof out.data === 'object') { const neg = Cq.negActual(); if (neg && db.push) out.data.rt = canal(Rq, neg); }
      for (const e of Cq.efectos) {
        if (e.push) e.vapid = { pub: Rq.props.VAPID_PUBLICA || '', priv: Rq.props.VAPID_PRIVADA || '' };
        if (e.correo) e.relay = { url: Rq.props.CORREO_URL || '', clave: Rq.props.CORREO_CLAVE || '' };
        try { await db.efecto(e); } catch (err) { log('Efecto falló: ' + err); }
      }
      APRENDIDO[accion] = ap;
      log((body.tarea ? 'tarea ' + body.tarea : accion) + ' · ' + (Date.now() - t0) + ' ms (leer ' + (Rq.tLeer || 0) + ', correr ' + (Rq.tCorrer || 0) + ', guardar ' + (Rq.tGuardar || 0) + ') · ' + Rq.viajes + ' lecturas · ' + intento + ' corridas · ' + ops.length + ' cambios');
      return out;
    }
  }

  return { atender, version: B.VERSION };
}

/* Qué tablas puede leer cada acción: se calcula leyendo el propio Codigo.gs (funciones que llama y tablas que nombra) */
export function crearMapa(src) {
  const grab = n => { const m = src.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return (0, eval)('(' + m[1] + ')'); };
  const S = Object.keys(grab('SCHEMA')), M = Object.keys(grab('SCHEMA_M'));
  const partes = src.split(/^(?=function [A-Za-z_$][\w$]*\s*\()/m), F = Object.create(null), info = Object.create(null);
  partes.forEach(p => { const m = /^function ([A-Za-z_$][\w$]*)/.exec(p); if (m) F[m[1]] = p; });
  Object.keys(F).forEach(n => {
    const b = F[n].replace(/\/\/.*$/gm, '');
    const llama = new Set(); (b.match(/[A-Za-z_$][\w$]*(?=\s*\()/g) || []).forEach(x => { if (F[x] && x !== n) llama.add(x); });
    const lit = n === 'masterSheet_' ? new Set() : new Set((b.match(/'([A-Za-z]+)'/g) || []).map(x => x.slice(1, -1)));
    info[n] = { llama, n: S.filter(t => lit.has(t)), m: M.filter(t => lit.has(t)) };
  });
  const cierre = f => { const vis = new Set(), pila = [f]; while (pila.length) { const x = pila.pop(); if (!F[x] || vis.has(x)) continue; vis.add(x); info[x].llama.forEach(y => pila.push(y)); } return vis; };
  const acc = {};
  (F['rutaUsuario_'] || '').split('\n').forEach(l => { const m = /case '(\w+)':.*?([A-Za-z_]\w*_)\(u/.exec(l); if (m) acc[m[1]] = m[2]; });
  (F['route_'] || '').split('\n').forEach(l => { const m = /a === '(\w+)'\)/.exec(l); if (!m) return; const fs = (l.match(/([A-Za-z_]\w*_)\(d\b/g) || []).map(x => x.slice(0, -2)); if (fs.length) acc[m[1]] = fs; });
  acc.login = 'loginMulti_'; acc.panel = 'rutaPanel_';
  const EXTRA = { bootstrap: ['PlanCuentas', 'Asientos'], inicio: ['PlanCuentas', 'Asientos'] };
  const base = cierre('auth_'), out = {};
  Object.keys(acc).forEach(a => {
    const v = new Set(); [].concat(acc[a]).forEach(f => cierre(f).forEach(x => v.add(x))); if (a !== 'login' && a !== 'registrar') base.forEach(x => v.add(x));
    const n = new Set(), m = new Set(); v.forEach(f => { info[f].n.forEach(t => n.add(t)); info[f].m.forEach(t => m.add(t)); });
    (EXTRA[a] || []).forEach(t => n.add(t));
    out[a] = { n: [...n], m: [...m] };
  });
  return out;
}
