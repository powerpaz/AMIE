// AMIE - Visor Geográfico Final - Sin Supabase, usando datos locales
// Versión modificada para usar CSV/JSON local en lugar de Supabase

(() => {
  let map, allData = [], filteredData = [], markerLayer, provinceBoundaries;
  const rubros = ["MD_MONTO_USD", "M_MONTO_USD", "JE_MONTO_USD"];
  const rubroLabels = {
    MD_MONTO_USD: "Material Didáctico",
    M_MONTO_USD: "Mobiliario",
    JE_MONTO_USD: "Juegos Exteriores"
  };

  // Función para cargar datos desde el archivo JSON local
  async function loadLocalData() {
    try {
      const response = await fetch('data.json');
      if (!response.ok) throw new Error('Error al cargar datos');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error cargando datos locales:', error);
      // Fallback: intentar cargar desde CSV
      return loadCSVData();
    }
  }

  // Función alternativa para cargar desde CSV
  async function loadCSVData() {
    try {
      const response = await fetch('data.csv');
      const text = await response.text();
      return parseCSV(text);
    } catch (error) {
      console.error('Error cargando CSV:', error);
      return [];
    }
  }

  // Parser simple de CSV
  function parseCSV(text) {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const values = lines[i].split(',');
        const row = {};
        headers.forEach((header, index) => {
          let value = values[index] || '';
          value = value.replace(/"/g, '').trim();
          // Convertir números
          if (['MD_MONTO_USD', 'M_MONTO_USD', 'JE_MONTO_USD', 'LONGITUD', 'LATITUD', 'NRO_NINOS', 'MD_PARALELOS', 'JE_CANTIDAD'].includes(header)) {
            row[header] = parseFloat(value) || 0;
          } else {
            row[header] = value;
          }
        });
        data.push(row);
      }
    }
    return data;
  }

  // Inicialización del mapa
  async function initMap() {
    try {
      // Configurar mapa base
      map = L.map("map", { 
        center: [-1.831239, -78.183406], // Ecuador
        zoom: 7,
        minZoom: 5,
        maxZoom: 18
      });

      // Agregar capa base
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      // Cargar provincias (GeoJSON)
      try {
        const provResponse = await fetch("provincias_simplificado.geojson");
        const provData = await provResponse.json();
        provinceBoundaries = L.geoJSON(provData, {
          style: {
            fillColor: "#3388ff",
            fillOpacity: 0.05,
            weight: 1,
            color: "#3388ff",
            opacity: 0.5
          },
          interactive: false
        }).addTo(map);
      } catch (e) {
        console.warn("No se pudieron cargar los límites provinciales:", e);
      }

      // Cargar datos desde archivo local
      updateStatus("Cargando datos...");
      allData = await loadLocalData();
      
      // Filtrar datos con coordenadas válidas
      allData = allData.filter(inst => {
        const lat = parseFloat(inst.LATITUD);
        const lng = parseFloat(inst.LONGITUD);
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
      });

      updateStatus(`${allData.length} instituciones cargadas`);
      
      // Inicializar filtros
      initFilters();
      
      // Aplicar filtros iniciales
      applyFilters();
      
    } catch (error) {
      console.error("Error inicializando mapa:", error);
      updateStatus("Error cargando datos");
    }
  }

  // Inicializar controles de filtros
  function initFilters() {
    // Obtener valores únicos para cada filtro
    const provincias = [...new Set(allData.map(d => d.PROVINCIA).filter(Boolean))].sort();
    const cantones = [...new Set(allData.map(d => d.CANTON).filter(Boolean))].sort();
    const zonas = [...new Set(allData.map(d => d.ZONA).filter(Boolean))].sort();
    const niveles = [...new Set(allData.map(d => d.NIVEL_DE_EDUCACION).filter(Boolean))].sort();
    const anios = [...new Set(allData.map(d => d.AUX_ANIO_DOTACION).filter(Boolean))].sort();

    // Llenar selectores
    fillSelect("provSel", provincias);
    fillSelect("cantSel", cantones);
    fillSelect("zonaSel", zonas);
    fillSelect("nivelSel", niveles);
    fillSelect("anioSel", anios);

    // Agregar event listeners
    document.getElementById("amieTxt").addEventListener("input", debounce(applyFilters, 300));
    document.getElementById("provSel").addEventListener("change", () => {
      updateCantones();
      applyFilters();
    });
    document.getElementById("cantSel").addEventListener("change", applyFilters);
    document.getElementById("zonaSel").addEventListener("change", applyFilters);
    document.getElementById("nivelSel").addEventListener("change", applyFilters);
    document.getElementById("anioSel").addEventListener("change", applyFilters);
    document.getElementById("btnLimpiar").addEventListener("click", clearFilters);
    document.getElementById("btnExport").addEventListener("click", exportCSV);
  }

  // Llenar selector
  function fillSelect(id, options) {
    const select = document.getElementById(id);
    select.innerHTML = '<option value="">Todos</option>';
    options.forEach(opt => {
      const option = document.createElement("option");
      option.value = opt;
      option.textContent = opt;
      select.appendChild(option);
    });
  }

  // Actualizar cantones basado en provincia seleccionada
  function updateCantones() {
    const provincia = document.getElementById("provSel").value;
    const cantonSelect = document.getElementById("cantSel");
    
    if (provincia) {
      const cantones = [...new Set(allData
        .filter(d => d.PROVINCIA === provincia)
        .map(d => d.CANTON)
        .filter(Boolean))].sort();
      fillSelect("cantSel", cantones);
    } else {
      const cantones = [...new Set(allData.map(d => d.CANTON).filter(Boolean))].sort();
      fillSelect("cantSel", cantones);
    }
  }

  // Aplicar filtros
  function applyFilters() {
    const amie = document.getElementById("amieTxt").value.toLowerCase().trim();
    const provincia = document.getElementById("provSel").value;
    const canton = document.getElementById("cantSel").value;
    const zona = document.getElementById("zonaSel").value;
    const nivel = document.getElementById("nivelSel").value;
    const anio = document.getElementById("anioSel").value;

    filteredData = allData.filter(inst => {
      if (amie && !inst.AMIE?.toLowerCase().includes(amie)) return false;
      if (provincia && inst.PROVINCIA !== provincia) return false;
      if (canton && inst.CANTON !== canton) return false;
      if (zona && inst.ZONA !== zona) return false;
      if (nivel && inst.NIVEL_DE_EDUCACION !== nivel) return false;
      if (anio && inst.AUX_ANIO_DOTACION !== anio) return false;
      return true;
    });

    updateMap();
    updateTotals();
    updateFilterStatus();
  }

  // Limpiar filtros
  function clearFilters() {
    document.getElementById("amieTxt").value = "";
    document.getElementById("provSel").value = "";
    document.getElementById("cantSel").value = "";
    document.getElementById("zonaSel").value = "";
    document.getElementById("nivelSel").value = "";
    document.getElementById("anioSel").value = "";
    
    // Restaurar todos los cantones
    const cantones = [...new Set(allData.map(d => d.CANTON).filter(Boolean))].sort();
    fillSelect("cantSel", cantones);
    
    applyFilters();
  }

  // Actualizar mapa con marcadores
  function updateMap() {
    // Limpiar capa anterior
    if (markerLayer) {
      map.removeLayer(markerLayer);
    }

    // Crear cluster de marcadores
    markerLayer = L.markerClusterGroup({
      disableClusteringAtZoom: 15,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true
    });

    // Agregar marcadores
    filteredData.forEach(inst => {
      const lat = parseFloat(inst.LATITUD);
      const lng = parseFloat(inst.LONGITUD);
      
      if (!isNaN(lat) && !isNaN(lng)) {
        const marker = L.circleMarker([lat, lng], {
          radius: 6,
          fillColor: getMarkerColor(inst),
          color: "#fff",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8
        });

        // Crear contenido del popup
        const popupContent = createPopupContent(inst);
        marker.bindPopup(popupContent, {
          maxWidth: 350,
          className: 'custom-popup'
        });

        markerLayer.addLayer(marker);
      }
    });

    map.addLayer(markerLayer);

    // Ajustar vista si hay marcadores
    if (filteredData.length > 0 && markerLayer.getBounds().isValid()) {
      map.fitBounds(markerLayer.getBounds(), { padding: [50, 50] });
    }
  }

  // Obtener color del marcador según el tipo
  function getMarkerColor(inst) {
    if (inst.JE_MONTO_USD > 0) return "#22c55e"; // Verde - Juegos Exteriores
    if (inst.M_MONTO_USD > 0) return "#3b82f6";  // Azul - Mobiliario
    if (inst.MD_MONTO_USD > 0) return "#f59e0b"; // Naranja - Material Didáctico
    return "#6b7280"; // Gris - Sin dotación
  }

  // Crear contenido del popup
  function createPopupContent(inst) {
    const formatMoney = (val) => {
      const num = parseFloat(val) || 0;
      return num.toLocaleString("es-EC", { 
        style: "currency", 
        currency: "USD",
        minimumFractionDigits: 2
      });
    };

    let content = `
      <div class="popup-content">
        <div class="popup-header">
          <h3>${inst.INSTITUCION || 'Sin nombre'}</h3>
          <span class="popup-amie">AMIE: ${inst.AMIE || 'N/A'}</span>
        </div>
        <div class="popup-body">
          <div class="popup-section">
            <h4>Ubicación</h4>
            <table class="popup-table">
              <tr><td>Zona:</td><td>${inst.ZONA || 'N/A'}</td></tr>
              <tr><td>Provincia:</td><td>${inst.PROVINCIA || 'N/A'}</td></tr>
              <tr><td>Cantón:</td><td>${inst.CANTON || 'N/A'}</td></tr>
              <tr><td>Parroquia:</td><td>${inst.PARROQUIA || 'N/A'}</td></tr>
              <tr><td>Distrito:</td><td>${inst.DISTRITO || 'N/A'}</td></tr>
            </table>
          </div>
          
          <div class="popup-section">
            <h4>Información Educativa</h4>
            <table class="popup-table">
              <tr><td>Tipo:</td><td>${inst.TIPO_EDUCACION || 'N/A'}</td></tr>
              <tr><td>Nivel:</td><td>${inst.NIVEL_DE_EDUCACION || 'N/A'}</td></tr>
              <tr><td>Sostenimiento:</td><td>${inst.SOSTENIMIENTO || 'N/A'}</td></tr>
              <tr><td>Jurisdicción:</td><td>${inst.JURISDICCION || 'N/A'}</td></tr>
              <tr><td>Régimen:</td><td>${inst.REGIMEN || 'N/A'}</td></tr>
              <tr><td>Niños (3-4 años):</td><td>${inst.NRO_NINOS || 0}</td></tr>
            </table>
          </div>`;

    // Agregar información de dotación si existe
    const hasDotacion = inst.MD_MONTO_USD > 0 || inst.M_MONTO_USD > 0 || inst.JE_MONTO_USD > 0;
    
    if (hasDotacion) {
      content += `
          <div class="popup-section">
            <h4>Dotación</h4>
            <table class="popup-table">`;
      
      if (inst.MD_MONTO_USD > 0) {
        content += `
              <tr>
                <td>Material Didáctico:</td>
                <td><strong>${formatMoney(inst.MD_MONTO_USD)}</strong></td>
              </tr>
              ${inst.MD_ANIO_DOTACION ? `<tr><td class="indent">Año:</td><td>${inst.MD_ANIO_DOTACION}</td></tr>` : ''}
              ${inst.MD_PARALELOS ? `<tr><td class="indent">Paralelos:</td><td>${inst.MD_PARALELOS}</td></tr>` : ''}`;
      }
      
      if (inst.M_MONTO_USD > 0) {
        content += `
              <tr>
                <td>Mobiliario:</td>
                <td><strong>${formatMoney(inst.M_MONTO_USD)}</strong></td>
              </tr>
              ${inst.M_ANIO_DOTACION ? `<tr><td class="indent">Año:</td><td>${inst.M_ANIO_DOTACION}</td></tr>` : ''}
              ${inst.M_TIPO_DE_AMBIENTE ? `<tr><td class="indent">Tipo:</td><td>${inst.M_TIPO_DE_AMBIENTE}</td></tr>` : ''}`;
      }
      
      if (inst.JE_MONTO_USD > 0) {
        content += `
              <tr>
                <td>Juegos Exteriores:</td>
                <td><strong>${formatMoney(inst.JE_MONTO_USD)}</strong></td>
              </tr>
              ${inst.JE_ANIO_DOTACION ? `<tr><td class="indent">Año:</td><td>${inst.JE_ANIO_DOTACION}</td></tr>` : ''}
              ${inst.JE_CANTIDAD ? `<tr><td class="indent">Cantidad:</td><td>${inst.JE_CANTIDAD}</td></tr>` : ''}`;
      }
      
      content += `
            </table>
          </div>`;
    }

    content += `
          <div class="popup-section">
            <table class="popup-table">
              <tr><td>Coordenadas:</td><td>${inst.LATITUD}, ${inst.LONGITUD}</td></tr>
            </table>
          </div>
        </div>
      </div>`;

    return content;
  }

  // Actualizar totales
  function updateTotals() {
    const tbody = document.querySelector("#rubrosTable tbody");
    const totalCell = document.getElementById("totalCell");
    const countCell = document.getElementById("countInstituciones");
    
    tbody.innerHTML = "";
    let total = 0;

    rubros.forEach(rubro => {
      const sum = filteredData.reduce((acc, inst) => acc + (parseFloat(inst[rubro]) || 0), 0);
      total += sum;
      
      const row = tbody.insertRow();
      row.insertCell(0).textContent = rubroLabels[rubro];
      row.insertCell(1).textContent = formatCurrency(sum);
    });

    totalCell.textContent = formatCurrency(total);
    countCell.textContent = `Instituciones: ${filteredData.length}`;
  }

  // Formatear moneda
  function formatCurrency(value) {
    return value.toLocaleString("es-EC", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2
    });
  }

  // Actualizar estado de filtros
  function updateFilterStatus() {
    const filtrosActivos = [];
    
    if (document.getElementById("amieTxt").value) filtrosActivos.push("AMIE");
    if (document.getElementById("provSel").value) filtrosActivos.push("Provincia");
    if (document.getElementById("cantSel").value) filtrosActivos.push("Cantón");
    if (document.getElementById("zonaSel").value) filtrosActivos.push("Zona");
    if (document.getElementById("nivelSel").value) filtrosActivos.push("Nivel");
    if (document.getElementById("anioSel").value) filtrosActivos.push("Año");
    
    const statusText = filtrosActivos.length > 0 
      ? `Filtros activos: ${filtrosActivos.join(", ")}`
      : "Filtros activos: Ninguno";
    
    document.getElementById("filtrosActivos").textContent = statusText;
  }

  // Exportar CSV
  function exportCSV() {
    let csv = "AMIE,INSTITUCION,PROVINCIA,CANTON,ZONA,NIVEL_EDUCACION,MD_MONTO,M_MONTO,JE_MONTO,TOTAL\\n";
    
    filteredData.forEach(inst => {
      const md = parseFloat(inst.MD_MONTO_USD) || 0;
      const m = parseFloat(inst.M_MONTO_USD) || 0;
      const je = parseFloat(inst.JE_MONTO_USD) || 0;
      const total = md + m + je;
      
      csv += `"${inst.AMIE || ''}","${inst.INSTITUCION || ''}","${inst.PROVINCIA || ''}","${inst.CANTON || ''}","${inst.ZONA || ''}","${inst.NIVEL_DE_EDUCACION || ''}",${md},${m},${je},${total}\\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `amie_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  // Actualizar estado
  function updateStatus(message) {
    document.getElementById("status").textContent = message;
  }

  // Debounce helper
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Inicializar cuando el DOM esté listo
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMap);
  } else {
    initMap();
  }
})();
