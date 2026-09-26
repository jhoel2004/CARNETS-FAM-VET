import { api } from '../api.js';
import { iconTrash } from '../icons.js';
import { escapeHtml, toast } from '../utils.js';

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
  <div class="page-head"><div><h1>Configuración del sistema</h1><p>Personaliza la identidad, plantillas y usuarios de FAM-VET.</p></div></div>
  <div class="grid-2">
    <div class="panel">
      <h3>Identidad del sistema</h3>
      <div class="form-grid">
        <div class="field full"><label>Nombre del sistema</label><input id="cfg-name" value="${escapeHtml(s.systemName || '')}"></div>
        <div class="field full"><label>Subtítulo / eslogan</label><input id="cfg-sub" value="${escapeHtml(s.systemSub || '')}"></div>
        <div class="field"><label>Formato de carnet</label><input id="cfg-format" value="${escapeHtml(s.cardFormat || '')}"></div>
        <div class="field"><label>Tamaño de QR (px)</label><input id="cfg-qr" type="number" value="${s.qrSize || 56}"></div>
        <div class="field full"><label>Texto de pie de carnet</label><input id="cfg-footer" value="${escapeHtml(s.footerText || '')}"></div>
        <div class="field full"><label>Texto de firma del carnet</label><input id="cfg-signature" value="${escapeHtml(s.signatureText || '')}" placeholder="Ej: Jhoel" style="font-family:'Brush Script MT',cursive;font-size:18px;font-style:italic;"></div>
        <div class="field full"><label>Plantilla predeterminada</label>
          <select id="cfg-tpl">${TEMPLATES.map(t => `<option value="${t.id}" ${s.defaultTemplate === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}</select>
        </div>
      </div>
      <button class="btn btn-primary" id="btn-save-config" style="margin-top:14px;">Guardar configuración</button>
    </div>
    <div class="panel">
      <h3>Usuarios y roles</h3>
      <div class="table-wrap" style="box-shadow:none;">
        <table><thead><tr><th>Usuario</th><th>Rol</th><th></th></tr></thead>
        <tbody>${state.getUsers().map((u, i) => `<tr><td><b>${escapeHtml(u.name)}</b><div class="faint">@${u.username}</div></td><td>${u.role}</td><td><button class="btn-icon" data-deluser="${u.id}">${iconTrash}</button></td></tr>`).join('')}</tbody></table>
      </div>
      <div class="form-grid" style="margin-top:14px;">
        <div class="field"><label>Usuario nuevo</label><input id="new-user-name" placeholder="nombre.usuario"></div>
        <div class="field"><label>Contraseña</label><input id="new-user-pass" placeholder="••••••"></div>
        <div class="field"><label>Nombre completo</label><input id="new-user-fullname" placeholder="Nombre Apellido"></div>
        <div class="field"><label>Rol</label><select id="new-user-role"><option>Operador</option><option>Administrador</option></select></div>
      </div>
      <button class="btn btn-outline" id="btn-add-user">＋ Agregar usuario</button>
    </div>
  </div>`;
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
        defaultTemplate: document.getElementById('cfg-tpl').value,
        signatureText: document.getElementById('cfg-signature').value
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
}
