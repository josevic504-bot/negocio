/*****************************************************************
 * GESTIÓN DE NEGOCIO VM · Copiar los datos de Google a Supabase
 * Pégalo como un archivo NUEVO (Exportar.gs) en el MISMO Apps Script donde está Codigo.gs.
 * Usa las mismas funciones del programa para leer, así los datos llegan tal como los ve la app.
 *
 * 1) Ejecuta exportarASupabase(). Si se acaba el tiempo (6 minutos), ejecútala otra vez:
 *    sigue donde se quedó.
 * 2) La noche del cambio final: ejecuta cambioFinal(). Cierra el servidor de Google
 *    (la app pide volver a abrirla) y copia todo desde cero. Si dice «Faltan…», sigue con exportarASupabase().
 * No cambia nada en tus hojas de Google: solo lee y envía.
 *****************************************************************/
const SUPA_URL = 'https://qvhtlezxjklhwlnvexje.supabase.co/functions/v1/api';
const SUPA_CLAVE = 'PEGAR_AQUI_LA_CLAVE';
const SUPA_LOTE = 1500; // filas por envío

function exportarASupabase() {
  const t0 = Date.now(), P = PropertiesService.getScriptProperties();
  const hechos = JSON.parse(P.getProperty('EXP_HECHOS') || '{}');
  const guardar = () => P.setProperty('EXP_HECHOS', JSON.stringify(hechos));
  const resumen = [];

  // 1) Hojas maestras (licencias, accesos, soporte, pagos, contratos, visitas…) y propiedades del script
  if (!hechos._maestras) {
    Object.keys(SCHEMA_M).forEach(t => {
      delete MEMO['_m_' + t];
      const filas = mRows_(t).map(o => { const x = Object.assign({}, o); delete x._fila; return x; });
      supaEnviar_(t, null, filas);
      resumen.push(t + ': ' + filas.length);
    });
    const props = P.getProperties();
    supaPost_({ importar: { clave: SUPA_CLAVE, props: props } });
    hechos._maestras = 1; guardar();
  }

  // 2) La hoja de cada negocio
  const lics = mRows_('Licencias');
  let pendientes = 0;
  for (const l of lics) {
    if (!l.hojaId || hechos[l.id]) continue;
    if (Date.now() - t0 > 4.5 * 60 * 1000) { pendientes++; continue; }
    try {
      Object.keys(MEMO).forEach(k => { if (k.indexOf('_m_') !== 0) delete MEMO[k]; });
      setNegocio_(l);
      let total = 0;
      lock_(() => {
        const ss = ss_();
        Object.keys(SCHEMA).forEach(t => {
          const filas = ss.getSheetByName(t) ? rows_(t) : [];
          supaEnviar_(t, l.id, filas);
          total += filas.length;
        });
      });
      hechos[l.id] = 1; guardar();
      resumen.push(l.negocio + ': ' + total + ' filas');
    } catch (e) {
      hechos[l.id] = 'error: ' + e.message; guardar();
      resumen.push(l.negocio + ': ERROR ' + e.message);
    }
  }
  Logger.log(resumen.join('\n'));
  Logger.log(pendientes ? 'Faltan ' + pendientes + ' negocios: vuelve a ejecutar exportarASupabase().' : 'LISTO: todos los negocios se copiaron a Supabase.');
}

// CAMBIO FINAL: cierra el servidor de Google (nadie más puede guardar aquí) y copia todo desde cero a Supabase.
// Si el registro dice «Faltan X negocios», ejecuta exportarASupabase() hasta que diga LISTO.
function cambioFinal() {
  const P = PropertiesService.getScriptProperties();
  P.setProperty('MIGRADO', 'si');
  Utilities.sleep(20000); // espera a que terminen las ventas que estaban en camino
  P.deleteProperty('EXP_HECHOS');
  Logger.log('Servidor de Google cerrado. Copiando todo a Supabase…');
  exportarASupabase();
}

// Solo por si hay que volver atrás: Google vuelve a aceptar cambios
function reabrirServidorGoogle() {
  PropertiesService.getScriptProperties().deleteProperty('MIGRADO');
  Logger.log('El servidor de Google vuelve a aceptar cambios.');
}

function reiniciarExportacion() {
  PropertiesService.getScriptProperties().deleteProperty('EXP_HECHOS');
  Logger.log('Listo: la próxima exportación empieza de cero (reemplaza todo en Supabase).');
}

// Envía una tabla en lotes; el primer lote borra lo que ya había de esa tabla (y de ese negocio)
function supaEnviar_(tabla, negocio, filas) {
  let i = 0;
  do {
    const lote = filas.slice(i, i + SUPA_LOTE);
    supaPost_({ importar: { clave: SUPA_CLAVE, tabla: tabla, negocio: negocio || '', limpiar: i === 0, filas: lote } });
    i += SUPA_LOTE;
  } while (i < filas.length);
}

function supaPost_(cuerpo) {
  for (let intento = 1; intento <= 3; intento++) {
    const r = UrlFetchApp.fetch(SUPA_URL, { method: 'post', contentType: 'application/json', payload: JSON.stringify(cuerpo), muteHttpExceptions: true });
    let j = null;
    try { j = JSON.parse(r.getContentText()); } catch (e) {}
    if (j && j.ok) return j.data;
    if (intento === 3) throw new Error('Supabase respondió: ' + (j ? j.error : r.getResponseCode() + ' ' + r.getContentText().slice(0, 200)));
    Utilities.sleep(1500 * intento);
  }
}
