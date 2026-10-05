import { escapeHtml, statusBadge, speciesLabel, placeholderPhoto } from '../utils.js';

let state = null;

export function initDashboard(s) {
  state = s;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function humanWhen(dateStr, timeStr) {
  if (!dateStr) return timeStr || '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return `${dateStr} ${timeStr || ''}`.trim();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today - day) / 86400000);
  const hora = timeStr ? ` · ${timeStr}` : '';
  if (diff === 0) return `Hoy${hora}`;
  if (diff === 1) return `Ayer${hora}`;
  if (diff > 1 && diff < 7) return `Hace ${diff} días${hora}`;
  return `${dateStr}${hora}`;
}

export function viewDashboard() {
  const pets = state.getPets();
  const total = pets.length;
  const active = pets.filter(p => p.status === 'Activo').length;
  const lost = pets.filter(p => p.status === 'Perdido').length;
  const userName = escapeHtml((state.user && state.user.name ? state.user.name.split(' ')[0] : 'Administrador'));

  const sorted = [...pets].sort((a, b) => new Date(b.registration_date) - new Date(a.registration_date));
  const latest = sorted.slice(0, 8);
  const recent = state.getHistory().slice(0, 8);

  const summary = total === 0
    ? 'Aún no hay mascotas registradas. Empieza creando la primera ficha.'
    : `Tienes <b>${total}</b> ${total === 1 ? 'mascota registrada' : 'mascotas registradas'} · ${active} activas${lost ? ` · <span style="color:var(--status-lost);font-weight:700;">${lost} perdida${lost === 1 ? '' : 's'}</span>` : ''}.`;

  return `
  <div class="page-head"><div><h1>${greeting()}, ${userName} 🐾</h1><p>${summary}</p></div></div>
  <div class="grid-2 dash-grid">
    <div class="panel">
      <h3>Últimas mascotas <button class="btn btn-ghost btn-sm" data-nav="mascotas">Ver todas →</button></h3>
      ${latest.length ? `<div class="mini-table">
        ${latest.map(p => `
          <div class="mini-row" data-pet="${p.id}">
            <img class="pet-thumb" src="${p.photo || placeholderPhoto()}" alt="">
            <div class="mini-main"><b>${escapeHtml(p.name)}</b><span class="faint">${speciesLabel(p.species)} · N° ${escapeHtml(p.carnet_number || '—')}</span></div>
            <div class="mini-side">${statusBadge(p.status)}<span class="faint mini-date">${escapeHtml(p.registration_date || '')}</span></div>
          </div>`).join('')}
      </div>` : `<div class="empty-state"><div style="font-size:40px;">🐾</div><div><b>Todavía no hay fichas</b><p>Registra tu primera mascota para verla aquí.</p></div></div>`}
    </div>
    <div class="panel">
      <h3>Movimientos en la veterinaria</h3>
      ${recent.length ? recent.map(h => `<div class="activity-row"><span class="dot" style="background:${/perd/i.test(h.action || '') ? 'var(--status-lost)' : /nuev|registr|cre/i.test(h.action || '') ? 'var(--status-active)' : 'var(--text-faint)'}"></span><div><b>${escapeHtml(h.action)}</b> — ${escapeHtml(h.entity)}<div class="faint">${escapeHtml(h.user || '')} · ${humanWhen(h.date, h.time)}</div></div></div>`).join('') : `<p class="faint">Sin movimientos todavía. Cada registro o carnet aparecerá aquí.</p>`}
    </div>
  </div>`;
}

export function drawCharts() {
  // Gráficos eliminados por decisión de diseño — sin operación.
}
