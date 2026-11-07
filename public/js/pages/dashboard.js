/* ============================================================
   Dashboard: vista, eventos y exportaciones.
   Datos → dashboard-data.js · Gráficos → dashboard-charts.js
   ============================================================ */
import { escapeHtml, statusBadge, placeholderPhoto, groupHistoryByDay, describeHistory, calcDashboardStats, calcHealthStats, pctOf, toast, petAgeYears } from '../utils.js';
import { api } from '../api.js';
import { iconPaw, iconCheckCircle, iconAlert, iconCard, iconPlus, iconActivity, iconUsers, iconChevronRight, iconFileText, iconSyringe, iconUser, iconStethoscope, iconDownload, iconPill, iconHeartbeat } from '../icons.js';
import { openModal, closeModal } from '../components/modal.js';
import { openPetModal, openPetDetail } from './pets.js';
import * as data from './dashboard-data.js';
import * as chartsLib from './dashboard-charts.js';

let state = null;

export function initDashboard(s) {
  state = s;
  data.initDashboardData(s);
  chartsLib.initCharts(s);
}
export function drawCharts() { chartsLib.drawCharts(); }
export function renderActivityChart() { chartsLib.renderActivityChart(); }

/* ---------- helpers de vista ---------- */
function speciesShort(s) {
  return { perro: 'Perro', gato: 'Gato', otro: 'Otro' }[s] || s || '—';
}
function initials(name) {
  return (name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
}
function ageShort(p) {
  const y = petAgeYears(p);
  if (y == null) return '—';
  if (y < 1) return `${Math.max(1, Math.round(y * 12))} m`;
  const yi = Math.floor(y);
  const mi = Math.round((y - yi) * 12);
  return mi > 0 ? `${yi} a ${mi} m` : `${yi} a`;
}
function trendFoot(tr, noun = 'este mes') {
  if (!tr) return '';
  const { cur, prev } = tr;
  if (!cur && !prev) return '';
  if (!prev) return `<div class="kpi-foot">${iconActivity} ${cur} ${noun}</div>`;
  const d = cur - prev;
  const cls = d > 0 ? 'up' : (d < 0 ? 'down' : '');
  const ico = d > 0 ? '▲' : (d < 0 ? '▼' : '—');
  return `<div class="kpi-foot ${cls}">${ico} ${d > 0 ? '+' : ''}${d} vs mes anterior (${prev})</div>`;
}
function emptyChart(icon, msg) {
  return `<div class="chart-box"><div class="chart-empty">${icon}<span>${msg}</span></div></div>`;
}
function donutLegend(rows) {
  return `<div class="legend">
    ${rows.map(r => `<div class="legend-row"><span class="sw" style="background:${r.color}"></span>${r.label}<b>${r.n}</b><span class="pct">${r.pct}%</span></div>`).join('')}
  </div>`;
}

/* ---------- Skeleton ---------- */
function skeleton() {
  const kpis = Array(10).fill('<div class="skel skel-kpi"></div>').join('');
  return `
  <div class="dash-head"><div><h1>Panel principal</h1><p>Resumen general de registros, salud y actividad de FAM J VET</p></div></div>
  <div class="kpi-grid">${kpis}</div>
  <div class="dash12">
    <div class="panel span-8"><div class="skel skel-chart"></div></div>
    <div class="panel span-4"><div class="skel skel-chart"></div></div>
    <div class="panel span-8"><div class="skel skel-row"></div><div class="skel skel-row" style="margin-top:8px;"></div></div>
    <div class="panel span-4"><div class="skel skel-row"></div><div class="skel skel-row" style="margin-top:8px;"></div></div>
  </div>`;
}

/* ---------- Cabecera: acciones rápidas ---------- */
function quickActionsHtml() {
  const actions = [
    ['new-pet', iconPlus, 'Registrar mascota', 'primary'],
    ['emit-card', iconCard, 'Emitir carnet', 'soft'],
    ['new-vaccine', iconSyringe, 'Registrar vacunación', 'soft'],
    ['report', iconFileText, 'Generar reporte', 'outline'],
  ];
  return `<div class="dash-actions">
    ${actions.map(([act, ico, label, cls]) => `<button class="btn ${cls === 'primary' ? 'btn-primary' : cls === 'soft' ? 'btn-soft' : 'btn-outline'}" data-quick="${act}">${ico} ${label}</button>`).join('')}
  </div>`;
}

/* ---------- Filtros ---------- */
function filtersHtml(allPets, pets) {
  const draft = data.getDraft();
  const cities = [...new Set(allPets.map(p => p.owner_city).filter(Boolean))].sort();
  const sel = (k, current, opts) => opts.map(([v, l]) => `<option value="${escapeHtml(v)}" ${current === v ? 'selected' : ''}>${l}</option>`).join('');
  return `
  <div class="dfilters">
    <div class="df-meta"><b>Selección</b><span>${pets.length} de ${allPets.length} mascotas · se aplican al pulsar "Aplicar filtros"</span></div>
    <div class="df-field"><label>Periodo</label><select data-dfilter="period">
      ${sel('period', draft.period, [['all', 'Todo el historial'], ['30', 'Últimos 30 días'], ['90', 'Últimos 90 días'], ['year', 'Último año']])}
    </select></div>
    <div class="df-field"><label>Especie</label><select data-dfilter="species">
      ${sel('species', draft.species, [['', 'Todas'], ['perro', 'Perros'], ['gato', 'Gatos'], ['otro', 'Otros']])}
    </select></div>
    <div class="df-field"><label>Estado</label><select data-dfilter="status">
      ${sel('status', draft.status, [['', 'Todos'], ['Activo', 'Activas'], ['Inactivo', 'Inactivas'], ['Perdido', 'Perdidas']])}
    </select></div>
    <div class="df-field"><label>Sexo</label><select data-dfilter="sex">
      ${sel('sex', draft.sex, [['', 'Todos'], ['Macho', 'Machos'], ['Hembra', 'Hembras'], ['ND', 'Sin registrar']])}
    </select></div>
    <div class="df-field"><label>Ciudad</label><select data-dfilter="city">
      <option value="" ${draft.city === '' ? 'selected' : ''}>Todas</option>
      ${cities.map(c => `<option value="${escapeHtml(c)}" ${draft.city === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
    </select></div>
    <div class="df-field"><label>Registro desde</label><input type="date" data-dfilter="dateFrom" value="${escapeHtml(draft.dateFrom)}"></div>
    <div class="df-field"><label>Registro hasta</label><input type="date" data-dfilter="dateTo" value="${escapeHtml(draft.dateTo)}"></div>
    <div class="df-buttons">
      <button class="btn btn-primary btn-sm" id="btn-dashboard-apply">Aplicar filtros</button>
      <button class="btn btn-ghost btn-sm" id="btn-dashboard-reset">Restablecer</button>
      <button class="btn btn-outline btn-sm" id="btn-dashboard-csv">${iconDownload} CSV</button>
      <button class="btn btn-outline btn-sm" id="btn-dashboard-pdf">${iconFileText} PDF</button>
    </div>
  </div>`;
}

/* ---------- KPIs ---------- */
function kpiCardsHtml(pets, st, hs, analysis, records) {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = analysis.overdue || [];
  const overdueVacc = overdue.filter(r => r.type === 'vacuna').length;
  const overdueDesp = overdue.filter(r => r.type === 'desparasitacion').length;
  const withCard = pets.filter(p => p.carnet_number).length;
  const totalVacDesp = hs.totalVacunas + hs.totalDesparasitaciones;
  const appliedVacDesp = hs.totalVacunasAplicadas + hs.totalDesparasitacionesAplicadas;
  const coveragePct = totalVacDesp > 0 ? Math.round((appliedVacDesp / totalVacDesp) * 100) : 0;

  const kpis = [
    { lbl: 'Mascotas registradas', num: st.total, ico: iconPaw, cls: 'green', go: 'mascotas', border: 'green', foot: `<div class="kpi-foot">${st.thisMonth} este mes</div>` },
    { lbl: 'Mascotas activas', num: st.active, ico: iconCheckCircle, cls: 'green', go: 'mascotas', border: 'green', foot: `<div class="kpi-foot">${pctOf(st.active, st.total)}% del padrón</div>` },
    { lbl: 'Vacunas aplicadas', num: hs.totalVacunasAplicadas, ico: iconSyringe, cls: 'green', go: 'salud', border: 'green', foot: `<div class="kpi-foot">${hs.vacunasPendientes} pendiente${hs.vacunasPendientes !== 1 ? 's' : ''}</div>` },
    { lbl: 'Dosis vencidas', num: analysis.overdue.length, ico: iconAlert, cls: 'red', go: 'dashboard:alertas', border: 'red', foot: `<div class="kpi-foot">Requieren atención</div>` },
    { lbl: 'Desparasitaciones aplicadas', num: hs.totalDesparasitacionesAplicadas, ico: iconPill, cls: 'amber', go: 'salud', border: 'amber', foot: `<div class="kpi-foot">${hs.desparasitacionesPendientes} pendiente${hs.desparasitacionesPendientes !== 1 ? 's' : ''}</div>` },
    { lbl: 'Cobertura sanitaria', num: coveragePct, ico: iconStethoscope, cls: 'blue', go: 'salud', border: 'blue', foot: `<div class="kpi-foot">${totalVacDesp} dosis registradas</div>` },
  ];

  return `<div class="kpi-grid">
    ${kpis.map(k => `
    <div class="kpi-card border-left ${k.border}" data-kpi-go="${k.go}" role="button" tabindex="0">
      <div class="kpi-top"><span class="kpi-ico ${k.cls}">${k.ico}</span><span class="kpi-lbl">${k.lbl}</span></div>
      <div class="kpi-num" data-count="${k.num}">${k.num}</div>
      ${k.foot}
    </div>`).join('')}
  </div>`;
}

/* ---------- Tabla de mascotas recientes ---------- */
function recentTableHtml(pets) {
  const latest = [...pets].sort((a, b) => new Date(b.registration_date) - new Date(a.registration_date)).slice(0, 8);
  if (!latest.length) {
    return `<div class="empty-state"><div><b>Todavía no hay fichas</b><p>Registra la primera mascota para verla aquí.</p></div></div>`;
  }
  return `<div style="overflow-x:auto;"><table class="records-table"><thead><tr><th>Mascota</th><th>Registro</th><th>Especie</th><th>Raza</th><th>Propietario</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>
    ${latest.map(p => `
      <tr data-pet="${p.id}">
        <td><div style="display:flex; align-items:center; gap:10px; min-width:160px;"><img class="pet-thumb" src="${p.photo || placeholderPhoto()}" alt=""><div><b>${escapeHtml(p.name)}</b><div class="faint" style="font-size:11px;">${escapeHtml(p.carnet_number || '')}</div></div></div></td>
        <td class="faint">${escapeHtml(p.ci_number || '—')}</td>
        <td class="faint">${speciesShort(p.species)}</td>
        <td class="faint">${escapeHtml(p.breed || '—')}</td>
        <td class="faint">${escapeHtml(p.owner_name || '—')}</td>
        <td>${statusBadge(p.status)}</td>
        <td class="faint" style="font-size:12px; white-space:nowrap;">${escapeHtml(p.registration_date || '')}</td>
      </tr>`).join('')}
  </tbody></table></div>`;
}

/* ---------- Línea de tiempo de actividad ---------- */
function timelineHtml(limit = 40) {
  const groups = groupHistoryByDay(state.getHistory().slice(0, limit)).slice(0, 4);
  if (!groups.length) return `<div class="empty-state"><div><b>Sin actividad registrada</b><p>Las acciones de crear, editar, vacunar o imprimir aparecerán aquí.</p></div></div>`;
  return `<div class="timeline">
    ${groups.map(g => `
      <div class="tl-day">${escapeHtml(g.label)}</div>
      ${g.items.slice(0, 6).map(h => {
    const action = (h.action || '').toLowerCase();
    const dotColor = /elimin|perd/.test(action) ? 'var(--red)' : (/impresi|descarg/.test(action) ? 'var(--gold)' : 'var(--brand-2)');
    return `
        <div class="tl-item">
          <div class="tl-rail"><span class="tl-dot" style="background:${dotColor};"></span></div>
          <div class="tl-body">
            <div class="tl-desc">${escapeHtml(describeHistory(h))}</div>
            <div class="tl-meta"><span class="tl-time">${escapeHtml((h.time || '').slice(0, 5))}</span><span class="tl-user">${iconUser} ${escapeHtml(h.user || 'Sistema')}</span></div>
          </div>
        </div>`;
  }).join('')}
  `).join('')}
  </div>`;
}

/* ---------- Centro de alertas ---------- */
function alertCenterHtml(pets) {
  const { alerts, counts } = data.buildAlertsCached(pets);
  const sections = [
    ['critica', 'Crítica'],
    ['alta', 'Alta'],
    ['media', 'Media'],
    ['informativa', 'Informativa'],
  ];
  return `<div class="dash12">
    <div class="panel span-8">
      <div class="dash-sec-title"><span>Asuntos que requieren atención</span><span class="faint" style="font-size:12px;">${alerts.length} en total</span></div>
      ${alerts.length ? sections.map(([prio, label]) => {
    const rows = alerts.filter(a => a.priority === prio);
    if (!rows.length) return '';
    const cap = rows.slice(0, 6);
    return `
        <div class="alert-section">
          <div class="alert-section-head"><span class="p-badge ${prio}">${label}</span><b>${counts[prio]}</b></div>
          <div class="alert-list">
            ${cap.map(a => `
            <div class="alert-item ${a.priority}" data-alert-open="${a.petId || ''}" role="button" tabindex="0">
              <span class="a-dot"></span>
              <div class="a-main"><div class="a-title">${escapeHtml(a.title)}</div><div class="a-desc">${escapeHtml(a.desc || '')}</div></div>
              <span class="a-go">${iconChevronRight}</span>
            </div>`).join('')}
            ${rows.length > cap.length ? `<div class="alert-more">+ ${rows.length - cap.length} más de esta prioridad</div>` : ''}
          </div>
        </div>`;
  }).join('') : `<div class="alert-none">${iconCheckCircle} Sin pendientes: no hay alertas por prioridad en la selección actual.</div>`}
    </div>
    <div class="panel span-4">
      <div class="dash-sec-title"><span>Cobertura de información</span></div>
      ${pets.length ? `<div class="chart-box short"><canvas id="chart-coverage"></canvas></div>` : emptyChart(iconPaw, 'Registra mascotas para ver la cobertura.')}
      <div class="mini-note">Porcentaje de fichas con cada dato completo</div>
    </div>
  </div>`;
}

/* ---------- Resumen: mini alertas ---------- */
function alertMiniHtml(pets) {
  const { counts, total } = data.buildAlertsCached(pets);
  const rows = [
    ['critica', 'Críticas', counts.critica],
    ['alta', 'Alta prioridad', counts.alta],
    ['media', 'Media', counts.media],
    ['informativa', 'Informativas', counts.informativa],
  ].filter(r => r[2] > 0);
  return `
  <div class="dash-sec-title"><span>Alertas</span><button class="btn btn-ghost btn-sm" data-kpi-go="dashboard:alertas">Ver todas</button></div>
  ${rows.length ? rows.map(([prio, label, n]) => `
    <div class="alert-row ${prio === 'alta' ? 'gold' : prima(prio)}"><div class="alert-num">${n}</div><div><div class="a-lbl">${label}</div><div class="a-sub">${prioLabel(prio)}</div></div></div>`).join('')
    : `<div class="alert-none">${iconCheckCircle} Sin alertas en la selección.</div>`}`;
}
function prima(prio) { return prio === 'critica' ? 'red' : ''; }
function prioLabel(p) {
  return { critica: 'Requieren acción inmediata', alta: 'Dosis o seguimiento urgente', media: 'Datos por completar', informativa: 'Próximas atenciones' }[p] || '';
}

/* ---------- Vista principal ---------- */
export function viewDashboard() {
  if (state.dashboardLoading) return skeleton();

  const allPets = state.getPets();
  const pets = data.filteredPets();
  const st = calcDashboardStats(pets, state.getHistory());
  const hs = calcHealthStats(pets, data.healthMap());
  const analysis = data.dashboardAnalysisCached(pets);
  const records = data.healthRecordsFor(pets);
  const dashTab = data.getDashTab();
  const dogs = st.dogs, cats = st.cats, others = st.others, total = st.total;
  const hm = data.healthMap();
  const noHealth = pets.filter(p => (hm.get(p.id) || []).length === 0);
  const totalVacDesp = hs.totalVacunas + hs.totalDesparasitaciones;
  const appliedVacDesp = hs.totalVacunasAplicadas + hs.totalDesparasitacionesAplicadas;
  const coveragePct = totalVacDesp > 0 ? Math.round((appliedVacDesp / totalVacDesp) * 100) : 0;

  return `
  <div class="dash-head">
    <div><h1>Panel principal</h1><p>Resumen general de registros, salud y actividad de FAM J VET</p></div>
    ${quickActionsHtml()}
  </div>
  ${filtersHtml(allPets, pets)}
  <div class="dash-tabs" role="tablist">
    ${data.DASH_TABS.map(([key, label]) => `<button class="dash-tab ${dashTab === key ? 'active' : ''}" data-dashtab="${key}" role="tab" aria-selected="${dashTab === key}">${label}</button>`).join('')}
  </div>

  ${dashTab === 'resumen' ? `
  ${kpiCardsHtml(pets, st, hs, analysis, records)}
  <div class="dash12">
    <div class="panel span-8">
      <div class="dash-sec-title"><span>Evolución de registros</span>
        <select class="chip" id="dashboard-chart-range" data-chart-range="" style="height:32px;">
          <option value="6" ${chartsLib.getChartRange() === '6' ? 'selected' : ''}>6 meses</option>
          <option value="12" ${chartsLib.getChartRange() === '12' ? 'selected' : ''}>12 meses</option>
        </select>
      </div>
      <div class="chart-box"><canvas id="chart-months"></canvas></div>
      <div class="mini-note">Nuevas mascotas por mes · línea punteada: periodo anterior equivalente</div>
    </div>
    <div class="panel span-4">
      <div class="dash-sec-title"><span>Estados de registro</span></div>
      <div class="chart-box short"><canvas id="chart-status"></canvas></div>
      ${donutLegend([
    { label: 'Activas', color: 'var(--brand)', n: st.active, pct: pctOf(st.active, total) },
    { label: 'Inactivas', color: 'var(--text-2)', n: st.inactive, pct: pctOf(st.inactive, total) },
    { label: 'Perdidas', color: 'var(--red)', n: st.lost, pct: pctOf(st.lost, total) },
  ])}
    </div>
    <div class="panel span-8 table-span">
      <div class="dash-sec-title"><span>Mascotas registradas recientemente</span><button class="btn btn-ghost btn-sm" data-kpi-go="mascotas">Ver todas</button></div>
      ${recentTableHtml(pets)}
    </div>
    <div class="panel span-4">
      ${alertMiniHtml(pets)}
    </div>
  </div>` : ''}

  ${dashTab === 'salud' ? `
  <!-- Fila de 6 tarjetas de resumen con borde izquierdo de color -->
  <div class="kpi-grid" style="grid-template-columns:repeat(6,1fr); margin-bottom:20px;">
    <div class="kpi-card border-left green" role="button" tabindex="0">
      <div class="kpi-top"><span class="kpi-ico green">${iconPaw}</span><span class="kpi-lbl">Mascotas totales</span></div>
      <div class="kpi-num">${st.total}</div>
      <div class="kpi-foot">${st.thisMonth} este mes</div>
    </div>
    <div class="kpi-card border-left green" role="button" tabindex="0">
      <div class="kpi-top"><span class="kpi-ico green">${iconCheckCircle}</span><span class="kpi-lbl">Mascotas activas</span></div>
      <div class="kpi-num">${st.active}</div>
      <div class="kpi-foot">${pctOf(st.active, st.total)}% del padrón</div>
    </div>
    <div class="kpi-card border-left green" role="button" tabindex="0">
      <div class="kpi-top"><span class="kpi-ico green">${iconSyringe}</span><span class="kpi-lbl">Vacunas aplicadas</span></div>
      <div class="kpi-num">${hs.totalVacunasAplicadas}</div>
      <div class="kpi-foot">${hs.vacunasPendientes} pendiente${hs.vacunasPendientes !== 1 ? 's' : ''}</div>
    </div>
    <div class="kpi-card border-left red" role="button" tabindex="0">
      <div class="kpi-top"><span class="kpi-ico red">${iconAlert}</span><span class="kpi-lbl">Dosis vencidas</span></div>
      <div class="kpi-num">${analysis.overdue.length}</div>
      <div class="kpi-foot">Requieren atención</div>
    </div>
    <div class="kpi-card border-left amber" role="button" tabindex="0">
      <div class="kpi-top"><span class="kpi-ico amber">${iconPill}</span><span class="kpi-lbl">Desparasitaciones aplicadas</span></div>
      <div class="kpi-num">${hs.totalDesparasitacionesAplicadas}</div>
      <div class="kpi-foot">${hs.desparasitacionesPendientes} pendiente${hs.desparasitacionesPendientes !== 1 ? 's' : ''}</div>
    </div>
    <div class="kpi-card border-left blue" role="button" tabindex="0">
      <div class="kpi-top"><span class="kpi-ico blue">${iconStethoscope}</span><span class="kpi-lbl">Cobertura sanitaria</span></div>
      <div class="kpi-num">${coveragePct}%</div>
      <div class="kpi-foot">${totalVacDesp} dosis registradas</div>
    </div>
  </div>

  <div class="dash12">
    <!-- Gauge de cobertura de vacunación -->
    <div class="panel span-4">
      <div class="dash-sec-title"><span>Cobertura de vacunación</span></div>
      <div class="gauge-wrap">
        <div class="gauge-box"><canvas id="gauge-vaccination" width="132" height="132"></canvas></div>
        <div class="gauge-center"><b>${coveragePct}%</b><span>Al día</span></div>
      </div>
      <div class="mini-note">Porcentaje de mascotas con vacunas al día</div>
    </div>

    <!-- Barras agrupadas: Programado vs Aplicado -->
    <div class="panel span-4">
      <div class="dash-sec-title"><span>Programado vs Aplicado (últimos 6 meses)</span></div>
      <div class="chart-box"><canvas id="chart-grouped-bar"></canvas></div>
      <div class="mini-note">Comparación mensual de dosis programadas vs aplicadas</div>
    </div>

    <!-- Línea de tiempo de dosis -->
    <div class="panel span-4">
      <div class="dash-sec-title"><span>Línea de tiempo de dosis</span></div>
      <div class="chart-box short"><canvas id="chart-timeline"></canvas></div>
      <div class="mini-note">Historial de vacunas y desparasitaciones</div>
    </div>

    <!-- Matriz de riesgo -->
    <div class="panel span-4">
      <div class="dash-sec-title"><span>Matriz de riesgo</span></div>
      <div class="chart-box short"><canvas id="chart-risk-matrix"></canvas></div>
      <div class="mini-note">Urgencia vs cantidad de mascotas</div>
    </div>

    <!-- Próximas citas -->
    <div class="panel span-4">
      <div class="dash-sec-title"><span>Próximas citas</span><button class="btn btn-ghost btn-sm" data-kpi-go="salud">Gestionar salud</button></div>
      ${hs.proximasCitas.length ? hs.proximasCitas.slice(0, 6).map(c => `
        <div class="activity-row">
          <span class="dot" style="background:${c.type === 'vacuna' ? 'var(--brand)' : 'var(--amber)'}; margin-top:6px;"></span>
          <div class="activity-main">
            <div>${escapeHtml(c.title)}</div>
            <div>${escapeHtml(c.petName)} · ${c.type === 'vacuna' ? 'Vacuna' : 'Desparasitación'} · ${escapeHtml(c.date)}</div>
          </div>
        </div>`).join('') : `<p class="faint" style="text-align:center; padding:20px 0;">Sin citas programadas.</p>`}
    </div>

    <!-- Vacunas más registradas -->
    <div class="panel span-4">
      <div class="dash-sec-title"><span>Vacunas más registradas</span></div>
      ${analysis.vaccineRank.length ? `<div class="chart-box short"><canvas id="chart-vaccines"></canvas></div>` : emptyChart(iconSyringe, 'Aún no hay vacunas registradas')}
    </div>

    <!-- Enfermedades crónicas -->
    <div class="panel span-4">
      <div class="dash-sec-title"><span>Enfermedades crónicas</span></div>
      ${analysis.conditions.length ? `<div class="chart-box short"><canvas id="chart-conditions"></canvas></div>` : emptyChart(iconHeartbeat, 'Aún no hay enfermedades crónicas registradas')}
    </div>

    <!-- Cobertura médica extendida -->
    <div class="panel span-6">
      <div class="dash-sec-title"><span>Cobertura médica extendida</span></div>
      <div class="coverage-grid">
        <div><b>${analysis.sterilized}</b><span>Esterilizadas</span></div>
        <div><b>${analysis.microchipped}</b><span>Con microchip</span></div>
        <div><b>${analysis.bloodTyped}</b><span>Con tipo sanguíneo</span></div>
        <div class="danger"><b>${analysis.overdue.length}</b><span>Dosis vencidas</span></div>
      </div>
    </div>

    <!-- Sin información médica -->
    <div class="panel span-6">
      <div class="dash-sec-title"><span>Sin información médica</span></div>
      ${noHealth.length ? `<div class="alert-list">${noHealth.slice(0, 6).map(p => `<div class="alert-item media" data-alert-open="${p.id}"><span class="a-dot"></span><div class="a-main"><div class="a-title">${escapeHtml(p.name)}</div><div class="a-desc">Registrar primera vacuna o desparasitación</div></div><span class="a-go">${iconChevronRight}</span></div>`).join('')}</div>` : `<div class="alert-none">${iconCheckCircle} Todas las mascotas de la selección tienen historial médico.</div>`}
    </div>
  </div>` : ''}

  ${dashTab === 'padron' ? `
  <div class="dash12">
    <div class="panel span-4">
      <div class="dash-sec-title"><span>Especie</span></div>
      <div class="donut-wrap">
        <div class="donut-box"><canvas id="chart-species" width="132" height="132"></canvas><div class="donut-center"><b>${total}</b><span>mascotas</span></div></div>
        ${donutLegend([
    { label: 'Perros', color: 'var(--brand)', n: dogs, pct: pctOf(dogs, total) },
    { label: 'Gatos', color: 'var(--gold)', n: cats, pct: pctOf(cats, total) },
    { label: 'Otros', color: 'var(--text-2)', n: others, pct: pctOf(others, total) },
  ])}
      </div>
    </div>
    <div class="panel span-4">
      <div class="dash-sec-title"><span>Sexo</span></div>
      <div class="chart-box short"><canvas id="chart-sex"></canvas></div>
      <div class="mini-note">Machos: ${st.males} · Hembras: ${st.females} · Sin registrar: ${st.sexND}</div>
    </div>
    <div class="panel span-4">
      <div class="dash-sec-title"><span>Esterilización</span></div>
      <div class="sex-row"><span class="sex-dot" style="background:var(--brand);"></span>Esterilizadas<b style="margin-left:auto;">${analysis.sterilized}</b><span class="faint">${pctOf(analysis.sterilized, st.total)}%</span></div>
      <div class="sex-row"><span class="sex-dot" style="background:var(--surface-3); border:1px solid var(--border-strong);"></span>Sin registrar<b style="margin-left:auto;">${Math.max(0, st.total - analysis.sterilized)}</b></div>
      <div class="mini-note">Según información médica de la ficha</div>
    </div>
    <div class="panel span-6">
      <div class="dash-sec-title"><span>Rangos de edad</span></div>
      <div class="chart-box short"><canvas id="chart-age"></canvas></div>
    </div>
    <div class="panel span-6">
      <div class="dash-sec-title"><span>Rangos de peso</span></div>
      <div class="chart-box short"><canvas id="chart-weight"></canvas></div>
    </div>
    <div class="panel span-6">
      <div class="dash-sec-title"><span>Razas más registradas</span></div>
      ${st.topBreeds.length ? `<div class="hbar-list">
        ${st.topBreeds.map(b => `<div class="hbar-row"><span class="hb-lbl">${escapeHtml(b.name)}</span><b>${b.count}</b><div class="hbar-track"><i style="width:${Math.round((b.count / Math.max(1, st.topBreeds[0].count)) * 100)}%;"></i></div></div>`).join('')}
      </div>` : `<p class="faint">Sin información de razas todavía.</p>`}
    </div>
    <div class="panel span-6">
      <div class="dash-sec-title"><span>Promedios</span></div>
      <div class="coverage-grid">
        <div><b style="font-size:22px;">${avgAge(pets)}</b><span>Edad promedio</span></div>
        <div><b style="font-size:22px;">${avgWeight(pets)}</b><span>Peso promedio</span></div>
        <div><b style="font-size:22px;">${st.ownersCount ? (st.total / st.ownersCount).toFixed(1) : '—'}</b><span>Mascotas / prop.</span></div>
        <div><b style="font-size:22px;">${st.ownersCount}</b><span>Propietarios</span></div>
      </div>
      <div class="mini-note">Edad sobre ${pets.filter(p => petAgeYears(p) != null).length} fichas · peso sobre ${pets.filter(p => p.weight).length} fichas</div>
    </div>
  </div>` : ''}

  ${dashTab === 'territorio' ? `
  <div class="dash12">
    <div class="panel span-6">
      <div class="dash-sec-title"><span>Ciudades con más registros</span></div>
      <div class="chart-box short"><canvas id="chart-cities"></canvas></div>
      <div class="mini-note">Top ${analysis.cities.length} ciudades · ${(st.total)} en la selección</div>
    </div>
    <div class="panel span-6">
      <div class="dash-sec-title"><span>Propietarios</span></div>
      <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr); margin-bottom:12px;">
        <div><div class="kpi-num" style="font-size:24px;">${st.ownersCount}</div><div class="kpi-lbl">Registrados</div></div>
        <div><div class="kpi-num" style="font-size:24px;">${st.newOwnersMonth}</div><div class="kpi-lbl">Nuevos este mes</div></div>
        <div><div class="kpi-num" style="font-size:24px;">${st.ownersCount ? (st.total / st.ownersCount).toFixed(1) : '—'}</div><div class="kpi-lbl">Mascotas / prop.</div></div>
      </div>
      ${st.topOwners.length ? st.topOwners.map(o => `<div class="owner-row"><span class="o-av">${escapeHtml(initials(o.name))}</span><span>${escapeHtml(o.name)}<div class="o-sub">${o.count} ${o.count === 1 ? 'mascota' : 'mascotas'}</div></span><b>${o.count}</b></div>`).join('') : `<p class="faint">Sin propietarios registrados.</p>`}
    </div>
  </div>` : ''}

  ${dashTab === 'actividad' ? `
  <div class="dash12">
    <div class="panel span-6">
      <div class="dash-sec-title"><span>Actividad del sistema</span></div>
      <div class="chart-toggle">
        <button class="chip ${chartsLib.getActivityMode() === 'action' ? 'active' : ''}" data-actmode="action">Por acción</button>
        <button class="chip ${chartsLib.getActivityMode() === 'day' ? 'active' : ''}" data-actmode="day">Por día</button>
      </div>
      <div class="chart-box short"><canvas id="chart-activity"></canvas></div>
    </div>
    <div class="panel span-6">
      <div class="dash-sec-title"><span>Línea de tiempo</span><button class="btn btn-ghost btn-sm" data-kpi-go="historial">Historial completo</button></div>
      ${timelineHtml()}
    </div>
  </div>` : ''}

  ${dashTab === 'alertas' ? alertCenterHtml(pets) : ''}`;
}
function avgAge(pets) {
  const arr = pets.map(petAgeYears).filter(v => v != null);
  return arr.length ? arr.reduce((a, b) => a + b, 0).toFixed(1) + ' a' : '—';
}
function avgWeight(pets) {
  const arr = pets.map(p => Number(p.weight)).filter(v => Number.isFinite(v) && v > 0);
  return arr.length ? arr.reduce((a, b) => a + b, 0).toFixed(1) + ' kg' : '—';
}

/* ---------- Eventos del dashboard ---------- */
function rerender() { import('../app.js').then(m => m.renderView()); }

export function bindDashboardEvents() {
  // Filtros en borrador
  document.querySelectorAll('[data-dfilter]').forEach(el => el.addEventListener('change', () => {
    data.setDraftField(el.dataset.dfilter, el.value);
  }));
  document.getElementById('btn-dashboard-apply')?.addEventListener('click', () => {
    data.applyDraft(); rerender();
  });
  document.getElementById('btn-dashboard-reset')?.addEventListener('click', () => {
    data.resetDraft(); rerender();
  });
  // Atajos de estado: aplicar directo
  document.querySelectorAll('[data-dash-status]').forEach(el => el.addEventListener('click', () => {
    const v = el.dataset.dashStatus;
    data.applyDraft();
    data.setDraftField('status', v);
    data.applyDraft();
    rerender();
  }));
  // Pestañas
  document.querySelectorAll('[data-dashtab]').forEach(el => el.addEventListener('click', () => {
    data.setDashTab(el.dataset.dashtab); rerender();
  }));
  // Selector del gráfico de evolución
  document.querySelector('#dashboard-chart-range')?.addEventListener('change', (e) => {
    chartsLib.setChartRange(e.target.value); chartsLib.drawCharts();
  });
  // Modo del gráfico de actividad
  document.querySelectorAll('[data-actmode]').forEach(el => el.addEventListener('click', () => {
    chartsLib.setActivityMode(el.dataset.actmode);
    document.querySelectorAll('[data-actmode]').forEach(x => x.classList.toggle('active', x === el));
    chartsLib.renderActivityChart();
  }));
  // KPIs y alertas
  document.querySelectorAll('[data-kpi-go]').forEach(el => el.addEventListener('click', async () => {
    const dest = el.dataset.kpiGo;
    if (dest === 'mascotas') { state.view = 'mascotas'; rerender(); return; }
    if (dest === 'carnet') { state.view = 'carnet'; rerender(); return; }
    if (dest === 'historial') { state.view = 'historial'; rerender(); return; }
    if (dest === 'salud') { state.view = 'salud'; rerender(); return; }
    if (dest.startsWith('dashboard:')) {
      data.setDashTab(dest.split(':')[1]); rerender(); return;
    }
  }));
  document.querySelectorAll('[data-alert-open]').forEach(el => el.addEventListener('click', () => {
    if (el.dataset.alertOpen) openPetDetail(el.dataset.alertOpen, 'm');
  }));
  // Tabla de mascotas
  document.querySelectorAll('tr[data-pet]').forEach(el => el.addEventListener('click', () => {
    if (el.dataset.pet) openPetDetail(el.dataset.pet);
  }));
  // Actualizar datos
  document.getElementById('btn-dashboard-refresh')?.addEventListener('click', async () => {
    toast('Actualizando datos…');
    state.dashboardLoading = true; rerender();
    try {
      await Promise.all([state.loadPets(), state.loadHistory(), state.loadAnalytics()]);
      await state.loadAllHealthRecords();
      state.dashboardLoading = false; rerender();
      toast('Datos actualizados');
    } catch (error) {
      state.dashboardLoading = false; rerender();
      toast(error.message, 'error');
    }
  });
  // Exportaciones
  document.getElementById('btn-dashboard-csv')?.addEventListener('click', exportDashboardCsv);
  document.getElementById('btn-dashboard-pdf')?.addEventListener('click', exportDashboardPdf);
  // Acciones rápidas
  document.querySelectorAll('[data-quick]').forEach(el => el.addEventListener('click', () => {
    const act = el.dataset.quick;
    if (act === 'new-pet') openPetModal();
    else if (act === 'emit-card') { state.view = 'carnet'; rerender(); }
    else if (act === 'new-vaccine') openPetPicker('Registrar vacunación', 'Selecciona la mascota para registrar su vacunación', () => openPetModal(null, { tab: 'med' }));
    else if (act === 'report') openReportModal();
  }));
  animateKpiCounters();
}

/* ---------- Contadores animados ---------- */
export function animateKpiCounters() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.kpi-num[data-count]').forEach(el => { el.textContent = el.dataset.count; });
    return;
  }
  document.querySelectorAll('.kpi-num[data-count]').forEach(el => {
    const target = Number(el.dataset.count) || 0;
    if (!Number.isFinite(target)) return;
    const dur = 650;
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(step); else el.textContent = String(target);
    };
    requestAnimationFrame(step);
  });
}

/* ---------- Selector de mascota ---------- */
function openPetPicker(title, subtitle, _unused) {
  const all = state.getPets();
  openModal('modal-sm', `
    <div class="modal-head"><h3>${title}</h3><button class="btn-icon" data-close>✕</button></div>
    <div class="modal-body">
      <p class="faint" style="margin-bottom:12px;">${subtitle}</p>
      <input id="picker-search" class="field" placeholder="Buscar por nombre o carnet..." style="width:100%; height:40px; border:1px solid var(--border); border-radius:8px; padding:0 12px; background:var(--surface-2); font-family:inherit;">
      <div id="picker-list" style="max-height:320px; overflow-y:auto; margin-top:10px;">
        ${all.map(p => `
          <div class="alert-item" data-pick="${p.id}" style="margin-bottom:6px;">
            <img class="pet-thumb" src="${p.photo || placeholderPhoto()}" alt="">
            <div class="a-main"><div class="a-title">${escapeHtml(p.name)}</div><div class="a-desc">${escapeHtml(p.carnet_number || '')} · ${escapeHtml(p.owner_name || '')}</div></div>
            <span class="a-go">${iconChevronRight}</span>
          </div>`).join('') || '<p class="faint">No hay mascotas registradas.</p>'}
      </div>
    </div>`);
  document.querySelectorAll('[data-pick]').forEach(el => el.addEventListener('click', () => {
    const id = el.dataset.pick; closeModal();
    openPetModal(id, { tab: 'med' });
  }));
  const search = document.getElementById('picker-search');
  if (search) search.addEventListener('input', () => {
    const q = search.value.toLowerCase();
    document.querySelectorAll('#picker-list [data-pick]').forEach(el => {
      const p = all.find(x => x.id === el.dataset.pick);
      el.style.display = p && ((p.name || '').toLowerCase().includes(q) || (p.carnet_number || '').toLowerCase().includes(q)) ? '' : 'none';
    });
  });
}

/* ---------- Modal de reportes ---------- */
export function openReportDialog() {
  openReportModal();
}

function openReportModal() {
  openModal('modal-sm', `
    <div class="modal-head"><h3>Generar reporte</h3><button class="btn-icon" data-close>✕</button></div>
    <div class="modal-body">
      <p class="faint" style="margin-bottom:14px;">Exporta la selección actual del panel (${data.filteredPets().length} mascotas).</p>
      <div class="flex gap-2" style="flex-direction:column;">
        <button class="btn btn-outline" id="btn-report-csv">${iconDownload} Exportar CSV</button>
        <button class="btn btn-primary" id="btn-report-pdf">${iconFileText} Exportar PDF del panel</button>
      </div>
      <p class="faint" style="margin-top:12px; font-size:11.5px;">El PDF incluye KPIs, gráficos y tablas visibles del panel con los filtros aplicados.</p>
    </div>`);
  document.getElementById('btn-report-csv')?.addEventListener('click', () => { closeModal(); exportDashboardCsv(); });
  document.getElementById('btn-report-pdf')?.addEventListener('click', () => { closeModal(); exportDashboardPdf(); });
}

/* ---------- Exportación CSV ---------- */
function exportDashboardCsv() {
  const pets = data.filteredPets();
  if (!pets.length) return toast('No hay mascotas en la selección actual', 'error');
  const head = ['Nombre', 'N° Carnet', 'Registro BOL-CAR', 'Especie', 'Raza', 'Sexo', 'Estado', 'Propietario', 'Teléfono', 'Ciudad', 'Fecha registro', 'Microchip'];
  const rows = pets.map(p => [
    p.name, p.carnet_number, p.ci_number || '', speciesShort(p.species), p.breed || '', p.sex || '', p.status || '',
    p.owner_name || '', p.owner_phone || '', p.owner_city || '', p.registration_date || '', p.has_chip ? `Sí: ${p.chip || ''}` : 'No'
  ]);
  const csv = [head, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `fam-jvet-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  api.logHistory('Exportación CSV del panel', `${pets.length} mascotas`);
  toast('CSV exportado');
}

/* ---------- Exportación PDF (jsPDF + html2canvas) ---------- */
async function exportDashboardPdf() {
  const pets = data.filteredPets();
  if (!pets.length) return toast('No hay mascotas en la selección actual', 'error');
  const JsLib = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : (window.jsPDF || null);
  if (!JsLib || typeof window.html2canvas !== 'function') return toast('Las librerías PDF no están disponibles', 'error');
  const el = document.getElementById('page-body');
  if (!el) return toast('No hay contenido para exportar', 'error');
  toast('Generando PDF…');
  try {
    const canvas = await window.html2canvas(el, {
      scale: 2, logging: false, useCORS: true,
      backgroundColor: getComputedStyle(document.body).backgroundColor || '#FFFFFF',
    });
    const pdf = new JsLib({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const imgW = pageW - margin * 2;
    const imgH = canvas.height * imgW / canvas.width;
    const usable = pageH - margin * 2;
    pdf.addImage(canvas, 'PNG', margin, margin, imgW, imgH);
    let pending = imgH - usable;
    while (pending > 0) {
      pdf.addPage();
      pdf.addImage(canvas, 'PNG', margin, margin - (imgH - pending), imgW, imgH);
      pending -= usable;
    }
    pdf.save(`fam-jvet-reporte-${new Date().toISOString().slice(0, 10)}.pdf`);
    api.logHistory('Exportación PDF del panel', `${pets.length} mascotas`);
    toast('PDF generado');
  } catch (e) {
    toast('No se pudo generar el PDF: ' + (e.message || e), 'error');
  }
}