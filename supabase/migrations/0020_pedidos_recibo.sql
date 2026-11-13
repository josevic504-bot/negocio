-- 1.9.81: compras en línea — factura, llegada y apartado de cada pedido (JSON en texto)
alter table public."Pedidos" add column if not exists "recibo" text not null default '';
