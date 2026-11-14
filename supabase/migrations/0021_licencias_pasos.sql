-- 1.9.83: primeros pasos de cada negocio (claves hechas separadas por coma; 'ninguno' = ninguno hecho; vacío = sin datos) para la lista de clientes y el embudo de cada publicidad del Panel
alter table public."Licencias" add column if not exists "pasos" text not null default '';
