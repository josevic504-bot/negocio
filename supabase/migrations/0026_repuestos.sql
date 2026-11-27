-- 1.9.94: giro «Repuestos y taller (carro y moto)» — nº de parte, código alterno, marca del repuesto y compatibilidad por vehículo
alter table public."Productos"
  add column if not exists parte text not null default '',
  add column if not exists alterno text not null default '',
  add column if not exists "marcaRep" text not null default '',
  add column if not exists compat text not null default '';
