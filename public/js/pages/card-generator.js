import { api } from '../api.js';
import { iconDownload, iconPrinter } from '../icons.js';
import { escapeHtml, speciesLabel, placeholderPhoto, publicUrl, toast } from '../utils.js';

let state = null;
let medicalDetails = {};
let pawTemp = '';
let padBound = false;
let pawBound = false;

export function initCard(s) { state = s; }

export function viewCarnet() {
  const pets = state.getPets();
  const selectedId = state.cardPetId || pets[0]?.id || '';
  state.cardPetId = selectedId;
  return `
    <div class="page-head"><div><h1>Credencial de identificación</h1><p>Documento de identidad físico de la mascota.</p></div></div>
    <div class="carnet-stage fam-id-stage">
      <div class="carnet-preview-col">
        <div class="card-faces">
          <div class="face-label">Anverso</div><div id="card-render-front"></div>
          <div class="face-label">Reverso</div><div id="card-render-back"></div>
        </div>
      </div>
      <div class="carnet-options-col">
        <div class="panel"><h3>Mascota</h3>
          <select id="carnet-pet-select" class="chip" style="width:100%;cursor:pointer;">
            ${pets.length ? pets.map(p => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${escapeHtml(p.name)} — ${escapeHtml(p.carnet_number)}</option>`).join('') : '<option>No hay mascotas registradas</option>'}
          </select>
        </div>
        <div class="panel"><h3>Firma del propietario</h3>
          <p class="faint" style="margin:0 0 10px;font-size:12px;">Dibuja con mouse o con el dedo.</p>
          <canvas id="signature-pad" class="signature-pad" width="560" height="180" aria-label="Área para dibujar la firma"></canvas>
          <div class="flex gap-2" style="margin-top:10px;"><button class="btn btn-outline btn-sm" id="btn-clear-signature">Limpiar</button><button class="btn btn-primary btn-sm" id="btn-save-signature">Guardar firma</button></div>
        </div>
        <div class="panel"><h3>Impronta de patita</h3>
          <p class="faint" style="margin:0 0 10px;font-size:12px;">Sube una foto de la patita; solo se aceptan archivos PNG.</p>
          <div class="paw-drop" id="paw-drop"><input type="file" id="paw-photo-input" accept="image/png,.png" class="hidden"></div>
          <div class="flex gap-2" style="margin-top:10px;"><button class="btn btn-outline btn-sm" id="btn-clear-paw">Limpiar</button><button class="btn btn-primary btn-sm" id="btn-save-paw">Guardar patita</button></div>
        </div>
        <div class="panel"><div class="flex gap-2" style="flex-direction:column;">
          <button class="btn btn-primary" id="btn-download-png">${iconDownload} Descargar PNG</button>
          <button class="btn btn-outline" id="btn-download-pdf">${iconDownload} Descargar PDF</button>
          <button class="btn btn-outline" id="btn-print-card">${iconPrinter} Imprimir</button>
        </div></div>
      </div>
    </div><div id="print-area" class="hidden"></div>`;
}

function currentPet() {
  const pet = state.getPets().find(p => p.id === state.cardPetId);
  return pet ? { ...pet, ...medicalDetails, id: pet.id } : null;
}

function formatDate(value) {
  if (!value) return '—';
  const parts = String(value).slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(value);
}

function expiryDate(pet) {
  const d = new Date((pet.registration_date || new Date().toISOString().slice(0, 10)) + 'T12:00');
  d.setFullYear(d.getFullYear() + 5);
  return formatDate(d.toISOString().slice(0, 10));
}

function mrzLines(pet) {
  const clean = value => String(value || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, '<');
  const pad = (value, size) => clean(value).padEnd(size, '<').slice(0, size);
  const birth = String(pet.birth_date || '').replaceAll('-', '').slice(2) || '000000';
  return `${pad(`PETBO${pet.carnet_number}`, 19)}<<${pad(pet.carnet_number, 9)}\n${birth}<${pet.sex === 'Hembra' ? 'F' : 'M'}${pad('BOL', 3)}<<<<<<<<<<<<<<<<\n${pad(`${pet.name}<<${pet.breed}`, 30)}`;
}

function logoSvg() { return `FAM<svg viewBox="0 0 40 52" aria-hidden="true"><path d="M30.5 3.5 V29.5 a9.5 9.5 0 0 1 -19 0 V25"/><path class="t" d="M11 3.5 H30.5"/></svg>VET`; }
function pawSvg() { return `<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="16" rx="5.2" ry="4.4"/><circle cx="5.5" cy="10.5" r="2.2"/><circle cx="9.5" cy="6" r="2.2"/><circle cx="14.5" cy="6" r="2.2"/><circle cx="18.5" cy="10.5" r="2.2"/></svg>`; }
function fingerprintSvg() { return `<svg viewBox="0 0 100 124" aria-hidden="true"><g fill="none" stroke="#1f3566" stroke-width="1.5" opacity=".85"><ellipse cx="50" cy="84" rx="31" ry="28"/><ellipse cx="50" cy="84" rx="27" ry="24"/><ellipse cx="50" cy="84" rx="23" ry="20"/><ellipse cx="50" cy="84" rx="19" ry="16"/><ellipse cx="16" cy="54" rx="10" ry="15" transform="rotate(-28 16 54)"/><ellipse cx="37" cy="28" rx="10" ry="15" transform="rotate(-8 37 28)"/><ellipse cx="63" cy="28" rx="10" ry="15" transform="rotate(8 63 28)"/><ellipse cx="84" cy="54" rx="10" ry="15" transform="rotate(28 84 54)"/></g></svg>`; }

// La impronta acepta una foto PNG de la patita; si no hay, muestra el dibujo por defecto.
function pawPhotoHtml(pet) {
  if (String(pet?.paw_photo || pawTemp).startsWith('data:image')) return `<img src="${escapeHtmlAttr(pet?.paw_photo || pawTemp)}" alt="Impronta de patita">`;
  return fingerprintSvg();
}

function escapeHtmlAttr(s) { return String(s || '').replace(/"/g, '&quot;'); }

function signatureHtml(signature) {
  if (String(signature || '').startsWith('data:image')) return `<img src="${signature}" alt="Firma del propietario">`;
  return `<span>${escapeHtml(signature || '—')}</span>`;
}

// Bloque de microchip en la parte libre derecha del carnet:
// con chip → check arriba y número abajo; sin chip → texto alineado a la derecha.
function chipBlock(pet) {
  if (pet.has_chip) {
    return `<div class="fam-id-chip ok"><label>MICROCHIP</label><span class="check">✓</span><b>${escapeHtml(pet.chip || 'Sin número')}</b></div>`;
  }
  return `<div class="fam-id-chip none"><label>MICROCHIP</label><span class="val">— Sin chip</span></div>`;
}

function frontHtml(pet) {
  if (!pet) return '<div class="fam-id-card"><div class="empty-state"><b>Selecciona una mascota</b></div></div>';
  return `<div class="fam-id-card fam-id-front" id="the-id-card-front">
    <div class="fam-id-guil"></div><div class="fam-id-burst"></div><div class="fam-id-vcode">${escapeHtml(pet.carnet_number || pet.id)}</div>
    <div class="fam-id-head"><div><div class="fam-id-flag"><i></i><i></i><i></i></div><div class="fam-id-logo">${logoSvg()}</div><div class="fam-id-sub">REGISTRO VETERINARIO DE MASCOTAS · BOLIVIA</div></div><div class="fam-id-title">CARNET DE<br>IDENTIDAD<small>DE MASCOTA</small></div></div>
    <div class="fam-id-photo"><img src="${pet.photo || placeholderPhoto()}" alt="Foto de ${escapeHtml(pet.name)}"></div>
    <div class="fam-id-number">Nº ${escapeHtml(pet.carnet_number || '—')}<small>${escapeHtml(pet.ci_number || 'BOL-CAR-—')}</small></div>
    <div class="fam-id-fields fam-id-front-fields">
      ${field('Especie', speciesLabel(pet.species, pet.species_detail))}${field('Sexo', pet.sex)}${field('Peso', pet.weight ? `${pet.weight} kg` : '—')}
      ${field('Nombre', pet.name, 'wide name')}${field('Raza', pet.breed, 'wide name')}${field('Fecha de nacimiento', formatDate(pet.birth_date), 'wide')}
      ${field('Fecha de emisión', formatDate(pet.registration_date), 'double')}${field('Fecha de expiración', expiryDate(pet))}
    </div>
    ${chipBlock(pet)}
    <div class="fam-id-signature">${signatureHtml(pet.signature)}<label>FIRMA DEL PROPIETARIO</label></div>
  </div>`;
}

function field(label, value, classes = '') { return `<div class="fam-id-field ${classes}"><label>${label}</label><span>${escapeHtml(value || '—')}</span></div>`; }

function backHtml(pet) {
  if (!pet) return '<div class="fam-id-card"></div>';
  const vaccination = pet.medical_vaccinated === 'Sí' || pet.vaccines_list ? 'Al día' : 'Sin registro';
  return `<div class="fam-id-card fam-id-back" id="the-id-card-back">
    <div class="fam-id-guil"></div><div class="fam-id-qr" id="card-qr"></div>
    <div class="fam-id-vet">FAMUVET<label>REGISTRO VETERINARIO</label></div>
    <div class="fam-id-fields fam-id-back-fields">
      ${field('Ciudad de registro', pet.owner_city || 'Bolivia', 'wide')}${field('Domicilio', [pet.owner_address, pet.owner_city].filter(Boolean).join(', '), 'wide')}
      ${field('Propietario', pet.owner_name, 'wide name')}${field('Teléfono', pet.owner_phone)}${field('Esterilizado', pet.sterilized ? 'Sí' : 'No')}
      ${field('Tipo de sangre', pet.blood_type)}${field('Vacunación', vaccination)}
    </div>
    <div class="fam-id-fingerprint">${pawPhotoHtml(pet)}<label>IMPRONTA DE PATITA</label></div>
    <div class="fam-id-band">${pawSvg()}<pre>${escapeHtml(mrzLines(pet))}</pre></div>
  </div>`;
}

export async function renderCardPreview() {
  const basePet = state.getPets().find(p => p.id === state.cardPetId);
  if (basePet) {
    try {
      const details = await api.getMedicalDetails(basePet.id);
      const { id: _detailsId, pet_id: _detailsPetId, ...safeDetails } = details;
      medicalDetails = safeDetails;
    } catch (_) { medicalDetails = {}; }
  }
  const pet = currentPet();
  const front = document.getElementById('card-render-front');
  const back = document.getElementById('card-render-back');
  if (!front || !back) return;
  front.innerHTML = frontHtml(pet);
  back.innerHTML = backHtml(pet);
  const qrHolder = document.getElementById('card-qr');
  if (qrHolder && pet) new QRCode(qrHolder, { text: publicUrl(pet.id), width: 160, height: 160 });
  pawTemp = pet?.paw_photo || '';
  renderPawDrop();
  initSignaturePad(pet);
}

export function bindCarnetEvents() {
  document.getElementById('carnet-pet-select')?.addEventListener('change', event => {
    state.cardPetId = event.target.value;
    medicalDetails = {};
    renderCardPreview();
  });
  document.getElementById('btn-download-png')?.addEventListener('click', () => downloadCard('png'));
  document.getElementById('btn-download-pdf')?.addEventListener('click', () => downloadCard('pdf'));
  document.getElementById('btn-print-card')?.addEventListener('click', printCard);
  bindPawUploader();
}

/* ---------- Impronta de patita (solo PNG) ---------- */

function renderPawDrop() {
  const drop = document.getElementById('paw-drop'); if (!drop) return;
  const input = drop.querySelector('#paw-photo-input');
  drop.innerHTML = pawTemp
    ? `<img src="${escapeHtmlAttr(pawTemp)}" alt="Impronta de patita">`
    : `<div style="padding:16px 0;" class="muted">Haz clic para subir la foto de la patita (PNG)</div>`;
  if (input) drop.appendChild(input);
}

function bindPawUploader() {
  const drop = document.getElementById('paw-drop');
  const input = document.getElementById('paw-photo-input');
  if (!drop || !input || pawBound) return;
  pawBound = true;
  drop.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const file = input.files[0];
    input.value = '';
    const isPng = file && (file.type === 'image/png' || /\.png$/i.test(file.name));
    if (!isPng) { toast('Solo se aceptan archivos PNG (.png)', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => { pawTemp = reader.result; renderPawDrop(); };
    reader.readAsDataURL(file);
  });
  document.getElementById('btn-clear-paw')?.addEventListener('click', () => { pawTemp = ''; renderPawDrop(); });
  document.getElementById('btn-save-paw')?.addEventListener('click', async () => {
    const pet = currentPet();
    if (!pet) return toast('Selecciona una mascota', 'error');
    try {
      await api.updatePet(pet.id, { ...pet, paw_photo: pawTemp });
      await state.loadPets();
      toast(pawTemp ? 'Patita guardada' : 'Patita eliminada');
      renderCardPreview();
    } catch (error) { toast(error.message, 'error'); }
  });
}

function initSignaturePad(pet) {
  const canvas = document.getElementById('signature-pad');
  if (!canvas) return;
  const context = canvas.getContext('2d');
  context.lineWidth = 4; context.lineCap = 'round'; context.lineJoin = 'round'; context.strokeStyle = '#1f3566';
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (String(pet?.signature || '').startsWith('data:image')) {
    const image = new Image(); image.onload = () => context.drawImage(image, 0, 0, canvas.width, canvas.height); image.src = pet.signature;
  }
  if (padBound) return;
  padBound = true;
  let drawing = false; let previous = null;
  const point = event => { const rect = canvas.getBoundingClientRect(); const source = event.touches?.[0] || event; return { x: (source.clientX - rect.left) * canvas.width / rect.width, y: (source.clientY - rect.top) * canvas.height / rect.height }; };
  const start = event => { drawing = true; previous = point(event); event.preventDefault(); };
  const draw = event => { if (!drawing) return; const next = point(event); context.beginPath(); context.moveTo(previous.x, previous.y); context.lineTo(next.x, next.y); context.stroke(); previous = next; event.preventDefault(); };
  const stop = () => { drawing = false; previous = null; };
  canvas.addEventListener('pointerdown', start); canvas.addEventListener('pointermove', draw); canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointerleave', stop); canvas.addEventListener('pointercancel', stop);
  document.getElementById('btn-clear-signature')?.addEventListener('click', () => context.clearRect(0, 0, canvas.width, canvas.height));
  document.getElementById('btn-save-signature')?.addEventListener('click', async () => {
    try {
      const petToSave = currentPet();
      if (!petToSave) return toast('Selecciona una mascota', 'error');
      const signature = canvas.toDataURL('image/png');
      await api.updatePet(petToSave.id, { ...petToSave, signature });
      await state.loadPets();
      toast('Firma guardada');
      renderCardPreview();
    } catch (error) { toast(error.message, 'error'); }
  });
}

async function downloadCard(type) {
  const pet = currentPet();
  const front = document.getElementById('the-id-card-front'); const back = document.getElementById('the-id-card-back');
  if (!pet || !front || !back) return toast('Selecciona una mascota primero', 'error');
  const [frontCanvas, backCanvas] = await Promise.all([html2canvas(front, { scale: 3 }), html2canvas(back, { scale: 3 })]);
  if (type === 'png') {
    const canvas = document.createElement('canvas'); canvas.width = frontCanvas.width; canvas.height = frontCanvas.height * 2 + 40;
    const context = canvas.getContext('2d'); context.fillStyle = '#e8eef7'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(frontCanvas, 0, 0); context.drawImage(backCanvas, 0, frontCanvas.height + 40);
    const link = document.createElement('a'); link.href = canvas.toDataURL('image/png'); link.download = `credencial-${pet.carnet_number}.png`; link.click();
  } else {
    const { jsPDF } = window.jspdf; const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85.6, 54] });
    pdf.addImage(frontCanvas.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 54); pdf.addPage([85.6, 54], 'landscape'); pdf.addImage(backCanvas.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 54); pdf.save(`credencial-${pet.carnet_number}.pdf`);
  }
  api.logHistory('Descarga de credencial', `${pet.name} (${type.toUpperCase()})`); toast('Credencial descargada');
}

function printCard() {
  const pet = currentPet(); if (!pet) return toast('Selecciona una mascota', 'error');
  document.getElementById('print-area').innerHTML = `<div class="fam-id-print"><div>${document.getElementById('card-render-front').innerHTML}</div><div>${document.getElementById('card-render-back').innerHTML}</div></div>`;
  window.print(); api.logHistory('Impresión de credencial', `${pet.name} (${pet.carnet_number})`);
}
