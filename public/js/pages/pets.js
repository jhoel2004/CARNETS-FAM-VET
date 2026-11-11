import { api } from '../api.js';
import { iconEye, iconEdit, iconCard, iconTrash, iconX, iconUpload, iconDownload, iconFileDown } from '../icons.js';
import { escapeHtml, speciesLabel, statusBadge, placeholderPhoto, detailField, publicUrl, uid, toast, calcAge } from '../utils.js';
import { openModal, closeModal } from '../components/modal.js';
import { BOLIVIA_LOCATIONS, DEPARTMENTS, getCities } from '../bolivia-locations.js';
import { renderSearchableSelect, initSearchableSelect } from '../components/searchable-select.js';

const BREEDS_BY_SPECIES = {
  perro: ['Mestizo', 'Labrador', 'Pastor Alemán', 'Golden Retriever', 'Bulldog', 'Poodle', 'Chihuahua', 'Beagle', 'Rottweiler', 'Husky Siberiano', 'Dálmata', 'Boxer', 'Shih Tzu', 'Yorkshire Terrier', 'Pug', 'Schnauzer', 'Cocker Spaniel', 'Border Collie', 'Pitbull', 'Doberman', 'San Bernardo', 'Gran Danés', 'Akita', 'Shar Pei', 'Bichón Frisé', 'Maltés', 'Pomerania', 'Corgi', 'Dachshund', 'Otro'],
  gato: ['Mestizo', 'Siamés', 'Persa', 'Maine Coon', 'Bengalí', 'Ragdoll', 'British Shorthair', 'Sphynx', 'Scottish Fold', 'Angora', 'Exótico', 'Abisinio', 'Birmano', 'Otro']
};
// Predeterminados para el grupo "Otro": son especies específicas, no razas.
const DEFAULT_OTRO_SPECIES = ['Conejo', 'Hámster', 'Cobayo', 'Loro', 'Canario', 'Tortuga', 'Iguana', 'Pez', 'Hurón'];

const COMMON_COLORS = ['Negro', 'Blanco', 'Marrón', 'Dorado', 'Gris', 'Beige', 'Atigrado', 'Manchado', 'Tricolor', 'Otro'];

let state = null;

export function initPets(s) {
  state = s;
}

const rerender = () => import('../app.js').then(m => m.renderApp());

/* ============================================================
   CATÁLOGO: especies específicas (grupo "Otro") y razas por especie
   Predeterminados del código + lo guardado en BD (pet_species / pet_breeds)
   ============================================================ */
function specificSpeciesOptions() {
  const saved = state.getSpecies().map(s => s.name);
  const seen = new Set(); const out = [];
  for (const n of [...DEFAULT_OTRO_SPECIES, ...saved]) {
    const k = String(n).trim().toLowerCase();
    if (!k || k === 'otro' || seen.has(k)) continue;
    seen.add(k); out.push(String(n).trim());
  }
  return out;
}

function breedOptionsFor(speciesKey) {
  const key = String(speciesKey || '').trim().toLowerCase();
  const defaults = (key === 'perro' || key === 'gato') ? (BREEDS_BY_SPECIES[key] || []) : [];
  const saved = state.getBreeds().filter(b => b.species === key).map(b => b.name);
  const seen = new Set(); const out = [];
  for (const n of [...defaults, ...saved]) {
    const k = String(n).trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k); out.push(String(n).trim());
  }
  return out;
}

// Llave de especie para el catálogo de razas: 'perro'/'gato' o la especie específica
function currentSpeciesKey() {
  const group = document.getElementById('species-hidden')?.value || 'perro';
  if (group === 'otro') return (document.getElementById('ss-hidden-spec-detail')?.value || '').trim().toLowerCase();
  return group;
}

// Re-inicializa el desplegable de razas con alta dinámica
function refreshBreeds(speciesKey) {
  initSearchableSelect('breed', breedOptionsFor(speciesKey).map(b => ({ v: b, l: b })), null, {
    addNew: true,
    addNewLabel: '+ Agregar nueva raza',
    onAddNew: (typed) => {
      const key = currentSpeciesKey();
      if (!key) { toast('Elige primero la especie específica (grupo "Otro")', 'error'); return; }
      openInlineAdd('breed', typed, key);
    }
  });
}

// Inicializa el desplegable de especie específica con alta dinámica
function specDetailInit() {
  initSearchableSelect('spec-detail', specificSpeciesOptions().map(n => ({ v: n.toLowerCase(), l: n })), (v) => {
    document.getElementById('ss-hidden-spec-detail').value = v;
    refreshBreeds(v);
  }, {
    addNew: true,
    addNewLabel: '+ Agregar nueva especie',
    onAddNew: (typed) => openInlineAdd('spec-detail', typed)
  });
}

// Formulario inline de alta (especie o raza) bajo el desplegable
function openInlineAdd(id, prefill = '', speciesKey = '') {
  const wrap = document.getElementById(`ss-${id}`);
  if (!wrap) return;
  const fieldEl = wrap.parentElement;
  let form = document.getElementById(`ss-add-${id}`);
  if (!form) {
    form = document.createElement('div');
    form.id = `ss-add-${id}`;
    form.style.cssText = 'display:none; gap:6px; margin-top:8px; align-items:center;';
    form.innerHTML = `
      <input type="text" id="ss-add-input-${id}" placeholder="Escribe el nombre" style="flex:1; min-width:140px; height:34px; padding:0 10px; border:1px solid var(--border); border-radius:6px; background:var(--surface); font-size:13px;">
      <button type="button" class="btn btn-primary btn-sm" id="ss-add-save-${id}">Guardar</button>
      <button type="button" class="btn btn-ghost btn-sm" id="ss-add-cancel-${id}">Cancelar</button>`;
    fieldEl.appendChild(form);
  }
  form.style.display = 'flex';
  const input = document.getElementById(`ss-add-input-${id}`);
  input.value = (prefill || '').trim();
  input.focus();
  document.getElementById(`ss-add-cancel-${id}`).onclick = () => { form.style.display = 'none'; };
  document.getElementById(`ss-add-save-${id}`).onclick = async () => {
    const name = input.value.trim();
    if (!name) { toast('Escribe un nombre', 'error'); return; }
    try {
      if (id === 'spec-detail') {
        await api.createSpecies(name);
        await state.loadCatalog();
        specDetailInit();
        const val = name.toLowerCase();
        const inputEl = document.getElementById('ss-input-spec-detail');
        const hiddenEl = document.getElementById('ss-hidden-spec-detail');
        inputEl.value = val.charAt(0).toUpperCase() + val.slice(1);
        hiddenEl.value = val;
        refreshBreeds(val);
        api.logHistory('Especie agregada', val);
        toast('Especie agregada al catálogo');
      } else {
        const key = (speciesKey || currentSpeciesKey() || '').toLowerCase();
        if (!key) { toast('Elige primero la especie', 'error'); return; }
        await api.createBreed(key, name);
        await state.loadCatalog();
        refreshBreeds(key);
        document.getElementById('ss-input-breed').value = name;
        document.getElementById('ss-hidden-breed').value = name;
        api.logHistory('Raza agregada', `${name} (${key})`);
        toast('Raza agregada al catálogo');
      }
      form.style.display = 'none';
    } catch (e) { toast(e.message, 'error'); }
  };
}

/* ============================================================
   LISTADO
   ============================================================ */
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
    ${state.filterUser ? `<span class="chip active" data-clear-user style="cursor:pointer;" title="Quitar filtro de usuario">👤 Usuario: ${escapeHtml(state.filterUser)} ✕</span>` : ''}
    ${state.filterOwner ? `<span class="chip active" data-clear-owner style="cursor:pointer;" title="Quitar filtro de propietario">🏠 Propietario: ${escapeHtml(state.filterOwner)} ✕</span>` : ''}
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
            <td>${speciesLabel(p.species, p.species_detail)}</td>
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
    if (state.filterUser && p.created_by !== state.filterUser) return false;
    if (state.filterOwner && p.owner_ci !== state.filterOwner && p.owner_name !== state.filterOwner) return false;
    return true;
  });
}

export function bindPetsEvents() {
  document.querySelectorAll('[data-species]').forEach(el => el.addEventListener('click', () => { state.filterSpecies = el.dataset.species; rerender(); }));
  document.querySelectorAll('[data-status]').forEach(el => el.addEventListener('click', () => { state.filterStatus = el.dataset.status; rerender(); }));
  document.querySelectorAll('[data-clear-user]').forEach(el => el.addEventListener('click', () => { state.filterUser = ''; rerender(); }));
  document.querySelectorAll('[data-clear-owner]').forEach(el => el.addEventListener('click', () => { state.filterOwner = ''; rerender(); }));
  const sexSel = document.getElementById('filter-sex');
  if (sexSel) sexSel.addEventListener('change', () => { state.filterSex = sexSel.value; rerender(); });

  document.querySelectorAll('[data-view]').forEach(el => el.addEventListener('click', () => openDetailModal(el.dataset.view)));
  document.querySelectorAll('[data-edit]').forEach(el => el.addEventListener('click', () => openPetModal(el.dataset.edit)));
  document.querySelectorAll('[data-carnet]').forEach(el => el.addEventListener('click', () => { state.cardPetId = el.dataset.carnet; state.view = 'carnet'; rerender(); }));
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
    rerender();
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
      rerender();
    } catch (err) { toast('Archivo inválido', 'error'); }
  };
  reader.readAsText(file);
}

/* ============================================================
   FICHA (DETALLE)
   ============================================================ */
/* Acceso directo a la ficha en una pestaña concreta (dashboard/alertas) */
export function openPetDetail(id, tab) {
  return openDetailModal(id, tab);
}

async function openDetailModal(id, tab) {
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
          <p class="muted">${speciesLabel(p.species, p.species_detail)} · ${escapeHtml(p.breed || '—')} · ${p.sex} · ${formatAge(p)}</p>
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
        ${healthRecordsBlock(p.id)}
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
        dlBtn.onclick = () => {
          const qrContainer = document.getElementById('detail-qr');
          const canvas = qrContainer.querySelector('canvas');
          const img = qrContainer.querySelector('img');
          const src = canvas ? canvas.toDataURL('image/png') : (img ? img.src : null);
          if (!src) return;
          const a = document.createElement('a');
          a.href = src;
          a.download = `QR-${p.carnet_number}.png`;
          a.click();
        };
      }
    }
  }));
  // Abrir la ficha directamente en una pestaña (alertas y accesos rápidos)
  if (tab) {
    const btn = document.querySelector(`[data-dtab="${tab}"]`);
    if (btn) btn.click();
  }
  document.querySelector('[data-editfrom]').addEventListener('click', () => { closeModal(); openPetModal(p.id); });
  document.querySelector('[data-toggle-lost]').addEventListener('click', async () => {
    const newStatus = p.status === 'Perdido' ? 'Activo' : 'Perdido';
    try {
      await api.updatePet(p.id, { ...p, status: newStatus });
      await state.loadPets();
      api.logHistory(newStatus === 'Perdido' ? 'Reporte de mascota perdida' : 'Mascota marcada como encontrada', p.name);
      toast(newStatus === 'Perdido' ? 'Marcada como perdida' : 'Marcada como activa');
      closeModal();
      rerender();
    } catch (e) { toast(e.message, 'error'); }
  });
}

/* Resumen de registros de salud (pet_health_records) dentro de la ficha */
function healthRecordsBlock(petId) {
  const recs = state.getHealthRecords(petId) || [];
  if (!recs.length) {
    return `<div class="dv-field full"><label>Historial de salud</label><span class="dv-val">Sin vacunas ni desparasitaciones registradas</span></div>`;
  }
  const today = new Date().toISOString().slice(0, 10);
  const rows = recs.map(r => {
    const kind = r.type === 'vacuna' ? 'Vacuna' : r.type === 'desparasitacion' ? 'Desparasitación' : 'Nota clínica';
    const status = r.applied ? 'Aplicada' : ((r.next_due && r.next_due < today) ? 'Vencida' : 'Pendiente');
    const dates = [r.record_date && `registro ${r.record_date}`, r.next_due && r.next_due !== r.record_date && (r.applied ? 'próxima ' : 'vence ') + r.next_due].filter(Boolean).join(' · ');
    return `<div style="grid-column:1/-1; display:flex; justify-content:space-between; gap:10px; border-bottom:1px solid var(--border); padding:6px 0; font-size:12.5px;">
      <span><b>${escapeHtml(r.title || '—')}</b> <span class="faint">· ${kind}</span><div class="faint" style="font-size:11px;">${escapeHtml(dates || '')}</div></span>
      <span style="font-weight:600; color:var(--text-2); white-space:nowrap;">${status}</span>
    </div>`;
  }).join('');
  return `<div class="dv-field full"><label>Historial de salud (${recs.length})</label>${rows}</div>`;
}

function formatAge(p) {
  const parts = [];
  if (p.age_years) parts.push(`${p.age_years} año${String(p.age_years) !== '1' ? 's' : ''}`);
  if (p.age_months) parts.push(`${p.age_months} mes${String(p.age_months) !== '1' ? 'es' : ''}`);
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
    category: 'General', status: 'Activo', photo: '', registration_date: new Date().toISOString().slice(0, 10),
    owner_name: '', owner_ci: '', owner_address: '', owner_city: '', owner_phone: '', owner_email: '',
    distinctive_marks: '',
    medical_vaccinated: 'No', medical_vaccines: '', medical_vet: '', medical_observations: '', medical_diseases: '', medical_allergies: '',
    signature: '',
    chip: '', has_chip: 0,
    age_years: '', age_months: '', age_mode: 'birth_date',
    vaccines_list: '', deworming_history: '', medical_conditions: '', allergies: '', surgeries: '', medications: '',
    sterilized: 0, microchip: '', blood_type: ''
  };
}

/* ============================================================
   LISTAS DINÁMICAS DE DATOS MÉDICOS (un solo helper para las 6)
   ============================================================ */
function parseJsonArray(v) {
  if (Array.isArray(v)) return v;
  try { const r = JSON.parse(v || '[]'); return Array.isArray(r) ? r : []; } catch { return []; }
}

// tipo -> [nombre del input de texto, nombre del input de fecha (null = sin fecha), placeholder]
const DYN = {
  vaccine:    ['vaccine_name',    'vaccine_date',    'Nombre de la vacuna'],
  deworming:  ['deworming_name',  'deworming_date',  'Nombre de la desparasitación'],
  condition:  ['condition_name',  'condition_date',  'Enfermedad'],
  surgery:    ['surgery_name',    'surgery_date',    'Cirugía'],
  medication: ['medication_name', 'medication_date', 'Medicamento'],
  allergy:    ['allergy_name',    null,              'Alergia']
};
const DYN_INPUT_STYLE = 'width:100%; padding:6px 8px; border:1px solid var(--border); border-radius:4px; font-size:12px;';

function dynItem(kind, item = {}) {
  const [nameField, dateField, placeholder] = DYN[kind];
  const dateInput = dateField
    ? `<input type="date" name="${dateField}" value="${escapeHtml(item.date || '')}" style="${DYN_INPUT_STYLE}">`
    : '';
  return `
  <div class="dynamic-item" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:8px; align-items:end; background:var(--surface-2); border:1px solid var(--border); border-radius:8px; padding:10px; margin-bottom:8px;">
    <input type="text" name="${nameField}" placeholder="${placeholder}" value="${escapeHtml(item.name || '')}" style="${DYN_INPUT_STYLE}">
    ${dateInput}
    <button type="button" class="btn-remove-item" style="grid-column:1/-1; width:fit-content; align-self:flex-start; background:var(--red); color:#fff; border:none; border-radius:4px; padding:6px 12px; font-size:11px; cursor:pointer;">Eliminar</button>
  </div>`;
}

function dynItems(kind, data) {
  return parseJsonArray(data).map(item => dynItem(kind, item)).join('');
}

function addDynamicItem(listId, html) {
  const container = document.getElementById(listId);
  if (container) container.insertAdjacentHTML('beforeend', html);
}

let photoTemp = '';

function colorToHex(color) {
  const map = {
    'Negro': '#1a1a1a', 'Blanco': '#f5f5f5', 'Marrón': '#8B4513', 'Dorado': '#DAA520',
    'Gris': '#808080', 'Beige': '#F5F5DC', 'Atigrado': '#8B6914', 'Manchado': '#696969',
    'Tricolor': '#8B4513', 'Otro': '#cccccc'
  };
  return map[color] || '#cccccc';
}

/* ============================================================
   FORMULARIO CREAR / EDITAR (3 pasos)
   ============================================================ */
export async function openPetModal(id, opts = {}) {
  const isEdit = !!id;
  const pet = isEdit ? { ...state.getPets().find(p => p.id === id) } : blankPet();
  // Los detalles médicos viven en una tabla separada. Cargarlos al editar evita
  // que las vacunas ya guardadas parezcan haber desaparecido.
  if (isEdit) {
    try {
      const medicalDetails = await api.getMedicalDetails(id);
      // "id" en esta respuesta es el identificador del detalle médico (md...),
      // no el de la mascota. Nunca debe reemplazar el id usado al guardar.
      const { id: _medicalDetailId, pet_id: _petId, ...details } = medicalDetails;
      Object.assign(pet, details);
    } catch (_) { /* La ficha básica puede seguir editándose si faltan detalles. */ }
  }
  photoTemp = pet.photo || '';

  openModal('modal-lg', `
    <div class="modal-head"><h3>${isEdit ? 'Editar mascota' : 'Registrar nueva mascota'}</h3><button class="btn-icon" data-close>${iconX}</button></div>
    <div class="modal-body">
      <!-- Indicador de progreso -->
      <div class="form-steps" id="form-steps">
        <div class="form-step active" data-step="animal"><span class="step-num">1</span> Animal</div>
        <div class="form-step-sep"></div>
        <div class="form-step" data-step="prop"><span class="step-num">2</span> Propietario</div>
        <div class="form-step-sep"></div>
        <div class="form-step" data-step="med"><span class="step-num">3</span> Médico</div>
      </div>
      <form id="pet-form">

        <!-- ================= PASO 1: ANIMAL ================= -->
        <div id="ftab-animal" class="form-grid">
          <div class="field full"><label>Nombre de la mascota *</label><input required name="name" value="${escapeHtml(pet.name)}"></div>
          <div class="field">
            <label>N° de carnet / CI ${isEdit ? '*' : ''}</label>
            <input name="carnet_number" id="carnet-input" ${isEdit ? 'required placeholder="Ej: PLI-BO-2026-00001"' : 'readonly placeholder="Se asigna automáticamente…"'} value="${escapeHtml(pet.carnet_number || '')}" style="${isEdit ? '' : 'font-family:var(--font-mono); letter-spacing:.4px;'}">
            ${isEdit ? '' : `<label class="faint" style="display:flex; align-items:center; gap:6px; margin-top:6px; cursor:pointer; font-size:11.5px; text-transform:none; letter-spacing:0;">
              <input type="checkbox" id="custom-carnet-check" style="width:15px; height:15px;"> Personalizar (escribirlo a mano · debe ser único)
            </label>`}
          </div>
          <div class="field"><label>Especie</label>
            <div class="toggle-btn-group" id="species-group">
              <button type="button" class="toggle-btn ${pet.species === 'perro' ? 'active' : ''}" data-species="perro">🐕 Perro</button>
              <button type="button" class="toggle-btn ${pet.species === 'gato' ? 'active' : ''}" data-species="gato">🐈 Gato</button>
              <button type="button" class="toggle-btn ${pet.species === 'otro' ? 'active' : ''}" data-species="otro">🐾 Otro</button>
            </div>
            <input type="hidden" name="species" id="species-hidden" value="${escapeHtml(pet.species || 'perro')}">
          </div>
          <div id="species-detail-field" class="${pet.species === 'otro' ? '' : 'hidden'}">
            ${renderSearchableSelect({ id: 'spec-detail', name: 'species_detail', label: 'Especie específica', options: specificSpeciesOptions(), value: pet.species_detail || '', placeholder: 'Buscar especie...' })}
            <div class="faint" style="font-size:11px; margin-top:-8px;">Puedes agregar una especie nueva al final del desplegable.</div>
          </div>
          ${renderSearchableSelect({ id: 'breed', name: 'breed', label: 'Raza', options: breedOptionsFor(pet.species === 'otro' ? (pet.species_detail || '') : (pet.species || 'perro')), value: pet.breed || '', placeholder: 'Buscar raza...' })}
          <div class="field full">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:500;">
              <input type="checkbox" name="has_chip" id="has-chip-check" ${pet.has_chip || pet.microchip ? 'checked' : ''} style="width:16px; height:16px;">
              Sí, tiene microchip implantado
            </label>
          </div>
          <div class="field"><label>Número de chip</label><input name="chip" id="chip-num" value="${escapeHtml(pet.chip || pet.microchip || '')}" ${pet.has_chip || pet.microchip ? '' : 'disabled'} placeholder="Se activa al marcar la casilla"></div>
          <div class="field">
            <label>¿Cómo registrar la edad?</label>
            <select name="age_mode" id="age-mode-select" style="width:100%;">
              <option value="birth_date" ${pet.age_mode !== 'years_months' ? 'selected' : ''}>Fecha de nacimiento</option>
              <option value="years_months" ${pet.age_mode === 'years_months' ? 'selected' : ''}>Años / Meses (directo)</option>
            </select>
          </div>
          <div id="age-birth-date-group" class="field" style="${pet.age_mode === 'years_months' ? 'display:none;' : ''}">
            <label>Fecha de nacimiento</label><input type="date" name="birth_date" id="birth-date-input" value="${pet.birth_date || ''}">
            <div id="age-calc-result" style="font-size:11.5px; color:var(--text-2); margin-top:4px;">${pet.birth_date ? calcAge(pet.birth_date) : 'Selecciona la fecha para calcular la edad'}</div>
          </div>
          <div id="age-years-months-group" class="field" style="${pet.age_mode === 'years_months' ? '' : 'display:none;'}">
            <div class="flex gap-2">
              <div class="field" style="flex:1;"><label>Años</label><input type="number" min="0" max="30" name="age_years" value="${escapeHtml(pet.age_years || '')}" placeholder="Ej: 3"></div>
              <div class="field" style="flex:1;"><label>Meses</label><input type="number" min="0" max="11" name="age_months" value="${escapeHtml(pet.age_months || '')}" placeholder="Ej: 6"></div>
            </div>
          </div>
          <div class="field"><label>Sexo</label>
            <div class="toggle-btn-group" id="sex-group">
              <button type="button" class="toggle-btn ${pet.sex === 'Macho' ? 'active' : ''}" data-sex="Macho">♂ Macho</button>
              <button type="button" class="toggle-btn ${pet.sex === 'Hembra' ? 'active' : ''}" data-sex="Hembra">♀ Hembra</button>
            </div>
            <input type="hidden" name="sex" id="sex-hidden" value="${escapeHtml(pet.sex || 'Macho')}">
          </div>
          <div class="field"><label>Color</label>
            <div class="color-chips" id="color-chips">
              ${COMMON_COLORS.map(c => `<div class="color-chip ${pet.distinctive_marks === c || pet.color === c ? 'active' : ''}" data-color="${escapeHtml(c)}" style="background:${colorToHex(c)};" title="${escapeHtml(c)}"></div>`).join('')}
            </div>
            <input type="hidden" name="color" id="color-hidden" value="${escapeHtml(pet.color || pet.distinctive_marks || '')}">
            <input type="text" name="distinctive_marks" id="distinctive-marks-input" value="${escapeHtml(pet.distinctive_marks || pet.color || '')}" placeholder="Color o señas distintivas" style="margin-top:6px; width:100%; height:36px; padding:0 10px; border:1px solid var(--border); border-radius:6px; background:var(--surface-2); font-size:13px;">
          </div>
          <div class="field"><label>Peso (kg)</label><input type="number" step="0.1" name="weight" value="${pet.weight || ''}"></div>
          <div class="field"><label>Categoría</label><input name="category" value="${escapeHtml(pet.category || '')}"></div>
          <div class="field"><label>Estado</label><select name="status"><option ${pet.status === 'Activo' ? 'selected' : ''}>Activo</option><option ${pet.status === 'Inactivo' ? 'selected' : ''}>Inactivo</option><option ${pet.status === 'Perdido' ? 'selected' : ''}>Perdido</option></select></div>
          <div class="field" id="offspring-group" style="display:${pet.sex === 'Hembra' ? '' : 'none'};"><label>Hijos (camada)</label><input name="offspring" value="${escapeHtml(pet.offspring || '')}" placeholder="Ej: 3 cachorros"></div>
          <div class="field"><label>Fecha de registro</label><input type="date" name="registration_date" value="${pet.registration_date || ''}"></div>
          <!-- Foto de la mascota -->
          <div class="field full" style="margin-top:16px;">
            <label style="display:block; font-weight:600; margin-bottom:8px; color:var(--text-2); text-transform:uppercase; letter-spacing:.6px; font-size:11px;">Fotografía de la mascota</label>
            <div class="photo-drop" id="photo-drop">
              ${photoTemp ? `<img id="photo-preview" src="${photoTemp}">` : `<div style="padding:20px 0;">${iconUpload}<p class="muted" style="margin-top:8px;">Haz clic para subir una fotografía</p></div>`}
              <input type="file" id="photo-input" accept="image/*" class="hidden">
            </div>
            <div class="flex gap-2" style="margin-top:12px;">
              <button type="button" class="btn btn-outline btn-sm" id="btn-rotate">Girar 90°</button>
              <button type="button" class="btn btn-outline btn-sm" id="btn-remove-photo">Quitar foto</button>
            </div>
          </div>
        </div>

        <!-- ================= PASO 2: PROPIETARIO ================= -->
        <div id="ftab-prop" class="form-grid hidden">
          <!-- Búsqueda de propietario existente -->
          <div class="field full">
            <div class="owner-search-box">
              <label style="display:block; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.6px; color:var(--text-2); margin-bottom:6px;">Buscar propietario existente</label>
              <div class="search-row">
                <input type="text" id="owner-search-ci" placeholder="CI del propietario" style="height:36px; padding:0 10px; border:1px solid var(--border); border-radius:6px; background:var(--surface); font-size:13px;">
                <input type="text" id="owner-search-phone" placeholder="Teléfono" style="height:36px; padding:0 10px; border:1px solid var(--border); border-radius:6px; background:var(--surface); font-size:13px;">
                <button type="button" class="btn btn-outline btn-sm" id="btn-search-owner">Buscar</button>
              </div>
              <div id="owner-search-result" style="display:none;"></div>
            </div>
          </div>
          <div class="field full"><label>Nombre completo *</label><input required name="owner_name" id="owner-name-input" value="${escapeHtml(pet.owner_name || '')}" placeholder="Nombre y apellidos"></div>
          <div class="field"><label>CI</label><input name="owner_ci" id="owner-ci-input" value="${escapeHtml(pet.owner_ci || '')}" placeholder="Cédula de identidad" style="font-size:15px;"></div>
          <div class="field"><label>Teléfono *</label><input required name="owner_phone" id="owner-phone-input" value="${escapeHtml(pet.owner_phone || '')}" placeholder="Ej: 70012345"></div>
          <div class="field"><label>Correo electrónico</label><input type="email" name="owner_email" id="owner-email-input" value="${escapeHtml(pet.owner_email || '')}" placeholder="correo@ejemplo.com"></div>
          <div class="field"><label>Departamento</label>
            ${renderSearchableSelect({ id: 'dept', name: 'owner_department', label: '', options: DEPARTMENTS, value: '', placeholder: 'Buscar departamento...' })}
          </div>
          <div class="field"><label>Ciudad / Municipio</label>
            ${renderSearchableSelect({ id: 'city', name: 'owner_city', label: '', options: [], value: pet.owner_city || '', placeholder: 'Primero selecciona departamento...' })}
          </div>
          <div class="field full"><label>Dirección</label><input name="owner_address" id="owner-address-input" value="${escapeHtml(pet.owner_address || '')}" placeholder="Calle, número, zona"></div>
        </div>

        <!-- ================= PASO 3: MÉDICO ================= -->
        <div id="ftab-med" class="form-grid hidden">
          <div class="field"><label>Vacunado</label><select name="medical_vaccinated" id="vaccinated-select"><option ${pet.medical_vaccinated === 'Sí' ? 'selected' : ''}>Sí</option><option ${pet.medical_vaccinated !== 'Sí' ? 'selected' : ''}>No</option></select></div>

          <div class="field full" id="vaccines-section" style="${pet.medical_vaccinated === 'Sí' ? '' : 'display:none;'}">
            <label style="display:block; font-weight:600; margin-bottom:8px; color:var(--text-2); text-transform:uppercase; letter-spacing:.6px; font-size:11px;">Vacunas</label>
            <div id="vaccines-list" class="dynamic-list">${dynItems('vaccine', pet.vaccines_detail)}</div>
            <button type="button" class="btn btn-outline btn-sm" id="btn-add-vaccine" style="width:fit-content; align-self:flex-start; margin-top:8px;">+ Agregar vacuna</button>
          </div>

          <div class="field full">
            <label style="display:block; font-weight:600; margin-bottom:8px; color:var(--text-2); text-transform:uppercase; letter-spacing:.6px; font-size:11px;">Desparasitaciones</label>
            <div id="deworming-list" class="dynamic-list">${dynItems('deworming', pet.deworming_detail)}</div>
            <button type="button" class="btn btn-outline btn-sm" id="btn-add-deworming" style="width:fit-content; align-self:flex-start; margin-top:8px;">+ Agregar desparasitación</button>
          </div>

          <div class="field full">
            <label style="display:block; font-weight:600; margin-bottom:8px; color:var(--text-2); text-transform:uppercase; letter-spacing:.6px; font-size:11px;">Enfermedades crónicas</label>
            <div id="conditions-list" class="dynamic-list">${dynItems('condition', pet.conditions_detail)}</div>
            <button type="button" class="btn btn-outline btn-sm" id="btn-add-condition" style="width:fit-content; align-self:flex-start; margin-top:8px;">+ Agregar enfermedad</button>
          </div>

          <div class="field full">
            <label style="display:block; font-weight:600; margin-bottom:8px; color:var(--text-2); text-transform:uppercase; letter-spacing:.6px; font-size:11px;">Cirugías previas</label>
            <div id="surgeries-list" class="dynamic-list">${dynItems('surgery', pet.surgeries_detail)}</div>
            <button type="button" class="btn btn-outline btn-sm" id="btn-add-surgery" style="width:fit-content; align-self:flex-start; margin-top:8px;">+ Agregar cirugía</button>
          </div>

          <div class="field full">
            <label style="display:block; font-weight:600; margin-bottom:8px; color:var(--text-2); text-transform:uppercase; letter-spacing:.6px; font-size:11px;">Medicamentos actuales</label>
            <div id="medications-list" class="dynamic-list">${dynItems('medication', pet.medications_detail)}</div>
            <button type="button" class="btn btn-outline btn-sm" id="btn-add-medication" style="width:fit-content; align-self:flex-start; margin-top:8px;">+ Agregar medicamento</button>
          </div>

          <div class="field full">
            <label style="display:block; font-weight:600; margin-bottom:8px; color:var(--text-2); text-transform:uppercase; letter-spacing:.6px; font-size:11px;">Alergias</label>
            <div id="allergies-list" class="dynamic-list">${dynItems('allergy', (() => {
              const d = parseJsonArray(pet.allergies_detail);
              if (d.length) return d;
              const legacy = String(pet.allergies || pet.medical_allergies || '').trim();
              return legacy ? [{ name: legacy }] : [];
            })())}</div>
            <button type="button" class="btn btn-outline btn-sm" id="btn-add-allergy" style="width:fit-content; align-self:flex-start; margin-top:8px;">+ Agregar alergia</button>
          </div>

          <div class="field"><label>Tipo de sangre</label>${(() => {
            const v = String(pet.blood_type || '').trim();
            const known = ['', 'DEA 1.1', 'DEA 1.3', 'DEA 1.5', 'DEA 1.7', 'DEA 3', 'DEA 4', 'DEA 5', 'DEA 7', 'DEA 8', 'A', 'B', 'AB'];
            const extra = v && !known.includes(v) ? `<option value="${escapeHtml(v)}" selected>${escapeHtml(v)} (valor guardado)</option>` : '';
            return `<select name="blood_type">
              <option value="" ${!v ? 'selected' : ''}>No especificar</option>
              ${extra}
              <optgroup label="Perro (DEA)">
                <option value="DEA 1.1" ${v === 'DEA 1.1' ? 'selected' : ''}>DEA 1.1</option>
                <option value="DEA 1.3" ${v === 'DEA 1.3' ? 'selected' : ''}>DEA 1.3</option>
                <option value="DEA 1.5" ${v === 'DEA 1.5' ? 'selected' : ''}>DEA 1.5</option>
                <option value="DEA 1.7" ${v === 'DEA 1.7' ? 'selected' : ''}>DEA 1.7</option>
                <option value="DEA 3" ${v === 'DEA 3' ? 'selected' : ''}>DEA 3</option>
                <option value="DEA 4" ${v === 'DEA 4' ? 'selected' : ''}>DEA 4</option>
                <option value="DEA 5" ${v === 'DEA 5' ? 'selected' : ''}>DEA 5</option>
                <option value="DEA 7" ${v === 'DEA 7' ? 'selected' : ''}>DEA 7</option>
                <option value="DEA 8" ${v === 'DEA 8' ? 'selected' : ''}>DEA 8</option>
              </optgroup>
              <optgroup label="Gato">
                <option value="A" ${v === 'A' ? 'selected' : ''}>A</option>
                <option value="B" ${v === 'B' ? 'selected' : ''}>B</option>
                <option value="AB" ${v === 'AB' ? 'selected' : ''}>AB</option>
              </optgroup>
            </select>`;
          })()}</div>
          <div class="field"><label>Esterilizado</label><select name="sterilized"><option value="0" ${!pet.sterilized ? 'selected' : ''}>No</option><option value="1" ${pet.sterilized ? 'selected' : ''}>Sí</option></select></div>
          <div class="field full"><label>Observaciones</label><textarea name="medical_observations" rows="3">${escapeHtml(pet.medical_observations || '')}</textarea></div>
          <div class="field full" style="font-size:12px; color:var(--text-2);">El microchip se registra en la pestaña <b>Datos del animal</b>, con su casilla y número.</div>
        </div>
      </form>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" id="btn-modal-prev" style="display:none;">Atrás</button>
      <button class="btn btn-ghost" data-close>Cancelar</button>
      <button class="btn btn-primary btn-next" id="btn-modal-next" disabled>Siguiente</button>
      <button class="btn btn-primary" id="btn-save-pet" style="display:none;">${isEdit ? 'Guardar cambios' : 'Registrar mascota'}</button>
    </div>
  `);

  /* ---------- Navegación por pasos ---------- */
  const PET_STEPS = ['animal', 'prop', 'med'];
  // El CI es obligatorio solo en modo manual (check "Personalizar") o al editar;
  // en modo automático el servidor genera el número secuencial único.
  const animalRequired = () => {
    const reqs = ['#ftab-animal input[name="name"]'];
    if (isEdit || document.getElementById('custom-carnet-check')?.checked)
      reqs.push('#ftab-animal input[name="carnet_number"]');
    return reqs;
  };
  const PET_REQUIRED = {
    animal: animalRequired,
    prop: ['#ftab-prop input[name="owner_name"]', '#ftab-prop input[name="owner_phone"]'],
    med: []
  };
  const reqsFor = (tab) => (typeof PET_REQUIRED[tab] === 'function' ? PET_REQUIRED[tab]() : (PET_REQUIRED[tab] || []));

  const petFieldFilled = (sel) => {
    const el = document.querySelector(sel);
    return !!el && String(el.value || '').trim() !== '';
  };
  const petTabValid = (tab) => reqsFor(tab).every(petFieldFilled);
  const petSaveValid = () => [...animalRequired(), ...PET_REQUIRED.prop].every(petFieldFilled);
  const currentTab = () => document.querySelector('.form-step.active')?.dataset.step || 'animal';

  const updatePetButtons = (tab) => {
    const btnPrev = document.getElementById('btn-modal-prev');
    const btnNext = document.getElementById('btn-modal-next');
    const btnSave = document.getElementById('btn-save-pet');
    const idx = PET_STEPS.indexOf(tab);
    const isLast = idx === PET_STEPS.length - 1;
    if (btnPrev) btnPrev.style.display = idx > 0 ? 'inline-flex' : 'none';
    if (isLast) {
      if (btnNext) btnNext.style.display = 'none';
      if (btnSave) {
        btnSave.style.display = 'inline-flex';
        btnSave.disabled = !petSaveValid();
      }
    } else {
      if (btnNext) {
        btnNext.style.display = 'inline-flex';
        btnNext.disabled = !petTabValid(tab);
      }
      if (btnSave) btnSave.style.display = 'none';
    }
  };

  // Muestra solo el paso activo y oculta los demás. NO borra ningún dato.
  const activatePetTab = (tab) => {
    PET_STEPS.forEach(k => document.getElementById('ftab-' + k)?.classList.toggle('hidden', k !== tab));
    document.querySelectorAll('.form-step').forEach(s => {
      s.classList.remove('active', 'done');
      if (s.dataset.step === tab) s.classList.add('active');
      if (PET_STEPS.indexOf(s.dataset.step) < PET_STEPS.indexOf(tab)) s.classList.add('done');
    });
    updatePetButtons(tab);
  };

  document.querySelectorAll('.form-step').forEach(el => el.addEventListener('click', () => activatePetTab(el.dataset.step)));
  document.getElementById('btn-modal-next')?.addEventListener('click', () => {
    const idx = PET_STEPS.indexOf(currentTab());
    if (idx < PET_STEPS.length - 1) activatePetTab(PET_STEPS[idx + 1]);
  });
  document.getElementById('btn-modal-prev')?.addEventListener('click', () => {
    const idx = PET_STEPS.indexOf(currentTab());
    if (idx > 0) activatePetTab(PET_STEPS[idx - 1]);
  });

  // Validación en tiempo real para habilitar/deshabilitar Siguiente / Guardar
  ['#ftab-animal input[name="name"]', '#ftab-animal input[name="carnet_number"]', ...PET_REQUIRED.prop].forEach(sel => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.addEventListener('input', () => updatePetButtons(currentTab()));
    el.addEventListener('change', () => updatePetButtons(currentTab()));
  });

  /* ---------- CI/carnet: automático vs Personalizar ---------- */
  const carnetInput = document.getElementById('carnet-input');
  const customCheck = document.getElementById('custom-carnet-check');
  if (carnetInput && customCheck) {
    // Vista previa del próximo número (solo registro nuevo). Si la petición
    // falla, el campo queda vacío y el servidor genera el número igualmente.
    api.nextCarnetNumber().then(r => {
      if (r?.carnet_number && !carnetInput.value) {
        carnetInput.value = r.carnet_number;
        carnetInput.dataset.preview = r.carnet_number;
      }
      updatePetButtons(currentTab());
    }).catch(() => {});
    customCheck.addEventListener('change', () => {
      if (customCheck.checked) {
        // Modo manual: editable y obligatorio
        carnetInput.readOnly = false;
        carnetInput.value = '';
        carnetInput.placeholder = 'Ej: PLI-BO-2026-00001';
        carnetInput.focus();
      } else {
        // Vuelve al modo automático con la vista previa
        carnetInput.readOnly = true;
        carnetInput.placeholder = 'Se asigna automáticamente…';
        carnetInput.value = carnetInput.dataset.preview || '';
      }
      updatePetButtons(currentTab());
    });
  }

  // Estado inicial: pestaña indicada (acciones rápidas) o primer paso
  activatePetTab(opts.tab && PET_STEPS.includes(opts.tab) ? opts.tab : 'animal');

  /* ---------- Especie ---------- */
  document.querySelectorAll('#species-group .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#species-group .toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('species-hidden').value = btn.dataset.species;
      const detailField = document.getElementById('species-detail-field');
      if (btn.dataset.species === 'otro') {
        detailField.classList.remove('hidden');
        specDetailInit();
        const specInput = document.getElementById('ss-input-spec-detail');
        if (specInput) specInput.value = '';
        document.getElementById('ss-hidden-spec-detail').value = '';
        refreshBreeds('');
      } else {
        detailField.classList.add('hidden');
        const specInput = document.getElementById('ss-input-spec-detail');
        if (specInput) specInput.value = '';
        document.getElementById('ss-hidden-spec-detail').value = '';
        refreshBreeds(btn.dataset.species);
      }
      const breedInput = document.getElementById('ss-input-breed');
      if (breedInput) breedInput.value = '';
      document.getElementById('ss-hidden-breed').value = '';
    });
  });

  /* ---------- Selectores con búsqueda ---------- */
  const species = pet.species || 'perro';
  refreshBreeds(species === 'otro' ? (pet.species_detail || '') : species);
  if (species === 'otro') specDetailInit();

  // Departamento → Ciudad
  initSearchableSelect('dept', DEPARTMENTS.map(d => ({ v: d, l: d })), (dept) => {
    const cities = getCities(dept);
    initSearchableSelect('city', cities.map(c => ({ v: c, l: c })), null);
    const cityInput = document.getElementById('ss-input-city');
    if (cityInput) { cityInput.value = ''; cityInput.placeholder = `Buscar en ${dept}...`; }
    document.getElementById('ss-hidden-city').value = '';
  });

  // Inicializar ciudad con datos existentes
  if (pet.owner_city) {
    for (const [dept, cities] of Object.entries(BOLIVIA_LOCATIONS)) {
      if (cities.includes(pet.owner_city)) {
        document.getElementById('ss-input-dept').value = dept;
        document.getElementById('ss-hidden-dept').value = dept;
        initSearchableSelect('city', cities.map(c => ({ v: c, l: c })), null);
        document.getElementById('ss-input-city').value = pet.owner_city;
        document.getElementById('ss-hidden-city').value = pet.owner_city;
        break;
      }
    }
  }

  /* ---------- Sexo ---------- */
  document.querySelectorAll('#sex-group .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#sex-group .toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('sex-hidden').value = btn.dataset.sex;
      const offspringGroup = document.getElementById('offspring-group');
      if (offspringGroup) offspringGroup.style.display = btn.dataset.sex === 'Hembra' ? '' : 'none';
    });
  });

  /* ---------- Color ---------- */
  document.querySelectorAll('#color-chips .color-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#color-chips .color-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const color = chip.dataset.color;
      document.getElementById('color-hidden').value = color;
      document.getElementById('distinctive-marks-input').value = color === 'Otro' ? '' : color;
      if (color === 'Otro') document.getElementById('distinctive-marks-input').focus();
    });
  });

  /* ---------- Edad ---------- */
  const birthDateInput = document.getElementById('birth-date-input');
  if (birthDateInput) {
    birthDateInput.addEventListener('change', () => {
      const result = document.getElementById('age-calc-result');
      result.textContent = birthDateInput.value ? calcAge(birthDateInput.value) : 'Selecciona la fecha para calcular la edad';
    });
  }
  const ageModeSelect = document.getElementById('age-mode-select');
  if (ageModeSelect) {
    ageModeSelect.addEventListener('change', (e) => {
      const byYM = e.target.value === 'years_months';
      document.getElementById('age-birth-date-group').style.display = byYM ? 'none' : '';
      document.getElementById('age-years-months-group').style.display = byYM ? '' : 'none';
    });
  }

  /* ---------- Microchip ---------- */
  const hasChipCheck = document.getElementById('has-chip-check');
  if (hasChipCheck) {
    const chipInput = document.getElementById('chip-num');
    hasChipCheck.addEventListener('change', () => {
      chipInput.disabled = !hasChipCheck.checked;
      if (hasChipCheck.checked) chipInput.focus();
    });
  }

  /* ---------- Búsqueda de propietario existente ---------- */
  const btnSearchOwner = document.getElementById('btn-search-owner');
  if (btnSearchOwner) {
    btnSearchOwner.addEventListener('click', async () => {
      const ci = document.getElementById('owner-search-ci').value.trim();
      const phone = document.getElementById('owner-search-phone').value.trim();
      if (!ci && !phone) { toast('Ingresa un CI o teléfono para buscar', 'error'); return; }
      try {
        const results = await api.searchOwners(ci, phone);
        const resultDiv = document.getElementById('owner-search-result');
        if (results && results.length > 0) {
          const owner = results[0];
          resultDiv.style.display = 'block';
          resultDiv.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
              <div>
                <b>${escapeHtml(owner.owner_name)}</b><br>
                <span style="font-size:14px; font-weight:600;">CI: ${escapeHtml(owner.owner_ci || '—')} · Tel: ${escapeHtml(owner.owner_phone || '—')} · ${escapeHtml(owner.owner_city || '')}</span>
              </div>
              <button type="button" id="btn-apply-owner" class="btn btn-outline btn-sm">Usar estos datos</button>
            </div>`;
          document.getElementById('btn-apply-owner').addEventListener('click', () => {
            document.getElementById('owner-name-input').value = owner.owner_name || '';
            document.getElementById('owner-ci-input').value = owner.owner_ci || '';
            document.getElementById('owner-phone-input').value = owner.owner_phone || '';
            document.getElementById('owner-email-input').value = owner.owner_email || '';
            document.getElementById('owner-address-input').value = owner.owner_address || '';
            if (owner.owner_city) {
              document.getElementById('ss-input-city').value = owner.owner_city;
              document.getElementById('ss-hidden-city').value = owner.owner_city;
            }
            updatePetButtons(currentTab());
            toast('Datos del propietario cargados');
          });
        } else {
          resultDiv.style.display = 'block';
          resultDiv.innerHTML = '<span style="color:var(--text-2);">No se encontró ningún propietario con esos datos. Puedes registrar uno nuevo.</span>';
        }
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  /* ---------- Médico ---------- */
  const vaccinatedSelect = document.getElementById('vaccinated-select');
  if (vaccinatedSelect) {
    vaccinatedSelect.addEventListener('change', (e) => {
      const group = document.getElementById('vaccines-section');
      if (group) group.style.display = e.target.value === 'Sí' ? '' : 'none';
    });
  }

  // Agregar / eliminar items de las 6 listas dinámicas
  [
    ['vaccine', 'vaccines-list', 'btn-add-vaccine'],
    ['deworming', 'deworming-list', 'btn-add-deworming'],
    ['condition', 'conditions-list', 'btn-add-condition'],
    ['surgery', 'surgeries-list', 'btn-add-surgery'],
    ['medication', 'medications-list', 'btn-add-medication'],
    ['allergy', 'allergies-list', 'btn-add-allergy']
  ].forEach(([kind, listId, btnId]) => {
    document.getElementById(btnId)?.addEventListener('click', () => addDynamicItem(listId, dynItem(kind)));
    document.getElementById(listId)?.addEventListener('click', (e) => {
      if (e.target && e.target.classList.contains('btn-remove-item')) e.target.closest('.dynamic-item').remove();
    });
  });

  bindPhotoEditor();
  document.getElementById('btn-save-pet').addEventListener('click', () => savePet(pet.id, isEdit));
}

/* ============================================================
   FOTO
   ============================================================ */
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

/* ============================================================
   GUARDAR
   ============================================================ */
async function savePet(id, isEdit) {
  const fd = new FormData();
  // Se recolectan desde el contenedor del modal para no depender de la ubicación
  // exacta de los campos dentro del formulario (pestañas ocultas/combinaciones).
  const modalEl = document.getElementById('active-modal-overlay');
  modalEl.querySelectorAll('input, select, textarea').forEach(el => {
    if (!el.name) return;
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    if (type === 'checkbox') { if (el.checked) fd.append(el.name, el.value); return; }
    if (type === 'radio') { if (el.checked) fd.append(el.name, el.value); return; }
    fd.append(el.name, el.value ?? '');
  });
  const get = k => fd.get(k) || '';

  // Modo manual = edición o check "Personalizar" activo. En modo automático el
  // servidor genera el secuencial, así que el CI puede ir vacío.
  const manualCarnet = isEdit || !!document.getElementById('custom-carnet-check')?.checked;
  if (!get('name').trim() || !get('owner_name').trim() || !get('owner_phone').trim() || (manualCarnet && !get('carnet_number').trim())) {
    toast('Completa los campos obligatorios (*)' + (manualCarnet ? ', incluyendo el número de carnet' : ''), 'error');
    return;
  }

  // Recolectar items dinámicos de cada sección médica (nombre y fecha opcional)
  const collectDynamicList = (containerId, nameField, dateField) => {
    const container = document.getElementById(containerId);
    if (!container) return [];
    const items = [];
    container.querySelectorAll('.dynamic-item').forEach(el => {
      const nameInput = el.querySelector(`input[name="${nameField}"]`);
      const dateInput = dateField ? el.querySelector(`input[name="${dateField}"]`) : null;
      items.push({ name: nameInput ? nameInput.value : '', date: dateInput ? dateInput.value : '' });
    });
    return items.filter(i => i.name.trim());
  };

  const vaccines = collectDynamicList('vaccines-list', 'vaccine_name', 'vaccine_date');
  const dewormings = collectDynamicList('deworming-list', 'deworming_name', 'deworming_date');
  const conditions = collectDynamicList('conditions-list', 'condition_name', 'condition_date');
  const surgeries = collectDynamicList('surgeries-list', 'surgery_name', 'surgery_date');
  const medications = collectDynamicList('medications-list', 'medication_name', 'medication_date');
  const allergies = collectDynamicList('allergies-list', 'allergy_name', null);
  const names = list => list.map(i => i.name).filter(Boolean).join(', ');

  const hasChip = !!fd.get('has_chip');

  const petData = {
    id,
    // Modo automático: se envía vacío para que el servidor genere el secuencial
    carnet_number: manualCarnet ? get('carnet_number') : '',
    name: get('name'),
    species: document.getElementById('species-hidden')?.value || get('species'),
    species_detail: document.getElementById('ss-hidden-spec-detail')?.value || get('species_detail') || '',
    breed: document.getElementById('ss-hidden-breed')?.value || get('breed'),
    sex: document.getElementById('sex-hidden')?.value || get('sex'),
    birth_date: get('age_mode') === 'birth_date' ? get('birth_date') : '',
    color: document.getElementById('color-hidden')?.value || get('distinctive_marks'),
    weight: get('weight'),
    category: get('category') || 'General',
    status: get('status'),
    distinctive_marks: get('distinctive_marks'),
    registration_date: get('registration_date'),
    photo: photoTemp,
    owner_name: get('owner_name'), owner_ci: get('owner_ci'), owner_address: get('owner_address'),
    owner_city: document.getElementById('ss-hidden-city')?.value || get('owner_city'),
    owner_phone: get('owner_phone'), owner_email: get('owner_email'),
    medical_vaccinated: get('medical_vaccinated'),
    medical_vaccines: names(vaccines),
    medical_observations: get('medical_observations'),
    medical_diseases: names(conditions),
    medical_allergies: names(allergies),
    chip: hasChip ? get('chip') : '',
    has_chip: hasChip ? 1 : 0,
    age_years: get('age_mode') === 'years_months' ? get('age_years') : '',
    age_months: get('age_mode') === 'years_months' ? get('age_months') : '',
    age_mode: get('age_mode'),
    vaccines_list: names(vaccines),
    deworming_history: names(dewormings),
    medical_conditions: names(conditions),
    surgeries: names(surgeries),
    medications: names(medications),
    sterilized: get('sterilized') === '1' ? 1 : 0,
    microchip: hasChip ? get('chip') : '',
    blood_type: get('blood_type')
  };

  try {
    let createdId = id;
    let savedCarnet = petData.carnet_number;
    if (isEdit) {
      await api.updatePet(id, petData);
      // El PUT conserva el número previo si llegó vacío
      savedCarnet = savedCarnet || pet.carnet_number || '';
    } else {
      const res = await api.createPet(petData);
      createdId = res.id;
      // El número definitivo lo asignó el servidor
      savedCarnet = res.carnet_number || savedCarnet;
    }
    await state.loadPets();
    api.logHistory(isEdit ? 'Edición' : 'Creación', `${petData.name} (${savedCarnet})`);

    // Detalles médicos extendidos (listas dinámicas como JSON)
    const medicalDetails = {
      vaccines_list: petData.vaccines_list,
      deworming_history: petData.deworming_history,
      medical_conditions: petData.medical_conditions,
      allergies: names(allergies),
      surgeries: petData.surgeries,
      medications: petData.medications,
      sterilized: petData.sterilized,
      microchip: petData.microchip,
      blood_type: petData.blood_type,
      vaccines_detail: vaccines,
      deworming_detail: dewormings,
      conditions_detail: conditions,
      surgeries_detail: surgeries,
      medications_detail: medications,
      allergies_detail: allergies
    };
    try {
      await api.updateMedicalDetails(createdId, medicalDetails);
    } catch (_) { /* no bloquear si falla */ }

    state.cardPetId = createdId;
    state.view = isEdit ? state.view : 'mascotas';

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
    rerender();
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