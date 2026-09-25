import { api } from '../api.js';
import { iconPaw, iconEye, iconEdit, iconCard, iconTrash, iconX, iconUpload } from '../icons.js';
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
    <div><h1>${advanced ? 'Búsqueda avanzada' : 'Gestión de mascotas'}</h1><p>${list.length} registro(s) encontrado(s)</p></div>
    <div class="flex gap-2">
      <button class="btn btn-outline btn-sm" data-action="export-json">⬇ Exportar base de datos</button>
      <button class="btn btn-outline btn-sm" data-action="import-json">⬆ Importar</button>
      <input type="file" id="import-file" accept="application/json" class="hidden">
    </div>
  </div>
  <div class="toolbar">
    <div class="chip-filter">
      <span class="chip ${state.filterSpecies === '' ? 'active' : ''}" data-species="">Todas las especies</span>
      <span class="chip ${state.filterSpecies === 'perro' ? 'active' : ''}" data-species="perro">🐕 Perros</span>
      <span class="chip ${state.filterSpecies === 'gato' ? 'active' : ''}" data-species="gato">🐈 Gatos</span>
      <span class="chip ${state.filterSpecies === 'otro' ? 'active' : ''}" data-species="otro">🐾 Otros</span>
    </div>
    <div class="chip-filter">
      <span class="chip ${state.filterStatus === '' ? 'active' : ''}" data-status="">Todos los estados</span>
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
    </table>` : `<div class="empty-state">${iconPaw}<div><b>No hay mascotas registradas</b><p>Crea el primer registro con el botón "Nueva mascota".</p></div></div>`}
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
        <img src="${p.photo || placeholderPhoto()}" style="width:150px;height:150px;border-radius:14px;object-fit:cover;border:1px solid var(--border);">
        <div style="flex:1; min-width:240px;">
          <div class="flex items-center gap-2">${statusBadge(p.status)} <span class="faint" style="font-family:var(--font-mono);">${p.carnet_number}</span></div>
          <h2 style="font-family:var(--font-serif); margin-top:8px;">${escapeHtml(p.name)}</h2>
          <p class="muted">${speciesLabel(p.species)} · ${escapeHtml(p.breed || '—')} · ${p.sex} · ${calcAgeF(p.birth_date)}</p>
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
        ${detailField('Categoría', p.category)}${detailField('Fecha de nacimiento', p.birth_date)}
        ${detailField('Fecha de registro', p.registration_date)}${detailField('Huella', p.fingerprint ? 'Registrada' : 'No registrada')}
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
          <button class="btn btn-primary btn-sm" id="btn-download-qr">⬇ Descargar QR</button>
          <a href="${publicUrl(p.id)}" target="_blank" class="btn btn-outline btn-sm">Abrir página pública ↗</a>
        </div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-toggle-lost="${p.id}">${p.status === 'Perdido' ? 'Marcar como encontrada' : '🚨 Reportar como perdida'}</button>
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
    id: uid(), name: '', species: 'perro', breed: '', sex: 'Macho', birth_date: '', color: '', weight: '',
    category: 'General', status: 'Activo', photo: '', fingerprint: '', offspring: '', registration_date: new Date().toISOString().slice(0, 10),
    owner_name: '', owner_ci: '', owner_address: '', owner_city: '', owner_phone: '', owner_email: '',
    medical_vaccinated: 'No', medical_vaccines: '', medical_vet: '', medical_observations: '', medical_diseases: '', medical_allergies: ''
  };
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
          <div class="field"><label>N° de carnet</label><input name="carnet_number" value="${pet.carnet_number || ''}" readonly style="opacity:.7;"></div>
          <div class="field"><label>Especie</label><select name="species"><option value="perro" ${pet.species === 'perro' ? 'selected' : ''}>Perro</option><option value="gato" ${pet.species === 'gato' ? 'selected' : ''}>Gato</option><option value="otro" ${pet.species === 'otro' ? 'selected' : ''}>Otro</option></select></div>
          <div class="field"><label>Raza</label><input name="breed" value="${escapeHtml(pet.breed || '')}"></div>
          <div class="field"><label>Sexo</label><select name="sex"><option ${pet.sex === 'Macho' ? 'selected' : ''}>Macho</option><option ${pet.sex === 'Hembra' ? 'selected' : ''}>Hembra</option></select></div>
          <div class="field"><label>Fecha de nacimiento</label><input type="date" name="birth_date" value="${pet.birth_date || ''}"></div>
          <div class="field"><label>Color</label><input name="color" value="${escapeHtml(pet.color || '')}"></div>
          <div class="field"><label>Peso (kg)</label><input type="number" step="0.1" name="weight" value="${pet.weight || ''}"></div>
          <div class="field"><label>Categoría</label><input name="category" value="${escapeHtml(pet.category || '')}"></div>
          <div class="field"><label>Estado</label><select name="status"><option ${pet.status === 'Activo' ? 'selected' : ''}>Activo</option><option ${pet.status === 'Inactivo' ? 'selected' : ''}>Inactivo</option><option ${pet.status === 'Perdido' ? 'selected' : ''}>Perdido</option></select></div>
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
            <button type="button" class="btn btn-outline btn-sm" id="btn-rotate">↻ Girar 90°</button>
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
          <div class="field"><label>Vacunado</label><select name="medical_vaccinated"><option ${pet.medical_vaccinated === 'Sí' ? 'selected' : ''}>Sí</option><option ${pet.medical_vaccinated === 'No' ? 'selected' : ''}>No</option></select></div>
          <div class="field"><label>Veterinaria</label><input name="medical_vet" value="${escapeHtml(pet.medical_vet || '')}"></div>
          <div class="field full"><label>Vacunas aplicadas</label><input name="medical_vaccines" value="${escapeHtml(pet.medical_vaccines || '')}" placeholder="Ej: Rabia, Parvovirus, Moquillo"></div>
          <div class="field"><label>Enfermedades</label><input name="medical_diseases" value="${escapeHtml(pet.medical_diseases || '')}"></div>
          <div class="field"><label>Alergias</label><input name="medical_allergies" value="${escapeHtml(pet.medical_allergies || '')}"></div>
          <div class="field full"><label>Observaciones</label><textarea name="medical_observations" rows="3">${escapeHtml(pet.medical_observations || '')}</textarea></div>
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

  if (!get('name').trim() || !get('owner_name').trim() || !get('owner_phone').trim()) {
    toast('Completa los campos obligatorios (*)', 'error');
    return;
  }

  const petData = {
    id,
    carnet_number: get('carnet_number'),
    name: get('name'), species: get('species'), breed: get('breed'), sex: get('sex'),
    birth_date: get('birth_date'), color: get('color'), weight: get('weight'),
    category: get('category') || 'General', status: get('status'),
    fingerprint: get('fingerprint'), offspring: get('offspring'), registration_date: get('registration_date'),
    photo: photoTemp,
    owner_name: get('owner_name'), owner_ci: get('owner_ci'), owner_address: get('owner_address'),
    owner_city: get('owner_city'), owner_phone: get('owner_phone'), owner_email: get('owner_email'),
    medical_vaccinated: get('medical_vaccinated'), medical_vaccines: get('medical_vaccines'),
    medical_vet: get('medical_vet'), medical_observations: get('medical_observations'),
    medical_diseases: get('medical_diseases'), medical_allergies: get('medical_allergies')
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
        <button class="btn btn-primary btn-sm" id="btn-dl-created-qr">⬇ Descargar QR</button>
        <a href="${url}" target="_blank" class="btn btn-outline btn-sm">Ver página ↗</a>
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
