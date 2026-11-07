/* ============================================================
   Dashboard: datos, filtros, análisis y alertas (fuente única)
   state se comparte con app.js vía initDashboardData().
   ============================================================ */
import { calcDashboardStats, calcHealthStats, lastMonths, monthShort } from '../utils.js';

let state = null;
let dashTab = 'resumen';
export const DASH_TABS = [
  ['resumen', 'Resumen'],
  ['salud', 'Salud'],
  ['padron', 'Padrón'],
  ['territorio', 'Territorio'],
  ['actividad', 'Actividad'],
  ['alertas', 'Alertas'],
];

const emptyFilters = () => ({ period: 'all', species: '', status: '', sex: '', city: '', dateFrom: '', dateTo: '' });
let filters = emptyFilters();   // filtros aplicados
let draft = emptyFilters();     // filtros en edición

export function initDashboardData(s) { state = s; }

export function getDashTab() { return dashTab; }
export function setDashTab(t) { if (DASH_TABS.some(([k]) => k === t)) dashTab = t; }

export function getFilters() { return filters; }
export function getDraft() { return draft; }
export function setDraftField(k, v) { if (k in draft) draft[k] = v; }
export function applyDraft() { filters = { ...draft }; }
export function resetDraft() { draft = emptyFilters(); filters = emptyFilters(); }

export function getHistory() { return state ? state.getHistory() : []; }

/* ---------- Selección filtrada de mascotas ---------- */
export function filteredPets() {
  if (!state) return [];
  const pets = state.getPets();
  const f = filters;
  const custom = f.dateFrom || f.dateTo;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  let start = null;
  if (!custom && f.period !== 'all') {
    start = new Date(now);
    if (f.period === '30') start.setDate(start.getDate() - 30);
    else if (f.period === '90') start.setDate(start.getDate() - 90);
    else start.setFullYear(start.getFullYear() - 1);
  }
  const from = f.dateFrom ? new Date(f.dateFrom + 'T12:00') : null;
  const to = f.dateTo ? new Date(f.dateTo + 'T23:59') : null;
  return pets.filter(p => {
    const rd = p.registration_date || '';
    const registered = rd ? new Date(rd + 'T12:00') : null;
    if (start && (!registered || registered < start)) return false;
    if (from && (!registered || registered < from)) return false;
    if (to && (!registered || registered > to)) return false;
    if (f.species && p.species !== f.species) return false;
    if (f.status && p.status !== f.status) return false;
    if (f.sex) {
      if (f.sex === 'ND') { if (p.sex) return false; }
      else if (p.sex !== f.sex) return false;
    }
    if (f.city && (p.owner_city || '') !== f.city) return false;
    return true;
  });
}

/* ---------- Mapa de registros de salud sin N+1 ---------- */
export function healthMap() {
  const analytics = state.getAnalytics() || {};
  if (Array.isArray(analytics.healthRecords)) {
    const map = new Map();
    for (const r of analytics.healthRecords) {
      if (!r || !r.pet_id) continue;
      const arr = map.get(r.pet_id);
      if (arr) arr.push(r); else map.set(r.pet_id, [r]);
    }
    return map;
  }
  return state.getAllHealthRecordsMap();
}

/* Registros de salud de la selección (fuente única: analytics) */
export function healthRecordsFor(pets) {
  const ids = new Set(pets.map(p => p.id));
  const a = state.getAnalytics() || {};
  return (a.healthRecords || []).filter(r => ids.has(r.pet_id));
}

export function dashStats(pets) {
  const st = calcDashboardStats(pets, getHistory());
  const hs = calcHealthStats(pets, healthMap());
  return { st, hs, analysis: dashboardAnalysis(pets) };
}

/* ---------- Análisis derivado de la selección ---------- */
export function dashboardAnalysis(pets) {
  const ids = new Set(pets.map(p => p.id));
  const analytics = state.getAnalytics() || {};
  const details = (analytics.medicalDetails || []).filter(d => ids.has(d.pet_id));
  const records = (analytics.healthRecords || []).filter(r => ids.has(r.pet_id));
  const detailByPet = new Map(details.map(d => [d.pet_id, d]));
  const cities = new Map(); const conditions = new Map();
  const weights = { '< 5 kg': 0, '5–15 kg': 0, '15–30 kg': 0, '30+ kg': 0, 'Sin dato': 0 };
  const quality = { Foto: 0, Raza: 0, Peso: 0, Teléfono: 0, Dirección: 0, Microchip: 0 };
  pets.forEach(p => {
    const city = (p.owner_city || '').trim() || 'Sin ciudad';
    cities.set(city, (cities.get(city) || 0) + 1);
    const weight = Number(p.weight);
    if (!Number.isFinite(weight) || !p.weight) weights['Sin dato']++;
    else if (weight < 5) weights['< 5 kg']++;
    else if (weight < 15) weights['5–15 kg']++;
    else if (weight < 30) weights['15–30 kg']++;
    else weights['30+ kg']++;
    if (p.photo) quality.Foto++;
    if (p.breed) quality.Raza++;
    if (p.weight) quality.Peso++;
    if (p.owner_phone) quality.Teléfono++;
    if (p.owner_address) quality.Dirección++;
    const detail = detailByPet.get(p.id);
    if (detail?.microchip) quality.Microchip++;
    parseList(detail?.conditions_detail).forEach(condition => {
      const name = String(condition?.name || '').trim();
      if (name) conditions.set(name, (conditions.get(name) || 0) + 1);
    });
  });
  const actionGroups = { Registros: 0, Salud: 0, Documentos: 0, Ediciones: 0, Otros: 0 };
  getHistory().forEach(item => {
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
  getHistory().forEach(item => {
    const m = String(item.date || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return;
    const key = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    byDay.set(key, (byDay.get(key) || 0) + 1);
  });
  // Evolución mensual de vacunas/desparasitaciones por fecha de registro/aplicación
  const overdueSet = new Set(overdue);
  const months = lastMonths(12);
  const monthKeyOf = (r) => (r.record_date || '').slice(0, 7);
  const healthMonths = {};
  months.forEach(k => { healthMonths[k] = { aplicadas: 0, pendientes: 0, vencidas: 0 }; });
  records.forEach(r => {
    if (r.type !== 'vacuna' && r.type !== 'desparasitacion') return;
    const k = monthKeyOf(r);
    if (!(k in healthMonths)) return;
    if (r.applied) healthMonths[k].aplicadas++;
    else if (overdueSet.has(r)) healthMonths[k].vencidas++;
    else healthMonths[k].pendientes++;
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
    healthMonths: { keys: months, data: healthMonths },
  };
}

function parseList(value) {
  try { const list = JSON.parse(value || '[]'); return Array.isArray(list) ? list : []; } catch { return []; }
}

/* ---------- Tendencias de mes actual vs mes anterior ---------- */
export function monthlyTrend(items, dateOf) {
  const now = new Date();
  const k = (m) => `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
  const kThis = k(now);
  const dPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const kPrev = k(dPrev);
  let cur = 0, prev = 0;
  items.forEach(it => {
    const mo = (dateOf(it) || '').slice(0, 7);
    if (mo === kThis) cur++;
    else if (mo === kPrev) prev++;
  });
  return { cur, prev };
}

/* ---------- Centro de alertas reales ---------- */
export const PRIORITY_ORDER = ['critica', 'alta', 'media', 'informativa'];

export function buildAlerts(pets) {
  const analytics = state.getAnalytics() || {};
  const ids = new Set(pets.map(p => p.id));
  const petById = new Map(pets.map(p => [p.id, p]));
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(); in30.setDate(in30.getDate() + 30);
  const in30Iso = in30.toISOString().slice(0, 10);
  const alerts = [];

  // Crítica: mascotas reportadas perdidas
  pets.filter(p => p.status === 'Perdido').forEach(p => {
    alerts.push({
      priority: 'critica',
      title: `${p.name} está reportada como perdida`,
      desc: `Propietario ${p.owner_name || '—'} · ${p.owner_phone || 'sin teléfono'}`,
      petId: p.id,
    });
  });

  // Alta: dosis vencidas (vacunas / desparasitaciones)
  (analytics.healthRecords || []).filter(r => ids.has(r.pet_id)).forEach(r => {
    if (r.applied) return;
    const due = r.next_due || r.record_date;
    if (!due || due >= today) return;
    const p = petById.get(r.pet_id);
    const kind = r.type === 'vacuna' ? 'Vacuna' : 'Desparasitación';
    alerts.push({
      priority: 'alta',
      title: `${kind} vencida: ${r.title || 'sin nombre'}`,
      desc: `${p ? p.name : 'Mascota'} · pendiente desde ${due}`,
      petId: r.pet_id,
    });
  });

  // Media: fichas incompletas
  pets.filter(p => !p.breed || !p.photo || !p.weight).forEach(p => {
    const missing = [!p.photo && 'sin foto', !p.breed && 'sin raza', !p.weight && 'sin peso'].filter(Boolean).join(' · ');
    alerts.push({ priority: 'media', title: `Ficha incompleta: ${p.name}`, desc: missing, petId: p.id });
  });

  // Media: sin información médica
  const hm = healthMap();
  pets.filter(p => (hm.get(p.id) || []).length === 0).forEach(p => {
    alerts.push({ priority: 'media', title: `Sin información médica: ${p.name}`, desc: 'No hay vacunas ni desparasitaciones registradas', petId: p.id });
  });

  // Media: carnets sin registro de impresión (solo si el historial registra impresiones)
  const history = getHistory();
  const hasPrintLogs = history.some(h => /impresi|descarg/i.test(h.action || ''));
  if (hasPrintLogs) {
    const printedEntities = history.filter(h => /impres|descarg/i.test(h.action || '')).map(h => String(h.entity || '').trim().toLowerCase());
    pets.filter(p => p.carnet_number && !printedEntities.includes(String(p.name || '').trim().toLowerCase()))
      .forEach(p => alerts.push({ priority: 'media', title: `Carnet sin impresión registrada: ${p.name}`, desc: `Carnet ${p.carnet_number}`, petId: p.id }));
  }

  // Informativa: próximas atenciones (próximos 30 días)
  (analytics.healthRecords || []).filter(r => ids.has(r.pet_id)).forEach(r => {
    if (!r.next_due || r.next_due < today || r.next_due > in30Iso) return;
    const p = petById.get(r.pet_id);
    const kind = r.type === 'vacuna' ? 'Vacuna' : 'Desparasitación';
    alerts.push({
      priority: 'informativa',
      title: `${kind} próxima: ${r.title || 'sin nombre'}`,
      desc: `${p ? p.name : 'Mascota'} · ${r.next_due}${r.applied ? ' (dosis siguiente)' : ''}`,
      petId: r.pet_id,
    });
  });

  const order = { critica: 0, alta: 1, media: 2, informativa: 3 };
  alerts.sort((a, b) => order[a.priority] - order[b.priority]);
  const counts = { critica: 0, alta: 0, media: 0, informativa: 0 };
  alerts.forEach(a => counts[a.priority]++);
  return { alerts, counts, total: alerts.length };
}
