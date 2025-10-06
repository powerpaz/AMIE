// ==========================
//  AMIE Geoportal — app.js (v4 robust)
// ==========================
const TABLE = 'instituciones';

let supa = null;
let map, clusterLayer, markers = [];
let provinceLayer = null;

let dataCache = [];
let allCache  = [];
let selection = new Set();

let pageNow = 1, pageSize = 25, pageTotal = 1;

// ---------- util ----------
const $ = (s)=>document.querySelector(s);
const $$=(s)=>Array.from(document.querySelectorAll(s));
const fmt=(v)=> (v ?? '');
const uniq=(a)=>[...new Set(a.filter(x => (x ?? '').toString().trim()!==''))]
  .sort((A,B)=>`${A}`.localeCompare(`${B}`,'es'));
const setStatus=(m)=>{ const el=$('#status'); if(el) el.textContent=m; };
const setSelCount=()=>{ const el=$('#selCount'); if(el) el.textContent=selection.size; };

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
  try{
    if(!supa && window.env?.SUPABASE_URL && window.env?.SUPABASE_KEY && window.supabase){
      supa = window.supabase.createClient(window.env.SUPABASE_URL, window.env.SUPABASE_KEY);
      console.log('✅ Supabase listo');
    }
  }catch(e){ console.error('Supabase init error:', e); }
  return supa;
}
async function ensureColumnsDetected(){
  if(Object.keys(COL).length>0) return;
  const c=getSupabase();
  if(!c) throw new Error('Supabase no configurado');
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
    if(typeof Papa==='undefined'){ reject(new Error('PapaParse no disponible')); return; }
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
      }, error:(err)=>{ reject(err); }
    });
  });
}

// ---------- filtros desde memoria ----------
function fillFiltersFromRows(rows){
  try{
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
  }catch(e){ console.error('fillFilters error:', e); }
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
  if(!select) return;
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
    const res=await fetch('provincias.json', { cache:'no-store' });
    if(!res.ok) throw new Error('provincias.json no encontrada');
    const gj=await res.json();
    if(provinceLayer){ map.removeLayer(provinceLayer); }
    provinceLayer=L.geoJSON(gj,{
      style:{color:'#3b82f6',weight:1.2,fillColor:'#60a5fa',fillOpacity:0.12}
    }).addTo(map);
  }catch(e){ console.warn('No se pudo cargar provincias.json:', e.message); }
}
function highlightProvincia(nombre){
  if(!provinceLayer){return;}
  if(!nombre){ provinceLayer.setStyle({fillOpacity:0.12}); return; }
  provinceLayer.setStyle(f=>({
    color:'#3b82f6', weight:1.2, fillColor:'#60a5fa',
    fillOpacity: (f.properties?.DPA_DESPRO===nombre ? 0.28 : 0.06)
  }));
}

// ---------- mapa + capas base ----------
let baseLayersRef = {};
function initMap(){
  map=L.map('map',{preferCanvas:true, zoomControl:false}).setView([-1.45,-78.2],6);

  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{ attribution:'&copy; OpenStreetMap contributors' });
  const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{ attribution:'Tiles &copy; Esri' });
  const cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{ attribution:'&copy; OpenStreetMap, &copy; CARTO' });

  osm.addTo(map); // base por defecto
  baseLayersRef = { 'OpenStreetMap': osm, 'Satélite (Esri)': esriSat, 'Dark (Carto)': cartoDark };
  L.control.layers(baseLayersRef, null, { position:'topleft', collapsed:true }).addTo(map);
  L.control.zoom({ position:'topleft' }).addTo(map);
  L.control.scale({ imperial:false }).addTo(map);

  clusterLayer=L.markerClusterGroup({chunkedLoading:true, spiderfyOnMaxZoom:true});
  map.addLayer(clusterLayer);

  // repintar tamaño
  window.addEventListener('load', ()=> setTimeout(()=>map.invalidateSize(), 50));
  window.addEventListener('resize', ()=> map.invalidateSize());

  map.on('mousemove', (e)=>{ const el=$('#cursor'); if(el) el.textContent = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`; });

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
  if(!map) return;
  clusterLayer.clearLayers(); markers=[];
  rows.forEach(r=>{
    const m=L.marker([r.lat,r.lon],{icon:blueIcon,title:`${r.AMIE} — ${r.Nombre}`});
    m.bindPopup(`<b>${fmt(r.Nombre)}</b><br>AMIE: ${fmt(r.AMIE)}<br>${fmt(r.Tipo)} — ${fmt(r.Sostenimiento)}<br>${fmt(r.Parroquia)}, ${fmt(r.Canton)}, ${fmt(r.Provincia)}`);
    m.on('click',()=>{ selection.add(r.AMIE); setSelCount(); highlightRow(r.AMIE); });
    clusterLayer.addLayer(m); markers.push({m,r});
  });
  if(fit && rows.length){ const b=L.latLngBounds(rows.map(r=>[r.lat,r.lon])); map.fitBounds(b.pad(0.1)); }
  pageNow=1; pageSize=parseInt($('#pg-size')?.value,10)||25; renderTable(rows);
}

function renderTable(rows){
  pageTotal=Math.max(1,Math.ceil(rows.length/pageSize));
  const now=$('#pg-now'), tot=$('#pg-total'); if(now) now.textContent=pageNow; if(tot) tot.textContent=pageTotal;
  const start=(pageNow-1)*pageSize, end=start+pageSize, pageRows=rows.slice(start,end);
  const tbody=$('#grid tbody'); if(!tbody) return; tbody.innerHTML='';
  pageRows.forEach(r=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${fmt(r.AMIE)}</td><td>${fmt(r.Nombre)}</td><td>${fmt(r.Tipo)}</td><td>${fmt(r.Sostenimiento)}</td><td>${fmt(r.Provincia)}</td><td>${fmt(r.Canton)}</td><td>${fmt(r.Parroquia)}</td>`;
    tr.addEventListener('click',()=>{ selection.add(r.AMIE); setSelCount(); flyTo(r); });
    tbody.appendChild(tr);
  });
}

function flyTo(r){ map.setView([r.lat,r.lon],14); const mk=markers.find(x=>x.r.AMIE===r.AMIE); if(mk) mk.m.openPopup(); highlightRow(r.AMIE); }
function highlightRow(amie){ $$('#grid tbody tr').forEach(tr=>{ const v=tr.children[0]?.textContent; tr.style.background=(v===amie)?'rgba(59,130,246,.18)':''; }); }
function updateKPIs(rows){ const t=$('#kpi-total'), p=$('#kpi-provincias'), k=$('#kpi-tipos'); if(t) t.textContent=rows.length; if(p) p.textContent=uniq(rows.map(r=>r.Provincia)).length; if(k) k.textContent=uniq(rows.map(r=>r.Tipo)).length; }

// ---------- carga inicial ----------
async function loadDataInitial(){
  setStatus('Cargando datos…');
  try{
    const {rows,total}=await fetchAllFromSupabase({},1000,20000);
    allCache  = rows.slice(); dataCache = rows.slice();
    updateKPIs(rows); drawAll(rows,true); fillFiltersFromRows(allCache);
    setStatus(`Listo. Registros: ${total}`);
  }catch(e){
    console.warn('Supabase falló:', e.message);
    // Si no tienes CSV, quitamos el fallback y dejamos estado claro
    try{
      const {rows,total}=await loadFromCSV('data/instituciones_geo_fixed.csv');
      allCache  = rows.slice(); dataCache = rows.slice();
      updateKPIs(rows); drawAll(rows,true); fillFiltersFromRows(allCache);
      setStatus(`Modo CSV local. Registros: ${total}`);
    }catch(e2){
      console.warn('CSV no disponible:', e2.message);
      updateKPIs([]); drawAll([], false); fillFiltersFromRows([]);
      setStatus('Sin datos (Supabase/CSV). El mapa sigue operativo.');
    }
  }
}

// ---------- eventos ----------
$('#btn-limpiar')?.addEventListener('click', async ()=>{
  $('#f-provincia').value=''; $('#f-canton').value=''; $('#f-parroquia').value='';
  $('#f-sosten').value=''; $('#f-tipo').value=''; $('#q-amie').value=''; $('#q-nombre').value='';
  $('#f-canton').disabled=true; $('#f-parroquia').disabled=true;
  highlightProvincia('');
  fillFiltersFromRows(allCache);
  await doQueryAndDraw();
});
$('#f-provincia')?.addEventListener('change', async (e)=>{
  const prov=e.target.value||''; await updateCantones(prov); await doQueryAndDraw(); highlightProvincia(prov);
});
$('#f-canton')?.addEventListener('change', async (e)=>{
  await updateParroquias($('#f-provincia').value||'', e.target.value||''); await doQueryAndDraw();
});
$('#f-parroquia')?.addEventListener('change', doQueryAndDraw);
$('#f-sosten')?.addEventListener('change', doQueryAndDraw);
$('#f-tipo')?.addEventListener('change', doQueryAndDraw);
$('#btn-buscar')?.addEventListener('click', doQueryAndDraw);
$('#q-amie')?.addEventListener('keyup', (e)=>{ if(e.key==='Enter') doQueryAndDraw(); });
$('#q-nombre')?.addEventListener('keyup', (e)=>{ if(e.key==='Enter') doQueryAndDraw(); });
$('#pg-prev')?.addEventListener('click', ()=>{ if(pageNow>1){ pageNow--; renderTable(dataCache);} });
$('#pg-next')?.addEventListener('click', ()=>{ if(pageNow<pageTotal){ pageNow++; renderTable(dataCache);} });
$('#pg-size')?.addEventListener('change', ()=>{ pageSize=parseInt($('#pg-size').value,10)||25; pageNow=1; renderTable(dataCache); });
$('#btn-clear-selection')?.addEventListener('click', ()=>{ selection.clear(); setSelCount(); });

// ---------- consulta ----------
async function doQueryAndDraw(){
  const filters={
    provincia:$('#f-provincia')?.value||'',
    canton:$('#f-canton')?.value||'',
    parroquia:$('#f-parroquia')?.value||'',
    tipo:$('#f-tipo')?.value||'',
    sostenimiento:$('#f-sosten')?.value||'',
    qAmie:($('#q-amie')?.value||'').trim(),
    qNombre:($('#q-nombre')?.value||'').trim()
  };
  setStatus('Consultando…');
  try{
    const {rows,total}=await fetchAllFromSupabase(filters,1000,20000);
    dataCache=rows; drawAll(rows,true); setStatus(`Consulta OK (${total})`);
  }catch(e){
    setStatus('Error en Supabase (revisa RLS/tabla).'); console.error(e);
  }
}

// ---------- Panel Transformación ----------
function attachTransformTools(){
  try{
    if(!map) return;

    const toNum = (v)=>{ const n=parseFloat(String(v).replace(',', '.')); return Number.isFinite(n)?n:null; };
    const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

    function ddToDms(dd,isLat=true){
      const sign=dd<0?-1:1; const abs=Math.abs(dd);
      let deg=Math.floor(abs), minFloat=(abs-deg)*60, min=Math.floor(minFloat), sec=(minFloat-min)*60;
      if(sec>=59.9999){sec=0;min+=1;} if(min>=60){min=0;deg+=1;}
      deg=sign<0?-deg:deg; if(isLat) deg=clamp(deg,-90,90); else deg=clamp(deg,-180,180);
      return {d:deg,m:min,s:+sec.toFixed(5)};
    }
    function dmsToDd(d,m,s){ const sign=d<0?-1:1; const absD=Math.abs(d); const dd=absD+(Math.abs(m)/60)+(Math.abs(s)/3600); return +(sign*dd).toFixed(8); }

    const utmProj=(zone,hem)=>`+proj=utm +zone=${zone} ${((hem||'S').toUpperCase()==='S')?'+south ':''}+datum=WGS84 +units=m +no_defs`;
    function ddToUtm(lat,lon,zone,hem='S'){
      if(!Number.isFinite(lat)||!Number.isFinite(lon)) return null;
      const pr=utmProj(zone,hem); const p=proj4('EPSG:4326',pr,[lon,lat]);
      return {zone,hem:hem.toUpperCase(),e:+p[0].toFixed(2),n:+p[1].toFixed(2)};
    }
    function utmToDd(zone,hem,e,n){
      const z=parseInt(zone,10); if(!z||!e||!n) return null;
      const pr=utmProj(z,hem); const p=proj4(pr,'EPSG:4326',[e,n]);
      return {lat:+p[1].toFixed(8),lon:+p[0].toFixed(8)};
    }

    const $id=(x)=>document.getElementById(x);
    const el={
      lat:$id('tp-lat'), lon:$id('tp-lon'),
      latD:$id('tp-lat-d'),latM:$id('tp-lat-m'),latS:$id('tp-lat-s'),
      lonD:$id('tp-lon-d'),lonM:$id('tp-lon-m'),lonS:$id('tp-lon-s'),
      // 17S principal
      e17:$id('tp-utm-e-17'), n17:$id('tp-utm-n-17'),
      // 18S alterna
      e18:$id('tp-utm-e-18'), n18:$id('tp-utm-n-18'),
      btnGo:$id('tp-btn-center'),btnPin:$id('tp-btn-pin'),btnCopy:$id('tp-btn-copy')
    };

    let tpMarker=null;
    const setMarker=(lat,lon)=>{
      if(!Number.isFinite(lat)||!Number.isFinite(lon)) return;
      if(!tpMarker){ tpMarker=L.marker([lat,lon]).addTo(map);} else { tpMarker.setLatLng([lat,lon]); }
      tpMarker.bindPopup(`Lat: ${lat.toFixed(6)}<br>Lon: ${lon.toFixed(6)}`).openPopup();
    };

    // DD -> UTM (17S y 18S) + DMS
    function fromDD(){
      const lat=toNum(el.lat.value), lon=toNum(el.lon.value);
      if(!Number.isFinite(lat)||!Number.isFinite(lon)) return;

      const d1=ddToDms(lat,true), d2=ddToDms(lon,false);
      el.latD.value=d1.d; el.latM.value=d1.m; el.latS.value=d1.s;
      el.lonD.value=d2.d; el.lonM.value=d2.m; el.lonS.value=d2.s;

      const u17=ddToUtm(lat,lon,17,'S'); if(u17){ el.e17.value=u17.e; el.n17.value=u17.n; }
      const u18=ddToUtm(lat,lon,18,'S'); if(u18){ el.e18.value=u18.e; el.n18.value=u18.n; }
    }

    // UTM 17S -> DD
    function fromUTM17(){
      const e=toNum(el.e17.value), n=toNum(el.n17.value);
      if(!e||!n) return;
      const dd=utmToDd(17,'S',e,n);
      if(!dd) return;
      el.lat.value=dd.lat; el.lon.value=dd.lon; fromDD();
    }

    // UTM 18S -> DD
    function fromUTM18(){
      const e=toNum(el.e18.value), n=toNum(el.n18.value);
      if(!e||!n) return;
      const dd=utmToDd(18,'S',e,n);
      if(!dd) return;
      el.lat.value=dd.lat; el.lon.value=dd.lon; fromDD();
    }

    // Eventos
    [el.lat,el.lon].forEach(i=>{
      i.addEventListener('change',fromDD);
      i.addEventListener('keyup',e=>{ if(e.key==='Enter') fromDD(); });
    });
    [el.latD,el.latM,el.latS,el.lonD,el.lonM,el.lonS].forEach(i=>{
      i.addEventListener('change',()=>{
        const lat=dmsToDd(toNum(el.latD.value)||0,toNum(el.latM.value)||0,toNum(el.latS.value)||0);
        const lon=dmsToDd(toNum(el.lonD.value)||0,toNum(el.lonM.value)||0,toNum(el.lonS.value)||0);
        el.lat.value=lat; el.lon.value=lon; fromDD();
      });
      i.addEventListener('keyup',e=>{ if(e.key==='Enter') {
        const lat=dmsToDd(toNum(el.latD.value)||0,toNum(el.latM.value)||0,toNum(el.latS.value)||0);
        const lon=dmsToDd(toNum(el.lonD.value)||0,toNum(el.lonM.value)||0,toNum(el.lonS.value)||0);
        el.lat.value=lat; el.lon.value=lon; fromDD();
      }});
    });

    // UTM → DD en ambas filas
    [el.e17, el.n17].forEach(i=>{
      i.addEventListener('change',fromUTM17);
      i.addEventListener('keyup',e=>{ if(e.key==='Enter') fromUTM17(); });
    });
    [el.e18, el.n18].forEach(i=>{
      i.addEventListener('change',fromUTM18);
      i.addEventListener('keyup',e=>{ if(e.key==='Enter') fromUTM18(); });
    });

    el.btnGo.addEventListener('click', ()=>{ const lat=toNum(el.lat.value), lon=toNum(el.lon.value); if(Number.isFinite(lat)&&Number.isFinite(lon)) map.setView([lat,lon],15); });
    el.btnPin.addEventListener('click', ()=>{ const lat=toNum(el.lat.value), lon=toNum(el.lon.value); if(Number.isFinite(lat)&&Number.isFinite(lon)) setMarker(lat,lon); });
    el.btnCopy.addEventListener('click', async ()=>{
      const txt=`DD: ${el.lat.value}, ${el.lon.value} | 17S: E=${el.e17.value} N=${el.n17.value} | 18S: E=${el.e18.value} N=${el.n18.value}`;
      try{ await navigator.clipboard.writeText(txt);}catch{}
    });

    map.on('click',(e)=>{ el.lat.value=+e.latlng.lat.toFixed(8); el.lon.value=+e.latlng.lng.toFixed(8); fromDD(); });

    const c=map.getCenter(); el.lat.value=+c.lat.toFixed(6); el.lon.value=+c.lng.toFixed(6); fromDD();
  }catch(err){ console.error('Transform panel init error:', err); }
}

// ---------- boot ----------
(async function boot(){
  try{
    initMap();               // mapa siempre visible
    attachTransformTools();  // después del mapa
    await loadDataInitial(); // datos (Supabase o CSV si existe)
  }catch(e){
    console.error('Boot error:', e);
    setStatus('Error iniciando la app (ver consola).');
  }
})();
