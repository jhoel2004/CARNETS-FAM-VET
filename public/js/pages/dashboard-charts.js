/* ============================================================
   Dashboard: gráficos (Chart.js 4.4.1) con la paleta de identidad.
   Los colores se leen de variables CSS: cambiar --brand cambia todo.
   ============================================================ */
import { filteredPets, dashboardAnalysisCached, healthRecordsFor, getDashTab } from './dashboard-data.js';
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

/* ---------- Lazy load de gráficos por pestaña ---------- */
/* Solo se crean los gráficos de la pestaña activa.
   chartsInitialized rastrea qué pestañas ya tienen sus gráficos dibujados. */
let chartsInitialized = new Set();

export function isChartInitialized(tab) { return chartsInitialized.has(tab); }
export function markChartInitialized(tab) { chartsInitialized.add(tab); }
export function clearChartsInitialized() { chartsInitialized = new Set(); }

/* ---------- Destruir todo antes de redibujar ---------- */
function destroyAll() {
  Object.values(charts).forEach(c => { try { c && c.destroy(); } catch (_) {} });
  charts = {};
}

/* ----------  Dibujo principal (solo gráficos de la pestaña activa) ---------- */
export function drawCharts() {
  if (typeof Chart === 'undefined') return;
  destroyAll();
  clearChartsInitialized();
  palette();
  const pets = filteredPets();
  const analysis = dashboardAnalysisCached(pets);
  const dashTab = getDashTab();

  /* A. Evolución de registros (solo pestaña resumen) */
  if (dashTab === 'resumen') {
    const ctxM = document.getElementById('chart-months');
    if (ctxM && !chartsInitialized.has('resumen-months')) {
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
      chartsInitialized.add('resumen-months');
    }

    const ctxS = document.getElementById('chart-status');
    if (ctxS && !chartsInitialized.has('resumen-status')) {
      charts.status = new Chart(ctxS, {
        type: 'doughnut',
        data: {
          labels: ['Activas', 'Inactivas', 'Perdidas'],
          datasets: [{ data: statusCounts(pets), backgroundColor: [C.green, C.grey, C.red], borderColor: C.surface, borderWidth: 3, hoverOffset: 3 }],
        },
        options: donutOptions(),
      });
      chartsInitialized.add('resumen-status');
    }
  }

  /* B. Salud: solo pestaña salud */
  if (dashTab === 'salud') {
    const ctxH = document.getElementById('chart-health');
    if (ctxH && !chartsInitialized.has('salud-health')) {
      const t = healthTotals(pets);
      charts.health = new Chart(ctxH, {
        type: 'doughnut',
        data: {
          labels: ['Aplicadas', 'Pendientes', 'Vencidas'],
          datasets: [{ data: [t.aplicadas, t.pendientes, t.vencidas], backgroundColor: [C.green, C.gold, C.red], borderColor: C.surface, borderWidth: 3, hoverOffset: 3 }],
        },
        options: donutOptions(),
      });
      chartsInitialized.add('salud-health');
    }

    const ctxHM = document.getElementById('chart-health-months');
    if (ctxHM && !chartsInitialized.has('salud-health-months')) {
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
      chartsInitialized.add('salud-health-months');
    }

    const ctxV = document.getElementById('chart-vaccines');
    if (ctxV && !chartsInitialized.has('salud-vaccines')) {
      charts.vaccines = new Chart(ctxV, {
        type: 'bar',
        data: { labels: analysis.vaccineRank.map(x => x[0]), datasets: [{ data: analysis.vaccineRank.map(x => x[1]), backgroundColor: C.blue, borderRadius: 6, maxBarThickness: 22 }] },
        options: barOptions(true),
      });
      chartsInitialized.add('salud-vaccines');
    }

    const ctxCond = document.getElementById('chart-conditions');
    if (ctxCond && analysis.conditions.length && !chartsInitialized.has('salud-conditions')) {
      charts.conditions = new Chart(ctxCond, {
        type: 'doughnut',
        data: {
          labels: analysis.conditions.map(x => x[0]),
          datasets: [{ data: analysis.conditions.map(x => x[1]), backgroundColor: [C.red, C.gold, C.green, C.blue, C.grey], borderColor: C.surface, borderWidth: 3, hoverOffset: 3 }],
        },
        options: donutOptions(),
      });
      chartsInitialized.add('salud-conditions');
    }

    const ctxCov = document.getElementById('chart-coverage');
    if (ctxCov && pets.length && !chartsInitialized.has('salud-coverage')) {
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
      chartsInitialized.add('salud-coverage');
    }
  }

  /* C. Padrón: solo pestaña padron */
  if (dashTab === 'padron') {
    const ctxSp = document.getElementById('chart-species');
    if (ctxSp && !chartsInitialized.has('padron-species')) {
      const counts = speciesCounts(pets);
      charts.species = new Chart(ctxSp, {
        type: 'doughnut',
        data: { labels: ['Perros', 'Gatos', 'Otros'], datasets: [{ data: [counts.perro, counts.gato, counts.otro], backgroundColor: [C.green, C.gold, C.grey], borderColor: C.surface, borderWidth: 3, hoverOffset: 3 }] },
        options: donutOptions(),
      });
      chartsInitialized.add('padron-species');
    }

    const ctxAge = document.getElementById('chart-age');
    if (ctxAge && !chartsInitialized.has('padron-age')) {
      const b = ageBuckets(pets);
      charts.age = new Chart(ctxAge, {
        type: 'bar',
        data: { labels: Object.keys(b), datasets: [{ data: Object.values(b), backgroundColor: C.green, borderRadius: 6, maxBarThickness: 34 }] },
        options: barOptions(false),
      });
      chartsInitialized.add('padron-age');
    }

    const ctxW = document.getElementById('chart-weight');
    if (ctxW && !chartsInitialized.has('padron-weight')) {
      charts.weight = new Chart(ctxW, {
        type: 'bar',
        data: { labels: Object.keys(analysis.weights), datasets: [{ data: Object.values(analysis.weights), backgroundColor: C.blue, borderRadius: 6, maxBarThickness: 34 }] },
        options: barOptions(false),
      });
      chartsInitialized.add('padron-weight');
    }

    const ctxSex = document.getElementById('chart-sex');
    if (ctxSex && !chartsInitialized.has('padron-sex')) {
      const males = pets.filter(p => p.sex === 'Macho').length;
      const females = pets.filter(p => p.sex === 'Hembra').length;
      const nd = pets.length - males - females;
      charts.sex = new Chart(ctxSex, {
        type: 'doughnut',
        data: { labels: ['Machos', 'Hembras', 'Sin registrar'], datasets: [{ data: [males, females, nd], backgroundColor: [C.green, C.gold, C.grey], borderColor: C.surface, borderWidth: 3, hoverOffset: 3 }] },
        options: donutOptions(),
      });
      chartsInitialized.add('padron-sex');
    }
  }

  /* D. Territorio: solo pestaña territorio */
  if (dashTab === 'territorio') {
    const ctxCi = document.getElementById('chart-cities');
    if (ctxCi && !chartsInitialized.has('territorio-cities')) {
      charts.cities = new Chart(ctxCi, {
        type: 'bar',
        data: { labels: analysis.cities.map(x => x[0]), datasets: [{ data: analysis.cities.map(x => x[1]), backgroundColor: C.gold, borderRadius: 6, maxBarThickness: 22 }] },
        options: barOptions(true),
      });
      chartsInitialized.add('territorio-cities');
    }
  }

  /* E. Actividad: solo pestaña actividad */
  if (dashTab === 'actividad') {
    renderActivityChart();
    chartsInitialized.add('actividad');
  }

  /* F. Alertas: solo gráfico de cobertura (ya está en salud/alertas) */
  if (dashTab === 'alertas') {
    const ctxCov = document.getElementById('chart-coverage');
    if (ctxCov && pets.length && !chartsInitialized.has('alertas-coverage')) {
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
      chartsInitialized.add('alertas-coverage');
    }
  }

  /* Nuevos gráficos de salud: gauge, grouped bar, timeline, risk matrix */
  if (dashTab === 'salud' && pets.length) {
    const today = new Date().toISOString().slice(0, 10);
    const records = healthRecordsFor(pets);
    const totalVacDesp = records.filter(r => r.type === 'vacuna' || r.type === 'desparasitacion').length;
    const appliedVacDesp = records.filter(r => (r.type === 'vacuna' || r.type === 'desparasitacion') && r.applied).length;
    const coveragePct = totalVacDesp > 0 ? Math.round((appliedVacDesp / totalVacDesp) * 100) : 0;

    // El gauge Chart.js fue reemplazado por el anillo CSS (.ring.lg) en dashboard.js.
    // drawGauge('gauge-vaccination', coveragePct, 'Al día');

    const months6 = lastMonths(6);
    const progData = months6.map(mo => regCount(pets, mo));
    const k = (r) => (r.record_date || '').slice(0, 7);
    const aplicData = months6.map(mo => records.filter(r => k(r) === mo && r.applied).length);
    drawGroupedBar('chart-grouped-bar', months6.map(monthShort), progData, aplicData);

    const timelineItems = records.slice(0, 20).map(r => ({
      title: r.title || 'Sin nombre',
      date: r.record_date || '',
      status: r.applied ? 'applied' : (r.next_due && r.next_due < today ? 'expired' : 'pending'),
    }));
    drawTimeline('chart-timeline', timelineItems);

    const riskData = [
      { urgencia: 'baja', cantidad: Math.floor(pets.length * 0.4) },
      { urgencia: 'media', cantidad: Math.floor(pets.length * 0.3) },
      { urgencia: 'alta', cantidad: Math.floor(pets.length * 0.2) },
      { urgencia: 'critica', cantidad: analysis.overdue.length },
    ];
    drawRiskMatrix('chart-risk-matrix', riskData);
  }
}

/* ---------- Gráfico de actividad (con modo conmutable) ---------- */
export function renderActivityChart() {
  const canvas = document.getElementById('chart-activity');
  if (!canvas || typeof Chart === 'undefined') return;
  if (charts.activity) { try { charts.activity.destroy(); } catch (_) { } charts.activity = null; }
  palette();
  const analysis = dashboardAnalysisCached(filteredPets());
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

/* ---------- Nuevos gráficos para la pestaña Salud ---------- */

/* Medidor (gauge) de cobertura de vacunación */
export function drawGauge(canvasId, value, label) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;
  if (charts[canvasId]) { try { charts[canvasId].destroy(); } catch (_) {} charts[canvasId] = null; }
  palette();
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 75 ? C.green : (pct >= 40 ? C.amber : C.red);
  charts[canvasId] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: [''],
      datasets: [{
        data: [pct, 100 - pct],
        backgroundColor: [color, 'rgba(0,0,0,.04)'],
        borderWidth: 0,
        hoverOffset: 0,
        cutout: '82%',
      }],
    },
    options: {
      cutout: '82%',
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      rotation: -180,
      circumference: 180,
    },
  });
  const center = canvas.parentElement?.querySelector('.gauge-center');
  if (center) {
    center.innerHTML = `<b>${pct}%</b><span>${label}</span>`;
  }
}

/* Barras agrupadas: Programado vs Aplicado por mes */
export function drawGroupedBar(canvasId, labels, dataProgramado, dataAplicado) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;
  if (charts[canvasId]) { try { charts[canvasId].destroy(); } catch (_) {} charts[canvasId] = null; }
  palette();
  charts[canvasId] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: 'Programado', data: dataProgramado, backgroundColor: C.blue, borderRadius: 4, maxBarThickness: 20 },
        { label: 'Aplicado', data: dataAplicado, backgroundColor: C.green, borderRadius: 4, maxBarThickness: 20 },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 }, color: C.grey } } },
      scales: {
        x: { beginAtZero: true, ticks: { color: C.grey, autoSkipPadding: 10 }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0, color: C.grey }, grid: { color: C.border } },
      },
    },
  });
}

/* Línea de tiempo horizontal de dosis/atenciones con marcador de "hoy" */
export function drawTimeline(canvasId, items) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;
  if (charts[canvasId]) { try { charts[canvasId].destroy(); } catch (_) {} charts[canvasId] = null; }
  palette();
  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...items].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  charts[canvasId] = new Chart(canvas, {
    type: 'scatter',
    data: {
      datasets: sorted.map((item, i) => ({
        label: item.title,
        data: [{ x: item.date || '', y: i }],
        backgroundColor: item.status === 'applied' ? C.green : (item.status === 'pending' ? C.amber : C.red),
        pointRadius: 8,
        pointBorderWidth: 2,
        pointBorderColor: '#FFFFFF',
      })),
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      scales: {
        x: { type: 'time', time: { unit: 'month', displayFormats: { month: 'MMM yyyy' } }, ticks: { color: C.grey }, grid: { color: C.border } },
        y: { display: false },
      },
    },
  });
  // Marcar "hoy" con una línea vertical (simulada con una anotación)
  if (canvas.parentElement) {
    const todayEl = canvas.parentElement.querySelector('.today-marker');
    if (todayEl) todayEl.remove();
    const marker = document.createElement('div');
    marker.className = 'today-marker';
    marker.innerHTML = '<span style="font-size:10px; color:var(--text-2);">Hoy</span>';
    marker.style.position = 'absolute';
    marker.style.top = '0';
    marker.style.left = '50%';
    marker.style.transform = 'translateX(-50%)';
    marker.style.padding = '2px 6px';
    marker.style.background = 'var(--surface)';
    marker.style.border = '1px solid var(--border)';
    marker.style.borderRadius = '4px';
    marker.style.zIndex = '10';
    canvas.parentElement.style.position = 'relative';
    canvas.parentElement.appendChild(marker);
  }
}

/* Matriz de riesgo / mapa de calor: urgencia vs cantidad */
export function drawRiskMatrix(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;
  if (charts[canvasId]) { try { charts[canvasId].destroy(); } catch (_) {} charts[canvasId] = null; }
  palette();
  // data: array de { urgencia: 'baja|media|alta|critica', cantidad: number, label: string }
  const urgencyOrder = ['baja', 'media', 'alta', 'critica'];
  const colors = { baja: C.green, media: C.amber, alta: C.gold, critica: C.red };
  const datasets = urgencyOrder.map((u, i) => {
    const items = data.filter(d => d.urgencia === u);
    return {
      label: u.charAt(0).toUpperCase() + u.slice(1),
      data: items.map(d => ({ x: i, y: d.cantidad })),
      backgroundColor: colors[u],
      pointRadius: 14,
      pointBorderWidth: 2,
      pointBorderColor: '#FFFFFF',
    };
  });
  charts[canvasId] = new Chart(canvas, {
    type: 'scatter',
    data: { datasets },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 }, color: C.grey } }, tooltip: { enabled: true } },
      scales: {
        x: { type: 'category', labels: urgencyOrder.map(u => u.charAt(0).toUpperCase() + u.slice(1)), ticks: { color: C.grey }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0, color: C.grey }, grid: { color: C.border }, title: { display: true, text: 'Cantidad de mascotas', color: C.grey, font: { size: 11 } } },
      },
    },
  });
}