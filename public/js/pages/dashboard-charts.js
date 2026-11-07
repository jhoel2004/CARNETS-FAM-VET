/* ============================================================
   Dashboard: gráficos (Chart.js 4.4.1) con la paleta de identidad.
   Los colores se leen de variables CSS: cambiar --brand cambia todo.
   ============================================================ */
import { filteredPets, dashboardAnalysis, healthRecordsFor } from './dashboard-data.js';
import { lastMonths, monthShort, ageGroupLabel, petAgeYears } from '../utils.js';

let state = null;
let charts = {};
let C = null;
let chartRange = '12';
let activityMode = 'action';

export function initCharts(s) { state = s; }
export function getChartRange() { return chartRange; }
export function setChartRange(r) {
  const n = Number(r);
  chartRange = (n === 6 || n === 12 || n === 24) ? String(n) : '12';
}
export function getActivityMode() { return activityMode; }
export function setActivityMode(m) { activityMode = m === 'day' ? 'day' : 'action'; }

/* ---------- Paleta desde variables CSS ---------- */
function cssColor(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
function hexToRgba(hex, alpha) {
  const h = String(hex).replace('#', '');
  if (h.length !== 6) return `rgba(20,125,100,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
function palette() {
  const brand = cssColor('--brand', '#147D64');
  const blue = cssColor('--blue', '#4F83CC');
  const grey = cssColor('--text-2', '#718096');
  const border = cssColor('--border', '#E5EAE8');
  const surface = cssColor('--surface', '#FFFFFF');
  C = {
    brand,
    green: cssColor('--brand', '#147D64'),
    green2: cssColor('--brand-2', '#159B78'),
    red: cssColor('--red', '#DC5252'),
    gold: cssColor('--gold', '#D69A32'),
    blue, grey, border, surface,
    greenDim: hexToRgba(cssColor('--brand', '#147D64'), .14),
    goldDim: hexToRgba(cssColor('--gold', '#D69A32'), .15),
    redDim: hexToRgba(cssColor('--red', '#DC5252'), .14),
    blueDim: hexToRgba(blue, .18),
    greyFill: hexToRgba(grey, .30),
  };
  return C;
}

/* ---------- Conteos reales ---------- */
function healthTotals(pets) {
  const today = new Date().toISOString().slice(0, 10);
  const out = { aplicadas: 0, pendientes: 0, vencidas: 0 };
  healthRecordsFor(pets).forEach(r => {
    if (r.type !== 'vacuna' && r.type !== 'desparasitacion') return;
    if (r.applied) out.aplicadas++;
    else if ((r.next_due || r.record_date) && (r.next_due || r.record_date) < today) out.vencidas++;
    else out.pendientes++;
  });
  return out;
}

function speciesCounts(pets) {
  const c = { perro: 0, gato: 0, otro: 0 };
  pets.forEach(p => { if (c[p.species] !== undefined) c[p.species]++; else c.otro++; });
  return c;
}
function ageBuckets(pets) {
  const b = {};
  pets.forEach(p => {
    const label = ageGroupLabel(petAgeYears(p));
    b[label] = (b[label] || 0) + 1;
  });
  // orden estable
  const order = ['0–1 años', '1–3 años', '4–7 años', '8–12 años', '12+ años', 'Sin información'];
  const out = {};
  order.forEach(k => { out[k] = b[k] || 0; });
  return out;
}
function statusCounts(pets) {
  const c = { Activo: 0, Inactivo: 0, Perdido: 0 };
  pets.forEach(p => { if (c[p.status] !== undefined) c[p.status]++; else c.Inactivo++; });
  return [c.Activo, c.Inactivo, c.Perdido];
}
function regCount(pets, key) {
  return pets.filter(p => (p.registration_date || '').slice(0, 7) === key).length;
}

/* ---------- Opciones compartidas ---------- */
function chartDefaults() {
  Chart.defaults.font.family = 'Inter, sans-serif';
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  Chart.defaults.animation.duration = reduce ? 0 : 260;
}
function barOptions(horizontal = false) {
  chartDefaults();
  const o = {
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: {
      x: { beginAtZero: true, ticks: { precision: 0, color: C.grey }, grid: { color: C.border, display: false } },
      y: { beginAtZero: true, ticks: { precision: 0, color: C.grey }, grid: { color: C.border, display: true } },
    },
  };
  if (horizontal) {
    o.indexAxis = 'y';
    o.scales = { x: { beginAtZero: true, ticks: { precision: 0, color: C.grey }, grid: { color: C.border, display: true } }, y: { ticks: { color: C.grey }, grid: { display: false } } };
  }
  return o;
}
function lineOptions(withLegend = false) {
  chartDefaults();
  return {
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { beginAtZero: true, ticks: { precision: 0, color: C.grey, autoSkipPadding: 12 }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { precision: 0, color: C.grey }, grid: { color: C.border } },
    },
  };
}
function donutOptions() {
  chartDefaults();
  return {
    cutout: '66%',
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
  };
}
function legendBottomOptions() {
  chartDefaults();
  return {
    maintainAspectRatio: false,
    plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
    scales: {
      x: { ticks: { color: C.grey, autoSkipPadding: 12 }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { precision: 0, color: C.grey }, grid: { color: C.border } },
    },
  };
}
function donut(id, labels, data, colors) {
  const canvas = document.getElementById(id); if (!canvas) return;
  charts[id] = new Chart(canvas, {
    type: 'doughnut',
    data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderColor: C.surface, borderWidth: 3, hoverOffset: 3 }] },
    options: donutOptions(),
  });
}
function bar(id, labels, data, colors, horizontal = false) {
  const canvas = document.getElementById(id); if (!canvas) return;
  charts[id] = new Chart(canvas, {
    type: 'bar',
    data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderRadius: 6, maxBarThickness: horizontal ? 22 : 34 }] },
    options: barOptions(horizontal),
  });
}

/* ---------- Destruir todo antes de redibujar ---------- */
function destroyAll() {
  Object.values(charts).forEach(c => { try { c && c.destroy(); } catch (_) {} });
  charts = {};
}

/* ----------  Dibujo principal (solo paneles presentes en la pestaña) ---------- */
export function drawCharts() {
  if (typeof Chart === 'undefined') return;
  destroyAll();
  palette();
  const pets = filteredPets();
  const analysis = dashboardAnalysis(pets);

  /* A. Evolución de registros + comparación con el periodo anterior */
  const ctxM = document.getElementById('chart-months');
  if (ctxM) {
    const months = lastMonths(Number(chartRange) || 12);
    const data = months.map(mo => regCount(pets, mo));
    const prev = months.map(mo => {
      const shift = months.length;
      const d = new Date(Number(mo.slice(0, 4)), Number(mo.slice(5, 7)) - 1 - shift, 1);
      const pk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return regCount(pets, pk);
    });
    const datasets = [{
      label: 'Nuevas mascotas', data,
      borderColor: C.green2, backgroundColor: C.greenDim,
      fill: true, tension: .38, borderWidth: 2, pointRadius: 2.5, pointBackgroundColor: C.green2,
    }];
    if (prev.some(v => v > 0)) {
      datasets.push({
        label: 'Periodo anterior', data: prev, borderColor: C.greyFill, borderDash: [5, 4],
        fill: false, tension: .38, borderWidth: 1.6, pointRadius: 0,
      });
    }
    chartDefaults();
    charts.months = new Chart(ctxM, {
      type: 'line',
      data: { labels: months.map(monthShort), datasets },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: datasets.length > 1, position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
        scales: lineOptions().scales,
      },
    });
  }

  /* B. Estados de registro */
  const ctxS = document.getElementById('chart-status');
  if (ctxS) donut('chart-status', ['Activas', 'Inactivas', 'Perdidas'], statusCounts(pets), [C.green, C.grey, C.red]);

  /* C. Distribución por especie */
  const counts = speciesCounts(pets);
  const ctxSp = document.getElementById('chart-species');
  if (ctxSp) donut('chart-species', ['Perros', 'Gatos', 'Otros'], [counts.perro, counts.gato, counts.otro], [C.green, C.gold, C.grey]);

  /* D. Rangos de edad */
  const ctxAge = document.getElementById('chart-age');
  if (ctxAge) {
    const b = ageBuckets(pets);
    bar('chart-age', Object.keys(b), Object.values(b), C.green, false);
  }

  /* E. Rangos de peso */
  const ctxW = document.getElementById('chart-weight');
  if (ctxW) bar('chart-weight', Object.keys(analysis.weights), Object.values(analysis.weights), C.blue, false);

  /* F. Vacunación / desparasitación: aplicadas, pendientes, vencidas */
  const ctxH = document.getElementById('chart-health');
  if (ctxH) {
    const t = healthTotals(pets);
    charts.health = new Chart(ctxH, {
      type: 'doughnut',
      data: {
        labels: ['Aplicadas', 'Pendientes', 'Vencidas'],
        datasets: [{ data: [t.aplicadas, t.pendientes, t.vencidas], backgroundColor: [C.green, C.gold, C.red], borderColor: C.surface, borderWidth: 3, hoverOffset: 3 }],
      },
      options: donutOptions(),
    });
  }

  /* F2. Evolución mensual de vacunación/desparasitación */
  const ctxHM = document.getElementById('chart-health-months');
  if (ctxHM) {
    const keys = analysis.healthMonths.keys;
    charts.healthMonths = new Chart(ctxHM, {
      type: 'line',
      data: {
        labels: keys.map(monthShort),
        datasets: [
          { label: 'Aplicadas', data: keys.map(k => analysis.healthMonths.data[k].aplicadas), borderColor: C.green2, backgroundColor: C.greenDim, fill: true, tension: .38, borderWidth: 2, pointRadius: 2.5 },
          { label: 'Pendientes', data: keys.map(k => analysis.healthMonths.data[k].pendientes), borderColor: C.gold, backgroundColor: C.goldDim, fill: false, tension: .38, borderWidth: 2, pointRadius: 2.5 },
          { label: 'Vencidas', data: keys.map(k => analysis.healthMonths.data[k].vencidas), borderColor: C.red, backgroundColor: C.redDim, fill: false, tension: .38, borderWidth: 2, pointRadius: 2.5 },
        ],
      },
      options: legendBottomOptions(),
    });
  }

  /* Vacunas más registradas (Salud) */
  const ctxV = document.getElementById('chart-vaccines');
  if (ctxV) bar('chart-vaccines', analysis.vaccineRank.map(x => x[0]), analysis.vaccineRank.map(x => x[1]), C.blue, true);

  /* Enfermedades crónicas (Salud) */
  const ctxCond = document.getElementById('chart-conditions');
  if (ctxCond && analysis.conditions.length) {
    donut('chart-conditions', analysis.conditions.map(x => x[0]), analysis.conditions.map(x => x[1]), [C.red, C.gold, C.green, C.blue, C.grey]);
  }

  /* G. Distribución geográfica (Territorio) */
  const ctxCi = document.getElementById('chart-cities');
  if (ctxCi) bar('chart-cities', analysis.cities.map(x => x[0]), analysis.cities.map(x => x[1]), C.gold, true);

  /* H. Cobertura de información (Alertas) */
  const ctxCov = document.getElementById('chart-coverage');
  if (ctxCov && pets.length) {
    const total = Math.max(1, pets.length);
    const labels = Object.keys(analysis.quality);
    const values = Object.values(analysis.quality).map(v => Math.round((v / total) * 100));
    chartDefaults();
    charts.coverage = new Chart(ctxCov, {
      type: 'bar',
      data: { labels, datasets: [{ label: '% de fichas', data: values, backgroundColor: C.green2, borderRadius: 6, maxBarThickness: 18 }] },
      options: {
        indexAxis: 'y',
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.parsed.x}% (${Object.values(analysis.quality)[c.dataIndex]} de ${pets.length})` } } },
        scales: { x: { min: 0, max: 100, ticks: { callback: v => v + '%', color: C.grey }, grid: { color: C.border } }, y: { ticks: { color: C.grey }, grid: { display: false } } },
      },
    });
  }

  /* Sexo del padrón (Padrón) */
  const ctxSex = document.getElementById('chart-sex');
  if (ctxSex) {
    const males = pets.filter(p => p.sex === 'Macho').length;
    const females = pets.filter(p => p.sex === 'Hembra').length;
    const nd = pets.length - males - females;
    donut('chart-sex', ['Machos', 'Hembras', 'Sin registrar'], [males, females, nd], [C.green, C.gold, C.grey]);
  }

  renderActivityChart();
}

/* ---------- Gráfico de actividad (con modo conmutable) ---------- */
export function renderActivityChart() {
  const canvas = document.getElementById('chart-activity');
  if (!canvas || typeof Chart === 'undefined') return;
  if (charts.activity) { try { charts.activity.destroy(); } catch (_) { } charts.activity = null; }
  palette();
  const analysis = dashboardAnalysis(filteredPets());
  if (activityMode === 'day') {
    charts.activity = new Chart(canvas, {
      type: 'line',
      data: {
        labels: analysis.dailyActivity.map(x => `${Number(x[0].slice(8))}/${Number(x[0].slice(5, 7))}`),
        datasets: [{ label: 'Acciones por día', data: analysis.dailyActivity.map(x => x[1]), borderColor: C.gold, backgroundColor: C.goldDim, fill: true, tension: .35, borderWidth: 2, pointRadius: 3, pointBackgroundColor: C.gold }],
      },
      options: { ...legendBottomOptions(), scales: { x: { ticks: { color: C.grey }, grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0, color: C.grey }, grid: { color: C.border } } } },
    });
  } else {
    charts.activity = new Chart(canvas, {
      type: 'bar',
      data: { labels: Object.keys(analysis.actionGroups), datasets: [{ data: Object.values(analysis.actionGroups), backgroundColor: C.green, borderRadius: 6, maxBarThickness: 32 }] },
      options: barOptions(false),
    });
  }
}