-- Fase 7 · Avisos con la app cerrada (Web Push), cambios al instante entre equipos (Realtime) y resumen de las 7 a. m.
-- · PushSubs: cada teléfono o computadora que activó los avisos (negocio = id del negocio, o «_panel» para el Panel Molina).
--   Solo la usa el servidor (service role); nadie más la puede leer.
-- · Propiedades VAPID_PUBLICA / VAPID_PRIVADA (llaves de los avisos) y RT_SECRETO (para el nombre del canal de cada negocio)
--   se cargan aparte, no quedan en el repositorio.
-- · pg_cron negocio-recordatorios: 13:00 UTC = 7 a. m. Honduras → tarea recordatoriosDia.
create table if not exists public."PushSubs" (
  endpoint text not null,
  negocio text not null,
  usuario text not null default '',
  p256dh text not null,
  auth text not null,
  apagados text not null default '',
  creado timestamptz not null default now(),
  ultimo timestamptz not null default now(),
  primary key (endpoint, negocio) -- el mismo teléfono puede tener la app de un negocio y el Panel
);
create index if not exists pushsubs_negocio on public."PushSubs" (negocio);
alter table public."PushSubs" enable row level security;
revoke all on public."PushSubs" from anon, authenticated;

select cron.schedule('negocio-recordatorios', '0 13 * * *', $$select public.api_tarea('recordatoriosDia')$$);
