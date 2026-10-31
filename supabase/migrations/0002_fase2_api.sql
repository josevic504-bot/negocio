-- Negocio VM · Fase 2: funciones que usa el servidor nuevo (Edge Function «api»)
-- api_cargar: trae en una sola consulta las tablas, la caché y las propiedades que pide una acción
-- api_aplicar: guarda en una sola transacción lo que cambió; si otro equipo del mismo negocio guardó antes, avisa «conflicto» y el servidor repite la acción

-- Las hojas maestras guardan todo como texto (mRows_ convierte todo a texto menos «activo»)
alter table public."Soporte"     alter column "deCliente" drop default, alter column "deCliente" type text using "deCliente"::text, alter column "deCliente" set default '';
alter table public."PagosLic"    alter column "monto" drop default, alter column "monto" type text using "monto"::text, alter column "monto" set default '';
alter table public."CuotasLic"   alter column "monto" drop default, alter column "monto" type text using "monto"::text, alter column "monto" set default '';
alter table public."GastosPanel" alter column "monto" drop default, alter column "monto" type text using "monto"::text, alter column "monto" set default '';
alter table public."GastosPanel" alter column "anulado" drop default, alter column "anulado" type text using "anulado"::text, alter column "anulado" set default '';
alter table public."Contratos"   alter column "monto" drop default, alter column "monto" type text using "monto"::text, alter column "monto" set default '';

-- Caché (reemplaza CacheService: sesiones, intentos fallidos, límites)
drop table if exists public."Sesiones";
drop function if exists public.siguiente_consecutivo(text, text);
drop table if exists public."Consecutivos";
create table public."Cache" (clave text primary key, valor text not null default '', expira timestamptz not null);
alter table public."Cache" enable row level security;
create index on public."Cache" (expira);

-- Versión de los datos de cada negocio (control de escrituras simultáneas)
create table public."Versiones" (negocio_id text primary key, v bigint not null default 0);
alter table public."Versiones" enable row level security;

create or replace function public.api_cargar(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r jsonb; o jsonb := '{}'; x jsonb; filas jsonb; t text; neg text; tabs jsonb; sneg text;
begin
  for t in select distinct jsonb_array_elements_text(coalesce(p->'m', '[]')) loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x) - ''_creado_en'' order by _fila), ''[]'') from public.%I x', t) into filas;
    o := o || jsonb_build_object(t, filas);
  end loop;
  r := jsonb_build_object('m', o);

  -- El negocio de la sesión se resuelve aquí mismo para no gastar otra consulta
  if coalesce(p->>'sesion', '') <> '' then
    select split_part(valor, '|', 1) into sneg from public."Cache" where clave = 'S_' || (p->>'sesion') and expira > now();
    if sneg is not null and sneg <> '' and exists (select 1 from public."Licencias" where id = sneg) then
      p := jsonb_set(p, array['n'], coalesce(p->'n', '{}') || jsonb_build_object(sneg, coalesce(p->'n'->sneg, '[]') || coalesce(p->'nSesion', '[]')));
      r := r || jsonb_build_object('sesionNeg', sneg);
    end if;
  end if;

  o := '{}';
  for neg, tabs in select * from jsonb_each(coalesce(p->'n', '{}')) loop
    x := jsonb_build_object('_v', coalesce((select v from public."Versiones" where negocio_id = neg), 0));
    for t in select distinct jsonb_array_elements_text(tabs) loop
      execute format('select coalesce(jsonb_agg(to_jsonb(x) - ''_creado_en'' - ''negocio_id'' order by _fila), ''[]'') from public.%I x where negocio_id = $1', t) using neg into filas;
      x := x || jsonb_build_object(t, filas);
    end loop;
    o := o || jsonb_build_object(neg, x);
  end loop;
  r := r || jsonb_build_object('n', o);

  r := r || jsonb_build_object('c', (
    select coalesce(jsonb_object_agg(k.clave, case when c.clave is null then 'null'::jsonb else jsonb_build_object('v', c.valor, 'e', floor(extract(epoch from c.expira) * 1000)) end), '{}')
    from (select distinct jsonb_array_elements_text(coalesce(p->'c', '[]')) as clave) k
    left join public."Cache" c on c.clave = k.clave and c.expira > now()));

  if coalesce((p->>'props')::boolean, false) then
    r := r || jsonb_build_object('props', (select coalesce(jsonb_object_agg(clave, valor), '{}') from public."Propiedades"));
  end if;
  return r;
end $$;

create or replace function public.api_aplicar(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  neg text; ev jsonb; cur bigint; op jsonb; t text; cols text; cond text; kc text; fila jsonb; n_ops int := 0;
begin
  -- 1) Control de versiones: si otro equipo del mismo negocio guardó desde que se leyeron los datos, no se guarda nada
  for neg, ev in select * from jsonb_each(coalesce(p->'v', '{}')) order by 1 loop
    insert into public."Versiones"(negocio_id, v) values (neg, 0) on conflict do nothing;
    select v into cur from public."Versiones" where negocio_id = neg for update;
    if cur <> (ev #>> '{}')::bigint then
      return jsonb_build_object('conflicto', true, 'negocio', neg);
    end if;
  end loop;

  -- 2) Cambios en las tablas, en el orden en que se hicieron
  for op in select * from jsonb_array_elements(coalesce(p->'ops', '[]')) loop
    t := op->>'t';
    fila := coalesce(op->'row', '{}');
    if op ? 'n' then fila := fila || jsonb_build_object('negocio_id', op->>'n'); end if;
    cond := '';
    for kc in select jsonb_object_keys(op->'k') loop
      cond := cond || format(' and %I = %L', kc, op->'k'->>kc);
    end loop;
    if op ? 'n' then cond := cond || format(' and negocio_id = %L', op->>'n'); end if;
    cond := substr(cond, 6);
    if op->>'op' = 'del' then
      execute format('delete from public.%I where %s', t, cond);
    else
      select string_agg(format('%I', k), ', ') into cols from jsonb_object_keys(fila) k;
      if op->>'op' = 'ins' then
        execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) on conflict do nothing', t, cols, cols, t) using fila;
      elsif cols is not null then
        execute format('update public.%I set (%s) = (select %s from jsonb_populate_record(null::public.%I, $1)) where %s', t, cols, cols, t, cond) using fila;
      end if;
    end if;
    n_ops := n_ops + 1;
  end loop;

  update public."Versiones" set v = v + 1 where negocio_id in (select jsonb_object_keys(coalesce(p->'v', '{}')));

  -- 3) Caché y propiedades
  for op in select * from jsonb_array_elements(coalesce(p->'c', '[]')) loop
    if op->>'op' = 'del' then delete from public."Cache" where clave = op->>'k';
    else insert into public."Cache"(clave, valor, expira) values (op->>'k', coalesce(op->>'v', ''), now() + make_interval(secs => coalesce((op->>'s')::int, 600)))
      on conflict (clave) do update set valor = excluded.valor, expira = excluded.expira;
    end if;
  end loop;
  for kc, ev in select * from jsonb_each(coalesce(p->'props', '{}')) loop
    if jsonb_typeof(ev) = 'null' then delete from public."Propiedades" where clave = kc;
    else insert into public."Propiedades"(clave, valor) values (kc, ev #>> '{}') on conflict (clave) do update set valor = excluded.valor, actualizado = now();
    end if;
  end loop;
  -- Limpieza ocasional de la caché vencida
  if random() < 0.02 then delete from public."Cache" where expira < now(); end if;
  return jsonb_build_object('ok', true, 'ops', n_ops);
end $$;

revoke all on function public.api_cargar(jsonb) from public, anon, authenticated;
revoke all on function public.api_aplicar(jsonb) from public, anon, authenticated;
grant execute on function public.api_cargar(jsonb) to service_role;
grant execute on function public.api_aplicar(jsonb) to service_role;
