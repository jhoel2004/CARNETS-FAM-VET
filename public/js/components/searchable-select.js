/* ============================================================
   Componente de selector con búsqueda (reutilizable).
   Uso: renderSearchableSelect({ id, name, label, options, value, placeholder, onChange })
   Devuelve HTML string + inicializa eventos vía initSearchableSelect(id).
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

export function initSearchableSelect(id, options, onChange) {
  const input = document.getElementById(`ss-input-${id}`);
  const hidden = document.getElementById(`ss-hidden-${id}`);
  const dropdown = document.getElementById(`ss-dropdown-${id}`);
  const list = document.getElementById(`ss-list-${id}`);
  if (!input || !dropdown || !list) return;

  const opts = options.map(o => (typeof o === 'string' ? { v: o, l: o } : o));

  function renderList(filter = '') {
    const f = filter.toLowerCase();
    const filtered = f ? opts.filter(o => o.l.toLowerCase().includes(f)) : opts;
    if (!filtered.length) {
      list.innerHTML = `<div class="ss-empty">Sin resultados</div>`;
      return;
    }
    list.innerHTML = filtered.map(o => `
      <div class="ss-option ${hidden.value === o.v ? 'selected' : ''}" data-value="${escapeHtml(o.v)}">${escapeHtml(o.l)}</div>
    `).join('');
    list.querySelectorAll('.ss-option').forEach(el => {
      el.addEventListener('click', () => {
        input.value = el.textContent;
        hidden.value = el.dataset.value;
        dropdown.classList.add('hidden');
        if (onChange) onChange(el.dataset.value);
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
  document.addEventListener('click', (e) => {
    if (!e.target.closest(`#ss-${id}`)) dropdown.classList.add('hidden');
  });

  // Sync initial hidden value
  const initial = opts.find(o => o.l === input.value);
  if (initial && !hidden.value) hidden.value = initial.v;
}

function escapeHtml(s) {
  return (s || '').toString().replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}