-- Tiendas Catrachas: lista pública de los negocios que encendieron «Aparecer en Tiendas Catrachas».
-- Solo devuelve el código de la tienda (el mismo que ya va en su enlace público) y sus visitas de los últimos 30 días.
-- El resto (Plus pagado, tienda abierta, productos propios) lo comprueba el servidor al pedir cada tienda.
create or replace function public.directorio_tiendas()
returns table (id text, visitas bigint)
language sql stable security definer set search_path = public
as $$
  select l.id,
         (select count(*) from "Visitas" v
           where v.pagina = 't-' || lower(l.id)
             and v.fecha >= to_char((now() at time zone 'America/Tegucigalpa') - interval '30 days', 'YYYY-MM-DD')) as visitas
    from "Licencias" l
    join "Config" c on c.negocio_id = l.id and c.clave = 'dirOn' and c.valor = 'si'
   where coalesce(l."eliminadoEl", '') = '' and lower(coalesce(l.estado, '')) <> 'duplicada'
$$;
revoke all on function public.directorio_tiendas() from public;
grant execute on function public.directorio_tiendas() to anon, service_role;
