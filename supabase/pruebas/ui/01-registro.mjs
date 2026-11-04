import { nuevaPagina, ok, cerrar, esperar, api, db } from './base.mjs';
const pg = await nuevaPagina();
await pg.goto('http://localhost:8765/'); await pg.waitForTimeout(1500);
let t = await pg.locator('#login').innerText();
ok('Intro: primera tarjeta visible', /Tu negocio completo en el celular/.test(t), t.slice(0, 120));
await pg.cap('intro-1');
// Pasar las 5 tarjetas
for (let i = 0; i < 6; i++) { const b = pg.locator('[data-a="introSig"]'); if (await b.count()) { await b.first().click(); await pg.waitForTimeout(400); } }
ok('Intro: última tarjeta ofrece crear la cuenta', /Crear mi cuenta gratis/.test(await pg.locator('#login').innerText()));
await pg.cap('intro-5');
await pg.tocar('[data-a="introFin"]');
t = await pg.locator('#login').innerText();
ok('Intro: al terminar aparece el registro', /Crea tu cuenta/.test(t), t.slice(0, 120));
await pg.cap('registro');
// Validaciones del formulario
await pg.fill('#r-neg', 'Variedades Prueba Total');
await pg.fill('#r-nom', 'Vic Prueba');
await pg.fill('#r-wa', '9876');
await pg.fill('#r-pin', '12');
await pg.click('#r-btn'); await pg.waitForTimeout(500);
ok('Registro: PIN corto rechazado', /PIN/.test(await pg.locator('#r-err').innerText()));
await pg.fill('#r-pin', '1234'); await pg.click('#r-btn'); await pg.waitForTimeout(500);
ok('Registro: WhatsApp corto rechazado', /WhatsApp/.test(await pg.locator('#r-err').innerText()));
// Elegir giro con el selector visual
await pg.tocar('[data-a="pickGiro"]');
const nGiros = await pg.locator('.gpick .r').count();
ok('Selector de giro: muestra todos los giros', nGiros >= 17, 'muestra ' + nGiros);
await pg.cap('giros');
await pg.locator('.gpick .r[data-v="variedades"]').click(); await pg.waitForTimeout(400);
ok('Selector de giro: queda elegido', (await pg.inputValue('#r-giro')) === 'variedades');
await pg.fill('#r-wa', '9876-5432'); await pg.fill('#r-pin', '1234');
await pg.click('#r-btn'); await esperar(pg, 8000); await pg.waitForTimeout(1500);
t = await pg.txt();
ok('Registro: entra al Inicio del negocio', /Variedades Prueba Total/.test(t) && !(await pg.locator('#app').isHidden()), t.slice(0, 160));
await pg.cap('inicio-nuevo');
ok('Servidor: negocio creado en Licencias', db.T.Licencias && db.T.Licencias.length === 1 && /prueba/i.test(db.T.Licencias[0].estado), JSON.stringify(db.T.Licencias && db.T.Licencias[0]).slice(0, 200));
// Cerrar sesión e ingresar de nuevo
await pg.accion('mas'); await pg.waitForTimeout(500); await pg.cap('menu-mas');
const menu = await pg.locator('body').innerText();
ok('Menú Más: muestra Salir y la versión', /Salir/.test(menu) && /versión 1\.9\.\d+/.test(menu));
const sesAntes = Object.keys(db.cache).filter(k => k.startsWith('S_') && db.cache[k].e > Date.now()).length;
await pg.accion('logout'); await pg.waitForTimeout(600);
ok('Salir: pide confirmación', /Cerrar sesión en este equipo/.test(await pg.locator('body').innerText()));
await pg.locator('button', { hasText: 'Cerrar sesión' }).last().click(); await pg.waitForTimeout(1000);
await pg.waitForTimeout(800);
const sesDespues = Object.keys(db.cache).filter(k => k.startsWith('S_') && db.cache[k].e > Date.now()).length;
ok('Cerrar sesión: el servidor cerró la sesión (token muerto)', sesAntes === 1 && sesDespues === 0, `sesiones vivas antes ${sesAntes} · después ${sesDespues}`);
ok('Cerrar sesión: vuelve a la pantalla de ingreso (no al registro)', !(await pg.locator('#login').isHidden()) && /^((?!Crea tu cuenta)[\s\S])*$/.test(await pg.locator('#login').innerText()), 'muestra «Crea tu cuenta» (S.lmodo sigue en reg tras registrarse)');
await pg.cap('tras-salir');
const ya = pg.locator('[data-a="lmodo"][data-m="ing"]'); if (await ya.count()) { await ya.first().click(); await pg.waitForTimeout(500); }
await pg.cap('ingreso');
await pg.fill('#l-user', '9876-5432'); await pg.fill('#l-pass', '9999'); await pg.click('#f-log button[type=submit]'); await pg.waitForTimeout(800);
ok('Ingreso: PIN incorrecto da error', (await pg.locator('#l-err').innerText()).length > 3, await pg.locator('#l-err').innerText());
await pg.fill('#l-pass', '1234'); await pg.click('#f-log button[type=submit]'); await esperar(pg, 8000); await pg.waitForTimeout(1200);
ok('Ingreso: PIN correcto entra', /Variedades Prueba Total/.test(await pg.txt()));
await pg.cap('inicio-tras-ingreso');
await cerrar();
