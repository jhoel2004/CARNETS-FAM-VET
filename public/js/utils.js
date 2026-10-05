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
  return { perro: '🐕 Perro', gato: '🐈 Gato', otro: '🐾 Otro' }[s] || s;
}

export function statusBadge(s) {
  const map = { Activo: 'active', Inactivo: 'inactive', Perdido: 'lost' };
  return `<span class="badge ${map[s] || 'inactive'}">${s}</span>`;
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

export function toast(msg, type) {
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' error' : '');
  el.innerHTML = `<span>${type === 'error' ? '⚠️' : '✅'}</span><span>${msg}</span>`;
  document.getElementById('toast-wrap').appendChild(el);
  setTimeout(() => el.remove(), 3400);
}
