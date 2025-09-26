// ======= SUPABASE =======
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = "https://krjwqagkjuzrpxianvnu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandxYWdranV6cnB4aWFudm51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDY4NjEsImV4cCI6MjA3NDMyMjg2MX0.vdIMVgAciBhAweV4CGjEXq-fuo2xRm0qSssl4JhoErQ";
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const TABLE = "instituciones";

// ======= UI =======
const kpiTotal = document.getElementById("kpiTotal");
const kpiMatriz = document.getElementById("kpiMatriz");
const kpiEst = document.getElementById("kpiEst");
const kpiSost = document.getElementById("kpiSost");
const provSelect = document.getElementById("provSelect");
const cantSelect = document.getElementById("cantSelect");
const parrSelect = document.getElementById("parrSelect");
const sostSelect = document.getElementById("sostSelect");
const tipoSelect = document.getElementById("tipoSelect");
const amieInput = document.getElementById("amieInput");
const searchBtn = document.getElementById("searchBtn");
const clearBtn = document.getElementById("clearBtn");
const themeToggle = document.getElementById("themeToggle");
const tbody = document.querySelector("#tbl tbody");
const prevPageBtn = document.getElementById("prevPage");
const nextPageBtn = document.getElementById("nextPage");
const pageInfo = document.getElementById("pageInfo");
const pageSizeSel = document.getElementById("pageSize");

// ======= MAPA =======
let map = L.map("map", { zoomControl:true }).setView([-1.8312, -78.1834], 6);

// Base layers
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19, attribution: "&copy; OpenStreetMap"
}).addTo(map);
const esriSat = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  { maxZoom: 19, attribution: "Tiles © Esri, Maxar, Earthstar Geographics, etc." }
);
L.control.layers({ "OSM": osm, "Satélite (Esri)": esriSat }, {}, { collapsed:true }).addTo(map);

// Cluster layer + red dot icon
let clusterLayer = L.markerClusterGroup({ showCoverageOnHover:false, maxClusterRadius:50 });
map.addLayer(clusterLayer);
const redDotIcon = L.divIcon({ className:"red-dot", html:"", iconSize:[10,10] });

// ======= Barra de coordenadas / Plugin =======
const coordsBar = document.getElementById("coordsBar");
function fmt(n){ return (Math.round(n*1e6)/1e6).toFixed(6); }
map.on("mousemove", (e)=>{ coordsBar.textContent = `Lat: ${fmt(e.latlng.lat)}  Lon: ${fmt(e.latlng.lng)} (click para copiar)`; });
coordsBar.addEventListener("click", ()=> {
  const txt = coordsBar.textContent.replace(" (click para copiar)","");
  navigator.clipboard?.writeText(txt);
});

// Si subiste tu plugin latlontools y expone LatLonTools.addTo(map), lo activamos sin romper si no existe
try { if (window.LatLonTools && typeof window.LatLonTools.addTo === "function") { window.LatLonTools.addTo(map); } } catch(e){ /* noop */ }

// ======= STATE (tabla) =======
let currentData = [];
let currentPage = 1;
let pageSize = parseInt(pageSizeSel.value, 10) || 25;

// ======= HELPERS =======
function applyFilters(q){
  if(provSelect.value) q = q.eq("provincia", provSelect.value);
  if(cantSelect.value) q = q.eq("canton", cantSelect.value);
  if(parrSelect.value) q = q.eq("parroquia", parrSelect.value);
  if(sostSelect.value) q = q.eq("sostenimiento", sostSelect.value);
  if(tipoSelect.value) q = q.eq("tipo", tipoSelect.value);
  return q;
}
function uniqueClean(values){
  return [...new Set(values.map(v => (v ?? "").toString().trim()).filter(Boolean))]
         .sort((a,b)=>a.localeCompare(b,'es'));
}
async function getDistinct(field){
  const { data, error } = await supabase
    .from(TABLE)
    .select(field)
    .not(field, "is", null)
    .neq(field, "")
    .order(field, { ascending:true })
    .limit(20000);
  if(error){ console.error(error); return []; }
  return uniqueClean((data||[]).map(r => r[field]));
}

// ======= Filtros =======
async function loadProvincesFromGeoJSON(){
  try{
    const res = await fetch("provincias.geojson", { cache:"no-store" });
    const gj = await res.json();
    const names = gj.features.map(f =>
      (f.properties.DPA_DESPRO || f.properties.nombre || f.properties.NAME_1 || f.properties.provincia || "").toString().trim()
    );
    return uniqueClean(names);
  }catch(e){
    console.warn("No se pudo leer provincias.geojson:", e);
    return [];
  }
}

async function loadFilterOptions(){
  // Provincias: catálogo + DB (unión)
  const [provGeo, provDb] = await Promise.all([loadProvincesFromGeoJSON(), getDistinct("provincia")]);
  const provAll = uniqueClean([...provGeo, ...provDb]);
  provAll.forEach(v => { const o=document.createElement("option"); o.value=v; o.textContent=v; provSelect.appendChild(o); });

  // Cantón / Parroquia desde DB
  (await getDistinct("canton")).forEach(v => { const o=document.createElement("option"); o.value=v; o.textContent=v; cantSelect.appendChild(o); });
  (await getDistinct("parroquia")).forEach(v => { const o=document.createElement("option"); o.value=v; o.textContent=v; parrSelect.appendChild(o); });

  // Sostenimiento (orden preferente)
  const sost = (await getDistinct("sostenimiento")).map(s => s.toUpperCase());
  const order = ["FISCAL","FISCOMISIONAL","PARTICULAR","MUNICIPAL"];
  const seen = new Set();
  const sorted = [...order.filter(x => sost.includes(x)), ...sost.filter(s => !order.includes(s) && !seen.has(s) && seen.add(s))];
  sorted.forEach(v => { const o=document.createElement("option"); o.value=v; o.textContent=v; sostSelect.appendChild(o); });
}

// ======= KPIs =======
async function updateKPIs(){
  let q = applyFilters(supabase.from(TABLE).select("*",{count:"exact", head:true}));
  const { count: total } = await q; kpiTotal.textContent = total ?? "0";

  let qm = applyFilters(supabase.from(TABLE).select("*",{count:"exact", head:true}).eq("tipo","MATRIZ"));
  const { count: cm } = await qm; kpiMatriz.textContent = cm ?? "0";

  let qe = applyFilters(supabase.from(TABLE).select("*",{count:"exact", head:true}).eq("tipo","ESTABLECIMIENTO"));
  const { count: ce } = await qe; kpiEst.textContent = ce ?? "0";

  let qs = applyFilters(supabase.from(TABLE).select("sostenimiento"));
  const { data: ds, error: es } = await qs;
  if(!es){ const setS = new Set((ds||[]).map(r => (r.sostenimiento||"").toString().trim()).filter(Boolean)); kpiSost.textContent = setS.size.toString(); }
}

// ======= DATA + RENDER =======
async function refreshData(){
  let q = supabase.from(TABLE)
    .select("amie,nombre_ie,tipo,sostenimiento,provincia,canton,parroquia,lat,lon")
    .limit(5000);
  q = applyFilters(q);

  const term = amieInput.value.trim();
  if(term){
    if(/^[0-9A-Z]+$/.test(term)) q = q.ilike("amie", `%${term}%`);
    else q = q.ilike("nombre_ie", `%${term}%`);
  }

  const { data, error } = await q;
  if(error){ console.error(error); return; }

  currentData = data || [];
  currentPage = 1;

  renderMap(currentData);
  renderTablePage();
  updateKPIs();
}

function renderMap(rows){
  clusterLayer.clearLayers();
  const pts = [];
  rows
    .filter(r => typeof r.lat==="number" && typeof r.lon==="number" && !Number.isNaN(r.lat) && !Number.isNaN(r.lon))
    .forEach(r => {
      const m = L.marker([r.lat, r.lon], { icon: redDotIcon })
        .bindPopup(`<b>${r.nombre_ie||""}</b><br>AMIE: ${r.amie||""}<br>${r.provincia||""} / ${r.canton||""}`);
      clusterLayer.addLayer(m);
      pts.push([r.lat, r.lon]);
    });
  if(pts.length){ map.fitBounds(L.latLngBounds(pts).pad(0.2)); }
}

function renderTablePage(){
  const total = currentData.length;
  pageSize = parseInt(pageSizeSel.value, 10) || 25;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  currentPage = Math.min(Math.max(1, currentPage), pageCount);

  const start = (currentPage - 1) * pageSize;
  const slice = currentData.slice(start, start + pageSize);

  tbody.innerHTML = "";
  slice.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.amie||""}</td>
                    <td>${r.nombre_ie||""}</td>
                    <td>${r.tipo||""}</td>
                    <td>${r.sostenimiento||""}</td>
                    <td>${r.provincia||""}</td>
                    <td>${r.canton||""}</td>
                    <td>${r.parroquia||""}</td>`;
    tbody.appendChild(tr);
  });

  pageInfo.textContent = `Página ${currentPage}/${pageCount}`;
  prevPageBtn.disabled = currentPage <= 1;
  nextPageBtn.disabled = currentPage >= pageCount;
}

// ======= EVENTOS =======
searchBtn.addEventListener("click", refreshData);
clearBtn.addEventListener("click", () => {
  provSelect.value = ""; cantSelect.value = ""; parrSelect.value = ""; sostSelect.value = ""; tipoSelect.value = "";
  amieInput.value = "";
  refreshData();
});
[provSelect,cantSelect,parrSelect,sostSelect,tipoSelect].forEach(el => el.addEventListener("change", refreshData));

prevPageBtn.addEventListener("click", ()=>{ currentPage--; renderTablePage(); });
nextPageBtn.addEventListener("click", ()=>{ currentPage++; renderTablePage(); });
pageSizeSel.addEventListener("change", ()=>{ currentPage=1; renderTablePage(); });

// Tema oscuro persistente
(function initTheme(){
  const saved = localStorage.getItem("theme");
  if(saved === "dark") document.body.classList.add("dark");
  themeToggle.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
})();
themeToggle.addEventListener("click", ()=>{
  document.body.classList.toggle("dark");
  localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
  themeToggle.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
});

// ======= INIT =======
(async function init(){
  await loadFilterOptions();
  await refreshData();
})();

// ===== Herramientas tipo plugin (equivalentes) =====

// Conversión DD ↔ DMS
function toDMS(deg, isLat){
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const m = Math.floor((abs - d) * 60);
  const s = ((abs - d) * 3600 - m * 60).toFixed(2);
  const hemi = isLat ? (deg >= 0 ? "N":"S") : (deg >= 0 ? "E":"W");
  return `${d}°${m}′${s}″${hemi}`;
}
function dmsToDD(dms){
  // admite formatos como: 2°10′15″S o 2 10 15 S
  const cleaned = dms.replace(/[^\d NSEW\.\-]+/g, " ").trim();
  const parts = cleaned.split(/\s+/);
  if(parts.length < 4) throw new Error("Formato DMS inválido");
  const d = parseFloat(parts[0]), m = parseFloat(parts[1]), s = parseFloat(parts[2]);
  const hemi = parts[3].toUpperCase();
  let dd = Math.abs(d) + m/60 + s/3600;
  if(hemi === "S" || hemi === "W") dd = -dd;
  return dd;
}

// 1) Fijar marcador con click y copiar coords
let dropPointMode = false;
let tempPoint;
document.getElementById("toolDropPoint").addEventListener("click", ()=>{
  dropPointMode = !dropPointMode;
  if(dropPointMode) { alert("Haz click en el mapa para fijar punto y copiar coordenadas."); }
});
map.on("click", (e)=>{
  if(!dropPointMode) return;
  if(tempPoint) map.removeLayer(tempPoint);
  tempPoint = L.circleMarker(e.latlng, {radius:6, fillColor:"#ff2a2a", color:"#ff2a2a", weight:0, fillOpacity:1}).addTo(map);
  const ddText = `Lat: ${e.latlng.lat.toFixed(6)}, Lon: ${e.latlng.lng.toFixed(6)}`;
  navigator.clipboard?.writeText(ddText);
  alert(`Copiado: ${ddText}`);
  dropPointMode = false;
});

// 2) Dibujar extent (rectángulo) y exportar
let drawnItems = new L.FeatureGroup().addTo(map);
let drawControl;
document.getElementById("toolDrawExtent").addEventListener("click", ()=>{
  if(drawControl){
    map.removeControl(drawControl);
    drawControl = null;
  }
  drawControl = new L.Control.Draw({
    draw: { marker:false, circle:false, circlemarker:false, polyline:false, polygon:false, rectangle:true },
    edit: { featureGroup: drawnItems, edit:false, remove:true }
  });
  map.addControl(drawControl);
});
map.on(L.Draw.Event.CREATED, function (e) {
  drawnItems.addLayer(e.layer);
  const b = e.layer.getBounds();
  const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
  console.log("BBOX:", bbox);
  const gj = e.layer.toGeoJSON();
  // descarga GeoJSON simple del rectángulo
  const blob = new Blob([JSON.stringify(gj)], {type: "application/geo+json"});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'extent.geojson';
  a.click();
});
// botón limpiar
document.getElementById("toolClearTools").addEventListener("click", ()=>{
  drawnItems.clearLayers();
  if(tempPoint) { map.removeLayer(tempPoint); tempPoint = null; }
});

// 3) Zoom a Lat/Lon
document.getElementById("zoomGo").addEventListener("click", ()=>{
  const lat = parseFloat(document.getElementById("zoomLat").value);
  const lon = parseFloat(document.getElementById("zoomLon").value);
  const z = parseInt(document.getElementById("zoomLevel").value || "15", 10);
  if(Number.isFinite(lat) && Number.isFinite(lon)) map.setView([lat,lon], z);
  else alert("Lat/Lon no válidos");
});

// 4) Convertidores
document.getElementById("dd2dms").addEventListener("click", ()=>{
  const txt = document.getElementById("ddInput").value;
  const m = txt.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
  if(!m) { alert("DD inválido. Ej: -2.170998, -79.922359"); return; }
  const la = parseFloat(m[1]), lo = parseFloat(m[2]);
  document.getElementById("dmsInput").value = `${toDMS(la,true)}, ${toDMS(lo,false)}`;
});
document.getElementById("dms2dd").addEventListener("click", ()=>{
  const txt = document.getElementById("dmsInput").value;
  try {
    // admite “LatDMS, LonDMS”
    const parts = txt.split(/\s*,\s*/);
    if(parts.length !== 2) throw new Error();
    const la = dmsToDD(parts[0]); const lo = dmsToDD(parts[1]);
    document.getElementById("ddInput").value = `${la.toFixed(6)}, ${lo.toFixed(6)}`;
  } catch(e) {
    alert("DMS inválido. Ej: 2°10′15″S, 79°55′20″W");
  }
});
