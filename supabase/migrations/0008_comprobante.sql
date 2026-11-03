-- 1.9.30: comprobante de pago en los pedidos en línea (foto en Storage) y su estado: '' | revisar | ok | no
alter table public."Pedidos" add column if not exists comprobante text not null default '', add column if not exists "pagoEstado" text not null default '';
