// ==========================
//  AMIE Geoportal — app.js
//  Basemaps (OSM/Satélite/Dark) + Provincias GeoJSON
//  Supabase v2 + autodetección columnas + carga en lotes
//  Filtros poblados desde memoria (todas las provincias)
// ==========================
const TABLE = 'instituciones';

let supa = null;
let map, clusterLayer, markers = [];
let provinceLayer = null;

let dataCache = [];   // datos visibles (tabla + mapa)
let allCache  = [];   // 🔹 universo completo para poblar filtros
let selection = new Set();

let pageNow = 1, pageSize = 25, pageTotal = 1;

// ---------- util ----------
const $ = (s)=>document.querySelector(s);
const $$=(s)=>Array.from(document.querySelectorAll(s));
const fmt=(v)=> (v ?? '');
const uniq=(a)=>[...new Set(a.filter(x => (x ?? '').toString().trim()!==''))]
  .sort((A,B)=>`${A}`.localeCompare(`${B}`,'es'));
const setStatus=(m)=>$('#status').textContent=m;
const setSelCount=()=>$('#selCount').textContent=selection.size;

// ---------- autodetección columnas ----------
const CANDIDATES={
  AMIE:['AMIE','amie'],
  Nombre:['Nombre','nombre'],
  Tipo:['Tipo','tipo'],
  Sostenimiento:['Sostenimiento','sostenimiento'],
  Provincia:['Provincia','provincia'],
  Canton:['Canton','canton','cantón'],
  Parroquia:['Parroquia','parroquia'],
  lat:['lat','Lat','latitude','LAT'],
  lon:['lon','Lon','longitude','LON']
};
const COL={};
const firstKey=(obj, list)=>{for(const k of list) if(k in obj) return k; return list[0];}
function detectColumns(sample){ for(const L in CANDIDATES){ COL[L]=firstKey(sample,CANDIDATES[L]); } console.log('🧭 Column map:',COL); }
const v=(obj,L)=> obj?.[COL[L] ?? CANDIDATES[L][0]];

// ---------- supabase ----------
function getSupabase(){
  if(!supa && window.env?.SUPABASE_URL && window.env?.SUPABASE_KEY && window.supabase){
    supa = window.supabase.createClient(window.env.SUPABASE_URL, window.env.SUPABASE_KEY);
    console.log('✅ Supabase listo');
  }
  return supa;
}
async function ensureColumnsDetected(){
  if(Object.keys(COL).length>0) return;
  const c=getSupabase();
  const probe=await c.from(TABLE).select('*').limit(1);
  if(probe.error) throw probe.error;
  if(probe.data?.length) detectColumns(probe.data[0]);
  else throw new Error('Tabla vacía o sin acceso (RLS).');
}

// ---------- datos ----------
async function fetchAllFromSupabase(filters={}, chunk=1000, cap=20000){
  const c=getSupabase(); if(!c) throw new Error('Supabase no configurado');
  await ensureColumnsDetected();

  const build=()=>{ let q=c.from(TABLE).select('*',{count:'exact'});
    if(filters.provincia)     q=q.eq(COL.Provincia,filters.provincia);
    if(filters.canton)        q=q.eq(COL.Canton,filters.canton);
    if(filters.parroquia)     q=q.eq(COL.Parroquia,filters.parroquia);
    if(filters.tipo)          q=q.eq(COL.Tipo,filters.tipo);
    if(filters.sostenimiento) q=q.eq(COL.Sostenimiento,filters.sostenimiento);
    if(filters.qAmie)         q=q.ilike(COL.AMIE,`%${filters.qAmie}%`);
    if(filters.qNombre)       q=q.ilike(COL.Nombre,`%${filters.qNombre}%`);
    return q;
  };

  let all=[], from=0, to=chunk-1, total=null;
  while(all.length<cap){
    const {data,error,count}=await build().range(from,to);
    if(error) throw error;
    if(total===null) total=count??0;
    const batch=(data??[]).map(r=>({
      AMIE:v(r,'AMIE'), Nombre:v(r,'Nombre'),
      Tipo:v(r,'Tipo'), Sostenimiento:v(r,'Sostenimiento'),
      Provincia:v(r,'Provincia'), Canton:v(r,'Canton'), Parroquia:v(r,'Parroquia'),
      lat:parseFloat(v(r,'lat')), lon:parseFloat(v(r,'lon'))
    })).filter(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lon));
    all.push(...batch);
    if(!data || data.length<chunk) break;
    from+=chunk; to+=chunk;
  }
  return {rows:all, total: total ?? all.length};
}

function loadFromCSV(path){
  return new Promise((resolve,reject)=>{
    Papa.parse(path,{header:true,download:true,
      complete:(res)=>{
        const first=res.data?.[0]||{};
        if(Object.keys(COL).length===0 && Object.keys(first).length) detectColumns(first);
        const rows=res.data.map(r=>({
          AMIE:r[COL.AMIE]??r.AMIE, Nombre:r[COL.Nombre]??r.Nombre,
          Tipo:r[COL.Tipo]??r.Tipo, Sostenimiento:r[COL.Sostenimiento]??r.Sostenimiento,
          Provincia:r[COL.Provincia]??r.Provincia, Canton:r[COL.Canton]??r.Canton,
          Parroquia:r[COL.Parroquia]??r.Parroquia,
          lat:parseFloat(r[COL.lat]??r.lat), lon:parseFloat(r[COL.lon]??r.lon)
        })).filter(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lon));
        resolve({rows,total:rows.length});
      }, error:reject
    });
  });
}

// ---------- filtros desde memoria ----------
function fillFiltersFromRows(rows){
  const provs = uniq(rows.map(r=>r.Provincia));
  const soss  = uniq(rows.map(r=>r.Sostenimiento));
  const tipos = uniq(rows.map(r=>r.Tipo));

  putOptions($('#f-provincia'), ['Provincia', ...provs]);
  putOptions($('#f-sosten'),   ['Sostenimiento', ...soss]);
  putOptions($('#f-tipo'),     ['Tipo', ...tipos]);

  putOptions($('#f-canton'),   ['Cantón']);
  putOptions($('#f-parroquia'),['Parroquia']);
  $('#f-canton').disabled = true;
  $('#f-parroquia').disabled = true;
}

async function updateCantones(provincia) {
  $('#f-canton').disabled = !provincia;
  $('#f-parroquia').disabled = true;
  putOptions($('#f-canton'), ['Cantón']);
  putOptions($('#f-parroquia'), ['Parroquia']);
  if (!provincia) return;

  const cantones = uniq(allCache.filter(r => r.Provincia === provincia).map(r => r.Canton));
  putOptions($('#f-canton'), ['Cantón', ...cantones]);
}

async function updateParroquias(provincia, canton) {
  $('#f-parroquia').disabled = !(provincia && canton);
  putOptions($('#f-parroquia'), ['Parroquia']);
  if (!(provincia && canton)) return;

  const parroqs = uniq(allCache
    .filter(r => r.Provincia === provincia && r.Canton === canton)
    .map(r => r.Parroquia));
  putOptions($('#f-parroquia'), ['Parroquia', ...parroqs]);
}

function putOptions(select, values){
  select.innerHTML='';
  values.forEach(v=>{
    const opt=document.createElement('option');
    opt.value=(['Provincia','Cantón','Parroquia','Tipo','Sostenimiento'].includes(v)?'':v);
    opt.textContent=v; select.appendChild(opt);
  });
}

// ---------- provincias ----------
async function loadProvincias(){
  try{
    const res=await fetch('provincias.json');
    const gj=await res.json();
    if(provinceLayer){ map.removeLayer(provinceLayer); }
    provinceLayer=L.geoJSON(gj,{
      style:{color:'#3b82f6',weight:1.2,fillColor:'#60a5fa',fillOpacity:0.12}
    }).addTo(map);
  }catch(e){ console.warn('No se pudo cargar provincias.json',e); }
}
function highlightProvincia(nombre){
  if(!provinceLayer){return;}
  if(!nombre){
    provinceLayer.setStyle({fillOpacity:0.12});
    return;
  }
  provinceLayer.setStyle(f=>({
    color:'#3b82f6', weight:1.2,
    fillColor:'#60a5fa',
    fillOpacity: (f.properties?.DPA_DESPRO===nombre ? 0.28 : 0.06)
  }));
}

// ---------- mapa + capas base ----------
let baseLayersRef = {};
function initMap(){
  map=L.map('map',{preferCanvas:true, zoomControl:false}).setView([-1.45,-78.2],6);

  // Base layers
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution:'&copy; OpenStreetMap contributors'
  });
  const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{
    attribution:'Tiles &copy; Esri'
  });
  const cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
    attribution:'&copy; OpenStreetMap, &copy; CARTO'
  });

  osm.addTo(map); // default

  baseLayersRef = {
    'OpenStreetMap': osm,
    'Satélite (Esri)': esriSat,
    'Dark (Carto)': cartoDark
  };
  L.control.layers(baseLayersRef, null, { position:'topleft', collapsed:true }).addTo(map);
  L.control.zoom({ position:'topleft' }).addTo(map);
  L.control.scale({ imperial:false }).addTo(map);

  clusterLayer=L.markerClusterGroup({chunkedLoading:true, spiderfyOnMaxZoom:true});
  map.addLayer(clusterLayer);

  map.on('mousemove', (e)=> $('#cursor').textContent = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`);

  loadProvincias();
}

// marker
const blueIcon=new L.Icon({
  iconUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize:[25,41], iconAnchor:[12,41], popupAnchor:[1,-34],
  shadowUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

// pintar todo
function drawAll(rows, fit=false){
  clusterLayer.clearLayers(); markers=[];
  rows.forEach(r=>{
    const m=L.marker([r.lat,r.lon],{icon:blueIcon,title:`${r.AMIE} — ${r.Nombre}`});
    m.bindPopup(`<b>${fmt(r.Nombre)}</b><br>AMIE: ${fmt(r.AMIE)}<br>${fmt(r.Tipo)} — ${fmt(r.Sostenimiento)}<br>${fmt(r.Parroquia)}, ${fmt(r.Canton)}, ${fmt(r.Provincia)}`);
    m.on('click',()=>{ selection.add(r.AMIE); setSelCount(); highlightRow(r.AMIE); });
    clusterLayer.addLayer(m); markers.push({m,r});
  });
  if(fit && rows.length){ const b=L.latLngBounds(rows.map(r=>[r.lat,r.lon])); map.fitBounds(b.pad(0.1)); }
  pageNow=1; pageSize=parseInt($('#pg-size').value,10)||25; renderTable(rows);
}

function renderTable(rows){
  pageTotal=Math.max(1,Math.ceil(rows.length/pageSize));
  $('#pg-now').textContent=pageNow; $('#pg-total').textContent=pageTotal;
  const start=(pageNow-1)*pageSize, end=start+pageSize, pageRows=rows.slice(start,end);
  const tbody=$('#grid tbody'); tbody.innerHTML='';
  pageRows.forEach(r=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${fmt(r.AMIE)}</td><td>${fmt(r.Nombre)}</td><td>${fmt(r.Tipo)}</td><td>${fmt(r.Sostenimiento)}</td><td>${fmt(r.Provincia)}</td><td>${fmt(r.Canton)}</td><td>${fmt(r.Parroquia)}</td>`;
    tr.addEventListener('click',()=>{ selection.add(r.AMIE); setSelCount(); flyTo(r); });
    tbody.appendChild(tr);
  });
}

function flyTo(r){ map.setView([r.lat,r.lon],14); const mk=markers.find(x=>x.r.AMIE===r.AMIE); if(mk) mk.m.openPopup(); highlightRow(r.AMIE); }
function highlightRow(amie){ $$('#grid tbody tr').forEach(tr=>{ const v=tr.children[0]?.textContent; tr.style.background=(v===amie)?'rgba(59,130,246,.18)':''; }); }

function updateKPIs(rows){
  $('#kpi-total').textContent=rows.length;
  $('#kpi-provincias').textContent=uniq(rows.map(r=>r.Provincia)).length;
  $('#kpi-tipos').textContent=uniq(rows.map(r=>r.Tipo)).length;
}

// ---------- carga inicial ----------
async function loadDataInitial(){
  setStatus('Cargando datos...');
  try{
    const {rows,total}=await fetchAllFromSupabase({},1000,20000);
    allCache  = rows.slice();      // 🔹 guarda universo
    dataCache = rows.slice();
    updateKPIs(rows); drawAll(rows,true);
    fillFiltersFromRows(allCache); // 🔹 pobla filtros con TODO
    setStatus(`Listo. Registros: ${total}`);
  }catch(e){
    console.warn('⚠️ Supabase falló, CSV local:',e.message);
    const {rows,total}=await loadFromCSV('data/instituciones_geo_fixed.csv');
    allCache  = rows.slice();
    dataCache = rows.slice();
    updateKPIs(rows); drawAll(rows,true);
    fillFiltersFromRows(allCache);
    setStatus(`Modo CSV local. Registros: ${total}`);
  }
}

// ---------- eventos ----------
$('#btn-limpiar').addEventListener('click', async ()=>{
  $('#f-provincia').value=''; $('#f-canton').value=''; $('#f-parroquia').value='';
  $('#f-sosten').value=''; $('#f-tipo').value='';
  $('#q-amie').value=''; $('#q-nombre').value='';
  $('#f-canton').disabled=true; $('#f-parroquia').disabled=true;
  highlightProvincia('');
  fillFiltersFromRows(allCache);      // 🔹 repobla combos completos
  await doQueryAndDraw();
});

$('#f-provincia').addEventListener('change', async (e)=>{
  const prov=e.target.value||'';
  await updateCantones(prov);
  await doQueryAndDraw();
  highlightProvincia(prov);
});

$('#f-canton').addEventListener('change', async (e)=>{
  await updateParroquias($('#f-provincia').value||'', e.target.value||'');
  await doQueryAndDraw();
});
$('#f-parroquia').addEventListener('change', doQueryAndDraw);
$('#f-sosten').addEventListener('change', doQueryAndDraw);
$('#f-tipo').addEventListener('change', doQueryAndDraw);

$('#btn-buscar').addEventListener('click', doQueryAndDraw);
$('#q-amie').addEventListener('keyup', (e)=>{ if(e.key==='Enter') doQueryAndDraw(); });
$('#q-nombre').addEventListener('keyup', (e)=>{ if(e.key==='Enter') doQueryAndDraw(); });

$('#pg-prev').addEventListener('click', ()=>{ if(pageNow>1){ pageNow--; renderTable(dataCache);} });
$('#pg-next').addEventListener('click', ()=>{ if(pageNow<pageTotal){ pageNow++; renderTable(dataCache);} });
$('#pg-size').addEventListener('change', ()=>{ pageSize=parseInt($('#pg-size').value,10)||25; pageNow=1; renderTable(dataCache); });
$('#btn-clear-selection').addEventListener('click', ()=>{ selection.clear(); setSelCount(); });

// ---------- consulta ----------
async function doQueryAndDraw(){
  const filters={
    provincia:$('#f-provincia').value||'',
    canton:$('#f-canton').value||'',
    parroquia:$('#f-parroquia').value||'',
    tipo:$('#f-tipo').value||'',
    sostenimiento:$('#f-sosten').value||'',
    qAmie:($('#q-amie')?.value||'').trim(),
    qNombre:($('#q-nombre')?.value||'').trim()
  };
  setStatus('Consultando...');
  try{
    const {rows,total}=await fetchAllFromSupabase(filters,1000,20000);
    dataCache=rows; drawAll(rows,true); setStatus(`Consulta OK (${total})`);
  }catch(e){
    setStatus('Error en Supabase (revisa RLS/tabla).'); console.error(e);
  }
}

// ---------- boot ----------
(async function boot(){
  initMap();
  // ya no llenamos filtros vía Supabase distinct; se llenan tras la carga inicial
  await loadDataInitial();
})();
