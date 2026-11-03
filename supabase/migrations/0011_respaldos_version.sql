-- 1.9.35: versión de los datos del negocio al momento de cada copia (si no cambió, no se hace otra copia). Copias de más de 30 días se borran (menos la más reciente).
alter table public."Respaldos" add column if not exists v text not null default '';
