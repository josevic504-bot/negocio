// En la app instalada, «Ver su tienda» del Panel y «Ver» de la app abren la tienda en la misma ventana
import { nuevaPagina, ok, cerrar, esperar, api, db } from './base.mjs';
const reg = await api('registrar', { negocio: 'Belleza Demo', nombre: 'Demo', giro: 'catalogo', whatsapp: '98765432', pin: '1234' }); const tok = reg.data.token;
await api('guardar', { entidad: 'Config', registro: { tienda: 'si' } }, tok);
const N = db.T.Licencias[0].id;
const instalada = () => { const m = window.matchMedia.bind(window); window.matchMedia = q => /display-mode: standalone/.test(q) ? { matches: true, addEventListener() {}, removeEventListener() {} } : m(q); };
// App del negocio
const pg = await nuevaPagina({ token: tok }); await pg.addInitScript(instalada); await pg.goto('http://localhost:8765/'); await esperar(pg, 8000); await pg.waitForTimeout(800);
await pg.ir('pedidos');
const ver = pg.locator('a[target="_blank"][href*="?tienda="]').first(); ok('App: hay enlace Ver', await ver.count() === 1);
const pops = []; pg.context().on('page', p => pops.push(p));
await ver.click(); await pg.waitForTimeout(1500);
ok('App instalada: abre la tienda en la misma ventana', /\?tienda=/.test(pg.url()) && pops.length === 0, pg.url() + ' popups ' + pops.length);
// En el navegador normal sigue abriendo pestaña nueva
const pg2 = await nuevaPagina({ token: tok }); await pg2.goto('http://localhost:8765/'); await esperar(pg2, 8000); await pg2.waitForTimeout(800); await pg2.ir('pedidos');
const [nueva] = await Promise.all([pg2.context().waitForEvent('page', { timeout: 5000 }).catch(() => null), pg2.locator('a[target="_blank"][href*="?tienda="]').first().click()]);
ok('Navegador: sigue abriendo pestaña nueva', !!nueva && !/\?tienda=/.test(pg2.url()));
await cerrar(); process.exit(0);
