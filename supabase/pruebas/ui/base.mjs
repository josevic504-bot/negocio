// Arnés de pruebas en pantalla: sirve index.html local y enruta el API al motor simulado (prueba.mjs)
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import { api, db, logs } from '../prueba.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
export const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
export const OUT = process.env.OUT || '/tmp/claude-0/-home-claude/626023a0-bb6d-5bed-81b4-230e0d287a38/scratchpad/capturas';
fs.mkdirSync(OUT, { recursive: true });
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript', mjs: 'text/javascript', json: 'application/json', png: 'image/png', webp: 'image/webp', webmanifest: 'application/manifest+json', gs: 'text/plain' };
export const srv = http.createServer((q, r) => {
  let f = path.join(RAIZ, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[f.split('.').pop()] || 'application/octet-stream' }); r.end(d); });
}).listen(8765);
export const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
export const fallas = [];   // errores de consola / página / peticiones
export const resultados = []; // [nombre, ok, detalle]
export const ok = (n, c, det) => { resultados.push([n, !!c, det || '']); console.log((c ? '✓ ' : '✗ ') + n + (det && !c ? ' — ' + det : '')); return !!c; };
let nCap = 0;
export async function nuevaPagina(opts = {}) {
  const ctx = await br.newContext({ viewport: opts.pc ? { width: 1280, height: 860 } : { width: 390, height: 844 }, deviceScaleFactor: opts.pc ? 1 : 2, locale: 'es-HN', timezoneId: 'America/Tegucigalpa', permissions: [] });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(5000);
  pg.on('console', m => { if (m.type() === 'error') fallas.push({ t: 'console', v: pg.url(), m: m.text().slice(0, 300) }); });
  pg.on('pageerror', e => fallas.push({ t: 'pageerror', v: pg.url(), m: String(e).slice(0, 300) }));
  pg.on('dialog', async d => { fallas.push({ t: 'dialog', v: pg.url(), m: d.message().slice(0, 200) }); await d.accept(); });
  await pg.route(/^https?:\/\/(?!localhost).*/, async rt => {
    const u = rt.request().url();
    if (/chart\.umd\.min\.js/.test(u)) return rt.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.resolve(path.dirname(new URL(import.meta.url).pathname), '../node_modules/chart.js/dist/chart.umd.js')) });
    if (/fonts\.googleapis\.com/.test(u)) return rt.fulfill({ status: 200, contentType: 'text/css', body: '' });
    if (u.indexOf('supabase.co/functions/v1/api') < 0) { fallas.push({ t: 'externo', v: pg.url(), m: u.slice(0, 160) }); return rt.abort(); }
    const body = JSON.parse(rt.request().postData() || '{}');
    let r; try { r = await api(body.action, body.data, body.token, { panel: body.panel }); } catch (e) { r = { ok: false, error: 'EXCEPCION ' + e.message }; fallas.push({ t: 'servidor', v: body.action, m: String(e.stack || e).slice(0, 300) }); }
    if (!r.ok && opts.verApi !== false) console.log('   · api', body.action, '→', String(r.error).slice(0, 120));
    rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r) });
  });
  if (opts.token) await pg.addInitScript(t => { localStorage.setItem('gnvm@/|token', t); localStorage.setItem('gnvm@/|modo', 'real'); localStorage.setItem('gnvm@/|introVisto', '1'); localStorage.setItem('gnvm@/|verVisto', '9.9.9'); }, opts.token);
  else await pg.addInitScript(() => { localStorage.setItem('gnvm@/|verVisto', '9.9.9'); });
  pg.cap = async (n) => { nCap++; const f = path.join(OUT, String(nCap).padStart(2, '0') + '-' + n + '.png'); await pg.screenshot({ path: f }); return f; };
  pg.ir = async (v) => { await pg.evaluate(v => ir(v), v); await pg.waitForTimeout(600); await esperar(pg); };
  pg.txt = async () => (await pg.locator('#app').innerText().catch(() => '')).replace(/\s+/g, ' ');
  pg.tocar = async (sel, ms = 500) => { const r = await pg.evaluate(s => { const els = [...document.querySelectorAll(s)].filter(e => e.getBoundingClientRect().width > 0); if (!els.length) return false; els[0].click(); return true; }, sel); if (!r) throw new Error('no hay ' + sel); await pg.waitForTimeout(ms); };
  pg.texto = async (t, ms = 600) => { const r = await pg.evaluate(t => { const els = [...document.querySelectorAll('button, [data-a], .li, a, .chip')].filter(e => e.getBoundingClientRect().width > 0 && (e.innerText || '').includes(t)); if (!els.length) return false; els[0].click(); return true; }, t); if (!r) throw new Error('no hay elemento con texto ' + t); await pg.waitForTimeout(ms); };
  pg.accion = async (a, ms = 500) => pg.tocar(`[data-a="${a}"]`, ms);
  pg.clic = async (sel, ms = 500) => { const r = await pg.evaluate(s => { const els = [...document.querySelectorAll(s)].filter(e => e.getBoundingClientRect().width > 0); if (!els.length) return false; els[els.length - 1].click(); return true; }, sel); if (!r) throw new Error('no hay ' + sel); await pg.waitForTimeout(ms); };
  pg.hojaTxt = async () => (await pg.locator('.hoja, .sheet, .modal').last().innerText().catch(() => '')).replace(/\s+/g, ' ');
  return pg;
}
export async function esperar(pg, ms = 4000) {
  try { await pg.waitForFunction(() => { const m = document.querySelector('#main'); return !m || !/Cargando…|Calculando/.test(m.textContent); }, null, { timeout: ms }); } catch (e) {}
}
export async function cerrar() {
  await br.close(); srv.close();
  const p = resultados.filter(r => r[1]).length, f = resultados.filter(r => !r[1]);
  console.log(`\n== ${p} pasadas · ${f.length} fallidas ==`);
  f.forEach(r => console.log('  ✗', r[0], r[2]));
  const fl = fallas.filter(x => x.t !== 'externo');
  console.log(`== Fallas técnicas: ${fl.length} ==`); fl.forEach(x => console.log('  ·', x.t, x.v, x.m));
  const ext = [...new Set(fallas.filter(x => x.t === 'externo').map(x => x.m))]; if (ext.length) console.log('== Peticiones externas bloqueadas:', ext.join(' | '));
  fs.writeFileSync(path.join(OUT, 'resultado.json'), JSON.stringify({ resultados, fallas, tablas: Object.fromEntries(Object.entries(db.T).map(([t, r]) => [t, r.length])) }, null, 1));
}
export { api, db, logs };
