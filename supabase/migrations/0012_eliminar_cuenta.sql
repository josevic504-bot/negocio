-- 1.9.37: el cliente puede eliminar su cuenta desde la app. eliminadoEl = «fecha|estado anterior|motivo»; purgado = «si» cuando, a los 30 días, se borraron sus datos, respaldos y accesos.
alter table public."Licencias" add column if not exists "eliminadoEl" text not null default '', add column if not exists purgado text not null default '';
