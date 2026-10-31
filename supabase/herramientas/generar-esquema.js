const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const grab=n=>{const m=src.match(new RegExp('^const '+n+' = ([\\s\\S]*?);\\s*$','m'));return eval('('+m[1]+')');};
const SM=grab('SCHEMA_M'),S=grab('SCHEMA'),NUMS=[...grab('NUMS')],BOOLS=[...grab('BOOLS')];
const spec={m:SM,n:S,nums:NUMS,bools:BOOLS,idx:['ventaId','clienteId','productoId','proveedorId','compraId','proyectoId','chatId','mascotaId','negocioId','fecha','numero','telefono','whatsapp','codigo']};
const sql=`do $do$
declare spec jsonb := $j$${JSON.stringify(spec)}$j$; t text; c text; multi boolean; grupo text; cols text; pk text; ix text;
begin
  foreach grupo in array array['m','n'] loop
    multi := grupo = 'n';
    for t in select jsonb_object_keys(spec->grupo) loop
      cols := case when multi then 'negocio_id text not null references public."Licencias"("id") on delete cascade, ' else '' end;
      for c in select jsonb_array_elements_text(spec->grupo->t) loop
        cols := cols || format('%I ', c) || case when spec->'nums' ? c then 'numeric not null default 0' when spec->'bools' ? c then 'boolean not null default false' else 'text not null default ''''' end || ', ';
      end loop;
      pk := case when t = 'Config' then 'negocio_id, "clave"' when t = 'Accesos' then '"negocioId", "usuarioId"' when multi then 'negocio_id, "id"' else '"id"' end;
      execute format('create table public.%I (%s _fila bigint generated always as identity, _creado_en timestamptz not null default now(), primary key (%s))', t, cols, pk);
      execute format('alter table public.%I enable row level security', t);
      execute format('create index on public.%I (%s_fila)', t, case when multi then 'negocio_id, ' else '' end);
      for ix in select jsonb_array_elements_text(spec->'idx') loop
        if (spec->grupo->t) ? ix and position(format('%I', ix) in pk) = 0 then
          execute format('create index on public.%I (%s%I)', t, case when multi then 'negocio_id, ' else '' end, ix);
        end if;
      end loop;
    end loop;
  end loop;
end $do$;

create table public."Sesiones" (token text primary key, negocio_id text, valor text not null default '', expira timestamptz not null, _creado_en timestamptz not null default now());
alter table public."Sesiones" enable row level security;
create index on public."Sesiones" (expira);
create table public."Propiedades" (clave text primary key, valor text not null default '', actualizado timestamptz not null default now());
alter table public."Propiedades" enable row level security;
create table public."Consecutivos" (negocio_id text not null, serie text not null, valor bigint not null default 0, primary key (negocio_id, serie));
alter table public."Consecutivos" enable row level security;
create or replace function public.siguiente_consecutivo(p_negocio text, p_serie text) returns bigint
language sql security definer set search_path = public as $f$
  insert into public."Consecutivos"(negocio_id, serie, valor) values (p_negocio, p_serie, 1)
  on conflict (negocio_id, serie) do update set valor = public."Consecutivos".valor + 1
  returning valor;
$f$;
revoke all on function public.siguiente_consecutivo(text, text) from public, anon, authenticated;
`;
fs.writeFileSync(process.argv[3],sql);console.log(sql.length);
