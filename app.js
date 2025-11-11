// ===============================================
// Sistema de Visualización Geográfica - AMIE
// JavaScript Principal v2.1 - Corregido (+supercluster +KPI)
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
    // casos parciales
    v = v.replace('CARHI', 'CARCHI');
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
    clusterRadius: 50, // radio base para zoom alto
    
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
    },
    
    // Valores totales del Anexo 2 (para validación)
    totalesPlanificados: {
      2026: {
        materialDidactico: 2726916.18,
        mobiliario: 1389273.18,
        juegosExteriores: 707050.00,
        total: 4823239.36,
        instituciones: 335
      },
      2027: {
        materialDidactico: 5212883.85,
        mobiliario: 2691920.17,
        juegosExteriores: 987500.00,
        total: 8892304.02,
        instituciones: 590
      }
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
    regimen: ''
  };

  // Inicialización cuando el DOM está listo
  document.addEventListener('DOMContentLoaded', initApp);

  function initApp() {
    console.log('Iniciando aplicación AMIE v2.1');
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
        // Mantener debajo de puntos pero visible
        if (markersLayer) {
          provinciasLayer.bringToBack();
          markersLayer.bringToFront();
        }
      })
      .catch(err => console.warn('No se pudo cargar provincias_simplificado.geojson:', err));

    // Inicializar capa de marcadores con clustering
    // Supercluster: 1 solo cluster en zooms lejanos; se desagrega progresivamente
    markersLayer = L.markerClusterGroup({
      chunkedLoading: true,
      spiderfyOnMaxZoom: false,
      showCoverageOnHover: true,
      zoomToBoundsOnClick: true,
      // En zoom <=5 devolvemos un radio muy grande para forzar un único clúster (p.ej., 827)
      maxClusterRadius: function (zoom) {
        return (zoom <= 5) ? 200 : CONFIG.clusterRadius; // 200 px a zoom lejano, 50 px (tu valor) al acercar
      },
      disableClusteringAtZoom: 7, // a partir de 7 deja de agrupar
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

    // Actualizar KPI al mover/zoom (visibles = filtrados)
    map.on('zoomend moveend', () => {
      __updateKPI__(data.length, filteredData.length);
    });
  }

  // Cargar datos
  function loadData() {
    updateStatus('Cargando datos...');
    
    // Intentar cargar desde data.json primero
    fetch('data.json')
      .then(response => response.json())
      .then(jsonData => {
        console.log('Datos cargados desde JSON:', jsonData.length);
        data = jsonData;
        processData();
      })
      .catch(() => {
        // Si falla, intentar cargar desde data.csv
        fetch('data.csv')
          .then(response => response.text())
          .then(csvText => {
            data = parseCSV(csvText);
            console.log('Datos cargados desde CSV:', data.length);
            processData();
          })
          .catch(error => {
            console.error('Error cargando datos:', error);
            updateStatus('Error al cargar datos');
          });
      });
  }

  // Parsear CSV mejorado para manejar comas dentro de campos
  function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];

    for (let i = 1; i < lines.length; i++) {
      // Manejar campos con comas dentro de comillas
      const regex = /,(?=(?:[^"]*"[^"]*")*[^"]*$)/;
      const values = lines[i].split(regex).map(v => {
        // Remover comillas si existen
        return v.replace(/^"|"$/g, '').trim();
      });
      
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      result.push(obj);
    }

    return result;
  }

  // Procesar datos
  function processData() {
    // Limpiar datos y convertir coordenadas
    data = data.map(row => {
      return {
        ...row,
        PROVINCIA: __normalizeProvince__(row.PROVINCIA),
        LATITUD: parseFloat(row.LATITUD) || 0,
        LONGITUD: parseFloat(row.LONGITUD) || 0,
        MD_MONTO_USD: parseFloat(row.MD_MONTO_USD) || 0,
        M_MONTO_USD: parseFloat(row.M_MONTO_USD) || 0,
        JE_MONTO_USD: parseFloat(row.JE_MONTO_USD) || 0,
        TOTAL_INVERSION: (parseFloat(row.MD_MONTO_USD) || 0) + 
                         (parseFloat(row.M_MONTO_USD) || 0) + 
                         (parseFloat(row.JE_MONTO_USD) || 0),
        // Asegurar que el año sea string
        AUX_ANIO_DOTACION: String(row.AUX_ANIO_DOTACION || '').trim()
      };
    }).filter(row => row.LATITUD !== 0 && row.LONGITUD !== 0);

    filteredData = [...data];
    
    // Validar totales contra el Anexo 2
    validateTotals();
    
    populateFilters();
    updateMarkers();
    updateStatistics();
    updateStatus('Datos cargados: ' + data.length + ' instituciones');

    // KPI inicial
    __updateKPI__(data.length, filteredData.length);
  }

  // Validar totales contra el Anexo 2
  function validateTotals() {
    const totales = {};
    
    data.forEach(row => {
      const year = row.AUX_ANIO_DOTACION;
      if (!totales[year]) {
        totales[year] = {
          materialDidactico: 0,
          mobiliario: 0,
          juegosExteriores: 0,
          instituciones: 0
        };
      }
      totales[year].materialDidactico += row.MD_MONTO_USD;
      totales[year].mobiliario += row.M_MONTO_USD;
      totales[year].juegosExteriores += row.JE_MONTO_USD;
      totales[year].instituciones++;
    });
    
    console.log('=== Validación de totales contra Anexo 2 ===');
    Object.keys(totales).forEach(year => {
      const t = totales[year];
      const total = t.materialDidactico + t.mobiliario + t.juegosExteriores;
      console.log(`Año ${year}:`);
      console.log(`  Instituciones: ${t.instituciones}`);
      console.log(`  Material Didáctico: $${t.materialDidactico.toFixed(2)}`);
      console.log(`  Mobiliario: $${t.mobiliario.toFixed(2)}`);
      console.log(`  Juegos Exteriores: $${t.juegosExteriores.toFixed(2)}`);
      console.log(`  TOTAL: $${total.toFixed(2)}`);
      
      if (CONFIG.totalesPlanificados[year]) {
        const planificado = CONFIG.totalesPlanificados[year];
        console.log(`  Diferencia vs Anexo 2: $${(total - planificado.total).toFixed(2)}`);
      }
    });
  }

  // Poblar los selectores de filtros
  function populateFilters() {
    // Provincia
    const provincias = [...new Set(data.map(d => __normalizeProvince__(d.PROVINCIA)))].filter(p => p).sort();
    populateSelect('provSel', provincias);

    // Cantón
    const cantones = [...new Set(data.map(d => d.CANTON))].filter(c => c).sort();
    populateSelect('cantSel', cantones);

    // Zona
    const zonas = [...new Set(data.map(d => d.ZONA))].filter(z => z).sort();
    populateSelect('zonaSel', zonas);

    // Nivel de Educación
    const niveles = [...new Set(data.map(d => d.NIVEL_DE_EDUCACION))].filter(n => n).sort();
    populateSelect('nivelSel', niveles);

    // Año de Dotación - IMPORTANTE: manejar como strings
    const anios = [...new Set(data.map(d => d.AUX_ANIO_DOTACION))].filter(a => a).sort();
    console.log('Años disponibles para filtros:', anios);
    populateSelect('anioSel', anios);

    // Régimen ya está hardcodeado en el HTML (COSTA/SIERRA)
  }

  // Llenar un selector con opciones
  function populateSelect(selectId, options) {
    const select = document.getElementById(selectId);
    if (!select) {
      console.warn(`Selector ${selectId} no encontrado`);
      return;
    }
    
    // Mantener la primera opción (Todos)
    while (select.options.length > 1) {
      select.remove(1);
    }
    
    options.forEach(option => {
      if (option) {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        select.add(opt);
      }
    });
  }

  // Configurar event listeners
  function setupEventListeners() {
    // Filtros básicos
    const amieTxt = document.getElementById('amieTxt');
    if (amieTxt) amieTxt.addEventListener('input', applyFilters);
    
    const provSel = document.getElementById('provSel');
    if (provSel) provSel.addEventListener('change', onProvinciaChange);
    
    const cantSel = document.getElementById('cantSel');
    if (cantSel) cantSel.addEventListener('change', applyFilters);
    
    const zonaSel = document.getElementById('zonaSel');
    if (zonaSel) zonaSel.addEventListener('change', applyFilters);
    
    const nivelSel = document.getElementById('nivelSel');
    if (nivelSel) nivelSel.addEventListener('change', applyFilters);
    
    const anioSel = document.getElementById('anioSel');
    if (anioSel) anioSel.addEventListener('change', applyFilters);
    
    const regimenSel = document.getElementById('regimenSel');
    if (regimenSel) regimenSel.addEventListener('change', applyFilters);

    // Botones de filtro principales
    const btnAnioFilter = document.getElementById('btnAnioFilter');
    if (btnAnioFilter) {
      btnAnioFilter.addEventListener('click', function() {
        const dropdown = document.getElementById('anioFilterDropdown');
        if (dropdown) {
          dropdown.classList.toggle('hidden');
          const regimenDropdown = document.getElementById('regimenFilterDropdown');
          if (regimenDropdown) regimenDropdown.classList.add('hidden');
        }
      });
    }

    const btnRegimenFilter = document.getElementById('btnRegimenFilter');
    if (btnRegimenFilter) {
      btnRegimenFilter.addEventListener('click', function() {
        const dropdown = document.getElementById('regimenFilterDropdown');
        if (dropdown) {
          dropdown.classList.toggle('hidden');
          const anioDropdown = document.getElementById('anioFilterDropdown');
          if (anioDropdown) anioDropdown.classList.add('hidden');
        }
      });
    }

    // Botón limpiar
    const btnLimpiar = document.getElementById('btnLimpiar');
    if (btnLimpiar) btnLimpiar.addEventListener('click', clearFilters);

    // Botón exportar
    const btnExport = document.getElementById('btnExport');
    if (btnExport) btnExport.addEventListener('click', exportData);
  }

  // Cuando cambia la provincia, filtrar cantones
  function onProvinciaChange() {
    const provincia = document.getElementById('provSel').value;
    const provinciaNorm = __normalizeProvince__(provincia);
    
    if (provinciaNorm) {
      const cantones = [...new Set(
        data
          .filter(d => __normalizeProvince__(d.PROVINCIA) === provinciaNorm)
          .map(d => d.CANTON)
      )].filter(c => c).sort();
      populateSelect('cantSel', cantones);
    } else {
      const cantones = [...new Set(data.map(d => d.CANTON))].filter(c => c).sort();
      populateSelect('cantSel', cantones);
    }
    
    applyFilters();
  }

  // Aplicar filtros
  function applyFilters() {
    filters = {
      amie: document.getElementById('amieTxt')?.value.toUpperCase() || '',
      provincia: document.getElementById('provSel')?.value || '',
      canton: document.getElementById('cantSel')?.value || '',
      zona: document.getElementById('zonaSel')?.value || '',
      nivel: document.getElementById('nivelSel')?.value || '',
      anio: document.getElementById('anioSel')?.value || '',
      regimen: document.getElementById('regimenSel')?.value || ''
    };

    console.log('Filtros aplicados:', filters);

    filteredData = data.filter(row => {
      // Comparación consistente de años como strings
      const rowAnio = String(row.AUX_ANIO_DOTACION || '').trim();
      const filterAnio = String(filters.anio || '').trim();
      const matchAnio = !filterAnio || rowAnio === filterAnio;

      return (!filters.amie || String(row.AMIE || '').toUpperCase().includes(filters.amie)) &&
             (!filters.provincia || __normalizeProvince__(row.PROVINCIA) === __normalizeProvince__(filters.provincia)) &&
             (!filters.canton || row.CANTON === filters.canton) &&
             (!filters.zona || row.ZONA === filters.zona) &&
             (!filters.nivel || row.NIVEL_DE_EDUCACION === filters.nivel) &&
             matchAnio &&
             (!filters.regimen || row.REGIMEN === filters.regimen);
    });

    console.log(`Datos filtrados: ${filteredData.length} de ${data.length}`);
    
    updateMarkers();
    updateStatistics();
    updateFilterStatus();
    __updateKPI__(data.length, filteredData.length);
  }

  // Limpiar filtros
  function clearFilters() {
    document.getElementById('amieTxt').value = '';
    document.getElementById('provSel').value = '';
    document.getElementById('cantSel').value = '';
    document.getElementById('zonaSel').value = '';
    document.getElementById('nivelSel').value = '';
    document.getElementById('anioSel').value = '';
    document.getElementById('regimenSel').value = '';
    
    // Ocultar dropdowns de filtros
    const anioDropdown = document.getElementById('anioFilterDropdown');
    if (anioDropdown) anioDropdown.classList.add('hidden');
    
    const regimenDropdown = document.getElementById('regimenFilterDropdown');
    if (regimenDropdown) regimenDropdown.classList.add('hidden');
    
    applyFilters();
  }

  // Actualizar marcadores en el mapa
  function updateMarkers() {
    markersLayer.clearLayers();

    filteredData.forEach(row => {
      // Determinar el icono según el régimen
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

    // Asegura el clúster grande al inicio si estás lejos
    try {
      if (filteredData.length > 0) {
        const b = markersLayer.getBounds();
        if (b.isValid()) map.fitBounds(b, { maxZoom: CONFIG.minZoom }); // evita acercar demasiado
      }
    } catch(e){}
  }

  // Crear contenido del popup
  function createPopupContent(row) {
    const totalInversion = formatCurrency(row.TOTAL_INVERSION);
    
    return `
      <div class="popup-wrapper">
        <div class="popup-header">
          <h3 class="popup-title">${row.INSTITUCION || 'Sin nombre'}</h3>
          <p class="popup-subtitle">AMIE: ${row.AMIE || 'N/A'}</p>
        </div>
        <div class="popup-content">
          <div class="popup-row">
            <span class="popup-label">Tipo de Material:</span>
            <span class="popup-value">${row.AUX_IE_MATERIAL || 'N/A'}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Sostenimiento:</span>
            <span class="popup-value">${row.SOSTENIMIENTO || 'N/A'}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Nivel Educativo:</span>
            <span class="popup-value">${row.NIVEL_DE_EDUCACION || 'N/A'}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Régimen:</span>
            <span class="popup-value">${row.REGIMEN || 'N/A'}</span>
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
            <span class="popup-label">Zona:</span>
            <span class="popup-value">${row.ZONA || 'N/A'}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Año de Dotación:</span>
            <span class="popup-value">${row.AUX_ANIO_DOTACION || 'N/A'}</span>
          </div>
          <div class="popup-total">
            <div class="popup-total-row">
              <span class="popup-total-label">Inversión Total:</span>
              <span class="popup-total-value">${totalInversion}</span>
            </div>
          </div>
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
    if (inversionElement) inversionElement.textContent = formatCurrency(totalGeneral);
    
    const totalCellElement = document.getElementById('totalCell');
    if (totalCellElement) totalCellElement.textContent = formatCurrency(totalGeneral);

    // Actualizar tabla de rubros
    const tbody = document.querySelector('#rubrosTable tbody');
    if (tbody) {
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
    }
    
    // Log para verificación
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
      'AMIE', 'INSTITUCION', 'AUX_IE_MATERIAL', 'SOSTENIMIENTO', 
      'NIVEL_DE_EDUCACION', 'REGIMEN', 'PROVINCIA', 'CANTON', 
      'ZONA', 'AUX_ANIO_DOTACION', 'INVERSION_TOTAL', 
      'MD_MONTO_USD', 'M_MONTO_USD', 'JE_MONTO_USD'
    ];

    let csvContent = headers.join(',') + '\n';

    filteredData.forEach(row => {
      const rowData = [
        row.AMIE,
        '"' + (row.INSTITUCION || '').replace(/"/g, '""') + '"',
        row.AUX_IE_MATERIAL || '',
        row.SOSTENIMIENTO || '',
        row.NIVEL_DE_EDUCACION || '',
        row.REGIMEN || '',
        row.PROVINCIA || '',
        row.CANTON || '',
        row.ZONA || '',
        row.AUX_ANIO_DOTACION || '',
        row.TOTAL_INVERSION.toFixed(2),
        row.MD_MONTO_USD.toFixed(2),
        row.M_MONTO_USD.toFixed(2),
        row.JE_MONTO_USD.toFixed(2)
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
