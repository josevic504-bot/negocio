-- 1.9.29: existencia y precio por opción. Productos.variantes = JSON { «Tono: Nude 1»: { s: existencia, p: precio } } · Inventario.variante = opción del movimiento
alter table public."Productos" add column if not exists variantes text not null default '';
alter table public."Inventario" add column if not exists variante text not null default '';
