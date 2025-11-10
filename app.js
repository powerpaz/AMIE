// ===============================================
// Sistema de Visualización Geográfica - AMIE
// JavaScript Principal con mejoras solicitadas
// ===============================================

(function() {
  'use strict';

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
    regimen: ''
  };

  // Inicialización cuando el DOM está listo
  document.addEventListener('DOMContentLoaded', initApp);

  function initApp() {
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

    // Capa base del mapa (OpenStreetMap con estilo personalizado)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors | Sistema AMIE',
      maxZoom: CONFIG.maxZoom,
      minZoom: CONFIG.minZoom
    }).addTo(map);

    // Inicializar capa de marcadores con clustering
    markersLayer = L.markerClusterGroup({
      chunkedLoading: true,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: true,
      zoomToBoundsOnClick: true,
      maxClusterRadius: CONFIG.clusterRadius,
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
  }

  // Cargar datos
  function loadData() {
    updateStatus('Cargando datos...');
    
    // Intentar cargar desde data.json primero
    fetch('data.json')
      .then(response => response.json())
      .then(jsonData => {
        data = jsonData;
        processData();
      })
      .catch(() => {
        // Si falla, intentar cargar desde data.csv
        fetch('data.csv')
          .then(response => response.text())
          .then(csvText => {
            data = parseCSV(csvText);
            processData();
          })
          .catch(error => {
            console.error('Error cargando datos:', error);
            updateStatus('Error al cargar datos');
          });
      });
  }

  // Parsear CSV
  function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] ? values[index].trim() : '';
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
        LATITUD: parseFloat(row.LATITUD) || 0,
        LONGITUD: parseFloat(row.LONGITUD) || 0,
        MD_MONTO_USD: parseFloat(row.MD_MONTO_USD) || 0,
        M_MONTO_USD: parseFloat(row.M_MONTO_USD) || 0,
        JE_MONTO_USD: parseFloat(row.JE_MONTO_USD) || 0,
        TOTAL_INVERSION: (parseFloat(row.MD_MONTO_USD) || 0) + 
                        (parseFloat(row.M_MONTO_USD) || 0) + 
                        (parseFloat(row.JE_MONTO_USD) || 0)
      };
    }).filter(row => row.LATITUD !== 0 && row.LONGITUD !== 0);

    filteredData = [...data];
    
    populateFilters();
    updateMarkers();
    updateStatistics();
    updateStatus('Datos cargados: ' + data.length + ' instituciones');
  }

  // Poblar los selectores de filtros
  function populateFilters() {
    // Provincia
    const provincias = [...new Set(data.map(d => d.PROVINCIA))].sort();
    populateSelect('provSel', provincias);

    // Cantón
    const cantones = [...new Set(data.map(d => d.CANTON))].sort();
    populateSelect('cantSel', cantones);

    // Zona
    const zonas = [...new Set(data.map(d => d.ZONA))].sort();
    populateSelect('zonaSel', zonas);

    // Nivel de Educación
    const niveles = [...new Set(data.map(d => d.NIVEL_DE_EDUCACION))].sort();
    populateSelect('nivelSel', niveles);

    // Año de Dotación
    const anios = [...new Set(data.map(d => d.AUX_ANIO_DOTACION))].sort();
    populateSelect('anioSel', anios);

    // Régimen ya está hardcodeado en el HTML (COSTA/SIERRA)
  }

  // Llenar un selector con opciones
  function populateSelect(selectId, options) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
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
    document.getElementById('amieTxt').addEventListener('input', applyFilters);
    document.getElementById('provSel').addEventListener('change', onProvinciaChange);
    document.getElementById('cantSel').addEventListener('change', applyFilters);
    document.getElementById('zonaSel').addEventListener('change', applyFilters);
    document.getElementById('nivelSel').addEventListener('change', applyFilters);
    document.getElementById('anioSel').addEventListener('change', applyFilters);
    document.getElementById('regimenSel').addEventListener('change', applyFilters);

    // Botones de filtro principales
    document.getElementById('btnAnioFilter').addEventListener('click', function() {
      const dropdown = document.getElementById('anioFilterDropdown');
      dropdown.classList.toggle('hidden');
      document.getElementById('regimenFilterDropdown').classList.add('hidden');
    });

    document.getElementById('btnRegimenFilter').addEventListener('click', function() {
      const dropdown = document.getElementById('regimenFilterDropdown');
      dropdown.classList.toggle('hidden');
      document.getElementById('anioFilterDropdown').classList.add('hidden');
    });

    // Botón limpiar
    document.getElementById('btnLimpiar').addEventListener('click', clearFilters);

    // Botón exportar
    document.getElementById('btnExport').addEventListener('click', exportData);
  }

  // Cuando cambia la provincia, filtrar cantones
  function onProvinciaChange() {
    const provincia = document.getElementById('provSel').value;
    
    if (provincia) {
      const cantones = [...new Set(
        data
          .filter(d => d.PROVINCIA === provincia)
          .map(d => d.CANTON)
      )].sort();
      populateSelect('cantSel', cantones);
    } else {
      const cantones = [...new Set(data.map(d => d.CANTON))].sort();
      populateSelect('cantSel', cantones);
    }
    
    applyFilters();
  }

  // Aplicar filtros
  function applyFilters() {
    filters = {
      amie: document.getElementById('amieTxt').value.toUpperCase(),
      provincia: document.getElementById('provSel').value,
      canton: document.getElementById('cantSel').value,
      zona: document.getElementById('zonaSel').value,
      nivel: document.getElementById('nivelSel').value,
      anio: document.getElementById('anioSel').value,
      regimen: document.getElementById('regimenSel').value
    };

    filteredData = data.filter(row => {
      return (!filters.amie || row.AMIE.includes(filters.amie)) &&
             (!filters.provincia || row.PROVINCIA === filters.provincia) &&
             (!filters.canton || row.CANTON === filters.canton) &&
             (!filters.zona || row.ZONA === filters.zona) &&
             (!filters.nivel || row.NIVEL_DE_EDUCACION === filters.nivel) &&
             (!filters.anio || row.AUX_ANIO_DOTACION === filters.anio) &&
             (!filters.regimen || row.REGIMEN === filters.regimen);
    });

    updateMarkers();
    updateStatistics();
    updateFilterStatus();
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
    document.getElementById('anioFilterDropdown').classList.add('hidden');
    document.getElementById('regimenFilterDropdown').classList.add('hidden');
    
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
    document.getElementById('countInstituciones').textContent = totalInstituciones.toLocaleString();
    document.getElementById('totalInversion').textContent = formatCurrency(totalGeneral);
    document.getElementById('totalCell').textContent = formatCurrency(totalGeneral);

    // Actualizar tabla de rubros
    const tbody = document.querySelector('#rubrosTable tbody');
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
    
    document.getElementById('filtrosActivos').textContent = statusText;
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
      'ZONA', 'INVERSION_TOTAL', 'MD_MONTO_USD', 'M_MONTO_USD', 'JE_MONTO_USD'
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
  }

  // Manejar errores
  window.addEventListener('error', function(event) {
    console.error('Error:', event.error);
    updateStatus('Error en la aplicación');
  });

})();
