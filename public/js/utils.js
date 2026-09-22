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
  return `<div><label style="display:block;font-size:11px;color:var(--text-soft);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px;">${label}</label><div style="font-size:14px;">${escapeHtml((val == null || val === '') ? '—' : val)}</div></div>`;
}

export function statCard(label, val, color, icon) {
  return `<div class="stat-card"><div class="top"><div class="icon" style="background:${color}22; color:${color};">${icon}</div></div><div class="val">${val}</div><div class="lbl">${label}</div></div>`;
}

export function toast(msg, type) {
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' error' : '');
  el.innerHTML = `<span>${type === 'error' ? '⚠️' : '✅'}</span><span>${msg}</span>`;
  document.getElementById('toast-wrap').appendChild(el);
  setTimeout(() => el.remove(), 3400);
}
