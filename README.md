# Geoportal — Instituciones Educativas (Clone)

Este repositorio clonado reproduce la estructura del proyecto original pero con **nueva data**.
Incluye integración con **Supabase** para:
- KPIs de dashboard (total instituciones, MATRIZ, ESTABLECIMIENTO, # de sostenimientos)
- Filtros por Provincia, Cantón, Parroquia, Sostenimiento y Tipo
- Búsqueda enfocada en **AMIE** (y también por nombre)
- Mapa (Leaflet) y tabla

## Estructura
```
.
├─ index.html
├─ app.js
├─ styles.css
└─ data/ (opcional para pruebas locales)
```

## Tabla en Supabase

Crea la tabla `instituciones` con el siguiente esquema (ajusta tipos si lo requieres):

```sql
create table if not exists public.instituciones (
  id bigint generated always as identity primary key,
  amie text not null,
  nombre_ie text,
  tipo text, -- MATRIZ | ESTABLECIMIENTO
  sostenimiento text,
  provincia text,
  canton text,
  parroquia text,
  lat double precision,
  lon double precision,
  created_at timestamp with time zone default now()
);

-- Índices útiles
create index on public.instituciones (amie);
create index on public.instituciones (provincia, canton, parroquia);
create index on public.instituciones (tipo);
create index on public.instituciones (sostenimiento);
create index on public.instituciones using gist (ll_to_earth(lat, lon));
```

> **Nota**: habilita la extensión `earthdistance` si quieres el índice espacial `ll_to_earth`:

```sql
create extension if not exists cube;
create extension if not exists earthdistance;
```

### Carga de datos
Puedes subir el CSV limpio generado aquí (`instituciones_clean.csv`) desde el apartado **Table Editor → Import data** de Supabase.

Columnas esperadas:
- `amie`, `nombre_ie`, `tipo`, `sostenimiento`, `provincia`, `canton`, `parroquia`, `lat`, `lon`

### Seguridad (RLS)
Si tu front es público de solo lectura:

```sql
alter table public.instituciones enable row level security;

create policy "readonly anon"
on public.instituciones
for select
to anon
using (true);
```

## Variables
En `app.js` reemplaza:
- `SUPABASE_URL = "https://YOUR-PROJECT.supabase.co"`
- `SUPABASE_KEY = "YOUR-ANON-KEY"`

## Desarrollo local rápido (sin Supabase)
Puedes probar con el archivo `instituciones_sample.json` como mock (200 filas). Luego cambias `refreshData()` para leer ese JSON con `fetch` si aún no tienes la base.

---

### Métricas básicas detectadas (a partir del CSV subido)
- **Total registros:** 17947
- **Por TIPO:** {"MATRIZ": 16978, "ESTABLECIMIENTO": 969}
- **Sostenimientos (conteo por valor):** {"FISCAL": 13313, "PARTICULAR": 3685, "FISCOMISIONAL": 834, "MUNICIPAL": 115}

> Archivo limpio: `instituciones_clean.csv`
