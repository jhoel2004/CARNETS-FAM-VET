import { escapeHtml, statusBadge, placeholderPhoto, groupHistoryByDay, describeHistory, calcDashboardStats, pctOf, monthShort, petAgeYears } from '../utils.js';
import { iconPaw, iconCheckCircle, iconAlert, iconCard, iconPlus, iconDog, iconCat } from '../icons.js';

let state = null;
let charts = {};

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

export function viewDashboard() {
  const pets = state.getPets();
  const st = calcDashboardStats(pets, state.getHistory());
  const pct = (v) => pctOf(v, st.total);

  const sorted = [...pets].sort((a, b) => new Date(b.registration_date) - new Date(a.registration_date));
  const latest = sorted.slice(0, 8);
  const groups = groupHistoryByDay(state.getHistory().slice(0, 10));

  const ageEntries = Object.entries(st.byAge);
  const ageMax = Math.max(1, ...ageEntries.map(([, v]) => v));
  const breedMax = Math.max(1, ...st.topBreeds.map(b => b.count));
  const sexTotal = st.males + st.females + st.sexND;
  const unster = Math.max(0, st.total - st.sterilized);

  return `
  <div class="page-head"><div><h1>Panel principal</h1><p>Resumen de registros y carnets · FAM J VET Bolivia</p></div></div>

  <div class="kpi-grid" style="margin-bottom:16px;">
    <div class="kpi-card"><div class="kpi-top"><span class="kpi-ico">${iconPaw}</span></div><div class="kpi-num">${st.total}</div><div class="kpi-lbl">Mascotas registradas</div>${st.thisMonth ? `<div class="kpi-delta">+${st.thisMonth} este mes</div>` : ''}</div>
    <div class="kpi-card"><div class="kpi-top"><span class="kpi-ico">${iconCheckCircle}</span></div><div class="kpi-num">${st.active}</div><div class="kpi-lbl">Mascotas activas</div></div>
    <div class="kpi-card"><div class="kpi-top"><span class="kpi-ico grey">${iconPlus}</span></div><div class="kpi-num">${st.inactive}</div><div class="kpi-lbl">Mascotas inactivas</div></div>
    <div class="kpi-card"><div class="kpi-top"><span class="kpi-ico red">${iconAlert}</span></div><div class="kpi-num">${st.lost}</div><div class="kpi-lbl">Mascotas perdidas</div>${st.lost ? `<div class="kpi-delta warn">Requieren atención</div>` : ''}</div>
    <div class="kpi-card"><div class="kpi-top"><span class="kpi-ico gold">${iconCard}</span></div><div class="kpi-num">${st.total}</div><div class="kpi-lbl">Carnets emitidos</div></div>
    <div class="kpi-card"><div class="kpi-top"><span class="kpi-ico">${iconPlus}</span></div><div class="kpi-num">${st.thisMonth}</div><div class="kpi-lbl">Registradas este mes</div></div>
  </div>

  <div class="dash12">
    <div class="panel span-8">
      <div class="dash-sec-title"><span>Registros de mascotas</span></div>
      <div class="sec-sub" style="margin:-8px 0 10px;">Nuevas mascotas por mes · últimos 12 meses</div>
      <div class="chart-box"><canvas id="chart-months"></canvas></div>
    </div>
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
    </div>

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
    </div>
    <div class="panel span-4">
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

    <div class="panel span-4">
      <div class="dash-sec-title"><span>Edad de las mascotas</span></div>
      <div class="hbar-list">
        ${ageEntries.map(([label, v]) => `
          <div class="hbar-row"><span class="hb-lbl">${label}</span><b>${v}</b>
          <div class="hbar-track"><i style="width:${st.total ? Math.round((v / Math.max(st.total, 1)) * 100) : 0}%;"></i></div></div>`).join('')}
      </div>
      <div class="mini-note">Calculada desde años/meses registrados.</div>
    </div>
    <div class="panel span-4">
      <div class="dash-sec-title"><span>Sexo y esterilización</span></div>
      <div class="sex-row"><span class="sex-dot" style="background:#16B79A;"></span>Machos<b style="margin-left:auto;">${st.males}</b><span class="faint">${pctOf(st.males, sexTotal)}%</span></div>
      <div class="sex-row"><span class="sex-dot" style="background:#C89A3D;"></span>Hembras<b style="margin-left:auto;">${st.females}</b><span class="faint">${pctOf(st.females, sexTotal)}%</span></div>
      ${st.sexND ? `<div class="sex-row"><span class="sex-dot" style="background:#9aa7a0;"></span>Sin registrar<b style="margin-left:auto;">${st.sexND}</b></div>` : ''}
      <div class="act-day">Esterilización</div>
      <div class="sex-row"><span class="sex-dot" style="background:#16B79A;"></span>Esterilizados<b style="margin-left:auto;">${st.sterilized}</b></div>
      <div class="sex-row"><span class="sex-dot" style="background:#E3E9E7; border:1px solid #c6d0cc;"></span>Sin registrar<b style="margin-left:auto;">${unster}</b></div>
      <div class="mini-note">Según información de la ficha médica.</div>
    </div>
    <div class="panel span-4">
      <div class="dash-sec-title"><span>Atención</span></div>
      <div class="alert-row red"><div class="alert-num">${st.lost}</div><div><div class="a-lbl">Mascotas reportadas perdidas</div><div class="a-sub">Requieren seguimiento</div></div></div>
      <div class="alert-row gold"><div class="alert-num">${st.incomplete}</div><div><div class="a-lbl">Registros incompletos</div><div class="a-sub">Sin raza, foto o peso</div></div></div>
      <div class="alert-row"><div class="alert-num">${st.pendingCards}</div><div><div class="a-lbl">Carnets pendientes</div><div class="a-sub">Emitidos sin impresión registrada</div></div></div>
    </div>

    <div class="panel span-6">
      <div class="dash-sec-title"><span>Razas más registradas</span></div>
      ${st.topBreeds.length ? `<div class="hbar-list">
        ${st.topBreeds.map(b => `
          <div class="hbar-row"><span class="hb-lbl">${escapeHtml(b.name)}</span><b>${b.count}</b>
          <div class="hbar-track gold"><i style="width:${Math.round((b.count / breedMax) * 100)}%;"></i></div></div>`).join('')}
      </div>` : `<p class="faint">Sin información de razas todavía.</p>`}
    </div>
    <div class="panel span-6">
      <div class="dash-sec-title"><span>Propietarios</span></div>
      <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr); margin-bottom:12px;">
        <div><div class="kpi-num" style="font-size:24px;">${st.ownersCount}</div><div class="kpi-lbl">Registrados</div></div>
        <div><div class="kpi-num" style="font-size:24px;">${st.newOwnersMonth}</div><div class="kpi-lbl">Nuevos este mes</div></div>
        <div><div class="kpi-num" style="font-size:24px;">${st.avgPerOwner ? st.avgPerOwner.toFixed(1) : '—'}</div><div class="kpi-lbl">Mascotas / propietario</div></div>
      </div>
      ${st.topOwners.length ? st.topOwners.map(o => `
        <div class="owner-row"><span class="o-av">${escapeHtml(initials(o.name))}</span><span>${escapeHtml(o.name)}<div class="o-sub">${o.count} ${o.count === 1 ? 'mascota' : 'mascotas'}</div></span><b>${o.count}</b></div>`).join('') : `<p class="faint">Sin propietarios registrados.</p>`}
    </div>
  </div>`;
}

export function drawCharts() {
  Object.values(charts).forEach(c => { try { c && c.destroy(); } catch (_) {} });
  charts = {};
  if (typeof Chart === 'undefined') return;
  const pets = state.getPets();
  const st = calcDashboardStats(pets, state.getHistory());
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
}
