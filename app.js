/* Geoportal IE — App (con verificación de Supabase y logo en navbar) */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const setStatus = (t) => ($("#status").textContent = t);
const bus = new EventTarget();
const emit = (type, detail={}) => bus.dispatchEvent(new CustomEvent(type,{detail}));

const state = {
  data: [],
  view: [],
  page: 1,
  pageSize: 25,
  selected: new Set(),
  mcg: null,
};

async function pingSupabase(client){
  try{
    const { data, error } = await client.from("instituciones").select("amie").limit(1);
    if (error) throw error;
    return true;
  }catch(e){
    console.warn("Supabase ping falló:", e.message);
    return false;
  }
}

async function loadData() {
  setStatus("Cargando datos…");
  const hasEnv = window.env && window.env.SUPABASE_URL && window.env.SUPABASE_KEY;

  if (hasEnv) {
    try {
      const supa = window.supabase.createClient(window.env.SUPABASE_URL, window.env.SUPABASE_KEY);
      const ok = await pingSupabase(supa);
      if (!ok) throw new Error("No se pudo leer la tabla. Revisa: nombre de tabla 'instituciones', columnas (amie,nombre,tipo,sostenimiento,provincia,canton,parroquia,lat,lon) y reglas RLS.");

      const { data, error } = await supa
        .from("instituciones")
        .select("amie,nombre,tipo,sostenimiento,provincia,canton,parroquia,lat,lon")
        .limit(50000);
      if (error) throw error;

      state.data = (data || []).filter(d => isFinite(d.lat) && isFinite(d.lon));
      setStatus(`Datos desde Supabase: ${state.data.length}`);
      return;
    } catch (e) {
      console.warn("Lectura Supabase falló, usando CSV local:", e.message);
      setStatus("Supabase no disponible, usando CSV local…");
    }
  } else {
    console.warn("ENV Supabase no definido (window.env). Usaré CSV.");
    setStatus("Sin credenciales, usando CSV local…");
  }

  // Fallback CSV local
  const csvUrl = "data/instituciones_geo_fixed.csv";
  const res = await fetch(csvUrl);
  const text = await res.text();
  const parsed = Papa.parse(text, { header: true, dynamicTyping: true });
  state.data = parsed.data.map(r => ({
      amie: r.amie || r.AMIE || r.amie_code,
      nombre: r.nombre || r.NOMBRE,
      tipo: r.tipo || r.TIPO,
      sostenimiento: r.sostenimiento || r.SOSTENIMIENTO,
      provincia: r.provincia || r.PROVINCIA,
      canton: r.canton || r.CANTON,
      parroquia: r.parroquia || r.PARROQUIA,
      lat: Number(r.lat || r.LAT || r.latitud),
      lon: Number(r.lon || r.LON || r.longitud),
    }))
    .filter(d => isFinite(d.lat) && isFinite(d.lon));
  setStatus(`Datos desde CSV: ${state.data.length}`);
}

let map;
function initMap() {
  map = L.map("map", { zoomControl: true }).setView([-1.83, -78.18], 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18, attribution: "&copy; OpenStreetMap"
  }).addTo(map);

  state.mcg = L.markerClusterGroup();
  state.mcg.addTo(map);

  map.on("mousemove", (e) => {
    $("#cursor").textContent = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
  });
}

function renderMarkers(rows) {
  state.mcg.clearLayers();
  rows.forEach(r => {
    const m = L.marker([r.lat, r.lon]);
    m.bindPopup(`
      <strong>${r.nombre}</strong><br/>
      AMIE: ${r.amie}<br/>
      ${r.tipo} — ${r.sostenimiento}<br/>
      ${r.provincia} / ${r.canton} / ${r.parroquia}
    `);
    state.mcg.addLayer(m);
  });
}

function distinct(arr, key) {
  return [...new Set(arr.map(x => (x[key] ?? "")).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
}
function fillSelect(sel, opts) {
  const el = $(sel); el.innerHTML = "";
  opts.forEach(v => {
    const o = document.createElement("option");
    o.textContent = v; o.value = v;
    el.appendChild(o);
  });
}
function fillFilters() {
  const d = state.data;
  fillSelect("#f-provincia", ["Provincia", ...distinct(d,"provincia")]);
  fillSelect("#f-sosten", ["Sostenimiento", ...distinct(d,"sostenimiento")]);
  fillSelect("#f-tipo", ["Tipo", ...distinct(d,"tipo")]);
  $("#f-provincia").addEventListener("change", onProvincia);
  $("#f-canton").addEventListener("change", onCanton);
  $("#f-parroquia").addEventListener("change", () => emit("filters-change"));
  $("#f-sosten").addEventListener("change", () => emit("filters-change"));
  $("#f-tipo").addEventListener("change", () => emit("filters-change"));
}
function onProvincia() {
  const prov = $("#f-provincia").value;
  const filtered = prov === "Provincia" ? state.data : state.data.filter(x => x.provincia === prov);
  fillSelect("#f-canton", ["Cantón", ...distinct(filtered,"canton")]);
  $("#f-canton").disabled = false;
  $("#f-parroquia").innerHTML = "<option>Parroquia</option>";
  $("#f-parroquia").disabled = true;
  emit("filters-change");
}
function onCanton() {
  const prov = $("#f-provincia").value;
  const cant = $("#f-canton").value;
  const filtered = state.data.filter(x =>
    (prov === "Provincia" || x.provincia === prov) &&
    (cant === "Cantón" || x.canton === cant)
  );
  fillSelect("#f-parroquia", ["Parroquia", ...distinct(filtered,"parroquia")]);
  $("#f-parroquia").disabled = false;
  emit("filters-change");
}

function applyFilters() {
  const qAmie = $("#q-amie").value.trim();
  const qNombre = $("#q-nombre").value.trim().toLowerCase();
  const prov = $("#f-provincia").value;
  const cant = $("#f-canton").value;
  const parr = $("#f-parroquia").value;
  const sost = $("#f-sosten").value;
  const tipo = $("#f-tipo").value;

  let rows = state.data.filter(r => {
    if (prov !== "Provincia" && r.provincia !== prov) return false;
    if (cant !== "Cantón" && r.canton !== cant) return false;
    if (parr !== "Parroquia" && r.parroquia !== parr) return false;
    if (sost !== "Sostenimiento" && r.sostenimiento !== sost) return false;
    if (tipo !== "Tipo" && r.tipo !== tipo) return false;
    if (qAmie && String(r.amie).indexOf(qAmie) === -1) return false;
    if (qNombre && !String(r.nombre).toLowerCase().includes(qNombre)) return false;
    return true;
  });

  state.view = rows;
  state.page = 1;
  emit("page-change");
  renderMarkers(rows);
}

function renderTable() {
  const tbody = $("#grid tbody");
  tbody.innerHTML = "";

  const totalPages = Math.max(1, Math.ceil(state.view.length / state.pageSize));
  $("#pg-total").textContent = totalPages;
  $("#pg-now").textContent = Math.min(state.page, totalPages);

  const start = (state.page - 1) * state.pageSize;
  const pageRows = state.view.slice(start, start + state.pageSize);

  pageRows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.amie ?? ""}</td>
      <td>${r.nombre ?? ""}</td>
      <td>${r.tipo ?? ""}</td>
      <td>${r.sostenimiento ?? ""}</td>
      <td>${r.provincia ?? ""}</td>
      <td>${r.canton ?? ""}</td>
      <td>${r.parroquia ?? ""}</td>
    `;
    tr.addEventListener("click", () => {
      map.setView([r.lat, r.lon], 13);
      if (state.selected.has(r.amie)) state.selected.delete(r.amie);
      else state.selected.add(r.amie);
      $("#selCount").textContent = state.selected.size;
      $("#btn-clear-selection").textContent = `Limpiar selección (${state.selected.size})`;
      tr.classList.toggle("selected");
    });
    tbody.appendChild(tr);
  });
}

function setupPaging() {
  $("#pg-prev").addEventListener("click", () => {
    if (state.page > 1) { state.page--; emit("page-change"); }
  });
  $("#pg-size").addEventListener("change", (e) => {
    state.pageSize = parseInt(e.target.value,10) || 25;
    state.page = 1; emit("page-change");
  });
}

function setupSearch() {
  $("#btn-buscar").addEventListener("click", applyFilters);
  $("#btn-limpiar").addEventListener("click", () => {
    $("#q-amie").value = "";
    $("#q-nombre").value = "";
    $("#f-provincia").value = "Provincia";
    $("#f-canton").innerHTML = "<option>Cantón</option>"; $("#f-canton").disabled = true;
    $("#f-parroquia").innerHTML = "<option>Parroquia</option>"; $("#f-parroquia").disabled = true;
    $("#f-sosten").value = "Sostenimiento";
    $("#f-tipo").value = "Tipo";
    state.selected.clear();
    $("#selCount").textContent = 0;
    $("#btn-clear-selection").textContent = "Limpiar selección (0)";
    applyFilters();
  });
  $("#btn-clear-selection").addEventListener("click", () => {
    state.selected.clear();
    $("#selCount").textContent = 0;
    $("#btn-clear-selection").textContent = "Limpiar selección (0)";
    $$("#grid tbody tr.selected").forEach(tr => tr.classList.remove("selected"));
  });
}

/* Transformación 17S/18S */
function setupTransformPanel() {
  map.on("click", (e) => {
    $("#tp-lat").value = e.latlng.lat.toFixed(6);
    $("#tp-lon").value = e.latlng.lng.toFixed(6);
    ddToUTM();
  });
  $("#tp-btn-center").addEventListener("click", () => {
    const lat = parseFloat($("#tp-lat").value), lon = parseFloat($("#tp-lon").value);
    if (isFinite(lat) && isFinite(lon)) map.setView([lat, lon], 15);
  });
  let pin;
  $("#tp-btn-pin").addEventListener("click", () => {
    if (pin) { map.removeLayer(pin); pin = null; return; }
    const lat = parseFloat($("#tp-lat").value), lon = parseFloat($("#tp-lon").value);
    if (isFinite(lat) && isFinite(lon)) pin = L.marker([lat, lon]).addTo(map);
  });
  $("#tp-btn-copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(`${$("#tp-lat").value}, ${$("#tp-lon").value}`); setStatus("Coordenadas copiadas"); }
    catch { setStatus("No se pudo copiar"); }
  });

  const EPSG32717 = "+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs +type=crs";
  const EPSG32718 = "+proj=utm +zone=18 +south +datum=WGS84 +units=m +no_defs +type=crs";

  function ddToUTM() {
    const lat = parseFloat($("#tp-lat").value), lon = parseFloat($("#tp-lon").value);
    if (!isFinite(lat) || !isFinite(lon)) return;
    const p = proj4("EPSG:4326", EPSG32717, [lon, lat]);
    $("#tp-utm-e-17").value = p[0].toFixed(2); $("#tp-utm-n-17").value = p[1].toFixed(2);
    const p18 = proj4("EPSG:4326", EPSG32718, [lon, lat]);
    $("#tp-utm-e-18").value = p18[0].toFixed(2); $("#tp-utm-n-18").value = p18[1].toFixed(2);
  }
  $("#tp-lat").addEventListener("input", ddToUTM);
  $("#tp-lon").addEventListener("input", ddToUTM);
}

/* Eventos */
bus.addEventListener("filters-change", () => applyFilters());
bus.addEventListener("page-change", () => renderTable());

/* Init */
(async function main(){
  initMap();
  setupPaging();
  setupSearch();
  await loadData();
  fillFilters();
  state.view = state.data.slice();
  renderMarkers(state.view);
  emit("page-change");
  setupTransformPanel();
  setStatus("Listo");
})();
