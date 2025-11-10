// ===============================================
// Configuración del Sistema AMIE
// ===============================================

window.APP_CONFIG = {
  // Configuración del mapa
  map: {
    defaultCenter: [-1.8312, -78.1834], // Centro de Ecuador
    defaultZoom: 7,
    minZoom: 5,
    maxZoom: 18,
    clusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: true,
    zoomToBoundsOnClick: true
  },

  // URLs de tiles del mapa
  tiles: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors | Sistema AMIE'
  },

  // Configuración de iconos
  icons: {
    costa: {
      url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
      size: [32, 32],
      anchor: [16, 32],
      popupAnchor: [0, -32]
    },
    sierra: {
      url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
      size: [32, 32],
      anchor: [16, 32],
      popupAnchor: [0, -32]
    },
    default: {
      url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
      size: [32, 32],
      anchor: [16, 32],
      popupAnchor: [0, -32]
    }
  },

  // Colores del sistema
  colors: {
    primary: '#81b71a',
    primaryLight: '#9fcd3f',
    primaryDark: '#6b9915',
    secondary: '#0a0a0a',
    white: '#ffffff',
    gray: {
      50: '#f5f5f5',
      100: '#e8e8e8',
      200: '#d4d4d4',
      300: '#b0b0b0',
      400: '#8d8d8d',
      500: '#6b6b6b',
      600: '#525252',
      700: '#404040',
      800: '#2d2d2d',
      900: '#1a1a1a'
    }
  },

  // Configuración de datos
  data: {
    sources: {
      primary: 'data.json',
      fallback: 'data.csv'
    },
    updateInterval: 300000, // 5 minutos en milisegundos
    cacheEnabled: true
  },

  // Configuración de exportación
  export: {
    filename: 'datos_amie_export',
    format: 'csv',
    encoding: 'utf-8',
    delimiter: ',',
    includeHeaders: true
  },

  // Configuración de filtros
  filters: {
    debounceDelay: 300, // milisegundos
    minSearchLength: 2,
    caseInsensitive: true
  },

  // Configuración de popups
  popup: {
    maxWidth: 400,
    minWidth: 320,
    autoPan: true,
    autoPanPadding: [50, 50],
    closeButton: true,
    closeOnClick: true
  },

  // Configuración de clusters
  cluster: {
    maxClusterRadius: 80,
    disableClusteringAtZoom: 16,
    singleMarkerMode: false,
    spiderfyDistanceMultiplier: 1.5,
    iconCreateFunction: null // Se define en app.js
  },

  // Mensajes del sistema
  messages: {
    loading: 'Cargando datos...',
    error: 'Error al cargar los datos',
    noData: 'No hay datos disponibles',
    exportSuccess: 'Datos exportados correctamente',
    exportError: 'Error al exportar los datos',
    filterApplied: 'Filtros aplicados',
    filterCleared: 'Filtros eliminados',
    noResults: 'No se encontraron resultados'
  },

  // Configuración de animaciones
  animations: {
    enabled: true,
    duration: 300,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
  },

  // Configuración regional
  locale: {
    language: 'es-EC',
    currency: 'USD',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: {
      decimals: 2,
      decimalSeparator: ',',
      thousandsSeparator: '.'
    }
  },

  // Configuración de desarrollo
  debug: {
    enabled: false,
    logLevel: 'error', // 'debug', 'info', 'warn', 'error'
    showPerformance: false
  },

  // Versión de la aplicación
  version: '2.0.0'
};

// Función helper para obtener configuración
window.getConfig = function(path) {
  const keys = path.split('.');
  let result = window.APP_CONFIG;
  
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      return undefined;
    }
  }
  
  return result;
};

// Función para actualizar configuración (solo en desarrollo)
window.setConfig = function(path, value) {
  if (!window.APP_CONFIG.debug.enabled) {
    console.warn('La configuración solo puede ser modificada en modo debug');
    return false;
  }
  
  const keys = path.split('.');
  const lastKey = keys.pop();
  let target = window.APP_CONFIG;
  
  for (const key of keys) {
    if (!(key in target) || typeof target[key] !== 'object') {
      target[key] = {};
    }
    target = target[key];
  }
  
  target[lastKey] = value;
  console.log(`Configuración actualizada: ${path} = ${value}`);
  return true;
};
