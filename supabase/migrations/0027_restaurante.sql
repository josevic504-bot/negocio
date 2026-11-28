-- 1.9.95: restaurante — despiece de lo comprado entero, receta del plato (piezas + lo demás) y compras para un evento
alter table public."Productos"
  add column if not exists despiece text not null default '',
  add column if not exists receta text not null default '',
  add column if not exists "recetaExtra" numeric not null default 0;
alter table public."Compras"
  add column if not exists "proyectoId" text not null default '';
alter table public."ProyectoGastos"
  add column if not exists "compraId" text not null default '';
