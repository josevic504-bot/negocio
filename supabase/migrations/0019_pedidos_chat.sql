-- 1.9.77: mensajes automáticos — cada pedido de la tienda queda ligado a su conversación (Chats.id)
alter table public."Pedidos" add column if not exists "chatId" text not null default '';
