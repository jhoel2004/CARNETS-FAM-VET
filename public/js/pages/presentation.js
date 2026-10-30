/* ============================================================
   PRESENTACIÓN DE MASCOTA — FAMUVET (libreta veterinaria digital)
   Página pública independiente, aparte del carnet del admin.
   Diseño fiel a la libreta de papel: crema, azul marino, verde,
   animaciones suaves y detalles que reaccionan.
   ============================================================ */

import { api } from '../api.js';
import { state } from '../state.js';
import { escapeHtml, speciesLabel, placeholderPhoto, publicUrl, toast } from '../utils.js';

let pet = null;
let records = [];
let medicalDetails = {};
let tab = 'vac';
let photoTemp = '';
let isOpen = false;

const TYPE_LABEL = {
  vacuna: 'Vacuna',
  desparasitacion: 'Desparasitación',
  historial: 'Historial clínico',
};

export function initPresentation() {
  // Nada que inicializar globalmente.
}

/* ---------- Helpers ---------- */

function escapeHtmlAttr(s) {
  return String(s || '').replace(/"/g, '&quot;');
}

function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d + 'T12:00').toLocaleDateString('es-BO', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return d; }
}

function daysFromNow(d) {
  if (!d) return 0;
  return Math.round((new Date(d + 'T12:00') - new Date()) / 864e5);
}

function showToast(msg) {
  const el = document.getElementById('hc-toast');
  if (el) {
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => el.classList.remove('on'), 2200);
  } else {
    toast(msg);
  }
}

function placeholderPhotoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect width="200" height="200" fill="#e4eefc"/>
    <ellipse cx="45" cy="95" rx="24" ry="44" fill="#b9762c" transform="rotate(18 45 95)"/>
    <ellipse cx="155" cy="95" rx="24" ry="44" fill="#b9762c" transform="rotate(-18 155 95)"/>
    <circle cx="100" cy="108" r="62" fill="#e9b564"/>
    <ellipse cx="100" cy="134" rx="35" ry="27" fill="#f8e5ba"/>
    <g class="eye"><circle cx="76" cy="100" r="9" fill="#fff"/><circle class="p" cx="76" cy="100" r="6" fill="#2a2320"/></g>
    <g class="eye"><circle cx="124" cy="100" r="9" fill="#fff"/><circle class="p" cx="124" cy="100" r="6" fill="#2a2320"/></g>
    <ellipse cx="100" cy="120" rx="12" ry="8" fill="#2a2320"/>
    <path d="M100 128v8M100 136q-12 12-22 2M100 136q12 12 22 2" fill="none" stroke="#2a2320" stroke-width="3" stroke-linecap="round"/>
    <path d="M92 142q8 22 16 0z" fill="#ef7f8f"/>
    <rect y="178" width="200" height="22" fill="#3f9a58"/>
  </svg>`;
}

/* ---------- Carga de datos ---------- */

export async function viewPresentation(petId) {
  // Cargar datos de la mascota desde la API
  try {
    pet = await api.getPublicPet(petId);
  } catch {
    pet = null;
  }
  if (!pet) {
    return `
    <div class="hc-view" style="padding:40px 20px; text-align:center; max-width:440px; margin:0 auto;">
      <div style="font-size:48px; margin-bottom:16px;">🐾</div>
      <h2 style="color:var(--hc-navy); margin-bottom:8px;">No encontrado</h2>
      <p style="color:var(--hc-ink); opacity:.8;">Este código no corresponde a ninguna mascota registrada.</p>
      <a href="#/" class="btn btn-primary" style="margin-top:16px;">Ir al sistema</a>
    </div>`;
  }

  photoTemp = pet.photo || '';
  records = state.getHealthRecords(pet.id) || [];
  medicalDetails = await api.getMedicalDetails(pet.id).catch(() => ({}));

  const s = state.getSettings();
  const appliedCount = records.filter(r => r.applied).length;
  const total = records.length;
  const pct = total ? Math.round((appliedCount / total) * 100) : 0;

  return `
  <div class="hc-view">
    <div id="hc-toast" class="hc-toast"></div>

    <!-- Loader inicial (perrito + huellas) -->
    <div class="loader" id="hc-loader" role="status" aria-label="Cargando">
      <span class="dog" aria-hidden="true">🐕</span>
      <div class="trail" aria-hidden="true">
        <span>🐾</span><span>🐾</span><span>🐾</span><span>🐾</span><span>🐾</span><span>🐾</span>
      </div>
      <p>Buscando a ${escapeHtml(pet.name)}…</p>
    </div>

    <!-- Contenedor libro -->
    <div class="hc-scene" id="hc-scene">
      <div class="hc-tilt" id="hc-tilt">
        <div class="hc-book" id="hc-book">

          <!-- PORTADA — Presentación -->
          <section class="hc-face hc-front" aria-label="Presentación de la mascota">
            <div class="hc-logo">
              <span class="pets" aria-hidden="true">🐶🐱🐦</span>
              <span class="hc-brand">FAM<svg viewBox="0 0 40 52" aria-hidden="true">
                <path d="M7 4V27a13 13 0 0 0 26 0V4"/>
                <path class="tl" d="M33 27c0 14-8 20-20 21"/>
              </svg>VET</span>
            </div>
            <svg class="hc-beat" viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 12 H70 l6-9 l8 18 l6-9 H200"/>
            </svg>
            <div class="hc-tag">${escapeHtml(s.healthTagline || 'Amor, cuidado y salud para toda la vida')}</div>
            <h1 class="hc-title">PRESENTACIÓN</h1>
            <div class="hc-ribbon">de mi mascota</div>
            <p class="hc-list">${escapeHtml(s.healthServices || 'Control sanitario · Vacunación · Desparasitación · Historial clínico')}</p>
            <div class="hc-stage">
              <button class="hc-frame" id="hc-frame" aria-label="Cambiar foto de la mascota">
                ${photoTemp
                  ? `<img src="${escapeHtmlAttr(photoTemp)}" alt="Foto de ${escapeHtml(pet.name)}">`
                  : placeholderPhotoSvg()}
                <span class="hint">Tocar para cambiar foto</span>
              </button>
              <div class="hc-motto">
                ${escapeHtml(s.healthMotto || 'Porque su bienestar es nuestra prioridad')}
                <button class="hc-heart" id="hc-heart" aria-label="Dar cariño">🐾</button>
              </div>
            </div>
            <div class="hc-form">
              <div class="hc-row"><b>NOMBRE:</b><span class="v" id="hc-nm" contenteditable="true" spellcheck="false">${escapeHtml(pet.name || '—')}</span></div>
              <div class="hc-row">
                <b>ESPECIE:</b><span class="v" contenteditable="true">${speciesLabel(pet.species) || '—'}</span>
                <b>RAZA:</b><span class="v" contenteditable="true">${escapeHtml(pet.breed || '—')}</span>
              </div>
              <div class="hc-row">
                <b>NACIMIENTO / EDAD:</b><span class="v" contenteditable="true">${pet.age_mode === 'years_months' ? `${pet.age_years || '—'} años, ${pet.age_months || '—'} meses` : pet.birth_date || '—'}</span>
                <span class="hc-sex">
                  <b>SEXO:</b>
                  <button class="hc-chk" data-s="m" aria-label="Macho">${pet.sex === 'Macho' ? '✓' : ''}</button>
                  <b>Macho</b>
                  <button class="hc-chk" data-s="h" aria-label="Hembra">${pet.sex === 'Hembra' ? '✓' : ''}</button>
                  <b>Hembra</b>
                </span>
              </div>
              <div class="hc-row"><b>COLOR / SEÑAS:</b><span class="v" contenteditable="true">${escapeHtml(pet.distinctive_marks || pet.color || '—')}</span></div>
              ${pet.vaccines_list ? `<div class="hc-row"><b>VACUNAS:</b><span class="v" contenteditable="true">${escapeHtml(pet.vaccines_list)}</span></div>` : ''}
              <div class="hc-row"><b>PROPIETARIO:</b><span class="v" contenteditable="true">${escapeHtml(pet.owner_name || '—')}</span><b>N.º REG.:</b><span class="v" contenteditable="true">${pet.carnet_number || '—'}</span></div>
              <div class="hc-row"><b>TELÉFONO:</b><span class="v" contenteditable="true">${pet.owner_phone || '—'}</span></div>
              <div class="hc-addr">${escapeHtml(pet.owner_address || '')}${pet.owner_city ? ' · ' + escapeHtml(pet.owner_city) : ''}${pet.owner_address || pet.owner_city ? ' · Bolivia' : ''}</div>
            </div>
            <button class="hc-open-btn" id="hc-open" aria-label="Ver la salud de la mascota">VER SALUD ›</button>
          </section>

          <!-- REVERSO — Registros de salud -->
          <section class="hc-face hc-back" aria-label="Registros de salud">
            <div class="hc-head">
              <div class="hc-ring">
                <svg viewBox="0 0 36 36">
                  <circle class="tr" cx="18" cy="18" r="15.5"/>
                  <circle class="pr" id="hc-pr" cx="18" cy="18" r="15.5" stroke-dasharray="97.4" stroke-dashoffset="${97.4 * (1 - pct / 100)}"/>
                </svg>
                <span id="hc-pct">${pct}%</span>
              </div>
              <div>
                <h2 id="hc-nm2">${escapeHtml(pet.name || 'Mascota')}</h2>
                <p id="hc-sub">${pct === 100 ? 'Vacunas al día' : total - appliedCount + ' registro pendiente'}</p>
              </div>
              <button class="hc-close" id="hc-close">‹ Portada</button>
            </div>
            <div class="hc-tabs" role="tablist"><i id="hc-ind"></i>
              <button role="tab" aria-selected="true" data-t="vac">Vacunas</button>
              <button role="tab" aria-selected="false" data-t="des">Desparasitación</button>
              <button role="tab" aria-selected="false" data-t="his">Historial</button>
            </div>
            <div class="hc-next" id="hc-next"></div>
            <div class="hc-items" id="hc-items" role="tabpanel"></div>
          </section>

        </div>
      </div>
    </div>

    <!-- Acciones debajo del carnet -->
    <div class="hc-actions">
      <button class="btn btn-primary" id="hc-btn-open">${isOpen ? 'Cerrar salud' : 'Ver salud'}</button>
      <button class="btn btn-outline" id="hc-btn-add-record">Agregar registro de salud</button>
      <button class="btn btn-outline" id="hc-btn-download-png">Descargar PNG</button>
      <button class="btn btn-outline" id="hc-btn-download-pdf">Descargar PDF</button>
      <button class="btn btn-outline" id="hc-btn-print">Imprimir</button>
      <a href="#/" class="btn btn-outline">Volver al sistema</a>
    </div>

    <div id="hc-print-area" class="hc-print-only"></div>
  </div>`;
}

/* ---------- Render del reverso ---------- */

function renderBack() {
  const itemsEl = document.getElementById('hc-items');
  const pr = document.getElementById('hc-pr');
  const pctEl = document.getElementById('hc-pct');
  const subEl = document.getElementById('hc-sub');
  const nextEl = document.getElementById('hc-next');
  const ind = document.getElementById('hc-ind');

  if (!itemsEl) return;

  const appliedCount = records.filter(r => r.applied).length;
  const total = records.length;
  const pct = total ? Math.round((appliedCount / total) * 100) : 0;

  if (pr) pr.style.strokeDashoffset = 97.4 * (1 - pct / 100);
  if (pctEl) pctEl.textContent = pct + '%';
  if (subEl) subEl.textContent = pct === 100 ? 'Vacunas al día' : total - appliedCount + ' registro pendiente';

  const pend = [...records].filter(r => !r.applied && r.type !== 'historial')
    .sort((a, b) => (a.record_date || '').localeCompare(b.record_date || ''))[0];
  if (nextEl) {
    if (pend) {
      const d = daysFromNow(pend.record_date);
      nextEl.innerHTML = `<span>📅</span><span>Próxima cita: <b>${escapeHtml(pend.title)}</b> · ${d >= 0 ? 'en ' + d + ' días' : 'atrasada ' + (-d) + ' días'}</span>`;
    } else {
      nextEl.innerHTML = '<span>🎉</span><span>Todo al día</span>';
    }
  }

  if (ind) ind.style.transform = `translateX(${['vac', 'des', 'his'].indexOf(tab) * 100}%)`;

  itemsEl.innerHTML = '';
  const list = records.filter(r => r.type === tab);
  list.forEach((it, i) => {
    const done = !!it.applied;
    const e = document.createElement('div');
    e.className = 'hc-it' + (done ? ' done' : '');
    e.style.animationDelay = i * 70 + 'ms';
    const pendItem = !done && tab !== 'his';
    e.innerHTML = `
      <button class="hc-top" aria-expanded="false">
        <span class="hc-dot">${done ? '✓' : ''}</span>
        <span class="hc-t"><strong>${escapeHtml(it.title)}</strong><small>${fmtDate(it.record_date)}</small></span>
        <span class="hc-chev">›</span>
      </button>
      <div class="hc-more">
        <div>
          <p>${escapeHtml(it.notes || '')}</p>
          ${it.vet ? `<p><b>Veterinaria:</b> ${escapeHtml(it.vet)}</p>` : ''}
          ${it.product ? `<p><b>Producto:</b> ${escapeHtml(it.product)}</p>` : ''}
          ${it.weight ? `<p><b>Peso:</b> ${escapeHtml(it.weight)} kg</p>` : ''}
          ${it.batch ? `<p><b>Lote:</b> ${escapeHtml(it.batch)}</p>` : ''}
          ${it.scheduled_date ? `<p><b>Programada:</b> ${fmtDate(it.scheduled_date)}</p>` : ''}
          ${it.next_due ? `<p><b>Próxima dosis:</b> ${fmtDate(it.next_due)}</p>` : ''}
          ${pendItem ? `<button class="hc-mark" data-id="${it.id}">Marcar como aplicada</button>` : ''}
        </div>
      </div>
    `;
    e.querySelector('.hc-top').onclick = () => {
      const o = e.classList.toggle('x');
      e.querySelector('.hc-top').setAttribute('aria-expanded', o);
    };
    const m = e.querySelector('.hc-mark');
    if (m) {
      m.onclick = async () => {
        try {
          await api.applyHealthRecord(it.id, true);
          await state.loadHealthRecords(pet.id);
          records = state.getHealthRecords(pet.id);
          renderBack();
          showToast('Registrado: ' + it.title);
        } catch (err) {
          toast(err.message, 'error');
        }
      };
    }
    itemsEl.appendChild(e);
  });
}

/* ---------- Eventos ---------- */

export function bindPresentationEvents() {
  // Ocultar loader tras 2.5s
  setTimeout(() => {
    const loader = document.getElementById('hc-loader');
    if (loader) loader.classList.add('off');
  }, 2500);

  const openBtn = document.getElementById('hc-open');
  const closeBtn = document.getElementById('hc-close');
  const book = document.getElementById('hc-book');
  const tilt = document.getElementById('hc-tilt');
  const btnOpenApp = document.getElementById('hc-btn-open');
  const btnAdd = document.getElementById('hc-btn-add-record');
  const btnDlPng = document.getElementById('hc-btn-download-png');
  const btnDlPdf = document.getElementById('hc-btn-download-pdf');
  const btnPrint = document.getElementById('hc-btn-print');
  const nm = document.getElementById('hc-nm');
  const nm2 = document.getElementById('hc-nm2');

  if (openBtn) openBtn.onclick = () => { book.classList.add('open'); tilt.style.transform = ''; isOpen = true; if (btnOpenApp) btnOpenApp.textContent = 'Cerrar salud'; };
  if (closeBtn) closeBtn.onclick = () => { book.classList.remove('open'); isOpen = false; if (btnOpenApp) btnOpenApp.textContent = 'Ver salud'; };
  if (btnOpenApp) btnOpenApp.onclick = () => {
    if (isOpen) { book.classList.remove('open'); isOpen = false; btnOpenApp.textContent = 'Ver salud'; }
    else { book.classList.add('open'); tilt.style.transform = ''; isOpen = true; btnOpenApp.textContent = 'Cerrar salud'; }
  };

  // Pestañas
  document.querySelectorAll('.hc-tabs button').forEach((b, i) => {
    b.onclick = () => {
      tab = b.dataset.t;
      document.querySelectorAll('.hc-tabs button').forEach(x => x.setAttribute('aria-selected', x === b));
      renderBack();
    };
  });

  // Nombre se sincroniza con el reverso
  if (nm && nm2) {
    nm.addEventListener('input', (e) => { nm2.textContent = e.target.textContent.trim() || 'Mascota'; });
  }

  // Corazón
  const heart = document.getElementById('hc-heart');
  if (heart) {
    heart.onclick = (e) => {
      const h = e.currentTarget;
      h.classList.remove('pop');
      void h.offsetWidth;
      h.classList.add('pop');
      h.textContent = h.textContent === '🐾' ? '❤️' : '🐾';
      if (h.textContent === '❤️') showToast(`¡${escapeHtml(pet.name || 'tu mascota')} mueve la cola!`);
    };
  }

  // Cambiar foto
  const frame = document.getElementById('hc-frame');
  const fi = document.createElement('input');
  fi.type = 'file';
  fi.accept = 'image/*';
  if (frame) frame.onclick = () => fi.click();
  fi.onchange = () => {
    const f = fi.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      photoTemp = r.result;
      const fr = document.getElementById('hc-frame');
      if (fr) {
        const existing = fr.querySelector('svg, img');
        if (existing) existing.replaceWith(Object.assign(new Image(), { src: r.result, alt: 'Foto de la mascota' }));
      }
    };
    r.readAsDataURL(f);
  };

  // Sexo
  document.querySelectorAll('.hc-chk').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.hc-chk').forEach(x => { x.textContent = x === b ? '✓' : ''; });
    };
  });

  // Ojos que siguen al cursor
  addEventListener('pointermove', (e) => {
    const s = document.getElementById('pup');
    if (!s) return;
    const r = s.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const a = Math.atan2(dy, dx);
    const k = Math.min(3.2, Math.hypot(dx, dy) / 60);
    s.querySelectorAll('.p').forEach(p => {
      p.style.transform = `translate(${Math.cos(a) * k}px,${Math.sin(a) * k}px)`;
    });
    if (!document.getElementById('hc-book').classList.contains('open')) {
      const sc = document.getElementById('hc-scene').getBoundingClientRect();
      const x = (e.clientX - (sc.left + sc.width / 2)) / sc.width;
      const y = (e.clientY - (sc.top + sc.height / 2)) / sc.height;
      document.getElementById('hc-tilt').style.transform = `rotateY(${Math.max(-1, Math.min(1, x)) * 7}deg) rotateX(${Math.max(-1, Math.min(1, y)) * -5}deg)`;
    }
  });

  // Agregar registro de salud
  if (btnAdd) {
    btnAdd.onclick = () => openRecordModal();
  }

  // Descargar PNG
  if (btnDlPng) btnDlPng.onclick = () => downloadCard('png');
  // Descargar PDF
  if (btnDlPdf) btnDlPdf.onclick = () => downloadCard('pdf');
  // Imprimir
  if (btnPrint) btnPrint.onclick = printCard;

  renderBack();
}

/* ---------- Modal de registro de salud ---------- */

async function openRecordModal(existingId) {
  const { openModal, closeModal } = await import('../components/modal.js');
  const { iconX } = await import('../icons.js');
  const existing = records.find(r => r.id === existingId) || null;
  const isEdit = !!existing;

  const types = [
    { value: 'vacuna', label: 'Vacuna' },
    { value: 'desparasitacion', label: 'Desparasitación' },
    { value: 'historial', label: 'Historial clínico' },
  ];

  openModal('modal-md', `
    <div class="modal-head">
      <h3>${isEdit ? 'Editar registro' : 'Nuevo registro de salud'}</h3>
      <button class="btn-icon" data-close>${iconX}</button>
    </div>
    <div class="modal-body">
      <form id="hc-record-form">
        <div class="form-grid">
          <div class="field full">
            <label>Tipo *</label>
            <select name="type" required>
              ${types.map(t => `<option value="${t.value}" ${(existing && existing.type === t.value) ? 'selected' : ''}>${t.label}</option>`).join('')}
            </select>
          </div>
          <div class="field full">
            <label>Título *</label>
            <input name="title" required value="${escapeHtmlAttrInput(existing ? existing.title : '')}">
          </div>
          <div class="field">
            <label>Fecha aplicada</label>
            <input type="date" name="record_date" value="${existing ? existing.record_date : ''}">
          </div>
          <div class="field">
            <label>Fecha programada</label>
            <input type="date" name="scheduled_date" value="${existing ? existing.scheduled_date : ''}">
          </div>
          <div class="field">
            <label>Aplicada</label>
            <select name="applied">
              <option value="0" ${existing && existing.applied ? '' : 'selected'}>No</option>
              <option value="1" ${existing && existing.applied ? 'selected' : ''}>Sí</option>
            </select>
          </div>
          <div class="field">
            <label>Próxima dosis</label>
            <input type="date" name="next_due" value="${existing ? existing.next_due : ''}">
          </div>
          <div class="field full">
            <label>Veterinaria</label>
            <input name="vet" value="${escapeHtmlAttrInput(existing ? existing.vet : '')}">
          </div>
          <div class="field full">
            <label>Producto (desparasitación)</label>
            <input name="product" value="${escapeHtmlAttrInput(existing ? existing.product : '')}">
          </div>
          <div class="field full">
            <label>Lote (vacuna)</label>
            <input name="batch" value="${escapeHtmlAttrInput(existing ? existing.batch : '')}">
          </div>
          <div class="field full">
            <label>Peso (kg)</label>
            <input type="number" step="0.1" name="weight" value="${existing ? existing.weight : ''}">
          </div>
          <div class="field full">
            <label>Notas / observaciones</label>
            <textarea name="notes" rows="3">${escapeHtmlAttrInput(existing ? existing.notes : '')}</textarea>
          </div>
        </div>
      </form>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-close>Cancelar</button>
      <button class="btn btn-primary" id="hc-btn-save-record">${isEdit ? 'Guardar cambios' : 'Guardar registro'}</button>
    </div>
  `);

  document.getElementById('hc-btn-save-record').onclick = async () => {
    const form = document.getElementById('hc-record-form');
    const fd = new FormData(form);
    const get = (k) => fd.get(k) || '';
    if (!get('title').trim()) { toast('El título es requerido', 'error'); return; }

    const payload = {
      type: get('type'),
      title: get('title'),
      record_date: get('record_date'),
      scheduled_date: get('scheduled_date'),
      applied: get('applied') === '1',
      next_due: get('next_due'),
      vet: get('vet'),
      product: get('product'),
      batch: get('batch'),
      weight: get('weight'),
      notes: get('notes'),
    };

    try {
      if (isEdit) {
        await api.updateHealthRecord(existingId, payload);
        toast('Registro actualizado');
      } else {
        await api.createHealthRecord(pet.id, payload);
        toast('Registro guardado');
      }
      await state.loadHealthRecords(pet.id);
      records = state.getHealthRecords(pet.id);
      renderBack();
      closeModal();
      import('../app.js').then((m) => m.renderApp());
    } catch (err) { toast(err.message, 'error'); }
  };
}

function escapeHtmlAttrInput(s) {
  return String(s || '').replace(/"/g, '&quot;');
}

/* ---------- Exportar / imprimir ---------- */

export async function downloadCard(type) {
  if (!pet) { toast('Selecciona una mascota primero', 'error'); return; }

  const scene = document.getElementById('hc-scene');
  const book = document.getElementById('hc-book');
  if (!scene || !book) return;

  const front = document.querySelector('.hc-front');
  const back = document.querySelector('.hc-back');
  if (!front || !back) return;

  renderBack();

  const w = scene.offsetWidth || 320;
  const h = scene.offsetHeight || 496;

  const canvasF = await html2canvas(front, { scale: 3, backgroundColor: null, width: w, height: h });
  const canvasB = await html2canvas(back, { scale: 3, backgroundColor: null, width: w, height: h });

  if (type === 'png') {
    const gap = 40;
    const combo = document.createElement('canvas');
    combo.width = canvasF.width;
    combo.height = canvasF.height * 2 + gap;
    const ctx = combo.getContext('2d');
    ctx.fillStyle = '#f3f1ec';
    ctx.fillRect(0, 0, combo.width, combo.height);
    ctx.drawImage(canvasF, 0, 0);
    ctx.drawImage(canvasB, 0, canvasF.height + gap);
    const a = document.createElement('a');
    a.href = combo.toDataURL('image/png');
    a.download = `presentacion-${pet.carnet_number || pet.id}.png`;
    a.click();
  } else {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [100, 155] });
    pdf.addImage(canvasF.toDataURL('image/png'), 'PNG', 0, 0, 100, 155);
    pdf.addPage([100, 155], 'portrait');
    pdf.addImage(canvasB.toDataURL('image/png'), 'PNG', 0, 0, 100, 155);
    pdf.save(`presentacion-${pet.carnet_number || pet.id}.pdf`);
  }

  try {
    await api.logHistory('Descarga de presentación', `${pet.name} (${type.toUpperCase()})`);
  } catch { /* no bloquear */ }
  toast('Presentación descargada');
}

export function printCard() {
  if (!pet) { toast('Selecciona una mascota', 'error'); return; }
  const front = document.querySelector('.hc-front');
  const back = document.querySelector('.hc-back');
  if (!front || !back) return;

  renderBack();

  const printWrap = document.createElement('div');
  printWrap.className = 'hc-print-root';
  printWrap.style.display = 'flex';
  printWrap.style.flexDirection = 'column';
  printWrap.style.alignItems = 'center';
  printWrap.innerHTML = `
    <div style="page-break-after: always; width:100%;">${front.outerHTML}</div>
    <div style="width:100%;">${back.outerHTML}</div>`;
  document.body.appendChild(printWrap);
  window.print();
  printWrap.remove();

  try {
    api.logHistory('Impresión de presentación', `${pet.name} (${pet.carnet_number || pet.id})`);
  } catch { /* no bloquear */ }
  toast('Enviado a impresión');
}
