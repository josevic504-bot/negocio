-- 1.9.58: giro Vitaminas y suplementos — días que rinde cada unidad (recompra) y lotes con vencimiento
alter table public."Productos"
  add column if not exists rinde numeric not null default 0,
  add column if not exists lotes text not null default '';
