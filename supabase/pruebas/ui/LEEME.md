# Pruebas en pantalla (Chrome + motor simulado)

Corren la app `index.html` real contra el mismo `Codigo.gs` con la base en memoria (`../prueba.mjs`), sin tocar Supabase.

```
cd supabase/pruebas && npm install playwright chart.js   # una vez
OUT=/ruta/capturas node ui/01-registro.mjs               # cada script deja capturas en OUT
```

- `base.mjs` levanta el servidor local (puerto 8765), enruta el API al motor simulado y sirve Chart.js/fuentes sin internet.
- `01…10`: registro e ingreso, todas las pantallas por rol, flujos de venta/crédito/compras/caja/reportes, tienda pública y pedidos, giros, Panel Molina, modo prueba, verificación de correcciones 1.9.43 y tienda por secciones 1.9.44.
- `explorar*.mjs`: ayudas para volcar los campos y botones de una pantalla al escribir pruebas nuevas.
