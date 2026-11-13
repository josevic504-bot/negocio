import { ok } from './base.mjs';
// Ejecuta un paso; si falla, registra la falla con el texto de pantalla y un volcado de campos/botones
export async function paso(pg, nombre, fn) {
  try { const r = await fn(); if (r === false) throw new Error('condición no cumplida'); ok(nombre, true); return true; }
  catch (e) {
    if (!pg) { ok(nombre, false, e.message.split('\n')[0].slice(0, 300)); return false; }
    const txt = (await pg.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
    const d = await dump(pg).catch(() => '');
    ok(nombre, false, e.message.split('\n')[0].slice(0, 160) + ' | pantalla: ' + txt.slice(0, 200));
    console.log('     [volcado] ' + d.slice(0, 1800));
    await pg.cap('FALLA-' + nombre.replace(/[^a-z0-9]+/gi, '_').slice(0, 40));
    // cerrar hojas abiertas para seguir
    try { await pg.evaluate(() => { try { cerrarHojas(); } catch (e) {} }); } catch (e) {}
    return false;
  }
}
export async function dump(pg) {
  return pg.evaluate(() => {
    const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const inputs = [...document.querySelectorAll('input, select, textarea')].filter(vis).map(i => `${i.tagName.toLowerCase()}#${i.id || '-'}[${i.type || ''}] ph="${i.placeholder || ''}"${i.tagName === 'SELECT' ? ' opts=' + [...i.options].map(o => o.value).slice(0, 10).join('|') : ''}`);
    const btns = [...document.querySelectorAll('button, [data-a]')].filter(vis).map(x => `${x.tagName.toLowerCase()} a=${x.dataset.a || '-'} ${Object.entries(x.dataset).filter(([k]) => k !== 'a').map(([k, v]) => k + '=' + v).join(',')} «${(x.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30)}»`);
    return 'INPUTS: ' + inputs.join(' ; ') + ' || BOTONES: ' + [...new Set(btns)].join(' ; ');
  });
}
export const texto = async pg => (await pg.locator('body').innerText()).replace(/\s+/g, ' ');
export const tiene = async (pg, re) => re.test(await texto(pg));
export async function btn(pg, texto, ms = 700) {
  const re = texto instanceof RegExp ? texto.source : texto, flags = texto instanceof RegExp ? texto.flags : '';
  const r = await pg.evaluate(([re, flags, exacto]) => { const rx = new RegExp(re, flags); const els = [...document.querySelectorAll('button, a.btn')].filter(e => e.getBoundingClientRect().width > 0 && (exacto ? rx.test((e.innerText || '').trim()) : rx.test(e.innerText || ''))); if (!els.length) return false; els[els.length - 1].click(); return els[els.length - 1].innerText.trim().slice(0, 40); }, [re, flags, !(texto instanceof RegExp)]);
  if (r === false) throw new Error('no hay botón visible «' + re + '»');
  await pg.waitForTimeout(ms);
}
export async function confirmarSi(pg) { const b = pg.locator('.confirm button, .modal button, [data-a="si"], button.pri').last(); await b.click({ timeout: 3000 }); await pg.waitForTimeout(600); }
