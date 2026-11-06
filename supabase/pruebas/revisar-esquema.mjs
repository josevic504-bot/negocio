// Antes de publicar: compara las tablas de Codigo.gs (rama main) contra las columnas reales de Supabase.
// Uso: node revisar-esquema.mjs ruta/Codigo.gs columnas.json
// columnas.json = resultado de:
//   select table_name, json_agg(column_name) cols from information_schema.columns where table_schema='public' group by 1;
import fs from 'node:fs';
const [gs, js] = process.argv.slice(2), src = fs.readFileSync(gs, 'utf8');
const db = Object.fromEntries(JSON.parse(fs.readFileSync(js, 'utf8')).map(x => [x.table_name, new Set(x.cols)]));
const grab = n => { const m = src.match(new RegExp('^const ' + n + ' = (\\{[\\s\\S]*?^\\});?\\s*$', 'm')); return m ? eval('(' + m[1] + ')') : {}; };
let faltan = 0;
for (const [t, cols] of Object.entries({ ...grab('SCHEMA'), ...grab('SCHEMA_M') })) {
  const f = db[t] ? cols.filter(c => !db[t].has(c)) : ['(falta la tabla)'];
  if (f.length) { faltan += f.length; console.log('✗', t, f.join(', ')); }
}
console.log(faltan ? `== Faltan ${faltan}: crear la migración antes de publicar ==` : '== La base tiene todo lo del código ==');
process.exit(faltan ? 1 : 0);
