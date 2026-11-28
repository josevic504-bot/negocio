-- 1.9.96: insumos por paquete — cuántas unidades trae normalmente el paquete (vasos, platos, cubiertos…)
alter table public."Productos"
  add column if not exists paquete numeric not null default 0;
