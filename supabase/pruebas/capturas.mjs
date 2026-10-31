// Capturas de la app (index.html con cambios) hablando con el servidor nuevo simulado en esta computadora
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import { api } from './prueba.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const RAIZ = process.argv[3] || path.resolve('../..'), OUT = process.argv[2];
const srv = http.createServer((q, r) => { let f = path.join(RAIZ, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.json') ? 'application/json' : f.endsWith('.png') ? 'image/png' : 'application/octet-stream' }); r.end(d); }); }).listen(8765);
const reg = await api('registrar', { negocio: 'Pulpería La Bendición', nombre: 'Vic', giro: 'tienda', whatsapp: '33130265', pin: '1234' });
const tok = reg.data.token;
await api('cargarEjemplos', {}, tok);
const b = (await api('bootstrap', {}, tok)).data;
for (let i = 0; i < 6; i++) { const p = b.productos[i % b.productos.length]; await api('venta', { items: [{ productoId: p.id, cantidad: 1 + i % 3, precio: p.precio }], metodo: 'Efectivo', recibido: 2000, clave: 'K' + i }, tok); }
const br = await chromium.launch();
async function pagina(conToken) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  await pg.route(/^https?:\/\/(?!localhost).*/, async rt => {
    if (rt.request().url().indexOf('qvhtlezxjklhwlnvexje.supabase.co/functions/v1/api') < 0) return rt.abort();
    const body = JSON.parse(rt.request().postData() || '{}');
    const r = await api(body.action, body.data, body.token, { panel: body.panel });
    rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r) });
  });
  if (conToken) await pg.addInitScript(t => { localStorage.setItem('gnvm@/|api', 'https://qvhtlezxjklhwlnvexje.supabase.co/functions/v1/api'); localStorage.setItem('gnvm@/|token_sb', t); }, tok);
  return pg;
}
let pg = await pagina(false);
await pg.goto('http://localhost:8765/?servidor=nuevo'); await pg.waitForTimeout(2000);
await pg.screenshot({ path: OUT + '/1-intro.png' });
await pg.getByText('Ingresar').last().click(); await pg.waitForTimeout(800);
await pg.screenshot({ path: OUT + '/1-ingreso.png' });
pg = await pagina(true);
await pg.goto('http://localhost:8765/'); await pg.waitForTimeout(3000);
await pg.screenshot({ path: OUT + '/2-inicio.png' });
await pg.click('.sb-tag'); await pg.waitForTimeout(800);
await pg.screenshot({ path: OUT + '/3-aviso.png' });
await br.close(); srv.close();
console.log('listo');
