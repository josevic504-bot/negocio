// Genera el PDF de un contrato de ejemplo con el HTML real de Codigo.gs (contratoHtml_) y lo guarda para revisarlo
import fs from 'node:fs'; import { createRequire } from 'node:module';
import { htmlAPdf } from '../functions/api/pdf.js';
const req = createRequire(process.argv[3] + '/package.json');
const { jsPDF } = req('jspdf');
const SRC = fs.readFileSync(new URL('../../Codigo.gs', import.meta.url), 'utf8');
const HTML = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const corta = (ini, fin) => { const a = HTML.indexOf(ini); return HTML.slice(a, HTML.indexOf(fin, a)); };
const shims = new Function(corta('function sha256(bytes)', 'function demoShims') + corta('function demoShims(DEMO)', '// Compila el código del servidor') + 'return demoShims;')();
const DEMO = { db: { sheets: {}, order: [] }, cache: {} };
const B = new Function('SpreadsheetApp', 'Utilities', 'CacheService', 'LockService', 'Logger', 'ContentService', 'PropertiesService', 'DriveApp',
  SRC + '\nreturn { contratoHtml_, instalar, mAppend_ };')(...shims(DEMO));
B.instalar();
B.mAppend_('PagosLic', { id: 'P1', negocioId: 'N1', fecha: '2026-10-20', monto: 3000, concepto: 'Licencia del programa', metodo: 'Transferencia', nota: '' });
B.mAppend_('PagosLic', { id: 'P2', negocioId: 'N1', fecha: '2026-10-28', monto: 500, concepto: 'Giro extra · Streaming', metodo: 'Efectivo', nota: '' });
const firma = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGO4w5+PFTEMLQkA5/dWgVdSFnYAAAAASUVORK5CYII=';
const texto = 'PRIMERA · OBJETO. Molina Soluciones Digitales concede al Licenciatario una licencia de uso del programa Gestión de Negocio VM para administrar su negocio: ventas, inventario, clientes, compras, gastos y caja.\n\nSEGUNDA · PRECIO. El Licenciatario paga por la licencia el monto indicado, en un solo pago, sin mensualidades.\n\nTERCERA · SOPORTE. Molina Soluciones Digitales atiende consultas por WhatsApp y corrige los errores del programa sin costo adicional durante la vigencia de la licencia.';
const c = { id: 'KMVVR1234', negocioId: 'N1', fecha: '2026-10-30', titulo: 'Contrato de licencia de uso · Gestión de Negocio VM', texto, monto: 3500, estado: 'firmado', firma, firmadoEl: '2026-10-30 20:30', firmadoPor: 'María López', huella: 'a1b2c3d4e5f6a7b8' };
const l = { id: 'N1', negocio: 'Pulpería La Bendición', dueno: 'María López' };
const html = '<!doctype html><html><head><meta charset="utf-8"><style>body{}</style></head><body>' + B.contratoHtml_(c, l) + '</body></html>';
fs.writeFileSync(process.argv[2] + '/contrato.html', html);
fs.writeFileSync(process.argv[2] + '/contrato.pdf', htmlAPdf(jsPDF, html));
console.log('PDF listo', fs.statSync(process.argv[2] + '/contrato.pdf').size, 'bytes');
