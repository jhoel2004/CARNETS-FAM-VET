/* ============================================================
   Vista "Salud": listas reales fedidas de /api/pets/analytics
   Subpestañas: vacunación · desparasitación · enfermedades ·
   esterilización · historial clínico · próximas atenciones
   ============================================================ */
import { escapeHtml, placeholderPhoto, toast } from '../utils.js';
import { openPetDetail, openPetModal } from './pets.js';

let state = null;
let subtab = 'vacunacion';

const SUBTABS = [
  ['vacunacion', 'Vacunación'],
  ['desparasitacion', 'Desparasitación'],
  ['enfermedades', 'Enfermedades'],
  ['esterilizacion', 'Esterilización'],
  ['historial', 'Historial clínico'],
  ['agenda', 'Próximas atenciones'],
];

export function initSalud(s) { state = s; }
export function getSaludSubtab() { return subtab; }
export function setSaludSubtab(t) { if (SUBTABS.some(([k]) => k === t)) subtab = t; }

function allRecords() {
  const a = state.getAnalytics() || {};
  return a.healthRecords || [];
}
function allDetails() {
  const a = state.getAnalytics() || {};
  return a.medicalDetails || [];
}
function petById(id) {
  return state.getPets().find(p => p.id === id);
}
function todayIso() { return new Date().toISOString().slice(0, 10); }
function doseStatus(r) {
  if (r.applied) return ['Aplicada', 'badge active'];
  if ((r.next_due || r.record_date) && (r.next_due || r.record_date) < todayIso()) return ['Vencida', 'badge lost'];
  return ['Pendiente', 'badge pending'];
}
function miniThumb(p) {
  return `<img class="pet-thumb" src="${(p && p.photo) || placeholderPhoto()}" alt="" style="width:28px;height:28px;">`;
}

/* ---------- KPIs superiores ---------- */
function kpiRow(records) {
  let vacA = 0, vacP = 0, vacV = 0, desA = 0, desP = 0, desV = 0;
  const today = todayIso();
  records.forEach(r => {
    if (r.type === 'vacuna') {
      if (r.applied) vacA++;
      else if ((r.next_due || r.record_date) && (r.next_due || r.record_date) < today) vacV++;
      else vacP++;
    } else if (r.type === 'desparasitacion') {
      if (r.applied) desA++;
      else if ((r.next_due || r.record_date) && (r.next_due || r.record_date) < today) desV++;
      else desP++;
    }
  });
  const cards = [
    ['Vacunas aplicadas', vacA, ''], ['Vacunas pendientes', vacP, 'gold'], ['Vacunas vencidas', vacV, 'red'],
    ['Desparasitaciones aplicadas', desA, ''], ['Desparasitaciones pendientes', desP, 'gold'], ['Desparasitaciones vencidas', desV, 'red'],
  ];
  return `<div class="kpi-grid" style="grid-template-columns:repeat(6,1fr); margin-bottom:18px;">
    ${cards.map(([l, n, cls]) => `<div class="kpi-card" style="cursor:default;">
      <div class="kpi-top"><span class="kpi-ico ${cls}"></span><span class="kpi-lbl">${l}</span></div>
      <div class="kpi-num" style="font-size:24px;">${n}</div>
    </div>`).join('')}
  </div>`;
}

/* ---------- Tabla común de dosis ---------- */
function doseTableHtml(records, type) {
  const rows = records
    .filter(r => r.type === type)
    .sort((a, b) => {
      const sa = a.applied ? 2 : ((a.next_due || a.record_date || '') < todayIso() ? 0 : 1);
      const sb = b.applied ? 2 : ((b.next_due || b.record_date || '') < todayIso() ? 0 : 1);
      if (sa !== sb) return sa - sb;
      return (a.next_due || a.record_date || '').localeCompare(b.next_due || b.record_date || '');
    });
  if (!rows.length) {
    return `<div class="empty-state"><div><b>Sin registros</b><p>Usa "Editar salud" en una mascota para agregar la primera ${type === 'vacuna' ? 'vacuna' : 'desparasitación'}.</p></div></div>`;
  }
  return `<div style="overflow-x:auto;"><table class="records-table">
    <thead><tr><th>Mascota</th><th>${type === 'vacuna' ? 'Vacuna' : 'Producto'}</th><th>Fecha aplicada</th><th>Próxima</th><th>Estado</th><th>Veterinaria</th><th></th></tr></thead>
    <tbody>
      ${rows.slice(0, 40).map(r => {
    const p = petById(r.pet_id);
    const [label, cls] = doseStatus(r);
    return `
      <tr>
        <td><div style="display:flex; align-items:center; gap:9px;">${miniThumb(p)}<div><b>${escapeHtml(p ? p.name : '—')}</b><div class="faint" style="font-size:11px;">${escapeHtml(p ? p.carnet_number : '')}</div></div></div></td>
        <td>${escapeHtml(r.title || '—')}</td>
        <td class="faint">${r.applied ? escapeHtml(r.record_date || '—') : '—'}</td>
        <td class="faint">${escapeHtml(r.next_due || '—')}</td>
        <td><span class="${cls}" style="display:inline-flex; align-items:center; gap:5px; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:700; border:1px solid transparent;">${label}</span></td>
        <td class="faint">${escapeHtml(r.vet || p?.medical_vet || '—')}</td>
        <td><button class="btn btn-ghost btn-sm" data-health-edit="${r.pet_id}">Editar salud</button></td>
      </tr>`;
  }).join('')}
    </tbody>
  </table></div>
  ${rows.length > 40 ? `<p class="faint" style="margin-top:10px; font-size:12px;">Mostrando 40 de ${rows.length} registros.</p>` : ''}`;
}

/* ---------- Enfermedades y esterilización ---------- */
function conditionsHtml() {
  const details = allDetails().filter(d => petById(d.pet_id));
  const rows = [];
  details.forEach(d => {
    let list = [];
    try { list = JSON.parse(d.conditions_detail || '[]'); } catch { list = []; }
    list.filter(x => x && (x.name || '').trim()).forEach(x => rows.push({ petId: d.pet_id, name: String(x.name).trim(), notes: x.notes || x.note || '' }));
  });
  if (!rows.length) return `<div class="empty-state"><div><b>Sin enfermedades crónicas registradas</b><p>Aparecerán aquí cuando se registren en la ficha médica.</p></div></div>`;
  return `<div style="overflow-x:auto;"><table class="records-table">
    <thead><tr><th>Mascota</th><th>Enfermedad</th><th>Notas</th><th></th></tr></thead><tbody>
    ${rows.slice(0, 40).map(r => {
    const p = petById(r.petId);
    return `<tr><td><div style="display:flex; align-items:center; gap:9px;">${miniThumb(p)}<b>${escapeHtml(p.name)}</b></div></td><td>${escapeHtml(r.name)}</td><td class="faint">${escapeHtml(r.notes || '—')}</td><td><button class="btn btn-ghost btn-sm" data-health-edit="${r.petId}">Editar salud</button></td></tr>`;
  }).join('')}
    </tbody></table></div>`;
}
function sterilizationHtml() {
  const details = allDetails().filter(d => petById(d.pet_id));
  const yes = details.filter(d => !!d.sterilized);
  const nd = state.getPets().length - yes.length;
  return `
  <div class="kpi-grid" style="grid-template-columns:repeat(2,1fr); margin-bottom:14px;">
    <div class="kpi-card" style="cursor:default;"><div class="kpi-top"><span class="kpi-ico"></span><span class="kpi-lbl">Esterilizadas</span></div><div class="kpi-num" style="font-size:24px;">${yes.length}</div></div>
    <div class="kpi-card" style="cursor:default;"><div class="kpi-top"><span class="kpi-ico grey"></span><span class="kpi-lbl">Sin registrar</span></div><div class="kpi-num" style="font-size:24px;">${nd}</div></div>
  </div>
  ${yes.length ? `<div style="overflow-x:auto;"><table class="records-table"><thead><tr><th>Mascota</th><th>Especie</th><th>Tipo de sangre</th><th></th></tr></thead><tbody>
    ${yes.slice(0, 30).map(d => {
    const p = petById(d.pet_id);
    return `<tr><td><div style="display:flex; align-items:center; gap:9px;">${miniThumb(p)}<b>${escapeHtml(p.name)}</b></div></td><td class="faint">${escapeHtml(p.species || '—')}</td><td class="faint">${escapeHtml(d.blood_type || '—')}</td><td><button class="btn btn-ghost btn-sm" data-health-edit="${p.id}">Editar salud</button></td></tr>`;
  }).join('')}
  </tbody></table></div>` : `<p class="faint">Sin mascotas esterilizadas registradas todavía.</p>`}`;
}

/* ---------- Historial clínico y agenda ---------- */
function historyHtml(records) {
  const rows = records.filter(r => r.type === 'historial').sort((a, b) => (b.record_date || '').localeCompare(a.record_date || ''));
  if (!rows.length) return `<div class="empty-state"><div><b>Sin notas clínicas</b><p>Las notas de tipo "historial" del expediente aparecen aquí.</p></div></div>`;
  return `<div style="overflow-x:auto;"><table class="records-table"><thead><tr><th>Mascota</th><th>Nota</th><th>Fecha</th><th>Veterinaria</th></tr></thead><tbody>
    ${rows.slice(0, 40).map(r => {
    const p = petById(r.pet_id);
    return `<tr><td><div style="display:flex; align-items:center; gap:9px;">${miniThumb(p)}<b>${escapeHtml(p ? p.name : '—')}</b></div></td><td>${escapeHtml(r.title || '—')} ${r.weight ? `<span class="faint">· ${r.weight} kg</span>` : ''}</td><td class="faint">${escapeHtml(r.record_date || '')}</td><td class="faint">${escapeHtml(r.vet || '—')}</td></tr>`;
  }).join('')}
  </tbody></table></div>`;
}
function agendaHtml(records) {
  const today = todayIso();
  const rows = records
    .filter(r => !r.applied && r.next_due && r.next_due >= today)
    .sort((a, b) => (a.next_due || '').localeCompare(b.next_due || ''));
  if (!rows.length) return `<div class="empty-state"><div><b>Sin próximas atenciones</b><p>Las dosis con fecha próxima pendiente de aplicar aparecen aquí.</p></div></div>`;
  return `<div style="overflow-x:auto;"><table class="records-table"><thead><tr><th>Fecha</th><th>Mascota</th><th>Atención</th><th>Cuándo</th><th></th></tr></thead><tbody>
    ${rows.slice(0, 40).map(r => {
    const p = petById(r.pet_id);
    return `<tr>
      <td><b>${escapeHtml(r.next_due)}</b></td>
      <td><div style="display:flex; align-items:center; gap:9px;">${miniThumb(p)}<div><b>${escapeHtml(p ? p.name : '—')}</b><div class="faint" style="font-size:11px;">${escapeHtml(p ? p.owner_name : '')}</div></div></div></td>
      <td>${r.type === 'vacuna' ? 'Vacuna' : 'Desparasitación'} · ${escapeHtml(r.title || '—')}</td>
      <td class="faint">${escapeHtml(daysAhead(r.next_due))}</td>
      <td><button class="btn btn-outline btn-sm" data-health-edit="${r.pet_id}">Registrar aplicación</button></td>
    </tr>`;
  }).join('')}
  </tbody></table></div>`;
}
function daysAhead(date) {
  try {
    const d = Math.round((new Date(date + 'T12:00') - new Date(todayIso() + 'T12:00')) / 86400000);
    if (d === 0) return 'hoy';
    return d > 0 ? `en ${d} día${d !== 1 ? 's' : ''}` : 'vencida';
  } catch { return ''; }
}

/* ---------- Vista ---------- */
export function viewSalud() {
  const records = allRecords();
  const title = { vacunacion: 'Vacunación', desparasitacion: 'Desparasitación', enfermedades: 'Enfermedades crónicas', esterilizacion: 'Esterilización', historial: 'Historial clínico', agenda: 'Próximas atenciones' }[subtab];
  return `
  <div class="dash-head">
    <div><h1>Salud</h1><p>Vacunas, desparasitaciones, enfermedades y atenciones del padrón de FAM J VET</p></div>
    <div class="dash-actions"><button class="btn btn-soft" data-salud-new="new">${iconSyringeSvg()} Registrar en ficha médica</button></div>
  </div>
  ${kpiRow(records)}
  <div class="dash-tabs" role="tablist">
    ${SUBTABS.map(([k, l]) => `<button class="dash-tab ${subtab === k ? 'active' : ''}" data-stab="${k}" role="tab" aria-selected="${subtab === k}">${l}</button>`).join('')}
  </div>
  <div class="panel" style="padding:16px;">
    ${subtab === 'vacunacion' ? doseTableHtml(records, 'vacuna') : ''}
    ${subtab === 'desparasitacion' ? doseTableHtml(records, 'desparasitacion') : ''}
    ${subtab === 'enfermedades' ? conditionsHtml() : ''}
    ${subtab === 'esterilizacion' ? sterilizationHtml() : ''}
    ${subtab === 'historial' ? historyHtml(records) : ''}
    ${subtab === 'agenda' ? agendaHtml(records) : ''}
  </div>`;
}
function iconSyringeSvg() {
  // pequeño icono reutilizado del paquete (se resuelve por estilo, no por import extra)
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;"><path d="M17 3l4 4M19.5 4.5L12 12M3 21l1.5-4.5L16 5l3 3L7.5 19.5 3 21z"/></svg>`;
}

/* ---------- Eventos ---------- */
export function bindSaludEvents() {
  document.querySelectorAll('[data-stab]').forEach(el => el.addEventListener('click', () => {
    setSaludSubtab(el.dataset.stab);
    import('../app.js').then(m => m.renderView());
  }));
  document.querySelectorAll('[data-health-edit]').forEach(el => el.addEventListener('click', () => {
    if (el.dataset.healthEdit) openPetModal(el.dataset.healthEdit, { tab: 'med' });
  }));
  document.querySelector('[data-salud-new]')?.addEventListener('click', () => {
    openPetPickerSimple();
  });
}

function openPetPickerSimple() {
  const all = state.getPets();
  if (!all.length) return toast('No hay mascotas registradas', 'error');
  import('../components/modal.js').then(({ openModal, closeModal }) => {
    openModal('modal-sm', `
      <div class="modal-head"><h3>Editar salud</h3><button class="btn-icon" data-close>✕</button></div>
      <div class="modal-body">
        <input id="picker-search" placeholder="Buscar por nombre o carnet..." style="width:100%; height:40px; border:1px solid var(--border); border-radius:8px; padding:0 12px; background:var(--surface-2); font-family:inherit;">
        <div id="picker-list" style="max-height:320px; overflow-y:auto; margin-top:10px;">
          ${all.map(p => `
            <div class="alert-item" data-pick="${p.id}" style="margin-bottom:6px;">
              <img class="pet-thumb" src="${p.photo || placeholderPhoto()}" alt="">
              <div class="a-main"><div class="a-title">${escapeHtml(p.name)}</div><div class="a-desc">${escapeHtml(p.carnet_number || '')} · ${escapeHtml(p.owner_name || '')}</div></div>
            </div>`).join('')}
        </div>
      </div>`);
    document.querySelectorAll('[data-pick]').forEach(el => el.addEventListener('click', () => {
      closeModal(); openPetModal(el.dataset.pick, { tab: 'med' });
    }));
    const search = document.getElementById('picker-search');
    if (search) search.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      document.querySelectorAll('#picker-list [data-pick]').forEach(el => {
        const p = all.find(x => x.id === el.dataset.pick);
        el.style.display = p && ((p.name || '').toLowerCase().includes(q) || (p.carnet_number || '').toLowerCase().includes(q)) ? '' : 'none';
      });
    });
  });
}