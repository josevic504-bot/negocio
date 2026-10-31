/* Contador de visitas · Molina Soluciones Digitales
 * Se usa en todas las páginas (catálogo, Negocio VM, Salón VM, Eventos VM). Uso en otra página:
 *   <script>(window.mvq = window.mvq || []).push('catalogo')</script>
 *   <script src="https://josevic504-bot.github.io/negocio/visitas.js?v=1" defer></script>
 * Manda al servidor de Negocio VM (Supabase) la página, de dónde vino (?src=tiktok, ?src=wa, …) y si es celular o PC.
 * No guarda nombres, teléfonos ni nada personal: solo un número al azar del navegador para contar personas distintas.
 * No cuenta: el navegador de Vic (marcado al abrir el Panel Molina) ni a quien ya usa un programa (marcado al iniciar sesión).
 * El mismo navegador cuenta una sola vez cada 30 minutos por página. */
(function () {
  var API = 'https://qvhtlezxjklhwlnvexje.supabase.co/functions/v1/api';
  var L = {}, ss = {};
  try { L = window.localStorage; ss = window.sessionStorage; } catch (e) {}
  var get = function (s, k) { try { return s.getItem(k) || ''; } catch (e) { return ''; } };
  var set = function (s, k, v) { try { s.setItem(k, v); } catch (e) {} };

  // De dónde vino: ?src= (o utm_source), la app donde se abrió (TikTok, Facebook…) o el sitio anterior
  function origen() {
    var q = new URLSearchParams(location.search), s = q.get('src') || q.get('utm_source') || q.get('fuente') || '';
    if (s) { set(ss, 'mv_src', s); return s; }
    if (get(ss, 'mv_src')) return get(ss, 'mv_src');
    var ua = navigator.userAgent || '', r = '';
    try { r = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) {}
    var o = /musical_ly|bytedance|tiktok/i.test(ua) || /tiktok/.test(r) ? 'tiktok'
      : /instagram/i.test(ua) || /instagram/.test(r) ? 'instagram'
      : /FBAN|FBAV|FB_IAB|FBIOS/i.test(ua) || /facebook|fb\.com|fb\.me/.test(r) ? 'facebook'
      : /whatsapp/i.test(ua) || /whatsapp|wa\.me/.test(r) ? 'wa'
      : /google\./.test(r) ? 'google' : /youtube/.test(r) ? 'youtube'
      : r && r === location.hostname ? 'mis-paginas' : r ? 'otro-sitio' : 'directo';
    set(ss, 'mv_src', o);
    return o;
  }
  var ORIGEN = origen(); // se calcula al cargar, antes de que la página limpie la dirección
  // El último canal real con el que llegó este navegador (WhatsApp, Facebook, TikTok…) se recuerda 30 días:
  // así, si se registra días después entrando directo, igual se sabe por dónde llegó
  if (['directo', 'mis-paginas', 'otro-sitio'].indexOf(ORIGEN) < 0) set(L, 'mv_canal', ORIGEN + '|' + Date.now());
  window.mvOrigen = function () {
    var c = get(L, 'mv_canal').split('|'), ok = c[0] && Date.now() - Number(c[1] || 0) < 30 * 86400000;
    return { o: ok ? c[0] : ORIGEN, v: get(L, 'mv_vid') };
  };

  function vid() {
    var v = get(L, 'mv_vid');
    if (!v) { v = Date.now().toString(36) + Math.random().toString(36).slice(2, 10); set(L, 'mv_vid', v); }
    return v;
  }

  window.mvVisita = function (pagina) {
    try {
      if (!pagina || get(L, 'mv_yo') || get(L, 'mv_cliente')) return;
      if (/^(localhost|127\.|192\.168\.)/.test(location.hostname) || location.protocol === 'file:') return;
      var k = 'mv_t_' + pagina, ult = Number(get(L, k) || 0);
      if (Date.now() - ult < 30 * 60000) return;
      set(L, k, String(Date.now()));
      var ref = ''; try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) {}
      var cuerpo = JSON.stringify({ action: 'visita', data: { p: pagina, o: ORIGEN, d: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'cel' : 'pc', v: vid(), r: ref } });
      var ok = false;
      try { ok = navigator.sendBeacon && navigator.sendBeacon(API, cuerpo); } catch (e) {}
      if (!ok) fetch(API, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain' }, body: cuerpo }).catch(function () {});
    } catch (e) {}
  };
  // Marcas: Vic (no se cuenta) y clientes con sesión (no se cuentan)
  window.mvSoyYo = function () { set(L, 'mv_yo', '1'); };
  window.mvSoyCliente = function () { set(L, 'mv_cliente', '1'); };

  var cola = window.mvq || [];
  window.mvq = { push: function (p) { window.mvVisita(p); } };
  for (var i = 0; i < cola.length; i++) window.mvVisita(cola[i]);
})();
