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
const zoomFree = document.getElementById("zoomFree");
const zoomLevel = document.getElementById("zoomLevel");
const coordsBar = document.getElementById("coordsBar");
const utmOut = document.getElementById("utmOut");

// ======= MAPA =======
let map = L.map("map", { zoomControl:true }).setView([-1.8312, -78.1834], 6);
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19, attribution: "&copy; OpenStreetMap"
}).addTo(map);
const esriSat = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  { maxZoom: 19, attribution: "Tiles © Esri, Maxar, Earthstar Geographics, etc." }
);
L.control.layers({ "OSM": osm, "Satélite (Esri)": esriSat }, {}, { collapsed:true }).addTo(map);

let clusterLayer = L.markerClusterGroup({ showCoverageOnHover:false, maxClusterRadius:50 });
map.addLayer(clusterLayer);
const redDotIcon = L.divIcon({ className:"red-dot", html:"", iconSize:[10,10] });

// ======= Barra coords =======
function fmt(n){ return (Math.round(n*1e6)/1e6).toFixed(6); }
map.on("mousemove", (e)=>{ coordsBar.textContent = `Lat: ${fmt(e.latlng.lat)}  Lon: ${fmt(e.latlng.lng)} (click para copiar)`; });
coordsBar.addEventListener("click", ()=> {
  const txt = coordsBar.textContent.replace(" (click para copiar)","");
  navigator.clipboard?.writeText(txt);
});
try { if (window.LatLonTools && typeof window.LatLonTools.addTo === "function") { window.LatLonTools.addTo(map); } } catch(e){ /* opcional */ }

// ======= Estado tabla =======
let currentData = [];
let currentPage = 1;
let pageSize = parseInt(pageSizeSel.value, 10) || 25;

// ======= Utils =======
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
    .not(field, "is", null).neq(field, "")
    .order(field, { ascending:true })
    .limit(20000);
  if(error){ console.error(error); return []; }
  return uniqueClean((data||[]).map(r => r[field]));
}

// Provincias desde GeoJSON + DB
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
  const [provGeo, provDb] = await Promise.all([loadProvincesFromGeoJSON(), getDistinct("provincia")]);
  const provAll = uniqueClean([...provGeo, ...provDb]);
  provAll.forEach(v => { const o=document.createElement("option"); o.value=v; o.textContent=v; provSelect.appendChild(o); });

  (await getDistinct("canton")).forEach(v => { const o=document.createElement("option"); o.value=v; o.textContent=v; cantSelect.appendChild(o); });
  (await getDistinct("parroquia")).forEach(v => { const o=document.createElement("option"); o.value=v; o.textContent=v; parrSelect.appendChild(o); });

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

// ======= Parseo flexible Lat,Lon con coma o punto =======
function parseFlexibleLatLon(text){
  // admite: "-2,8865, -78,7763"  ó  "-2.8865,-78.7763"  ó  "-2.8865 -78.7763"
  const nums = [];
  const re = /[-+]?\d+(?:[.,]\d+)?/g;
  let m;
  while((m = re.exec(text)) && nums.length < 2){ nums.push(m[0]); }
  if(nums.length < 2) return null;
  const lat = parseFloat(nums[0].replace(",", "."));
  const lon = parseFloat(nums[1].replace(",", "."));
  if(!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {lat, lon};
}

// ======= DD -> UTM con proj4 =======
function ddToUtm(lat, lon){
  const zone = Math.floor((lon + 180) / 6) + 1;
  const south = lat < 0;
  const projStr = `+proj=utm +zone=${zone} ${south?'+south':''} +datum=WGS84 +units=m +no_defs`;
  const p = proj4('EPSG:4326', projStr, [lon, lat]); // [lon, lat]
  const easting = p[0], northing = p[1];
  return { zone, hemisphere: south ? 'S' : 'N', easting, northing };
}

// ======= DATA + RENDER =======
async function refreshData(){
  let q = supabase.from(TABLE)
    .select("amie,nombre_ie,tipo,sostenimiento,provincia,canton,parroquia,lat,lon")
    .limit(5000);
  q = applyFilters(q);

  const term = amieInput.value.trim();
  if(term){ /^[0-9A-Z]+$/.test(term) ? q = q.ilike("amie", `%${term}%`) : q = q.ilike("nombre_ie", `%${term}%`); }

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
  rows.filter(r => typeof r.lat==="number" && typeof r.lon==="number" && !Number.isNaN(r.lat) && !Number.isNaN(r.lon))
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

// ======= Herramientas tipo plugin =======
let dropPointMode = false;
let tempPoint;
document.getElementById("toolDropPoint").addEventListener("click", ()=>{
  dropPointMode = !dropPointMode;
  if(dropPointMode) alert("Haz click en el mapa para fijar punto y copiar coordenadas.");
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

let drawnItems = new L.FeatureGroup().addTo(map);
let drawControl;
document.getElementById("toolDrawExtent").addEventListener("click", ()=>{
  if(drawControl){ map.removeControl(drawControl); drawControl=null; }
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
  const blob = new Blob([JSON.stringify(gj)], {type: "application/geo+json"});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'extent.geojson';
  a.click();
});
document.getElementById("toolClearTools").addEventListener("click", ()=>{
  drawnItems.clearLayers();
  if(tempPoint){ map.removeLayer(tempPoint); tempPoint=null; }
});

// Zoom flexible (acepta coma o punto)
document.getElementById("zoomGo").addEventListener("click", ()=>{
  const parsed = parseFlexibleLatLon(zoomFree.value);
  const z = parseInt(zoomLevel.value || "15", 10);
  if(!parsed){ alert("Formato no válido. Ej: -2,8865, -78,7763  ó  -2.8865,-78.7763"); return; }
  map.setView([parsed.lat, parsed.lon], z);
});

// Conversores
document.getElementById("dd2dms").addEventListener("click", ()=>{
  const m = parseFlexibleLatLon(document.getElementById("ddInput").value);
  if(!m){ alert("DD inválido. Ej: -2.170998, -79.922359"); return; }
  const la = m.lat, lo = m.lon;
  document.getElementById("dmsInput").value = `${toDMS(la,true)}, ${toDMS(lo,false)}`;
});
document.getElementById("dms2dd").addEventListener("click", ()=>{
  const txt = document.getElementById("dmsInput").value;
  try {
    const parts = txt.split(/\s*,\s*/);
    if(parts.length !== 2) throw new Error();
    const la = dmsToDD(parts[0]); const lo = dmsToDD(parts[1]);
    document.getElementById("ddInput").value = `${la.toFixed(6)}, ${lo.toFixed(6)}`;
  } catch(e) {
    alert("DMS inválido. Ej: 2°10′15″S, 79°55′20″W");
  }
});
document.getElementById("dd2utm").addEventListener("click", ()=>{
  const m = parseFlexibleLatLon(document.getElementById("ddInput").value);
  if(!m){ alert("DD inválido. Ej: -2.170998, -79.922359"); return; }
  const res = ddToUtm(m.lat, m.lon);
  const txt = `UTM Zone ${res.zone}${res.hemisphere}  E=${res.easting.toFixed(2)}  N=${res.northing.toFixed(2)}`;
  utmOut.textContent = txt;
  navigator.clipboard?.writeText(txt);
});

// Conversión DD <-> DMS helpers
function toDMS(deg, isLat){
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const m = Math.floor((abs - d) * 60);
  const s = ((abs - d) * 3600 - m * 60).toFixed(2);
  const hemi = isLat ? (deg >= 0 ? "N":"S") : (deg >= 0 ?
