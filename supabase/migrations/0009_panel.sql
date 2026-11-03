-- 1.9.31: mensajes de Vic a los negocios (Anuncios) y comprobante del pago de la licencia (CuotasLic)
create table if not exists public."Anuncios" (id text not null default '' primary key, fecha text not null default '', titulo text not null default '', texto text not null default '', filtro text not null default '', destinos text not null default '', canales text not null default '', vence text not null default '', vistos text not null default '', creado text not null default '', _fila bigint generated always as identity, _creado_en timestamptz not null default now());
create index if not exists "Anuncios__fila_idx" on public."Anuncios" (_fila);
alter table public."Anuncios" enable row level security;
alter table public."CuotasLic" add column if not exists comprobante text not null default '', add column if not exists "compFecha" text not null default '', add column if not exists "compEstado" text not null default '';
