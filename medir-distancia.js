
// Medir Distancia — Leaflet control (no cambia colores ni estructuras Supabase)
// Uso: llamar initMeasure(map) después de crear el mapa.
(function(global){
  function formatMeters(m){
    if (m >= 1000) return (m/1000).toFixed(2) + " km";
    return Math.round(m) + " m";
  }

  function initMeasure(map){
    if (!map) return;

    // Estado interno
    let active = false;
    let points = [];
    let line = L.polyline([], {weight: 3, opacity: 0.9}).addTo(map);
    let markers = [];
    let tooltip;
    let ctrlEl;

    function totalDistance(){
      let d = 0;
      for (let i=1;i<points.length;i++){
        d += map.distance(points[i-1], points[i]);
      }
      return d;
    }

    function update(){
      line.setLatLngs(points);
      if (tooltip){
        const d = totalDistance();
        tooltip.setLatLng(points[points.length-1]);
        tooltip.setContent(`<div style="padding:4px 6px;font-size:12px"><b>Total:</b> ${formatMeters(d)}</div>`);
      }
    }

    function clearAll(){
      points = [];
      line.setLatLngs([]);
      markers.forEach(m => map.removeLayer(m));
      markers = [];
      if (tooltip){ map.removeLayer(tooltip); tooltip = null; }
    }

    function toggleActive(){
      if (!active){
        active = true;
        ctrlEl.classList.add('is-on');
        row.style.display = 'block';
        map.getContainer().style.cursor = 'crosshair';
        clearAll();
        map.on('click', onClick);
        map.on('mousemove', onMove);
      } else {
        row.style.display = 'none';
        finish();
      }
    }
    function finish(){
      active = false;
      ctrlEl.classList.remove('is-on');
      map.getContainer().style.cursor = '';
      map.off('click', onClick);
      map.off('mousemove', onMove);
    }

    function onClick(e){
      points.push(e.latlng);
      const mk = L.circleMarker(e.latlng, {radius:5, weight:2, fillOpacity:.9}).addTo(map);
      markers.push(mk);

      if (points.length === 1){
        tooltip = L.tooltip({permanent:true, className:'measure-tip', offset:[8,8]})
          .setLatLng(e.latlng)
          .setContent(`<div style="padding:4px 6px;font-size:12px"><b>Total:</b> 0 m</div>`)
          .addTo(map);
      }
      update();
    }

    function onMove(e){
      if (!active || points.length === 0) return;
      const temp = points.concat([e.latlng]);
      line.setLatLngs(temp);
      if (tooltip){
        let d = 0;
        for (let i=1;i<temp.length;i++){
          d += map.distance(temp[i-1], temp[i]);
        }
        tooltip.setLatLng(e.latlng);
        tooltip.setContent(`<div style="padding:4px 6px;font-size:12px"><b>Total:</b> ${formatMeters(d)}</div>`);
      }
    }

    // Botón de control
    const MeasureControl = L.Control.extend({
      options: { position: 'topleft' },
      onAdd: function () {
        const container = L.DomUtil.create('div', 'leaflet-bar measure-ctrl');
        const btn = L.DomUtil.create('a', '', container);
        btn.href = '#';
        btn.title = 'Medir distancia';
        btn.innerHTML = `<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-label='Medir distancia'><path d='M3 21l18-18'/><path d='M14 7l3 3'/><path d='M11 10l3 3'/><path d='M8 13l3 3'/><path d='M5 16l3 3'/></svg>`;
        btn.style.fontSize = '18px';
        btn.style.lineHeight = '28px';
        btn.style.textAlign = 'center';
        btn.style.width = '28px';
        btn.style.height = '28px';

        const row = L.DomUtil.create('div', 'measure-row', container);
        row.style.display = 'none';
        row.style.padding = '6px';
        row.style.background = 'rgba(0,0,0,.55)';
        row.style.backdropFilter = 'blur(6px)';
        row.style.borderRadius = '8px';
        row.style.marginTop = '6px';

        const info = L.DomUtil.create('span', '', row);
        info.textContent = 'Click para puntos • ESC cancelar • DblClick terminar';
        info.style.fontSize = '11px';
        info.style.color = '#fff';
        info.style.marginRight = '8px';

        const clearBtn = L.DomUtil.create('button', '', row);
        clearBtn.textContent = 'Limpiar';
        clearBtn.style.fontSize = '12px';
        clearBtn.style.padding = '4px 8px';
        clearBtn.style.borderRadius = '6px';
        clearBtn.style.border = '1px solid rgba(255,255,255,.2)';
        clearBtn.style.background = 'transparent';
        clearBtn.style.color = '#fff';
        clearBtn.style.cursor = 'pointer';

        L.DomEvent.disableClickPropagation(container);

        btn.addEventListener('click', (ev)=>{
          ev.preventDefault();
          toggleActive();
            active = true;
            ctrlEl = container;
            container.classList.add('is-on');
            row.style.display = 'block';
            map.getContainer().style.cursor = 'crosshair';
            clearAll();
            map.on('click', onClick);
            map.on('mousemove', onMove);
        });

        clearBtn.addEventListener('click', ()=>{
          clearAll();
          update();
        });

        map.on('dblclick', ()=>{
          if (active){
            finish();
          }
        });

        window.addEventListener('keydown', (e)=>{
          if (e.key && e.key.toLowerCase() === 'm') { e.preventDefault(); toggleActive(); return; }
          if (active && e.key === 'Escape'){
            clearAll();
            finish();
          }
        });

        return container;
      }
    });
    map.addControl(new MeasureControl());
  }

  // Exponer
  global.initMeasure = initMeasure;
})(window);
