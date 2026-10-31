/* Convierte el HTML sencillo de los contratos (títulos, párrafos con negritas, firmas como imagen y la tabla del recibo) en un PDF.
   Reemplaza a Utilities.newBlob(html).getAs('application/pdf') de Apps Script. Usa jsPDF. */
export function htmlAPdf(jsPDF, html) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 56, ANCHO = W - 2 * M;
  let y = M;
  const ent = s => String(s).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const salto = h => { if (y + h > H - M) { doc.addPage(); y = M; } };
  const cuerpo = String(html).replace(/^[\s\S]*?<body[^>]*>/i, '').replace(/<\/body>[\s\S]*$/i, '').replace(/<style[\s\S]*?<\/style>/gi, '');

  // Escribe una serie de trozos de texto (con negrita o no) ajustando las líneas al ancho
  function parrafo(trozos, o = {}) {
    const tam = o.tam || 11, alto = tam * 1.45;
    const palabras = [];
    trozos.forEach(t => ent(t.t).split(/(\s+)/).forEach(w => { if (w) palabras.push({ w, b: t.b, i: t.i }); }));
    const lineas = []; let linea = [], ancho = 0;
    const medir = p => { doc.setFont('helvetica', p.b ? (p.i ? 'bolditalic' : 'bold') : (p.i ? 'italic' : 'normal')); doc.setFontSize(tam); return doc.getTextWidth(p.w); };
    palabras.forEach(p => {
      if (/^\s+$/.test(p.w)) { if (linea.length) { linea.push({ w: ' ', b: p.b, i: p.i }); ancho += medir({ w: ' ', b: p.b }); } return; }
      const a = medir(p);
      if (ancho + a > (o.ancho || ANCHO) && linea.length) { while (linea.length && linea[linea.length - 1].w === ' ') linea.pop(); lineas.push(linea); linea = []; ancho = 0; }
      linea.push(p); ancho += a;
    });
    if (linea.length) lineas.push(linea);
    lineas.forEach(l => {
      salto(alto);
      const total = l.reduce((s, p) => s + medir(p), 0);
      let x = (o.x || M) + (o.centro ? ((o.ancho || ANCHO) - total) / 2 : 0);
      l.forEach(p => { const a = medir(p); doc.setTextColor(o.gris ? 110 : 34); doc.text(p.w, x, y + tam); x += a; });
      y += alto;
    });
    doc.setTextColor(34);
  }
  const trozosDe = h => {
    const out = []; let b = false, i = false;
    h.replace(/<br\s*\/?>/gi, ' ').split(/(<[^>]+>)/).forEach(t => {
      if (/^<b\b|^<strong\b/i.test(t)) b = true; else if (/^<\/b>|^<\/strong>/i.test(t)) b = false;
      else if (/font-family:cursive/i.test(t)) i = true; else if (/^<\/span>/i.test(t)) i = false;
      else if (!/^</.test(t) && t) out.push({ t, b, i });
    });
    return out;
  };
  const texto = h => ent(h.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

  // Encabezado (empresa a la izquierda, número y fecha a la derecha)
  const cab = /<div class="cdoc-h">([\s\S]*?)<\/div><div class="cdoc-ref">([\s\S]*?)<\/div><\/div>/.exec(cuerpo);
  let resto = cuerpo;
  if (cab) {
    const izq = cab[1].match(/<b>([\s\S]*?)<\/b>|<small>([\s\S]*?)<\/small>/g) || [];
    const der = cab[2].match(/<small>([\s\S]*?)<\/small>/g) || [];
    const y0 = y;
    izq.forEach((t, k) => { doc.setFont('helvetica', k ? 'normal' : 'bold'); doc.setFontSize(k ? 9 : 12); doc.setTextColor(k ? 110 : 34); doc.text(texto(t), M, y + (k ? 26 : 12)); });
    der.forEach((t, k) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110); doc.text(texto(t), W - M, y + 10 + k * 13, { align: 'right' }); });
    y = y0 + 40; doc.setDrawColor(200); doc.line(M, y, W - M, y); y += 10; doc.setTextColor(34);
    resto = cuerpo.slice(cab.index + cab[0].length);
  }

  // El resto del documento, en orden
  const bloques = resto.match(/<h1[^>]*>[\s\S]*?<\/h1>|<h2[^>]*>[\s\S]*?<\/h2>|<p[^>]*>[\s\S]*?<\/p>|<div class="cdoc-firmas">[\s\S]*?(?=<div class="cdoc-rec">|$)|<table[\s\S]*?<\/table>|<small[^>]*>[\s\S]*?<\/small>/g) || [];
  bloques.forEach(bq => {
    if (/^<h1/.test(bq)) { y += 8; parrafo([{ t: texto(bq), b: true }], { tam: 15, centro: true }); y += 6; }
    else if (/^<h2/.test(bq)) { y += 14; parrafo([{ t: texto(bq), b: true }], { tam: 13 }); }
    else if (/^<p/.test(bq)) { parrafo(trozosDe(bq.replace(/^<p[^>]*>|<\/p>$/g, ''))); y += 4; }
    else if (/^<small/.test(bq)) { parrafo([{ t: texto(bq) }], { tam: 9, gris: true }); y += 2; }
    else if (/^<div class="cdoc-firmas">/.test(bq)) {
      // Dos firmas lado a lado: imagen o nombre en letra cursiva, línea y datos debajo
      salto(120); y += 18;
      const firmas = bq.split(/<div class="cdoc-f[ "]/).slice(1), col = ANCHO / 2;
      let maxY = y;
      firmas.slice(0, 2).forEach((f, k) => {
        const x = M + k * col, img = /<img src="(data:image\/(png|jpeg);base64,[^"]+)"/.exec(f);
        let yy = y;
        if (img) { try { doc.addImage(img[1], img[2] === 'png' ? 'PNG' : 'JPEG', x + 10, yy, col - 40, 48); } catch (e) {} }
        else { const cur = /<span[^>]*>([\s\S]*?)<\/span>/.exec(f); if (cur) { doc.setFont('helvetica', 'italic'); doc.setFontSize(14); doc.setTextColor(60); doc.text(texto(cur[1]), x + (col - 20) / 2, yy + 34, { align: 'center' }); } }
        yy += 54; doc.setDrawColor(120); doc.line(x + 10, yy, x + col - 30, yy); yy += 14;
        const nom = /<b>([\s\S]*?)<\/b>/.exec(f.slice(f.indexOf('</div>'))), peq = f.slice(f.indexOf('</div>')).match(/<small>([\s\S]*?)<\/small>/g) || [];
        if (nom) { doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(34); doc.text(texto(nom[1]), x + (col - 20) / 2, yy, { align: 'center' }); yy += 13; }
        peq.forEach(s => { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(110); doc.text(texto(s), x + (col - 20) / 2, yy, { align: 'center' }); yy += 11; });
        maxY = Math.max(maxY, yy);
      });
      y = maxY + 10; doc.setTextColor(34);
    }
    else if (/^<table/.test(bq)) {
      const filas = (bq.match(/<tr[\s\S]*?<\/tr>/g) || []).map(tr => (tr.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/g) || []).map(c => ({ t: texto(c), th: /^<th/.test(c) || /<b>/.test(c), n: /class="n"/.test(c) })));
      const n = Math.max(1, ...filas.map(f => f.length)), anchos = n === 4 ? [0.18, 0.42, 0.2, 0.2] : Array(n).fill(1 / n);
      y += 6;
      filas.forEach(f => {
        const lineas = f.map((c, k) => { doc.setFont('helvetica', c.th ? 'bold' : 'normal'); doc.setFontSize(9.5); return doc.splitTextToSize(c.t, anchos[k] * ANCHO - 8); });
        const alto = Math.max(...lineas.map(l => l.length)) * 13 + 8;
        salto(alto);
        let x = M;
        // Fila con menos celdas (como «Total recibido»): la última celda va en la última columna
        if (f.length < n) { const ult = f.pop(); while (f.length < n - 1) f.push({ t: '' }); f.push(ult); lineas.splice(0, lineas.length, ...f.map((c, k) => doc.splitTextToSize(c.t, anchos[k] * ANCHO - 8))); }
        f.forEach((c, k) => {
          doc.setFont('helvetica', c.th ? 'bold' : 'normal'); doc.setFontSize(9.5); doc.setTextColor(34);
          const w = anchos[k] * ANCHO;
          lineas[k].forEach((l, j) => doc.text(l, c.n ? x + w - 4 : x + 4, y + 13 + j * 13, c.n ? { align: 'right' } : undefined));
          x += w;
        });
        y += alto; doc.setDrawColor(220); doc.line(M, y, W - M, y);
      });
      y += 6;
    }
  });
  return new Uint8Array(doc.output('arraybuffer'));
}
