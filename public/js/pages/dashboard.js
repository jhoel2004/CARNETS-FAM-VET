import { escapeHtml, statusBadge, placeholderPhoto, groupHistoryByDay, describeHistory, calcDashboardStats, calcHealthStats, pctOf, monthShort, petAgeYears, toast } from '../utils.js';
import { api } from '../api.js';
import { iconPaw, iconCheckCircle, iconAlert, iconCard, iconPlus, iconDog, iconCat, iconChart } from '../icons.js';

let state = null;
let charts = {};
let dashFilters = { period: 'all', species: '', status: '', city: '' };
let activityMode = 'action';
let dashTab = 'resumen';
const dashTabList = [
  ['resumen', 'Resumen'],
  ['salud', 'Salud'],
  ['padron', 'Padrón'],
  ['territorio', 'Territorio'],
  ['actividad', 'Actividad'],
  ['alertas', 'Alertas'],
];

export function initDashboard(s) {
  state = s;
}

function speciesShort(s) {
  return { perro: 'Perro', gato: 'Gato', otro: 'Otro' }[s] || s || '—';
}

function ageShort(p) {
  const y = petAgeYears(p);
  if (y == null) return '—';
  if (y < 1) return `${Math.max(1, Math.round(y * 12))} m`;
  const yi = Math.floor(y);
  const mi = Math.round((y - yi) * 12);
  return mi > 0 ? `${yi} a ${mi} m` : `${yi} a`;
}

function initials(name) {
  return (name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
}

function parseList(value) {
  try { const list = JSON.parse(value || '[]'); return Array.isArray(list) ? list : []; } catch { return []; }
}

function filteredPets() {
  const now = new Date();
  const start = new Date(now);
  if (dashFilters.period === '30') start.setDate(now.getDate() - 30);
  if (dashFilters.period === '90') start.setDate(now.getDate() - 90);
  if (dashFilters.period === 'year') start.setFullYear(now.getFullYear() - 1);
  return state.getPets().filter(p => {
    const registered = new Date((p.registration_date || '1900-01-01') + 'T12:00');
    return (!dashFilters.species || p.species === dashFilters.species)
      && (!dashFilters.status || p.status === dashFilters.status)
      && (!dashFilters.city || p.owner_city === dashFilters.city)
      && (dashFilters.period === 'all' || registered >= start);
  });
}

function dashboardAnalysis(pets) {
  const ids = new Set(pets.map(p => p.id));
  const details = (state.getAnalytics().medicalDetails || []).filter(d => ids.has(d.pet_id));
  const records = (state.getAnalytics().healthRecords || []).filter(r => ids.has(r.pet_id));
  const detailByPet = new Map(details.map(d => [d.pet_id, d]));
  const cities = new Map(); const conditions = new Map();
  const weights = { '< 5 kg': 0, '5–15 kg': 0, '15–30 kg': 0, '30+ kg': 0, 'Sin dato': 0 };
  const quality = { Foto: 0, Raza: 0, Peso: 0, Teléfono: 0, Dirección: 0, Microchip: 0 };
  pets.forEach(p => {
    const city = (p.owner_city || 'Sin ciudad').trim() || 'Sin ciudad'; cities.set(city, (cities.get(city) || 0) + 1);
    const weight = Number(p.weight);
    if (!Number.isFinite(weight) || !p.weight) weights['Sin dato']++;
    else if (weight < 5) weights['< 5 kg']++; else if (weight < 15) weights['5–15 kg']++; else if (weight < 30) weights['15–30 kg']++; else weights['30+ kg']++;
    if (p.photo) quality.Foto++; if (p.breed) quality.Raza++; if (p.weight) quality.Peso++; if (p.owner_phone) quality.Teléfono++; if (p.owner_address) quality.Dirección++;
    const detail = detailByPet.get(p.id); if (detail?.microchip) quality.Microchip++;
    parseList(detail?.conditions_detail).forEach(condition => {
      const name = String(condition?.name || '').trim(); if (name) conditions.set(name, (conditions.get(name) || 0) + 1);
    });
  });
  const actionGroups = { Registros: 0, Salud: 0, Documentos: 0, Ediciones: 0, Otros: 0 };
  state.getHistory().forEach(item => {
    const action = (item.action || '').toLowerCase();
    if (/creaci|registro/.test(action)) actionGroups.Registros++;
    else if (/vacuna|salud|médic|medic/.test(action)) actionGroups.Salud++;
    else if (/descarg|impresi/.test(action)) actionGroups.Documentos++;
    else if (/edici|actualiz/.test(action)) actionGroups.Ediciones++;
    else actionGroups.Otros++;
  });
  const today = new Date().toISOString().slice(0, 10);
  const overdue = records.filter(r => !r.applied && (r.next_due || r.record_date) && (r.next_due || r.record_date) < today);
  const vaccineRank = new Map();
  records.forEach(r => {
    if (r.type !== 'vacuna') return;
    const title = String(r.title || '').trim();
    if (title) vaccineRank.set(title, (vaccineRank.get(title) || 0) + 1);
  });
  const byDay = new Map();
  state.getHistory().forEach(item => {
    const m = String(item.date || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return;
    const key = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    byDay.set(key, (byDay.get(key) || 0) + 1);
  });
  return {
    cities: [...cities.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
    conditions: [...conditions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
    weights, quality, actionGroups, overdue,
    vaccineRank: [...vaccineRank.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
    dailyActivity: [...byDay.entries()].sort().slice(-14),
    sterilized: details.filter(d => !!d.sterilized).length,
    microchipped: details.filter(d => !!d.microchip).length,
    bloodTyped: details.filter(d => !!d.blood_type).length,
  };
}

export function viewDashboard() {
  const allPets = state.getPets();
  const pets = filteredPets();
  const st = calcDashboardStats(pets, state.getHistory());
  const hs = calcHealthStats(pets, state.getAllHealthRecordsMap());
  const analysis = dashboardAnalysis(pets);
  const pct = (v) => pctOf(v, st.total);

  const sorted = [...pets].sort((a, b) => new Date(b.registration_date) - new Date(a.registration_date));
  const latest = sorted.slice(0, 8);
  const groups = groupHistoryByDay(state.getHistory().slice(0, 10));

  const ageEntries = Object.entries(st.byAge);
  const breedMax = Math.max(1, ...st.topBreeds.map(b => b.count));
  const sexTotal = st.males + st.females + st.sexND;
  const unster = Math.max(0, st.total - st.sterilized);

  const cities = [...new Set(allPets.map(p => p.owner_city).filter(Boolean))].sort();
  return `
  <div class="page-head"><div><h1>Panel principal</h1><p>Resumen de registros, carnets y salud · FAM J VET Bolivia</p></div></div>
  <div class="dashboard-filters panel">
    <div><b>Analítica interactiva</b><span>${pets.length} de ${allPets.length} mascotas en la selección</span></div>
    <select class="chip" data-dashboard-filter="period"><option value="all">Todo el historial</option><option value="30" ${dashFilters.period === '30' ? 'selected' : ''}>Últimos 30 días</option><option value="90" ${dashFilters.period === '90' ? 'selected' : ''}>Últimos 90 días</option><option value="year" ${dashFilters.period === 'year' ? 'selected' : ''}>Último año</option></select>
    <select class="chip" data-dashboard-filter="species"><option value="">Todas las especies</option><option value="perro" ${dashFilters.species === 'perro' ? 'selected' : ''}>Perros</option><option value="gato" ${dashFilters.species === 'gato' ? 'selected' : ''}>Gatos</option><option value="otro" ${dashFilters.species === 'otro' ? 'selected' : ''}>Otros</option></select>
    <select class="chip" data-dashboard-filter="status"><option value="">Todos los estados</option><option value="Activo" ${dashFilters.status === 'Activo' ? 'selected' : ''}>Activas</option><option value="Inactivo" ${dashFilters.status === 'Inactivo' ? 'selected' : ''}>Inactivas</option><option value="Perdido" ${dashFilters.status === 'Perdido' ? 'selected' : ''}>Perdidas</option></select>
    <select class="chip" data-dashboard-filter="city"><option value="">Todas las ciudades</option>${cities.map(city => `<option value="${escapeHtml(city)}" ${dashFilters.city === city ? 'selected' : ''}>${escapeHtml(city)}</option>`).join('')}</select>
    <button class="btn btn-outline btn-sm" data-dash-status="Activo">Activas</button>
    <button class="btn btn-outline btn-sm" data-dash-status="Perdido">Perdidas</button>
    <button class="btn btn-outline btn-sm" id="btn-dashboard-export">Exportar CSV</button>
    <button class="btn btn-primary btn-sm" id="btn-dashboard-refresh">Actualizar datos</button>
    <button class="btn btn-ghost btn-sm" id="btn-dashboard-reset">Restablecer</button>
  </div>

  <!-- Pestañas del panel: menos contenido a la vista, navegable con botones -->
  <div class="dash-tabs" role="tablist">
    ${dashTabList.map(([key, label]) => `<button class="dash-tab ${dashTab === key ? 'active' : ''}" data-dashtab="${key}" role="tab" aria-selected="${dashTab === key}">${label}</button>`).join('')}
  </div>

  ${dashTab === 'resumen' ? `
  <!-- KPIs generales -->
  <div class="kpi-grid" style="margin-bottom:16px;">
    <div class="kpi-card"><div class="kpi-top"><span class="kpi-ico">${iconPaw}</span></div><div class="kpi-num">${st.total}</div><div class="kpi-lbl">Mascotas registradas</div>${st.thisMonth ? `<div class="kpi-delta">+${st.thisMonth} este mes</div>` : ''}</div>
    <div class="kpi-card"><div class="kpi-top"><span class="kpi-ico">${iconCheckCircle}</span></div><div class="kpi-num">${st.active}</div><div class="kpi-lbl">Mascotas activas</div></div>
    <div class="kpi-card"><div class="kpi-top"><span class="kpi-ico grey">${iconPlus}</span></div><div class="kpi-num">${st.inactive}</div><div class="kpi-lbl">Mascotas inactivas</div></div>
    <div class="kpi-card"><div class="kpi-top"><span class="kpi-ico red">${iconAlert}</span></div><div class="kpi-num">${st.lost}</div><div class="kpi-lbl">Mascotas perdidas</div>${st.lost ? `<div class="kpi-delta warn">Requieren atención</div>` : ''}</div>
    <div class="kpi-card"><div class="kpi-top"><span class="kpi-ico gold">${iconCard}</span></div><div class="kpi-num">${st.total}</div><div class="kpi-lbl">Carnets emitidos</div></div>
    <div class="kpi-card"><div class="kpi-top"><span class="kpi-ico">${iconPlus}</span></div><div class="kpi-num">${st.thisMonth}</div><div class="kpi-lbl">Registradas este mes</div></div>
  </div>` : ''}

  ${dashTab === 'salud' ? `
  <!-- KPIs de salud -->
  <div class="kpi-grid" style="margin-bottom:16px;">
    <div class="kpi-card"><div class="kpi-top"><span class="kpi-ico">${iconCheckCircle}</span></div><div class="kpi-num">${hs.totalVacunasAplicadas}</div><div class="kpi-lbl">Vacunas aplicadas</div><div class="kpi-delta">${hs.vacunasPendientes} pendiente${hs.vacunasPendientes !== 1 ? 's' : ''}</div></div>
    <div class="kpi-card"><div class="kpi-top"><span class="kpi-ico">${iconAlert}</span></div><div class="kpi-num">${hs.totalVacunas}</div><div class="kpi-lbl">Total vacunas</div><div class="kpi-delta">${hs.pctVacunas}% al día</div></div>
    <div class="kpi-card"><div class="kpi-top"><span class="kpi-ico">${iconCheckCircle}</span></div><div class="kpi-num">${hs.totalDesparasitacionesAplicadas}</div><div class="kpi-lbl">Desparasitaciones aplicadas</div><div class="kpi-delta">${hs.desparasitacionesPendientes} pendiente${hs.desparasitacionesPendientes !== 1 ? 's' : ''}</div></div>
    <div class="kpi-card"><div class="kpi-top"><span class="kpi-ico">${iconPlus}</span></div><div class="kpi-num">${hs.totalDesparasitaciones}</div><div class="kpi-lbl">Total desparasitaciones</div><div class="kpi-delta">${hs.pctDesparasitaciones}% al día</div></div>
    <div class="kpi-card"><div class="kpi-top"><span class="kpi-ico">${iconCard}</span></div><div class="kpi-num">${hs.totalHistorial}</div><div class="kpi-lbl">Registros clínicos</div></div>
    <div class="kpi-card"><div class="kpi-top"><span class="kpi-ico">${iconPaw}</span></div><div class="kpi-num">${hs.mascotasConSalud}</div><div class="kpi-lbl">Mascotas con historial</div></div>
  </div>` : ''}

  <div class="dash12">
    ${dashTab === 'resumen' ? `<div class="panel span-4"><div class="dash-sec-title"><span>Estados de registro</span></div><div class="chart-box short"><canvas id="chart-status"></canvas></div></div>` : ''}
    ${dashTab === 'padron' ? `<div class="panel span-4"><div class="dash-sec-title"><span>Rangos de peso</span></div><div class="chart-box short"><canvas id="chart-weight"></canvas></div></div>` : ''}
    ${dashTab === 'alertas' ? `<div class="panel span-6"><div class="dash-sec-title"><span>Calidad de fichas</span></div><div class="chart-box short"><canvas id="chart-quality"></canvas></div><div class="mini-note">Campos completos sobre ${st.total} mascotas.</div></div>` : ''}
    ${dashTab === 'resumen' ? `
    <!-- Gráfico: registros de mascotas por mes -->
    <div class="panel span-8">
      <div class="dash-sec-title"><span>Registros de mascotas</span></div>
      <div class="sec-sub" style="margin:-8px 0 10px;">Nuevas mascotas por mes · últimos 12 meses</div>
      <div class="chart-box"><canvas id="chart-months"></canvas></div>
    </div>` : ''}

    ${dashTab === 'salud' ? `
    <!-- Gráfico: estado de salud (vacunas/desparasitaciones) -->
    <div class="panel span-4">
      <div class="dash-sec-title"><span>Estado de salud</span></div>
      <div class="donut-wrap">
        <div class="donut-box">
          <canvas id="chart-health" width="132" height="132"></canvas>
          <div class="donut-center"><b>${hs.totalVacunasAplicadas + hs.totalDesparasitacionesAplicadas}</b><span>aplicadas</span></div>
        </div>
        <div class="legend">
          <div class="legend-row"><span class="sw" style="background:#16B79A;"></span>Aplicadas<b>${hs.totalVacunasAplicadas + hs.totalDesparasitacionesAplicadas}</b><span class="pct">${hs.totalVacunas + hs.totalDesparasitaciones ? Math.round(((hs.totalVacunasAplicadas + hs.totalDesparasitacionesAplicadas) / (hs.totalVacunas + hs.totalDesparasitaciones)) * 100) : 0}%</span></div>
          <div class="legend-row"><span class="sw" style="background:#E85A5A;"></span>Pendientes<b>${hs.vacunasPendientes + hs.desparasitacionesPendientes}</b><span class="pct">${hs.totalVacunas + hs.totalDesparasitaciones ? Math.round(((hs.vacunasPendientes + hs.desparasitacionesPendientes) / (hs.totalVacunas + hs.totalDesparasitaciones)) * 100) : 0}%</span></div>
        </div>
      </div>
      <div class="mini-note">Vacunas y desparasitaciones del sistema</div>
    </div>` : ''}

    ${dashTab === 'padron' ? `
    <!-- Distribución por especie -->
    <div class="panel span-4">
      <div class="dash-sec-title"><span>Distribución por especie</span></div>
      <div class="donut-wrap">
        <div class="donut-box">
          <canvas id="chart-species" width="132" height="132"></canvas>
          <div class="donut-center"><b>${st.total}</b><span>${st.total === 1 ? 'Mascota' : 'Mascotas'}</span></div>
        </div>
        <div class="legend">
          <div class="legend-row"><span class="sw" style="background:#16B79A;"></span><span>${iconDog.replace('<svg', '<svg width="14" height="14"')}</span>Perros<b>${st.dogs}</b><span class="pct">${pct(st.dogs)}%</span></div>
          <div class="legend-row"><span class="sw" style="background:#C89A3D;"></span><span>${iconCat.replace('<svg', '<svg width="14" height="14"')}</span>Gatos<b>${st.cats}</b><span class="pct">${pct(st.cats)}%</span></div>
          <div class="legend-row"><span class="sw" style="background:#9aa7a0;"></span>Otros<b>${st.others}</b><span class="pct">${pct(st.others)}%</span></div>
        </div>
      </div>
      <div class="mini-note">Activas ${st.active} · Inactivas ${st.inactive} · Perdidas ${st.lost}</div>
    </div>` : ''}

    ${dashTab === 'resumen' ? `
    <!-- Mascotas recientes -->
    <div class="panel span-8 table-span">
      <div class="dash-sec-title"><span>Mascotas registradas recientemente</span><button class="btn btn-ghost btn-sm" data-nav="mascotas">Ver todas</button></div>
      ${latest.length ? `<div style="overflow-x:auto;"><table class="records-table"><thead><tr><th>Mascota</th><th>Especie</th><th>Sexo</th><th>Edad</th><th>Propietario</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>
        ${latest.map(p => `
          <tr data-pet="${p.id}" style="cursor:pointer;">
            <td><div style="display:flex;align-items:center;gap:10px;"><img class="pet-thumb" src="${p.photo || placeholderPhoto()}" alt=""><b>${escapeHtml(p.name)}</b></div></td>
            <td class="faint">${speciesShort(p.species)}</td>
            <td class="faint">${escapeHtml(p.sex || '—')}</td>
            <td class="faint">${ageShort(p)}</td>
            <td class="faint">${escapeHtml(p.owner_name || '—')}</td>
            <td>${statusBadge(p.status)}</td>
            <td class="faint" style="font-size:12px; white-space:nowrap;">${escapeHtml(p.registration_date || '')}</td>
          </tr>`).join('')}
      </tbody></table></div>` : `<div class="empty-state" style="padding:28px 16px;"><div><b>Todavía no hay fichas</b><p>Registra la primera mascota para verla aquí.</p></div></div>`}
    </div>` : ''}

    ${dashTab === 'salud' ? `
    <!-- Próximas citas de salud -->
    <div class="panel span-4">
      <div class="dash-sec-title"><span>Próximas citas</span><button class="btn btn-ghost btn-sm" data-nav="mascotas">Gestionar salud</button></div>
      ${hs.proximasCitas.length ? `<div class="activity-list">
        ${hs.proximasCitas.map(c => `
          <div class="activity-row">
            <span class="dot" style="background:${c.type === 'vacuna' ? '#16B79A' : '#C89A3D'}"></span>
            <div class="activity-main">
              <div style="font-weight:600;">${escapeHtml(c.title)}</div>
              <div style="font-size:11px; color:var(--text-2);">${escapeHtml(c.petName)} · ${c.type === 'vacuna' ? 'Vacuna' : 'Desparasitación'}</div>
            </div>
            <div style="font-size:11px; color:var(--text-2); white-space:nowrap;">${fmtDateDash(c.date)}</div>
          </div>
        `).join('')}
      </div>` : `<p class="faint" style="text-align:center; padding:20px 0;">Sin citas programadas.</p>`}
    </div>` : ''}

    ${dashTab === 'actividad' ? `
    <!-- Actividad reciente -->
    <div class="panel span-6">
      <div class="dash-sec-title"><span>Actividad reciente</span><button class="btn btn-ghost btn-sm" data-nav="historial">Historial</button></div>
      ${groups.length ? groups.map(g => `
        <div class="act-day">${escapeHtml(g.label)}</div>
        ${g.items.slice(0, 4).map(h => `
          <div class="act-item">
            <span class="act-time">${escapeHtml((h.time || '').slice(0, 5))}</span>
            <div class="act-body"><b>${escapeHtml(describeHistory(h))}</b><div class="act-obj">${escapeHtml(h.user || '')}</div></div>
          </div>`).join('')}
      `).join('') : `<p class="faint">Sin actividad registrada.</p>`}
    </div>` : ''}

    ${dashTab === 'padron' ? `
    <!-- Edad -->
    <div class="panel span-4">
      <div class="dash-sec-title"><span>Edad de las mascotas</span></div>
      <div class="hbar-list">
        ${ageEntries.map(([label, v]) => `
          <div class="hbar-row"><span class="hb-lbl">${label}</span><b>${v}</b>
          <div class="hbar-track"><i style="width:${st.total ? Math.round((v / Math.max(st.total, 1)) * 100) : 0}%;"></i></div></div>`).join('')}
      </div>
      <div class="mini-note">Calculada desde años/meses registrados.</div>
    </div>` : ''}

    ${dashTab === 'padron' ? `
    <!-- Sexo y esterilización -->
    <div class="panel span-4">
      <div class="dash-sec-title"><span>Sexo y esterilización</span></div>
      <div class="sex-row"><span class="sex-dot" style="background:#16B79A;"></span>Machos<b style="margin-left:auto;">${st.males}</b><span class="faint">${pctOf(st.males, sexTotal)}%</span></div>
      <div class="sex-row"><span class="sex-dot" style="background:#C89A3D;"></span>Hembras<b style="margin-left:auto;">${st.females}</b><span class="faint">${pctOf(st.females, sexTotal)}%</span></div>
      ${st.sexND ? `<div class="sex-row"><span class="sex-dot" style="background:#9aa7a0;"></span>Sin registrar<b style="margin-left:auto;">${st.sexND}</b></div>` : ''}
      <div class="act-day">Esterilización</div>
      <div class="sex-row"><span class="sex-dot" style="background:#16B79A;"></span>Esterilizados<b style="margin-left:auto;">${st.sterilized}</b></div>
      <div class="sex-row"><span class="sex-dot" style="background:#E3E9E7; border:1px solid #c6d0cc;"></span>Sin registrar<b style="margin-left:auto;">${unster}</b></div>
      <div class="mini-note">Según información de la ficha médica.</div>
    </div>` : ''}

    ${dashTab === 'alertas' ? `
    <!-- Atención -->
    <div class="panel span-6">
      <div class="dash-sec-title"><span>Atención</span></div>
      <div class="alert-row red"><div class="alert-num">${st.lost}</div><div><div class="a-lbl">Mascotas reportadas perdidas</div><div class="a-sub">Requieren seguimiento</div></div></div>
      <div class="alert-row gold"><div class="alert-num">${st.incomplete}</div><div><div class="a-lbl">Registros incompletos</div><div class="a-sub">Sin raza, foto o peso</div></div></div>
      <div class="alert-row"><div class="alert-num">${st.pendingCards}</div><div><div class="a-lbl">Carnets pendientes</div><div class="a-sub">Emitidos sin impresión registrada</div></div></div>
      <div class="alert-row"><div class="alert-num">${hs.vacunasPendientes + hs.desparasitacionesPendientes}</div><div><div class="a-lbl">Dosis pendientes</div><div class="a-sub">Vacunas o desparasitaciones sin aplicar</div></div></div>
    </div>` : ''}

    ${dashTab === 'padron' ? `
    <!-- Razas más registradas -->
    <div class="panel span-4">
      <div class="dash-sec-title"><span>Razas más registradas</span></div>
      ${st.topBreeds.length ? `<div class="hbar-list">
        ${st.topBreeds.map(b => `
          <div class="hbar-row"><span class="hb-lbl">${escapeHtml(b.name)}</span><b>${b.count}</b>
          <div class="hbar-track gold"><i style="width:${Math.round((b.count / breedMax) * 100)}%;"></i></div></div>`).join('')}
      </div>` : `<p class="faint">Sin información de razas todavía.</p>`}
    </div>` : ''}

    ${dashTab === 'territorio' ? `<div class="panel span-6"><div class="dash-sec-title"><span>Ciudades con más registros</span></div><div class="chart-box short"><canvas id="chart-cities"></canvas></div></div>` : ''}
    ${dashTab === 'salud' ? `<div class="panel span-6"><div class="dash-sec-title"><span>Enfermedades crónicas registradas</span></div><div class="chart-box short"><canvas id="chart-conditions"></canvas></div>${analysis.conditions.length ? '' : '<p class="mini-note">Aún no hay enfermedades crónicas registradas.</p>'}</div>` : ''}
    ${dashTab === 'actividad' ? `<div class="panel span-6"><div class="dash-sec-title"><span>Actividad del sistema</span></div>
      <div class="chart-toggle"><button class="chip ${activityMode === 'action' ? 'active' : ''}" data-actmode="action">Por acción</button><button class="chip ${activityMode === 'day' ? 'active' : ''}" data-actmode="day">Por día</button></div>
      <div class="chart-box short"><canvas id="chart-activity"></canvas></div>
    </div>` : ''}
    ${dashTab === 'padron' ? `<div class="panel span-4"><div class="dash-sec-title"><span>Sexo del padrón</span></div><div class="chart-box short"><canvas id="chart-sex"></canvas></div></div>` : ''}
    ${dashTab === 'salud' ? `<div class="panel span-4"><div class="dash-sec-title"><span>Vacunas más registradas</span></div><div class="chart-box short"><canvas id="chart-vaccines"></canvas></div>${analysis.vaccineRank.length ? '' : '<p class="mini-note">Aún no hay vacunas registradas.</p>'}</div>` : ''}
    ${dashTab === 'alertas' ? `<div class="panel span-6"><div class="dash-sec-title"><span>Perfil de cobertura de datos</span></div><div class="chart-box short"><canvas id="chart-coverage"></canvas></div><div class="mini-note">Porcentaje de mascotas con cada dato completo.</div></div>` : ''}
    ${dashTab === 'salud' ? `<div class="panel span-6"><div class="dash-sec-title"><span>Cobertura médica extendida</span></div><div class="coverage-grid"><div><b>${analysis.sterilized}</b><span>Esterilizadas</span></div><div><b>${analysis.microchipped}</b><span>Con microchip</span></div><div><b>${analysis.bloodTyped}</b><span>Con tipo sanguíneo</span></div><div class="danger"><b>${analysis.overdue.length}</b><span>Dosis vencidas</span></div></div></div>` : ''}

    ${dashTab === 'territorio' ? `
    <!-- Propietarios -->
    <div class="panel span-6">
      <div class="dash-sec-title"><span>Propietarios</span></div>
      <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr); margin-bottom:12px;">
        <div><div class="kpi-num" style="font-size:24px;">${st.ownersCount}</div><div class="kpi-lbl">Registrados</div></div>
        <div><div class="kpi-num" style="font-size:24px;">${st.newOwnersMonth}</div><div class="kpi-lbl">Nuevos este mes</div></div>
        <div><div class="kpi-num" style="font-size:24px;">${st.avgPerOwner ? st.avgPerOwner.toFixed(1) : '—'}</div><div class="kpi-lbl">Mascotas / propietario</div></div>
      </div>
      ${st.topOwners.length ? st.topOwners.map(o => `
        <div class="owner-row"><span class="o-av">${escapeHtml(initials(o.name))}</span><span>${escapeHtml(o.name)}<div class="o-sub">${o.count} ${o.count === 1 ? 'mascota' : 'mascotas'}</div></span><b>${o.count}</b></div>`).join('') : `<p class="faint">Sin propietarios registrados.</p>`}
    </div>` : ''}
  </div>`;
}

function fmtDateDash(d) {
  if (!d) return '—';
  try { return new Date(d + 'T12:00').toLocaleDateString('es-BO', { day: 'numeric', month: 'short' }); } catch { return d; }
}

export function drawCharts() {
  Object.values(charts).forEach(c => { try { c && c.destroy(); } catch (_) {} });
  charts = {};
  if (typeof Chart === 'undefined') return;
  const pets = filteredPets();
  const st = calcDashboardStats(pets, state.getHistory());
  const hs = calcHealthStats(pets, state.getAllHealthRecordsMap());
  const analysis = dashboardAnalysis(pets);
  Chart.defaults.font.family = 'Inter, sans-serif';
  Chart.defaults.animation.duration = 200;

  const ctxM = document.getElementById('chart-months');
  if (ctxM) {
    charts.months = new Chart(ctxM, {
      type: 'line',
      data: {
        labels: st.months.map(monthShort),
        datasets: [{
          label: 'Nuevas mascotas',
          data: st.perMonth,
          borderColor: '#16B79A',
          backgroundColor: 'rgba(22,183,154,.12)',
          fill: true,
          tension: .4,
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#16B79A',
        }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#EDF1EF' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // Gráfico de salud: vacunas/desparasitaciones aplicadas vs pendientes
  const ctxH = document.getElementById('chart-health');
  if (ctxH) {
    const total = hs.totalVacunas + hs.totalDesparasitaciones;
    const applied = hs.totalVacunasAplicadas + hs.totalDesparasitacionesAplicadas;
    const pending = hs.vacunasPendientes + hs.desparasitacionesPendientes;
    charts.health = new Chart(ctxH, {
      type: 'doughnut',
      data: {
        labels: ['Aplicadas', 'Pendientes'],
        datasets: [{
          data: total ? [applied, pending] : [1],
          backgroundColor: total ? ['#16B79A', '#E85A5A'] : ['#E3E9E7'],
          borderColor: '#FFFFFF',
          borderWidth: 3,
          hoverOffset: 2
        }]
      },
      options: {
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: !!total }
        }
      }
    });
  }

  const ctx = document.getElementById('chart-species');
  if (ctx) {
    const data = [st.dogs, st.cats, st.others];
    charts.species = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Perros', 'Gatos', 'Otros'],
        datasets: [{ data: pets.length ? data : [1], backgroundColor: pets.length ? ['#16B79A', '#C89A3D', '#9aa7a0'] : ['#E3E9E7'], borderColor: '#FFFFFF', borderWidth: 3, hoverOffset: 2 }]
      },
      options: { cutout: '72%', plugins: { legend: { display: false }, tooltip: { enabled: !!pets.length } } }
    });
  }

  const barOptions = (horizontal = false) => ({
    maintainAspectRatio: false, indexAxis: horizontal ? 'y' : 'x',
    plugins: { legend: { display: false } },
    scales: {
      x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#EDF1EF' } },
      y: { beginAtZero: true, ticks: { precision: 0 }, grid: { display: horizontal ? false : true, color: '#EDF1EF' } }
    }
  });
  const renderBar = (id, labels, values, color, horizontal = false) => {
    const canvas = document.getElementById(id); if (!canvas) return;
    charts[id] = new Chart(canvas, { type: 'bar', data: { labels, datasets: [{ data: values, backgroundColor: color, borderRadius: 6, maxBarThickness: 32 }] }, options: barOptions(horizontal) });
  };
  renderBar('chart-status', ['Activas', 'Inactivas', 'Perdidas'], [st.active, st.inactive, st.lost], ['#16B79A', '#9aa7a0', '#E85A5A']);
  renderBar('chart-weight', Object.keys(analysis.weights), Object.values(analysis.weights), '#2F6FB5');
  renderBar('chart-quality', Object.keys(analysis.quality), Object.values(analysis.quality), '#16B79A');
  renderBar('chart-cities', analysis.cities.map(x => x[0]), analysis.cities.map(x => x[1]), '#C89A3D', true);
  renderBar('chart-vaccines', analysis.vaccineRank.map(x => x[0]), analysis.vaccineRank.map(x => x[1]), '#2F6FB5', true);
  renderActivityChart();

  // Sexo del padrón
  const sexCanvas = document.getElementById('chart-sex');
  if (sexCanvas) {
    const hasSex = st.males + st.females + st.sexND > 0;
    charts.sex = new Chart(sexCanvas, {
      type: 'doughnut',
      data: { labels: ['Machos', 'Hembras', 'Sin registrar'], datasets: [{ data: hasSex ? [st.males, st.females, st.sexND] : [1], backgroundColor: hasSex ? ['#16B79A', '#C89A3D', '#9aa7a0'] : ['#E3E9E7'], borderColor: '#fff', borderWidth: 3, hoverOffset: 2 }] },
      options: { cutout: '66%', plugins: { legend: { display: true, position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } } }
    });
  }

  // Perfil de cobertura (radar, % de mascotas con cada dato)
  const covCanvas = document.getElementById('chart-coverage');
  if (covCanvas) {
    const total = Math.max(1, st.total);
    const coverage = Object.values(analysis.quality).map(v => Math.round((v / total) * 100));
    charts.coverage = new Chart(covCanvas, {
      type: 'radar',
      data: { labels: Object.keys(analysis.quality), datasets: [{ data: coverage, backgroundColor: 'rgba(22,183,154,.18)', borderColor: '#16B79A', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#16B79A' }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { r: { beginAtZero: true, max: 100, ticks: { display: false, stepSize: 25 }, grid: { color: '#EDF1EF' }, pointLabels: { font: { size: 10 } } } } }
    });
  }

  const conditionsCanvas = document.getElementById('chart-conditions');
  if (conditionsCanvas) {
    const hasConditions = analysis.conditions.length > 0;
    charts.conditions = new Chart(conditionsCanvas, {
      type: 'doughnut',
      data: { labels: hasConditions ? analysis.conditions.map(x => x[0]) : ['Sin registros'], datasets: [{ data: hasConditions ? analysis.conditions.map(x => x[1]) : [1], backgroundColor: hasConditions ? ['#C8312B', '#F2B705', '#2E8B4F', '#2F6FB5', '#7B61FF', '#E85A5A'] : ['#E3E9E7'], borderWidth: 2, borderColor: '#fff' }] },
      options: { maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } } }
    });
  }
}

export function bindDashboardEvents() {
  document.querySelectorAll('[data-dashboard-filter]').forEach(element => element.addEventListener('change', event => {
    dashFilters[event.target.dataset.dashboardFilter] = event.target.value;
    import('../app.js').then(module => module.renderView());
  }));
  document.getElementById('btn-dashboard-reset')?.addEventListener('click', () => {
    dashFilters = { period: 'all', species: '', status: '', city: '' };
    import('../app.js').then(module => module.renderView());
  });
  document.querySelectorAll('[data-dash-status]').forEach(el => el.addEventListener('click', () => {
    dashFilters.status = el.dataset.dashStatus === dashFilters.status ? '' : el.dataset.dashStatus;
    import('../app.js').then(module => module.renderView());
  }));
  document.querySelectorAll('[data-dashtab]').forEach(el => el.addEventListener('click', () => {
    dashTab = el.dataset.dashtab;
    import('../app.js').then(module => module.renderView());
  }));
  document.querySelectorAll('[data-actmode]').forEach(el => el.addEventListener('click', () => {
    activityMode = el.dataset.actmode;
    document.querySelectorAll('[data-actmode]').forEach(x => x.classList.toggle('active', x === el));
    renderActivityChart();
  }));
  document.getElementById('btn-dashboard-refresh')?.addEventListener('click', async () => {
    toast('Actualizando datos…');
    try {
      await Promise.all([state.loadPets(), state.loadHistory(), state.loadAnalytics()]);
      import('../app.js').then(module => module.renderView());
      toast('Datos actualizados');
    } catch (error) { toast(error.message, 'error'); }
  });
  document.getElementById('btn-dashboard-export')?.addEventListener('click', exportDashboardCsv);
}

/* ---------- Gráfico de actividad con modo conmutable ---------- */
export function renderActivityChart() {
  const canvas = document.getElementById('chart-activity');
  if (!canvas || typeof Chart === 'undefined') return;
  if (charts.activity) { try { charts.activity.destroy(); } catch (_) { } charts.activity = null; }
  const analysis = dashboardAnalysis(filteredPets());
  if (activityMode === 'day') {
    const points = analysis.dailyActivity;
    charts.activity = new Chart(canvas, {
      type: 'line',
      data: {
        labels: points.map(x => `${Number(x[0].slice(8))}/${Number(x[0].slice(5, 7))}`),
        datasets: [{ label: 'Acciones por día', data: points.map(x => x[1]), borderColor: '#C89A3D', backgroundColor: 'rgba(200,154,61,.12)', fill: true, tension: .35, borderWidth: 2, pointRadius: 3 }]
      },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#EDF1EF' } }, x: { grid: { display: false } } } }
    });
  } else {
    charts.activity = new Chart(canvas, {
      type: 'bar',
      data: { labels: Object.keys(analysis.actionGroups), datasets: [{ data: Object.values(analysis.actionGroups), backgroundColor: '#2E8B4F', borderRadius: 6, maxBarThickness: 32 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#EDF1EF' } }, y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#EDF1EF' } } } }
    });
  }
}

/* ---------- Exportación CSV de la selección ---------- */
function exportDashboardCsv() {
  const pets = filteredPets();
  if (!pets.length) return toast('No hay mascotas en la selección actual', 'error');
  const head = ['Nombre', 'N° Carnet', 'Registro BOL-CAR', 'Especie', 'Raza', 'Sexo', 'Estado', 'Propietario', 'Teléfono', 'Ciudad', 'Microchip'];
  const rows = pets.map(p => [
    p.name, p.carnet_number, p.ci_number || '', speciesShort(p.species), p.breed || '', p.sex || '', p.status || '',
    p.owner_name || '', p.owner_phone || '', p.owner_city || '', p.has_chip ? `Sí: ${p.chip || ''}` : 'No'
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
