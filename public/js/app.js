import { state } from './state.js';
import { setToken } from './api.js';
import { api } from './api.js';
import { pawSvg, iconGrid, iconPaw, iconCard, iconSearch, iconClock, iconGear, iconLogout, iconMenu } from './icons.js';
import { escapeHtml, toast, statusBadge, speciesLabel, placeholderPhoto } from './utils.js';
import { initLogin, renderLogin } from './pages/login.js';
import { initDashboard, viewDashboard, drawCharts } from './pages/dashboard.js';
import { initPets, viewMascotas, bindPetsEvents, openPetModal } from './pages/pets.js';
import { initCard, viewCarnet, renderCardPreview, bindCarnetEvents } from './pages/card-generator.js';
import { initHistory, viewHistorial } from './pages/history.js';
import { initConfig, viewConfig, bindConfigEvents } from './pages/config.js';
import { renderPublicPage } from './pages/public.js';

initLogin(state);
initDashboard(state);
initPets(state);
initCard(state);
initHistory(state);
initConfig(state);

window.addEventListener('hashchange', route);

function route() {
  const h = location.hash;
  if (h.startsWith('#/public/')) {
    renderPublicPage(h.replace('#/public/', ''));
    return;
  }
  renderApp();
}

(async function init() {
  state.applyTheme();
  const token = localStorage.getItem('pli-token');
  if (token) {
    try {
      const data = await api.me();
      state.setUser(data.user);
      await state.init();
    } catch {
      setToken(null);
    }
  }
  route();
})();

export function renderApp() {
  if (!state.user) { renderLogin(); return; }
  if (state.user.role === 'Espectador') { renderSpectador(); return; }
  const app = document.getElementById('app');
  app.innerHTML = `
  <div class="shell">
    ${sidebarHtml()}
    <div class="main">
      ${topbarHtml()}
      <div class="page-body" id="page-body"></div>
    </div>
  </div>`;
  bindShellEvents();
  renderView();
}

export function renderSpectador() {
  const app = document.getElementById('app');
  const pets = state.getPets();
  app.innerHTML = `
  <div class="spectador-page">
    <div class="spectador-top">
      <div class="brand-mark">
        ${pawSvg(26)}
        <div class="name">${escapeHtml(state.getSettings().systemName || 'FAM-VET')}<small>ID BOLIVIA</small></div>
      </div>
      <button class="btn btn-outline btn-sm" id="btn-esc-logout">${iconLogout} Cerrar sesión</button>
    </div>
    <div class="spectador-body">
      ${!pets.length ? `<div class="empty-state">${iconPaw}<div><b>No hay mascotas asociadas a este CI</b><p>Verifica que tu CI esté registrado correctamente.</p></div></div>`
      : pets.map(pet => `
        <div class="spectador-card">
          ${pet.status === 'Perdido' ? '<div class="public-alert">🚨 ¡ESTA MASCOTA ESTÁ PERDIDA! — POR FAVOR CONTACTAR AL PROPIETARIO</div>' : ''}
          <div class="spec-photo-wrap">
            <img class="public-photo" src="${pet.photo || placeholderPhoto()}" alt="${escapeHtml(pet.name)}">
          </div>
          <div class="spec-body">
            <h1>${escapeHtml(pet.name)}</h1>
            <div class="sub">${speciesLabel(pet.species)} · ${escapeHtml(pet.breed || '—')} · N° ${pet.carnet_number}</div>
            <div style="margin-top:8px;">${statusBadge(pet.status)}</div>
            <div class="public-grid">
              <div><b>Sexo</b><span>${pet.sex || '—'}</span></div>
              <div><b>Color</b><span>${escapeHtml(pet.color || '—')}</span></div>
              <div><b>Peso</b><span>${pet.weight ? pet.weight + ' kg' : '—'}</span></div>
              <div><b>Vacunado</b><span>${pet.medical_vaccinated === 'Sí' ? '✅ Sí' : '❌ No'}</span></div>
              <div><b>Fecha nac.</b><span>${pet.birth_date || '—'}</span></div>
              <div><b>Hijos</b><span>${escapeHtml(pet.offspring || 'Ninguno')}</span></div>
              <div class="full"><b>Propietario</b><span>${escapeHtml(pet.owner_name)}</span></div>
              <div class="full"><b>Dirección</b><span>${escapeHtml(pet.owner_address || '—')}, ${escapeHtml(pet.owner_city || '')}</span></div>
              ${pet.medical_observations ? `<div class="full"><b>Observaciones</b><span>${escapeHtml(pet.medical_observations)}</span></div>` : ''}
              ${pet.medical_allergies ? `<div class="full"><b>Alergias</b><span>${escapeHtml(pet.medical_allergies)}</span></div>` : ''}
            </div>
            <div class="public-actions">
              <a class="btn btn-primary" href="tel:${pet.owner_phone}">📞 Llamar al propietario</a>
              <a class="btn btn-gold" target="_blank" href="https://wa.me/${(pet.owner_phone || '').replace(/\D/g, '')}?text=${encodeURIComponent('Hola, soy ' + state.user.name + ', vi la información de ' + pet.name + ' en FAM-VET.')}">💬 WhatsApp</a>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
  <p class="faint" style="text-align:center;margin-top:20px;font-size:11px;">FAM-VET Bolivia · Identificación animal</p>`;
  const logout = document.getElementById('btn-esc-logout');
  if (logout) logout.addEventListener('click', () => { state.setUser(null); setToken(null); state.view = 'dashboard'; renderApp(); });
}

function sidebarHtml() {
  const items = [
    { id: 'dashboard', label: 'Panel principal', icon: iconGrid },
    { id: 'mascotas', label: 'Mascotas', icon: iconPaw },
    { id: 'carnet', label: 'Generador de carnet', icon: iconCard },
    { id: 'buscar', label: 'Búsqueda avanzada', icon: iconSearch },
    { id: 'historial', label: 'Historial', icon: iconClock },
    { id: 'config', label: 'Configuración', icon: iconGear, adminOnly: true },
  ];
  return `
  <div class="sidebar ${state.sidebarOpen ? 'open' : ''}" id="sidebar">
    <div class="brand-mark">
      ${pawSvg()}
      <div class="name">${escapeHtml(state.getSettings().systemName || 'FAM-VET')}<small>ID BOLIVIA</small></div>
    </div>
    <div class="nav-section-label">Menú</div>
    ${items.filter(i => !i.adminOnly || state.user.role === 'Administrador').map(i => `
      <div class="nav-item ${state.view === i.id ? 'active' : ''}" data-nav="${i.id}">${i.icon}<span>${i.label}</span></div>
    `).join('')}
    <div class="sidebar-foot">
      <div class="user-chip">
        <div class="avatar">${state.user.name.split(' ').map(s => s[0]).slice(0, 2).join('')}</div>
        <div>
          <div class="u-name">${escapeHtml(state.user.name)}</div>
          <div class="u-role">${state.user.role}</div>
        </div>
      </div>
      <div class="nav-item" data-action="logout" style="margin-top:6px;">${iconLogout} <span>Cerrar sesión</span></div>
    </div>
  </div>`;
}

function topbarHtml() {
  return `
  <div class="topbar">
    <button class="btn-icon" id="btn-burger" style="display:none;">${iconMenu}</button>
    <div class="search-global">
      ${iconSearch}
      <input id="global-search" placeholder="Buscar por nombre, carnet, propietario, CI, teléfono..." value="${escapeHtml(state.search)}">
    </div>
    <div class="topbar-right">
      <button class="btn btn-primary btn-sm" data-action="new-pet">＋ Nueva mascota</button>
      <label class="switch" title="Modo oscuro">
        <input type="checkbox" id="theme-toggle" ${state.theme === 'dark' ? 'checked' : ''}>
        <span class="slider"></span>
      </label>
    </div>
  </div>`;
}

function bindShellEvents() {
  document.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', () => { state.view = el.dataset.nav; state.sidebarOpen = false; renderApp(); }));
  const logout = document.querySelector('[data-action="logout"]');
  if (logout) logout.addEventListener('click', () => { state.setUser(null); setToken(null); state.view = 'dashboard'; renderApp(); });
  const newPet = document.querySelector('[data-action="new-pet"]');
  if (newPet) newPet.addEventListener('click', () => { openPetModal(); });
  const tt = document.getElementById('theme-toggle');
  if (tt) tt.addEventListener('change', () => { state.theme = tt.checked ? 'dark' : 'light'; state.applyTheme(); });
  const gs = document.getElementById('global-search');
  if (gs) gs.addEventListener('input', () => {
    state.search = gs.value;
    state.view = 'mascotas';
    renderApp();
    setTimeout(() => { const i = document.getElementById('global-search'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 0);
  });
}

export function renderView() {
  const body = document.getElementById('page-body');
  if (state.view === 'dashboard') body.innerHTML = viewDashboard();
  else if (state.view === 'mascotas') body.innerHTML = viewMascotas();
  else if (state.view === 'carnet') body.innerHTML = viewCarnet();
  else if (state.view === 'buscar') body.innerHTML = viewMascotas(true);
  else if (state.view === 'historial') body.innerHTML = viewHistorial();
  else if (state.view === 'config') body.innerHTML = state.user.role === 'Administrador' ? viewConfig() : `<p>No autorizado.</p>`;
  bindViewEvents();
  if (state.view === 'dashboard') drawCharts();
  if (state.view === 'carnet') renderCardPreview();
}

function bindViewEvents() {
  bindPetsEvents();
  bindConfigEvents();
  bindCarnetEvents();
}
