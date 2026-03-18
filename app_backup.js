// ===============================================
// Sistema de Visualización Geográfica - AMIE
// JavaScript Principal v3.0 - Sin Supabase, CSV Local
// ===============================================

(function() {
  'use strict';

  // --- Normaliza nombres de provincia (safety) ---
  function __normalizeProvince__(s) {
    if (!s) return s;
    let v = String(s).trim().toUpperCase();
    v = v.replace(/\s+/g, ' ');
    // correcciones conocidas
    if (v === 'CARHI') v = 'CARCHI';
    if (v === 'CARCHÍ') v = 'CARCHI';
    if (v === 'LOS RÍOS') v = 'LOS RIOS';
    if (v === 'SANTO DOMINGO DE LOS TSÁCHILAS') v = 'SANTO DOMINGO DE LOS TSACHILAS';
    if (v === 'SANTO DOMINGO DE LOS TSCACHILAS') v = 'SANTO DOMINGO DE LOS TSACHILAS';
    if (v === 'BOLÍVAR') v = 'BOLIVAR';
    // casos parciales
    v = v.replace('CARHI', 'CARCHI');
    return v;
  }

  // --- Normaliza régimen (quitar tildes) ---
  function __normalizeRegimen__(s) {
    if (!s) return s;
    let v = String(s).trim().toUpperCase();
    v = v.replace('Á', 'A').replace('É', 'E').replace('Í', 'I').replace('Ó', 'O').replace('Ú', 'U');
    return v;
  }

  // === KPI helpers ===
  function __updateKPI__(loadedTotal, visibleTotal){
    const t = document.getElementById('kpi-total');
    const v = document.getElementById('kpi-visible');
    if (t) t.textContent = String(loadedTotal);
    if (v) v.textContent = String(visibleTotal);
    try { console.info('[KPI] Total cargados:', loadedTotal, '| Visibles:', visibleTotal); } catch(e){}
  }

  // Configuración inicial
  const CONFIG = {
    mapCenter: [-1.8312, -78.1834], // Ecuador
    mapZoom: 7,
    maxZoom: 18,
    minZoom: 5,
    clusterRadius: 50,
    
    // URLs de los iconos de Google Maps
    icons: {
      costa: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
      sierra: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
      default: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
    },
    
    // Colores del sistema
    colors: {
      primary: '#81b71a',
      primaryDark: '#6b9915',
      black: '#0a0a0a',
      white: '#ffffff'
    }
  };

  // Variables globales
  let map;
  let markersLayer;
  let data = [];
  let filteredData = [];
  let filters = {
    amie: '',
    provincia: '',
    canton: '',
    zona: '',
    nivel: '',
    anio: '',
    regimen: '',
    distrito: '',
    parroquia: '',
    tipologia: ''
  };

  // Inicialización cuando el DOM está listo
  document.addEventListener('DOMContentLoaded', initApp);

  function initApp() {
    console.log('Iniciando aplicación AMIE v3.0 (CSV Local)');
    initMap();
    loadData();
    setupEventListeners();
  }

  // Inicializar el mapa
  function initMap() {
    map = L.map('map', {
      center: CONFIG.mapCenter,
      zoom: CONFIG.mapZoom,
      zoomControl: true,
      attributionControl: true
    });

    // Capa base del mapa
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors | Sistema AMIE',
      maxZoom: CONFIG.maxZoom,
      minZoom: CONFIG.minZoom
    }).addTo(map);

    // Capa de división territorial (provincias) con bordes negros
    fetch('provincias_simplificado.geojson')
      .then(r => r.json())
      .then(geo => {
        const provinciasLayer = L.geoJSON(geo, {
          style: { color: '#000', weight: 1.2, opacity: 1, fillOpacity: 0 }
        });
        provinciasLayer.addTo(map);
        if (markersLayer) {
          provinciasLayer.bringToBack();
          markersLayer.bringToFront();
        }
      })
      .catch(err => console.warn('No se pudo cargar provincias_simplificado.geojson:', err));

    // Inicializar capa de marcadores con clustering
    markersLayer = L.markerClusterGroup({
      chunkedLoading: true,
      spiderfyOnMaxZoom: false,
      showCoverageOnHover: true,
      zoomToBoundsOnClick: true,
      maxClusterRadius: function (zoom) {
        return (zoom <= 5) ? 200 : CONFIG.clusterRadius;
      },
      disableClusteringAtZoom: 7,
      iconCreateFunction: function(cluster) {
        const childCount = cluster.getChildCount();
        let c = ' marker-cluster-';
        if (childCount < 10) {
          c += 'small';
        } else if (childCount < 100) {
          c += 'medium';
        } else {
          c += 'large';
        }
        return new L.DivIcon({
          html: '<div><span>' + childCount + '</span></div>',
          className: 'marker-cluster' + c,
          iconSize: new L.Point(40, 40)
        });
      }
    });

    map.addLayer(markersLayer);

    // Actualizar KPI al mover/zoom
    map.on('zoomend moveend', () => {
      __updateKPI__(data.length, filteredData.length);
    });
  }

  // Cargar datos desde CSV local
  function loadData() {
    updateStatus('Cargando datos...');
    
    fetch('data.csv')
      .then(response => response.text())
      .then(csvText => {
        data = parseCSV(csvText);
        console.log('Datos cargados desde CSV:', data.length, 'registros');
        processData();
      })
      .catch(error => {
        console.error('Error cargando datos:', error);
        updateStatus('Error al cargar datos');
      });
  }

  // Parsear CSV mejorado para manejar diferentes separadores y formatos
  function parseCSV(csvText) {
    // Detectar separador (puede ser ; o ,)
    const firstLine = csvText.split('\n')[0];
    const separator = firstLine.includes(';') ? ';' : ',';
    
    const lines = csvText.split('\n').filter(line => line.trim());
    const headers = lines[0].split(separator).map(h => h.trim().replace(/^\uFEFF/, '')); // Eliminar BOM
    const result = [];

    console.log('Headers detectados:', headers);
    console.log('Separador detectado:', separator);

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(separator).map(v => v.trim().replace(/^"|"$/g, ''));
      
      if (values.length < headers.length) continue;
      
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      result.push(obj);
    }

    return result;
  }

  // Procesar datos - Mapear campos del nuevo CSV
  function processData() {
    // Mapear los campos del nuevo CSV a nombres normalizados
    data = data.map(row => {
      // Parsear coordenadas (pueden venir con coma decimal)
      let lat = parseFloat(String(row.Latitud || row.LATITUD || '').replace(',', '.')) || 0;
      let lng = parseFloat(String(row.Longitud || row.LONGITUD || '').replace(',', '.')) || 0;

      // Buscar el campo de régimen (puede venir con diferentes nombres)
      let regimen = row['Régimen'] || row['RÉGIMEN'] || row.REGIMEN || row.Regimen || '';
      
      // Buscar el campo de cantón (puede venir con o sin tilde)
      let canton = row['CANTÓN'] || row.CANTON || row['Cantón'] || '';
      
      // Buscar el campo de nivel de educación (puede tener espacios)
      let nivelEducacion = row['NIVEL DE EDUCACIÓN'] || row['NIVEL_DE_EDUCACIÓN'] || 
                           row.NIVEL_DE_E || row.NIVEL_DE_EDUCACION || '';
      
      // Buscar el campo de año de dotación (puede tener espacios)
      let anioDotacion = row['AUX_AÑO DE DOTACIÓN'] || row['AÑO_DE_DO'] || 
                         row.AUX_ANIO_DOTACION || row['AÑO DE DOTACIÓN'] || '';

      return {
        // Campos mapeados del nuevo CSV
        AMIE: row.AMIE || '',
        INSTITUCION: row.INSTITUCIO || row.INSTITUCION || '',
        PROVINCIA: __normalizeProvince__(row.PROVINCIA || ''),
        CANTON: canton,
        PARROQUIA: row.PARROQUIA || '',
        ZONA: row.ZONA || '',
        DISTRITO: row.DISTRITO || '',
        TIPO_EDUCACION: row.TIPO_EDUCA || row.TIPO_EDUCACION || '',
        SOSTENIMIENTO: row.SOSTENIMIE || row.SOSTENIMIENTO || '',
        JURISDICCION: row.JURISDICCI || row.JURISDICCION || '',
        MODALIDAD: row.MODALIDAD || '',
        REGIMEN: __normalizeRegimen__(regimen),
        TIPOLOGIA: row.TIPOLOGIA || '',
        ZONA_INEC: row.ZONA_INEC || '',
        NIVEL_DE_EDUCACION: nivelEducacion,
        AUX_ANIO_DOTACION: String(anioDotacion).trim(),
        LATITUD: lat,
        LONGITUD: lng,
        // Campos de inversión (si no existen, serán 0)
        MD_MONTO_USD: parseFloat(row.MD_MONTO_USD) || 0,
        M_MONTO_USD: parseFloat(row.M_MONTO_USD) || 0,
        JE_MONTO_USD: parseFloat(row.JE_MONTO_USD) || 0,
        TOTAL_INVERSION: (parseFloat(row.MD_MONTO_USD) || 0) + 
                         (parseFloat(row.M_MONTO_USD) || 0) + 
                         (parseFloat(row.JE_MONTO_USD) || 0),
        // Guardar row original por si se necesita
        _raw: row
      };
    }).filter(row => row.LATITUD !== 0 && row.LONGITUD !== 0);

    console.log('Datos procesados:', data.length, 'registros con coordenadas válidas');
    
    // Mostrar ejemplo de primer registro procesado
    if (data.length > 0) {
      console.log('Ejemplo de registro procesado:', data[0]);
      // Debug: mostrar valores únicos de campos clave
      console.log('Provincias únicas:', [...new Set(data.map(r => r.PROVINCIA))]);
      console.log('Zonas únicas:', [...new Set(data.map(r => r.ZONA))]);
      console.log('Regímenes únicos:', [...new Set(data.map(r => r.REGIMEN))]);
      console.log('Niveles únicos:', [...new Set(data.map(r => r.NIVEL_DE_EDUCACION))]);
      console.log('Años únicos:', [...new Set(data.map(r => r.AUX_ANIO_DOTACION))]);
    }

    filteredData = [...data];
    
    // Poblar filtros
    populateFilters();
    
    // Renderizar marcadores
    renderMarkers();
    
    // Actualizar estadísticas
    updateStatistics();
    
    // Actualizar estado
    updateStatus('Listo: ' + data.length + ' instituciones cargadas');
    __updateKPI__(data.length, filteredData.length);
  }

  // Poblar selectores de filtros
  function populateFilters() {
    // Provincias
    const provincias = [...new Set(data.map(r => r.PROVINCIA).filter(Boolean))].sort();
    const provSel = document.getElementById('provSel');
    if (provSel) {
      provSel.innerHTML = '<option value="">Todas las provincias</option>';
      provincias.forEach(p => {
        provSel.innerHTML += `<option value="${p}">${p}</option>`;
      });
    }

    // Cantones
    const cantones = [...new Set(data.map(r => r.CANTON).filter(Boolean))].sort();
    const cantSel = document.getElementById('cantSel');
    if (cantSel) {
      cantSel.innerHTML = '<option value="">Todos los cantones</option>';
      cantones.forEach(c => {
        cantSel.innerHTML += `<option value="${c}">${c}</option>`;
      });
    }

    // Zonas
    const zonas = [...new Set(data.map(r => r.ZONA).filter(Boolean))].sort();
    const zonaSel = document.getElementById('zonaSel');
    if (zonaSel) {
      zonaSel.innerHTML = '<option value="">Todas las zonas</option>';
      zonas.forEach(z => {
        zonaSel.innerHTML += `<option value="${z}">${z}</option>`;
      });
    }

    // Niveles de educación
    const niveles = [...new Set(data.map(r => r.NIVEL_DE_EDUCACION).filter(Boolean))].sort();
    const nivelSel = document.getElementById('nivelSel');
    if (nivelSel) {
      nivelSel.innerHTML = '<option value="">Todos los niveles</option>';
      niveles.forEach(n => {
        nivelSel.innerHTML += `<option value="${n}">${n}</option>`;
      });
    }

    // Años de dotación
    const anios = [...new Set(data.map(r => r.AUX_ANIO_DOTACION).filter(Boolean))].sort();
    const anioSel = document.getElementById('anioSel');
    if (anioSel) {
      anioSel.innerHTML = '<option value="">Todos los años</option>';
      anios.forEach(a => {
        anioSel.innerHTML += `<option value="${a}">${a}</option>`;
      });
    }

    // Regímenes
    const regimenes = [...new Set(data.map(r => r.REGIMEN).filter(Boolean))].sort();
    const regimenSel = document.getElementById('regimenSel');
    if (regimenSel) {
      regimenSel.innerHTML = '<option value="">Todos los regímenes</option>';
      regimenes.forEach(r => {
        regimenSel.innerHTML += `<option value="${r}">${r}</option>`;
      });
    }
  }

  // Configurar event listeners
  function setupEventListeners() {
    // Filtro por AMIE (búsqueda en tiempo real)
    const amieTxt = document.getElementById('amieTxt');
    if (amieTxt) {
      amieTxt.addEventListener('input', (e) => {
        filters.amie = e.target.value.trim().toUpperCase();
        applyFilters();
      });
    }

    // Filtros de selección
    const selectFilters = [
      { id: 'provSel', key: 'provincia' },
      { id: 'cantSel', key: 'canton' },
      { id: 'zonaSel', key: 'zona' },
      { id: 'nivelSel', key: 'nivel' },
      { id: 'anioSel', key: 'anio' },
      { id: 'regimenSel', key: 'regimen' }
    ];

    selectFilters.forEach(({ id, key }) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', (e) => {
          filters[key] = e.target.value;
          
          // Si cambia provincia, actualizar cantones
          if (key === 'provincia') {
            updateCantonOptions(e.target.value);
          }
          
          applyFilters();
        });
      }
    });

    // Botones de filtro especiales
    const btnAnio = document.getElementById('btnAnioFilter');
    const anioDropdown = document.getElementById('anioFilterDropdown');
    if (btnAnio && anioDropdown) {
      btnAnio.addEventListener('click', () => {
        anioDropdown.classList.toggle('hidden');
      });
    }

    const btnRegimen = document.getElementById('btnRegimenFilter');
    const regimenDropdown = document.getElementById('regimenFilterDropdown');
    if (btnRegimen && regimenDropdown) {
      btnRegimen.addEventListener('click', () => {
        regimenDropdown.classList.toggle('hidden');
      });
    }

    // Botón limpiar filtros
    const btnLimpiar = document.getElementById('btnLimpiar');
    if (btnLimpiar) {
      btnLimpiar.addEventListener('click', clearFilters);
    }

    // Botón exportar (si existe)
    const btnExport = document.getElementById('btnExport');
    if (btnExport) {
      btnExport.addEventListener('click', exportData);
    }
  }

  // Actualizar opciones de cantón según provincia
  function updateCantonOptions(provincia) {
    const cantSel = document.getElementById('cantSel');
    if (!cantSel) return;

    let cantones;
    if (provincia) {
      cantones = [...new Set(data.filter(r => r.PROVINCIA === provincia).map(r => r.CANTON).filter(Boolean))].sort();
    } else {
      cantones = [...new Set(data.map(r => r.CANTON).filter(Boolean))].sort();
    }

    cantSel.innerHTML = '<option value="">Todos los cantones</option>';
    cantones.forEach(c => {
      cantSel.innerHTML += `<option value="${c}">${c}</option>`;
    });
  }

  // Aplicar filtros
  function applyFilters() {
    filteredData = data.filter(row => {
      // Filtro por AMIE
      if (filters.amie && !row.AMIE.toUpperCase().includes(filters.amie)) {
        return false;
      }
      
      // Filtro por provincia
      if (filters.provincia && row.PROVINCIA !== filters.provincia) {
        return false;
      }
      
      // Filtro por cantón
      if (filters.canton && row.CANTON !== filters.canton) {
        return false;
      }
      
      // Filtro por zona
      if (filters.zona && row.ZONA !== filters.zona) {
        return false;
      }
      
      // Filtro por nivel
      if (filters.nivel && row.NIVEL_DE_EDUCACION !== filters.nivel) {
        return false;
      }
      
      // Filtro por año
      if (filters.anio && row.AUX_ANIO_DOTACION !== filters.anio) {
        return false;
      }
      
      // Filtro por régimen
      if (filters.regimen && row.REGIMEN !== filters.regimen) {
        return false;
      }
      
      return true;
    });

    console.log('Filtros aplicados. Resultados:', filteredData.length);
    
    renderMarkers();
    updateStatistics();
    updateFilterStatus();
    __updateKPI__(data.length, filteredData.length);
  }

  // Limpiar filtros
  function clearFilters() {
    // Resetear objeto de filtros
    filters = {
      amie: '',
      provincia: '',
      canton: '',
      zona: '',
      nivel: '',
      anio: '',
      regimen: '',
      distrito: '',
      parroquia: '',
      tipologia: ''
    };

    // Resetear campos del formulario
    const fields = ['amieTxt', 'provSel', 'cantSel', 'zonaSel', 'nivelSel', 'anioSel', 'regimenSel'];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (el.tagName === 'INPUT') {
          el.value = '';
        } else if (el.tagName === 'SELECT') {
          el.selectedIndex = 0;
        }
      }
    });

    // Ocultar dropdowns
    const anioDropdown = document.getElementById('anioFilterDropdown');
    const regimenDropdown = document.getElementById('regimenFilterDropdown');
    if (anioDropdown) anioDropdown.classList.add('hidden');
    if (regimenDropdown) regimenDropdown.classList.add('hidden');

    // Restaurar cantones
    updateCantonOptions('');

    // Aplicar filtros (mostrar todos)
    applyFilters();
    
    updateStatus('Filtros limpiados');
  }

  // Renderizar marcadores en el mapa
  function renderMarkers() {
    markersLayer.clearLayers();

    filteredData.forEach(row => {
      // Determinar icono según régimen
      let iconUrl = CONFIG.icons.default;
      if (row.REGIMEN === 'COSTA') {
        iconUrl = CONFIG.icons.costa;
      } else if (row.REGIMEN === 'SIERRA') {
        iconUrl = CONFIG.icons.sierra;
      }

      // Crear icono personalizado
      const customIcon = L.icon({
        iconUrl: iconUrl,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        shadowSize: [41, 41],
        shadowAnchor: [13, 41]
      });

      // Crear marcador
      const marker = L.marker([row.LATITUD, row.LONGITUD], {
        icon: customIcon,
        title: row.INSTITUCION
      });

      // Crear contenido del popup
      const popupContent = createPopupContent(row);
      marker.bindPopup(popupContent, {
        maxWidth: 400,
        className: 'custom-popup'
      });

      markersLayer.addLayer(marker);
    });

    // Ajustar vista si hay datos
    try {
      if (filteredData.length > 0) {
        const b = markersLayer.getBounds();
        if (b.isValid()) {
          map.fitBounds(b, { maxZoom: 10, padding: [20, 20] });
        }
      }
    } catch(e) {
      console.warn('Error ajustando bounds:', e);
    }
  }

  // Crear contenido del popup
  function createPopupContent(row) {
    const hasInversion = row.TOTAL_INVERSION > 0;
    
    let inversionHTML = '';
    if (hasInversion) {
      inversionHTML = `
        <div class="popup-total">
          <div class="popup-total-row">
            <span class="popup-total-label">Inversión Total:</span>
            <span class="popup-total-value">${formatCurrency(row.TOTAL_INVERSION)}</span>
          </div>
        </div>
      `;
    }
    
    return `
      <div class="popup-wrapper">
        <div class="popup-header">
          <h3 class="popup-title">${row.INSTITUCION || 'Sin nombre'}</h3>
          <p class="popup-subtitle">AMIE: ${row.AMIE || 'N/A'}</p>
        </div>
        <div class="popup-content">
          <div class="popup-row">
            <span class="popup-label">Zona:</span>
            <span class="popup-value">${row.ZONA || 'N/A'}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Distrito:</span>
            <span class="popup-value">${row.DISTRITO || 'N/A'}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Provincia:</span>
            <span class="popup-value">${row.PROVINCIA || 'N/A'}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Cantón:</span>
            <span class="popup-value">${row.CANTON || 'N/A'}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Parroquia:</span>
            <span class="popup-value">${row.PARROQUIA || 'N/A'}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Tipo Educación:</span>
            <span class="popup-value">${row.TIPO_EDUCACION || 'N/A'}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Sostenimiento:</span>
            <span class="popup-value">${row.SOSTENIMIENTO || 'N/A'}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Jurisdicción:</span>
            <span class="popup-value">${row.JURISDICCION || 'N/A'}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Modalidad:</span>
            <span class="popup-value">${row.MODALIDAD || 'N/A'}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Régimen:</span>
            <span class="popup-value">${row.REGIMEN || 'N/A'}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Tipología:</span>
            <span class="popup-value">${row.TIPOLOGIA || 'N/A'}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Zona INEC:</span>
            <span class="popup-value">${row.ZONA_INEC || 'N/A'}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Nivel Educativo:</span>
            <span class="popup-value">${row.NIVEL_DE_EDUCACION || 'N/A'}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Año de Dotación:</span>
            <span class="popup-value">${row.AUX_ANIO_DOTACION || 'N/A'}</span>
          </div>
          ${inversionHTML}
        </div>
      </div>
    `;
  }

  // Actualizar estadísticas
  function updateStatistics() {
    const totalInstituciones = filteredData.length;
    const totalMD = filteredData.reduce((sum, row) => sum + row.MD_MONTO_USD, 0);
    const totalM = filteredData.reduce((sum, row) => sum + row.M_MONTO_USD, 0);
    const totalJE = filteredData.reduce((sum, row) => sum + row.JE_MONTO_USD, 0);
    const totalGeneral = totalMD + totalM + totalJE;

    // Actualizar contadores
    const countElement = document.getElementById('countInstituciones');
    if (countElement) countElement.textContent = totalInstituciones.toLocaleString();
    
    const inversionElement = document.getElementById('totalInversion');
    if (inversionElement) {
      if (totalGeneral > 0) {
        inversionElement.textContent = formatCurrency(totalGeneral);
      } else {
        inversionElement.textContent = 'N/A';
      }
    }
    
    const totalCellElement = document.getElementById('totalCell');
    if (totalCellElement) {
      if (totalGeneral > 0) {
        totalCellElement.textContent = formatCurrency(totalGeneral);
      } else {
        totalCellElement.textContent = 'N/A';
      }
    }

    // Actualizar tabla de rubros
    const tbody = document.querySelector('#rubrosTable tbody');
    if (tbody) {
      if (totalGeneral > 0) {
        tbody.innerHTML = `
          <tr>
            <td>Material Didáctico</td>
            <td>${formatCurrency(totalMD)}</td>
          </tr>
          <tr>
            <td>Mobiliario</td>
            <td>${formatCurrency(totalM)}</td>
          </tr>
          <tr>
            <td>Juegos Exteriores</td>
            <td>${formatCurrency(totalJE)}</td>
          </tr>
        `;
      } else {
        tbody.innerHTML = `
          <tr>
            <td colspan="2" style="text-align:center;color:#888;">Sin datos de inversión</td>
          </tr>
        `;
      }
    }
    
    console.log('Estadísticas actualizadas:', {
      instituciones: totalInstituciones,
      materialDidactico: totalMD,
      mobiliario: totalM,
      juegosExteriores: totalJE,
      total: totalGeneral
    });
  }

  // Actualizar estado de filtros
  function updateFilterStatus() {
    const activeFilters = [];
    
    if (filters.amie) activeFilters.push(`AMIE: ${filters.amie}`);
    if (filters.provincia) activeFilters.push(`Provincia: ${filters.provincia}`);
    if (filters.canton) activeFilters.push(`Cantón: ${filters.canton}`);
    if (filters.zona) activeFilters.push(`Zona: ${filters.zona}`);
    if (filters.nivel) activeFilters.push(`Nivel: ${filters.nivel}`);
    if (filters.anio) activeFilters.push(`Año: ${filters.anio}`);
    if (filters.regimen) activeFilters.push(`Régimen: ${filters.regimen}`);

    const statusText = activeFilters.length > 0 
      ? `Filtros activos: ${activeFilters.join(', ')}`
      : 'Sin filtros activos';
    
    const filtrosElement = document.getElementById('filtrosActivos');
    if (filtrosElement) filtrosElement.textContent = statusText;
  }

  // Exportar datos a CSV
  function exportData() {
    if (filteredData.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    const headers = [
      'AMIE', 'INSTITUCION', 'PROVINCIA', 'CANTON', 'PARROQUIA',
      'ZONA', 'DISTRITO', 'TIPO_EDUCACION', 'SOSTENIMIENTO',
      'JURISDICCION', 'MODALIDAD', 'REGIMEN', 'TIPOLOGIA',
      'ZONA_INEC', 'NIVEL_DE_EDUCACION', 'AÑO_DOTACION',
      'LATITUD', 'LONGITUD'
    ];

    let csvContent = headers.join(',') + '\n';

    filteredData.forEach(row => {
      const rowData = [
        row.AMIE,
        '"' + (row.INSTITUCION || '').replace(/"/g, '""') + '"',
        row.PROVINCIA || '',
        row.CANTON || '',
        row.PARROQUIA || '',
        row.ZONA || '',
        row.DISTRITO || '',
        row.TIPO_EDUCACION || '',
        row.SOSTENIMIENTO || '',
        row.JURISDICCION || '',
        row.MODALIDAD || '',
        row.REGIMEN || '',
        row.TIPOLOGIA || '',
        row.ZONA_INEC || '',
        row.NIVEL_DE_EDUCACION || '',
        row.AUX_ANIO_DOTACION || '',
        row.LATITUD,
        row.LONGITUD
      ];
      csvContent += rowData.join(',') + '\n';
    });

    // Crear y descargar el archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `datos_amie_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    updateStatus('Datos exportados: ' + filteredData.length + ' registros');
  }

  // Formatear moneda
  function formatCurrency(amount) {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  // Actualizar estado
  function updateStatus(message) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.textContent = message;
    }
    console.log('Estado:', message);
  }

  // Manejar errores
  window.addEventListener('error', function(event) {
    console.error('Error:', event.error);
    updateStatus('Error en la aplicación');
  });

})();
