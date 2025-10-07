// Forzar cruz roja SOLO para el botón "Fijar punto" SIN tocar tu app.js
(function () {
  function whenReady(cb) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') cb();
    else document.addEventListener('DOMContentLoaded', cb);
  }

  function getMap() {
    // tu app suele exponer window.map; si no, ajusta aquí
    return window.map || null;
  }

  function readVal(sel) {
    const byData = document.querySelector(`[data-field="${sel}"]`);
    const byId = document.getElementById(sel);
    const el = byData || byId;
    return el ? (el.value || '').trim() : '';
  }

  whenReady(function () {
    const btn = document.getElementById('tp-btn-pin');
    if (!btn) return;

    // Definimos una vez el icono de cruz roja
    const crossIcon = L.divIcon({
      className: 'cross-pin',
      html: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
             width="18" height="18" stroke="red" stroke-width="3" fill="none"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 12h16M12 4v16"/>
        </svg>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });

    // Capturamos el click en FASE DE CAPTURA para cancelar cualquier handler previo
    // Así evitamos que se ponga el pin azul de tu lógica original.
    btn.addEventListener('click', function (e) {
      // Solo actuamos si hay mapa
      const map = getMap();
      if (!map || typeof L === 'undefined') return;

      // Evita handlers existentes (pín azul)
      e.preventDefault();
      e.stopImmediatePropagation();

      // Lee lat/lon desde tus campos actuales (data-field o ids)
      const lat = parseFloat(readVal('latDD'));
      const lon = parseFloat(readVal('lonDD'));
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      // Coloca la CRUZ ROJA
      L.marker([lat, lon], { icon: crossIcon }).addTo(map);
    }, true); // ← true = fase de CAPTURA (importante)
  });
})();
