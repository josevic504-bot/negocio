// Base de datos en memoria con el mismo comportamiento que api_cargar / api_aplicar (solo para pruebas locales)
export function dbFalsa(SCHEMA, SCHEMA_M, NUMS, BOOLS) {
  const T = {}, cache = {}, props = {}, vers = {}; let fila = 0;
  const maestra = t => !!SCHEMA_M[t];
  const tipo = (t, k, v) => {
    if (maestra(t)) return k === 'activo' ? !!v : (v === null || v === undefined ? '' : String(v));
    if (NUMS.has(k)) return Number(v) || 0; if (BOOLS.has(k)) return !!v; return v === null || v === undefined ? '' : String(v);
  };
  const vacio = (t) => { const o = {}; (SCHEMA_M[t] || SCHEMA[t]).forEach(k => { o[k] = tipo(t, k, maestra(t) && k !== 'activo' ? '' : undefined); }); return o; };
  const tabla = t => T[t] || (T[t] = []);
  const coincide = (r, op) => Object.keys(op.k).every(k => String(r[k]) === op.k[k]) && (!op.n || r.negocio_id === op.n);
  const j = x => JSON.parse(JSON.stringify(x));
  return {
    T, cache, props, lecturas: 0, escrituras: 0,
    async cargar(p) {
      await new Promise(r => setTimeout(r, Math.random() * 15));
      this.lecturas++;
      const r = { m: {}, n: {}, c: {} };
      (p.m || []).forEach(t => { r.m[t] = j(tabla(t).map(x => { const o = Object.assign({}, x); delete o.negocio_id; return o; })); });
      const n = Object.assign({}, p.n || {});
      if (p.sesion) { const x = cache['S_' + p.sesion]; if (x && x.e > Date.now()) { const neg = x.v.split('|')[0]; if (tabla('Licencias').some(l => l.id === neg)) { n[neg] = (n[neg] || []).concat(p.nSesion || []); r.sesionNeg = neg; } } }
      if (r.sesionNeg) (p.cSesion || []).forEach(k => { p.c = (p.c || []).concat([k.replace('{neg}', r.sesionNeg)]); });
      if (p.nWa) tabla('Accesos').filter(a => String(a.whatsapp) === p.nWa.wa).forEach(a => { n[a.negocioId] = (n[a.negocioId] || []).concat(p.nWa.t); });
      Object.keys(n).forEach(neg => { const o = { _v: vers[neg] || 0 }; [...new Set(n[neg])].forEach(t => { o[t] = j(tabla(t).filter(x => x.negocio_id === neg).map(x => { const y = Object.assign({}, x); delete y.negocio_id; return y; })); }); r.n[neg] = o; });
      (p.c || []).forEach(k => { const x = cache[k]; r.c[k] = x && x.e > Date.now() ? { v: x.v, e: x.e } : null; });
      if (p.props) r.props = Object.assign({}, props);
      return j(r);
    },
    async aplicar(p) {
      await new Promise(r => setTimeout(r, Math.random() * 15));
      p = j(p); this.escrituras++;
      for (const neg of Object.keys(p.v || {})) if ((vers[neg] || 0) !== p.v[neg]) return { conflicto: true, negocio: neg };
      for (const op of p.ops || []) {
        const tb = tabla(op.t);
        if (op.op === 'del') { const i = tb.findIndex(r => coincide(r, op)); if (i >= 0) tb.splice(i, 1); }
        else if (op.op === 'ins') { if (!tb.some(r => coincide(r, op))) { const o = vacio(op.t); Object.keys(op.row).forEach(k => { o[k] = tipo(op.t, k, op.row[k]); }); if (op.n) o.negocio_id = op.n; o._fila = ++fila; tb.push(o); } }
        else { const r = tb.find(x => coincide(x, op)); if (r) Object.keys(op.row).forEach(k => { r[k] = tipo(op.t, k, op.row[k]); }); }
      }
      Object.keys(p.v || {}).forEach(neg => { vers[neg] = (vers[neg] || 0) + 1; });
      (p.c || []).forEach(o => { if (o.op === 'del') delete cache[o.k]; else cache[o.k] = { v: o.v, e: Date.now() + (o.s || 600) * 1000 }; });
      Object.keys(p.props || {}).forEach(k => { if (p.props[k] === null) delete props[k]; else props[k] = p.props[k]; });
      return { ok: true };
    },
    async web(url) { return { texto: JSON.stringify({ result: 'success', rates: { HNL: 26.5 } }), codigo: 200 }; },
    async efecto(e) { (this.efectos || (this.efectos = [])).push(e); }
  };
}
