export function uid() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function calcAge(dob) {
  if (!dob) return '—';
  const b = new Date(dob), n = new Date();
  let years = n.getFullYear() - b.getFullYear();
  let months = n.getMonth() - b.getMonth();
  if (months < 0 || (months === 0 && n.getDate() < b.getDate())) { years--; months += 12; }
  if (n.getDate() < b.getDate()) months--;
  if (months < 0) months += 12;
  if (years <= 0) return `${months < 0 ? 0 : months} meses`;
  return `${years} años${months > 0 ? ', ' + months + ' m' : ''}`;
}

export function escapeHtml(s) {
  return (s || '').toString().replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}

export function speciesLabel(s) {
  return { perro: 'Perro', gato: 'Gato', otro: 'Otro' }[s] || s || '—';
}

export function statusBadge(s) {
  const map = { Activo: 'active', Inactivo: 'inactive', Perdido: 'lost', Pendiente: 'pending' };
  return `<span class="badge ${map[s] || 'inactive'}">${escapeHtml(s)}</span>`;
}

export function placeholderPhoto() {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#e3ded0"/><text x="50%" y="55%" font-size="70" text-anchor="middle" dominant-baseline="middle">🐾</text></svg>`
  );
}

export function publicUrl(petId) {
  return location.origin + location.pathname + '#/public/' + petId;
}

export function detailField(label, val) {
  return `<div class="dv-field"><label>${label}</label><div class="dv-val">${escapeHtml((val == null || val === '') ? '—' : val)}</div></div>`;
}

export function statCard(label, val, color, icon) {
  return `<div class="stat-card"><div class="top"><div class="icon" style="background:${color}22; color:${color};">${icon}</div></div><div class="val">${val}</div><div class="lbl">${label}</div></div>`;
}

export function dayLabel(dateStr) {
  if (!dateStr) return 'Actividad';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return dateStr;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today - day) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff > 1 && diff < 7) return `Hace ${diff} días`;
  return dateStr;
}

export function describeHistory(h) {
  const action = (h.action || '').toLowerCase();
  const entity = h.entity || '';
  if (/imprim|impresi|pdf|carnet.*(impr|gener)/i.test(h.action || '') || /imprim/i.test(action)) {
    return `Se imprimió el carnet de ${entity}`;
  }
  if (/export/i.test(action)) {
    const m = entity.match(/(\d+)/);
    return m ? `Se exportaron ${m[1]} registros` : `Se exportó la base de datos`;
  }
  if (/descarg/i.test(action)) {
    return `Se descargó el carnet de ${entity}`;
  }
  if (/nuev|registr|cre/i.test(action)) {
    return entity ? `Se registró una nueva mascota: ${entity}` : 'Se registró una nueva mascota';
  }
  if (/actualiz|edit|modific/i.test(action)) {
    return `Se actualizó la ficha de ${entity}`;
  }
  if (/elimin|borr/i.test(action)) {
    return `Se eliminó el registro de ${entity}`;
  }
  if (/perd/i.test(action)) {
    return `Se reportó perdida: ${entity}`;
  }
  return `${h.action || 'Movimiento'} — ${entity}`;
}

export function groupHistoryByDay(list) {
  const groups = [];
  const map = new Map();
  (list || []).forEach(h => {
    const label = dayLabel(h.date);
    if (!map.has(label)) { map.set(label, []); groups.push({ label, items: map.get(label) }); }
    map.get(label).push(h);
  });
  return groups;
}

export function pctOf(v, total) {
  return total ? Math.round((v / total) * 100) : 0;
}

// Edad en años (decimal) a partir de age_years/age_months, con fallback a birth_date.
export function petAgeYears(p) {
  const y = parseFloat(p.age_years);
  const m = parseFloat(p.age_months);
  if (!isNaN(y) || !isNaN(m)) return (isNaN(y) ? 0 : y) + (isNaN(m) ? 0 : m) / 12;
  if (p.birth_date) {
    const b = new Date(p.birth_date);
    if (!isNaN(b)) return Math.max(0, (Date.now() - b.getTime()) / 31557600000);
  }
  return null;
}

export function ageGroupLabel(y) {
  if (y == null) return 'Sin información';
  if (y < 1) return '0–1 años';
  if (y < 4) return '1–3 años';
  if (y < 8) return '4–7 años';
  if (y < 12) return '8–12 años';
  return '12+ años';
}

export function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthShort(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-BO', { month: 'short' });
}

// Últimos N meses (incluye actual) como ['2025-11', ...]
export function lastMonths(n) {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(monthKey(t));
  }
  return out;
}

// Estadísticas del dashboard calculadas solo con datos reales.
export function calcDashboardStats(pets, history) {
  const total = pets.length;
  const now = new Date();
  const byStatus = { Activo: 0, Inactivo: 0, Perdido: 0 };
  const bySpecies = { perro: 0, gato: 0, otro: 0 };
  const bySex = { Macho: 0, Hembra: 0, ND: 0 };
  const byAge = { '0–1 años': 0, '1–3 años': 0, '4–7 años': 0, '8–12 años': 0, '12+ años': 0, 'Sin información': 0 };
  const breeds = new Map();
  const owners = new Map();
  let thisMonth = 0;
  let incomplete = 0;
  let sterilized = 0;

  pets.forEach(p => {
    if (byStatus[p.status] !== undefined) byStatus[p.status]++;
    else byStatus.Inactivo++;
    if (bySpecies[p.species] !== undefined) bySpecies[p.species]++;
    else bySpecies.otro++;
    if (p.sex === 'Macho' || p.sex === 'Hembra') bySex[p.sex]++;
    else bySex.ND++;

    byAge[ageGroupLabel(petAgeYears(p))]++;

    const b = (p.breed || '').trim();
    if (b) {
      const k = b.toLowerCase();
      if (!breeds.has(k)) breeds.set(k, { name: b, count: 0 });
      breeds.get(k).count++;
    }

    const ok = (p.owner_ci || '').trim() || (p.owner_name || '').trim();
    if (ok) {
      if (!owners.has(ok)) owners.set(ok, { name: p.owner_name || ok, count: 0, thisMonth: false });
      const o = owners.get(ok);
      o.count++;
    }

    const rd = p.registration_date ? new Date(p.registration_date) : null;
    if (rd && !isNaN(rd) && rd.getMonth() === now.getMonth() && rd.getFullYear() === now.getFullYear()) {
      thisMonth++;
      if (ok && owners.has(ok)) owners.get(ok).thisMonth = true;
    }

    if (!b || !p.photo || !p.weight) incomplete++;

    const med = [p.medical_observations, p.medical_vaccines, p.medical_diseases].join(' ').toLowerCase();
    if (/esteriliz|castrad/.test(med)) sterilized++;
  });

  const months = lastMonths(12);
  const perMonth = months.map(k => pets.filter(p => (p.registration_date || '').slice(0, 7) === k).length);

  const topBreeds = [...breeds.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  const topOwners = [...owners.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  const newOwnersMonth = [...owners.values()].filter(o => o.thisMonth).length;

  const hist = history || [];
  const printed = hist.filter(h => /impresi/.test((h.action || '').toLowerCase())).length;
  const downloaded = hist.filter(h => /descarg/.test((h.action || '').toLowerCase())).length;

  return {
    total, thisMonth, incomplete,
    active: byStatus.Activo, inactive: byStatus.Inactivo, lost: byStatus.Perdido,
    dogs: bySpecies.perro, cats: bySpecies.gato, others: bySpecies.otro,
    males: bySex.Macho, females: bySex.Hembra, sexND: bySex.ND,
    byAge, topBreeds, topOwners,
    ownersCount: owners.size, newOwnersMonth,
    avgPerOwner: owners.size ? (total / owners.size) : 0,
    months, perMonth,
    printed, downloaded,
    pendingCards: Math.max(0, total - printed),
  };
}

export function toast(msg, type) {
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' error' : '');
  el.innerHTML = `<span>${type === 'error' ? '⚠️' : '✅'}</span><span>${msg}</span>`;
  document.getElementById('toast-wrap').appendChild(el);
  setTimeout(() => el.remove(), 3400);
}
