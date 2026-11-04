// Explorador: abre una vista, ejecuta pasos y vuelca los campos/botones visibles (para armar las pruebas)
import { nuevaPagina, cerrar, esperar, api, db } from './base.mjs';
const pasos = JSON.parse(process.argv[2] || '[]');
const reg = await api('registrar', { negocio: 'Variedades Prueba Total', nombre: 'Vic Prueba', giro: process.env.GIRO || 'variedades', whatsapp: '98765432', pin: '1234' });
const tok = reg.data.token; await api('cargarEjemplos', {}, tok);
const b = (await api('bootstrap', {}, tok)).data; const p = b.productos[0];
const cli = (await api('guardar', { entidad: 'Clientes', registro: { nombre: 'Doña Marta', telefono: '9999-0000', limite: 5000, activo: true } }, tok)).data; const cid = (cli.registro || cli).id;
await api('venta', { items: [{ productoId: p.id, cantidad: 2, precio: p.precio }], metodo: 'Efectivo', recibido: 2000, clave: 'A' }, tok);
await api('venta', { items: [{ productoId: p.id, cantidad: 1, precio: p.precio }], metodo: 'Crédito', clienteId: cid, recibido: 0, clave: 'B' }, tok);
const pg = await nuevaPagina({ token: tok, verApi: true });
await pg.goto('http://localhost:8765/'); await esperar(pg, 8000); await pg.waitForTimeout(1200);
const dump = async () => {
  const d = await pg.evaluate(() => {
    const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const raiz = document.querySelector('.hoja:last-of-type, .modal:last-of-type') || document;
    const inputs = [...document.querySelectorAll('input, select, textarea')].filter(vis).map(i => `${i.tagName.toLowerCase()}#${i.id || '-'}[${i.type || ''}] ph="${i.placeholder || ''}" name=${i.name || '-'} val="${(i.value || '').slice(0, 20)}"${i.tagName === 'SELECT' ? ' opts=' + [...i.options].map(o => o.value).slice(0, 12).join('|') : ''}`);
    const btns = [...document.querySelectorAll('button, [data-a], .li, .ch')].filter(vis).map(x => `${x.tagName.toLowerCase()}${x.className ? '.' + String(x.className).trim().split(/\s+/).join('.') : ''} a=${x.dataset.a || '-'} ${Object.entries(x.dataset).filter(([k]) => k !== 'a').map(([k, v]) => k + '=' + v).join(',')} «${(x.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40)}»`);
    return { inputs, btns: [...new Set(btns)].slice(0, 80), hojas: document.querySelectorAll('.hoja').length };
  });
  console.log('--- hojas abiertas:', d.hojas); console.log('INPUTS:\n ' + d.inputs.join('\n ')); console.log('BOTONES:\n ' + d.btns.join('\n '));
};
for (const paso of pasos) {
  const [op, arg, arg2] = paso.split('::');
  try {
    if (op === 'ir') await pg.ir(arg);
    else if (op === 'a') await pg.accion(arg, 700);
    else if (op === 'click') { await pg.locator(arg).first().click({ timeout: 4000 }); await pg.waitForTimeout(700); }
    else if (op === 'text') { await pg.getByText(arg, { exact: false }).first().click({ timeout: 4000 }); await pg.waitForTimeout(700); }
    else if (op === 'fill') { await pg.locator(arg).first().fill(arg2); await pg.waitForTimeout(300); }
    else if (op === 'eval') { console.log('EVAL:', JSON.stringify(await pg.evaluate(arg)).slice(0, 1500)); }
    else if (op === 'wait') await pg.waitForTimeout(Number(arg));
    console.log('>>', paso, 'OK');
  } catch (e) { console.log('>>', paso, 'FALLÓ', e.message.split('\n')[0]); }
}
await dump();
console.log('TEXTO:', (await pg.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 1500));
await pg.cap('explorar');
await cerrar();
