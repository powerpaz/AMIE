/* ===========================================================
   Geoportal – App principal
   - Mapa Leaflet + MarkerCluster + Draw (extent)
   - Barra de coordenadas (muestra/copia)
   - Herramientas (fijar punto, dibujar extent, limpiar)
   - Conversión DD ⇄ DMS y DD → UTM (EPSG:32717, 17S)
   - Tabla con selección on/off y botón "Limpiar selección (n)"
   =========================================================== */

/* ======================= Mapa ======================= */
import 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

let map, clusterGroup, drawnItems, drawControl;
initMap();

function initMap(){
  // Centro aproximado Ecuador
  map = L.map('map', {
    zoomControl: true
  }).setView([-1.8, -78.8], 6);

  // OSM tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  // Cluster vacío (puedes añadir marcadores luego)
  clusterGroup = L.markerClusterGroup();
  map.addLayer(clusterGroup);

  // Capa para dibujos (extent)
  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  // Draw solo rectángulo
  drawControl = new L.Control.Draw({
    draw: {
      polygon: false, polyline: false, circle: false,
      marker: false, circlemarker: false,
      rectangle: { shapeOptions:{ color: '#1DB954' } }
    },
    edit: { featureGroup: drawnItems, edit: false, remove: true }
  });
  // No lo agrego por defecto; lo activamos con el botón "Extent".
  // map.addControl(drawControl);

  // Eventos Draw
  map.on(L.Draw.Event.CREATED, (e)=>{
    drawnItems.clearLayers();
    drawnItems.addLayer(e.layer);
  });

  // Barra de coordenadas
  wireCoordsBar();
}

/* ======================= Barra de coordenadas ======================= */
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

/* ======================= Herramientas (botones) ======================= */
document.addEventListener('DOMContentLoaded', ()=>{
  // Fijar punto: pone un marcador en el centro del mapa (o última coord ingresada)
  document.getElementById('toolDropPoint')?.addEventListener('click', ()=>{
    const c = map.getCenter();
    const m = L.marker(c, { draggable:true });
    clusterGroup.addLayer(m);
    map.panTo(c);
  });

  // Extent: muestra control Draw para dibujar rectángulo
  document.getElementById('toolDrawExtent')?.addEventListener('click', ()=>{
    // Aparece control de dibujar solo cuando lo necesitas
    map.addControl(drawControl);
    new L.Draw.Rectangle(map, drawControl.options.draw.rectangle).enable();
  });

  // Limpiar: elimina dibujos y marcadores temporales
  document.getElementById('toolClearTools')?.addEventListener('click', ()=>{
    drawnItems.clearLayers();
    clusterGroup.clearLayers();
  });

  // Zoom libre: acepta "lat, lon" con coma o punto
  document.getElementById('zoomGo')?.addEventListener('click', ()=>{
    const txt = (document.getElementById('zoomFree')?.value || '').trim();
    const zoom = parseInt(document.getElementById('zoomLevel')?.value || '15', 10);
    const parsed = parseLatLon(txt);
    if(!parsed){ alert('Formato inválido. Use "lat, lon"'); return; }
    map.setView([parsed.lat, parsed.lon], isFinite(zoom) ? zoom : 15);
  });

  // Conversión DD → DMS
  document.getElementById('dd2dms')?.addEventListener('click', ()=>{
    const val = (document.getElementById('ddInput')?.value || '').trim();
    const parsed = parseLatLon(val);
    if(!parsed){ alert('Ingresa DD como "lat, lon"'); return; }
    const dms = ddPairToDms(parsed.lat, parsed.lon);
    const out = document.getElementById('dmsInput');
    if(out) out.value = `${dms.lat}, ${dms.lon}`;
  });

  // Conversión DMS → DD
  document.getElementById('dms2dd')?.addEventListener('click', ()=>{
    const val = (document.getElementById('dmsInput')?.value || '').trim();
    const parsed = parseDmsPair(val);
    if(!parsed){ alert('Ingresa DMS como: 2°10′15″S, 79°55′20″W'); return; }
    const out = document.getElementById('ddInput');
    if(out) out.value = `${parsed.lat.toFixed(6)}, ${parsed.lon.toFixed(6)}`;
  });

  // Conversión DD → UTM (EPSG:32717)
  document.getElementById('dd2utm')?.addEventListener('click', ()=>{
    const val = (document.getElementById('ddInput')?.value || '').trim();
    const parsed = parseLatLon(val);
    if(!parsed){ alert('Ingresa DD como "lat, lon"'); return; }
    const utm = ddToUtm17S(parsed.lat, parsed.lon);
    const chip = document.getElementById('utmOut');
    if(chip) chip.textContent = `UTM 17S: E ${Math.round(utm.x)}  N ${Math.round(utm.y)}`;
  });

  // Tabla: selección y botón limpiar
  wireTableSelection();
  wireClearSelectionButton();

  // “Nudge” para que Leaflet recalcule tamaño si cambia el layout
  setTimeout(()=>window.dispatchEvent(new Event('resize')), 200);
});

/* ======================= Utilidades coordenadas ======================= */
function parseLatLon(str){
  // Acepta: "-2.17, -79.92" o "-2,17 , -79,92"
  if(!str) return null;
  const cleaned = str.replace(/[;|]/g, ',').replace(/\s+/g,'');
  const parts = cleaned.split(',');
  if(parts.length !== 2) return null;
  const toNum = s => Number(s.replace(',', '.'));
  const lat = toNum(parts[0]), lon = toNum(parts[1]);
  if(!isFinite(lat) || !isFinite(lon)) return null;
  if(Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

function toDMS(dd, isLat){
  const hemi = (isLat ? (dd>=0?'N':'S') : (dd>=0?'E':'W'));
  const v = Math.abs(dd);
  const d = Math.floor(v);
  const mFloat = (v - d) * 60;
  const m = Math.floor(mFloat);
  const s = (mFloat - m) * 60;
  return `${d}°${m}′${s.toFixed(2)}″${hemi}`;
}
function ddPairToDms(lat, lon){
  return { lat: toDMS(lat, true), lon: toDMS(lon, false) };
}

function parseSingleDMS(dms){
  // Ej: 2°10′15″S  o  79°55′20″W  (admite ', ", º, °, ′, ″)
  const s = dms.replace(/\s+/g,'').toUpperCase();
  const re = /(-?\d+)[°º]?(\d+)?['′]?(\d+(?:\.\d+)?)?["″]?([NSEW])?/;
  const m = s.match(re);
  if(!m) return NaN;
  const deg = parseFloat(m[1]||'0');
  const min = parseFloat(m[2]||'0');
  const sec = parseFloat(m[3]||'0');
  const hemi = m[4] || null;
  let dd = Math.abs(deg) + (min/60) + (sec/3600);
  if((hemi==='S'||hemi==='W') || /^-/.test(m[1])) dd *= -1;
  return dd;
}
function parseDmsPair(str){
  const parts = str.split(/\s*,\s*/);
  if(parts.length !== 2) return null;
  const lat = parseSingleDMS(parts[0]);
  const lon = parseSingleDMS(parts[1]);
  if(!isFinite(lat) || !isFinite(lon)) return null;
  return { lat, lon };
}

// DD -> UTM 17S (EPSG:32717)
function ddToUtm17S(lat, lon){
  // Definición EPSG:32717 (WGS84 / UTM zone 17S)
  const epsg32717 = '+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs +type=crs';
  const wgs84 = '+proj=longlat +datum=WGS84 +no_defs +type=crs';
  // proj4 está disponible por <script> en index.html
  const p = proj4(wgs84, epsg32717, [lon, lat]);
  return { x: p[0], y: p[1] };
}

/* ======================= Tabla: selección y botón ======================= */
function getTbody(){ return document.getElementById('tblBody') || document.querySelector('#tbl tbody'); }

function wireTableSelection(){
  const tbody = getTbody();
  if(!tbody) return;
  if(tbody.dataset.wired === '1') return;
  tbody.dataset.wired = '1';

  // Delegación: click en celdas -> alterna selección de la fila
  tbody.addEventListener('click', (ev)=>{
    const tr = ev.target.closest('tr');
    if(!tr) return;
    tr.classList.toggle('is-selected');
    updateSelectionCounter();
  });

  // Si tu app repinta filas, este observer mantiene el contador al día
  const mo = new MutationObserver(()=> updateSelectionCounter());
  mo.observe(tbody, {childList:true});
}

function wireClearSelectionButton(){
  const btn = document.getElementById('clearSelectionBtn');
  if(!btn) return;
  if(btn.dataset.wired === '1') return;
  btn.dataset.wired = '1';
  btn.addEventListener('click', ()=>{
    const tbody = getTbody();
    if(!tbody) return;
    tbody.querySelectorAll('tr.is-selected').forEach(tr => tr.classList.remove('is-selected'));
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

/* ======================= (Opcional) Render de ejemplo ======================= */
/* 
   Si ya llenas la tabla desde otro módulo, ignora esto.
   Si quieres probar rápido, descomenta y llama a demoRender().
*/
// function demoRender(){
//   const data = [
//     {AMIE:'17H04609', Nombre:'CENTRO DE EDUCACIÓN INICIAL “GROW HAPPY”', Tipo:'MATRIZ', Sostenimiento:'PARTICULAR', Provincia:'PICHINCHA', 'Cantón':'MEJÍA', Parroquia:'MACHACHI'},
//     {AMIE:'17H04610', Nombre:'UNIDAD EDUCATIVA “ISRAEL DEL VALLE”',      Tipo:'MATRIZ', Sostenimiento:'PARTICULAR', Provincia:'PICHINCHA', 'Cantón':'RUMIÑAHUI', Parroquia:'SAN RAFAEL'},
//   ];
//   const tbody = getTbody();
//   tbody.innerHTML = data.map(r=>`<tr>
//     <td>${r.AMIE}</td><td>${r.Nombre}</td><td>${r.Tipo}</td>
//     <td>${r.Sostenimiento}</td><td>${r.Provincia}</td>
//     <td>${r['Cantón']}</td><td>${r.Parroquia}</td>
//   </tr>`).join('');
//   updateSelectionCounter();
// }
// demoRender();
