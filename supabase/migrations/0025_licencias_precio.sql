-- Precio acordado con cada cliente en el Panel Molina (aplicada el 2026-11-25). Vacío = sin definir; con él, el Panel calcula cuánto le falta pagar.
alter table public."Licencias" add column if not exists "precio" text not null default '';
