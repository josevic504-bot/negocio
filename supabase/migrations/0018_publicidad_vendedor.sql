-- 1.9.71: Panel Molina — publicidad aplicada o ligada a vendedores (códigos v-… separados por coma; el costo se reparte entre ellos)
alter table public."GastosPanel" add column if not exists "vendedor" text not null default '';
