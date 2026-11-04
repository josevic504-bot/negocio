-- Panel Molina: api_cargar también puede devolver el espacio usado (base de datos y archivos).
-- Solo cuando se pide con {espacio: true}; lo demás de la función queda igual.
do $mig$
declare d text; n text;
begin
  d := pg_get_functiondef('public.api_cargar(jsonb)'::regprocedure);
  if position('''espacio''' in d) > 0 then return; end if;
  n := replace(d, E'  return r;\nend $function$', $b$  if coalesce((p->>'espacio')::boolean, false) then
    r := r || jsonb_build_object('espacio', jsonb_build_object(
      'db', (select sum(pg_database_size(datname)) from pg_database),
      'arch', (select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects),
      'archN', (select count(*) from storage.objects)));
  end if;
  return r;
end $function$$b$);
  if n = d then raise exception 'No se encontró el final de api_cargar'; end if;
  execute n;
end $mig$;
