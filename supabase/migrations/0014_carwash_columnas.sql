-- 1.9.46: campos del giro Carwash que quedaron sin crear en la base (día y hora apartados en pedidos, vehículo, placa y lavador)
alter table public."Pedidos"
  add column if not exists cita text not null default '',
  add column if not exists hora text not null default '',
  add column if not exists vehiculo text not null default '',
  add column if not exists placa text not null default '',
  add column if not exists "citaId" text not null default '';

alter table public."Ordenes"
  add column if not exists lavador text not null default '';
