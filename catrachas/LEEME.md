# Tiendas Catrachas

Directorio público de las tiendas en línea de Negocio VM, pensado para molinasoluciones.com/tiendas.

- `generar.mjs` + `estilo.css`: generan las páginas ya escritas (directorio, tipo de negocio, ciudad, ficha de cada tienda, sitemap).
  Copia de referencia: viven en el repositorio MolinaSoluciones/sitio (molinasoluciones.com); `workflow/generar.yml` las regenera cada 30 minutos.
- `sql/directorio_tiendas.sql`: función pública de solo lectura en Supabase.
- En la app: sección «Tiendas Catrachas» en «Mi tienda en línea» (apagada de fábrica). En el servidor: `tiendaInfo` trae `negocio.dir`
  solo si el negocio lo encendió, tiene Plus pagado y al menos un producto propio en la tienda (o uno de ejemplo con foto).
- Pruebas: `supabase/pruebas/catrachas.mjs` (rama supabase).
