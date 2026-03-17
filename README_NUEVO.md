# AMIE - Visor Geográfico a Nivel Nacional
## Material Lúdico, Mobiliario y Juegos Exteriores (Equipamiento)

### Versión Modificada - Sin Supabase

Esta versión del proyecto AMIE ha sido modificada para funcionar completamente offline, sin necesidad de conexión a Supabase. Los datos se cargan directamente desde archivos locales.

## 🚀 Cambios Realizados

1. **Eliminación de Supabase**: Se removió toda dependencia con Supabase
2. **Datos Locales**: Los datos ahora se cargan desde archivos CSV/JSON locales
3. **Conversión de Excel**: El archivo Excel original se convirtió a formato CSV y JSON
4. **Funcionalidad Completa**: Se conservaron todas las funciones del sistema original:
   - Filtros interactivos
   - Visualización en mapa
   - Cálculo de totales
   - Exportación a CSV
   - Diseño y colores originales

## 📁 Estructura de Archivos

```
AMIE-main/
├── index_nuevo.html    # Página principal (sin Supabase)
├── app.js             # JavaScript principal (sin Supabase)
├── styles.css         # Estilos (original)
├── data.csv          # Datos en formato CSV
├── data.json         # Datos en formato JSON
├── provincias_simplificado.geojson  # Límites provinciales
└── README_NUEVO.md   # Este archivo
```

## 🔧 Instalación y Uso

### Opción 1: Uso Local Simple
1. Abre el archivo `index_nuevo.html` directamente en tu navegador
2. Los datos se cargarán automáticamente desde `data.json`

### Opción 2: Servidor Local (Recomendado)
Para evitar problemas de CORS con archivos locales:

```bash
# Usando Python 3
python3 -m http.server 8000

# O usando Node.js
npx http-server
```

Luego abre: `http://localhost:8000/index_nuevo.html`

## 📊 Formato de Datos

Los datos del Excel original se convirtieron con las siguientes columnas principales:

- **AMIE**: Código único de institución
- **INSTITUCION**: Nombre de la institución
- **PROVINCIA, CANTON, PARROQUIA**: Ubicación geográfica
- **ZONA**: Zona educativa
- **NIVEL_DE_EDUCACION**: Nivel educativo
- **MD_MONTO_USD**: Monto Material Didáctico
- **M_MONTO_USD**: Monto Mobiliario  
- **JE_MONTO_USD**: Monto Juegos Exteriores
- **LONGITUD, LATITUD**: Coordenadas geográficas

## ✨ Funcionalidades

### Filtros Disponibles
- Búsqueda por código AMIE
- Filtro por Provincia
- Filtro por Cantón (se actualiza según provincia)
- Filtro por Zona
- Filtro por Nivel de Educación
- Filtro por Año de Dotación

### Visualización en Mapa
- Marcadores con colores según tipo de dotación:
  - 🟢 Verde: Juegos Exteriores
  - 🔵 Azul: Mobiliario
  - 🟠 Naranja: Material Didáctico
  - ⚫ Gris: Sin dotación
- Clustering de marcadores para mejor rendimiento
- Popups con información detallada

### Panel de Totales
- Suma automática por rubro
- Contador de instituciones filtradas
- Exportación a CSV de datos filtrados

## 🔄 Actualización de Datos

Para actualizar con nuevos datos:

1. Coloca el nuevo archivo Excel en la carpeta
2. Ejecuta el script de conversión:

```python
import pandas as pd

# Leer Excel
df = pd.read_excel('nuevo_archivo.xls')

# Procesar y limpiar datos (ajustar según formato)
# ... código de procesamiento ...

# Guardar como CSV y JSON
df.to_csv('data.csv', index=False)
df.to_json('data.json', orient='records')
```

## 📝 Notas Técnicas

- **Sin Base de Datos**: No requiere ninguna base de datos externa
- **Rendimiento**: Optimizado para manejar miles de registros
- **Compatibilidad**: Funciona en navegadores modernos (Chrome, Firefox, Edge, Safari)
- **Responsive**: Diseño adaptable a diferentes tamaños de pantalla

## 🛠️ Solución de Problemas

### Los datos no cargan
- Verifica que los archivos `data.json` y `data.csv` estén en la carpeta
- Si usas Chrome localmente, puede necesitar un servidor local por políticas CORS

### El mapa no muestra marcadores
- Verifica que las coordenadas (LONGITUD, LATITUD) sean válidas
- Revisa la consola del navegador para errores

### Los filtros no funcionan
- Asegúrate de que los nombres de columnas coincidan con el código
- Verifica que los datos no tengan caracteres especiales problemáticos

## 📧 Soporte

Para problemas o preguntas sobre esta versión modificada, los archivos están listos para usar y toda la lógica original se ha preservado.

---

*Versión modificada que elimina dependencia de Supabase y usa datos locales del archivo Excel proporcionado.*
