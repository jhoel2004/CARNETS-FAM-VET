/* ============================================================
   PRESENTACIÓN DE MASCOTA — FAMUVET (diseño fiel a "Conoce a Max")
   Página pública del QR — datos reales de la API.
   ============================================================ */

import { api } from '../api.js';
import { state } from '../state.js';
import { escapeHtml, speciesLabel, placeholderPhoto, publicUrl, toast } from '../utils.js';

let pet = null;
let records = [];
let tab = 'vac';
let photoTemp = '';
let isOpen = false;

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
  const el = document.getElementById('toast');
  if (el) {
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => el.classList.remove('on'), 2200);
  } else {
    toast(msg);
  }
}

/** SVG placeholder animado de perrito (idéntico al HTML de referencia) */
function placeholderPhotoSvg() {
  return `<svg id="pup" viewBox="0 0 200 200" aria-hidden="true">
    <rect width="200" height="200" fill="#e4eefc"/>
    <ellipse cx="45" cy="95" rx="24" ry="44" fill="#b9762c" transform="rotate(18 45 95)"/>
    <ellipse cx="155" cy="95" rx="24" ry="44" fill="#b9762c" transform="rotate(-18 155 95)"/>
    <circle cx="100" cy="108" r="62" fill="#e9b564"/>
    <ellipse cx="100" cy="134" rx="35" ry="27" fill="#f8e5ba"/>
    <g class="eye"><circle cx="76" cy="100" r="9" fill="#fff"/><circle class="p" cx="76" cy="100" r="6" fill="#2a2320"/></g>
    <g class="eye"><circle cx="124" cy="100" r="9" fill="#fff"/><circle class="p" cx="124" cy="100" r="6" fill="#2a2320"/></g>
    <ellipse cx="100" cy="120" rx="12" ry="8" fill="#2a2320"/>
    <path d="M100 128v8M100 136q-12 12-22 2M100 136q12 12 22 2" fill="none" stroke="#2a2320" stroke-width="3" stroke-linecap="round"/>
    <path d="M92 142q8 22 16 0z" fill="#ef7f8f">
      <animate attributeName="d" values="M92 142q8 14 16 0z;M92 142q8 26 16 0z;M92 142q8 14 16 0z" dur="1.6s" repeatCount="indefinite"/>
    </path>
    <rect y="178" width="200" height="22" fill="#3f9a58"/>
  </svg>`;
}

/* ---------- Carga de datos ---------- */

export async function viewPresentation(petId) {
  try {
    pet = await api.getPublicPet(petId);
  } catch {
    pet = null;
  }
  if (!pet) {
    return `
    <div class="hc-view">
      <div class="scene">
        <div class="tilt">
          <div class="book">
            <section class="face front">
              <div style="padding:40px 20px; text-align:center;">
                <div style="font-size:48px; margin-bottom:16px;">🐾</div>
                <h2 style="color:var(--navy); margin-bottom:8px;">No encontrado</h2>
                <p style="color:var(--ink); opacity:.8;">Este código QR no corresponde a ninguna mascota registrada.</p>
                <a href="#/" style="color:var(--blue); text-decoration:none;">Ir al sistema</a>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>`;
  }

  photoTemp = pet.photo || '';
  records = state.getHealthRecords(pet.id) || [];

  const s = state.getSettings();

  // Calcular progreso de vacunas
  const vacRecords = records.filter(r => r.type === 'vacuna');
  const appliedVac = vacRecords.filter(r => r.applied).length;
  const totalVac = vacRecords.length;
  const pct = totalVac ? Math.round((appliedVac / totalVac) * 100) : 0;

  // Próxima cita pendiente (vacunas + desparasitación)
  const pendAll = records
    .filter(r => !r.applied && r.type !== 'historial')
    .sort((a, b) => (a.record_date || '').localeCompare(b.record_date || ''))[0];

  const nextHtml = pendAll
    ? (() => {
        const d = daysFromNow(pendAll.record_date);
        return `<span>📅</span><span>Próxima cita: <b>${escapeHtml(pendAll.title)}</b> · ${d >= 0 ? 'en ' + d + ' días' : 'atrasada ' + (-d) + ' días'}</span>`;
      })()
    : '<span>🎉</span><span>Todo al día</span>';

  // Datos del propietario para mostrar dirección
  const addrParts = [
    pet.owner_address,
    pet.owner_city,
    (pet.owner_address || pet.owner_city) ? 'Bolivia' : null,
  ].filter(Boolean);
  const addrLine = addrParts.join(' · ');

  return `
  <div class="hc-view">

  <div class="loader" id="loader" role="status" aria-label="Cargando">
    <span class="dog" aria-hidden="true">🐕</span>
    <div class="trail" aria-hidden="true">
      <span>🐾</span><span>🐾</span><span>🐾</span><span>🐾</span><span>🐾</span><span>🐾</span>
    </div>
    <p>Buscando a ${escapeHtml(pet.name)}…</p>
  </div>

  <div class="scene"><div class="tilt" id="tilt"><div class="book" id="book">

    <!-- ====== PORTADA ====== -->
    <section class="face front" aria-label="Presentación de la mascota">

      <div class="logo">
        <span class="pets" aria-hidden="true">🐶🐱🐦</span>
        <span class="brand">FAM<svg viewBox="0 0 40 52" aria-hidden="true"><path d="M7 4V27a13 13 0 0 0 26 0V4"/><path class="tl" d="M33 27c0 14-8 20-20 21"/></svg>VET</span>
      </div>

      <svg class="beat" viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 12 H70 l6-9 l8 18 l6-9 H200"/>
      </svg>

      <div class="tag">${escapeHtml(s.healthTagline || 'Amor, cuidado y salud para toda la vida')}</div>

      <h1>PRESENTACIÓN</h1>
      <div class="ribbon">de mi mascota</div>

      <p class="list">${escapeHtml(s.healthServices || 'Control sanitario · Vacunación · Desparasitación · Historial clínico')}</p>

      <div class="stage">
        <button class="frame" id="frame" aria-label="Cambiar foto de la mascota">
          ${photoTemp
            ? `<img src="${escapeHtmlAttr(photoTemp)}" alt="Foto de ${escapeHtml(pet.name)}">`
            : placeholderPhotoSvg()}
          <span class="hint">Tocar para cambiar foto</span>
        </button>
        <div class="motto">
          ${escapeHtml(s.healthMotto || 'Porque su bienestar es nuestra prioridad')}
          <button class="heart" id="heart" aria-label="Dar cariño">🐾</button>
        </div>
      </div>

      <div class="form">
        <div class="row"><b>NOMBRE:</b><span class="v" id="nm" contenteditable="true" spellcheck="false">${escapeHtml(pet.name || '—')}</span></div>
        <div class="row">
          <b>ESPECIE:</b><span class="v" contenteditable="true">${escapeHtml(speciesLabel(pet.species) || '—')}</span>
          <b>RAZA:</b><span class="v" contenteditable="true">${escapeHtml(pet.breed || '—')}</span>
        </div>
        <div class="row">
          <b>NACIMIENTO:</b><span class="v" contenteditable="true">${escapeHtml(pet.birth_date || '—')}</span>
          <span class="sex">
            <b>SEXO:</b>
            <button class="chk" data-s="m" aria-label="Macho">${pet.sex === 'Macho' ? '✓' : ''}</button><b>Macho</b>
            <button class="chk" data-s="h" aria-label="Hembra">${pet.sex === 'Hembra' ? '✓' : ''}</button><b>Hembra</b>
          </span>
        </div>
        <div class="row"><b>COLOR / SEÑAS:</b><span class="v" contenteditable="true">${escapeHtml(pet.distinctive_marks || pet.color || '—')}</span></div>
        <div class="row">
          <b>PROPIETARIO:</b><span class="v" contenteditable="true">${escapeHtml(pet.owner_name || '—')}</span>
          <b>N.º REG.:</b><span class="v" contenteditable="true">${escapeHtml(String(pet.carnet_number || '—'))}</span>
        </div>
        <div class="row"><b>TELÉFONO:</b><span class="v" contenteditable="true">${escapeHtml(pet.owner_phone || '—')}</span></div>
        ${addrLine ? `<div class="addr">${escapeHtml(addrLine)}</div>` : ''}
      </div>

      <button class="open-btn" id="open" aria-label="Ver la salud de la mascota">VER SALUD ›</button>
    </section>

    <!-- ====== REVERSO / SALUD ====== -->
    <section class="face back" aria-label="Registros de salud">
      <div class="head">
        <div class="ring">
          <svg viewBox="0 0 36 36">
            <circle class="tr" cx="18" cy="18" r="15.5"/>
            <circle class="pr" id="pr" cx="18" cy="18" r="15.5"
              stroke-dasharray="97.4"
              stroke-dashoffset="${97.4 * (1 - pct / 100)}"/>
          </svg>
          <span id="pct">${pct}%</span>
        </div>
        <div>
          <h2 id="nm2">${escapeHtml(pet.name || 'Mascota')}</h2>
          <p id="sub">${pct === 100 ? 'Vacunas al día' : (totalVac - appliedVac) + ' vacuna pendiente'}</p>
        </div>
        <button class="close" id="close">‹ Portada</button>
      </div>

      <div class="tabs" role="tablist">
        <i id="ind"></i>
        <button role="tab" aria-selected="true"  data-t="vac">Vacunas</button>
        <button role="tab" aria-selected="false" data-t="des">Desparasitación</button>
        <button role="tab" aria-selected="false" data-t="his">Historial</button>
      </div>

      <div class="next" id="next">${nextHtml}</div>
      <div class="items" id="items" role="tabpanel"></div>
    </section>

  </div></div></div>

  <div class="toast" id="toast" role="status"></div>

  </div>`;
}

/* ---------- Render del reverso ---------- */

function renderBack() {
  const itemsEl = document.getElementById('items');
  const pr      = document.getElementById('pr');
  const pctEl   = document.getElementById('pct');
  const subEl   = document.getElementById('sub');
  const nextEl  = document.getElementById('next');
  const ind     = document.getElementById('ind');

  if (!itemsEl) return;

  // Recalcular progreso con vacunas
  const vacRecords   = records.filter(r => r.type === 'vacuna');
  const appliedVac   = vacRecords.filter(r => r.applied).length;
  const totalVac     = vacRecords.length;
  const pct          = totalVac ? Math.round((appliedVac / totalVac) * 100) : 0;

  if (pr)    pr.style.strokeDashoffset = 97.4 * (1 - pct / 100);
  if (pctEl) pctEl.textContent = pct + '%';
  if (subEl) subEl.textContent = pct === 100 ? 'Vacunas al día' : (totalVac - appliedVac) + ' vacuna pendiente';

  // Próxima cita
  const pend = records
    .filter(r => !r.applied && r.type !== 'historial')
    .sort((a, b) => (a.record_date || '').localeCompare(b.record_date || ''))[0];

  if (nextEl) {
    if (pend) {
      const d = daysFromNow(pend.record_date);
      nextEl.innerHTML = `<span>📅</span><span>Próxima cita: <b>${escapeHtml(pend.title)}</b> · ${d >= 0 ? 'en ' + d + ' días' : 'atrasada ' + (-d) + ' días'}</span>`;
    } else {
      nextEl.innerHTML = '<span>🎉</span><span>Todo al día</span>';
    }
  }

  // Indicador de tab (slider)
  const tabIndex = ['vac', 'des', 'his'].indexOf(tab);
  if (ind) ind.style.transform = `translateX(${tabIndex * 100}%)`;

  // Mapeo tipo de registro → tab
  const typeMap = { vac: 'vacuna', des: 'desparasitacion', his: 'historial' };
  const currentType = typeMap[tab] || 'vacuna';

  itemsEl.innerHTML = '';
  const list = records.filter(r => r.type === currentType);

  list.forEach((it, i) => {
    const done    = !!it.applied;
    const pendItem = !done && tab !== 'his';
    const e       = document.createElement('div');
    e.className   = 'it' + (done ? ' done' : '');
    e.style.animationDelay = i * 70 + 'ms';

    // Construir detalles extra
    const extras = [
      it.notes    ? `<p>${escapeHtml(it.notes)}</p>` : '',
      it.vet      ? `<p><b>Veterinaria:</b> ${escapeHtml(it.vet)}</p>` : '',
      it.product  ? `<p><b>Producto:</b> ${escapeHtml(it.product)}</p>` : '',
      it.weight   ? `<p><b>Peso:</b> ${escapeHtml(String(it.weight))} kg</p>` : '',
      it.batch    ? `<p><b>Lote:</b> ${escapeHtml(it.batch)}</p>` : '',
      it.scheduled_date ? `<p><b>Programada:</b> ${fmtDate(it.scheduled_date)}</p>` : '',
      it.next_due ? `<p><b>Próxima dosis:</b> ${fmtDate(it.next_due)}</p>` : '',
      pendItem    ? `<button class="mark">Marcar como aplicada</button>` : '',
    ].join('');

    e.innerHTML = `
      <button class="top" aria-expanded="false">
        <span class="dot">${done ? '✓' : ''}</span>
        <span class="t">
          <strong>${escapeHtml(it.title)}</strong>
          <small>${fmtDate(it.record_date)}</small>
        </span>
        <span class="chev">›</span>
      </button>
      <div class="more"><div>${extras}</div></div>
    `;

    // Toggle acordeón
    e.querySelector('.top').onclick = () => {
      const open = e.classList.toggle('x');
      e.querySelector('.top').setAttribute('aria-expanded', open);
    };

    // Marcar como aplicada
    const m = e.querySelector('.mark');
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
  // Ocultar loader tras 2.3 s (como en el HTML de referencia)
  setTimeout(() => {
    const loader = document.getElementById('loader');
    if (loader) loader.classList.add('off');
  }, 2300);

  const openBtn  = document.getElementById('open');
  const closeBtn = document.getElementById('close');
  const book     = document.getElementById('book');
  const tilt     = document.getElementById('tilt');
  const nm       = document.getElementById('nm');
  const nm2      = document.getElementById('nm2');

  // Flip del libro
  if (openBtn)  openBtn.onclick  = () => { book.classList.add('open');    tilt.style.transform = ''; isOpen = true; };
  if (closeBtn) closeBtn.onclick = () => { book.classList.remove('open'); isOpen = false; };

  // Pestañas
  document.querySelectorAll('.tabs button').forEach((b, i) => {
    b.onclick = () => {
      tab = b.dataset.t;
      document.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', x === b));
      const ind = document.getElementById('ind');
      if (ind) ind.style.transform = `translateX(${i * 100}%)`;
      renderBack();
    };
  });

  // Sincronizar nombre portada ↔ reverso
  if (nm && nm2) {
    nm.addEventListener('input', (e) => {
      nm2.textContent = e.target.textContent.trim() || 'Mascota';
    });
  }

  // Botón de corazón
  const heart = document.getElementById('heart');
  if (heart) {
    heart.onclick = (e) => {
      const h = e.currentTarget;
      h.classList.remove('pop');
      void h.offsetWidth;
      h.classList.add('pop');
      h.textContent = h.textContent === '🐾' ? '❤️' : '🐾';
      if (h.textContent === '❤️') showToast(`¡${escapeHtml(pet?.name || 'tu mascota')} mueve la cola!`);
    };
  }

  // Cambiar foto
  const frame = document.getElementById('frame');
  const fi    = document.createElement('input');
  fi.type     = 'file';
  fi.accept   = 'image/*';
  if (frame) frame.onclick = () => fi.click();
  fi.onchange = () => {
    const f = fi.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      photoTemp = r.result;
      const fr = document.getElementById('frame');
      if (fr) {
        const existing = fr.querySelector('svg, img');
        if (existing) {
          const img = new Image();
          img.src = r.result;
          img.alt = 'Foto de la mascota';
          existing.replaceWith(img);
        }
      }
    };
    r.readAsDataURL(f);
  };

  // Checkboxes de sexo
  document.querySelectorAll('.chk').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.chk').forEach(x => { x.textContent = x === b ? '✓' : ''; });
    };
  });

  // Ojos que siguen al cursor + efecto tilt del libro
  addEventListener('pointermove', (e) => {
    const s = document.getElementById('pup');
    if (s) {
      const rect = s.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top  + rect.height / 2);
      const a  = Math.atan2(dy, dx);
      const k  = Math.min(3.2, Math.hypot(dx, dy) / 60);
      s.querySelectorAll('.p').forEach(p => {
        p.style.transform = `translate(${Math.cos(a) * k}px, ${Math.sin(a) * k}px)`;
      });
    }

    const bookEl = document.getElementById('book');
    const tiltEl = document.getElementById('tilt');
    if (bookEl && tiltEl && !bookEl.classList.contains('open')) {
      const sc = document.querySelector('.scene')?.getBoundingClientRect();
      if (sc) {
        const x = (e.clientX - (sc.left + sc.width  / 2)) / sc.width;
        const y = (e.clientY - (sc.top  + sc.height / 2)) / sc.height;
        tiltEl.style.transform =
          `rotateY(${Math.max(-1, Math.min(1, x)) * 7}deg) rotateX(${Math.max(-1, Math.min(1, y)) * -5}deg)`;
      }
    }
  });

  renderBack();
}

/* ---------- Modal de registro de salud ---------- */

function escapeHtmlAttrInput(s) {
  return String(s || '').replace(/"/g, '&quot;');
}

async function openRecordModal(existingId) {
  const { openModal, closeModal } = await import('../components/modal.js');
  const { iconX } = await import('../icons.js');
  const existing = records.find(r => r.id === existingId) || null;
  const isEdit   = !!existing;

  const types = [
    { value: 'vacuna',         label: 'Vacuna' },
    { value: 'desparasitacion', label: 'Desparasitación' },
    { value: 'historial',      label: 'Historial clínico' },
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
              ${types.map(t => `<option value="${t.value}" ${existing && existing.type === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
            </select>
          </div>
          <div class="field full">
            <label>Título *</label>
            <input name="title" required value="${escapeHtmlAttrInput(existing ? existing.title : '')}">
          </div>
          <div class="field">
            <label>Fecha</label>
            <input type="date" name="record_date" value="${existing ? existing.record_date : ''}">
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
            <label>Peso (kg)</label>
            <input type="number" step="0.1" name="weight" value="${existing ? existing.weight : ''}">
          </div>
          <div class="field full">
            <label>Lote (vacuna)</label>
            <input name="batch" value="${escapeHtmlAttrInput(existing ? existing.batch : '')}">
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
    const fd   = new FormData(form);
    const get  = (k) => fd.get(k) || '';
    if (!get('title').trim()) { toast('El título es requerido', 'error'); return; }

    const payload = {
      type:          get('type'),
      title:         get('title'),
      record_date:   get('record_date'),
      next_due:      get('next_due'),
      vet:           get('vet'),
      product:       get('product'),
      batch:         get('batch'),
      weight:        get('weight'),
      notes:         get('notes'),
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

/* ---------- Exportar / imprimir ---------- */

export async function downloadCard(type) {
  if (!pet) { toast('Selecciona una mascota primero', 'error'); return; }

  const scene = document.querySelector('.scene');
  const book  = document.getElementById('book');
  if (!scene || !book) return;

  const front = document.querySelector('.face.front');
  const back  = document.querySelector('.face.back');
  if (!front || !back) return;

  renderBack();

  const w = scene.offsetWidth  || 320;
  const h = scene.offsetHeight || 496;

  const canvasF = await html2canvas(front, { scale: 3, backgroundColor: null, width: w, height: h });
  const canvasB = await html2canvas(back,  { scale: 3, backgroundColor: null, width: w, height: h });

  if (type === 'png') {
    const gap   = 40;
    const combo = document.createElement('canvas');
    combo.width  = canvasF.width;
    combo.height = canvasF.height * 2 + gap;
    const ctx = combo.getContext('2d');
    ctx.fillStyle = '#f3f1ec';
    ctx.fillRect(0, 0, combo.width, combo.height);
    ctx.drawImage(canvasF, 0, 0);
    ctx.drawImage(canvasB, 0, canvasF.height + gap);
    const a = document.createElement('a');
    a.href     = combo.toDataURL('image/png');
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
  const front = document.querySelector('.face.front');
  const back  = document.querySelector('.face.back');
  if (!front || !back) return;

  renderBack();

  const printWrap = document.createElement('div');
  printWrap.className = 'hc-print-root';
  printWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;';
  printWrap.innerHTML = `
    <div style="page-break-after:always;width:100%;">${front.outerHTML}</div>
    <div style="width:100%;">${back.outerHTML}</div>`;
  document.body.appendChild(printWrap);
  window.print();
  printWrap.remove();

  try {
    api.logHistory('Impresión de presentación', `${pet.name} (${pet.carnet_number || pet.id})`);
  } catch { /* no bloquear */ }
  toast('Enviado a impresión');
}
