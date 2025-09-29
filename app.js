/* ===========================================================
   Geoportal – App con Supabase
   - Conexión Supabase (fallback a vacío si no hay config)
   - Filtros, búsqueda, paginación
   - Tabla con selección on/off + "Limpiar selección (n)"
   - Mapa Leaflet + MarkerCluster + Draw + utilidades de coordenadas
   =========================================================== */

/* ======================= SUPABASE ======================= */
const HAS_SB = !!(window.env && window.env.SUPABASE_URL && window.env.SUPABASE_KEY);
const sb = HAS_SB ? window.supabase.createClient(window.env.SUPABASE_URL, window.env.SUPABASE_KEY) : null;

// Nombre de la tabla en Supabase
const TABLE = 'instituciones'; 
// Columnas esperadas (ajústalo si tu tabla difiere)
const COLS = 'amie,nombre,tipo,sostenimiento,provincia,canton,parroquia,lat,lon';

// Estado UI
const state = {
  page: 1,
  pageSize: 25,
  total: 0,
  search: '',
  filtros: { provincia:'', canton:'', parroquia:'', sostenimiento:'', tipo:'' },
};

function qs(id){ return document.getElementById(id); }

/* ======================= MAPA ======================= */
let map, clusterGroup, drawnItems, drawControl;
initMap();

function initMap(){
  map = L.map('map', { zoomControl:true }).setView([-1.8, -78.8], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19, attribution:'&copy; OpenStreetMap'
  }).addTo(map);

  clusterGroup = L.markerClusterGroup();
  map.addLayer(clusterGroup);

  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  drawControl = new L.Control.Draw({
    draw:{
      polygon:false, polyline:false, circle:false, marker:false, circlemarker:false,
      rectangle:{ shapeOptions:{ color:'#1DB954' } }
    },
    edit:{ featureGroup: drawnItems, edit:false, remove:true }
  });
  map.on(L.Draw.Event.CREATED,(e)=>{
    drawnItems.clearLayers(); drawnItems.addLayer(e.layer);
  });

  wireCoordsBar();
}

/* ======================= DATA (Supabase) ======================= */
async function fetchDistinct(col, extraWhere = {}){
  if(!HAS_SB) return [];
  // Trae valores y los vuelve únicos en cliente
  let q = sb.from(TABLE).select(col).not(col, 'is', null);
  // Si hay filtros previos que condicionan (ej: cantón depende de provincia)
  for(const [k,v] of Object.entries(extraWhere)){ if(v) q = q.eq(k, v); }
  const { data, error } = await q.limit(10000);
  if(error){ console.warn('distinct', col, error.message); return []; }
  const set = new Set(data.map(r=>r[col]).filter(Boolean));
  return Array.from(set).sort((a,b)=>String(a).localeCompare(String(b),'es'));
}

function buildQuery(){
  let q = sb.from(TABLE).select(COLS, { count:'exact' });

  // Filtros
  const f = state.filtros;
  if(f.provincia) q = q.eq('provincia', f.provincia);
  if(f.canton)     q = q.eq('canton', f.canton);
  if(f.parroquia)  q = q.eq('parroquia', f.parroquia);
  if(f.sostenimiento) q = q.eq('sostenimiento', f.sostenimiento);
  if(f.tipo)       q = q.eq('tipo', f.tipo);

  // Búsqueda por AMIE o nombre
  const s = state.search.trim();
  if(s){
    // OR: amie ILIKE %s% OR nombre ILIKE %s%
    q = q.or(`amie.ilike.%${s}%,nombre.ilike.%${s}%`);
  }

  // Orden + paginación
  const from = (state.page - 1) * state.pageSize;
  const to   = from + state.pageSize - 1;
  q = q.order('nombre', { ascending:true }).range(from, to);

  return q;
}

async function loadData(){
  if(!HAS_SB){ renderTable([], 0); renderKPIs(0,0,0,0); return; }

  // KPIs en paralelo
  updateKPIs();

  // Datos de la tabla
  const { data, count, error } = await buildQuery();
  if(error){
    console.error('Query error:', error.message);
    alert('Error cargando datos: ' + error.message);
    renderTable([], 0);
    return;
  }
  state.total = count || 0;
  renderTable(data || [], state.total);
  renderMarkers(data || []);
}

async function updateKPIs(){
  try{
    // Total instituciones
    const t = await sb.from(TABLE).select('amie', { count:'exact', head:true });
    const total = t.count || 0;

    // Matriz
    const m = await sb.from(TABLE).select('amie', { count:'exact', head:true }).eq('tipo','MATRIZ');
    const matriz = m.count || 0;

    // Establecimiento
    const e = await sb.from(TABLE).select('amie', { count:'exact', head:true }).eq('tipo','ESTABLECIMIENTO');
    const estab = e.count || 0;

    // Sostenimientos distintos (aprox)
    const s = await fetchDistinct('sostenimiento');
    const sosten = s.length;

    renderKPIs(total, matriz, estab, sosten);
  }catch(err){
    console.warn('KPIs error', err);
  }
}

/* ======================= RENDER ======================= */
function renderKPIs(total, matriz, estab, sosten){
  qs('kpiTotal') && (qs('kpiTotal').textContent = total.toLocaleString('es'));
  qs('kpiMatriz') && (qs('kpiMatriz').textContent = matriz.toLocaleString('es'));
  qs('kpiEst') && (qs('kpiEst').textContent = estab.toLocaleString('es'));
  qs('kpiSost') && (qs('kpiSost').textContent = String(sosten));
}

function renderTable(rows, total){
  const tbody = qs('tblBody') || document.querySelector('#tbl tbody');
  const pageInfo = qs('pageInfo');
  const pageSizeSel = qs('pageSize');

  if(!tbody) return;
  tbody.innerHTML = rows.map(r=>`
    <tr>
      <td>${r.amie ?? ''}</td>
      <td>${r.nombre ?? ''}</td>
      <td>${r.tipo ?? ''}</td>
      <td>${r.sostenimiento ?? ''}</td>
      <td>${r.provincia ?? ''}</td>
      <td>${r.canton ?? ''}</td>
      <td>${r.parroquia ?? ''}</td>
    </tr>
  `).join('');

  // Paginación
  const totalPages = Math.max(1, Math.ceil((total||0) / state.pageSize));
  state.page = Math.min(state.page, totalPages);
  if(pageInfo) pageInfo.textContent = `Página ${state.page}/${totalPages}`;
  if(pageSizeSel) pageSizeSel.value = String(state.pageSize);

  // Re-vincular selección y contador
  wireTableSelection(); 
  updateSelectionCounter();
}

function renderMarkers(rows){
  // Por performance, pintamos solo la página actual
  clusterGroup.clearLayers();
  rows.forEach(r=>{
    const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
    if(!isFinite(lat) || !isFinite(lon)) return;
    const m = L.marker([lat, lon]).bindPopup(`
      <strong>${r.nombre || ''}</strong><br>
      AMIE: ${r.amie || ''}<br>
      ${r.provincia || ''} / ${r.canton || ''} / ${r.parroquia || ''}
    `);
    clusterGroup.addLayer(m);
  });
}

/* ======================= FILTROS & UI ======================= */
async function initFilters(){
  if(!HAS_SB) return;

  // Provincia
  const provincias = await fetchDistinct('provincia');
  fillSelect(qs('provSelect'), ['Provincia', ...provincias]);

  // Sostenimiento
  const sosts = await fetchDistinct('sostenimiento');
  fillSelect(qs('sostSelect'), ['Sostenimiento', ...sosts]);

  // Tipo (tienes opciones fijas en HTML, lo dejamos)
  // Cantón y Parroquia dependen de selección
  await updateCantonParroquiaOptions();
}

function fillSelect(sel, values){
  if(!sel) return;
  const first = values[0];
  sel.innerHTML = '';
  sel.appendChild(new Option(first, ''));
  for(let i=1;i<values.length;i++){
    const v = values[i];
    sel.appendChild(new Option(String(v), String(v)));
  }
}

async function updateCantonParroquiaOptions(){
  const prov = state.filtros.provincia || '';
  const cant = state.filtros.canton || '';

  // Cantones por provincia
  const cantones = await fetchDistinct('canton', { provincia: prov });
  fillSelect(qs('cantSelect'), ['Cantón', ...cantones]);

  // Parroquias por provincia + cantón
  const extra = { provincia: prov };
  if(cant) extra.canton = cant;
  const parroquias = await fetchDistinct('parroquia', extra);
  fillSelect(qs('parrSelect'), ['Parroquia', ...parroquias]);
}

function wireUI(){
  // Búsqueda
  qs('searchBtn')?.addEventListener('click', ()=>{
    const s = (qs('amieInput')?.value || '').trim();
    state.search = s;
    state.page = 1;
    loadData();
  });

  // Filtros
  qs('provSelect')?.addEventListener('change', async (e)=>{
    state.filtros.provincia = e.target.value || '';
    state.filtros.canton = '';
    state.filtros.parroquia = '';
    state.page = 1;
    await updateCantonParroquiaOptions();
    loadData();
  });
  qs('cantSelect')?.addEventListener('change', async (e)=>{
    state.filtros.canton = e.target.value || '';
    state.filtros.parroquia = '';
    state.page = 1;
    await updateCantonParroquiaOptions();
    loadData();
  });
  qs('parrSelect')?.addEventListener('change', (e)=>{
    state.filtros.parroquia = e.target.value || '';
    state.page = 1;
    loadData();
  });
  qs('sostSelect')?.addEventListener('change', (e)=>{
    state.filtros.sostenimiento = e.target.value || '';
    state.page = 1;
    loadData();
  });
  qs('tipoSelect')?.addEventListener('change', (e)=>{
    state.filtros.tipo = e.target.value || '';
    state.page = 1;
    loadData();
  });

  // Limpiar filtros
  qs('clearBtn')?.addEventListener('click', async ()=>{
    state.search = '';
    if(qs('amieInput')) qs('amieInput').value = '';
    state.filtros = { provincia:'', canton:'', parroquia:'', sostenimiento:'', tipo:'' };
    state.page = 1;
    await initFilters();
    loadData();
  });

  // Paginación
  qs('prevPage')?.addEventListener('click', ()=>{
    if(state.page > 1){ state.page--; loadData(); }
  });
  qs('nextPage')?.addEventListener('click', ()=>{
    const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
    if(state.page < totalPages){ state.page++; loadData(); }
  });
  qs('pageSize')?.addEventListener('change', (e)=>{
    state.pageSize = parseInt(e.target.value, 10) || 25;
    state.page = 1;
    loadData();
  });

  // Herramientas mapa
  qs('toolDropPoint')?.addEventListener('click', ()=>{
    const c = map.getCenter();
    const m = L.marker(c, {draggable:true});
    clusterGroup.addLayer(m);
    map.panTo(c);
  });
  qs('toolDrawExtent')?.addEventListener('click', ()=>{
    map.addControl(drawControl);
    new L.Draw.Rectangle(map, drawControl.options.draw.rectangle).enable();
  });
  qs('toolClearTools')?.addEventListener('click', ()=>{
    drawnItems.clearLayers();
    clusterGroup.clearLayers();
  });

  // Zoom libre
  qs('zoomGo')?.addEventListener('click', ()=>{
    const txt = (qs('zoomFree')?.value || '').trim();
    const zoom = parseInt(qs('zoomLevel')?.value || '15', 10);
    const p = parseLatLon(txt);
    if(!p){ alert('Formato inválido. Use "lat, lon"'); return; }
    map.setView([p.lat, p.lon], isFinite(zoom)? zoom : 15);
  });

  // Conversores
  qs('dd2dms')?.addEventListener('click', ()=>{
    const val = (qs('ddInput')?.value || '').trim();
    const p = parseLatLon(val);
    if(!p){ alert('Ingresa DD como "lat, lon"'); return; }
    const dms = ddPairToDms(p.lat, p.lon);
    const out = qs('dmsInput'); if(out) out.value = `${dms.lat}, ${dms.lon}`;
  });
  qs('dms2dd')?.addEventListener('click', ()=>{
    const val = (qs('dmsInput')?.value || '').trim();
    const p = parseDmsPair(val);
    if(!p){ alert('Ingresa DMS como: 2°10′15″S, 79°55′20″W'); return; }
    const out = qs('ddInput'); if(out) out.value = `${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`;
  });
  qs('dd2utm')?.addEventListener('click', ()=>{
    const val = (qs('ddInput')?.value || '').trim();
    const p = parseLatLon(val);
    if(!p){ alert('Ingresa DD como "lat, lon"'); return; }
    const utm = ddToUtm17S(p.lat, p.lon);
    const chip = qs('utmOut'); if(chip) chip.textContent = `UTM 17S: E ${Math.round(utm.x)}  N ${Math.round(utm.y)}`;
  });

  // Tabla selección & botón
  wireTableSelection();
  wireClearSelectionButton();

  // Nudge para Leaflet
  setTimeout(()=>window.dispatchEvent(new Event('resize')), 200);
}

/* ======================= INIT ======================= */
document.addEventListener('DOMContentLoaded', async ()=>{
  wireUI();
  if(HAS_SB){
    await initFilters();
    await loadData();
  }else{
    console.warn('Supabase no configurado. Crea config.js.');
    renderKPIs(0,0,0,0);
    renderTable([], 0);
  }
});

/* ======================= UTILS COORDENADAS ======================= */
function wireCoordsBar(){
  const bar = qs('coordsBar'); if(!bar) return;
  map.on('mousemove', (ev)=>{
    const lat = ev.latlng.lat.toFixed(6), lon = ev.latlng.lng.toFixed(6);
    bar.textContent = `Lat: ${lat}  Lon: ${lon} (click para copiar)`;
  });
  bar.addEventListener('click', ()=>{
    navigator.clipboard?.writeText(bar.textContent.replace(/\s*\(click.*\)$/,''));
    bar.textContent = '¡Copiado!'; setTimeout(()=>wireCoordsBar(), 800);
  });
}
function parseLatLon(str){
  if(!str) return null;
  const cleaned = str.replace(/[;|]/g, ',').replace(/\s+/g,'');
  const parts = cleaned.split(',');
  if(parts.length!==2) return null;
  const toNum = s => Number(s.replace(',', '.'));
  const lat = toNum(parts[0]), lon = toNum(parts[1]);
  if(!isFinite(lat)||!isFinite(lon)) return null;
  if(Math.abs(lat)>90 || Math.abs(lon)>180) return null;
  return {lat, lon};
}
function toDMS(dd, isLat){
  const hemi = (isLat ? (dd>=0?'N':'S') : (dd>=0?'E':'W'));
  const v = Math.abs(dd); const d = Math.floor(v);
  const mFloat = (v-d)*60; const m = Math.floor(mFloat); const s = (mFloat-m)*60;
  return `${d}°${m}′${s.toFixed(2)}″${hemi}`;
}
function ddPairToDms(lat, lon){ return { lat: toDMS(lat, true), lon: toDMS(lon, false) }; }
function parseSingleDMS(dms){
  const s = dms.replace(/\s+/g,'').toUpperCase();
  const re = /(-?\d+)[°º]?(\d+)?['′]?(\d+(?:\.\d+)?)?["″]?([NSEW])?/;
  const m = s.match(re); if(!m) return NaN;
  const deg = parseFloat(m[1]||'0'), min = parseFloat(m[2]||'0'), sec = parseFloat(m[3]||'0');
  const hemi = m[4] || null; let dd = Math.abs(deg)+(min/60)+(sec/3600);
  if((hemi==='S'||hemi==='W') || /^-/.test(m[1])) dd *= -1; return dd;
}
function parseDmsPair(str){
  const parts = str.split(/\s*,\s*/); if(parts.length!==2) return null;
  const lat = parseSingleDMS(parts[0]); const lon = parseSingleDMS(parts[1]);
  if(!isFinite(lat)||!isFinite(lon)) return null; return {lat, lon};
}
function ddToUtm17S(lat, lon){
  const epsg32717 = '+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs +type=crs';
  const wgs84 = '+proj=longlat +datum=WGS84 +no_defs +type=crs';
  const p = proj4(wgs84, epsg32717, [lon, lat]); return { x:p[0], y:p[1] };
}

/* ======================= TABLA: selección ======================= */
function getTbody(){ return qs('tblBody') || document.querySelector('#tbl tbody'); }
function wireTableSelection(){
  const tbody = getTbody(); if(!tbody) return;
  if(tbody.dataset.wired==='1') return; tbody.dataset.wired='1';
  tbody.addEventListener('click', (ev)=>{
    const tr = ev.target.closest('tr'); if(!tr) return;
    tr.classList.toggle('is-selected'); updateSelectionCounter();
  });
  const mo = new MutationObserver(()=>updateSelectionCounter());
  mo.observe(tbody, {childList:true});
}
function wireClearSelectionButton(){
  const btn = qs('clearSelectionBtn'); if(!btn) return;
  if(btn.dataset.wired==='1') return; btn.dataset.wired='1';
  btn.addEventListener('click', ()=>{
    const tbody = getTbody(); if(!tbody) return;
    tbody.querySelectorAll('tr.is-selected').forEach(tr=>tr.classList.remove('is-selected'));
    updateSelectionCounter();
  });
  updateSelectionCounter();
}
function updateSelectionCounter(){
  const tbody = getTbody(); const btn = qs('clearSelectionBtn');
  if(!tbody||!btn) return; const n = tbody.querySelectorAll('tr.is-selected').length;
  btn.textContent = `Limpiar selección (${n})`;
}
