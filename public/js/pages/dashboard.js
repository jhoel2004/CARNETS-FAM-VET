import { iconPaw, iconCard, iconCheck, iconAlert, iconPlus } from '../icons.js';
import { escapeHtml, statCard } from '../utils.js';

let state = null;
let charts = {};

export function initDashboard(s) {
  state = s;
}

export function viewDashboard() {
  const pets = state.getPets();
  const total = pets.length;
  const active = pets.filter(p => p.status === 'Activo').length;
  const lost = pets.filter(p => p.status === 'Perdido').length;
  const inactive = pets.filter(p => p.status === 'Inactivo').length;
  const thisMonth = pets.filter(p => {
    const d = new Date(p.registration_date);
    const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;
  const recent = state.getHistory().slice(0, 6);

  return `
  <div class="page-head"><div><h1>Panel principal</h1><p>Resumen general del sistema de identificación de mascotas.</p></div></div>
  <div class="grid-stats">
    ${statCard('Total de mascotas', total, '#1f7a56', iconPaw)}
    ${statCard('Carnets emitidos', total, '#c99a2e', iconCard)}
    ${statCard('Mascotas activas', active, '#1d5fa8', iconCheck)}
    ${statCard('Reportadas perdidas', lost, '#c1272d', iconAlert)}
    ${statCard('Nuevos este mes', thisMonth, '#6d28d9', iconPlus)}
  </div>
  <div class="grid-2">
    <div class="panel">
      <h3>Distribución de registros (últimos 6 meses)</h3>
      <canvas id="chart-months" height="130"></canvas>
    </div>
    <div class="panel">
      <h3>Por especie</h3>
      <canvas id="chart-species" height="150"></canvas>
    </div>
  </div>
  <div class="grid-2" style="margin-top:16px;">
    <div class="panel">
      <h3>Estado de las mascotas</h3>
      <canvas id="chart-status" height="120"></canvas>
    </div>
    <div class="panel">
      <h3>Actividad reciente</h3>
      ${recent.length ? recent.map(h => `<div class="activity-row"><span class="dot" style="background:var(--green-700)"></span><div><b>${h.action}</b> — ${escapeHtml(h.entity)}<div class="faint">${h.user} · ${h.date} ${h.time}</div></div></div>`).join('') : `<p class="faint">Sin actividad registrada todavía.</p>`}
    </div>
  </div>`;
}

export function drawCharts() {
  Object.values(charts).forEach(c => c && c.destroy());
  const pets = state.getPets();

  const months = [];
  const counts = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(d.toLocaleDateString('es-BO', { month: 'short' }));
    counts.push(pets.filter(p => {
      const pd = new Date(p.registration_date);
      return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear();
    }).length);
  }
  const ctx1 = document.getElementById('chart-months');
  if (ctx1) charts.months = new Chart(ctx1, { type: 'bar', data: { labels: months, datasets: [{ label: 'Registros', data: counts, backgroundColor: '#1f7a56', borderRadius: 6 }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });

  const species = ['perro', 'gato', 'otro'];
  const sc = species.map(s => pets.filter(p => p.species === s).length);
  const ctx2 = document.getElementById('chart-species');
  if (ctx2) charts.species = new Chart(ctx2, { type: 'doughnut', data: { labels: ['Perros', 'Gatos', 'Otros'], datasets: [{ data: sc, backgroundColor: ['#1f7a56', '#c99a2e', '#1d5fa8'] }] }, options: { plugins: { legend: { position: 'bottom' } } } });

  const statuses = ['Activo', 'Inactivo', 'Perdido'];
  const stc = statuses.map(s => pets.filter(p => p.status === s).length);
  const ctx3 = document.getElementById('chart-status');
  if (ctx3) charts.status = new Chart(ctx3, { type: 'bar', data: { labels: statuses, datasets: [{ data: stc, backgroundColor: ['#1f7a56', '#8b93a3', '#c1272d'], borderRadius: 6 }] }, options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } } });
}
