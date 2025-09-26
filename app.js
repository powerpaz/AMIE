/* =============== MAPA =============== */
let map, clusterGroup, drawnItems, drawControl;
initMap();

function initMap(){
  map = L.map('map', { zoomControl:true }).setView([-1.8, -78.8], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  clusterGroup = L.markerClusterGroup();
  map.addLayer(clusterGroup);

  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  drawControl = new L.Control.Draw({
    draw: {
      polygon:false, polyline:false, circle:false, marker:false, circlemarker:false,
      rectangle:{ shapeOptions:{ color:'#1DB954' } }
    },
    edit: { featureGroup: drawnItems, edit:false, remove:true }
  });

  map.on(L.Draw.Event.CREATED, (e)=>{
    drawnItems.clearLayers();
    drawnItems.addLayer(e.layer);
  });

  wireCoordsBar();
}

/* =============== BARRA COORDS =============== */
function wireCoordsBar(){
  const bar = document.getElementById('coordsBar');
  if(!bar) return;
  map.on('mousemove', (ev)=>{
    const lat = ev.latlng.lat.toFixed(6);
    const lon = ev.latlng.lng.toFixed(6);
    bar.textContent = `Lat: ${lat}  Lon: ${lon} (click para copiar)`;
  });
  bar.addEventListener('click', ()=>{
    navigator.clipboard?.writeText(bar.textContent.replace(/\s*\(click.*\)$/,''));
    bar.textContent = '¡Copiado!';
    setTimeout(()=>wireCoordsBar(), 800);
  });
}

/* =============== UI BOTONES =============== */
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('toolDropPoint')?.addEventListener('click', ()=>{
    const c = map.getCenter();
    const m = L.marker(c, {draggable:true});
    clusterGroup.addLayer(m);
    map.panTo(c);
  });

  document.getElementById('toolDrawExtent')?.addEventListener('click', ()=>{
    map.addControl(drawControl);
    new L.Draw.Rectangle(map, drawControl.options.draw.rectangle).enable();
  });

  document.getElementById('toolClearTools')?.addEventListener('click', ()=>{
    drawnItems.clearLayers();
    clusterGroup.clearLayers();
  });

  document.getElementById('zoomGo')?.addEventListener('click', ()=>{
    const txt = (document.getElementById('zoomFree')?.value || '').trim();
    const zoom = parseInt(document.getElementById('zoomLevel')?.value || '15', 10);
    const p = parseLatLon(txt);
    if(!p){ alert('Formato inválido. Use "lat, lon"'); return; }
    map.setView([p.lat, p.lon], isFinite(zoom)? zoom : 15);
  });

  document.getElementById('dd2dms')?.addEventListener('click', ()=>{
    const val = (document.getElementById('ddInput')?.value || '').trim();
    const p = parseLatLon(val);
    if(!p){ alert('Ingresa DD como "lat, lon"'); return; }
    const dms = ddPairToDms(p.lat, p.lon);
    const out = document.getElementById('dmsInput');
    if(out) out.value = `${dms.lat}, ${dms.lon}`;
  });

  document.getElementById('dms2dd')?.addEventListener('click', ()=>{
    const val = (document.getElementById('dmsInput')?.value || '').trim();
    const p = parseDmsPair(val);
    if(!p){ alert('Ingresa DMS como: 2°10′15″S, 79°55′20″W'); return; }
    const out = document.getElementById('ddInput');
    if(out) out.value = `${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`;
  });

  document.getElementById('dd2utm')?.addEventListener('click', ()=>{
    const val = (document.getElementById('ddInput')?.value || '').trim();
    const p = parseLatLon(val);
    if(!p){ alert('Ingresa DD como "lat, lon"'); return; }
    const utm = ddToUtm17S(p.lat, p.lon);
    const chip = document.getElementById('utmOut');
    if(chip) chip.textContent = `UTM 17S: E ${Math.round(utm.x)}  N ${Math.round(utm.y)}`;
  });

  wireTableSelection();
  wireClearSelectionButton();

  setTimeout(()=>window.dispatchEvent(new Event('resize')), 200);
});

/* =============== UTILIDADES COORDENADAS =============== */
function parseLatLon(str){
  if(!str) return null;
  const cleaned = str.replace(/[;|]/g, ',').replace(/\s+/g,'');
  const parts = cleaned.split(',');
  if(parts.length !== 2) return null;
  const toNum = s => Number(s.replace(',', '.'));
  const lat = toNum(parts[0]), lon = toNum(parts[1]);
  if(!isFinite(lat) || !isFinite(lon)) return null;
  if(Math.abs(lat)>90 || Math.abs(lon)>180) return null;
  return {lat, lon};
}

function toDMS(dd, isLat){
  const hemi = (isLat ? (dd>=0?'N':'S') : (dd>=0?'E':'W'));
  const v = Math.abs(dd);
  const d = Math.floor(v);
  const mFloat = (v-d)*60;
  const m = Math.floor(mFloat);
  const s = (mFloat - m) * 60;
  return `${d}°${m}′${s.toFixed(2)}″${hemi}`;
}
function ddPairToDms(lat, lon){ return { lat: toDMS(lat, true), lon: toDMS(lon, false) }; }

function parseSingleDMS(dms){
  const s = dms.replace(/\s+/g,'').toUpperCase();
  const re = /(-?\d+)[°º]?(\d+)?['′]?(\d+(?:\.\d+)?)?["″]?([NSEW])?/;
  const m = s.match(re);
  if(!m) return NaN;
  const deg = parseFloat(m[1]||'0'), min = parseFloat(m[2]||'0'), sec = parseFloat(m[3]||'0');
  const hemi = m[4] || null;
  let dd = Math.abs(deg) + (min/60) + (sec/3600);
  if((hemi==='S'||hemi==='W') || /^-/.test(m[1])) dd *= -1;
  return dd;
}
function parseDmsPair(str){
  const parts = str.split(/\s*,\s*/);
  if(parts.length!==2) return null;
  const lat = parseSingleDMS(parts[0]);
  const lon = parseSingleDMS(parts[1]);
  if(!isFinite(lat) || !isFinite(lon)) return null;
  return {lat, lon};
}

function ddToUtm17S(lat, lon){
  const epsg32717 = '+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs +type=crs';
  const wgs84 = '+proj=longlat +datum=WGS84 +no_defs +type=crs';
  const p = proj4(wgs84, epsg32717, [lon, lat]);
  return { x:p[0], y:p[1] };
}

/* =============== TABLA: selección + botón =============== */
function getTbody(){ return document.getElementById('tblBody') || document.querySelector('#tbl tbody'); }

function wireTableSelection(){
  const tbody = getTbody();
  if(!tbody) return;
  if(tbody.dataset.wired==='1') return;
  tbody.dataset.wired='1';

  tbody.addEventListener('click', (ev)=>{
    const tr = ev.target.closest('tr');
    if(!tr) return;
    tr.classList.toggle('is-selected');
    updateSelectionCounter();
  });

  const mo = new MutationObserver(()=>updateSelectionCounter());
  mo.observe(tbody, {childList:true});
}

function wireClearSelectionButton(){
  const btn = document.getElementById('clearSelectionBtn');
  if(!btn) return;
  if(btn.dataset.wired==='1') return;
  btn.dataset.wired='1';
  btn.addEventListener('click', ()=>{
    const tbody = getTbody();
    if(!tbody) return;
    tbody.querySelectorAll('tr.is-selected').forEach(tr=>tr.classList.remove('is-selected'));
    updateSelectionCounter();
  });
  updateSelectionCounter();
}

function updateSelectionCounter(){
  const tbody = getTbody();
  const btn = document.getElementById('clearSelectionBtn');
  if(!tbody || !btn) return;
  const n = tbody.querySelectorAll('tr.is-selected').length;
  btn.textContent = `Limpiar selección (${n})`;
}

/* =============== (Opcional) Demo de filas ===============
const demo = [
  {AMIE:'17H04609', Nombre:'CENTRO DE EDUCACIÓN INICIAL “GROW HAPPY”', Tipo:'MATRIZ', Sostenimiento:'PARTICULAR', Provincia:'PICHINCHA', Canton:'MEJÍA', Parroquia:'MACHACHI'},
  {AMIE:'17H04610', Nombre:'UNIDAD EDUCATIVA “ISRAEL DEL VALLE”',      Tipo:'MATRIZ', Sostenimiento:'PARTICULAR', Provincia:'PICHINCHA', Canton:'RUMIÑAHUI', Parroquia:'SAN RAFAEL'},
];
const tbody = getTbody();
tbody.innerHTML = demo.map(r=>`<tr>
  <td>${r.AMIE}</td><td>${r.Nombre}</td><td>${r.Tipo}</td>
  <td>${r.Sostenimiento}</td><td>${r.Provincia}</td>
  <td>${r.Canton}</td><td>${r.Parroquia}</td>
</tr>`).join('');
updateSelectionCounter();
========================================================== */
