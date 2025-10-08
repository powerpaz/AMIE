
(function () {
  function whenReady(cb){ if (document.readyState==='complete'||document.readyState==='interactive') cb(); else document.addEventListener('DOMContentLoaded', cb); }
  function getMap(){ return window.map || null; }
  function readValById(id){ const el=document.getElementById(id); return el ? (el.value||'').trim() : ''; }
  whenReady(function(){
    const btn=document.getElementById('tp-btn-pin'); if(!btn) return;
    const crossIcon=L.divIcon({ className:'cross-pin', html:"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='18' height='18' stroke='red' stroke-width='3' fill='none' stroke-linecap='round' stroke-linejoin='round'><path d='M4 12h16M12 4v16'/></svg>", iconSize:[18,18], iconAnchor:[9,9] });
    btn.addEventListener('click', function(e){
      const map=getMap(); if(!map||typeof L==='undefined') return;
      e.preventDefault(); e.stopImmediatePropagation();
      const lat=parseFloat(readValById('tp-lat')); const lon=parseFloat(readValById('tp-lon'));
      if(!Number.isFinite(lat)||!Number.isFinite(lon)) return;
      L.marker([lat, lon], {icon: crossIcon}).addTo(map);
    }, true);
  });
})();
