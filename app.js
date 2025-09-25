import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = "https://krjwqagkjuzrpxianvnu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandxYWdranV6cnB4aWFudm51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDY4NjEsImV4cCI6MjA3NDMyMjg2MX0.vdIMVgAciBhAweV4CGjEXq-fuo2xRm0qSssl4JhoErQ";
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const TABLE = "instituciones";
let map = L.map("map").setView([-1.8312, -78.1834], 6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 19, attribution: "&copy; OpenStreetMap"}).addTo(map);
let markersLayer = L.layerGroup().addTo(map);

const kpiTotal=document.getElementById("kpiTotal"),kpiMatriz=document.getElementById("kpiMatriz"),
kpiEst=document.getElementById("kpiEst"),kpiSost=document.getElementById("kpiSost");
const provSelect=document.getElementById("provSelect"),cantSelect=document.getElementById("cantSelect"),
parrSelect=document.getElementById("parrSelect"),sostSelect=document.getElementById("sostSelect"),
tipoSelect=document.getElementById("tipoSelect"),amieInput=document.getElementById("amieInput"),
searchBtn=document.getElementById("searchBtn"),clearBtn=document.getElementById("clearBtn"),
tbody=document.querySelector("#tbl tbody");

function applyFilters(q){
  if(provSelect.value) q=q.eq("provincia",provSelect.value);
  if(cantSelect.value) q=q.eq("canton",cantSelect.value);
  if(parrSelect.value) q=q.eq("parroquia",parrSelect.value);
  if(sostSelect.value) q=q.eq("sostenimiento",sostSelect.value);
  if(tipoSelect.value) q=q.eq("tipo",tipoSelect.value);
  return q;
}

async function loadDistinctOptions(){
  const fields=["provincia","canton","parroquia","sostenimiento"];
  for(const f of fields){
    const {data,error}=await supabase.from(TABLE).select(`${f}`).not(f,"is",null).neq(f,"").order(f,{ascending:true}).limit(10000);
    if(error){console.error(error);continue;}
    const selectEl={provincia:provSelect,canton:cantSelect,parroquia:parrSelect,sostenimiento:sostSelect}[f];
    [...new Set((data||[]).map(r=>r[f]))].forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;selectEl.appendChild(o);});
  }
}

async function updateKPIs(){
  let q=supabase.from(TABLE).select("*",{count:"exact",head:true}); q=applyFilters(q); const {count:total}=await q; kpiTotal.textContent=total??"0";
  let qm=supabase.from(TABLE).select("*",{count:"exact",head:true}).eq("tipo","MATRIZ"); qm=applyFilters(qm); const {count:cm}=await qm; kpiMatriz.textContent=cm??"0";
  let qe=supabase.from(TABLE).select("*",{count:"exact",head:true}).eq("tipo","ESTABLECIMIENTO"); qe=applyFilters(qe); const {count:ce}=await qe; kpiEst.textContent=ce??"0";
  let qs=supabase.from(TABLE).select("sostenimiento"); qs=applyFilters(qs); const {data:ds,error:es}=await qs;
  if(!es){const setS=new Set((ds||[]).map(r=>r.sostenimiento).filter(Boolean)); kpiSost.textContent=setS.size.toString();}
}

async function refreshData(){
  let q=supabase.from(TABLE).select("amie,nombre_ie,tipo,sostenimiento,provincia,canton,parroquia,lat,lon").limit(2000); q=applyFilters(q);
  const term=amieInput.value.trim(); if(term){/^[0-9A-Z]+$/.test(term)? q=q.ilike("amie",`%${term}%`): q=q.ilike("nombre_ie",`%${term}%`);}
  const {data,error}=await q; if(error){console.error(error);return;}
  tbody.innerHTML=""; (data||[]).forEach(r=>{const tr=document.createElement("tr"); tr.innerHTML=`<td>${r.amie||""}</td><td>${r.nombre_ie||""}</td><td>${r.tipo||""}</td><td>${r.sostenimiento||""}</td><td>${r.provincia||""}</td><td>${r.canton||""}</td><td>${r.parroquia||""}</td>`; tbody.appendChild(tr);});
  markersLayer.clearLayers();
  (data||[]).filter(r=>typeof r.lat==="number"&&typeof r.lon==="number"&&!Number.isNaN(r.lat)&&!Number.isNaN(r.lon))
    .forEach(r=>{markersLayer.addLayer(L.marker([r.lat,r.lon]).bindPopup(`<b>${r.nombre_ie||""}</b><br>AMIE: ${r.amie||""}`));});
  const pts=[]; markersLayer.eachLayer(l=>pts.push(l.getLatLng())); if(pts.length){const b=L.latLngBounds(pts); map.fitBounds(b.pad(0.2));}
  updateKPIs();
}

searchBtn.addEventListener("click",refreshData);
clearBtn.addEventListener("click",()=>{provSelect.value="";cantSelect.value="";parrSelect.value="";sostSelect.value="";tipoSelect.value="";amieInput.value="";refreshData();});
[provSelect,cantSelect,parrSelect,sostSelect,tipoSelect].forEach(el=>el.addEventListener("change",refreshData));

(async function init(){await loadDistinctOptions(); await refreshData();})();
