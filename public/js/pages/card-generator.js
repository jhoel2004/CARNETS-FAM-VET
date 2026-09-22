import { api } from '../api.js';
import { iconCard } from '../icons.js';
import { escapeHtml, speciesLabel, placeholderPhoto, publicUrl, toast } from '../utils.js';

let state = null;

const TEMPLATES = [
  { id: 'bolivia', name: 'Bolivia' }, { id: 'azul', name: 'Azul' }, { id: 'verde', name: 'Verde' },
  { id: 'minimal', name: 'Minimalista' }, { id: 'moderna', name: 'Moderna' }, { id: 'vet', name: 'Veterinaria' }
];

export function initCard(s) {
  state = s;
}

export function viewCarnet() {
  const pets = state.getPets();
  const sel = state.cardPetId || (pets[0] && pets[0].id) || '';
  state.cardPetId = sel;
  state.cardTemplate = state.cardTemplate || state.getSettings().defaultTemplate || 'bolivia';

  return `
  <div class="page-head"><div><h1>Generador de carnets</h1><p>Diseño tipo cédula de identidad oficial — anverso y reverso.</p></div></div>
  <div class="carnet-stage">
    <div class="carnet-preview-col">
      <div class="card-faces">
        <div class="face-label">Anverso</div>
        <div id="card-render-front"></div>
        <div class="face-label">Reverso</div>
        <div id="card-render-back"></div>
      </div>
    </div>
    <div class="carnet-options-col">
      <div class="panel" style="margin-bottom:16px;">
        <h3>Mascota</h3>
        <select id="carnet-pet-select" class="chip" style="width:100%; cursor:pointer;">
          ${pets.length ? pets.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${escapeHtml(p.name)} — ${p.carnet_number}</option>`).join('') : '<option>No hay mascotas registradas</option>'}
        </select>
      </div>
      <div class="panel">
        <h3>Plantilla</h3>
        <div class="tpl-grid">
          ${TEMPLATES.map(t => `
            <div>
              <div class="tpl-swatch tpl-${t.id} ${state.cardTemplate === t.id ? 'selected' : ''}" data-tpl="${t.id}"><div class="tri-top"><span></span><span></span><span></span></div></div>
              <div class="tpl-name">${t.name}</div>
            </div>`).join('')}
        </div>
        <div class="flex gap-2" style="margin-top:6px; flex-direction:column;">
          <button class="btn btn-primary" id="btn-download-png">⬇ Descargar PNG (ambos lados)</button>
          <button class="btn btn-outline" id="btn-download-pdf">⬇ Descargar PDF (ambos lados)</button>
          <button class="btn btn-outline" id="btn-print-card">🖨 Imprimir</button>
        </div>
      </div>
    </div>
  </div>
  <div id="print-area" class="hidden"></div>`;
}

function currentPet() {
  return state.getPets().find(p => p.id === state.cardPetId);
}

function expiryDate(pet) {
  const d = pet.registration_date ? new Date(pet.registration_date) : new Date();
  d.setFullYear(d.getFullYear() + 5);
  return d.toISOString().slice(0, 10);
}

function mrzLines(pet) {
  const clean = s => (s || '').toString().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '<');
  const l1 = ('ID BOL' + clean(pet.carnet_number) + '<<<<<<<<<<<<<<<<<<<<').slice(0, 30);
  const l2 = (clean(pet.species) + '<<' + clean(pet.breed) + '<<<<<<<<<<<<<<<<<<<').slice(0, 30);
  const l3 = (clean(pet.name) + '<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<').slice(0, 30);
  const l4 = (clean(pet.owner_name).replace(/\s+/g, '<') + '<<<<<<<<<<<<<<<<<<<<<<').slice(0, 30);
  return [l1, l2, l3, l4];
}

function pawWatermarkSvg() {
  return `<svg class="watermark-seal" viewBox="0 0 100 100"><circle cx="50" cy="35" r="9"/><circle cx="30" cy="48" r="9"/><circle cx="70" cy="48" r="9"/><path d="M50 55c-15 0-24 10-24 22s11 18 24 18 24-6 24-18-9-22-24-22z"/></svg>`;
}

function pawStampSvg() {
  return `<svg class="id-paw-stamp" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <g fill="#141414">
      <ellipse cx="30" cy="30" rx="10" ry="13" transform="rotate(-18 30 30)"/>
      <ellipse cx="54" cy="18" rx="10" ry="13"/>
      <ellipse cx="78" cy="30" rx="10" ry="13" transform="rotate(18 78 30)"/>
      <path d="M54 42c-20 0-33 15-33 32 0 13 12 20 33 20s33-7 33-20c0-17-13-32-33-32z"/>
    </g>
  </svg>`;
}

function cardFrontHtml(pet, tpl) {
  if (!pet) return `<div class="id-card tpl-${tpl}"><div class="empty-state" style="padding:20px;">${iconCard}<div><b>Sin mascota</b><p style="font-size:12px;">Registra una mascota primero.</p></div></div></div>`;
  const lost = pet.status === 'Perdido';
  const settings = state.getSettings();
  return `
  <div class="id-card tpl-${tpl}" id="the-id-card-front">
    <div class="guilloche"></div>
    ${pawWatermarkSvg()}
    <div class="side-strip"><span>${pet.carnet_number}</span></div>
    <div class="tri-top"><span></span><span></span><span></span></div>
    <div class="id-front-head">
      <div class="seal-emblem">🐾</div>
      <div class="country-titles">
        <div class="l1">${escapeHtml(settings.systemName)}</div>
        <div class="l2">${escapeHtml(settings.systemSub)}</div>
      </div>
      <div class="doc-title"><b>CARNET DE<br>IDENTIFICACIÓN</b><small>Mascota registrada</small></div>
    </div>
    <div class="id-serial-row"><span>SERIE: ${pet.id.slice(-6).toUpperCase()}</span><span>SECCIÓN: ${(pet.species || '').slice(0, 3).toUpperCase()}</span></div>
    <div class="id-front-body">
      <img class="id-photo" src="${pet.photo || placeholderPhoto()}">
      <div class="id-data">
        <div class="df-row"><label>Nombre</label><div class="val name">${escapeHtml(pet.name)}</div></div>
        <div class="df-row"><label>Especie / Raza</label><div class="val">${speciesLabel(pet.species)} · ${escapeHtml(pet.breed || '—')}</div></div>
        <div class="df-grid">
          <div class="df-row"><label>Sexo</label><div class="val">${pet.sex}</div></div>
          <div class="df-row"><label>Color</label><div class="val">${escapeHtml(pet.color || '—')}</div></div>
          <div class="df-row"><label>Fecha de nacimiento</label><div class="val">${pet.birth_date || '—'}</div></div>
          <div class="df-row"><label>Fecha de emisión</label><div class="val">${pet.registration_date}</div></div>
        </div>
      </div>
    </div>
    <div class="id-front-foot">
      <div class="id-carnet-no">N° ${pet.carnet_number}<small>Fecha de expiración: ${expiryDate(pet)}</small></div>
      <div class="id-sig"><div class="sig-script">${escapeHtml(settings.signatureText || (state.user ? state.user.name.split(' ')[0] : 'Pet Llama'))}</div>Firma</div>
      <div class="id-flag-mini"><span></span><span></span><span></span></div>
    </div>
    ${lost ? `<div class="id-lost-stamp">PERDIDO</div>` : ''}
  </div>`;
}

function cardBackHtml(pet, tpl) {
  if (!pet) return `<div class="id-card tpl-${tpl}"></div>`;
  const lost = pet.status === 'Perdido';
  const mrz = mrzLines(pet);
  const birthPlace = pet.owner_city || 'No registrado';
  return `
  <div class="id-card tpl-${tpl}" id="the-id-card-back">
    <div class="guilloche"></div>
    ${pawWatermarkSvg()}
    <div class="side-strip"><span>${pet.carnet_number}</span></div>
    <div class="tri-top"><span></span><span></span><span></span></div>
    <div class="id-back">
      <div class="id-back-top">
        <div class="id-qr-box" id="card-qr"></div>
        <div class="id-back-fields">
          <div class="full"><label>Lugar de nacimiento</label><div class="val">${escapeHtml(birthPlace)}</div></div>
          <div class="full"><label>Propietario</label><div class="val">${escapeHtml(pet.owner_name)}</div></div>
          <div><label>CI</label><div class="val">${escapeHtml(pet.owner_ci || '—')}</div></div>
          <div><label>Teléfono</label><div class="val">${escapeHtml(pet.owner_phone || '—')}</div></div>
          <div class="full"><label>Domicilio</label><div class="val">${escapeHtml(pet.owner_address || '—')}, ${escapeHtml(pet.owner_city || '—')}</div></div>
          <div><label>Profesión</label><div class="val">Mascota de compañía</div></div>
          <div><label>Categoría</label><div class="val">${escapeHtml(pet.category || 'General')}</div></div>
          <div><label>Estado civil</label><div class="val">Soltero(a)</div></div>
          <div><label>Hijos</label><div class="val">${escapeHtml(pet.offspring || 'Ninguno')}</div></div>
          <div class="full"><label>Estado</label><div class="val"><span class="id-status-strip ${pet.status}">${pet.status}</span></div></div>
        </div>
        <div class="id-paw-block">
          ${pawStampSvg()}
          <label>Impronta de patita</label>
        </div>
      </div>
      <div class="id-mrz-spacer"></div>
      <div class="id-mrz">${mrz.map(l => `<div>${l}</div>`).join('')}</div>
    </div>
    ${lost ? `<div class="id-lost-stamp">PERDIDO</div>` : ''}
  </div>`;
}

export function renderCardPreview() {
  const pet = currentPet();
  const front = document.getElementById('card-render-front');
  const back = document.getElementById('card-render-back');
  if (!front || !back) return;
  front.innerHTML = cardFrontHtml(pet, state.cardTemplate);
  back.innerHTML = cardBackHtml(pet, state.cardTemplate);
  const qrHolder = document.getElementById('card-qr');
  if (qrHolder && pet) { new QRCode(qrHolder, { text: publicUrl(pet.id), width: 120, height: 120 }); }
}

export function bindCarnetEvents() {
  const sel = document.getElementById('carnet-pet-select');
  if (sel) sel.addEventListener('change', () => { state.cardPetId = sel.value; renderCardPreview(); });
  document.querySelectorAll('[data-tpl]').forEach(el => el.addEventListener('click', () => { state.cardTemplate = el.dataset.tpl; import('../app.js').then(m => { m.renderView(); renderCardPreview(); }); }));
  const dlPng = document.getElementById('btn-download-png');
  if (dlPng) dlPng.addEventListener('click', () => downloadCard('png'));
  const dlPdf = document.getElementById('btn-download-pdf');
  if (dlPdf) dlPdf.addEventListener('click', () => downloadCard('pdf'));
  const pr = document.getElementById('btn-print-card');
  if (pr) pr.addEventListener('click', printCard);
}

async function downloadCard(type) {
  const front = document.getElementById('the-id-card-front');
  const back = document.getElementById('the-id-card-back');
  if (!front || !back) { toast('Selecciona una mascota primero', 'error'); return; }
  const pet = currentPet();
  const [canvasF, canvasB] = await Promise.all([
    html2canvas(front, { scale: 3, backgroundColor: null }),
    html2canvas(back, { scale: 3, backgroundColor: null })
  ]);
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
    a.download = `carnet-${pet.carnet_number}.png`;
    a.click();
  } else {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85.6, 54] });
    pdf.addImage(canvasF.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 54);
    pdf.addPage([85.6, 54], 'landscape');
    pdf.addImage(canvasB.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 54);
    pdf.save(`carnet-${pet.carnet_number}.pdf`);
  }
  api.logHistory('Descarga de carnet', `${pet.name} (${type.toUpperCase()}, anverso y reverso)`);
  toast('Carnet descargado (anverso y reverso)');
}

function printCard() {
  const pet = currentPet();
  if (!pet) { toast('Selecciona una mascota', 'error'); return; }
  const front = document.getElementById('card-render-front').innerHTML;
  const back = document.getElementById('card-render-back').innerHTML;
  document.getElementById('print-area').innerHTML = `
    <div style="display:flex; flex-direction:column; gap:24px; align-items:center; padding:24px;">
      <div>${front}</div><div>${back}</div>
    </div>`;
  window.print();
  api.logHistory('Impresión de carnet', `${pet.name} (${pet.carnet_number}, anverso y reverso)`);
}
