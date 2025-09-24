// ======= CONFIGURACIÓN SUPABASE =======
// Reemplaza con tu URL y KEY (public anon) — o usa variables de entorno en GitHub Pages/Netlify.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = window.env?.SUPABASE_URL || "https://krjwqagkjuzrpxianvnu.supabase.co";
const SUPABASE_KEY = window.env?.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandxYWdranV6cnB4aWFudm51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDY4NjEsImV4cCI6MjA3NDMyMjg2MX0.vdIMVgAciBhAweV4CGjEXq-fuo2xRm0qSssl4JhoErQ";
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Nombre de la tabla en Supabase
const TABLE = "instituciones";

// ======= UI ELEMENTS =======
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

const tbody = document.querySelector("#tbl tbody");

// ======= MAPA (Leaflet) =======
let map = L.map("map").setView([-1.8312, -78.1834], 6); // Ecuador
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap"
}).addTo(map);
let markersLayer = L.layerGroup().addTo(map);

// ======= HELPER: aplica filtros a una query de Supabase =======
function applyFilters(query){
  if(provSelect.value) query = query.eq("provincia", provSelect.value);
  if(cantSelect.value) query = query.eq("canton", cantSelect.value);
  if(parrSelect.value) query = query.eq("parroquia", parrSelect.value);
  if(sostSelect.value) query = query.eq("sostenimiento", sostSelect.value);
  if(tipoSelect.value) query = query.eq("tipo", tipoSelect.value);
  return query;
}

// ======= CARGA DE OPCIONES DE FILTRO (distinct) =======
async function loadDistinctOptions(){
  const fields = ["provincia","canton","parroquia","sostenimiento"];
  for(const f of fields){
    const { data, error } = await supabase
      .from(TABLE)
      .select(`${f}`)
      .not(f, "is", null)
      .neq(f, "")
      .order(f, { ascending: true })
      .limit(10000); // traer todo (ajusta si es muy grande)

    if(error){ console.error(error); continue; }
    const uniq = [...new Set(data.map(r => r[f]))];
    const selectEl = {provincia:provSelect,canton:cantSelect,parroquia:parrSelect,sostenimiento:sostSelect}[f];
    uniq.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v; opt.textContent = v;
      selectEl.appendChild(opt);
    });
  }
}

// ======= KPI DASHBOARD =======
async function updateKPIs(){
  // Total
  let q = supabase.from(TABLE).select("*",{count:"exact", head:true});
  q = applyFilters(q);
  const { count: total } = await q;
  kpiTotal.textContent = total ?? "0";

  // Matriz
  let qm = supabase.from(TABLE).select("*",{count:"exact", head:true}).eq("tipo","MATRIZ");
  qm = applyFilters(qm);
  const { count: cm } = await qm;
  kpiMatriz.textContent = cm ?? "0";

  // Establecimiento
  let qe = supabase.from(TABLE).select("*",{count:"exact", head:true}).eq("tipo","ESTABLECIMIENTO");
  qe = applyFilters(qe);
  const { count: ce } = await qe;
  kpiEst.textContent = ce ?? "0";

  // Sostenimientos distintos
  let qs = supabase.from(TABLE).select("sostenimiento");
  qs = applyFilters(qs);
  const { data: ds, error: es } = await qs;
  if(!es){
    const setS = new Set((ds||[]).map(r => r.sostenimiento).filter(Boolean));
    kpiSost.textContent = setS.size.toString();
  }
}

// ======= TABLA + MAPA =======
async function refreshData(){
  let q = supabase
    .from(TABLE)
    .select("amie,nombre_ie,tipo,sostenimiento,provincia,canton,parroquia,lat,lon")
    .limit(2000);
  q = applyFilters(q);

  // AMIE o nombre: búsqueda flexible
  const term = amieInput.value.trim();
  if(term){
    // Match AMIE exacto o nombre por ilike
    if(/^[0-9A-Z]+$/.test(term)){
      q = q.ilike("amie", `%${term}%`);
    }else{
      q = q.ilike("nombre_ie", `%${term}%`);
    }
  }

  const { data, error } = await q;
  if(error){ console.error(error); return; }

  // Tabla
  tbody.innerHTML = "";
  (data || []).forEach(r => {
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

  // Mapa
  markersLayer.clearLayers();
  (data || [])
    .filter(r => typeof r.lat === "number" && typeof r.lon === "number" && !Number.isNaN(r.lat) && !Number.isNaN(r.lon))
    .forEach(r => {
      const m = L.marker([r.lat, r.lon]).bindPopup(`<b>${r.nombre_ie||""}</b><br>AMIE: ${r.amie||""}`);
      markersLayer.addLayer(m);
    });

  // Ajustar vista si hay puntos
  const pts = [];
  markersLayer.eachLayer(l => pts.push(l.getLatLng()));
  if(pts.length){
    const bounds = L.latLngBounds(pts);
    map.fitBounds(bounds.pad(0.2));
  }

  // KPIs
  updateKPIs();
}

// Event listeners
searchBtn.addEventListener("click", refreshData);
clearBtn.addEventListener("click", () => {
  provSelect.value = ""; cantSelect.value = ""; parrSelect.value = ""; sostSelect.value = ""; tipoSelect.value = "";
  amieInput.value = "";
  refreshData();
});
[provSelect,cantSelect,parrSelect,sostSelect,tipoSelect].forEach(el => el.addEventListener("change", refreshData));

// Init
(async function init(){
  await loadDistinctOptions();
  await refreshData();
})();
