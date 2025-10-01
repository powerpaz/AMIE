/* ===========================================================
   Geoportal – Interfaz mejorada
   - Mapa Leaflet + MarkerCluster + Draw
   - Calculadora (DD ⇄ DMS, DD → UTM 17S, zoom libre)
   - Tabla con selección on/off, limpiar selección (n)
   - Panel de tabla deslizable (mostrar/ocultar)
   - Conexión Supabase opcional (window.env)
   =========================================================== */

/* ===== Supabase opcional ===== */
const HAS_SB = !!(window.env && window.env.SUPABASE_URL && window.env.SUPABASE_KEY);
const sb = HAS_SB ? window.supabase.createClient(window.env.SUPABASE_URL, window.env.SUPABASE_KEY) : null;
const TABLE = 'instituciones';
const COLS  = 'amie,nombre,tipo,sostenimiento,provincia,canton,parroquia,lat,lon';

/* ===== Estado ===== */
const state = {
  page: 1,
  pageSize: 25,
  total: 0,
  search: '',
  filtros: { provincia:'', canton:'', parroquia:'', sostenimiento:'', tipo:'' },
};

/* ===== Helpers DOM ===== */
const $ = (id)=>document.getElementById(id);

/* ======================= Mapa ======================= */
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

/* ======================= Tabla deslizable ======================= */
document.addEventListener('DOMContentLoaded', ()=>{
  const panel = $('tablePanel');
  const btn   = $('toggleTableBtn');
  if(btn && panel){
    btn.addEventListener('click', ()=>{
      const collapsed = panel.classList.toggle('collapsed');
      panel.setAttribute('aria-hidden', collapsed?'true':'false');
      // Empujar un resize para que Leaflet recalibre
      setTimeout(()=>window.dispatchEvent(new Event('resize')), 200);
    });
  }
});

/* ======================= Calculadora y herramientas ======================= */
document.addEventListener('DOMContentLoaded', ()=>{
  // Fijar punto
  $('toolDropPoint')?.addEventListener('click', ()=>{
    const c = map.getCenter();
    const m = L.marker(c, {draggable:true});
    clusterGroup.addLayer(m);
    map.panTo(c);
  });

  // Extent
  $('toolDrawExtent')?.addEventListener('click', ()=>{
    map.addControl(drawControl);
    new L.Draw.Rectangle(map, drawControl.options.draw.rectangle).enable();
  });

  // Limpiar
  $('toolClearTools')?.addEventListener('click', ()=>{
    drawnItems.clearLayers(); clusterGroup.clearLayers();
  });

  // Zoom libre
  $('zoomGo')?.addEventListener('click', ()=>{
    const txt  = ($('zoomFree')?.value || '').trim();
    const zoom = parseInt($('zoomLevel')?.value || '15', 10);
    const p = parseLatLon(txt);
    if(!p){ alert('Formato inválido. Use "lat, lon"'); return; }
    map.setView([p.lat, p.lon], isFinite(zoom)? zoom : 15);
  });

  // DD → DMS
  $('dd2dms')?.addEventListener('click', ()=>{
    const val = ($('ddInput')?.value || '').trim();
    const p = parseLatLon(val);
    if(!p){ alert('Ingresa DD como "lat, lon"'); return; }
    const dms = ddPairToDms(p.lat, p.lon);
    const out = $('dmsInput'); if(out) out.value = `${dms.lat}, ${dms.lon}`;
  });

  // DMS → DD
  $('dms2dd')?.addEventListener('click', ()=>{
    const val = ($('dmsInput')?.value || '').trim();
    const p = parseDmsPair(val);
    if(!p){ alert('Ingresa DMS como: 2°10′15″S, 79°55′20″W'); return; }
    const out = $('ddInput'); if(out) out.value = `${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`;
  });

  // DD → UTM 17S
  $('dd2utm')?.addEventListener('click', ()=>{
    const val = ($('ddInput')?.value || '').trim();
    const p = parseLatLon(val);
    if(!p){ alert('Ingresa DD como "lat, lon"'); return; }
    const u = ddToUtm17S(p.lat, p.lon);
    const chip = $('utmOut'); if(chip) chip.textContent = `UTM 17S: E ${Math.round(u.x)}  N ${Math.round(u.y)}`;
  });

  // Búsqueda, filtros y paginación
  wireUI();

  // Tabla: selección & botón
  wireTableSelection();
  wireClearSelectionButton();

  // Carga inicial
  initData();

  // Ajuste de tamaño de mapa
  setTimeout(()=>window.dispatchEvent(new Event('resize')), 200);
});

/* ======================= Data – Supabase opcional ======================= */
async function initData(){
  if(HAS_SB){
    await initFilters();
    await loadData();
  }else{
    renderTable([], 0);
  }
}

function buildQuery(){
  let q = sb.from(TABLE).select(COLS, { count:'exact' });
  const f = state.filtros;

  if(f.provincia)      q = q.eq('provincia', f.provincia);
  if(f.canton)         q = q.eq('canton', f.canton);
  if(f.parroquia)      q = q.eq('parroquia', f.parroquia);
  if(f.sostenimiento)  q = q.eq('sostenimiento', f.sostenimiento);
  if(f.tipo)           q = q.eq('tipo', f.tipo);

  const s = state.search.trim();
  if(s) q = q.or(`amie.ilike.%${s}%,nombre.ilike.%${s}%`);

  const from = (state.page - 1) * state.pageSize;
  const to   = from + state.pageSize - 1;
  return q.order('nombre', {ascending:true}).range(from, to);
}

async function loadData(){
  if(!HAS_SB){ renderTable([], 0); return; }
  const { data, count, error } = await buildQuery();
  if(error){ console.error(error.message); renderTable([], 0); return; }
  state.total = count || 0;
  renderTable(data || [], state.total);
  renderMarkers(data || []);
}

async function fetchDistinct(col, extraWhere = {}){
  if(!HAS_SB) return [];
  let q = sb.from(TABLE).select(col).not(col, 'is', null).limit(10000);
  for(const [k,v] of Object.entries(extraWhere)){ if(v) q = q.eq(k, v); }
  const { data, error } = await q;
  if(error){ console.warn('distinct', col, error.message); return []; }
  const set = new Set(data.map(r=>r[col]).filter(Boolean));
  return Array.from(set).sort((a,b)=>String(a).localeCompare(String(b),'es'));
}

async function initFilters(){
  // Provincia
  const provincias = await fetchDistinct('provincia');
  fillSelect($('provSelect'), ['Provincia', ...provincias]);
  // Sostenimiento
  const sost = await fetchDistinct('sostenimiento');
  fillSelect($('sostSelect'), ['Sostenimiento', ...sost]);
  // Cantón & parroquia según provincia
  await updateCantParrOptions();
}
async function updateCantParrOptions(){
  const prov = state.filtros.provincia || '';
  const cant = state.filtros.canton || '';
  const cantones = await fetchDistinct('canton', {provincia: prov});
  fillSelect($('cantSelect'), ['Cantón', ...cantones]);
  const extra = {provincia: prov}; if(cant) extra.canton = cant;
  const parroquias = await fetchDistinct('parroquia', extra);
  fillSelect($('parrSelect'), ['Parroquia', ...parroquias]);
}
function fillSelect(sel, values){
  if(!sel) return;
  const first = values[0];
  sel.innerHTML = ''; sel.appendChild(new Option(first, ''));
  values.slice(1).forEach(v=> sel.appendChild(new Option(String(v), String(v))));
}

/* ======================= Render ======================= */
function renderTable(rows, total){
  const tbody = $('tblBody') || document.querySelector('#tbl tbody');
  const pageInfo = $('pageInfo'); const pageSizeSel = $('pageSize');
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

  const totalPages = Math.max(1, Math.ceil((total||0)/state.pageSize));
  state.page = Math.min(state.page, totalPages);
  if(pageInfo) pageInfo.textContent = `Página ${state.page}/${totalPages}`;
  if(pageSizeSel) pageSizeSel.value = String(state.pageSize);

  wireTableSelection(); updateSelectionCounter();
}

function renderMarkers(rows){
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

/* ======================= UI (búsqueda/filtros/paginación) ======================= */
function wireUI(){
  $('searchBtn')?.addEventListener('click', ()=>{
    state.search = ($('amieInput')?.value || '').trim(); state.page = 1; loadData();
  });

  $('clearFiltersBtn')?.addEventListener('click', async ()=>{
    state.search = ''; if($('amieInput')) $('amieInput').value = '';
    state.filtros = { provincia:'', canton:'', parroquia:'', sostenimiento:'', tipo:'' };
    state.page = 1; await initFilters(); loadData();
  });

  $('provSelect')?.addEventListener('change', async (e)=>{
    state.filtros.provincia = e.target.value || ''; state.filtros.canton=''; state.filtros.parroquia='';
    state.page=1; await updateCantParrOptions(); loadData();
  });
  $('cantSelect')?.addEventListener('change', async (e)=>{
    state.filtros.canton = e.target.value || ''; state.filtros.parroquia='';
    state.page=1; await updateCantParrOptions(); loadData();
  });
  $('parrSelect')?.addEventListener('change', (e)=>{ state.filtros.parroquia = e.target.value || ''; state.page=1; loadData(); });
  $('sostSelect')?.addEventListener('change', (e)=>{ state.filtros.sostenimiento = e.target.value || ''; state.page=1; loadData(); });
  $('tipoSelect')?.addEventListener('change', (e)=>{ state.filtros.tipo = e.target.value || ''; state.page=1; loadData(); });

  $('prevPage')?.addEventListener('click', ()=>{
    if(state.page>1){ state.page--; loadData(); }
  });
  $('nextPage')?.addEventListener('click', ()=>{
    const totalPages = Math.max(1, Math.ceil(state.total/state.pageSize));
    if(state.page<totalPages){ state.page++; loadData(); }
  });
  $('pageSize')?.addEventListener('change', (e)=>{
    state.pageSize = parseInt(e.target.value,10) || 25; state.page=1; loadData();
  });
}

/* ======================= Utilidades coordenadas ======================= */
function wireCoordsBar(){
  const bar = $('coordsBar'); if(!bar) return;
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
  if(Math.abs(lat)>90||Math.abs(lon)>180) return null;
  return {lat, lon};
}
function toDMS(dd, isLat){
  const hemi = (isLat ? (dd>=0?'N':'S') : (dd>=0?'E':'W'));
  const v = Math.abs(dd); const d = Math.floor(v);
  const mFloat=(v-d)*60; const m=Math.floor(mFloat); const s=(mFloat-m)*60;
  return `${d}°${m}′${s.toFixed(2)}″${hemi}`;
}
function ddPairToDms(lat, lon){ return { lat: toDMS(lat, true), lon: toDMS(lon, false) }; }
function parseSingleDMS(dms){
  const s = dms.replace(/\s+/g,'').toUpperCase();
  const re=/(-?\d+)[°º]?(\d+)?['′]?(\d+(?:\.\d+)?)?["″]?([NSEW])?/;
  const m=s.match(re); if(!m) return NaN;
  const deg=+m[1]||0, min=+m[2]||0, sec=parseFloat(m[3]||'0');
  const hemi=m[4]||null; let dd=Math.abs(deg)+(min/60)+(sec/3600);
  if((hemi==='S'||hemi==='W')||/^-/.test(m[1])) dd*=-1; return dd;
}
function parseDmsPair(str){
  const parts=str.split(/\s*,\s*/); if(parts.length!==2) return null;
  const lat=parseSingleDMS(parts[0]); const lon=parseSingleDMS(parts[1]);
  if(!isFinite(lat)||!isFinite(lon)) return null; return {lat, lon};
}
function ddToUtm17S(lat, lon){
  const epsg32717 = '+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs +type=crs';
  const wgs84 = '+proj=longlat +datum=WGS84 +no_defs +type=crs';
  const p = proj4(wgs84, epsg32717, [lon, lat]); return { x:p[0], y:p[1] };
}

/* ======================= Tabla: selección & botón ======================= */
function tbodyEl(){ return $('tblBody') || document.querySelector('#tbl tbody'); }
function wireTableSelection(){
  const tbody = tbodyEl(); if(!tbody) return;
  if(tbody.dataset.wired==='1') return; tbody.dataset.wired='1';
  tbody.addEventListener('click', (ev)=>{
    const tr = ev.target.closest('tr'); if(!tr) return;
    tr.classList.toggle('is-selected'); updateSelectionCounter();
  });
  const mo = new MutationObserver(()=>updateSelectionCounter());
  mo.observe(tbody, {childList:true});
}
function wireClearSelectionButton(){
  const btn = $('clearSelectionBtn'); if(!btn) return;
  if(btn.dataset.wired==='1') return; btn.dataset.wired='1';
  btn.addEventListener('click', ()=>{
    const tbody = tbodyEl(); if(!tbody) return;
    tbody.querySelectorAll('tr.is-selected').forEach(tr=>tr.classList.remove('is-selected'));
    updateSelectionCounter();
  });
  updateSelectionCounter();
}
function updateSelectionCounter(){
  const tbody = tbodyEl(); const btn = $('clearSelectionBtn');
  if(!tbody||!btn) return; const n = tbody.querySelectorAll('tr.is-selected').length;
  btn.textContent = `Limpiar selección (${n})`;
}
