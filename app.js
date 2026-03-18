// ===============================================
// Sistema de Visualización Geográfica - AMIE
// Ajustado para filtros robustos y resumen global
// ===============================================

(function() {
  'use strict';

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function normalizeProvince(value) {
    let v = normalizeText(value);
    if (v === 'CARHI') v = 'CARCHI';
    if (v === 'LOS RIOS') return 'LOS RIOS';
    if (v === 'BOLIVAR') return 'BOLIVAR';
    if (v === 'SANTO DOMINGO DE LOS TSACHILAS' || v === 'SANTO DOMINGO DE LOS TSCACHILAS') return 'SANTO DOMINGO DE LOS TSACHILAS';
    return v;
  }

  function normalizeBudget(value) {
    const v = normalizeText(value);
    if (!v) return '';
    if (v === 'BANCO MUNDIAL') return 'BANCO MUNDIAL';
    if (v === 'FISCAL') return 'Fiscal';
    return String(value || '').trim();
  }

  function parseCoordinate(value) {
    const txt = String(value || '').replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(txt);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function splitCSVLine(line, separator) {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === separator && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    values.push(current.trim());
    return values.map(v => v.replace(/^"|"$/g, ''));
  }

  const CONFIG = {
    mapCenter: [-1.8312, -78.1834],
    mapZoom: 7,
    maxZoom: 18,
    minZoom: 5,
    clusterRadius: 50,
    icons: {
      costa: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
      sierra: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
      default: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
    }
  };

  let map;
  let markersLayer;
  let data = [];
  let filteredData = [];
  let filters = getEmptyFilters();

  function getEmptyFilters() {
    return {
      amie: '',
      provincia: '',
      canton: '',
      zona: '',
      anio: '',
      regimen: '',
      dotacion: ''
    };
  }

  document.addEventListener('DOMContentLoaded', initApp);

  function initApp() {
    initMap();
    setupEventListeners();
    loadData();
  }

  function initMap() {
    map = L.map('map', {
      center: CONFIG.mapCenter,
      zoom: CONFIG.mapZoom,
      zoomControl: true,
      attributionControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors | Sistema AMIE',
      maxZoom: CONFIG.maxZoom,
      minZoom: CONFIG.minZoom
    }).addTo(map);

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

    markersLayer = L.markerClusterGroup({
      chunkedLoading: true,
      spiderfyOnMaxZoom: false,
      showCoverageOnHover: true,
      zoomToBoundsOnClick: true,
      maxClusterRadius: zoom => (zoom <= 5 ? 200 : CONFIG.clusterRadius),
      disableClusteringAtZoom: 7,
      iconCreateFunction: cluster => {
        const childCount = cluster.getChildCount();
        let c = ' marker-cluster-';
        if (childCount < 10) c += 'small';
        else if (childCount < 100) c += 'medium';
        else c += 'large';
        return new L.DivIcon({
          html: '<div><span>' + childCount + '</span></div>',
          className: 'marker-cluster' + c,
          iconSize: new L.Point(40, 40)
        });
      }
    });

    map.addLayer(markersLayer);
  }

  function loadData() {
    updateStatus('Cargando datos...');
    fetch('data.csv')
      .then(response => response.text())
      .then(csvText => {
        data = processData(parseCSV(csvText));
        filteredData = [...data];
        populateFilters();
        renderMarkers();
        updateStatistics();
        updateFilterStatus();
        updateMapSubtitle();
        updateStatus(`Listo: ${data.length} instituciones cargadas`);
      })
      .catch(error => {
        console.error('Error cargando datos:', error);
        updateStatus('Error al cargar datos');
      });
  }

  function parseCSV(csvText) {
    const lines = csvText.replace(/\r/g, '').split('\n').filter(line => line.trim());
    if (!lines.length) return [];
    const separator = lines[0].includes(';') ? ';' : ',';
    const headers = splitCSVLine(lines[0], separator).map(h => h.replace(/^\uFEFF/, '').trim());
    return lines.slice(1).map(line => {
      const values = splitCSVLine(line, separator);
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });
  }

  function processData(rows) {
    return rows.map(row => {
      const lat = parseCoordinate(row.Latitud || row.LATITUD);
      const lng = parseCoordinate(row.Longitud || row.LONGITUD);
      const regimen = row['Régimen'] || row['RÉGIMEN'] || row.REGIMEN || row.Regimen || '';
      const canton = row['CANTÓN'] || row.CANTON || row['Cantón'] || '';
      const anioDotacion = row['AUX_AÑO DE DOTACIÓN'] || row['AÑO_DE_DO'] || row.AUX_ANIO_DOTACION || row['AÑO DE DOTACIÓN'] || '';
      const dotacion = row['DOTACIÓN'] || row['DOTACION'] || row['Dotación'] || '';

      return {
        NRO: String(row['Nro'] || row['Nro.'] || row['NRO'] || row['\uFEFFNro'] || '').trim(),
        AMIE: String(row.AMIE || '').trim(),
        INSTITUCION: row.INSTITUCI || row.INSTITUCION || row.INSTITUCIO || '',
        PROVINCIA: normalizeProvince(row.PROVINCIA || ''),
        CANTON: String(canton || '').trim(),
        PARROQUIA: String(row.PARROQUIA || '').trim(),
        ZONA: String(row.ZONA || '').trim(),
        DISTRITO: String(row.DISTRITO || '').trim(),
        REGIMEN: normalizeText(regimen),
        ZONA_INEC: String(row.ZONA_INEC || '').trim(),
        AUX_ANIO_DOTACION: String(anioDotacion || '').trim(),
        DOTACION: String(dotacion || '').trim(),
        LATITUD: lat,
        LONGITUD: lng,
        _raw: row
      };
    }).filter(row => row.LATITUD !== 0 && row.LONGITUD !== 0);
  }

  function populateFilters() {
    populateSelect('provSel', uniqueSorted(data.map(r => r.PROVINCIA)), 'Todas las provincias');
    populateSelect('cantSel', uniqueSorted(data.map(r => r.CANTON)), 'Todos los cantones');
    populateSelect('zonaSel', uniqueSorted(data.map(r => r.ZONA)), 'Todas las zonas');
    populateSelect('anioSel', uniqueSorted(data.map(r => r.AUX_ANIO_DOTACION)), 'Todos los años');
    populateSelect('regimenSel', uniqueSorted(data.map(r => r.REGIMEN)), 'Todos los regímenes');
    populateSelect('dotacionSel', uniqueSorted(data.map(r => r.DOTACION)), 'Todas las dotaciones');
  }

  function uniqueSorted(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'es'));
  }

  function populateSelect(id, values, emptyLabel) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `<option value="">${emptyLabel}</option>`;
    values.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      el.appendChild(option);
    });
  }

  function setupEventListeners() {
    const amieTxt = document.getElementById('amieTxt');
    if (amieTxt) {
      amieTxt.addEventListener('input', e => {
        filters.amie = normalizeText(e.target.value);
        applyFilters();
      });
    }

    [
      { id: 'provSel', key: 'provincia' },
      { id: 'cantSel', key: 'canton' },
      { id: 'zonaSel', key: 'zona' },
      { id: 'anioSel', key: 'anio' },
      { id: 'regimenSel', key: 'regimen' },
      { id: 'dotacionSel', key: 'dotacion' }
    ].forEach(({ id, key }) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', e => {
        filters[key] = e.target.value;
        if (key === 'provincia') {
          updateCantonOptions(e.target.value);
          const cantSel = document.getElementById('cantSel');
          if (cantSel) cantSel.value = '';
          filters.canton = '';
        }
        applyFilters();
      });
    });

    setupDropdownButton('btnAnioFilter', 'anioFilterDropdown');
    setupDropdownButton('btnRegimenFilter', 'regimenFilterDropdown');
    setupDropdownButton('btnDotacionFilter', 'dotacionFilterDropdown');

    const btnLimpiar = document.getElementById('btnLimpiar');
    if (btnLimpiar) btnLimpiar.addEventListener('click', clearFilters);
  }

  function setupDropdownButton(buttonId, dropdownId) {
    const button = document.getElementById(buttonId);
    const dropdown = document.getElementById(dropdownId);
    if (!button || !dropdown) return;
    button.addEventListener('click', () => {
      dropdown.classList.toggle('hidden');
    });
  }

  function updateCantonOptions(provincia) {
    const values = provincia
      ? uniqueSorted(data.filter(r => r.PROVINCIA === provincia).map(r => r.CANTON))
      : uniqueSorted(data.map(r => r.CANTON));
    populateSelect('cantSel', values, 'Todos los cantones');
  }

  function applyFilters() {
    filteredData = data.filter(row => {
      if (filters.amie && !normalizeText(row.AMIE).includes(filters.amie) && !normalizeText(row.INSTITUCION).includes(filters.amie)) return false;
      if (filters.provincia && row.PROVINCIA !== filters.provincia) return false;
      if (filters.canton && row.CANTON !== filters.canton) return false;
      if (filters.zona && row.ZONA !== filters.zona) return false;
      if (filters.anio && row.AUX_ANIO_DOTACION !== filters.anio) return false;
      if (filters.regimen && row.REGIMEN !== filters.regimen) return false;
      if (filters.dotacion && row.DOTACION !== filters.dotacion) return false;
      return true;
    });

    renderMarkers();
    updateStatistics();
    updateFilterStatus();
    updateMapSubtitle();
    updateStatus(`Mostrando ${filteredData.length} de ${data.length} instituciones`);
  }

  function clearFilters() {
    filters = getEmptyFilters();
    ['amieTxt', 'provSel', 'cantSel', 'zonaSel', 'anioSel', 'regimenSel', 'dotacionSel'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.tagName === 'INPUT') el.value = '';
      else el.selectedIndex = 0;
    });
    ['anioFilterDropdown', 'regimenFilterDropdown', 'dotacionFilterDropdown'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    updateCantonOptions('');
    applyFilters();
  }

  function renderMarkers() {
    markersLayer.clearLayers();

    filteredData.forEach(row => {
      let iconUrl = CONFIG.icons.default;
      if (row.REGIMEN === 'COSTA') iconUrl = CONFIG.icons.costa;
      else if (row.REGIMEN === 'SIERRA') iconUrl = CONFIG.icons.sierra;

      const customIcon = L.icon({
        iconUrl,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        shadowSize: [41, 41],
        shadowAnchor: [13, 41]
      });

      const marker = L.marker([row.LATITUD, row.LONGITUD], {
        icon: customIcon,
        title: row.INSTITUCION || row.AMIE
      });

      marker.bindPopup(createPopupContent(row), {
        maxWidth: 420,
        className: 'custom-popup'
      });

      markersLayer.addLayer(marker);
    });

    try {
      if (filteredData.length > 0) {
        const bounds = markersLayer.getBounds();
        if (bounds.isValid()) map.fitBounds(bounds, { maxZoom: 10, padding: [20, 20] });
      }
    } catch (error) {
      console.warn('No se pudo ajustar el mapa:', error);
    }
  }

  function createPopupContent(row) {
    return `
      <div class="popup-wrapper">
        <div class="popup-header">
          <h3 class="popup-title">${escapeHtml(row.INSTITUCION || 'Sin nombre')}</h3>
          <p class="popup-subtitle">AMIE: ${escapeHtml(row.AMIE || 'N/A')}</p>
        </div>
        <div class="popup-content">
          ${popupRow('Nro.', row.NRO)}
          ${popupRow('Zona', row.ZONA)}
          ${popupRow('Distrito', row.DISTRITO)}
          ${popupRow('Provincia', row.PROVINCIA)}
          ${popupRow('Cantón', row.CANTON)}
          ${popupRow('Parroquia', row.PARROQUIA)}
          ${popupRow('Régimen', row.REGIMEN)}
          ${popupRow('Zona INEC', row.ZONA_INEC)}
          ${popupRow('Año de Dotación', row.AUX_ANIO_DOTACION)}
          ${popupRow('Dotación', row.DOTACION)}
        </div>
      </div>
    `;
  }

  function popupRow(label, value) {
    return `
      <div class="popup-row">
        <span class="popup-label">${escapeHtml(label)}:</span>
        <span class="popup-value">${escapeHtml(value || 'N/A')}</span>
      </div>
    `;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function updateStatistics() {
    const totalInstituciones = data.length;
    const currentMatches = filteredData.length;
    const totalCell = document.getElementById('totalCell');
    const countInstituciones = document.getElementById('countInstituciones');
    const currentMatchesEl = document.getElementById('currentMatches');
    if (countInstituciones) countInstituciones.textContent = totalInstituciones.toLocaleString('es-EC');
    if (currentMatchesEl) currentMatchesEl.textContent = currentMatches.toLocaleString('es-EC');
    if (totalCell) totalCell.textContent = currentMatches.toLocaleString('es-EC');

    const dotacionTypes = uniqueSorted(data.map(r => r.DOTACION));
    const dotacionCounts = dotacionTypes.map(tipo => ({
      tipo,
      count: filteredData.filter(row => row.DOTACION === tipo).length
    }));

    const tbody = document.querySelector('#rubrosTable tbody');
    if (tbody) {
      tbody.innerHTML = dotacionCounts.map(item => `
        <tr>
          <td>${escapeHtml(item.tipo)}</td>
          <td>${item.count.toLocaleString('es-EC')}</td>
        </tr>
      `).join('');
    }
  }

  function updateFilterStatus() {
    const activeFilters = [];
    if (filters.amie) activeFilters.push(`Búsqueda: ${filters.amie}`);
    if (filters.provincia) activeFilters.push(`Provincia: ${filters.provincia}`);
    if (filters.canton) activeFilters.push(`Cantón: ${filters.canton}`);
    if (filters.zona) activeFilters.push(`Zona: ${filters.zona}`);
    if (filters.anio) activeFilters.push(`Año: ${filters.anio}`);
    if (filters.regimen) activeFilters.push(`Régimen: ${filters.regimen}`);
    if (filters.dotacion) activeFilters.push(`Dotación: ${filters.dotacion}`);
    const filtrosElement = document.getElementById('filtrosActivos');
    if (filtrosElement) {
      filtrosElement.textContent = activeFilters.length ? `Filtros activos: ${activeFilters.join(' | ')}` : 'Sin filtros activos';
    }
  }

  function updateMapSubtitle() {
    const el = document.getElementById('mapSubtitle');
    if (!el) return;
    if (filters.dotacion) {
      el.textContent = `VISUALIZACIÓN FILTRADA: ${filters.dotacion}`;
    } else {
      el.textContent = 'VISUALIZACIÓN GENERAL DE DOTACIONES';
    }
  }

  function updateStatus(message) {
    const statusElement = document.getElementById('status');
    if (statusElement) statusElement.textContent = message;
    console.log(message);
  }

  window.addEventListener('error', event => {
    console.error('Error:', event.error);
    updateStatus('Error en la aplicación');
  });
})();
