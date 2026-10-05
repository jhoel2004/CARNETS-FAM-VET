import { escapeHtml, statusBadge, placeholderPhoto, groupHistoryByDay, describeHistory } from '../utils.js';

let state = null;
let charts = {};

export function initDashboard(s) {
  state = s;
}

function speciesShort(s) {
  return { perro: 'Perro', gato: 'Gato', otro: 'Otro' }[s] || s || '—';
}

export function viewDashboard() {
  const pets = state.getPets();
  const total = pets.length;
  const active = pets.filter(p => p.status === 'Activo').length;
  const inactive = pets.filter(p => p.status === 'Inactivo').length;
  const lost = pets.filter(p => p.status === 'Perdido').length;
  const n = new Date();
  const thisMonth = pets.filter(p => {
    const d = new Date(p.registration_date);
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;

  const sorted = [...pets].sort((a, b) => new Date(b.registration_date) - new Date(a.registration_date));
  const latest = sorted.slice(0, 6);
  const groups = groupHistoryByDay(state.getHistory().slice(0, 10));

  const dogs = pets.filter(p => p.species === 'perro').length;
  const cats = pets.filter(p => p.species === 'gato').length;
  const others = total - dogs - cats;
  const pct = (v) => total ? Math.round((v / total) * 100) : 0;

  return `
  <div class="page-head"><div><h1>Panel principal</h1><p>Resumen de registros y carnets</p></div></div>

  <div class="stat-strip">
    <div class="stat-item"><div class="stat-num">${total}</div><div class="stat-lbl">Mascotas registradas</div></div>
    <div class="stat-item"><div class="stat-num">${total}</div><div class="stat-lbl">Carnets emitidos</div></div>
    <div class="stat-item"><div class="stat-num">${active}</div><div class="stat-lbl">Mascotas activas</div></div>
    <div class="stat-item${lost ? ' lost' : ''}"><div class="stat-num">${lost}</div><div class="stat-lbl">Mascotas perdidas</div></div>
    <div class="stat-item"><div class="stat-num">${thisMonth}</div><div class="stat-lbl">Registradas este mes</div></div>
  </div>

  <div class="grid-2 dash-grid">
    <div class="panel">
      <div class="dash-sec-title"><span>Registros recientes</span><button class="btn btn-ghost btn-sm" data-nav="mascotas">Ver todas</button></div>
      ${latest.length ? `<table class="records-table"><tbody>
        ${latest.map(p => `
          <tr data-pet="${p.id}" style="cursor:pointer;">
            <td style="width:44px;"><img class="pet-thumb" src="${p.photo || placeholderPhoto()}" alt=""></td>
            <td><b>${escapeHtml(p.name)}</b><div class="faint" style="font-size:12px;">${escapeHtml(p.owner_name || '—')}</div></td>
            <td class="faint">${speciesShort(p.species)}</td>
            <td class="faint" style="font-family:var(--font-mono); font-size:12px;">${escapeHtml(p.carnet_number || '—')}</td>
            <td>${statusBadge(p.status)}</td>
            <td class="faint" style="font-size:12px; white-space:nowrap;">${escapeHtml(p.registration_date || '')}</td>
          </tr>`).join('')}
      </tbody></table>` : `<div class="empty-state" style="padding:28px 16px;"><div><b>Todavía no hay fichas</b><p>Registra la primera mascota para verla aquí.</p></div></div>`}
    </div>
    <div class="panel">
      <div class="dash-sec-title"><span>Actividad reciente</span><button class="btn btn-ghost btn-sm" data-nav="historial">Historial</button></div>
      ${groups.length ? groups.map(g => `
        <div class="act-day">${escapeHtml(g.label)}</div>
        ${g.items.slice(0, 4).map(h => `
          <div class="act-item">
            <span class="act-time">${escapeHtml((h.time || '').slice(0, 5))}</span>
            <div class="act-body"><b>${escapeHtml(describeHistory(h))}</b><div class="act-obj">${escapeHtml(h.user || '')}</div></div>
          </div>`).join('')}
      `).join('') : `<p class="faint">Sin actividad registrada.</p>`}
    </div>
  </div>

  <div class="grid-2 dash-grid" style="margin-top:20px;">
    <div class="panel">
      <div class="dash-sec-title"><span>Por especie</span></div>
      <div class="donut-wrap">
        <div class="donut-box">
          <canvas id="chart-species" width="132" height="132"></canvas>
          <div class="donut-center"><b>${total}</b><span>${total === 1 ? 'Mascota' : 'Mascotas'}</span></div>
        </div>
        <div class="legend">
          <div class="legend-row"><span class="sw" style="background:#2DB77E;"></span>Perros<b>${dogs}</b><span class="pct">${pct(dogs)}%</span></div>
          <div class="legend-row"><span class="sw" style="background:#C59A38;"></span>Gatos<b>${cats}</b><span class="pct">${pct(cats)}%</span></div>
          <div class="legend-row"><span class="sw" style="background:#4a5751;"></span>Otros<b>${others}</b><span class="pct">${pct(others)}%</span></div>
        </div>
      </div>
    </div>
    <div class="panel">
      <div class="dash-sec-title"><span>Estado actual</span></div>
      <div class="meter-list">
        <div class="meter-row"><span class="m-lbl">Activas</span><div class="meter"><i style="width:${pct(active)}%;"></i></div><b>${active}</b></div>
        <div class="meter-row"><span class="m-lbl">Inactivas</span><div class="meter idle"><i style="width:${pct(inactive)}%;"></i></div><b>${inactive}</b></div>
        <div class="meter-row"><span class="m-lbl">Perdidas</span><div class="meter lost"><i style="width:${pct(lost)}%;"></i></div><b>${lost}</b></div>
      </div>
    </div>
  </div>`;
}

export function drawCharts() {
  Object.values(charts).forEach(c => { try { c && c.destroy(); } catch (_) {} });
  charts = {};
  if (typeof Chart === 'undefined') return;
  const pets = state.getPets();
  const dogs = pets.filter(p => p.species === 'perro').length;
  const cats = pets.filter(p => p.species === 'gato').length;
  const others = pets.length - dogs - cats;
  const ctx = document.getElementById('chart-species');
  if (!ctx) return;
  if (!pets.length) {
    charts.species = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: ['Sin datos'], datasets: [{ data: [1], backgroundColor: ['#22302A'], borderWidth: 0 }] },
      options: { cutout: '72%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }
    });
    return;
  }
  charts.species = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Perros', 'Gatos', 'Otros'],
      datasets: [{ data: [dogs, cats, others], backgroundColor: ['#2DB77E', '#C59A38', '#4a5751'], borderColor: '#101715', borderWidth: 3, hoverOffset: 2 }]
    },
    options: { cutout: '72%', plugins: { legend: { display: false } } }
  });
}
