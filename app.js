// table-selection.js
// Maneja selección de filas y el botón "Limpiar selección" SIN modificar tu app.js

function getTbody(){
  return document.getElementById('tblBody') || document.querySelector('#tbl tbody');
}

function updateSelectionCounter(){
  const tbody = getTbody();
  const btn = document.getElementById('clearSelectionBtn');
  if (!tbody || !btn) return;
  const count = tbody.querySelectorAll('tr.is-selected').length;
  btn.textContent = `Limpiar selección (${count})`;
}

function wireTableSelection(){
  const tbody = getTbody();
  if (!tbody) return;

  // No duplicar
  if (tbody.dataset.wired === '1') return;
  tbody.dataset.wired = '1';

  // Delegación: click en cualquier celda alterna la selección de su fila
  tbody.addEventListener('click', (ev) => {
    const tr = ev.target.closest('tr');
    if (!tr) return;
    tr.classList.toggle('is-selected');
    updateSelectionCounter();
  });

  // Observa cambios de filas (paginación/filtrado) y resetea contador
  const mo = new MutationObserver(() => {
    updateSelectionCounter();
  });
  mo.observe(tbody, {childList:true, subtree:false});
}

function wireClearButton(){
  const btn = document.getElementById('clearSelectionBtn');
  if (!btn) return;
  if (btn.dataset.wired === '1') return;
  btn.dataset.wired = '1';
  btn.addEventListener('click', () => {
    const tbody = getTbody();
    if (!tbody) return;
    tbody.querySelectorAll('tr.is-selected').forEach(tr => tr.classList.remove('is-selected'));
    updateSelectionCounter();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  wireTableSelection();
  wireClearButton();
  updateSelectionCounter();

  // Pequeño "nudge" por si el mapa se renderiza antes del layout final
  // (muchas apps Leaflet escuchan resize y recalculan tamaño)
  setTimeout(() => window.dispatchEvent(new Event('resize')), 200);
});

