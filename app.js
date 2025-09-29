// ==========================
//  AMIE Geoportal — app.js
//  UI estilo navegación (oscuro) + Supabase v2
// ==========================
const TABLE = 'instituciones'; // nombre exacto en Supabase

// ---- Estado UI ----
let supa = null;
let map, clusterLayer, markers = [];
let dataCache = [];     // datos mostrados (para tabla y mapa)
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

// ---- Supabase init ----
function getSupabase() {
  if (!supa && window.env?.SUPABASE_URL && window.env?.SUPABASE_KEY && window.supabase) {
    supa = window.supabase.createClient(window.env.SUPABASE_URL, window.env.SUPABASE_KEY);
    console.log('✅ Supabase listo');
  }
  return supa;
}

// ---- Carga de datos ----
async function loadFromSupabase(filters = {}, paging = { page:1, pageSize: 10000 }) {
  const client = getSupabase();
  if (!client) throw new Error('Supabase no configurado');

  let query = client.from(TABLE).select('*', { count: 'exact' });

  if (filters.provincia)     query = query.eq('Provincia', filters.provincia);
  if (filters.canton)        query = query.eq('Canton', filters.canton);
  if (filters.parroquia)     query = query.eq('Parroquia', filters.parroquia);
  if (filters.tipo)          query = query.eq('Tipo', filters.tipo);
  if (filters.sostenimiento) query = query.eq('Sostenimiento', filters.sostenimiento);
  if (filters.qAmie)         query = query.ilike('AMIE', `%${filters.qAmie}%`);
  if (filters.qNombre)       query = query.ilike('Nombre', `%${filters.qNombre}%`);

  const from = (paging.page - 1) * paging.pageSize;
  const to   = from + paging.pageSize - 1;
  const { data, error, count } = await query.range(from, to);

  if (error) throw error;

  const rows = (data ?? [])
    .map(r => ({
      AMIE: r.AMIE, Nombre: r.Nombre,
      Tipo: r.Tipo, Sostenimiento: r.Sostenimiento,
      Provincia: r.Provincia, Canton: r.Canton, Parroquia: r.Parroquia,
      lat: parseFloat(r.lat), lon: parseFloat(r.lon)
    }))
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lon));

  return { rows, total: count ?? rows.length };
}

function loadFromCSV(path) {
  return new Promise((resolve, reject) => {
    Papa.parse(path, {
      header: true, download: true,
      complete: (res) => {
        const rows = res.data.map(r => ({
          AMIE: r.AMIE, Nombre: r.Nombre, Tipo: r.Tipo, Sostenimiento: r.Sostenimiento,
          Provincia: r.Provincia, Canton: r.Canton, Parroquia: r.Parroquia,
          lat: parseFloat(r.lat || r.Lat || r.latitude),
          lon: parseFloat(r.lon || r.Lon || r.longitude)
        })).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lon));
        resolve({ rows, total: rows.length });
      },
      error: reject
    });
  });
}

async function loadDataInitial() {
  setStatus('Cargando datos...');
  try {
    const { rows, total } = await loadFromSupabase({}, { page:1, pageSize:10000 });
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

  // Provincia
  let { data: provs } = await c.from(TABLE).select('Provincia', { distinct: true }).order('Provincia', { ascending:true });
  putOptions($('#f-provincia'), ['Provincia'].concat(uniq((provs||[]).map(r=>r.Provincia))));

  // Sostenimiento
  let { data: sosts } = await c.from(TABLE).select('Sostenimiento', { distinct: true }).order('Sostenimiento', { ascending:true });
  putOptions($('#f-sosten'), ['Sostenimiento'].concat(uniq((sosts||[]).map(r=>r.Sostenimiento))));

  // Tipo
  let { data: tipos } = await c.from(TABLE).select('Tipo', { distinct: true }).order('Tipo', { ascending:true });
  putOptions($('#f-tipo'), ['Tipo'].concat(uniq((tipos||[]).map(r=>r.Tipo))));
}

async function updateCantones(provincia) {
  const c = getSupabase();
  $('#f-canton').disabled = !provincia;
  $('#f-parroquia').disabled = true;
  putOptions($('#f-canton'), ['Cantón']);
  putOptions($('#f-parroquia'), ['Parroquia']);
  if (!c || !provincia) return;
  const { data } = await c.from(TABLE).select('Canton', { distinct:true }).eq('Provincia', provincia).order('Canton');
  putOptions($('#f-canton'), ['Cantón'].concat(uniq((data||[]).map(r=>r.Canton))));
}

async function updateParroquias(provincia, canton) {
  const c = getSupabase();
  $('#f-parroquia').disabled = !(provincia && canton);
  putOptions($('#f-parroquia'), ['Parroquia']);
  if (!c || !(provincia && canton)) return;
  const { data } = await c.from(TABLE).select('Parroquia', { distinct:true })
    .eq('Provincia', provincia).eq('Canton', canton).order('Parroquia');
  putOptions($('#f-parroquia'), ['Parroquia'].concat(uniq((data||[]).map(r=>r.Parroquia))));
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

const blueIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [25,41], iconAnchor:[12,41], popupAnchor:[1,-34],
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});
// en drawAll(): const m = L.marker([r.lat, r.lon], { icon: blueIcon, title: ... });


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

// ---- Consulta con filtros y dibujar ----
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
    const { rows, total } = await loadFromSupabase(filters, { page:1, pageSize:10000 });
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
  await fillDistinctFilters();
  await loadDataInitial();
})();

