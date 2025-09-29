// Modo datos: si hay Supabase en window.env => usa Supabase; si no, CSV local
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const hasEnv = !!(window.env && window.env.SUPABASE_URL && window.env.SUPABASE_KEY);
const MODE = hasEnv ? "supabase" : "csv";

let supabase = null;
if (MODE === "supabase") {
  supabase = createClient(window.env.SUPABASE_URL, window.env.SUPABASE_KEY);
}

// ======= UI =======
const els = {
  kpiTotal: document.getElementById("kpiTotal"),
  kpiMatriz: document.getElementById("kpiMatriz"),
  kpiEst: document.getElementById("kpiEst"),
  kpiSost: document.getElementById("kpiSost"),
  prov: document.getElementById("provSelect"),
  cant: document.getElementById("cantSelect"),
  parr: document.getElementById("parrSelect"),
  sost: document.getElementById("sostSelect"),
  tipo: document.getElementById("tipoSelect"),
  clear: document.getElementById("clearBtn"),
  search: document.getElementById("searchBtn"),
  searchInput: document.getElementById("searchInput"),
  tblBody: document.querySelector("#tbl tbody"),
  mapDiv: document.getElementById("map")
};

// ======= MAPA =======
const map = L.map(els.mapDiv).setView([-1.831, -78.183], 6); // Centro aprox. Ecuador
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "&copy; OpenStreetMap"
}).addTo(map);

let markersLayer = L.layerGroup().addTo(map);

// ======= DATA PROVIDER =======
const TABLE = "instituciones";
let cacheCSV = null;

async function loadCSV() {
  if (cacheCSV) return cacheCSV;
  const url = "data/instituciones_geo_fixed.csv";
  const text = await fetch(url).then(r => {
    if (!r.ok) throw new Error("No se pudo cargar CSV: " + r.statusText);
    return r.text();
  });
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: true });
  cacheCSV = parsed.data.map(row => ({
    amie: (row.amie || '').trim(),
    nombre_ie: (row.nombre_ie || '').trim(),
    tipo: (row.tipo || '').trim(),
    sostenimiento: (row.sostenimiento || '').trim(),
    provincia: (row.provincia || '').trim(),
    canton: (row.canton || '').trim(),
    parroquia: (row.parroquia || '').trim(),
    lat: Number(row.lat),
    lon: Number(row.lon)
  }));
  return cacheCSV;
}

function applyFiltersJS(rows, f) {
  return rows.filter(r => {
    if (f.search) {
      const s = f.search.toLowerCase();
      const hay = r.amie.toLowerCase().includes(s) || r.nombre_ie.toLowerCase().includes(s);
      if (!hay) return false;
    }
    if (f.prov && r.provincia !== f.prov) return false;
    if (f.cant && r.canton !== f.cant) return false;
    if (f.parr && r.parroquia !== f.parr) return false;
    if (f.sost && r.sostenimiento !== f.sost) return false;
    if (f.tipo && r.tipo !== f.tipo) return false;
    return true;
  });
}

async function fetchRows(filters) {
  if (MODE === "csv") {
    const rows = await loadCSV();
    return applyFiltersJS(rows, filters);
  } else {
    // Supabase (opcional): requiere tabla `instituciones` con estas columnas
    let q = supabase.from(TABLE).select("amie,nombre_ie,tipo,sostenimiento,provincia,canton,parroquia,lat,lon");
    if (filters.search) {
      const s = filters.search;
      // intento de búsqueda simple: OR por ilike
      q = q.or(`amie.ilike.%${s}%,nombre_ie.ilike.%${s}%`);
    }
    if (filters.prov) q = q.eq("provincia", filters.prov);
    if (filters.cant) q = q.eq("canton", filters.cant);
    if (filters.parr) q = q.eq("parroquia", filters.parr);
    if (filters.sost) q = q.eq("sostenimiento", filters.sost);
    if (filters.tipo) q = q.eq("tipo", filters.tipo);

    const { data, error } = await q.limit(5000);
    if (error) {
      console.error("Supabase error:", error);
      return [];
    }
    return data || [];
  }
}

async function fetchDistincts() {
  if (MODE === "csv") {
    const rows = await loadCSV();
    const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    return {
      provs: uniq(rows.map(r=>r.provincia)),
      cants: uniq(rows.map(r=>r.canton)),
      parrs: uniq(rows.map(r=>r.parroquia)),
      sosti: uniq(rows.map(r=>r.sostenimiento)),
      tipos: uniq(rows.map(r=>r.tipo)),
    };
  } else {
    async function distinct(col){ 
      const { data, error } = await supabase.from(TABLE).select(col).not(col,'is',null);
      if (error) return [];
      return [...new Set((data||[]).map(r=>r[col]).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    }
    const [provs, cants, parrs, sosti, tipos] = await Promise.all([
      distinct("provincia"), distinct("canton"), distinct("parroquia"),
      distinct("sostenimiento"), distinct("tipo")
    ]);
    return { provs, cants, parrs, sosti, tipos };
  }
}

async function fetchKPIs(filters) {
  const rows = await fetchRows(filters);
  const total = rows.length;
  const matriz = rows.filter(r=>r.tipo && r.tipo.toUpperCase()==="MATRIZ").length;
  const estab = rows.filter(r=>r.tipo && r.tipo.toUpperCase()!=="MATRIZ").length;
  const sostSet = new Set(rows.map(r=>r.sostenimiento).filter(Boolean));
  return { total, matriz, estab, sosti: sostSet.size, rows };
}

// ======= UI HELPERS =======
function fillSelect(sel, values, placeholder) {
  const cur = sel.value || "";
  sel.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = ""; opt0.textContent = placeholder;
  sel.appendChild(opt0);
  values.forEach(v => {
    const o = document.createElement("option");
    o.value = v; o.textContent = v;
    sel.appendChild(o);
  });
  if (values.includes(cur)) sel.value = cur;
}

function renderTable(rows) {
  const tb = els.tblBody;
  tb.innerHTML = "";
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
    td.className = "empty";
    td.textContent = "Sin resultados para los filtros actuales.";
    tr.appendChild(td);
    tb.appendChild(tr);
    return;
  }
  const frag = document.createDocumentFragment();
  rows.forEach(r => {
    const tr = document.createElement("tr");
    const cells = [r.amie, r.nombre_ie, r.tipo, r.sostenimiento, r.provincia, r.canton, r.parroquia];
    cells.forEach(c => {
      const td = document.createElement("td");
      td.textContent = c ?? "";
      tr.appendChild(td);
    });
    frag.appendChild(tr);
  });
  tb.appendChild(frag);
}

function renderMap(rows) {
  markersLayer.clearLayers();
  if (!rows.length) return;

  const pts = [];
  rows.forEach(r => {
    if (isFinite(r.lat) && isFinite(r.lon)) {
      const m = L.marker([r.lat, r.lon]).bindPopup(
        `<b>${r.nombre_ie||""}</b><br>AMIE: ${r.amie||""}<br>${r.parroquia||""}, ${r.canton||""}, ${r.provincia||""}<br>${r.sostenimiento||""} - ${r.tipo||""}`
      );
      markersLayer.addLayer(m);
      pts.push([r.lat, r.lon]);
    }
  });
  if (pts.length) {
    const bounds = L.latLngBounds(pts);
    map.fitBounds(bounds.pad(0.15));
  }
}

// ======= CONTROL =======
function getFilters() {
  return {
    prov: els.prov.value || "",
    cant: els.cant.value || "",
    parr: els.parr.value || "",
    sost: els.sost.value || "",
    tipo: els.tipo.value || "",
    search: (els.searchInput.value || "").trim()
  };
}

async function loadDistinctOptions() {
  const ds = await fetchDistincts();
  fillSelect(els.prov, ds.provs, "Provincia");
  fillSelect(els.cant, ds.cants, "Cantón");
  fillSelect(els.parr, ds.parrs, "Parroquia");
  fillSelect(els.sost, ds.sosti, "Sostenimiento");
  fillSelect(els.tipo, ds.tipos, "Tipo");
}

async function refreshData() {
  const k = await fetchKPIs(getFilters());
  els.kpiTotal.textContent = k.total;
  els.kpiMatriz.textContent = k.matriz;
  els.kpiEst.textContent = k.estab;
  els.kpiSost.textContent = k.sosti;
  renderTable(k.rows);
  renderMap(k.rows);
}

// ======= EVENTOS =======
els.search.addEventListener("click", refreshData);
els.clear.addEventListener("click", () => {
  els.prov.value = els.cant.value = els.parr.value = els.sost.value = els.tipo.value = "";
  els.searchInput.value = "";
  refreshData();
});
[els.prov, els.cant, els.parr, els.sost, els.tipo].forEach(el => el.addEventListener("change", refreshData));

// Cascada simple provincia -> cantón -> parroquia cuando hay CSV
if (MODE === "csv") {
  els.prov.addEventListener("change", async () => {
    const rows = await loadCSV();
    const cants = [...new Set(rows.filter(r=>!els.prov.value || r.provincia===els.prov.value).map(r=>r.canton))].sort((a,b)=>a.localeCompare(b));
    fillSelect(els.cant, cants, "Cantón");
    const parrs = [...new Set(rows.filter(r=>!els.cant.value || r.canton===els.cant.value).map(r=>r.parroquia))].sort((a,b)=>a.localeCompare(b));
    fillSelect(els.parr, parrs, "Parroquia");
    refreshData();
  });
  els.cant.addEventListener("change", async () => {
    const rows = await loadCSV();
    const parrs = [...new Set(rows.filter(r=>!els.cant.value || r.canton===els.cant.value).map(r=>r.parroquia))].sort((a,b)=>a.localeCompare(b));
    fillSelect(els.parr, parrs, "Parroquia");
    refreshData();
  });
}

// INIT
(async function init(){
  if (MODE === "csv") {
    console.info("Modo CSV: usando data/instituciones_geo_fixed.csv");
  } else {
    console.info("Modo Supabase: usando", window.env.SUPABASE_URL);
  }
  await loadDistinctOptions();
  await refreshData();
})();
