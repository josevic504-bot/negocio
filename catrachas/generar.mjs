// Tiendas Catrachas · Molina Soluciones Digitales
// Genera las páginas públicas (ya escritas, para que Google las lea) a partir de las tiendas en línea de Negocio VM.
// Uso:  node generar.mjs                → lee las tiendas reales (solo las que encendieron «Aparecer en Tiendas Catrachas»)
//       node generar.mjs --muestra x.json → usa datos de ejemplo (pruebas y capturas)
// No usa claves secretas: la lista sale de una función pública de solo lectura y los productos de la misma
// llamada pública que usa la tienda en línea (por eso salen idénticos).
import { writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SITIO = 'https://molinasoluciones.com';
const TIENDA_URL = process.env.TIENDA_URL || 'https://app.molinasoluciones.com/'; // cambia al mover el repositorio
const API = 'https://qvhtlezxjklhwlnvexje.supabase.co/functions/v1/api';
const SB = 'https://qvhtlezxjklhwlnvexje.supabase.co';
// Llave pública (la misma que ya va en la app): no da acceso a ninguna tabla, solo a la función del directorio
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aHRsZXp4amtsaHdsbnZleGplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0MDg2NTEsImV4cCI6MjEwODk4NDY1MX0.y95iOCUtPiT-KbMDKsbPtCGs1qXG_SWOL_2Vmsv5bZo';
const SALIDA = process.env.SALIDA || 'publico';
const MAX_PROD = 60;

const GIROS = {
  tienda: 'Pulperías y tiendas', variedades: 'Tiendas de variedades', ferreteria: 'Ferreterías', comida: 'Restaurantes y comida',
  boutique: 'Boutiques de ropa y calzado', farmacia: 'Farmacias', vitaminas: 'Vitaminas y suplementos', repuestos: 'Talleres y repuestos',
  carwash: 'Carwash', tecnologia: 'Tecnología y celulares', belleza: 'Salones de belleza', catalogo: 'Maquillaje y moda',
  panaderia: 'Panaderías y reposterías', servicios: 'Servicios', streaming: 'Streaming y suscripciones', compras: 'Compras en línea',
  recargas: 'Recargas de juegos', floristeria: 'Floristerías', manualidades: 'Manualidades y detalles', joyeria: 'Joyerías',
  veterinaria: 'Veterinarias y mascotas', otro: 'Otros negocios'
};

/* ---------- utilidades ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
const txt = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n || 200);
const num = n => Number(n) || 0;
const fmtN = n => num(n).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const titulo = s => txt(s, 40).replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
// Foto: igual que la tienda (dirección https o archivo de Drive). Cualquier otra cosa se descarta.
const fotoSrc = (f, ancho) => {
  f = String(f || '');
  if (!f) return '';
  if (/^https:\/\/[^\s"'<>]+$/i.test(f)) return f;
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(f)) return f;
  if (/^[A-Za-z0-9_-]{10,80}$/.test(f)) return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(f) + '&sz=w' + (ancho || 600);
  return '';
};
const waLink = tel => { const d = String(tel || '').replace(/\D/g, ''); const n = d.length === 8 ? '504' + d : d; return n.length >= 11 ? 'https://wa.me/' + n : ''; };
const linkTienda = (t, extra) => TIENDA_URL + '?tienda=' + encodeURIComponent(t.id) + '&src=catrachas' + (extra || '');

/* ---------- datos ---------- */
async function leerTiendas() {
  const i = process.argv.indexOf('--muestra');
  if (i > 0) return JSON.parse(readFileSync(process.argv[i + 1], 'utf8'));
  const r = await fetch(SB + '/rest/v1/rpc/directorio_tiendas', { method: 'POST', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }, body: '{}' });
  if (!r.ok) throw new Error('No se pudo leer la lista de tiendas: ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const lista = await r.json(), out = []; let fallas = 0;
  for (const x of lista) {
    try {
      const q = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'tiendaInfo', data: { negocio: x.id } }) });
      const j = await q.json();
      if (j && j.ok && j.data && j.data.negocio && j.data.negocio.dir) out.push({ id: x.id, visitas: num(x.visitas), info: j.data });
    } catch (e) { fallas++; console.error('Tienda ' + x.id + ' omitida: ' + e.message); }
  }
  // Si el servidor falló con todas, no se publica una página vacía: se conserva la anterior
  if (fallas && !out.length) throw new Error('El servidor no respondió: no se actualiza la página');
  return out;
}

function preparar(crudas) {
  const reservados = new Set(['en', ...Object.values(GIROS).map(slug)]), usados = new Set();
  return crudas.map(c => {
    const n = c.info.negocio, gs = [...new Set([n.gid, ...(n.giros || []).map(g => g.id)])].filter(g => GIROS[g]);
    let s = slug(n.nombre) || 'tienda';
    if (reservados.has(s) || usados.has(s)) s = s + '-' + slug(c.id);
    usados.add(s);
    const ciudad = titulo(n.dir.ciudad);
    return {
      id: String(c.id), visitas: c.visitas, slug: s, nombre: txt(n.nombre, 80) || 'Tienda', giros: gs.length ? gs : ['otro'], giroN: txt(n.giro, 60),
      ciudad, ciudadSlug: slug(ciudad), frase: txt(n.dir.frase, 80) || txt(n.eslogan, 80) || txt(n.sobre, 80),
      sobre: txt(n.sobre, 300), portada: fotoSrc(n.portada, 1400), horario: txt(n.horario, 80), telefono: n.telefono, moneda: txt(n.moneda, 4) || 'L',
      entrega: n.entrega === 'domicilio' ? 'A domicilio' : n.entrega === 'recoger' ? 'Para recoger' : 'A domicilio y para recoger',
      pagos: (n.pagos || []).map(p => txt(p, 20)).filter(Boolean).join(' · '), direccion: txt(n.direccion, 120),
      productos: (c.info.productos || []).map(p => {
        const ps = p.vars ? Object.values(p.vars).map(v => num(v.p) || num(p.precio)) : [num(p.precio)];
        const desde = Math.min(...ps, num(p.precio)), max = Math.max(...ps, num(p.precio));
        return { nombre: txt(p.nombre, 90), cat: txt(p.sub || p.categoria, 40), foto: fotoSrc(p.foto), precio: p.vars ? desde : num(p.precio), desde: !!p.vars && desde < max,
          agotado: !!p.agotado, nuevo: !!p.nuevo && !p.agotado, stock: p.stock, esp: num(p.precioEsp) > 0 && num(p.minEsp) > 1 ? { p: num(p.precioEsp), m: num(p.minEsp) } : null };
      })
    };
  }).filter(t => t.ciudad).sort((a, b) => b.visitas - a.visitas || a.nombre.localeCompare(b.nombre, 'es'));
}

/* ---------- piezas de página ---------- */
const CSS = readFileSync(new URL('./estilo.css', import.meta.url), 'utf8');
const jsonld = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
function pagina({ ruta, title, desc, cuerpo, ld, img }) {
  const url = SITIO + ruta;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:locale" content="es_HN">
${img && /^https:/.test(img) ? `<meta property="og:image" content="${esc(img)}">` : ''}
<meta name="theme-color" content="#6B1437">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap">
<link rel="stylesheet" href="/tiendas/estilo.css">
${ld ? jsonld(ld) : ''}
</head>
<body>
<header class="top"><a class="marca" href="/tiendas/"><span class="sello" aria-hidden="true">M</span><span><b>Tiendas Catrachas</b><small>MOLINA SOLUCIONES DIGITALES</small></span></a><a class="cta-top" href="${esc(TIENDA_URL)}?src=catrachas">Crea tu tienda · 7 días gratis</a></header>
<main>
${cuerpo}
</main>
<footer class="pie"><p>Cada tienda es responsable de sus productos, precios y entregas.</p><p><a href="/tiendas/">Tiendas Catrachas</a> · Molina Soluciones Digitales</p></footer>
<script>(window.mvq = window.mvq || []).push('catrachas')</script>
<script src="${esc(TIENDA_URL)}visitas.js?v=1" defer></script>
</body>
</html>
`;
}
const migas = l => `<nav class="migas" aria-label="Estás en">${l.map(([t, h]) => h ? `<a href="${esc(h)}">${esc(t)}</a>` : `<span>${esc(t)}</span>`).join(' › ')}</nav>`;
const iniciales = s => esc(txt(s, 40).split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase());
function tarjeta(t) {
  const g = GIROS[t.giros[0]];
  return `<article class="tarjeta" data-q="${esc((t.nombre + ' ' + t.giros.map(x => GIROS[x]).join(' ') + ' ' + t.giroN + ' ' + t.ciudad + ' ' + t.frase).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))}" data-c="${esc(t.ciudadSlug)}">
<a class="portada" href="/tiendas/${esc(t.slug)}/" tabindex="-1" aria-hidden="true">${t.portada ? `<img src="${esc(t.portada)}" alt="" loading="lazy">` : `<span>${iniciales(t.nombre)}</span>`}</a>
<div class="cuerpo"><h3><a href="/tiendas/${esc(t.slug)}/">${esc(t.nombre)}</a></h3><p class="meta">${esc(g)} · ${esc(t.ciudad)}</p>${t.frase ? `<p class="frase">${esc(t.frase)}</p>` : ''}<a class="btn" href="/tiendas/${esc(t.slug)}/">Ver tienda</a></div>
</article>`;
}
const rejilla = l => l.length ? `<div class="rejilla" id="lista">${l.map(tarjeta).join('\n')}</div><p class="vacio" id="nada" hidden>No encontramos tiendas con esa búsqueda.</p>` : `<p class="vacio">Pronto verás aquí las primeras tiendas.</p>`;
const chips = l => l.length ? `<div class="chips">${l.map(([t, h, on]) => `<a class="chip${on ? ' on' : ''}" href="${esc(h)}">${esc(t)}</a>`).join('')}</div>` : '';
const invita = (t, p) => `<section class="invita"><h2>${esc(t)}</h2><p>${esc(p)}</p><a class="btn oro" href="${esc(TIENDA_URL)}?src=catrachas">Probar gratis 7 días</a></section>`;
const listaLd = (nombre, l) => ({ '@context': 'https://schema.org', '@type': 'ItemList', name: nombre, itemListElement: l.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.nombre, url: SITIO + '/tiendas/' + t.slug + '/' })) });
const FILTRO = `<script>
(function () {
  var q = document.getElementById('buscar'), c = document.getElementById('ciudad'), l = document.getElementById('lista'), n = document.getElementById('nada');
  if (!l) return;
  var norm = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, ''); };
  function f() { var t = norm(q && q.value).trim(), ci = c ? c.value : '', v = 0;
    [].forEach.call(l.children, function (a) { var ok = (!t || a.getAttribute('data-q').indexOf(t) >= 0) && (!ci || a.getAttribute('data-c') === ci); a.hidden = !ok; if (ok) v++; });
    if (n) n.hidden = v > 0; }
  if (q) q.addEventListener('input', f); if (c) c.addEventListener('change', f);
})();
</script>`;

function producto(t, p) {
  const et = p.agotado ? '<span class="et out">Agotado</span>' : p.stock !== undefined ? `<span class="et">${esc(String(Math.floor(num(p.stock))))} disp.</span>` : '';
  return `<a class="prod${p.agotado ? ' dis' : ''}" href="${esc(linkTienda(t))}"><div class="ph">${p.foto ? `<img src="${esc(p.foto)}" alt="${esc(p.nombre)}" loading="lazy">` : `<span>${iniciales(p.nombre)}</span>`}${p.nuevo ? '<span class="nw">Nuevo</span>' : ''}${et}</div>
<div class="bd">${p.cat ? `<div class="cat">${esc(p.cat)}</div>` : ''}<div class="nm">${esc(p.nombre)}</div><div class="pr">${p.desde ? '<small>desde </small>' : ''}${esc(t.moneda)}&nbsp;${fmtN(p.precio)}</div>${p.esp ? `<div class="esp">${esc(t.moneda)}&nbsp;${fmtN(p.esp.p)} desde ${p.esp.m} piezas</div>` : ''}</div></a>`;
}

/* ---------- generar ---------- */
const archivos = {};
const poner = (ruta, html) => { archivos[ruta.replace(/\/$/, '/index.html')] = html; };

function generar(T) {
  const ciudades = [...new Map(T.map(t => [t.ciudadSlug, t.ciudad])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  const girosCon = Object.keys(GIROS).filter(g => T.some(t => t.giros.includes(g)));
  const selCiudad = ciudades.length > 1 ? `<label class="sel"><span class="oculto">Ciudad</span><select id="ciudad"><option value="">Todas las ciudades</option>${ciudades.map(([s, n]) => `<option value="${esc(s)}">${esc(n)}</option>`).join('')}</select></label>` : '';
  const buscador = `<div class="buscar"><label class="caja"><span class="oculto">Buscar tienda</span><input id="buscar" type="search" placeholder="Busca una tienda o un tipo de negocio" autocomplete="off"></label>${selCiudad}</div>`;
  const urls = [];

  // Portada del directorio
  poner('/tiendas/', pagina({ ruta: '/tiendas/', title: 'Tiendas Catrachas · Tiendas en línea de Honduras', desc: 'Negocios de Honduras con su tienda en línea: mira su catálogo y haz tu pedido directo con el negocio.',
    ld: listaLd('Tiendas Catrachas', T),
    cuerpo: `<section class="hero"><h1>Tiendas en línea de Honduras</h1><p>Negocios catrachos con su tienda en línea. Entra, mira el catálogo y haz tu pedido directo con el negocio.</p>${buscador}</section>
<section class="cont">${chips([['Todos', '/tiendas/', true], ...girosCon.map(g => [GIROS[g], '/tiendas/' + slug(GIROS[g]) + '/'])])}
<p class="cuenta">${T.length} ${T.length === 1 ? 'tienda' : 'tiendas'} · primero las más visitadas</p>
${rejilla(T)}
${invita('¿Tienes un negocio?', 'Crea tu tienda en línea con Gestión de Negocio VM: catálogo, pedidos, inventario y caja en un solo programa. Y aparece aquí.')}</section>${FILTRO}` }));
  urls.push('/tiendas/');

  // Por tipo de negocio, y por tipo de negocio + ciudad
  girosCon.forEach(g => {
    const gn = GIROS[g], gs = slug(gn), l = T.filter(t => t.giros.includes(g)), cs = ciudades.filter(([s]) => l.some(t => t.ciudadSlug === s));
    poner(`/tiendas/${gs}/`, pagina({ ruta: `/tiendas/${gs}/`, title: `${gn} en Honduras · Tiendas Catrachas`, desc: `${gn} de Honduras con tienda en línea. Mira lo que ofrecen y haz tu pedido directo con el negocio.`, ld: listaLd(gn + ' en Honduras', l),
      cuerpo: `<section class="cont">${migas([['Tiendas', '/tiendas/'], [gn]])}<h1>${esc(gn)} en Honduras</h1><p class="intro">${esc(gn)} con tienda en línea. Mira lo que ofrecen y haz tu pedido directo con el negocio.</p>
${cs.length ? `<h2 class="sub">Por ciudad</h2>${chips(cs.map(([s, n]) => [n, `/tiendas/${gs}/${s}/`]))}` : ''}
<p class="cuenta">${l.length} ${l.length === 1 ? 'tienda' : 'tiendas'}</p>${rejilla(l)}</section>` }));
    urls.push(`/tiendas/${gs}/`);
    cs.forEach(([s, n]) => {
      const lc = l.filter(t => t.ciudadSlug === s), otras = cs.filter(([x]) => x !== s), otros = girosCon.filter(x => x !== g && T.some(t => t.ciudadSlug === s && t.giros.includes(x)));
      poner(`/tiendas/${gs}/${s}/`, pagina({ ruta: `/tiendas/${gs}/${s}/`, title: `${gn} en ${n} · Tiendas Catrachas`, desc: `${gn} de ${n}, Honduras, con tienda en línea. Mira lo que ofrecen y haz tu pedido directo con el negocio.`, ld: listaLd(`${gn} en ${n}`, lc),
        cuerpo: `<section class="cont">${migas([['Tiendas', '/tiendas/'], [gn, `/tiendas/${gs}/`], [n]])}<h1>${esc(gn)} en ${esc(n)}</h1><p class="intro">${esc(gn)} de ${esc(n)} con tienda en línea. Mira lo que ofrecen y haz tu pedido directo con el negocio.</p>
<p class="cuenta">${lc.length} ${lc.length === 1 ? 'tienda' : 'tiendas'}</p>${rejilla(lc)}
${otras.length ? `<h2 class="sub">${esc(gn)} en otras ciudades</h2>${chips(otras.map(([x, xn]) => [xn, `/tiendas/${gs}/${x}/`]))}` : ''}
${otros.length ? `<h2 class="sub">Más tiendas en ${esc(n)}</h2>${chips(otros.map(x => [GIROS[x], `/tiendas/${slug(GIROS[x])}/${s}/`]))}` : ''}
${invita('¿Tienes un negocio en ' + n + '?', 'Crea tu tienda en línea y aparece en esta página.')}</section>` }));
      urls.push(`/tiendas/${gs}/${s}/`);
    });
  });

  // Por ciudad
  ciudades.forEach(([s, n]) => {
    const l = T.filter(t => t.ciudadSlug === s);
    poner(`/tiendas/en/${s}/`, pagina({ ruta: `/tiendas/en/${s}/`, title: `Tiendas en línea en ${n} · Tiendas Catrachas`, desc: `Negocios de ${n}, Honduras, con tienda en línea. Mira su catálogo y haz tu pedido directo con el negocio.`, ld: listaLd('Tiendas en ' + n, l),
      cuerpo: `<section class="cont">${migas([['Tiendas', '/tiendas/'], [n]])}<h1>Tiendas en línea en ${esc(n)}</h1><p class="intro">Negocios de ${esc(n)} con tienda en línea.</p><p class="cuenta">${l.length} ${l.length === 1 ? 'tienda' : 'tiendas'}</p>${rejilla(l)}</section>` }));
    urls.push(`/tiendas/en/${s}/`);
  });

  // Ficha de cada tienda
  T.forEach(t => {
    const g = t.giros[0], gn = GIROS[g], gs = slug(gn), wa = waLink(t.telefono), ps = t.productos.slice(0, MAX_PROD);
    const desc = txt(`${t.frase || gn + ' en ' + t.ciudad}. Pide desde tu celular y coordina la entrega directo con el negocio.`, 160);
    const datos = [['Horario', t.horario], ['Entrega', t.entrega], ['Formas de pago', t.pagos], ['Dirección', t.direccion]].filter(x => x[1]);
    poner(`/tiendas/${t.slug}/`, pagina({ ruta: `/tiendas/${t.slug}/`, title: `${t.nombre} · ${gn} en ${t.ciudad}`, desc, img: t.portada,
      ld: { '@context': 'https://schema.org', '@type': 'Store', name: t.nombre, description: desc, url: SITIO + '/tiendas/' + t.slug + '/', ...(t.portada && /^https:/.test(t.portada) ? { image: t.portada } : {}),
        address: { '@type': 'PostalAddress', addressLocality: t.ciudad, addressCountry: 'HN', ...(t.direccion ? { streetAddress: t.direccion } : {}) } },
      cuerpo: `<section class="cont ficha">${migas([['Tiendas', '/tiendas/'], [gn, `/tiendas/${gs}/`], [t.ciudad, `/tiendas/${gs}/${t.ciudadSlug}/`]])}
<div class="portada-f">${t.portada ? `<img src="${esc(t.portada)}" alt="${esc(t.nombre)}">` : `<span>${iniciales(t.nombre)}</span>`}</div>
<h1>${esc(t.nombre)}</h1><p class="meta">${esc(gn)} · ${esc(t.ciudad)}</p>
${t.frase ? `<p class="intro">${esc(t.frase)}</p>` : ''}${t.sobre && t.sobre !== t.frase ? `<p class="sobre">${esc(t.sobre)}</p>` : ''}
<div class="acciones"><a class="btn grande" href="${esc(linkTienda(t))}">Entrar a la tienda</a>${wa ? `<a class="btn linea" href="${esc(wa)}" rel="nofollow noopener">Escribir por WhatsApp</a>` : ''}</div>
${datos.length ? `<dl class="datos">${datos.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
${ps.length ? `<h2 class="sub">Productos</h2><div class="prods">${ps.map(p => producto(t, p)).join('\n')}</div>${t.productos.length > ps.length ? `<p class="mas"><a class="btn linea" href="${esc(linkTienda(t))}">Ver los ${t.productos.length} productos en la tienda</a></p>` : ''}` : ''}
<div class="caja-l"><h2>Más en ${esc(t.ciudad)}</h2><a href="/tiendas/${gs}/${esc(t.ciudadSlug)}/">${esc(gn)} en ${esc(t.ciudad)}</a><a href="/tiendas/en/${esc(t.ciudadSlug)}/">Todas las tiendas de ${esc(t.ciudad)}</a></div>
<p class="hecho">Tienda creada con Gestión de Negocio VM · <a href="${esc(TIENDA_URL)}?src=catrachas">Crea la tuya</a></p></section>` }));
    urls.push(`/tiendas/${t.slug}/`);
  });

  archivos['/tiendas/estilo.css'] = CSS;
  archivos['/sitemap.xml'] = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${esc(SITIO + u)}</loc></url>`).join('\n')}\n</urlset>\n`;
  archivos['/robots.txt'] = `User-agent: *\nAllow: /\nSitemap: ${SITIO}/sitemap.xml\n`;
  archivos['/CNAME'] = 'molinasoluciones.com\n';
  archivos['/404.html'] = pagina({ ruta: '/404.html', title: 'Página no encontrada · Tiendas Catrachas', desc: 'Esta página ya no existe.', cuerpo: `<section class="cont"><h1>Esta página ya no existe</h1><p class="intro">Puede que la tienda haya dejado de aparecer aquí.</p><p><a class="btn" href="/tiendas/">Ver todas las tiendas</a></p></section>` });
  // Página de inicio del dominio: provisional, hasta que exista la página de marca
  archivos['/index.html'] = pagina({ ruta: '/', title: 'Molina Soluciones Digitales · Programas para negocios de Honduras', desc: 'Programas de ventas, inventario y tienda en línea para negocios de Honduras. Conoce Tiendas Catrachas.',
    cuerpo: `<section class="hero"><h1>Molina Soluciones Digitales</h1><p>Programas de ventas, inventario y tienda en línea para negocios de Honduras.</p><p class="dos"><a class="btn oro" href="/tiendas/">Ver Tiendas Catrachas</a> <a class="btn linea claro" href="${esc(TIENDA_URL)}?src=catrachas">Conocer Gestión de Negocio VM</a></p></section>` });
  return urls.length;
}

const crudas = await leerTiendas();
const T = preparar(crudas);
const n = generar(T);
rmSync(SALIDA, { recursive: true, force: true });
for (const [ruta, html] of Object.entries(archivos)) { const f = join(SALIDA, ruta); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, html); }
console.log(`Tiendas: ${T.length} · páginas: ${n} · archivos: ${Object.keys(archivos).length}`);
