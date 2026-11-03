-- 1.9.33: respaldos de cada negocio, salud en el Panel y copiar productos entre negocios
-- · Respaldos: lista de copias de cada negocio (fecha, tipo, tamaño, resumen). RespaldoDatos: la copia completa en JSON (texto comprimido por Postgres).
--   Las dos son por negocio (negocio_id) y solo las usa el servidor; el Codigo.gs no las carga.
-- · Licencias: nProductos y nClientes (para la salud del negocio) y respaldo (fecha del último automático).
-- · pg_cron negocio-respaldos: de 08:00 a 08:55 UTC (2 a. m. Honduras), cada 5 min, tarea respaldosDia (hace hasta 12 por vuelta).
create table if not exists public."Respaldos" (negocio_id text not null, id text not null, fecha text not null default '', tipo text not null default '', kb text not null default '', filas text not null default '', resumen text not null default '',
  _fila bigint generated always as identity, _creado_en timestamptz not null default now(), primary key (negocio_id, id));
create index if not exists "Respaldos_neg_fila" on public."Respaldos" (negocio_id, _fila);
create table if not exists public."RespaldoDatos" (negocio_id text not null, id text not null, datos text not null default '',
  _fila bigint generated always as identity, _creado_en timestamptz not null default now(), primary key (negocio_id, id));
create index if not exists "RespaldoDatos_neg_fila" on public."RespaldoDatos" (negocio_id, _fila);
alter table public."Respaldos" enable row level security;
alter table public."RespaldoDatos" enable row level security;
revoke all on public."Respaldos", public."RespaldoDatos" from anon, authenticated;
alter table public."Licencias" add column if not exists "nProductos" text not null default '', add column if not exists "nClientes" text not null default '', add column if not exists respaldo text not null default '';
select cron.schedule('negocio-respaldos', '*/5 8 * * *', $$select public.api_tarea('respaldosDia')$$);
