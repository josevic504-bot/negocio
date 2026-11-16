-- Tiendas Catrachas: solicitudes de negocios con tienda propia que piden aparecer en el directorio (formulario público del sitio)
create table if not exists public."Solicitudes" (id text not null default '' primary key, fecha text not null default '', negocio text not null default '', nombre text not null default '', whatsapp text not null default '', tipo text not null default '', ciudad text not null default '', enlace text not null default '', nota text not null default '', estado text not null default '', creado text not null default '', _fila bigint generated always as identity, _creado_en timestamptz not null default now());
create index if not exists "Solicitudes__fila_idx" on public."Solicitudes" (_fila);
alter table public."Solicitudes" enable row level security;
-- Función pública de solo lectura del directorio (aplicada el 2026-11-16 como «directorio_tiendas»): ver catrachas/sql/directorio_tiendas.sql en main
