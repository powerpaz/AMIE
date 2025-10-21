# GitHub Pages workflow + validador de coordenadas

## ¿Qué hace?
- Valida/normaliza las columnas **LATITUD** y **LONGITUD** de `rubros_csv.csv` (formato `;`).
- Corrige formatos con coma/punto y escala números enormes hasta llevarlos a grados (-90/90, -180/180).
- Si **alguna** fila queda inválida, **falla el workflow** (para evitar despliegues rotos).
- Publica el sitio en **GitHub Pages** usando el CSV **normalizado**.

## Estructura esperada
```
index.html
styles.css
config.js
app.v10.js
supabaseClient.js
provincias_simplificado.geojson
rubros_csv.csv
scripts/check_coords.js
.github/workflows/pages.yml
```

## Variables
No necesitas variables de entorno si usas **CSV**. Si usas Supabase, expón `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en tu build (o usa la versión `config.js` con fallback).
