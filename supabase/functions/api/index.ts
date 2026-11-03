// GESTIÓN DE NEGOCIO VM · Servidor en Supabase (Edge Function «api»)
// Recibe lo mismo que el Apps Script (POST con {action, token, panel, data}) y responde igual ({ok, data | error}).
// El Codigo.gs se descarga del repositorio al arrancar: publicar en GitHub actualiza el servidor (ya no se pega en Apps Script).
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { htmlAPdf } from './pdf.js';
import { jsPDF } from 'npm:jspdf@2.5.1';

const URL_SB = Deno.env.get('SUPABASE_URL')!;
const CLAVE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CODIGO_URL = Deno.env.get('CODIGO_URL') || 'https://raw.githubusercontent.com/josevic504-bot/negocio/main/Codigo.gs';
// El motor (servidor.js) también se toma de GitHub (rama supabase), igual que el Codigo.gs
const MOTOR_URL = Deno.env.get('MOTOR_URL') || 'https://raw.githubusercontent.com/josevic504-bot/negocio/supabase/supabase/functions/api/servidor.js';
const BUCKET = 'archivos';
const WEB_PERMITIDA = ['https://open.er-api.com/'];

const cab = { apikey: CLAVE, Authorization: 'Bearer ' + CLAVE, 'Content-Type': 'application/json' };
async function rpc(fn: string, p: unknown) {
  const r = await fetch(`${URL_SB}/rest/v1/rpc/${fn}`, { method: 'POST', headers: cab, body: JSON.stringify({ p }) });
  if (!r.ok) throw new Error('Base de datos: ' + r.status + ' ' + (await r.text()).slice(0, 300));
  return r.json();
}
// Tareas que siguen después de responder (avisos al teléfono y aviso de cambios): la respuesta no las espera
const despues = (p: Promise<unknown>) => { const q = p.catch(e => console.log('Tarea de fondo falló:', String(e))); const er = (globalThis as any).EdgeRuntime; if (er && er.waitUntil) er.waitUntil(q); else return q; };
const SUBS = `${URL_SB}/rest/v1/PushSubs`;
async function subsDe(negocio: string, endpoint?: string) {
  const r = await fetch(SUBS + '?select=*&negocio=eq.' + encodeURIComponent(negocio) + (endpoint ? '&endpoint=eq.' + encodeURIComponent(endpoint) : ''), { headers: cab });
  if (!r.ok) throw new Error('PushSubs ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}
// Manda un aviso a todos los teléfonos del negocio que lo tienen activado (menos los que apagaron ese tipo)
async function enviarPush(p: any, vapid: any) {
  if (!vapid || !vapid.pub || !vapid.priv) { console.log('Aviso sin llaves VAPID'); return; }
  const subs = (await subsDe(p.negocio, p.endpoint)).filter((s: any) => (',' + s.apagados + ',').indexOf(',' + p.tipo + ',') < 0);
  if (!subs.length) return;
  const carga = JSON.stringify({ titulo: p.titulo, cuerpo: p.cuerpo, vista: p.vista || 'inicio', url: p.url || '', tag: 'gnvm-' + (p.tag || p.tipo) });
  // Se carga solo al mandar un aviso: si fallara, el resto del servidor sigue igual
  const webpush = (await import('npm:web-push@3.6.7')).default;
  let ok = 0;
  await Promise.all(subs.map(async (s: any) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga,
        { vapidDetails: { subject: 'mailto:molinasolucionesdigitales@gmail.com', publicKey: vapid.pub, privateKey: vapid.priv }, TTL: 86400, urgency: 'high' });
      ok++;
    } catch (e: any) {
      // El teléfono quitó el permiso o desinstaló: se borra
      if (e && (e.statusCode === 404 || e.statusCode === 410)) await fetch(SUBS + '?endpoint=eq.' + encodeURIComponent(s.endpoint), { method: 'DELETE', headers: cab });
      else console.log('Aviso no enviado', e && e.statusCode, String(e && e.body || e).slice(0, 200));
    }
  }));
  console.log('Aviso ' + p.tipo + ' · ' + p.negocio + ' · ' + ok + '/' + subs.length);
}
const urlArchivo = (ruta: string) => `${URL_SB}/storage/v1/object/public/${BUCKET}/${ruta}`;
const rutaDeUrl = (u: string) => { const pre = `${URL_SB}/storage/v1/object/public/${BUCKET}/`; return u.indexOf(pre) === 0 ? u.slice(pre.length) : null; };

const db = {
  cargar: (p: unknown) => rpc('api_cargar', p),
  aplicar: (p: unknown) => rpc('api_aplicar', p),
  async web(url: string) {
    if (!WEB_PERMITIDA.some(w => url.indexOf(w) === 0)) return { texto: '', codigo: 403 };
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
      return { texto: await r.text(), codigo: r.status };
    } catch (_e) { return { texto: '', codigo: 599 }; }
  },
  async push(q: any) {
    if (q.lista) { const r = await fetch(SUBS + '?select=negocio,apagados', { headers: cab }); if (!r.ok) throw new Error('PushSubs ' + r.status); return r.json(); }
    if (q.guardar) {
      const r = await fetch(SUBS + '?on_conflict=endpoint,negocio', { method: 'POST', headers: { ...cab, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ ...q.guardar, ultimo: new Date().toISOString() }) });
      if (!r.ok) throw new Error('PushSubs ' + r.status + ' ' + (await r.text()).slice(0, 200));
      return true;
    }
    if (q.quitar) { await fetch(SUBS + '?endpoint=eq.' + encodeURIComponent(q.quitar.endpoint) + '&negocio=eq.' + encodeURIComponent(q.quitar.negocio), { method: 'DELETE', headers: cab }); return true; }
  },
  async efecto(e: any) {
    if (e.push) { if (e.push.endpoint) await enviarPush(e.push, e.vapid); else despues(enviarPush(e.push, e.vapid)); return; }
    if (e.rt) {
      despues(fetch(`${URL_SB}/realtime/v1/api/broadcast`, { method: 'POST', headers: cab,
        body: JSON.stringify({ messages: [{ topic: e.rt.canal, event: 'cambio', payload: { t: e.rt.t, dev: e.rt.dev }, private: false }] }) })
        .then(async r => { if (!r.ok) console.log('Aviso de cambio falló', r.status, (await r.text()).slice(0, 200)); }));
      return;
    }
    if (e.subir) {
      const r = await fetch(`${URL_SB}/storage/v1/object/${BUCKET}/${e.subir.ruta}`, {
        method: 'POST', headers: { apikey: CLAVE, Authorization: 'Bearer ' + CLAVE, 'Content-Type': e.subir.mime || 'image/jpeg', 'x-upsert': 'true' },
        body: e.subir.html ? htmlAPdf(jsPDF, e.subir.html) : Buffer.from(e.subir.b64, 'base64')
      });
      if (!r.ok) console.log('No se subió el archivo', e.subir.ruta, r.status, await r.text());
    } else if (e.borrar) {
      await fetch(`${URL_SB}/storage/v1/object/${BUCKET}/${e.borrar}`, { method: 'DELETE', headers: { apikey: CLAVE, Authorization: 'Bearer ' + CLAVE } });
    } else if (e.correo) {
      // El correo sale por un Apps Script pequeño de la cuenta de Gmail del negocio (CORREO_URL y CORREO_CLAVE en la tabla Propiedades)
      if (!e.relay || !e.relay.url) { console.log('Correo sin enviar (falta CORREO_URL):', e.correo.to, e.correo.subject); return; }
      const r = await fetch(e.relay.url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, redirect: 'follow', signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ clave: e.relay.clave, to: e.correo.to, subject: e.correo.subject, htmlBody: e.correo.htmlBody || '', body: e.correo.body || '' }) });
      console.log('Correo enviado:', e.correo.subject, r.status);
    }
  }
};

let servidor: any = null, cargando: Promise<any> | null = null, cargadoEn = 0;
let motor: any = null, motorSrc = '';
async function bajarMotor() {
  try {
    const r = await fetch(MOTOR_URL + '?t=' + Math.floor(Date.now() / 60000), { signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw new Error(String(r.status));
    const t = await r.text();
    if (t !== motorSrc) {
      const m = new Function(t.replace(/^export function /gm, 'function ') + '\nreturn { crearServidor, crearMapa };')();
      motor = m; motorSrc = t;
      console.log('Motor descargado de GitHub');
    }
  } catch (e) { if (!motor) throw new Error('No se pudo descargar el motor: ' + String(e)); console.log('Sigue el motor anterior:', String(e)); }
}
async function obtenerServidor() {
  // Se vuelve a descargar el Codigo.gs cada 5 minutos por si se publicó una versión nueva
  if (servidor && Date.now() - cargadoEn < 300000) return servidor;
  if (!cargando) cargando = (async () => {
    try {
      const motorAntes = motor;
      const [r] = await Promise.all([fetch(CODIGO_URL + '?t=' + Math.floor(Date.now() / 60000), { signal: AbortSignal.timeout(8000) }), bajarMotor()]);
      if (!r.ok) throw new Error('No se pudo descargar Codigo.gs: ' + r.status);
      const src = await r.text();
      if (!servidor || src !== servidor.src || motor !== motorAntes) {
        const t0 = Date.now();
        const s = motor.crearServidor(src, db, { sha256: (b: Uint8Array) => createHash('sha256').update(b).digest(), log: (m: string) => console.log(m), urlArchivo, rutaDeUrl, correo: 'molinasolucionesdigitales@gmail.com' });
        s.src = src; servidor = s;
        console.log('Servidor listo · versión ' + s.version + ' · preparar ' + (Date.now() - t0) + ' ms');
      }
      cargadoEn = Date.now();
    } catch (e) { if (!servidor) throw e; console.log('Sigue la versión anterior:', String(e)); cargadoEn = Date.now(); }
    finally { cargando = null; }
    return servidor;
  })();
  return cargando;
}

// Huella de la conexión: 16 letras del SHA-256 de la dirección; sirve para contar intentos fallidos sin guardar la dirección
function huellaIp(req: Request) {
  const h = req.headers, ip = (h.get('cf-connecting-ip') || (h.get('x-forwarded-for') || '').split(',')[0] || h.get('x-real-ip') || '').trim();
  return ip ? createHash('sha256').update('gnvm|' + ip).digest('hex').slice(0, 16) : '';
}
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const json = (o: unknown) => new Response(JSON.stringify(o), { headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    const s = await obtenerServidor();
    if (req.method === 'GET') return json({ ok: true, app: 'Gestión de Negocio VM', version: s.version, multi: true, servidor: 'supabase' });
    let body: any;
    try { body = JSON.parse(await req.text() || '{}'); } catch (_e) { return json({ ok: false, error: 'Solicitud inválida' }); }
    if (body && typeof body === 'object') body.ip = huellaIp(req); // huella de la conexión (para frenar intentos de PIN); nunca se guarda la dirección
    return json(await s.atender(body));
  } catch (e) {
    console.log('Error del servidor:', String(e && (e as Error).stack || e));
    return json({ ok: false, error: 'El servidor tuvo un problema. Intenta de nuevo.' });
  }
});
