// GESTIÓN DE NEGOCIO VM · Servidor en Supabase (Edge Function «api»)
// Recibe lo mismo que el Apps Script (POST con {action, token, panel, data}) y responde igual ({ok, data | error}).
// El Codigo.gs se descarga del repositorio al arrancar: publicar en GitHub actualiza el servidor (ya no se pega en Apps Script).
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { crearServidor } from './servidor.js';

const URL_SB = Deno.env.get('SUPABASE_URL')!;
const CLAVE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CODIGO_URL = Deno.env.get('CODIGO_URL') || 'https://raw.githubusercontent.com/josevic504-bot/negocio/main/Codigo.gs';
const BUCKET = 'archivos';
const WEB_PERMITIDA = ['https://open.er-api.com/'];

const cab = { apikey: CLAVE, Authorization: 'Bearer ' + CLAVE, 'Content-Type': 'application/json' };
async function rpc(fn: string, p: unknown) {
  const r = await fetch(`${URL_SB}/rest/v1/rpc/${fn}`, { method: 'POST', headers: cab, body: JSON.stringify({ p }) });
  if (!r.ok) throw new Error('Base de datos: ' + r.status + ' ' + (await r.text()).slice(0, 300));
  return r.json();
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
  async efecto(e: any) {
    if (e.subir) {
      const r = await fetch(`${URL_SB}/storage/v1/object/${BUCKET}/${e.subir.ruta}`, {
        method: 'POST', headers: { apikey: CLAVE, Authorization: 'Bearer ' + CLAVE, 'Content-Type': e.subir.mime || 'image/jpeg', 'x-upsert': 'true' },
        body: Buffer.from(e.subir.b64, 'base64')
      });
      if (!r.ok) console.log('No se subió el archivo', e.subir.ruta, r.status, await r.text());
    } else if (e.borrar) {
      await fetch(`${URL_SB}/storage/v1/object/${BUCKET}/${e.borrar}`, { method: 'DELETE', headers: { apikey: CLAVE, Authorization: 'Bearer ' + CLAVE } });
    } else if (e.correo) {
      console.log('Correo pendiente (sin servicio de correo configurado):', e.correo.to, e.correo.subject);
    }
  }
};

let servidor: any = null, cargando: Promise<any> | null = null, cargadoEn = 0;
async function obtenerServidor() {
  // Se vuelve a descargar el Codigo.gs cada 5 minutos por si se publicó una versión nueva
  if (servidor && Date.now() - cargadoEn < 300000) return servidor;
  if (!cargando) cargando = (async () => {
    try {
      const r = await fetch(CODIGO_URL + '?t=' + Math.floor(Date.now() / 60000), { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error('No se pudo descargar Codigo.gs: ' + r.status);
      const src = await r.text();
      if (!servidor || src !== servidor.src) {
        const s = crearServidor(src, db, { sha256: (b: Uint8Array) => createHash('sha256').update(b).digest(), log: (m: string) => console.log(m), urlArchivo, rutaDeUrl, correo: 'molinasolucionesdigitales@gmail.com' });
        s.src = src; servidor = s;
      }
      cargadoEn = Date.now();
    } catch (e) { if (!servidor) throw e; console.log('Sigue la versión anterior:', String(e)); cargadoEn = Date.now(); }
    finally { cargando = null; }
    return servidor;
  })();
  return cargando;
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
    return json(await s.atender(body));
  } catch (e) {
    console.log('Error del servidor:', String(e && (e as Error).stack || e));
    return json({ ok: false, error: 'El servidor tuvo un problema. Intenta de nuevo.' });
  }
});
