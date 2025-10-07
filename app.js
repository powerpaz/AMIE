/* =========================
   Mapa base y lógica de UI
   ========================= */

// Crear mapa
const map = L.map("map", {
  center: [-1.83, -78.18], // centro aproximado de Ecuador
  zoom: 6,
  zoomControl: true
});

// Panes para controlar z-index de labels
map.createPane("labels");
map.getPane("labels").style.zIndex = 650; // sobre la base
map.getPane("labels").style.pointerEvents = "none";

// Capas base
const lyrOSM = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap"
});

const lyrEsriImagery = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    maxZoom: 19,
    attribution: "Tiles &copy; Esri"
  }
);

const lyrEsriStreets = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
  {
    maxZoom: 19,
    attribution: "Tiles &copy; Esri"
  }
);

const lyrCartoPositron = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  {
    maxZoom: 20,
    subdomains: "abcd",
    attribution:
      "&copy; OpenStreetMap &copy; CARTO"
  }
);

// Rótulos (labels) como overlay
const lyrLabels = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
  {
    maxZoom: 20,
    subdomains: "abcd",
    pane: "labels",
    opacity: 1
  }
);

// Estado de base activa
let activeBase = lyrOSM.addTo(map);

// Helpers
const setBase = (code) => {
  if (activeBase) map.removeLayer(activeBase);
  switch (code) {
    case "sat":
      activeBase = lyrEsriImagery;
      break;
    case "esri":
      activeBase = lyrEsriStreets;
      break;
    case "carto":
      activeBase = lyrCartoPositron;
      break;
    default:
      activeBase = lyrOSM;
  }
  activeBase.addTo(map);
};

// UI: radios de basemap
document.querySelectorAll('input[name="basemap"]').forEach((r) => {
  r.addEventListener("change", (e) => setBase(e.target.value));
});

// UI: checkbox de rótulos
const chkLabels = document.getElementById("chkLabels");
chkLabels.addEventListener("change", (e) => {
  if (e.target.checked) {
    lyrLabels.addTo(map);
  } else {
    map.removeLayer(lyrLabels);
  }
});

// ======== Herramientas de coordenadas ========

const $ = (id) => document.getElementById(id);
const latDD = $("latDD");
const lonDD = $("lonDD");

let marker = null;

// Mostrar posición del cursor
map.on("mousemove", (e) => {
  $("cursor").textContent = `Cursor: ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
});

// Clic para rellenar lat/lon
map.on("click", (e) => {
  latDD.value = e.latlng.lat.toFixed(6);
  lonDD.value = e.latlng.lng.toFixed(6);
});

// Ir (centrar)
$("btnIr").addEventListener("click", () => {
  const lat = parseFloat(latDD.value);
  const lon = parseFloat(lonDD.value);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    map.setView([lat, lon], 17, { animate: true });
    setStatus("Centrado en coordenadas.");
  } else {
    setStatus("Coordenadas inválidas.", true);
  }
});

// Fijar punto (coloca o mueve marcador)
$("btnFijar").addEventListener("click", () => {
  const lat = parseFloat(latDD.value);
  const lon = parseFloat(lonDD.value);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    setStatus("Coordenadas inválidas.", true);
    return;
  }
  if (!marker) {
    marker = L.marker([lat, lon], { draggable: true }).addTo(map);
    marker.on("dragend", (ev) => {
      const p = ev.target.getLatLng();
      latDD.value = p.lat.toFixed(6);
      lonDD.value = p.lng.toFixed(6);
    });
  } else {
    marker.setLatLng([lat, lon]);
  }
  $("seleccion").textContent = "Selección: 1";
  setStatus("Marcador fijado.");
});

// Copiar coord a portapapeles
$("btnCopiar").addEventListener("click", async () => {
  const txt = `${latDD.value}, ${lonDD.value}`;
  try {
    await navigator.clipboard.writeText(txt);
    setStatus("Coordenadas copiadas.");
  } catch (e) {
    setStatus("No se pudo copiar al portapapeles.", true);
  }
});

function setStatus(msg, error = false) {
  const el = $("status");
  el.textContent = (error ? "⚠️ " : "✅ ") + msg;
  el.style.color = error ? "#ffb4b4" : "#9cb0d1";
}

// Mensaje inicial
setStatus("Listo. Selecciona tu capa base debajo de la calculadora.");
