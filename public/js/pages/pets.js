import { api } from '../api.js';
import { iconEye, iconEdit, iconCard, iconTrash, iconX, iconUpload, iconDownload, iconFileDown } from '../icons.js';
import { escapeHtml, speciesLabel, statusBadge, placeholderPhoto, detailField, publicUrl, uid, toast } from '../utils.js';
import { openModal, closeModal } from '../components/modal.js';

let state = null;

export function initPets(s) {
  state = s;
}

export function viewMascotas(advanced) {
  const list = filteredPets();
  return `
  <div class="page-head">
    <div><h1>${advanced ? 'Búsqueda avanzada' : 'Mascotas'}</h1><p>${list.length} ${list.length === 1 ? 'registro encontrado' : 'registros encontrados'}</p></div>
    <div class="flex gap-2">
      <button class="btn btn-outline btn-sm" data-action="export-json">${iconFileDown} Exportar</button>
      <button class="btn btn-outline btn-sm" data-action="import-json">${iconUpload} Importar</button>
      <input type="file" id="import-file" accept="application/json" class="hidden">
    </div>
  </div>
  <div class="toolbar">
    <div class="chip-filter">
      <span class="chip ${state.filterSpecies === '' ? 'active' : ''}" data-species="">Todas</span>
      <span class="chip ${state.filterSpecies === 'perro' ? 'active' : ''}" data-species="perro">Perros</span>
      <span class="chip ${state.filterSpecies === 'gato' ? 'active' : ''}" data-species="gato">Gatos</span>
      <span class="chip ${state.filterSpecies === 'otro' ? 'active' : ''}" data-species="otro">Otros</span>
    </div>
    <div class="chip-filter">
      <span class="chip ${state.filterStatus === '' ? 'active' : ''}" data-status="">Todos</span>
      <span class="chip ${state.filterStatus === 'Activo' ? 'active' : ''}" data-status="Activo">Activo</span>
      <span class="chip ${state.filterStatus === 'Inactivo' ? 'active' : ''}" data-status="Inactivo">Inactivo</span>
      <span class="chip ${state.filterStatus === 'Perdido' ? 'active' : ''}" data-status="Perdido">Perdido</span>
    </div>
    <select id="filter-sex" class="chip" style="cursor:pointer;">
      <option value="">Sexo (todos)</option>
      <option value="Macho" ${state.filterSex === 'Macho' ? 'selected' : ''}>Macho</option>
      <option value="Hembra" ${state.filterSex === 'Hembra' ? 'selected' : ''}>Hembra</option>
    </select>
  </div>
  <div class="table-wrap">
    ${list.length ? `<table>
      <thead><tr><th></th><th>N° Carnet</th><th>Nombre</th><th>Propietario</th><th>Especie</th><th>Estado</th><th style="text-align:right;">Acciones</th></tr></thead>
      <tbody>
        ${list.map(p => `
          <tr>
            <td><img class="pet-thumb" src="${p.photo || placeholderPhoto()}"></td>
            <td class="faint" style="font-family:var(--font-mono); font-size:12px;">${p.carnet_number}</td>
            <td><b>${escapeHtml(p.name)}</b></td>
            <td>${escapeHtml(p.owner_name)}</td>
            <td>${speciesLabel(p.species)}</td>
            <td>${statusBadge(p.status)}</td>
            <td>
              <div class="row-actions" style="justify-content:flex-end;">
                <button class="btn-icon" title="Ver detalles" data-view="${p.id}">${iconEye}</button>
                <button class="btn-icon" title="Editar" data-edit="${p.id}">${iconEdit}</button>
                <button class="btn-icon" title="Generar carnet" data-carnet="${p.id}">${iconCard}</button>
                ${state.user && state.user.role === 'Administrador' ? `<button class="btn-icon" title="Eliminar" data-del="${p.id}">${iconTrash}</button>` : ''}
              </div>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>` : `<div class="empty-state"><div><b>No hay mascotas registradas</b><p>Crea el primer registro con el botón "Nueva mascota".</p></div></div>`}
  </div>`;
}

function filteredPets() {
  const q = state.search.trim().toLowerCase();
  return state.getPets().filter(p => {
    if (q) {
      const hay = [p.name, p.carnet_number, p.owner_name, p.owner_ci, p.owner_phone, p.id].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (state.filterSpecies && p.species !== state.filterSpecies) return false;
    if (state.filterStatus && p.status !== state.filterStatus) return false;
    if (state.filterSex && p.sex !== state.filterSex) return false;
    return true;
  });
}

export function bindPetsEvents() {
  document.querySelectorAll('[data-species]').forEach(el => el.addEventListener('click', () => { state.filterSpecies = el.dataset.species; import('../app.js').then(m => m.renderApp()); }));
  document.querySelectorAll('[data-status]').forEach(el => el.addEventListener('click', () => { state.filterStatus = el.dataset.status; import('../app.js').then(m => m.renderApp()); }));
  const sexSel = document.getElementById('filter-sex');
  if (sexSel) sexSel.addEventListener('change', () => { state.filterSex = sexSel.value; import('../app.js').then(m => m.renderApp()); });

  document.querySelectorAll('[data-view]').forEach(el => el.addEventListener('click', () => openDetailModal(el.dataset.view)));
  document.querySelectorAll('[data-edit]').forEach(el => el.addEventListener('click', () => openPetModal(el.dataset.edit)));
  document.querySelectorAll('[data-carnet]').forEach(el => el.addEventListener('click', () => { state.cardPetId = el.dataset.carnet; state.view = 'carnet'; import('../app.js').then(m => m.renderApp()); }));
  document.querySelectorAll('[data-del]').forEach(el => el.addEventListener('click', () => deletePet(el.dataset.del)));

  const exp = document.querySelector('[data-action="export-json"]');
  if (exp) exp.addEventListener('click', exportJson);
  const imp = document.querySelector('[data-action="import-json"]');
  if (imp) imp.addEventListener('click', () => document.getElementById('import-file').click());
  const impFile = document.getElementById('import-file');
  if (impFile) impFile.addEventListener('change', importJson);
}

async function deletePet(id) {
  const pet = state.getPets().find(p => p.id === id);
  if (!pet) return;
  if (!confirm(`¿Eliminar el registro de "${pet.name}"? Esta acción no se puede deshacer.`)) return;
  try {
    await api.deletePet(id);
    await state.loadPets();
    api.logHistory('Eliminación', `${pet.name} (${pet.carnet_number})`);
    toast('Mascota eliminada');
    import('../app.js').then(m => m.renderApp());
  } catch (e) { toast(e.message, 'error'); }
}

function exportJson() {
  const blob = new Blob([JSON.stringify({ pets: state.getPets(), exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pet-llama-id-backup.json';
  a.click();
  api.logHistory('Exportación de base de datos', `${state.getPets().length} registros`);
  toast('Base de datos exportada');
}

async function importJson(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      const incoming = Array.isArray(data) ? data : (data.pets || []);
      let added = 0;
      for (const p of incoming) {
        if (p && p.id && !state.getPets().find(x => x.id === p.id)) {
          try {
            await api.createPet(p);
            added++;
          } catch (_) { }
        }
      }
      await state.loadPets();
      api.logHistory('Importación de base de datos', `${added} registros nuevos`);
      toast(`${added} registro(s) importado(s)`);
      import('../app.js').then(m => m.renderApp());
    } catch (err) { toast('Archivo inválido', 'error'); }
  };
  reader.readAsText(file);
}

async function openDetailModal(id) {
  const p = state.getPets().find(x => x.id === id);
  if (!p) return;
  openModal('modal-lg', `
    <div class="modal-head"><h3>Ficha completa · ${escapeHtml(p.name)}</h3><button class="btn-icon" data-close>${iconX}</button></div>
    <div class="modal-body">
      <div class="flex gap-3" style="align-items:flex-start; flex-wrap:wrap;">
        <img src="${p.photo || placeholderPhoto()}" style="width:150px;height:150px;border-radius:12px;object-fit:cover;border:1px solid var(--border);">
        <div style="flex:1; min-width:240px;">
          <div class="flex items-center gap-2">${statusBadge(p.status)} <span class="faint" style="font-family:var(--font-mono);">${p.carnet_number}</span></div>
          <h2 style="margin-top:8px;">${escapeHtml(p.name)}</h2>
          <p class="muted">${speciesLabel(p.species)} · ${escapeHtml(p.breed || '—')} · ${p.sex} · ${formatAge(p)}</p>
        </div>
      </div>
      <div class="tabs" style="margin-top:20px;">
        <div class="tab-btn active" data-dtab="a">Datos del animal</div>
        <div class="tab-btn" data-dtab="o">Propietario</div>
        <div class="tab-btn" data-dtab="m">Médico</div>
        <div class="tab-btn" data-dtab="q">QR</div>
      </div>
      <div id="dtab-a" class="detail-view-grid">
        ${detailField('Color', p.color)}${detailField('Peso', p.weight ? p.weight + ' kg' : '—')}
        ${detailField('Categoría', p.category)}${detailField('Edad', formatAge(p))}
        ${detailField('Fecha de registro', p.registration_date)}${detailField('Firma del propietario', p.signature || '—')}
        ${detailField('Huella', p.fingerprint ? 'Registrada' : 'No registrada')}${detailField('Firma', p.signature || '—')}
      </div>
      <div id="dtab-o" class="detail-view-grid hidden">
        ${detailField('Nombre completo', p.owner_name)}${detailField('CI', p.owner_ci)}
        ${detailField('Teléfono', p.owner_phone)}${detailField('Correo', p.owner_email)}
        ${detailField('Ciudad', p.owner_city)}${detailField('Dirección', p.owner_address)}
      </div>
      <div id="dtab-m" class="detail-view-grid hidden">
        ${detailField('Vacunado', p.medical_vaccinated)}${detailField('Vacunas', p.medical_vaccines)}
        ${detailField('Veterinaria', p.medical_vet)}${detailField('Enfermedades', p.medical_diseases || 'Ninguna')}
        ${detailField('Alergias', p.medical_allergies || 'Ninguna')}${detailField('Observaciones', p.medical_observations || '—')}
      </div>
      <div id="dtab-q" class="hidden" style="text-align:center; padding:20px 0;">
        <div id="detail-qr" style="display:inline-block; padding:10px; background:#fff; border-radius:10px;"></div>
        <p class="faint" style="margin-top:10px; word-break:break-all;">${publicUrl(p.id)}</p>
        <div class="flex gap-2" style="justify-content:center; margin-top:12px;">
          <button class="btn btn-primary btn-sm" id="btn-download-qr">${iconDownload} Descargar QR</button>
          <a href="${publicUrl(p.id)}" target="_blank" class="btn btn-outline btn-sm">Abrir página pública</a>
        </div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn ${p.status === 'Perdido' ? 'btn-outline' : 'btn-danger'}" data-toggle-lost="${p.id}">${p.status === 'Perdido' ? 'Marcar como encontrada' : 'Reportar como perdida'}</button>
      <button class="btn btn-primary" data-editfrom="${p.id}">Editar</button>
    </div>
  `);
  document.querySelectorAll('[data-dtab]').forEach(el => el.addEventListener('click', () => {
    document.querySelectorAll('[data-dtab]').forEach(x => x.classList.remove('active'));
    el.classList.add('active');
    ['a', 'o', 'm', 'q'].forEach(k => document.getElementById('dtab-' + k).classList.add('hidden'));
    document.getElementById('dtab-' + el.dataset.dtab).classList.remove('hidden');
    if (el.dataset.dtab === 'q') {
      document.getElementById('detail-qr').innerHTML = '';
      new QRCode(document.getElementById('detail-qr'), { text: publicUrl(p.id), width: 200, height: 200 });
      const dlBtn = document.getElementById('btn-download-qr');
      if (dlBtn) {
        dlBtn.addEventListener('click', () => {
          const qrContainer = document.getElementById('detail-qr');
          const canvas = qrContainer.querySelector('canvas');
          const img = qrContainer.querySelector('img');
          const src = canvas ? canvas.toDataURL('image/png') : (img ? img.src : null);
          if (!src) return;
          const a = document.createElement('a');
          a.href = src;
          a.download = `QR-${p.carnet_number}.png`;
          a.click();
        });
      }
    }
  }));
  document.querySelector('[data-editfrom]').addEventListener('click', () => { closeModal(); openPetModal(p.id); });
  document.querySelector('[data-toggle-lost]').addEventListener('click', async () => {
    const newStatus = p.status === 'Perdido' ? 'Activo' : 'Perdido';
    try {
      await api.updatePet(p.id, { ...p, status: newStatus });
      await state.loadPets();
      api.logHistory(newStatus === 'Perdido' ? 'Reporte de mascota perdida' : 'Mascota marcada como encontrada', p.name);
      toast(newStatus === 'Perdido' ? 'Marcada como perdida' : 'Marcada como activa');
      closeModal();
      import('../app.js').then(m => m.renderApp());
    } catch (e) { toast(e.message, 'error'); }
  });
}

function formatAge(p) {
  const parts = [];
  if (p.age_years) parts.push(`${p.age_years} año${p.age_years !== '1' ? 's' : ''}`);
  if (p.age_months) parts.push(`${p.age_months} mes${p.age_months !== '1' ? 'es' : ''}`);
  if (parts.length) return parts.join(' ');
  if (p.birth_date) return calcAgeF(p.birth_date);
  return '—';
}

function calcAgeF(dob) {
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

function blankPet() {
  return {
    id: uid(), name: '', carnet_number: '', species: 'perro', breed: '', sex: 'Macho', birth_date: '', color: '', weight: '',
    category: 'General', status: 'Activo', photo: '', fingerprint: '', offspring: '', registration_date: new Date().toISOString().slice(0, 10),
    owner_name: '', owner_ci: '', owner_address: '', owner_city: '', owner_phone: '', owner_email: '',
    distinctive_marks: '',
    medical_vaccinated: 'No', medical_vaccines: '', medical_vet: '', medical_observations: '', medical_diseases: '', medical_allergies: '',
    signature: '', age_years: '', age_months: '', age_mode: 'birth_date',
    vaccines_list: '', deworming_history: '', medical_conditions: '', allergies: '', surgeries: '', medications: '',
    sterilized: 0, microchip: '', blood_type: ''
  };
}

/* ============================================================
   FUNCIONES HELPER PARA LISTAS DINÁMICAS DE DATOS MÉDICOS
   ============================================================ */

function parseJsonArray(str) {
  try { return JSON.parse(str || '[]'); } catch { return []; }
}

function renderVaccineItems(jsonStr) {
  const items = parseJsonArray(jsonStr);
  return items.map(item => renderVaccineItem(item)).join('');
}

function renderVaccineItem(item = {}) {
  return `
  <div class="dynamic-item" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:8px; align-items:end; background:var(--surface-2); border:1px solid var(--border); border-radius:8px; padding:10px; margin-bottom:8px;">
    <input type="text" name="vaccine_name" placeholder="Nombre de la vacuna" value="${escapeHtml(item.name || '')}" style="width:100%; padding:6px 8px; border:1px solid var(--border); border-radius:4px; font-size:12px;">
    <input type="date" name="vaccine_date" placeholder="Fecha" value="${escapeHtml(item.date || '')}" style="width:100%; padding:6px 8px; border:1px solid var(--border); border-radius:4px; font-size:12px;">
    <input type="text" name="vaccine_lot" placeholder="Lote" value="${escapeHtml(item.lot || '')}" style="width:100%; padding:6px 8px; border:1px solid var(--border); border-radius:4px; font-size:12px;">
    <input type="text" name="vaccine_vet" placeholder="Veterinaria" value="${escapeHtml(item.vet || '')}" style="width:100%; padding:6px 8px; border:1px solid var(--border); border-radius:4px; font-size:12px;">
    <select name="vaccine_applied" style="width:100%; padding:6px 8px; border:1px solid var(--border); border-radius:4px; font-size:12px;">
      <option value="1" ${item.applied !== '0' ? 'selected' : ''}>Aplicada</option>
      <option value="0" ${item.applied === '0' ? 'selected' : ''}>Pendiente</option>
    </select>
    <input type="date" name="vaccine_next_due" placeholder="Próxima dosis" value="${escapeHtml(item.next_due || '')}" style="width:100%; padding:6px 8px; border:1px solid var(--border); border-radius:4px; font-size:12px;">
    <button type="button" class="btn-remove-item" style="grid-column:1/-1; width:fit-content; align-self:flex-start; background:var(--red); color:#fff; border:none; border-radius:4px; padding:6px 12px; font-size:11px; cursor:pointer;">Eliminar</button>
  </div>`;
}

function renderDewormingItems(jsonStr) {
  const items = parseJsonArray(jsonStr);
  return items.map(item => renderDewormingItem(item)).join('');
}

function renderDewormingItem(item = {}) {
  return `
  <div class="dynamic-item" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:8px; align-items:end; background:var(--surface-2); border:1px solid var(--border); border-radius:8px; padding:10px; margin-bottom:8px;">
    <input type="text" name="deworming_product" placeholder="Producto" value="${escapeHtml(item.product || '')}" style="width:100%; padding:6px 8px; border:1px solid var(--border); border-radius:4px; font-size:12px;">
    <input type="text" name="deworming_weight" placeholder="Peso (kg)" value="${escapeHtml(item.weight || '')}" style="width:100%; padding:6px 8px; border:1px solid var(--border); border-radius:4px; font-size:12px;">
    <input type="date" name="deworming_date" placeholder="Fecha" value="${escapeHtml(item.date || '')}" style="width:100%; padding:6px 8px; border:1px solid var(--border); border-radius:4px; font-size:12px;">
    <input type="text" name="deworming_vet" placeholder="Veterinaria" value="${escapeHtml(item.vet || '')}" style="width:100%; padding:6px 8px; border:1px solid var(--border); border-radius:4px; font-size:12px;">
    <input type="text" name="deworming_next_due" placeholder="Próxima dosis" value="${escapeHtml(item.next_due || '')}" style="width:100%; padding:6px 8px; border:1px solid var(--border); border-radius:4px; font-size:12px;">
    <button type="button" class="btn-remove-item" style="grid-column:1/-1; width:fit-content; align-self:flex-start; background:var(--red); color:#fff; border:none; border-radius:4px; padding:6px 12px; font-size:11px; cursor:pointer;">Eliminar</button>
  </div>`;
}

function renderConditionItems(jsonStr) {
  const items = parseJsonArray(jsonStr);
  return items.map(item => renderConditionItem(item)).join('');
}

function renderConditionItem(item = {}) {
  return `
  <div class="dynamic-item" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:8px; align-items:end; background:var(--surface-2); border:1px solid var(--border); border-radius:8px; padding:10px; margin-bottom:8px;">
    <input type="text" name="condition_name" placeholder="Enfermedad" value="${escapeHtml(item.name || '')}" style="width:100%; padding:6px 8px; border:1px solid var(--border); border-radius:4px; font-size:12px;">
    <input type="date" name="condition_date" placeholder="Fecha diagnóstico" value="${escapeHtml(item.date || '')}" style="width:100%; padding:6px 8px; border:1px solid var(--border); border-radius:4px; font-size:12px;">
    <input type="text" name="condition_notes" placeholder="Notas" value="${escapeHtml(item.notes || '')}" style="width:100%; padding:6px 8px; border:1px solid var(--border); border-radius:4px; font-size:12px;">
    <button type="button" class="btn-remove-item" style="grid-column:1/-1; width:fit-content; align-self:flex-start; background:var(--red); color:#fff; border:none; border-radius:4px; padding:6px 12px; font-size:11px; cursor:pointer;">Eliminar</button>
  </div>`;
}

function renderSurgeryItems(jsonStr) {
  const items = parseJsonArray(jsonStr);
  return items.map(item => renderSurgeryItem(item)).join('');
}

function renderSurgeryItem(item = {}) {
  return `
  <div class="dynamic-item" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:8px; align-items:end; background:var(--surface-2); border:1px solid var(--border); border-radius:8px; padding:10px; margin-bottom:8px;">
    <input type="text" name="surgery_name" placeholder="Cirugía" value="${escapeHtml(item.name || '')}" style="width:100%; padding:6px 8px; border:1px solid var(--border); border-radius:4px; font-size:12px;">
    <input type="date" name="surgery_date" placeholder="Fecha" value="${escapeHtml(item.date || '')}" style="width:100%; padding:6px 8px; border:1px solid var(--border); border-radius:4px; font-size:12px;">
    <input type="text" name="surgery_vet" placeholder="Veterinaria" value="${escapeHtml(item.vet || '')}" style="width:100%; padding:6px 8px; border:1px solid var(--border); border-radius:4px; font-size:12px;">
    <input type="text" name="surgery_notes" placeholder="Notas" value="${escapeHtml(item.notes || '')}" style="width:100%; padding:6px 8px; border:1px solid var(--border); border-radius:4px; font-size:12px;">
    <button type="button" class="btn-remove-item" style="grid-column:1/-1; width:fit-content; align-self:flex-start; background:var(--red); color:#fff; border:none; border-radius:4px; padding:6px 12px; font-size:11px; cursor:pointer;">Eliminar</button>
  </div>`;
}

function renderMedicationItems(jsonStr) {
  const items = parseJsonArray(jsonStr);
  return items.map(item => renderMedicationItem(item)).join('');
}

function renderMedicationItem(item = {}) {
  return `
  <div class="dynamic-item" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:8px; align-items:end; background:var(--surface-2); border:1px solid var(--border); border-radius:8px; padding:10px; margin-bottom:8px;">
    <input type="text" name="medication_name" placeholder="Medicamento" value="${escapeHtml(item.name || '')}" style="width:100%; padding:6px 8px; border:1px solid var(--border); border-radius:4px; font-size:12px;">
    <input type="text" name="medication_dose" placeholder="Dosis" value="${escapeHtml(item.dose || '')}" style="width:100%; padding:6px 8px; border:1px solid var(--border); border-radius:4px; font-size:12px;">
    <input type="text" name="medication_freq" placeholder="Frecuencia" value="${escapeHtml(item.frequency || '')}" style="width:100%; padding:6px 8px; border:1px solid var(--border); border-radius:4px; font-size:12px;">
    <input type="date" name="medication_start" placeholder="Fecha inicio" value="${escapeHtml(item.start_date || '')}" style="width:100%; padding:6px 8px; border:1px solid var(--border); border-radius:4px; font-size:12px;">
    <button type="button" class="btn-remove-item" style="grid-column:1/-1; width:fit-content; align-self:flex-start; background:var(--red); color:#fff; border:none; border-radius:4px; padding:6px 12px; font-size:11px; cursor:pointer;">Eliminar</button>
  </div>`;
}

function addDynamicItem(listId, html) {
  const container = document.getElementById(listId);
  if (container) {
    container.insertAdjacentHTML('beforeend', html);
  }
}


let photoTemp = '';

export async function openPetModal(id) {
  const isEdit = !!id;
  const pet = isEdit ? { ...state.getPets().find(p => p.id === id) } : blankPet();
  photoTemp = pet.photo || '';

  openModal('modal-lg', `
    <div class="modal-head"><h3>${isEdit ? 'Editar mascota' : 'Registrar nueva mascota'}</h3><button class="btn-icon" data-close>${iconX}</button></div>
    <div class="modal-body">
      <div class="tabs">
        <div class="tab-btn active" data-ftab="animal">Datos del animal</div>
        <div class="tab-btn" data-ftab="foto">Fotografía</div>
        <div class="tab-btn" data-ftab="prop">Propietario</div>
        <div class="tab-btn" data-ftab="med">Datos médicos</div>
      </div>
      <form id="pet-form">
        <div id="ftab-animal" class="form-grid">
          <div class="field full"><label>Nombre de la mascota *</label><input required name="name" value="${escapeHtml(pet.name)}"></div>
          <div class="field"><label>N° de carnet / CI *</label><input required name="carnet_number" value="${escapeHtml(pet.carnet_number || '')}" placeholder="Ej: PLI-BO-2026-00001"></div>
          <div class="field"><label>Especie</label><select name="species"><option value="perro" ${pet.species === 'perro' ? 'selected' : ''}>Perro</option><option value="gato" ${pet.species === 'gato' ? 'selected' : ''}>Gato</option><option value="otro" ${pet.species === 'otro' ? 'selected' : ''}>Otro</option></select></div>
          <div class="field"><label>Raza</label><input name="breed" value="${escapeHtml(pet.breed || '')}"></div>
          <div class="field">
            <label>¿Cómo registrar la edad?</label>
            <select name="age_mode" id="age-mode-select" style="width:100%;">
              <option value="birth_date" ${pet.age_mode !== 'years_months' ? 'selected' : ''}>Fecha de nacimiento</option>
              <option value="years_months" ${pet.age_mode === 'years_months' ? 'selected' : ''}>Años / Meses (directo)</option>
            </select>
          </div>
          <div id="age-birth-date-group" class="field" style="${pet.age_mode === 'years_months' ? 'display:none;' : ''}">
            <label>Fecha de nacimiento</label><input type="date" name="birth_date" value="${pet.birth_date || ''}">
          </div>
          <div id="age-years-months-group" class="field" style="${pet.age_mode === 'years_months' ? '' : 'display:none;'}">
            <div class="flex gap-2">
              <div class="field" style="flex:1;"><label>Años</label><input type="number" min="0" max="30" name="age_years" value="${escapeHtml(pet.age_years || '')}" placeholder="Ej: 3"></div>
              <div class="field" style="flex:1;"><label>Meses</label><input type="number" min="0" max="11" name="age_months" value="${escapeHtml(pet.age_months || '')}" placeholder="Ej: 6"></div>
            </div>
          </div>
          <div class="field"><label>Sexo</label><select name="sex"><option ${pet.sex === 'Macho' ? 'selected' : ''}>Macho</option><option ${pet.sex === 'Hembra' ? 'selected' : ''}>Hembra</option></select></div>
          <div class="field"><label>Color / señas distintivas</label><input name="distinctive_marks" value="${escapeHtml(pet.distinctive_marks || pet.color || '')}"></div>
          <div class="field"><label>Peso (kg)</label><input type="number" step="0.1" name="weight" value="${pet.weight || ''}"></div>
          <div class="field"><label>Categoría</label><input name="category" value="${escapeHtml(pet.category || '')}"></div>
          <div class="field"><label>Estado</label><select name="status"><option ${pet.status === 'Activo' ? 'selected' : ''}>Activo</option><option ${pet.status === 'Inactivo' ? 'selected' : ''}>Inactivo</option><option ${pet.status === 'Perdido' ? 'selected' : ''}>Perdido</option></select></div>
          <div class="field"><label>Firma del propietario (aparece en el carnet)</label><input name="signature" value="${escapeHtml(pet.signature || '')}" placeholder="Ej: Juan Pérez"></div>
          <div class="field"><label>Huella (opcional, texto/código)</label><input name="fingerprint" value="${escapeHtml(pet.fingerprint || '')}"></div>
          <div class="field"><label>Hijos (camada)</label><input name="offspring" value="${escapeHtml(pet.offspring || '')}" placeholder="Ej: 3 cachorros"></div>
          <div class="field"><label>Fecha de registro</label><input type="date" name="registration_date" value="${pet.registration_date || ''}"></div>
        </div>
        <div id="ftab-foto" class="hidden">
          <div class="photo-drop" id="photo-drop">
            ${photoTemp ? `<img id="photo-preview" src="${photoTemp}">` : `<div style="padding:20px 0;">${iconUpload}<p class="muted" style="margin-top:8px;">Haz clic para subir una fotografía</p></div>`}
            <input type="file" id="photo-input" accept="image/*" class="hidden">
          </div>
          <div class="flex gap-2" style="margin-top:12px;">
            <button type="button" class="btn btn-outline btn-sm" id="btn-rotate">Girar 90°</button>
            <button type="button" class="btn btn-outline btn-sm" id="btn-remove-photo">Quitar foto</button>
          </div>
        </div>
        <div id="ftab-prop" class="form-grid hidden">
          <div class="field full"><label>Nombre completo *</label><input required name="owner_name" value="${escapeHtml(pet.owner_name || '')}"></div>
          <div class="field"><label>CI</label><input name="owner_ci" value="${escapeHtml(pet.owner_ci || '')}"></div>
          <div class="field"><label>Teléfono *</label><input required name="owner_phone" value="${escapeHtml(pet.owner_phone || '')}"></div>
          <div class="field"><label>Correo electrónico</label><input type="email" name="owner_email" value="${escapeHtml(pet.owner_email || '')}"></div>
          <div class="field"><label>Ciudad</label><input name="owner_city" value="${escapeHtml(pet.owner_city || '')}"></div>
          <div class="field full"><label>Dirección</label><input name="owner_address" value="${escapeHtml(pet.owner_address || '')}"></div>
        </div>
        <div id="ftab-med" class="form-grid hidden">
          <div class="field"><label>Vacunado</label><select name="medical_vaccinated" id="vaccinated-select"><option ${pet.medical_vaccinated === 'Sí' ? 'selected' : ''}>Sí</option><option ${pet.medical_vaccinated === 'No' ? 'selected' : ''}>No</option></select></div>

          <!-- Vacunas dinámicas -->
          <div class="field full" id="vaccines-section" style="${pet.medical_vaccinated === 'Sí' ? '' : 'display:none;'}">
            <label style="display:block; font-weight:600; margin-bottom:8px; color:var(--text-2); text-transform:uppercase; letter-spacing:.6px; font-size:11px;">Vacunas</label>
            <div id="vaccines-list" class="dynamic-list">
              ${renderVaccineItems(pet.vaccines_detail || '[]')}
            </div>
            <button type="button" class="btn btn-outline btn-sm" id="btn-add-vaccine" style="width:fit-content; align-self:flex-start; margin-top:8px;">+ Agregar vacuna</button>
          </div>

          <!-- Desparasitaciones dinámicas -->
          <div class="field full">
            <label style="display:block; font-weight:600; margin-bottom:8px; color:var(--text-2); text-transform:uppercase; letter-spacing:.6px; font-size:11px;">Desparasitaciones</label>
            <div id="deworming-list" class="dynamic-list">
              ${renderDewormingItems(pet.deworming_detail || '[]')}
            </div>
            <button type="button" class="btn btn-outline btn-sm" id="btn-add-deworming" style="width:fit-content; align-self:flex-start; margin-top:8px;">+ Agregar desparasitación</button>
          </div>

          <!-- Enfermedades crónicas dinámicas -->
          <div class="field full">
            <label style="display:block; font-weight:600; margin-bottom:8px; color:var(--text-2); text-transform:uppercase; letter-spacing:.6px; font-size:11px;">Enfermedades crónicas</label>
            <div id="conditions-list" class="dynamic-list">
              ${renderConditionItems(pet.conditions_detail || '[]')}
            </div>
            <button type="button" class="btn btn-outline btn-sm" id="btn-add-condition" style="width:fit-content; align-self:flex-start; margin-top:8px;">+ Agregar enfermedad</button>
          </div>

          <!-- Cirugías dinámicas -->
          <div class="field full">
            <label style="display:block; font-weight:600; margin-bottom:8px; color:var(--text-2); text-transform:uppercase; letter-spacing:.6px; font-size:11px;">Cirugías previas</label>
            <div id="surgeries-list" class="dynamic-list">
              ${renderSurgeryItems(pet.surgeries_detail || '[]')}
            </div>
            <button type="button" class="btn btn-outline btn-sm" id="btn-add-surgery" style="width:fit-content; align-self:flex-start; margin-top:8px;">+ Agregar cirugía</button>
          </div>

          <!-- Medicamentos dinámicos -->
          <div class="field full">
            <label style="display:block; font-weight:600; margin-bottom:8px; color:var(--text-2); text-transform:uppercase; letter-spacing:.6px; font-size:11px;">Medicamentos actuales</label>
            <div id="medications-list" class="dynamic-list">
              ${renderMedicationItems(pet.medications_detail || '[]')}
            </div>
            <button type="button" class="btn btn-outline btn-sm" id="btn-add-medication" style="width:fit-content; align-self:flex-start; margin-top:8px;">+ Agregar medicamento</button>
          </div>

          <div class="field"><label>Veterinaria</label><input name="medical_vet" value="${escapeHtml(pet.medical_vet || '')}"></div>
          <div class="field"><label>Alergias</label><input name="allergies" value="${escapeHtml(pet.allergies || '')}"></div>
          <div class="field"><label>Esterilizado</label><select name="sterilized"><option ${pet.sterilized ? 'selected' : ''}>No</option><option ${!pet.sterilized ? 'selected' : ''}>Sí</option></select></div>
          <div class="field"><label>Microchip</label><input name="microchip" value="${escapeHtml(pet.microchip || '')}"></div>
          <div class="field"><label>Tipo de sangre</label><input name="blood_type" value="${escapeHtml(pet.blood_type || '')}"></div>
          <div class="field"><label>Observaciones</label><textarea name="medical_observations" rows="3">${escapeHtml(pet.medical_observations || '')}</textarea></div>
        </div>
      </form>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-close>Cancelar</button>
      <button class="btn btn-primary" id="btn-save-pet">${isEdit ? 'Guardar cambios' : 'Registrar mascota'}</button>
    </div>
  `);

  document.querySelectorAll('[data-ftab]').forEach(el => el.addEventListener('click', () => {
    document.querySelectorAll('[data-ftab]').forEach(x => x.classList.remove('active'));
    el.classList.add('active');
    ['animal', 'foto', 'prop', 'med'].forEach(k => document.getElementById('ftab-' + k).classList.add('hidden'));
    document.getElementById('ftab-' + el.dataset.ftab).classList.remove('hidden');
  }));

  // Toggle modo de edad
  const ageModeSelect = document.getElementById('age-mode-select');
  if (ageModeSelect) {
    ageModeSelect.addEventListener('change', (e) => {
      const bdGroup = document.getElementById('age-birth-date-group');
      const ymGroup = document.getElementById('age-years-months-group');
      if (e.target.value === 'years_months') {
        bdGroup.style.display = 'none';
        ymGroup.style.display = '';
      } else {
        bdGroup.style.display = '';
        ymGroup.style.display = 'none';
      }
    });
  }

  // Toggle vacunas según vacunado
  const vaccinatedSelect = document.getElementById('vaccinated-select');
  if (vaccinatedSelect) {
    vaccinatedSelect.addEventListener('change', (e) => {
      const group = document.getElementById('vaccines-section');
      if (group) group.style.display = e.target.value === 'Sí' ? '' : 'none';
    });
  }

  // Event listeners para agregar items dinámicos
  const btnAddVaccine = document.getElementById('btn-add-vaccine');
  if (btnAddVaccine) {
    btnAddVaccine.addEventListener('click', () => addDynamicItem('vaccines-list', renderVaccineItem()));
  }
  const btnAddDeworming = document.getElementById('btn-add-deworming');
  if (btnAddDeworming) {
    btnAddDeworming.addEventListener('click', () => addDynamicItem('deworming-list', renderDewormingItem()));
  }
  const btnAddCondition = document.getElementById('btn-add-condition');
  if (btnAddCondition) {
    btnAddCondition.addEventListener('click', () => addDynamicItem('conditions-list', renderConditionItem()));
  }
  const btnAddSurgery = document.getElementById('btn-add-surgery');
  if (btnAddSurgery) {
    btnAddSurgery.addEventListener('click', () => addDynamicItem('surgeries-list', renderSurgeryItem()));
  }
  const btnAddMedication = document.getElementById('btn-add-medication');
  if (btnAddMedication) {
    btnAddMedication.addEventListener('click', () => addDynamicItem('medications-list', renderMedicationItem()));
  }

  // Delegación para eliminar items dinámicos
  document.getElementById('vaccines-list')?.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('btn-remove-item')) e.target.closest('.dynamic-item').remove();
  });
  document.getElementById('deworming-list')?.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('btn-remove-item')) e.target.closest('.dynamic-item').remove();
  });
  document.getElementById('conditions-list')?.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('btn-remove-item')) e.target.closest('.dynamic-item').remove();
  });
  document.getElementById('surgeries-list')?.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('btn-remove-item')) e.target.closest('.dynamic-item').remove();
  });
  document.getElementById('medications-list')?.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('btn-remove-item')) e.target.closest('.dynamic-item').remove();
  });

  bindPhotoEditor();
  document.getElementById('btn-save-pet').addEventListener('click', () => savePet(pet.id, isEdit));
}

function bindPhotoEditor() {
  const drop = document.getElementById('photo-drop');
  const input = document.getElementById('photo-input');
  if (!drop) return;
  drop.addEventListener('click', (e) => { if (e.target.id !== 'btn-remove-photo') input.click(); });
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { photoTemp = reader.result; refreshPhotoPreview(); };
    reader.readAsDataURL(file);
  });
  const rot = document.getElementById('btn-rotate');
  if (rot) rot.addEventListener('click', (e) => { e.stopPropagation(); rotatePhoto(); });
  const rem = document.getElementById('btn-remove-photo');
  if (rem) rem.addEventListener('click', (e) => { e.stopPropagation(); photoTemp = ''; refreshPhotoPreview(); });
}

function refreshPhotoPreview() {
  const drop = document.getElementById('photo-drop');
  const input = drop.querySelector('#photo-input') || document.getElementById('photo-input');
  drop.innerHTML = photoTemp ? `<img id="photo-preview" src="${photoTemp}">` : `<div style="padding:20px 0;">${iconUpload}<p class="muted" style="margin-top:8px;">Haz clic para subir una fotografía</p></div>`;
  drop.appendChild(input);
}

function rotatePhoto() {
  if (!photoTemp) return;
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.height;
    canvas.height = img.width;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    photoTemp = canvas.toDataURL('image/jpeg', 0.92);
    refreshPhotoPreview();
  };
  img.src = photoTemp;
}

async function savePet(id, isEdit) {
  const form = document.getElementById('pet-form');
  const fd = new FormData(form);
  const get = k => fd.get(k) || '';

  if (!get('name').trim() || !get('owner_name').trim() || !get('owner_phone').trim() || !get('carnet_number').trim()) {
    toast('Completa los campos obligatorios (*), incluyendo el número de carnet', 'error');
    return;
  }

  // Recolectar items dinámicos de cada sección médica
  const collectDynamicList = (containerId, fieldNames) => {
    const container = document.getElementById(containerId);
    if (!container) return [];
    const items = [];
    container.querySelectorAll('.dynamic-item').forEach(el => {
      const item = {};
      fieldNames.forEach(fn => {
        const input = el.querySelector(`input[name="${fn}"], select[name="${fn}"]`);
        if (input) item[fn] = input.value;
      });
      items.push(item);
    });
    return items;
  };

  const vaccines = collectDynamicList('vaccines-list', ['vaccine_name', 'vaccine_date', 'vaccine_lot', 'vaccine_vet', 'vaccine_applied', 'vaccine_next_due']);
  const dewormings = collectDynamicList('deworming-list', ['deworming_product', 'deworming_weight', 'deworming_date', 'deworming_vet', 'deworming_next_due']);
  const conditions = collectDynamicList('conditions-list', ['condition_name', 'condition_date', 'condition_notes']);
  const surgeries = collectDynamicList('surgeries-list', ['surgery_name', 'surgery_date', 'surgery_vet', 'surgery_notes']);
  const medications = collectDynamicList('medications-list', ['medication_name', 'medication_dose', 'medication_freq', 'medication_start']);

  const petData = {
    id,
    carnet_number: get('carnet_number'),
    name: get('name'), species: get('species'), breed: get('breed'), sex: get('sex'),
    birth_date: get('age_mode') === 'birth_date' ? get('birth_date') : '',
    color: get('color') || get('distinctive_marks'), weight: get('weight'),
    category: get('category') || 'General', status: get('status'),
    distinctive_marks: get('distinctive_marks'),
    fingerprint: get('fingerprint'), offspring: get('offspring'), registration_date: get('registration_date'),
    photo: photoTemp,
    owner_name: get('owner_name'), owner_ci: get('owner_ci'), owner_address: get('owner_address'),
    owner_city: get('owner_city'), owner_phone: get('owner_phone'), owner_email: get('owner_email'),
    medical_vaccinated: get('medical_vaccinated'), medical_vet: get('medical_vet'),
    medical_observations: get('medical_observations'),
    medical_diseases: get('medical_conditions'), medical_allergies: get('allergies'),
    signature: get('signature'),
    age_years: get('age_mode') === 'years_months' ? get('age_years') : '',
    age_months: get('age_mode') === 'years_months' ? get('age_months') : '',
    age_mode: get('age_mode'),
    vaccines_list: vaccines.map(v => v.vaccine_name).filter(Boolean).join(', '),
    deworming_history: dewormings.map(d => d.deworming_product).filter(Boolean).join(', '),
    medical_conditions: conditions.map(c => c.condition_name).filter(Boolean).join(', '),
    surgeries: surgeries.map(s => s.surgery_name).filter(Boolean).join(', '),
    medications: medications.map(m => m.medication_name).filter(Boolean).join(', '),
    sterilized: get('sterilized') === '1' ? 1 : 0, microchip: get('microchip'), blood_type: get('blood_type')
  };

  try {
    let createdId = id;
    if (isEdit) {
      await api.updatePet(id, petData);
    } else {
      const res = await api.createPet(petData);
      createdId = res.id;
    }
    await state.loadPets();
    api.logHistory(isEdit ? 'Edición' : 'Creación', `${petData.name} (${petData.carnet_number})`);

    // Guardar detalles médicos extendidos con listas dinámicas como JSON
    const medicalDetails = {
      vaccines_list: petData.vaccines_list,
      deworming_history: petData.deworming_history,
      medical_conditions: petData.medical_conditions,
      allergies: petData.allergies_ext,
      surgeries: petData.surgeries,
      medications: petData.medications,
      sterilized: petData.sterilized,
      microchip: petData.microchip,
      blood_type: petData.blood_type,
      vaccines_detail: vaccines,
      deworming_detail: dewormings,
      conditions_detail: conditions,
      surgeries_detail: surgeries,
      medications_detail: medications
    };
    try {
      await api.updateMedicalDetails(createdId, medicalDetails);
    } catch (_) { /* no bloquear si falla */ }

    if (!isEdit) {
      const newPet = state.getPets().find(x => x.id === createdId);
      if (newPet) {
        showPetQrModal(newPet);
      } else {
        toast('Mascota registrada correctamente');
        closeModal();
      }
    } else {
      toast('Cambios guardados');
      closeModal();
    }
    state.cardPetId = createdId;
    state.view = isEdit ? state.view : 'mascotas';
    import('../app.js').then(m => m.renderApp());
  } catch (e) { toast(e.message, 'error'); }
}

function showPetQrModal(pet) {
  const url = publicUrl(pet.id);
  openModal('modal-md', `
    <div class="modal-head"><h3>QR generado · ${escapeHtml(pet.name)}</h3><button class="btn-icon" data-close>${iconX}</button></div>
    <div class="modal-body" style="text-align:center;">
      <p class="muted" style="margin-bottom:16px;">Mascota registrada correctamente. Escanea este QR para ver los datos.</p>
      <div id="created-qr" style="display:inline-block; padding:14px; background:#fff; border-radius:12px; border:1px solid var(--border);"></div>
      <p class="faint" style="margin-top:10px; font-size:12px; word-break:break-all;">${url}</p>
      <div class="flex gap-2" style="justify-content:center; margin-top:16px;">
        <button class="btn btn-primary btn-sm" id="btn-dl-created-qr">${iconDownload} Descargar QR</button>
        <a href="${url}" target="_blank" class="btn btn-outline btn-sm">Ver página</a>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-close>Cerrar</button>
    </div>
  `);
  new QRCode(document.getElementById('created-qr'), { text: url, width: 200, height: 200 });
  document.getElementById('btn-dl-created-qr').addEventListener('click', () => {
    const c = document.getElementById('created-qr');
    const canvas = c.querySelector('canvas');
    const img = c.querySelector('img');
    const src = canvas ? canvas.toDataURL('image/png') : (img ? img.src : null);
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = `QR-${pet.carnet_number}.png`;
    a.click();
  });
}
