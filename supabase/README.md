# Negocio VM · Migración a Supabase

Proyecto Supabase: `negocio-vm` (ref `qvhtlezxjklhwlnvexje`, us-east-1, plan gratis, organización Molina Soluciones Digitales).

## Fase 1 — Base de datos (lista)
- `migrations/0001_fase1_tablas.sql`: 42 tablas generadas desde `SCHEMA` y `SCHEMA_M` de `Codigo.gs`, mismos nombres de tabla y columna.
  - 10 maestras (Licencias, Accesos, Soporte, Panel…) y 32 por negocio, con `negocio_id` → `Licencias.id` (se borran con el negocio).
  - Tipos como `obj_()`: columnas de `NUMS` → numeric, `BOOLS` → boolean, el resto → text.
  - `_fila` conserva el orden de inserción, igual que las filas de la hoja.
- Reemplazos de Google: `Sesiones` (CacheService), `Propiedades` (PropertiesService), `Consecutivos` + `siguiente_consecutivo()` (LockService para numeración).
- Seguridad: RLS activo sin políticas → solo el servidor (service_role) accede; la clave pública no ve nada.
- Regenerar si cambia el esquema: `node supabase/herramientas/generar-esquema.js Codigo.gs salida.sql`

## Fase 2 — Servidor nuevo (lista)
- Edge Function `api`: https://qvhtlezxjklhwlnvexje.supabase.co/functions/v1/api (mismo formato que el Apps Script: POST `{action, token, panel, data}` → `{ok, data|error}`).
- `functions/api/servidor.js` ejecuta el **mismo Codigo.gs** con simuladores de los servicios de Google:
  hojas → tablas (se cargan las que usa cada acción, calculadas leyendo el código), caché → tabla `Cache`,
  propiedades → `Propiedades`, fotos → Storage (`archivos`), candado → control de versiones por negocio.
- Al terminar cada acción se guarda solo lo que cambió, en una transacción (`api_aplicar`). Si otro equipo del mismo negocio guardó antes, la acción se repite sola.
- El servidor descarga `Codigo.gs` de la rama main cada 5 minutos: **publicar en GitHub actualiza el servidor** (ya no se pega en Apps Script).
- Pruebas (`pruebas/`): `node comparar.mjs` corre 38 acciones en el motor del modo prueba y en el nuevo → respuestas idénticas;
  `node simultaneo.mjs` (10 ventas a la vez), `node dos-negocios.mjs` (aislamiento), `node flujo.mjs`.
- Medido en Supabase: venta 85 ms (en caliente), ingreso 235 ms, guardar producto 226 ms.

## Pendiente
- Fase 3: prueba en el teléfono de Vic con la cuenta demo (apuntar un solo teléfono al servidor nuevo).
- Fase 4: revisar Panel Molina, tienda en línea, contabilidad, fotos/contratos (Drive → Storage), correo del resumen, consulta del dólar.
- Fase 5: copiar las hojas de cada cliente a Supabase. Fase 6: cambio final en una noche.
