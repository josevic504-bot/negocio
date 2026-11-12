-- 1.9.65: Restaurante — tablero de mesas y rol Mesero
-- · MesaCuentas: la cuenta abierta de cada mesa (por negocio). items en JSON; estado abierta → cuenta → pagada → cerrada (o cancelada).
-- · Ventas.mesero: el mesero que atendió la mesa (la venta queda a su nombre aunque la cobre otro usuario).
create table if not exists public."MesaCuentas" (
  negocio_id text not null references public."Licencias"("id") on delete cascade,
  "id" text not null default '', "mesa" text not null default '', "zona" text not null default '', "estado" text not null default '',
  "personas" numeric not null default 0, "meseroId" text not null default '', "items" text not null default '', "total" numeric not null default 0,
  "nota" text not null default '', "abierta" text not null default '', "actualizado" text not null default '', "cerrada" text not null default '',
  "ventaIds" text not null default '', "usuarioId" text not null default '',
  _fila bigint generated always as identity, _creado_en timestamptz not null default now(), primary key (negocio_id, "id"));
create index if not exists "MesaCuentas_neg_fila" on public."MesaCuentas" (negocio_id, _fila);
alter table public."MesaCuentas" enable row level security;
revoke all on public."MesaCuentas" from anon, authenticated;
alter table public."Ventas" add column if not exists mesero text not null default '';
