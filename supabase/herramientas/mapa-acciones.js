// Calcula qué tablas puede leer cada acción del Codigo.gs (análisis del código: funciones que llama y tablas que nombran)
const fs = require('fs'); const src = fs.readFileSync(process.argv[2], 'utf8');
const grab = n => { const m = src.match(new RegExp('^const ' + n + ' = ([\\s\\S]*?);\\s*$', 'm')); return eval('(' + m[1] + ')'); };
const S = Object.keys(grab('SCHEMA')), M = Object.keys(grab('SCHEMA_M'));
const partes = src.split(/^(?=function [A-Za-z_$][\w$]*\s*\()/m), F = Object.create(null);
partes.forEach(p => { const m = /^function ([A-Za-z_$][\w$]*)/.exec(p); if (m) F[m[1]] = p; });
const nombres = Object.keys(F);
const info = Object.create(null);
nombres.forEach(n => {
  const b = F[n].replace(/\/\/.*$/gm, '');
  const llama = new Set(); (b.match(/[A-Za-z_$][\w$]*(?=\s*\()/g) || []).forEach(x => { if (F[x] && x !== n) llama.add(x); });
  const lit = n === 'masterSheet_' ? new Set() : new Set((b.match(/'([A-Za-z]+)'/g) || []).map(x => x.slice(1, -1)));
  info[n] = { llama, n: S.filter(t => lit.has(t)), m: M.filter(t => lit.has(t)) };
});
const cierre = f => { const vis = new Set(), pila = [f]; while (pila.length) { const x = pila.pop(); if (!F[x] || vis.has(x)) continue; vis.add(x); info[x].llama.forEach(y => pila.push(y)); } return vis; };
// Acciones: case 'x': ... funcionX_( ;  y las de route_
const acc = {};
const ru = F['rutaUsuario_'] || '';
ru.split('\n').forEach(l => { const m = /case '(\w+)':.*?([A-Za-z_]\w*_)\(u/.exec(l); if (m) acc[m[1]] = m[2]; });
(F['route_'] || '').split('\n').forEach(l => { const m = /a === '(\w+)'\)[^;]*?([A-Za-z_]\w*_)\(d/.exec(l); if (m) acc[m[1]] = m[2]; });
acc.login = 'loginMulti_'; acc.panel = 'rutaPanel_';
// Tablas que el código pide con nombres armados en el momento (el análisis no las ve)
const EXTRA = { bootstrap: ['PlanCuentas', 'Asientos'], inicio: ['PlanCuentas', 'Asientos'] };
const base = cierre('auth_');
const out = {};
Object.keys(acc).forEach(a => {
  const v = cierre(acc[a]); if (a !== 'login' && a !== 'registrar') base.forEach(x => v.add(x));
  const n = new Set(), m = new Set(); v.forEach(f => { info[f].n.forEach(t => n.add(t)); info[f].m.forEach(t => m.add(t)); });
  (EXTRA[a] || []).forEach(t => n.add(t));
  out[a] = { n: [...n], m: [...m] };
});
fs.writeFileSync(process.argv[3], 'export default ' + JSON.stringify(out) + ';\n');
const cuenta = Object.entries(out).map(([a, o]) => a + ':' + o.n.length + '/' + o.m.length);
console.log(Object.keys(out).length + ' acciones'); console.log(cuenta.join('  '));
