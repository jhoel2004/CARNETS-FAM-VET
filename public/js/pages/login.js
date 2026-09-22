import { api } from '../api.js';
import { setToken } from '../api.js';
import { pawSvg } from '../icons.js';
import { escapeHtml } from '../utils.js';

let state = null;

export function initLogin(s) {
  state = s;
}

export function renderLogin() {
  const s = state.getSettings();
  document.getElementById('app').innerHTML = `
  <div class="login-screen">
    <div class="login-card">
      <div class="login-brand">
        <div class="brand-mark">${pawSvg(46)}<div class="name">${escapeHtml(s.systemName)}<small>ID BOLIVIA</small></div></div>
        <div>
          <div class="login-tagline">Identificación digital y física para las mascotas de Bolivia.</div>
          <div class="tri-strip"><span></span><span></span><span></span></div>
        </div>
      </div>
      <div class="login-form">
        <h2>Ingresa el carnet de tu mascota</h2>
        <p class="sub">Escribe el número de carnet que aparece impreso en el carnet de tu mascota.</p>
        <div id="carnet-error"></div>
        <div class="field"><label>Número de carnet</label><input id="input-carnet" placeholder="PLI-BO-2026-00001"></div>
        <button class="btn btn-primary" id="btn-carnet-lookup" style="width:100%; margin-top:4px;">Ver datos de mi mascota</button>
        <div style="text-align:center; margin-top:24px;">
          <a href="#" id="show-admin-login" style="font-size:11px; color:var(--text-faint); text-decoration:none;">Acceso administrativo</a>
        </div>
        <div id="admin-login-section" style="display:none; margin-top:16px; padding-top:16px; border-top:1px solid var(--border);">
          <h2 style="margin-top:0; font-size:16px;">Acceso al sistema</h2>
          <div id="login-error"></div>
          <div class="field"><label>Usuario</label><input id="login-user" placeholder="admin"></div>
          <div class="field"><label>Contraseña</label><input id="login-pass" type="password" placeholder="••••••••"></div>
          <button class="btn btn-outline" id="btn-login" style="width:100%;">Ingresar</button>
        </div>
      </div>
    </div>
  </div>`;

  document.getElementById('btn-carnet-lookup').addEventListener('click', doCarnetLookup);
  document.getElementById('input-carnet').addEventListener('keydown', e => { if (e.key === 'Enter') doCarnetLookup(); });

  document.getElementById('show-admin-login').addEventListener('click', (e) => {
    e.preventDefault();
    const section = document.getElementById('admin-login-section');
    section.style.display = section.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('btn-login').addEventListener('click', doLogin);
  document.getElementById('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
}

async function doCarnetLookup() {
  const carnet = document.getElementById('input-carnet').value.trim();
  const errBox = document.getElementById('carnet-error');
  if (!carnet) { errBox.innerHTML = '<div class="login-error">Ingresa un número de carnet</div>'; return; }
  try {
    const pet = await api.getPublicPetByCarnet(carnet);
    location.hash = '#/public/' + pet.id;
    location.reload();
  } catch (e) {
    errBox.innerHTML = `<div class="login-error">No encontramos ninguna mascota con ese carnet. Verifica el número e intenta de nuevo.</div>`;
  }
}

async function doLogin() {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value;
  const errBox = document.getElementById('login-error');
  try {
    const data = await api.login(u, p);
    setToken(data.token);
    state.setUser(data.user);
    if (data.user.role === 'Espectador') {
      await state.loadPets();
      state.setView('espectador');
      const appModule = await import('../app.js');
      appModule.renderSpectador();
      return;
    }
    state.setView('dashboard');
    await state.init();
    const appModule = await import('../app.js');
    appModule.renderApp();
  } catch (e) {
    errBox.innerHTML = `<div class="login-error">${escapeHtml(e.message)}</div>`;
  }
}
