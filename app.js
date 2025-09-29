// ==========================
//  AMIE Geoportal — app.js
//  Estilo navegación (oscuro) + Supabase v2
//  Autodetección de columnas + carga en lotes
// ==========================
const TABLE = 'instituciones'; // nombre exacto en Supabase

// ---- Estado UI ----
let supa = null;
let map, clusterLayer, markers = [];
let dataCache = [];   // datos visibles (tabla + mapa)
let selection = new Set();

let pageNow = 1;
let pageSize = 25;
let pageTotal = 1;

// ---- Utilitarios ----
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const fmt = (v) => (v ?? '');
const uniq = (arr) => [...new Set(arr.filter(x => (x ?? '').toString().trim() !== ''))]
  .sort((a,b)=>`${a}`.localeCompare(`${b}`,'es'));

function setStatus(msg){ $('#status').textContent = msg; }
function setSelCount(){ $('#selCount').textContent = selection.size; }

// ---- Resolución automática de nombres de columna ----
const CANDIDATES = {
  AMIE: ['AMIE','amie'],
  Nombre: ['Nombre','nombre'],
  Tipo: ['Tipo','tipo'],
  Sostenimiento: ['Sostenimiento','sostenimiento'],
  Provincia: ['Provincia','provincia'],
  Canton: ['Canton','cantón','canton'],
  Parroquia: ['Parroquia','parroquia'],
  lat: ['lat','Lat','latitude','LAT'],
  lon: ['lon','Lon','longitude','LON']
};
const COL = {}; // se llena al detectar

function firstKey(obj, list){
  for (const k of list) if (Object.prototype.hasOwnProperty.call(obj, k)) return k;
  return list[0]; // fallback
}
function detectColumns(sampleRow){
  for (const logical in CANDIDATES){
    COL[logical] = firstKey(sampleRow, CANDIDATES[logical]);
  }
  console.log('🧭 Column map:', COL);
}
function v(obj, logical){
  const k = COL[logical] ?? CANDIDATES[logical][0];
  return obj?.[k];
}

// ---- Supabase init ----
function getSupabase() {
  if (!supa && window.env?.SUPABASE_URL && window.env?.SUPABASE_KEY && window.supabase) {
    supa = window.supabase.createClient(window.env.SUPABASE_URL, window.env.SUPABASE_KEY);
    console.log('✅ Supabase listo');
  }
  return supa;
}

// Detecta columnas consultando 1 fila
async function ensureColumnsDetected() {
  if (Object.keys(COL).length > 0) return;
  const client = getSupabase();
  const probe = await client.from(TABLE).select('*').limit(1);
  if (probe.error) throw probe.error;
  if ((probe.data?.length ?? 0) > 0) detectColumns(probe.data[0]);
  else throw new Error('La tabla está vacía o no accesible (revisa RLS/políticas).');
}

// ---- Carga de datos (en lotes, usa columnas detectadas) ----
async function fetchAllFromSupabase(filters = {}, chunkSize = 1000, hardCap = 20000) {
  const client = getSupabase();
  if (!client) throw new Error('Supabase no configurado');
  await ensureColumnsDetected();

  let all = [];
  let from = 0;
  let to   = from + chunkSize - 1;
  let total = null;

  // reconstruye la query base con filtros usando los nombres ya detectados
  const buildQuery = () => {
    let q = client.from(TABLE).select('*', { count: 'exact' });
    if (filters.provincia)     q = q.eq(COL.Provincia, filters.provincia);
    if (filters.canton)        q = q.eq(COL.Canton, filters.canton);
    if (filters.parroquia)     q = q.eq(COL.Parroquia, filters.parroquia);
    if (filters.tipo)          q = q.eq(COL.Tipo, filters.tipo);
    if (filters.sostenimiento) q = q.eq(COL.Sostenimiento, filters.sostenimiento);
    if (filters.qAmie)         q = q.ilike(COL.AMIE, `%${filters.qAmie}%`);
    if (filters.qNombre)       q = q.ilike(COL.Nombre, `%${filters.qNombre}%`);
    return q;
  };

  while (all.length < hardCap) {
    const { data, error, count } = await buildQuery().range(from, to);
    if (error) throw error;
    if (total === null) total = count ?? 0;
    const batch = (data ?? []).map(r => ({
      AMIE: v(r,'AMIE'),
      Nombre: v(r,'Nombre'),
      Tipo: v(r,'Tipo'),
      Sostenimiento: v(r,'Sostenimiento'),
      Provincia: v(r,'Provincia'),
      Canton: v(r,'Canton'),
      Parroquia: v(r,'Parroquia'),
      lat: parseFloat(v(r,'lat')),
      lon: parseFloat(v(r,'lon'))
    })).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lon));

    all.push(...batch);
    if (!data || data.length < chunkSize) break; // último lote
    from += chunkSize;
    to   += chunkSize;
  }

  return { rows: all, total: total ?? all.length };
}

// Fallback CSV local (usa mapeo flexible)
function loadFromCSV(path) {
  return new Promise((resolve, reject) => {
    Papa.parse(path, {
      header: true, download: true,
      complete: (res) => {
        const first = res.data?.[0] || {};
        if (Object.keys(COL).length === 0 && Object.keys(first).length) {
          detectColumns(first);
        }
        const rows = res.data.map(r => ({
          AMIE: r[COL.AMIE] ?? r.AMIE,
          Nombre: r[COL.Nombre] ?? r.Nombre,
          Tipo: r[COL.Tipo] ?? r.Tipo,
          Sostenimiento: r[COL.Sostenimiento] ?? r.Sostenimiento,
          Provincia: r[COL.Provincia] ?? r.Provincia,
          Canton: r[COL.Canton] ?? r.Canton,
          Parroquia: r[COL.Parroquia] ?? r.Parroquia,
          lat: parseFloat(r[COL.lat] ?? r.lat ?? r.Lat ?? r.latitude),
          lon: parseFloat(r[COL.lon] ?? r.lon ?? r.Lon ?? r.longitude)
        })).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lon));
        resolve({ rows, total: rows.length });
      },
      error: reject
    });
  });
}

// Carga inicial: intenta Supabase (en lotes), si falla usa CSV local
async function loadDataInitial() {
  setStatus('Cargando datos...');
  try {
    const { rows, total } = await fetchAllFromSupabase({}, 1000, 20000);
    dataCache = rows;
    updateKPIs(rows);
    drawAll(rows, true);
    setStatus(`Listo. Registros: ${total}`);
  } catch (e) {
    console.warn('⚠️ Supabase falló, usando CSV local. Motivo:', e.message);
    const { rows, total } = await loadFromCSV('data/instituciones_geo_fixed.csv');
    dataCache = rows;
    updateKPIs(rows);
    drawAll(rows, true);
    setStatus(`Modo CSV local. Registros: ${total}`);
  }
}

// ---- Filtros dependientes (distinct) ----
async function fillDistinctFilters() {
  const c = getSupabase();
  if (!c) return;
  await ensureColumnsDetected();

  const pCol = COL.Provincia || 'Provincia';
  const sCol = COL.Sostenimiento || 'Sostenimiento';
  const tCol = COL.Tipo || 'Tipo';

  let { data: provs } = await c.from(TABLE).select(pCol, { distinct: true }).order(pCol, { ascending:true });
  putOptions($('#f-provincia'), ['Provincia'].concat(uniq((provs||[]).map(r=>r[pCol]))));

  let { data: sosts } = await c.from(TABLE).select(sCol, { distinct: true }).order(sCol, { ascending:true });
  putOptions($('#f-sosten'), ['Sostenimiento'].concat(uniq((sosts||[]).map(r=>r[sCol]))));

  let { data: tipos } = await c.from(TABLE).select(tCol, { distinct: true }).order(tCol, { ascending:true });
  putOptions($('#f-tipo'), ['Tipo'].concat(uniq((tipos||[]).map(r=>r[tCol]))));
}

async function updateCantones(provincia) {
  const c = getSupabase();
  $('#f-canton').disabled = !provincia;
  $('#f-parroquia').disabled = true;
  putOptions($('#f-canton'), ['Cantón']);
  putOptions($('#f-parroquia'), ['Parroquia']);
  if (!c || !provincia) return;
  const pCol = COL.Provincia || 'Provincia';
  const cCol = COL.Canton || 'Canton';
  const { data } = await c.from(TABLE).select(cCol, { distinct:true }).eq(pCol, provincia).order(cCol);
  putOptions($('#f-canton'), ['Cantón'].concat(uniq((data||[]).map(r=>r[cCol]))));
}

async function updateParroquias(provincia, canton) {
  const c = getSupabase();
  $('#f-parroquia').disabled = !(provincia && canton);
  putOptions($('#f-parroquia'), ['Parroquia']);
  if (!c || !(provincia && canton)) return;
  const pCol = COL.Provincia || 'Provincia';
  const cCol = COL.Canton || 'Canton';
  const qCol = COL.Parroquia || 'Parroquia';
  const { data } = await c.from(TABLE).select(qCol, { distinct:true })
    .eq(pCol, provincia).eq(cCol, canton).order(qCol);
  putOptions($('#f-parroquia'), ['Parroquia'].concat(uniq((data||[]).map(r=>r[qCol]))));
}

function putOptions(select, values) {
  select.innerHTML = '';
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = (v === 'Provincia' || v === 'Cantón' || v === 'Parroquia' || v === 'Tipo' || v === 'Sostenimiento') ? '' : v;
    opt.textContent = v;
    select.appendChild(opt);
  });
}

// ---- Mapa + tabla ----
function initMap() {
  map = L.map('map', { preferCanvas: true }).setView([-1.45, -78.2], 6);

  // Base map dark
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap, © CARTO'
  }).addTo(map);

  clusterLayer = L.markerClusterGroup({ chunkedLoading: true, spiderfyOnMaxZoom: true });
  map.addLayer(clusterLayer);

  map.on('mousemove', (e) => {
    $('#cursor').textContent = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
  });
}

const blueIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [25,41], iconAnchor:[12,41], popupAnchor:[1,-34],
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

function drawAll(rows, fit=false) {
  // Mapa
  clusterLayer.clearLayers();
  markers = [];
  rows.forEach(r => {
    const m = L.marker([r.lat, r.lon], { icon: blueIcon, title: `${r.AMIE} — ${r.Nombre}` });
    m.bindPopup(
      `<b>${fmt(r.Nombre)}</b><br>
       AMIE: ${fmt(r.AMIE)}<br>
       ${fmt(r.Tipo)} — ${fmt(r.Sostenimiento)}<br>
       ${fmt(r.Parroquia)}, ${fmt(r.Canton)}, ${fmt(r.Provincia)}`
    );
    m.on('click', () => {
      selection.add(r.AMIE);
      setSelCount();
      highlightRow(r.AMIE);
    });
    clusterLayer.addLayer(m);
    markers.push({ m, r });
  });
  if (fit && rows.length) {
    const b = L.latLngBounds(rows.map(r => [r.lat, r.lon]));
    map.fitBounds(b.pad(0.1));
  }

  // Tabla (paginada)
  pageNow = 1;
  pageSize = parseInt($('#pg-size').value, 10) || 25;
  renderTable(rows);
}

function renderTable(rows) {
  pageTotal = Math.max(1, Math.ceil(rows.length / pageSize));
  $('#pg-now').textContent = pageNow;
  $('#pg-total').textContent = pageTotal;

  const start = (pageNow - 1) * pageSize;
  const end   = start + pageSize;
  const pageRows = rows.slice(start, end);

  const tbody = $('#grid tbody');
  tbody.innerHTML = '';
  pageRows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmt(r.AMIE)}</td>
      <td>${fmt(r.Nombre)}</td>
      <td>${fmt(r.Tipo)}</td>
      <td>${fmt(r.Sostenimiento)}</td>
      <td>${fmt(r.Provincia)}</td>
      <td>${fmt(r.Canton)}</td>
      <td>${fmt(r.Parroquia)}</td>`;
    tr.addEventListener('click', () => { selection.add(r.AMIE); setSelCount(); flyTo(r); });
    tbody.appendChild(tr);
  });
}

function flyTo(r) {
  map.setView([r.lat, r.lon], 14);
  const mk = markers.find(x => x.r.AMIE === r.AMIE);
  if (mk) mk.m.openPopup();
  highlightRow(r.AMIE);
}

function highlightRow(amie) {
  $$('#grid tbody tr').forEach(tr => {
    const v = tr.children[0]?.textContent;
    tr.style.background = (v === amie) ? 'rgba(58,160,255,.18)' : '';
  });
}

function updateKPIs(rows) {
  $('#kpi-total').textContent = rows.length;
  $('#kpi-provincias').textContent = uniq(rows.map(r=>r.Provincia)).length;
  $('#kpi-tipos').textContent = uniq(rows.map(r=>r.Tipo)).length;
}

// ---- Eventos de UI ----
$('#btn-limpiar').addEventListener('click', async () => {
  $('#f-provincia').value = '';
  $('#f-canton').value = '';
  $('#f-parroquia').value = '';
  $('#f-canton').disabled = true;
  $('#f-parroquia').disabled = true;
  $('#f-sosten').value = '';
  $('#f-tipo').value = '';
  $('#q-amie').value = '';
  $('#q-nombre').value = '';
  await doQueryAndDraw();
});

$('#f-provincia').addEventListener('change', async (e) => {
  await updateCantones(e.target.value || '');
  await doQueryAndDraw();
});
$('#f-canton').addEventListener('change', async (e) => {
  await updateParroquias($('#f-provincia').value || '', e.target.value || '');
  await doQueryAndDraw();
});
$('#f-parroquia').addEventListener('change', doQueryAndDraw);
$('#f-sosten').addEventListener('change', doQueryAndDraw);
$('#f-tipo').addEventListener('change', doQueryAndDraw);

$('#btn-buscar').addEventListener('click', doQueryAndDraw);
$('#q-amie').addEventListener('keyup', (e)=>{ if(e.key==='Enter') doQueryAndDraw(); });
$('#q-nombre').addEventListener('keyup', (e)=>{ if(e.key==='Enter') doQueryAndDraw(); });

$('#pg-prev').addEventListener('click', () => { if (pageNow>1){ pageNow--; renderTable(dataCache); }});
$('#pg-next').addEventListener('click', () => { if (pageNow<pageTotal){ pageNow++; renderTable(dataCache); }});
$('#pg-size').addEventListener('change', () => { pageSize = parseInt($('#pg-size').value,10)||25; pageNow=1; renderTable(dataCache); });

$('#btn-clear-selection').addEventListener('click', () => { selection.clear(); setSelCount(); });

// ---- Consulta con filtros y dibujar (usa carga en lotes) ----
async function doQueryAndDraw() {
  const filters = {
    provincia: $('#f-provincia').value || '',
    canton: $('#f-canton').value || '',
    parroquia: $('#f-parroquia').value || '',
    tipo: $('#f-tipo').value || '',
    sostenimiento: $('#f-sosten').value || '',
    qAmie: ($('#q-amie')?.value || '').trim(),
    qNombre: ($('#q-nombre')?.value || '').trim()
  };

  setStatus('Consultando...');
  try {
    const { rows, total } = await fetchAllFromSupabase(filters, 1000, 20000);
    dataCache = rows;
    drawAll(rows, true);
    setStatus(`Consulta OK (${total})`);
  } catch (e) {
    setStatus('Error en consulta Supabase (revisa RLS/tabla).');
    console.error(e);
  }
}

// ---- Boot ----
(async function boot(){
  initMap();
  try {
    await fillDistinctFilters();
  } catch (e) {
    console.warn('No se pudieron llenar filtros desde Supabase aún:', e.message);
  }
  await loadDataInitial();
})();
