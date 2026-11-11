import { api } from '../api.js';
import { iconTrash, iconChevronRight, iconX } from '../icons.js';
import { escapeHtml, toast, speciesLabel, statusBadge, placeholderPhoto } from '../utils.js';
import { openModal, closeModal } from '../components/modal.js';
import { openPetDetail } from './pets.js';

let state = null;
const TEMPLATES = [
  { id: 'bolivia', name: 'Bolivia' }, { id: 'azul', name: 'Azul' }, { id: 'verde', name: 'Verde' },
  { id: 'minimal', name: 'Minimalista' }, { id: 'moderna', name: 'Moderna' }, { id: 'vet', name: 'Veterinaria' }
];

export function initConfig(s) {
  state = s;
}

export function viewConfig() {
  const s = state.getSettings();
  return `
  <div class="page-head"><div><h1>Configuración</h1><p>Identidad y plantillas de FAM J VET. La gestión de usuarios está en la vista Usuarios.</p></div></div>
  <div class="panel">
    <h3>Identidad del sistema</h3>
    <div class="form-grid">
      <div class="field full"><label>Nombre del sistema</label><input id="cfg-name" value="${escapeHtml(s.systemName || '')}"></div>
      <div class="field full"><label>Subtítulo / eslogan</label><input id="cfg-sub" value="${escapeHtml(s.systemSub || '')}"></div>
      <div class="field"><label>Formato de carnet</label><input id="cfg-format" value="${escapeHtml(s.cardFormat || '')}"></div>
      <div class="field"><label>Tamaño de QR (px)</label><input id="cfg-qr" type="number" value="${s.qrSize || 56}"></div>
      <div class="field full"><label>Texto de pie de carnet</label><input id="cfg-footer" value="${escapeHtml(s.footerText || '')}"></div>
      <div class="field full"><label>Plantilla predeterminada</label>
        <select id="cfg-tpl">${TEMPLATES.map(t => `<option value="${t.id}" ${s.defaultTemplate === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}</select>
      </div>
    </div>
    <button class="btn btn-primary" id="btn-save-config" style="margin-top:14px;">Guardar configuración</button>
  </div>`;
}

/* ============================================================
   VISTA USUARIOS (sidebar "Usuarios")
   Un usuario puede tener varias mascotas; una mascota pertenece
   a un solo usuario (pets.created_by).
   ============================================================ */
export function viewUsuarios() {
  return `
  <div class="page-head"><div><h1>Usuarios</h1><p>Personal del sistema y las mascotas que cada uno ha registrado.</p></div></div>
  <div class="panel">
    <h3>Usuarios y roles</h3>
    <div class="table-wrap" style="box-shadow:none;">
      <table><thead><tr><th>Usuario</th><th>Rol</th><th></th></tr></thead>
      <tbody>${state.getUsers().map((u) => `<tr data-user-pets="${u.id}" style="cursor:pointer;"><td><b>${escapeHtml(u.name)}</b><div class="faint">@${u.username}</div></td><td>${u.role}</td><td><button class="btn-icon" data-deluser="${u.id}" title="Eliminar usuario">${iconTrash}</button></td></tr>`).join('')}</tbody></table>
    </div>
    <div class="faint" style="font-size:11px; margin-top:8px;">Haz clic en un usuario para ver las mascotas que registró.</div>
    <div class="form-grid" style="margin-top:14px;">
      <div class="field"><label>Usuario nuevo</label><input id="new-user-name" placeholder="nombre.usuario"></div>
      <div class="field"><label>Contraseña</label><input id="new-user-pass" placeholder="••••••"></div>
      <div class="field"><label>Nombre completo</label><input id="new-user-fullname" placeholder="Nombre Apellido"></div>
      <div class="field"><label>Rol</label><select id="new-user-role"><option>Operador</option><option>Administrador</option></select></div>
    </div>
    <button class="btn btn-outline" id="btn-add-user">Agregar usuario</button>
  </div>`;
}

/* Modal con las mascotas registradas por un usuario */
export function openUserPetsModal(user) {
  if (!user) return;
  const pets = state.getPets().filter(p => p.created_by === user.username);
  const unattributed = state.getPets().filter(p => !p.created_by).length;
  openModal('modal-md', `
    <div class="modal-head"><h3>Mascotas de ${escapeHtml(user.name)} (${pets.length})</h3><button class="btn-icon" data-close>${iconX}</button></div>
    <div class="modal-body">
      <div style="max-height:380px; overflow-y:auto;">
        ${pets.map(p => `
          <div class="alert-item" data-user-pet="${p.id}" style="margin-bottom:6px;">
            <img class="pet-thumb" src="${p.photo || placeholderPhoto()}" alt="">
            <div class="a-main"><div class="a-title">${escapeHtml(p.name)}</div><div class="a-desc">${escapeHtml(p.carnet_number || '')} · ${speciesLabel(p.species, p.species_detail)} · ${escapeHtml(p.owner_name || '')} · ${escapeHtml(p.registration_date || '')}</div></div>
            ${statusBadge(p.status)}
            <span class="a-go">${iconChevronRight}</span>
          </div>`).join('') || `<div class="alert-none">Este usuario aún no ha registrado mascotas.</div>`}
      </div>
      ${unattributed ? `<div class="faint" style="font-size:11px; margin-top:10px;">${unattributed} mascota(s) sin atribución (registradas antes de este control).</div>` : ''}
    </div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-close>Cerrar</button>
      <button class="btn btn-primary" data-view-user-pets="${escapeHtml(user.username)}">Ver en Mascotas</button>
    </div>`);
  // Clic en una mascota del modal → ficha completa
  document.querySelectorAll('[data-user-pet]').forEach(item => item.addEventListener('click', () => {
    closeModal();
    openPetDetail(item.dataset.userPet);
  }));
  // "Ver en Mascotas" → lista filtrada por ese usuario
  document.querySelectorAll('[data-view-user-pets]').forEach(el => el.addEventListener('click', () => {
    state.filterUser = el.dataset.viewUserPets;
    state.view = 'mascotas';
    closeModal();
    import('../app.js').then(m => m.renderApp());
  }));
}

export function bindConfigEvents() {
  const save = document.getElementById('btn-save-config');
  if (save) save.addEventListener('click', async () => {
    try {
      await api.updateSettings({
        systemName: document.getElementById('cfg-name').value,
        systemSub: document.getElementById('cfg-sub').value,
        cardFormat: document.getElementById('cfg-format').value,
        qrSize: Number(document.getElementById('cfg-qr').value) || 56,
        footerText: document.getElementById('cfg-footer').value,
        defaultTemplate: document.getElementById('cfg-tpl').value
      });
      await state.loadSettings();
      api.logHistory('Actualización de configuración', state.getSettings().systemName);
      toast('Configuración guardada');
      import('../app.js').then(m => m.renderApp());
    } catch (e) { toast(e.message, 'error'); }
  });

  const addUser = document.getElementById('btn-add-user');
  if (addUser) addUser.addEventListener('click', async () => {
    const u = document.getElementById('new-user-name').value.trim();
    const p = document.getElementById('new-user-pass').value;
    const n = document.getElementById('new-user-fullname').value.trim() || u;
    const r = document.getElementById('new-user-role').value;
    if (!u || !p) { toast('Completa usuario y contraseña', 'error'); return; }
    try {
      await api.createUser({ username: u, password: p, name: n, role: r });
      await state.loadUsers();
      api.logHistory('Usuario creado', n);
      toast('Usuario agregado');
      import('../app.js').then(m => m.renderApp());
    } catch (e) { toast(e.message, 'error'); }
  });

  document.querySelectorAll('[data-deluser]').forEach(el => el.addEventListener('click', async () => {
    const id = Number(el.dataset.deluser);
    const user = state.getUsers().find(u => u.id === id);
    if (!user) return;
    if (state.getUsers().length <= 1) { toast('Debe existir al menos un usuario', 'error'); return; }
    if (!confirm(`¿Eliminar el usuario ${user.name}?`)) return;
    try {
      await api.deleteUser(id);
      await state.loadUsers();
      api.logHistory('Usuario eliminado', user.name);
      toast('Usuario eliminado');
      import('../app.js').then(m => m.renderApp());
    } catch (e) { toast(e.message, 'error'); }
  }));

  // Mascotas registradas por usuario (clic en la fila de la tabla)
  document.querySelectorAll('[data-user-pets]').forEach(el => el.addEventListener('click', (e) => {
    if (e.target.closest('[data-deluser]')) return; // no abrir el modal al pulsar eliminar
    const id = Number(el.dataset.userPets);
    const user = state.getUsers().find(u => u.id === id);
    if (!user) return;
    openUserPetsModal(user);
  }));
}
