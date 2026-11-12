-- 1.9.67: Cocina (comandas), pedidos para llevar / a domicilio y pedidos de la tienda en línea en Mesas
alter table public."MesaCuentas"
  add column if not exists tipo text not null default '',
  add column if not exists cliente text not null default '',
  add column if not exists telefono text not null default '',
  add column if not exists "pedidoId" text not null default '';
create table if not exists public."Comandas" (
  negocio_id text not null references public."Licencias"("id") on delete cascade,
  "id" text not null default '', "cuentaId" text not null default '', "tipo" text not null default '', "mesa" text not null default '', "zona" text not null default '',
  "cliente" text not null default '', "items" text not null default '', "estado" text not null default '', "meseroId" text not null default '',
  "creada" text not null default '', "actualizado" text not null default '', "lista" text not null default '', "usuarioId" text not null default '', "pedidoId" text not null default '',
  _fila bigint generated always as identity, _creado_en timestamptz not null default now(), primary key (negocio_id, "id"));
create index if not exists "Comandas_neg_fila" on public."Comandas" (negocio_id, _fila);
alter table public."Comandas" enable row level security;
revoke all on public."Comandas" from anon, authenticated;
