# AMIE - Visor Geográfico de Instituciones Educativas

Mapa interactivo que visualiza las 827 instituciones educativas del Ecuador con información detallada sobre dotación de recursos (mobiliario didáctico, mobiliario y equipamiento).

## Características

- **Mapa Interactivo**: Visualiza todas las instituciones con clustering automático
- **Filtros Avanzados**: Por provincia, cantón, zona, nivel educativo y año de dotación
- **Búsqueda**: Por código AMIE
- **Exportación**: Descarga datos filtrados en CSV
- **Análisis**: Tabla de totales y estadísticas en tiempo real
- **Responsive**: Funciona en desktop, tablet y móvil

## Datos

**827 instituciones educativas del Ecuador**
- Coordenadas geográficas precisas (latitud/longitud)
- Clasificación geográfica (provincia, cantón, parroquia)
- Información de nivel educativo y sostenimiento
- Datos de dotación de recursos educativos

## Tecnología

- **Frontend**: HTML5, CSS3, JavaScript Vanilla
- **Mapas**: Leaflet.js + Marker Cluster
- **Base de Datos**: Supabase (PostgreSQL + PostGIS)
- **CSV**: PapaParse
- **Hosting**: GitHub Pages

## Instalación Local

```bash
# Clonar repositorio
git clone https://github.com/powerpaz/AMIE.git
cd AMIE

# Servir localmente (Python 3)
python -m http.server 8000

# Luego abre: http://localhost:8000
```

## Configuración Supabase

Para funcionar, necesitas:

1. Crear proyecto en [supabase.com](https://supabase.com)
2. En `config.js`, actualiza:
   ```javascript
   const SUPABASE_URL = 'tu-url'
   const SUPABASE_KEY = 'tu-api-key'
   ```
3. Crear tabla `instituciones` con estructura similar a `instituciones_FINAL_1_.csv`
4. Importar datos del CSV

## Uso

1. Abre el mapa
2. Usa los filtros laterales para buscar
3. Haz clic en instituciones para ver detalles
4. Exporta datos con "Exportar CSV"

## Estructura

```
AMIE/
├── index.html           # Interfaz principal
├── styles.css           # Estilos (tema azul)
├── app.v9.js            # Lógica del mapa
├── config.js            # Configuración
├── supabaseClient.js     # Cliente Supabase
├── pages.yml            # GitHub Pages config
└── data/
    └── instituciones_FINAL_1_.csv
```

## Datos

- **Total**: 827 instituciones
- **Cobertura**: Nacional (24 provincias)
- **Actualización**: Octubre 2025
- **Fuente**: AMIE (Ministerio de Educación)

## Contribuir

1. Fork el proyecto
2. Crea rama: `git checkout -b feature/AmazingFeature`
3. Commit: `git commit -m 'Add feature'`
4. Push: `git push origin feature/AmazingFeature`
5. Abre Pull Request

## Licencia

MIT License

## Autor

PowerPaz - [@powerpaz](https://github.com/powerpaz)

---

**Última actualización:** Octubre 2025
