/* Geoportal IE — App (Supabase diag + toggle tabla sincronizado + laterales + basemaps + overlay) */
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
  debug: new URLSearchParams(location.search).get("debug") === "1",
  baseLayers: {},
  overlays: {}
};

function diag(msg, obj){
  setStatus(msg);
  if (state.debug) console.log("[DIAG]", msg, obj ?? "");
  const chip = document.createElement("div");
  chip.className = "chip";
  chip.textContent = msg;
  document.querySelector(".hud").prepend(chip);
  setTimeout(()=>chip.remove(), 7000);
}

/* ---------- Supabase ---------- */
async function pingSupabase(client){
  try{
    const { error } = await client.from("instituciones").select("amie", { count:"exact", head:true });
    if (error) throw error;
    return true;
  }catch(e){
    return e.message || String(e);
  }
}
async function readInstituciones(supa){
  const { data: sample, error: e1 } = await supa.from("instituciones").select("*").limit(50);
  if (e1) throw e1;
  if (!sample || sample.length === 0) return [];

  const cols = Object.keys(sample[0]).reduce((acc,k)=>{ acc[k.toLowerCase()] = k; return acc; },{});
  const pick = (cands) => {
    const key = cands.map(c=>c.toLowerCase()).find(c=>cols[c]);
    return key ? cols[key] : null;
  };

  const mapCols = {
    amie:        pick(["amie","codigo_amie","id_amie"]),
    nombre:      pick(["nombre","nom_ie","institucion","name"]),
    tipo:        pick(["tipo","tipo_ie","categoria"]),
    sosten:      pick(["sostenimiento","sosten","regimen"]),
    provincia:   pick(["provincia","dpa_provincia","prov"]),
    canton:      pick(["canton","dpa_canton","cantón","canton_nombre"]),
    parroquia:   pick(["parroquia","dpa_parroquia","parr","parroquia_nombre"]),
    lat:         pick(["lat","latitud","latitude","y"]),
    lon:         pick(["lon","long","longitud","longitude","x"]),
  };
  if (state.debug) console.table(mapCols);

  if (!mapCols.lat || !mapCols.lon) throw new Error("No se detectaron columnas lat/lon.");

  const selectList = [
    mapCols.amie, mapCols.nombre, mapCols.tipo, mapCols.sosten,
    mapCols.provincia, mapCols.canton, mapCols.parroquia,
    mapCols.lat, mapCols.lon
  ].filter(Boolean).join(",");

  const { data, error } = await supa.from("instituciones").select(selectList).limit(50000);
  if (error) throw error;

  return (data||[]).map(r => ({
    amie: r[mapCols.amie] ?? "",
    nombre: r[mapCols.nombre] ?? "",
    tipo: mapCols.tipo ? r[mapCols.tipo] : "",
    sostenimiento: mapCols.sosten ? r[mapCols.sosten] : "",
    provincia: mapCols.provincia ? r[mapCols.provincia] : "",
    canton: mapCols.canton ? r[mapCols.canton] : "",
    parroquia: mapCols.parroquia ? r[mapCols.parroquia] : "",
    lat: parseFloat(r[mapCols.lat]),
    lon: parseFloat(r[mapCols.lon]),
  })).filter(d => Number.isFinite(d.lat) && Number.isFinite(d.lon));
}

/* ---------- Carga ---------- */
async function loadData() {
  setStatus("Cargando datos…");
  const hasEnv = window.env && window.env.SUPABASE_URL && window.env.SUPABASE_KEY;
  if (!hasEnv) { diag("Sin credenciales Supabase (window.env). Uso CSV local."); return loadFromCSV(); }

  const supa = window.supabase.createClient(window.env.SUPABASE_URL, window.env.SUPABASE_KEY);
  const ping = await pingSupabase(supa);
  if (ping !== true) { diag("Supabase no disponible o RLS bloquea lectura: " + ping); diag("Reviso CSV local de respaldo…"); return loadFromCSV(); }

  try {
    const rows = await readInstituciones(supa);
    state.data = rows;
    if (rows.length === 0) { diag("Supabase respondió 0 filas. ¿Tabla vacía o sin coordenadas?"); return loadFromCSV(); }
    diag(`Supabase OK: ${rows.length} filas.`);
  } catch (e) {
    diag("Error leyendo 'instituciones': " + e.message);
    return loadFromCSV();
  }
}
async function loadFromCSV(){
  try{
    const csvUrl = "data/instituciones_geo_fixed.csv";
    const res = await fetch(csvUrl);
    const text = await res.text();
    const parsed = Papa.parse(text, { header: true, dynamicTyping: true });
    state.data = parsed.data.map(r => ({
      amie: r.amie || r.AMIE || r.amie_code,
      nombre: r.nombre || r.NOMBRE || r.institucion || r.Name,
      tipo: r.tipo || r.TIPO || r.categoria,
      sostenimiento: r.sostenimiento || r.SOSTENIMIENTO || r.regimen,
      provincia: r.provincia || r.PROVINCIA || r.prov,
      canton: r.canton || r.CANTON || r.cantón,
      parroquia: r.parroquia || r.PARROQUIA,
      lat: parseFloat(r.lat || r.LAT || r.latitud || r.latitude || r.y),
      lon: parseFloat(r.lon || r.LON || r.longitud || r.longitude || r.x),
    })).filter(d => Number.isFinite(d.lat) && Number.isFinite(d.lon));
    diag(`CSV local OK: ${state.data.length} filas.`);
  }catch(e){
    diag("No se pudo cargar CSV local: " + e.message);
  }
}

/* ---------- Mapa (OSM + Satélite + Street + Positron + Overlay) ---------- */
let map;
function initMap() {
  // remove stray default layer control if any
  setTimeout(()=>{
    const stray = document.querySelector('.leaflet-control-layers');
    if (stray && stray.parentElement) stray.parentElement.removeChild(stray);
  }, 0);

  // Basemap switcher (debajo de calculadora)
  const bindSwitcher = () => {
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => Array.from(document.querySelectorAll(sel));
    // referencias a capas definidas en este archivo
    try{
      const basemaps = { osm, esriSat, esriStreet, carto: cartoPositron };
      function activateBase(name){
        Object.values(basemaps).forEach(layer => { if (map.hasLayer(layer)) map.removeLayer(layer); });
        if (basemaps[name]) basemaps[name].addTo(map);
      }
      $$('.switcher-group input[name=basemap]').forEach(r => {
        r.addEventListener('change', (e)=> activateBase(e.target.value));
      });
      const chk = $('#chkLabels');
      if (typeof esriLabels !== 'undefined' && esriLabels){
        chk.addEventListener('change', ()=>{
          if (chk.checked){ esriLabels.addTo(map); } else { map.removeLayer(esriLabels); }
        });
      } else {
        const lab = document.querySelector('#basemap-switcher .overlay');
        if (lab) lab.style.display = 'none';
      }
    }catch(e){
      console.warn('Switcher no inicializado:', e);
    }
  };
  setTimeout(()=>{
    bindSwitcher();
    // apply initial basemap from switcher
    const sel = document.querySelector('#basemap-switcher input[name=basemap]:checked');
    if (sel){
      const name = sel.value;
      try{
        const bm = { osm, esriSat, esriStreet, carto: cartoPositron }[name];
        // remove any existing base
        [osm, esriSat, esriStreet, cartoPositron].forEach(Layer => { try{ if (map.hasLayer(Layer)) map.removeLayer(Layer); }catch{} });
        if (bm) bm.addTo(map);
      }catch(e){ console.warn('init basemap failed', e); }
    }
    const chk = document.querySelector('#chkLabels');
    if (chk && chk.checked && typeof esriLabels !== 'undefined'){ try{ esriLabels.addTo(map);}catch{} }
  }, 0);

  // activar medidor sin afectar DB ni estilos
  setTimeout(()=>{ if (window.initMeasure && window.map) initMeasure(window.map); }, 0);
  map = L.map("map", { zoomControl: true }).setView([-1.83, -78.18], 6);

  const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "&copy; OpenStreetMap"
  });
  const esriSat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19, attribution: "Tiles &copy; Esri"
  });
  const esriStreet = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19, attribution: "Tiles &copy; Esri WorldStreetMap"
  });
  const cartoPositron = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19, subdomains: "abcd", attribution: "&copy; CartoDB, OpenStreetMap"
  });
  const esriLabels = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19, attribution: "Labels & Boundaries &copy; Esri", pane: "overlayPane" }
  );

  osm.addTo(map);

  state.baseLayers = {
    "OSM": osm,
    "Satélite (Esri)": esriSat,
    "Esri Street": esriStreet,
    "Carto Positron": cartoPositron
  };
  state.overlays = { "Rótulos (Esri)": esriLabels };

  // [removed] L.control.layers duplicated UI

  // Cluster
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
      ${r.tipo ?? ""} ${r.sostenimiento ? `— ${r.sostenimiento}` : ""}<br/>
      ${[r.provincia,r.canton,r.parroquia].filter(Boolean).join(" / ")}
    `);
    state.mcg.addLayer(m);
  });
}

/* ---------- Filtros / Tabla ---------- */
function distinct(arr, key) {
  return [...new Set(arr.map(x => (x[key] ?? "")).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
}
function fillSelect(sel, opts) {
  const el = $(sel); el.innerHTML = "";
  opts.forEach(v => { const o=document.createElement("option"); o.textContent=v; o.value=v; el.appendChild(o); });
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

/* ---------- Transformación ---------- */
function setupTransformPanel() {
  map.on("click", (e) => {
    $("#tp-lat").value = e.latlng.lat.toFixed(6);
    $("#tp-lon").value = e.latlng.lng.toFixed(6);
    ddToUTM();
  });

  $("#tp-btn-center").addEventListener("click", () => {
    const lat = parseFloat($("#tp-lat").value),
          lon = parseFloat($("#tp-lon").value);
    if (isFinite(lat) && isFinite(lon)) map.setView([lat, lon], 15);
  });

  // --- NUEVO: ícono cruz roja
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

  let pin;
  $("#tp-btn-pin").addEventListener("click", () => {
    // Si ya hay un pin, lo quitamos antes de poner otro
    if (pin) { map.removeLayer(pin); pin = null; }
    const lat = parseFloat($("#tp-lat").value),
          lon = parseFloat($("#tp-lon").value);
    if (isFinite(lat) && isFinite(lon)) {
      pin = L.marker([lat, lon], { icon: crossIcon }).addTo(map);
    }
  });

  $("#tp-btn-copy").addEventListener("click", async () => {
    const txt = [
      `Lat, Lon (DD): ${$("#tp-lat").value}, ${$("#tp-lon").value}`,
      `UTM 17S: Este ${$("#tp-utm-e-17").value}, Norte ${$("#tp-utm-n-17").value}`,
      `UTM 18S: Este ${$("#tp-utm-e-18").value}, Norte ${$("#tp-utm-n-18").value}`
    ].join("\n");
    try {
      await navigator.clipboard.writeText(txt);
      setStatus("Coordenadas copiadas");
    } catch {
      setStatus("No se pudo copiar");
    }
  });

  const EPSG32717 = "+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs +type=crs";
  const EPSG32718 = "+proj=utm +zone=18 +south +datum=WGS84 +units=m +no_defs +type=crs";

  function ddToUTM() {
    const lat = parseFloat($("#tp-lat").value),
          lon = parseFloat($("#tp-lon").value);
    if (!isFinite(lat) || !isFinite(lon)) return;
    const p17 = proj4("EPSG:4326", EPSG32717, [lon, lat]);
    $("#tp-utm-e-17").value = p17[0].toFixed(2);
    $("#tp-utm-n-17").value = p17[1].toFixed(2);
    const p18 = proj4("EPSG:4326", EPSG32718, [lon, lat]);
    $("#tp-utm-e-18").value = p18[0].toFixed(2);
    $("#tp-utm-n-18").value = p18[1].toFixed(2);
  }
  $("#tp-lat").addEventListener("input", ddToUTM);
  $("#tp-lon").addEventListener("input", ddToUTM);
}


/* ---------- Toggle tabla (dos botones sincronizados) ---------- */
(function setupTableToggle(){
  const panel = $("#panel-tabla");
  const btnTop = $("#btn-toggle-table");
  const btnInner = $("#btn-toggle-table-inner");
  if (!panel || !btnTop || !btnInner) return;

  function apply(hidden){
    panel.classList.toggle("hidden", hidden);
    btnTop.textContent   = hidden ? "Mostrar tabla" : "Ocultar tabla";
    btnInner.textContent = hidden ? "Mostrar"       : "Ocultar";
    btnTop.setAttribute("aria-pressed", hidden ? "true" : "false");
    btnInner.setAttribute("aria-pressed", hidden ? "true" : "false");
    localStorage.setItem("tableHidden", hidden ? "1" : "0");
    setTimeout(()=> map.invalidateSize(), 200);
  }

  const saved = localStorage.getItem("tableHidden") === "1";
  apply(saved);

  btnTop.addEventListener("click", () => apply(!panel.classList.contains("hidden")));
  btnInner.addEventListener("click", () => apply(!panel.classList.contains("hidden")));
})();

/* ---------- Eventos e Init ---------- */
bus.addEventListener("filters-change", () => applyFilters());
bus.addEventListener("page-change", () => renderTable());

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
  let pin;
  const originalBtn = document.getElementById("tp-btn-pin");
  if (originalBtn){
    const btn = originalBtn.cloneNode(true);
    originalBtn.replaceWith(btn);
    btn.addEventListener("click", () => {
      const lat = parseFloat($("#tp-lat").value), lon = parseFloat($("#tp-lon").value);
      if (!isFinite(lat) || !isFinite(lon)) return;
      if (pin) { map.removeLayer(pin); pin = null; }
      pin = L.marker([lat, lon], { icon: crossIcon }).addTo(map);
    });
  }
  $("#tp-btn-copy").addEventListener("click", async () => {
    const txt = [
      `Lat, Lon (DD): ${$("#tp-lat").value}, ${$("#tp-lon").value}`,
      `UTM 17S: Este ${$("#tp-utm-e-17").value}, Norte ${$("#tp-utm-n-17").value}`,
      `UTM 18S: Este ${$("#tp-utm-e-18").value}, Norte ${$("#tp-utm-n-18").value}`
    ].join("\n");
    try { await navigator.clipboard.writeText(txt); setStatus("Coordenadas copiadas"); }
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

