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

## Siguiente: Fase 2 — Servidor nuevo (Edge Function con las mismas acciones que `route_`)
