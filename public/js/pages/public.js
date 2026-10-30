import { api } from '../api.js';
import { statusBadge, speciesLabel, placeholderPhoto, escapeHtml } from '../utils.js';

export async function renderPublicPage(id) {
  const app = document.getElementById('app');
  try {
    const pet = await api.getPublicPet(id);
    const health = await api.getPublicPetHealth(id).catch(() => ({ records: [] }));
    const records = health.records || [];
    const lost = pet.status === 'Perdido';
    const appliedCount = records.filter(r => r.applied).length;
    const total = records.length;
    const pct = total ? Math.round((appliedCount / total) * 100) : 0;

    app.innerHTML = `
    <div class="public-page">
      <a href="#/" style="position:absolute; top:14px; left:14px; color:#fff; opacity:.7; text-decoration:none; font-size:13px; z-index:10;">← Volver</a>
      <div class="public-card">
        ${lost ? `<div class="public-alert">ESTA MASCOTA ESTÁ PERDIDA — POR FAVOR CONTACTAR AL PROPIETARIO</div>` : ''}

        <!-- Carnet sanitario (estilo Max) -->
        <div class="hc-root" style="padding:24px 12px; max-width:460px; margin:0 auto;">
          <div class="hc-scene" style="width:100%; aspect-ratio:2/3.1;">
            <div class="hc-tilt">
              <div class="hc-book">
                <section class="hc-face hc-front">
                  <div class="hc-logo">
                    <span class="pets" aria-hidden="true">🐶🐱🐦</span>
                    <span class="hc-brand">FAM J VET</span>
                  </div>
                  <svg class="hc-beat" viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M0 12 H70 l6-9 l8 18 l6-9 H200"/>
                  </svg>
                  <div class="hc-tag">Amor, cuidado y salud para toda la vida</div>
                  <h1 class="hc-title">CARNET SANITARIO</h1>
                  <div class="hc-ribbon">de mi mascota</div>
                  <p class="hc-list">Control sanitario · Vacunación · Desparasitación · Historial clínico</p>
                  <div class="hc-stage">
                    <div class="hc-frame" aria-label="Foto de la mascota">
                      ${pet.photo ? `<img src="${escapeHtml(pet.photo)}" alt="${escapeHtml(pet.name)}">` : placeholderPhotoSvg()}
                    </div>
                    <div class="hc-motto">Porque su bienestar es nuestra prioridad</div>
                  </div>
                  <div class="hc-form">
                    <div class="hc-row"><b>NOMBRE:</b><span class="v">${escapeHtml(pet.name || '—')}</span></div>
                    <div class="hc-row"><b>ESPECIE:</b><span class="v">${speciesLabel(pet.species) || '—'}</span><b>RAZA:</b><span class="v">${escapeHtml(pet.breed || '—')}</span></div>
                    <div class="hc-row"><b>NACIMIENTO:</b><span class="v">${pet.birth_date || '—'}</span><span class="hc-sex"><b>SEXO:</b><span class="v">${pet.sex || '—'}</span></span></div>
                    <div class="hc-row"><b>COLOR / SEÑAS:</b><span class="v">${escapeHtml(pet.distinctive_marks || pet.color || '—')}</span></div>
                    <div class="hc-row"><b>PROPIETARIO:</b><span class="v">${escapeHtml(pet.owner_name || '—')}</span><b>N.º REG.:</b><span class="v">${pet.carnet_number || '—'}</span></div>
                    <div class="hc-row"><b>TELÉFONO:</b><span class="v">${pet.owner_phone || '—'}</span></div>
                    <div class="hc-addr">${escapeHtml(pet.owner_address || '')}${pet.owner_city ? ' · ' + escapeHtml(pet.owner_city) : ''}</div>
                  </div>
                </section>

                <section class="hc-face hc-back">
                  <div class="hc-head">
                    <div class="hc-ring">
                      <svg viewBox="0 0 36 36">
                        <circle class="tr" cx="18" cy="18" r="15.5"/>
                        <circle class="pr" cx="18" cy="18" r="15.5" stroke-dasharray="97.4" stroke-dashoffset="${97.4 * (1 - pct / 100)}"/>
                      </svg>
                      <span>${pct}%</span>
                    </div>
                    <div>
                      <h2>${escapeHtml(pet.name || 'Mascota')}</h2>
                      <p>${pct === 100 ? 'Vacunas al día' : total - appliedCount + ' registro pendiente'}</p>
                    </div>
                  </div>
                  <div class="hc-next">
                    <span>📋</span><span>${total} registro${total !== 1 ? 'es' : ''} de salud</span>
                  </div>
                  <div class="hc-items">
                    ${renderHealthItems(records)}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>

        <div class="public-body" style="margin-top:18px; text-align:center;">
          <div style="margin-top:10px;">${statusBadge(pet.status)}</div>
          <div class="public-actions" style="margin-top:10px;">
            <a class="btn btn-primary" href="tel:${pet.owner_phone || ''}">Llamar al propietario</a>
            <a class="btn btn-gold" target="_blank" href="https://wa.me/${(pet.owner_phone || '').replace(/\D/g, '')}?text=${encodeURIComponent('Hola, encontré a ' + pet.name + ' (carnet ' + pet.carnet_number + '). Vi su información en FAM J VET.')}">WhatsApp</a>
          </div>
          <p class="faint" style="margin-top:16px; font-size:11px;">Verificado por FAM J VET Bolivia · Documento de identificación animal</p>
        </div>
      </div>
    </div>`;
  } catch {
    app.innerHTML = `<div class="public-page"><div class="public-card"><div class="public-body" style="padding-top:40px;"><h1>No encontrado</h1><p class="sub">Este código QR no corresponde a ningún registro activo en FAM J VET.</p><a href="#/" class="btn btn-primary" style="margin-top:18px;">Ir al sistema</a></div></div></div>`;
  }
}

function renderHealthItems(records) {
  const byType = { vacuna: [], desparasitacion: [], historial: [] };
  records.forEach(r => { if (byType[r.type]) byType[r.type].push(r); });
  const tabs = [
    { key: 'vacuna', label: 'Vacunas' },
    { key: 'desparasitacion', label: 'Desparasitación' },
    { key: 'historial', label: 'Historial' },
  ];
  let html = '';
  tabs.forEach((t, i) => {
    const list = byType[t.key];
    html += `
      <div style="margin-bottom:14px;">
        <div style="font-weight:700; color:#27407a; font-size:15px; margin-bottom:6px; border-bottom:2px solid #27407a; display:inline-block;">${t.label}</div>
        ${list.length ? list.map(r => `
          <div style="background:#fffdf0; border:1px solid #dbe3ee; border-radius:8px; padding:10px 12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="font-weight:600; color:#1d2b4f;">${escapeHtml(r.title)}</div>
              <div style="font-size:12px; color:#555;">${fmtDate(r.record_date)}</div>
              ${r.notes ? `<div style="font-size:12px; color:#333; margin-top:4px;">${escapeHtml(r.notes)}</div>` : ''}
              ${r.vet ? `<div style="font-size:11px; color:#666; margin-top:2px;">Vet: ${escapeHtml(r.vet)}</div>` : ''}
            </div>
            <span style="${r.applied ? 'color:#3f9a58; font-weight:700;' : 'color:#c0642a; font-weight:700;'}">${r.applied ? '✓ Aplicada' : 'Pendiente'}</span>
          </div>`).join('') : `<div style="font-size:12px; color:#666; font-style:italic;">Sin registros de ${t.label.toLowerCase()}.</div>`}
      </div>`;
  });
  return html;
}

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d + 'T12:00').toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return d; }
}

function placeholderPhotoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#e4eefc"/><ellipse cx="45" cy="95" rx="24" ry="44" fill="#b9762c" transform="rotate(18 45 95)"/><ellipse cx="155" cy="95" rx="24" ry="44" fill="#b9762c" transform="rotate(-18 155 95)"/><circle cx="100" cy="108" r="62" fill="#e9b564"/><ellipse cx="100" cy="134" rx="35" ry="27" fill="#f8e5ba"/><g class="eye"><circle cx="76" cy="100" r="9" fill="#fff"/><circle class="p" cx="76" cy="100" r="6" fill="#2a2320"/></g><g class="eye"><circle cx="124" cy="100" r="9" fill="#fff"/><circle class="p" cx="124" cy="100" r="6" fill="#2a2320"/></g><ellipse cx="100" cy="120" rx="12" ry="8" fill="#2a2320"/><path d="M100 128v8M100 136q-12 12-22 2M100 136q12 12 22 2" fill="none" stroke="#2a2320" stroke-width="3" stroke-linecap="round"/><path d="M92 142q8 22 16 0z" fill="#ef7f8f"/></svg>`;
}
