// ==================== Selección de filas + botón Limpiar ====================

/**
 * Conecta la tabla para alternar selección con click.
 * Llamar después de pintar el <tbody>.
 */
export function wireTableSelection() {
  const tbody = document.getElementById('tblBody');
  if (!tbody) return;

  // Evitar doble enlace
  if (tbody.dataset.wired === '1') return;
  tbody.dataset.wired = '1';

  // Delegación de eventos
  tbody.addEventListener('click', (ev) => {
    const tr = ev.target.closest('tr');
    if (!tr) return;
    tr.classList.toggle('is-selected');
    updateSelectionCounter();
  });
}

/** Cuenta filas seleccionadas y actualiza el texto del botón */
function updateSelectionCounter() {
  const tbody = document.getElementById('tblBody');
  const btn = document.getElementById('clearSelectionBtn');
  if (!tbody || !btn) return;
  const count = tbody.querySelectorAll('tr.is-selected').length;
  btn.textContent = `Limpiar selección (${count})`;
}

/** Limpia selección de todas las filas */
export function clearSelection() {
  const tbody = document.getElementById('tblBody');
  if (!tbody) return;
  tbody.querySelectorAll('tr.is-selected').forEach(tr => tr.classList.remove('is-selected'));
  updateSelectionCounter();
}

/** Enlaza botón limpiar */
function wireClearButton() {
  const btn = document.getElementById('clearSelectionBtn');
  if (!btn) return;
  if (btn.dataset.wired === '1') return;
  btn.dataset.wired = '1';
  btn.addEventListener('click', clearSelection);
}

// ==================== Inicialización mínima ====================
document.addEventListener('DOMContentLoaded', () => {
  wireClearButton();
  wireTableSelection(); // si ya hay filas iniciales

  // Si tú repintas la tabla tras filtros/paginación, recuerda:
  // 1) reinyectar <tbody id="tblBody">...</tbody>
  // 2) llamar wireTableSelection();
  // 3) llamar updateSelectionCounter();
});

// ==================== EJEMPLO de render (borra si ya tienes uno) ====================
// function renderTabla(data){
//   const tbody = document.getElementById('tblBody');
//   tbody.innerHTML = data.map(r => `
//     <tr>
//       <td>${r.AMIE}</td>
//       <td>${r.Nombre}</td>
//       <td>${r.Tipo}</td>
//       <td>${r.Sostenimiento}</td>
//       <td>${r.Provincia}</td>
//       <td>${r.Cantón}</td>
//       <td>${r.Parroquia}</td>
//     </tr>
//   `).join('');
//   wireTableSelection();
//   updateSelectionCounter();
// }
