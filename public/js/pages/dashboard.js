import { escapeHtml, statusBadge, placeholderPhoto, groupHistoryByDay, describeHistory } from '../utils.js';

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

function speciesShort(s) {
  return { perro: 'Perro', gato: 'Gato', otro: 'Otro' }[s] || s || '—';
}

export function viewDashboard() {
  const pets = state.getPets();
  const total = pets.length;
  const active = pets.filter(p => p.status === 'Activo').length;
  const lost = pets.filter(p => p.status === 'Perdido').length;
  const userName = escapeHtml((state.user && state.user.name ? state.user.name.split(' ')[0] : 'Administrador'));

  const sorted = [...pets].sort((a, b) => new Date(b.registration_date) - new Date(a.registration_date));
  const latest = sorted.slice(0, 6);
  const groups = groupHistoryByDay(state.getHistory().slice(0, 12));

  const summary = total === 0
    ? 'Aún no hay mascotas registradas. Crea la primera ficha para empezar.'
    : `<b>${total}</b> ${total === 1 ? 'mascota registrada' : 'mascotas registradas'} <span class="sep">·</span> <b>${total}</b> ${total === 1 ? 'carnet emitido' : 'carnets emitidos'} <span class="sep">·</span> <b>${active}</b> ${active === 1 ? 'activa' : 'activas'}${lost ? ` <span class="sep">·</span> <span class="lost-n">${lost} ${lost === 1 ? 'perdida' : 'perdidas'}</span>` : ' <span class="sep">·</span> 0 perdidas'}`;

  return `
  <div class="page-head"><div><h1>${greeting()}, ${userName}</h1><p>Resumen de registros y carnets</p><div class="dash-summary">${summary}</div></div></div>
  <div class="grid-2 dash-grid">
    <div class="panel">
      <div class="dash-sec-title"><span><span class="sec-ico">🐾</span>Mascotas recientes</span><button class="btn btn-ghost btn-sm" data-nav="mascotas">Ver todas</button></div>
      ${latest.length ? `<div class="mini-table">
        ${latest.map(p => `
          <div class="mini-row" data-pet="${p.id}">
            <img class="pet-thumb" src="${p.photo || placeholderPhoto()}" alt="">
            <div class="mini-main"><b>${escapeHtml(p.name)}</b><span class="faint">${speciesShort(p.species)} · N° ${escapeHtml(p.carnet_number || '—')}</span></div>
            <div class="mini-side">${statusBadge(p.status)}<span class="faint mini-date">${escapeHtml(p.registration_date || '')}</span></div>
          </div>`).join('')}
      </div>` : `<div class="empty-state" style="padding:28px 16px;"><div style="font-size:32px;">🐾</div><div><b>Todavía no hay fichas</b><p>Registra la primera mascota para verla aquí.</p></div></div>`}
    </div>
    <div class="panel">
      <div class="dash-sec-title"><span><span class="sec-ico">📋</span>Actividad reciente</span></div>
      ${groups.length ? groups.map(g => `
        <div class="act-day">${escapeHtml(g.label)}</div>
        ${g.items.map(h => `
          <div class="act-item">
            <span class="act-time">${escapeHtml((h.time || '').slice(0, 5))}</span>
            <div class="act-body"><b>${escapeHtml(describeHistory(h))}</b><div class="act-user">${escapeHtml(h.user || '')}</div></div>
          </div>`).join('')}
      `).join('') : `<p class="faint">Sin actividad registrada.</p>`}
    </div>
  </div>`;
}

export function drawCharts() {
  // Sin gráficos por decisión de diseño.
}
