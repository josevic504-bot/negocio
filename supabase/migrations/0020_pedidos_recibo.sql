-- 1.9.81: compras en línea — factura, llegada y apartado de cada pedido (JSON en texto)
alter table public."Pedidos" add column if not exists "recibo" text not null default '';
-- 1.9.81: pedido anotado en el negocio: por dónde lo pidió el cliente (WhatsApp, En persona, Llamada); vacío = tienda en línea
alter table public."Pedidos" add column if not exists "origen" text not null default '';
