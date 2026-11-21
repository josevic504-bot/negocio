// TIENDAS CATRACHAS · Qué escribió la gente en Google y en Bing para llegar a molinasoluciones.com
// Corre una vez al día (tarea «tc-buscadores» de pg_cron) y guarda el resultado en la tabla «Buscadores»,
// que el Panel Molina lee en «Análisis de Tiendas Catrachas».
// Llaves (Supabase › Edge Functions › Secrets, las guardó Vic; nunca van en el código):
//   GSC_SERVICE_ACCOUNT  = archivo JSON de la cuenta de servicio de Google (permiso «Restringido» en Search Console)
//   BING_WEBMASTER_KEY   = clave de API de Bing Webmaster
// Solo la tarea puede llamarla: pide la clave BUSCADORES_CLAVE de la tabla Propiedades.
const URL_SB = Deno.env.get('SUPABASE_URL')!;
const CLAVE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DOMINIO = 'molinasoluciones.com';
const SITIO_GSC = 'sc-domain:' + DOMINIO;
const APP = 'app.' + DOMINIO; // el programa vive ahí: sus páginas no son del directorio y no se cuentan
const cab = { apikey: CLAVE, Authorization: 'Bearer ' + CLAVE, 'Content-Type': 'application/json' };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
const dia = (d: Date) => d.toISOString().slice(0, 10);
const limpia = (q: unknown) => String(q || '').replace(/\s+/g, ' ').trim().slice(0, 160);
type Fila = { id: string; fecha: string; motor: string; consulta: string; impresiones: string; clics: string; posicion: string };
const fila = (fecha: string, motor: string, consulta: string, imp: number, clics: number, pos: number): Fila =>
  ({ id: fecha + '|' + motor + '|' + consulta, fecha, motor, consulta, impresiones: String(Math.round(imp) || 0), clics: String(Math.round(clics) || 0), posicion: pos > 0 ? String(Math.round(pos * 10) / 10) : '' });

async function prop(k: string) {
  const r = await fetch(`${URL_SB}/rest/v1/Propiedades?select=valor&clave=eq.${encodeURIComponent(k)}`, { headers: cab });
  if (!r.ok) throw new Error('Propiedades ' + r.status);
  const l = await r.json(); return l.length ? String(l[0].valor) : '';
}
async function guardarProp(k: string, v: string) {
  await fetch(`${URL_SB}/rest/v1/Propiedades?on_conflict=clave`, { method: 'POST', headers: { ...cab, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ clave: k, valor: v, actualizado: new Date().toISOString() }) });
}
async function guardar(filas: Fila[]) {
  // Por si una búsqueda viniera repetida en la misma respuesta: una sola fila por id
  const u = new Map<string, Fila>(); filas.forEach(f => u.set(f.id, f));
  const l = [...u.values()];
  for (let i = 0; i < l.length; i += 500) {
    const r = await fetch(`${URL_SB}/rest/v1/Buscadores?on_conflict=id`, { method: 'POST', headers: { ...cab, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(l.slice(i, i + 500)) });
    if (!r.ok) throw new Error('Buscadores ' + r.status + ' ' + (await r.text()).slice(0, 200));
  }
  return l.length;
}

/* ---------- Google Search Console ---------- */
const b64u = (b: Uint8Array | string) => btoa(typeof b === 'string' ? b : String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function tokenGoogle(cuenta: { client_email: string; private_key: string; token_uri?: string }) {
  const ahora = Math.floor(Date.now() / 1000), uri = cuenta.token_uri || 'https://oauth2.googleapis.com/token';
  const cuerpo = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64u(JSON.stringify({ iss: cuenta.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: uri, iat: ahora, exp: ahora + 600 }));
  const der = Uint8Array.from(atob(cuenta.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), c => c.charCodeAt(0));
  const llave = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const firma = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', llave, new TextEncoder().encode(cuerpo)));
  const r = await fetch(uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + cuerpo + '.' + b64u(firma), signal: AbortSignal.timeout(15000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('Google no dio acceso (' + r.status + '): ' + String(j.error_description || j.error || '').slice(0, 160));
  return String(j.access_token);
}
async function google(dias: number): Promise<Fila[]> {
  const cruda = Deno.env.get('GSC_SERVICE_ACCOUNT') || '';
  if (!cruda) throw new Error('Falta el secreto GSC_SERVICE_ACCOUNT');
  let cuenta; try { cuenta = JSON.parse(cruda); } catch (_e) { throw new Error('El secreto GSC_SERVICE_ACCOUNT no es el archivo JSON completo'); }
  if (!cuenta.client_email || !cuenta.private_key) throw new Error('El secreto GSC_SERVICE_ACCOUNT no trae client_email o private_key');
  const tk = await tokenGoogle(cuenta);
  const fin = dia(new Date()), ini = dia(new Date(Date.now() - dias * 86400000));
  const pide = async (dimensiones: string[]) => {
    const filas: any[] = [];
    for (let desde = 0; desde < 100000; desde += 25000) {
      const r = await fetch('https://www.googleapis.com/webmasters/v3/sites/' + encodeURIComponent(SITIO_GSC) + '/searchAnalytics/query', { method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(25000),
        body: JSON.stringify({ startDate: ini, endDate: fin, dimensions: dimensiones, type: 'web', dataState: 'all', rowLimit: 25000, startRow: desde,
          dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'notContains', expression: APP }] }] }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error('Search Console respondió ' + r.status + ': ' + String(j.error && j.error.message || '').slice(0, 200));
      const l = j.rows || []; filas.push(...l); if (l.length < 25000) break;
    }
    return filas;
  };
  const [porDia, porBusqueda] = [await pide(['date']), await pide(['date', 'query'])];
  const out: Fila[] = [];
  porDia.forEach(x => out.push(fila(String(x.keys[0]), 'google', '', x.impressions, x.clicks, x.position)));
  porBusqueda.forEach(x => { const q = limpia(x.keys[1]); if (q) out.push(fila(String(x.keys[0]), 'google', q, x.impressions, x.clicks, x.position)); });
  return out;
}

/* ---------- Bing Webmaster ---------- */
// Las fechas de Bing vienen como «/Date(1399100400000-0700)/»
function fechaBing(s: unknown) {
  const m = /Date\((-?\d+)([+-]\d{4})?\)/.exec(String(s || '')); if (!m) return '';
  let ms = Number(m[1]); if (m[2]) ms += (m[2][0] === '-' ? -1 : 1) * (Number(m[2].slice(1, 3)) * 60 + Number(m[2].slice(3))) * 60000;
  return dia(new Date(ms));
}
async function bing(dias: number): Promise<Fila[]> {
  const llave = (Deno.env.get('BING_WEBMASTER_KEY') || '').trim();
  if (!llave) throw new Error('Falta el secreto BING_WEBMASTER_KEY');
  const pide = async (metodo: string, sitio?: string) => {
    const r = await fetch('https://ssl.bing.com/webmaster/api.svc/json/' + metodo + '?apikey=' + encodeURIComponent(llave) + (sitio ? '&siteUrl=' + encodeURIComponent(sitio) : ''), { headers: { 'Content-Type': 'application/json; charset=utf-8' }, signal: AbortSignal.timeout(25000) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('Bing respondió ' + r.status + ' en ' + metodo + ': ' + String(j.Message || '').slice(0, 160));
    return Array.isArray(j.d) ? j.d : [];
  };
  // El sitio tal como quedó registrado en Bing (con o sin www, con o sin barra final)
  const sitios = (await pide('GetUserSites')).map((s: any) => String(s.Url || ''));
  const sitio = sitios.find((u: string) => { try { return new URL(u).hostname.replace(/^www\./, '') === DOMINIO; } catch (_e) { return false; } });
  if (!sitio) throw new Error('El sitio no aparece en la cuenta de Bing Webmaster');
  const desde = dia(new Date(Date.now() - dias * 86400000));
  const [totales, busquedas] = [await pide('GetRankAndTrafficStats', sitio), await pide('GetQueryStats', sitio)];
  const out: Fila[] = [];
  totales.forEach((x: any) => { const f = fechaBing(x.Date); if (f && f >= desde) out.push(fila(f, 'bing', '', Number(x.Impressions) || 0, Number(x.Clicks) || 0, 0)); });
  busquedas.forEach((x: any) => { const f = fechaBing(x.Date), q = limpia(x.Query); if (f && f >= desde && q) out.push(fila(f, 'bing', q, Number(x.Impressions) || 0, Number(x.Clicks) || 0, Number(x.AvgImpressionPosition) || 0)); });
  return out;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ ok: false }, 405);
    let body: any = {}; try { body = JSON.parse(await req.text() || '{}'); } catch (_e) { /* sin cuerpo */ }
    const esperada = await prop('BUSCADORES_CLAVE');
    if (!esperada || String(body.clave || '') !== esperada) return json({ ok: false, error: 'No permitido' }, 403);
    // Cada día se vuelven a pedir los últimos 10 (Google corrige sus números de los días recientes); la primera vez, todo lo que guarda
    const dias = Math.min(480, Math.max(3, Number(body.dias) || 10));
    const estado: any = { cuando: new Date().toISOString() };
    for (const [nombre, fn] of [['google', google], ['bing', bing]] as const) {
      try { const filas = await fn(dias); estado[nombre] = { ok: true, filas: await guardar(filas) }; }
      catch (e) { estado[nombre] = { ok: false, error: String((e as Error).message || e).slice(0, 240) }; console.log(nombre + ' falló:', estado[nombre].error); }
    }
    // Se conservan 16 meses, igual que Search Console
    await fetch(`${URL_SB}/rest/v1/Buscadores?fecha=lt.${dia(new Date(Date.now() - 490 * 86400000))}`, { method: 'DELETE', headers: cab });
    await guardarProp('BUSCADORES_ESTADO', JSON.stringify(estado));
    console.log('Buscadores:', JSON.stringify(estado));
    return json({ ok: true, estado });
  } catch (e) {
    console.log('Error:', String(e && (e as Error).stack || e));
    return json({ ok: false, error: 'La tarea tuvo un problema' }, 500);
  }
});
