-- Tiendas Catrachas: lo que la gente escribió en Google y Bing para llegar a molinasoluciones.com (aplicada el 2026-11-21).
-- La llena una vez al día la función «buscadores» (supabase/functions/buscadores). Una fila por día, buscador y búsqueda; consulta '' = total del día.
-- id = fecha|motor|consulta (así la misma fila se actualiza en vez de repetirse).
create table if not exists public."Buscadores" (id text not null default '' primary key, fecha text not null default '', motor text not null default '', consulta text not null default '', impresiones text not null default '', clics text not null default '', posicion text not null default '', _fila bigint generated always as identity, _creado_en timestamptz not null default now());
create index if not exists "Buscadores__fila_idx" on public."Buscadores" (_fila);
alter table public."Buscadores" enable row level security;
-- Clave con la que la tarea diaria llama a la función (nadie más puede pedirle que corra)
insert into public."Propiedades"(clave, valor) values ('BUSCADORES_CLAVE', encode(gen_random_bytes(24), 'hex')) on conflict (clave) do nothing;
-- Pide a la función que traiga las búsquedas (la clave se lee de Propiedades, nunca queda escrita en la tarea)
create or replace function tc_priv.buscadores(dias int default 10) returns bigint
language sql security definer set search_path = public, extensions as $$
  select net.http_post(
    'https://qvhtlezxjklhwlnvexje.supabase.co/functions/v1/buscadores',
    jsonb_build_object('clave', (select valor from public."Propiedades" where clave = 'BUSCADORES_CLAVE'), 'dias', dias),
    '{}'::jsonb, '{"Content-Type":"application/json"}'::jsonb, 60000);
$$;
revoke all on function tc_priv.buscadores(int) from public, anon, authenticated;
-- Todos los días a las 5:17 a. m. de Honduras (11:17 UTC)
select cron.schedule('tc-buscadores', '17 11 * * *', 'select tc_priv.buscadores(10)');
