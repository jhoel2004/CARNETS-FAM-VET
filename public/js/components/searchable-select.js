/* ============================================================
   Componente de selector con búsqueda (reutilizable).
   Uso: renderSearchableSelect({ id, name, label, options, value, placeholder, onChange })
   Devuelve HTML string + inicializa eventos vía initSearchableSelect(id).
   Opcional: initSearchableSelect(id, options, onChange, {
     addNew: true, addNewLabel: '+ Agregar nueva…', onAddNew: (texto) => {}
   }) muestra al final del despliegue la acción de alta.
   ============================================================ */
export function renderSearchableSelect({ id, name, label, options = [], value = '', placeholder = 'Buscar...', required = false }) {
  const opts = options.map(o => {
    const v = typeof o === 'string' ? o : o.value;
    const l = typeof o === 'string' ? o : o.label;
    return { v, l };
  });
  const selectedLabel = opts.find(o => o.v === value)?.l || value || '';
  return `
    <div class="field" data-searchable="${id}">
      <label>${label}${required ? ' *' : ''}</label>
      <div class="ss-wrap" id="ss-${id}">
        <input type="text" class="ss-input" id="ss-input-${id}" name="${name}" value="${escapeHtml(selectedLabel)}" placeholder="${escapeHtml(placeholder)}" autocomplete="off" ${required ? 'required' : ''} data-ss-value="${escapeHtml(value)}">
        <input type="hidden" name="${name}_value" id="ss-hidden-${id}" value="${escapeHtml(value)}">
        <div class="ss-dropdown hidden" id="ss-dropdown-${id}">
          <div class="ss-list" id="ss-list-${id}"></div>
        </div>
      </div>
    </div>`;
}

export function initSearchableSelect(id, options, onChange, extra = {}) {
  const input = document.getElementById(`ss-input-${id}`);
  const hidden = document.getElementById(`ss-hidden-${id}`);
  const dropdown = document.getElementById(`ss-dropdown-${id}`);
  const list = document.getElementById(`ss-list-${id}`);
  if (!input || !dropdown || !list) return;

  const opts = options.map(o => (typeof o === 'string' ? { v: o, l: o } : o));
  const addNew = !!extra.addNew;
  const addNewLabel = extra.addNewLabel || '+ Agregar nueva…';
  const onAddNew = extra.onAddNew || null;

  function renderList(filter = '') {
    const f = filter.toLowerCase();
    const filtered = f ? opts.filter(o => o.l.toLowerCase().includes(f)) : opts;
    let html = filtered.map(o => `
      <div class="ss-option ${hidden.value === o.v ? 'selected' : ''}" data-value="${escapeHtml(o.v)}">${escapeHtml(o.l)}</div>
    `).join('');
    if (!filtered.length) html += `<div class="ss-empty">Sin resultados</div>`;
    if (addNew && onAddNew) html += `<div class="ss-add" data-add="1">${escapeHtml(addNewLabel)}</div>`;
    list.innerHTML = html;

    list.querySelectorAll('.ss-option').forEach(el => {
      el.addEventListener('click', () => {
        input.value = el.textContent;
        hidden.value = el.dataset.value;
        dropdown.classList.add('hidden');
        if (onChange) onChange(el.dataset.value);
      });
    });
    list.querySelectorAll('.ss-add').forEach(el => {
      el.addEventListener('click', () => {
        dropdown.classList.add('hidden');
        onAddNew(input.value);
      });
    });
  }

  input.addEventListener('focus', () => {
    renderList(input.value);
    dropdown.classList.remove('hidden');
  });
  input.addEventListener('input', () => {
    hidden.value = '';
    renderList(input.value);
    dropdown.classList.remove('hidden');
  });
  input.addEventListener('blur', () => {
    setTimeout(() => dropdown.classList.add('hidden'), 150);
  });

  // Al re-inicializar (p. ej. cambio de especie) no apilar listeners externos.
  if (dropdown._outsideHandler) document.removeEventListener('click', dropdown._outsideHandler);
  dropdown._outsideHandler = (e) => {
    if (!e.target.closest(`#ss-${id}`)) dropdown.classList.add('hidden');
  };
  document.addEventListener('click', dropdown._outsideHandler);

  // Sync initial hidden value
  const initial = opts.find(o => o.l === input.value);
  if (initial && !hidden.value) hidden.value = initial.v;
}

function escapeHtml(s) {
  return (s || '').toString().replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}
