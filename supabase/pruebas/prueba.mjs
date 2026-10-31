import fs from 'node:fs'; import { createHash } from 'node:crypto';
import { crearServidor } from '../functions/api/servidor.js';
import { dbFalsa } from './db-falsa.mjs';
import mapa from '../functions/api/mapa.js';
const SRC = fs.readFileSync(new URL('../../Codigo.gs', import.meta.url), 'utf8');
let db; const logs = [];
const srv = crearServidor(SRC, { cargar: p => db.cargar(p), aplicar: p => db.aplicar(p), web: u => db.web(u), efecto: e => db.efecto(e) },
  { sha256: b => createHash('sha256').update(b).digest(), log: m => logs.push(m), urlArchivo: r => 'https://x.supabase.co/storage/v1/object/public/archivos/' + r, rutaDeUrl: u => (u.split('/archivos/')[1] || null) });
// Esquema desde el propio Codigo.gs
const grab = n => { const m = SRC.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
db = dbFalsa(grab('SCHEMA'), grab('SCHEMA_M'), grab('NUMS'), grab('BOOLS'));
export const api = async (action, data, token, extra) => { const r = await srv.atender(Object.assign({ action, token, data: data || {} }, extra || {})); return r; };
export { db, logs, srv };
