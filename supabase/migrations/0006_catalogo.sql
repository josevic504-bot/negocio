-- Rubro «Catálogo de maquillaje» (1.9.27): campos nuevos de Productos para la tienda estilo catálogo
-- sub = subcategoría · lema = frase destacada · puntos = beneficios (separados por |) · precioEsp/minEsp = precio especial desde N piezas
alter table public."Productos" add column if not exists sub text not null default '', add column if not exists lema text not null default '', add column if not exists puntos text not null default '', add column if not exists "precioEsp" numeric not null default 0, add column if not exists "minEsp" numeric not null default 0;
