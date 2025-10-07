/* App base — mapa, capas, panel transformación, copiar y fijar punto */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const setStatus = (t) => { /* opcional: tu barra de estado */ };

let map; window.map = null;

function initMap() {
  // Mapa
  map = L.map("map", { zoomControl: true }).setView([-1.83, -78.18], 6);
  window.map = map;

  // Capas base
  const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "&copy; OpenStreetMap"
  });
  const esriSat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19, attribution: "Tiles &copy; Esri"
  });
  const esriStreet = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19, attribution: "Tiles &copy; Esri World Street Map"
  });
  const cartoPositron = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19, subdomains: "abcd", attribution: "&copy; CartoDB, OpenStreetMap"
  });
  const esriLabels = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19, attribution: "Labels & Boundaries &copy; Esri", pane: "overlayPane" }
  );

  osm.addTo(map); // base por defecto

  // Switcher (debajo de calculadora)
  const bindSwitcher = () => {
    const basemaps = { osm, esriSat, esriStreet, carto: cartoPositron };

    function activateBase(name){
      [osm, esriSat, esriStreet, cartoPositron].forEach(l=>{ if (map.hasLayer(l)) map.removeLayer(l); });
      if (basemaps[name]) basemaps[name].addTo(map);
    }

    $$('#basemap-switcher input[name=basemap]').forEach(r => {
      r.addEventListener('change', (e)=> activateBase(e.target.value));
    });

    const chk = $('#chkLabels');
    if (chk){
      chk.addEventListener('change', ()=>{
        if (chk.checked){ esriLabels.addTo(map); } else { map.removeLayer(esriLabels); }
      });
    }

    // Aplicar selección inicial del radio y checkbox
    const start = document.querySelector('#basemap-switcher input[name=basemap]:checked');
    if (start) activateBase(start.value);
    if (chk && chk.checked) esriLabels.addTo(map);
  };
  setTimeout(bindSwitcher, 0);

  // Medidor
  setTimeout(()=>{ if (window.initMeasure && window.map) initMeasure(window.map); }, 0);

  // Icono de cruz roja para "Fijar punto"
  const crossIcon = L.divIcon({
    className: 'cross-pin',
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
               width="18" height="18" stroke="red" stroke-width="3" fill="none"
               stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 12h16M12 4v16"/>
           </svg>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });

  /* --------- Interacciones de la calculadora --------- */

  // Capturar click en mapa -> llenar DD
  map.on('click', (e)=>{
    const {lat, lng} = e.latlng;
    const latInp = $('[data-field="latDD"]'); const lonInp = $('[data-field="lonDD"]');
    if (latInp) latInp.value = lat.toFixed(6);
    if (lonInp) lonInp.value = lng.toFixed(6);
    if (typeof setStatus === "function") setStatus("Coordenadas capturadas");
  });

  // Botón Ir -> centrar en Lat/Lon (DD)
  $('#tp-btn-center').addEventListener('click', (e)=>{
    e.preventDefault();
    const lat = parseFloat(readVal('latDD','latDD')), lon = parseFloat(readVal('lonDD','lonDD'));
    if (Number.isFinite(lat) && Number.isFinite(lon)){
      map.setView([lat, lon], Math.max(14, map.getZoom()));
    }
  });

  // Botón Fijar punto -> cruz roja en Lat/Lon (DD)
  $('#tp-btn-pin').addEventListener('click', (e)=>{
    e.preventDefault();
    const lat = parseFloat(readVal('latDD','latDD')), lon = parseFloat(readVal('lonDD','lonDD'));
    if (Number.isFinite(lat) && Number.isFinite(lon)){
      L.marker([lat, lon], { icon: crossIcon }).addTo(map);
    }
  });

  // Botón Copiar -> copia DD + UTM17 + UTM18
  $('#tp-btn-copy').addEventListener('click', async (e)=>{
    e.preventDefault();
    await copyCoordsBlock();
  });

  // Atajos de base (opcional: comenta si no quieres)
  window.addEventListener('keydown', (e)=>{
    if (['INPUT','SELECT','TEXTAREA'].includes((document.activeElement||{}).tagName)) return;
    const basemapRadios = {
      '1':'osm','2':'esriSat','3':'esriStreet','4':'carto'
    };
    if (basemapRadios[e.key]){
      const v = basemapRadios[e.key];
      const target = document.querySelector(`#basemap-switcher input[name=basemap][value="${v}"]`);
      if (target){ target.checked = true; target.dispatchEvent(new Event('change')); }
    }
    if (e.key.toLowerCase() === 'l'){
      const chk = $('#chkLabels');
      if (chk){ chk.checked = !chk.checked; chk.dispatchEvent(new Event('change')); }
    }
  });
}

/* -------- Utilidades de lectura y copiado -------- */
function readVal(key, fallbackId) {
  const el = document.querySelector(`[data-field="${key}"]`) || document.getElementById(fallbackId || key);
  return el ? (el.value || el.textContent || "").trim() : "";
}
function readSel(key, fallbackId) {
  const el = document.querySelector(`[data-field="${key}"]`) || document.getElementById(fallbackId || key);
  if (!el) return "";
  const v = (el.value || "").trim();
  const txt = el.options && el.selectedIndex >= 0 ? (el.options[el.selectedIndex].text || v) : v;
  return (txt || v || "").trim();
}
function buildClipboardPayload() {
  const latDD = readVal("latDD", "latDD");
  const lonDD = readVal("lonDD", "lonDD");
  const utm17Zone = readSel("utm17Zone","utm17Zone") || "17";
  const utm17Hem  = readSel("utm17Hem","utm17Hem")   || "S";
  const utm17E    = readVal("utm17E","utm17E");
  const utm17N    = readVal("utm17N","utm17N");
  const utm18Zone = readSel("utm18Zone","utm18Zone") || "18";
  const utm18Hem  = readSel("utm18Hem","utm18Hem")   || "S";
  const utm18E    = readVal("utm18E","utm18E");
  const utm18N    = readVal("utm18N","utm18N");

  const lines = [
    `Lat, Lon (DD): ${latDD}, ${lonDD}`,
    `UTM (${utm17Zone}${utm17Hem} — principal): E=${utm17E} | N=${utm17N}`,
    `UTM (${utm18Zone}${utm18Hem} — alterna):  E=${utm18E} | N=${utm18N}`
  ];
  return lines.join("\n");
}
async function copyCoordsBlock() {
  const payload = buildClipboardPayload();
  try {
    await navigator.clipboard.writeText(payload);
    if (typeof setStatus === "function") setStatus("Coordenadas copiadas");
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = payload;
    ta.style.position = "fixed";
    ta.style.opacity = "0.001";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } finally { document.body.removeChild(ta); }
    if (typeof setStatus === "function") setStatus("Coordenadas copiadas");
  }
}

/* Init */
document.addEventListener('DOMContentLoaded', initMap);

 
