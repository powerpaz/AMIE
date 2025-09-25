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
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19, attribution: "&copy; OpenStreetMap"
}).addTo(map);
const esriSat = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  { maxZoom: 19, attribution: "Tiles © Esri, Maxar, Earthstar Geographics, etc." }
);
L.control.layers({ "OSM": osm, "Satélite (Esri)": esriSat }, {}, { collapsed:true }).addTo(map);

// Cluster layer
let clusterLayer = L.markerClusterGroup({
  showCoverageOnHover: false,
  maxClusterRadius: 50,
});
map.addLayer(clusterLayer);

// Red dot icon via divIcon
const redDotIcon = L.divIcon({ className:"red-dot", html:"", iconSize:[10,10] });

// ======= STATE (tabla) =======
let currentData = []; // resultados vigentes del query
let currentPage = 1;
let pageSize = parseInt(pageSizeSel.value, 10) || 25;

function applyFilters(q){
  if(provSelect.value) q = q.eq("provincia", provSelect.value);
  if(cantSelect.value) q = q.eq("canton", cantSelect.value);
  if(parrSelect.value) q = q.eq("parroquia", parrSelect.value);
  if(sostSelect.value) q = q.eq("sostenimiento", sostSelect.value);
  if(tipoSelect.value) q = q.eq("tipo", tipoSelect.value);
  return q;
}

// ======= LOAD FILTER OPTIONS =======
async function loadDistinctOptions(){
  const fields = ["provincia","canton","parroquia","sostenimiento"];
  for(const f of fields){
    const { data, error } = await supabase
      .from(TABLE)
      .select(`${f}`)
      .not(f, "is", null).neq(f, "")
      .order(f, { ascending:true })
      .limit(10000);
    if(error){ console.error(error); continue; }
    const uniq = [...new Set((data||[]).map(r => r[f]))];
    const sel = {provincia:provSelect, canton:cantSelect, parroquia:parrSelect, sostenimiento:sostSelect}[f];
    uniq.forEach(v => { const o=document.createElement("option"); o.value=v; o.textContent=v; sel.appendChild(o); });
  }
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
  if(!es){ const setS=new Set((ds||[]).map(r=>r.sostenimiento).filter(Boolean)); kpiSost.textContent = setS.size.toString(); }
}

// ======= QUERY + MAP + TABLE =======
async function refreshData(){
  let q = supabase.from(TABLE)
    .select("amie,nombre_ie,tipo,sostenimiento,provincia,canton,parroquia,lat,lon")
    .limit(2000);
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

// ======= EVENTS =======
searchBtn.addEventListener("click", refreshData);
clearBtn.addEventListener("click", () => {
  provSelect.value = ""; cantSelect.value = ""; parrSelect.value = ""; sostSelect.value = ""; tipoSelect.value = "";
  amieInput.value = ""; refreshData();
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
  await loadDistinctOptions();
  await refreshData();
})();

