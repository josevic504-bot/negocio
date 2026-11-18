-- 1.9.88: enlace con nombre de la tienda en línea de cada negocio (app.molinasoluciones.com/nombre-del-negocio); vacío = todavía no se le ha creado
alter table public."Licencias" add column if not exists "enlace" text not null default '';
