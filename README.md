# Sistema de Visualización Geográfica AMIE - Versión 2.0

## 📋 Descripción
Sistema mejorado de visualización geográfica para el monitoreo y gestión de equipamiento educativo (Material Lúdico, Mobiliario y Juegos Exteriores) a nivel nacional.

## 🎨 Mejoras Implementadas

### 1. **Diseño Visual**
- **Colores Personalizados:**
  - Verde principal: `#81b71a`
  - Negro de contraste: `#0a0a0a`
  - Paleta de grises complementaria
  - Diseño moderno y profesional con gradientes

### 2. **Iconos del Mapa**
- **Pin Rojo** 🔴: Instituciones de la Costa
- **Pin Azul** 🔵: Instituciones de la Sierra
- Iconos de Google Maps para mejor visualización
- Clustering mejorado con colores personalizados

### 3. **Popup de Información**
Muestra los siguientes campos:
- **AUX_IE_MATERIAL**: Tipo de material
- **AMIE**: Código de la institución
- **INSTITUCION**: Nombre completo
- **SOSTENIMIENTO**: Tipo de sostenimiento
- **NIVEL_DE_EDUCACION**: Nivel educativo
- **INVERSIÓN TOTAL**: Suma de MD_MONTO_USD + M_MONTO_USD + JE_MONTO_USD

### 4. **Filtros Mejorados**
- **Botón de Año de Dotación**: Filtro por AUX_ANIO_DOTACION
- **Botón de Régimen**: Filtro por REGIMEN (Costa/Sierra)
- Filtros existentes optimizados
- Diseño responsive con dropdowns dinámicos

### 5. **Panel de Estadísticas**
- Contador de instituciones filtradas
- Inversión total calculada automáticamente
- Desglose por rubro:
  - Material Didáctico
  - Mobiliario
  - Juegos Exteriores
- Exportación a CSV

## 🚀 Instalación

### Opción 1: Instalación Local
1. Descarga todos los archivos del proyecto
2. Coloca los archivos en una carpeta en tu servidor web
3. Asegúrate de que todos los archivos estén en la misma carpeta:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `config.js`
   - `data.json` o `data.csv`

### Opción 2: Servidor Web Simple (Python)
```bash
# Si tienes Python 3
python -m http.server 8000

# Si tienes Python 2
python -m SimpleHTTPServer 8000
```
Luego abre tu navegador en: `http://localhost:8000`

### Opción 3: Usando Live Server (VS Code)
1. Instala la extensión "Live Server" en VS Code
2. Click derecho en `index.html`
3. Selecciona "Open with Live Server"

## 📁 Estructura de Archivos

```
proyecto-amie/
│
├── index.html          # Página principal
├── styles.css          # Estilos personalizados
├── app.js             # Lógica principal de la aplicación
├── config.js          # Configuración del sistema
├── data.json          # Datos en formato JSON (principal)
├── data.csv           # Datos en formato CSV (respaldo)
└── README.md          # Este archivo
```

## 🔧 Configuración

### Personalizar Colores
Edita las variables CSS en `styles.css`:
```css
:root {
  --primary-green: #81b71a;
  --primary-black: #0a0a0a;
  /* ... más colores ... */
}
```

### Cambiar Centro del Mapa
Edita `config.js`:
```javascript
map: {
  defaultCenter: [-1.8312, -78.1834], // Coordenadas [lat, lon]
  defaultZoom: 7,
}
```

### Modificar Iconos
En `config.js`, actualiza las URLs de los iconos:
```javascript
icons: {
  costa: {
    url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
  },
  sierra: {
    url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
  }
}
```

## 📊 Formato de Datos

El sistema espera datos con la siguiente estructura (CSV o JSON):

| Campo | Descripción | Tipo |
|-------|-------------|------|
| AMIE | Código de institución | String |
| INSTITUCION | Nombre de la institución | String |
| AUX_IE_MATERIAL | Tipo de material | String |
| SOSTENIMIENTO | Tipo de sostenimiento | String |
| NIVEL_DE_EDUCACION | Nivel educativo | String |
| REGIMEN | Costa o Sierra | String |
| PROVINCIA | Provincia | String |
| CANTON | Cantón | String |
| ZONA | Zona administrativa | String |
| AUX_ANIO_DOTACION | Año de dotación | String/Number |
| MD_MONTO_USD | Monto Material Didáctico | Number |
| M_MONTO_USD | Monto Mobiliario | Number |
| JE_MONTO_USD | Monto Juegos Exteriores | Number |
| LATITUD | Coordenada latitud | Number |
| LONGITUD | Coordenada longitud | Number |

## 🎯 Funcionalidades Principales

### Filtros Disponibles
1. **Búsqueda por AMIE**: Búsqueda directa por código
2. **Provincia**: Selector desplegable
3. **Cantón**: Se actualiza según la provincia
4. **Zona**: Zonas administrativas
5. **Nivel de Educación**: Inicial/EGB/Bachillerato
6. **Año de Dotación**: Filtro por año
7. **Régimen**: Costa o Sierra

### Visualización
- Mapa interactivo con zoom
- Clustering de marcadores para mejor rendimiento
- Popups informativos al hacer clic
- Leyenda de colores por régimen

### Exportación
- Exportación a CSV de datos filtrados
- Incluye todos los campos relevantes
- Formato compatible con Excel

## 🐛 Solución de Problemas

### El mapa no carga
- Verifica la conexión a internet (requiere tiles de OpenStreetMap)
- Revisa la consola del navegador (F12) para errores

### Los datos no aparecen
- Asegúrate de que `data.json` o `data.csv` estén en la misma carpeta
- Verifica que las coordenadas sean válidas (LATITUD y LONGITUD)

### Los filtros no funcionan
- Revisa que los nombres de campos en los datos coincidan exactamente
- Verifica mayúsculas/minúsculas en los valores

## 📱 Compatibilidad

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Dispositivos móviles (responsive)

## 🔄 Actualizaciones Futuras

Posibles mejoras para próximas versiones:
- [ ] Gráficos estadísticos interactivos
- [ ] Filtros por rango de montos
- [ ] Exportación a PDF
- [ ] Modo oscuro
- [ ] Múltiples idiomas
- [ ] Integración con API en tiempo real

## 📞 Soporte

Para reportar problemas o sugerir mejoras, por favor contacta al equipo de desarrollo.

---

**Versión:** 2.0.0  
**Fecha de actualización:** Noviembre 2024  
**Desarrollado para:** Sistema AMIE - Ecuador
