import { state } from './state.js';
import { setToken } from './api.js';
import { api } from './api.js';
import { pawSvg, iconGrid, iconPaw, iconCard, iconSearch, iconClock, iconGear, iconLogout, iconMenu, iconPlus, iconX, iconUsers, iconStethoscope, iconSyringe, iconPill, iconHeartbeat, iconScissors, iconCalendar, iconChart, iconActivity, iconBell, iconChevronDown, iconChevronRight, iconHome, iconUser, iconFileText, iconPanelLeft } from './icons.js';
import { escapeHtml, toast, statusBadge, speciesLabel, placeholderPhoto } from './utils.js';
import { initLogin, renderLogin } from './pages/login.js';
import { initDashboard, viewDashboard, drawCharts, bindDashboardEvents } from './pages/dashboard.js';
import { initPets, viewMascotas, bindPetsEvents, openPetModal, openPetDetail } from './pages/pets.js';
import { initCard, viewCarnet, renderCardPreview, bindCarnetEvents } from './pages/card-generator.js';
import { initHistory, viewHistorial } from './pages/history.js';
import { initConfig, viewConfig, bindConfigEvents } from './pages/config.js';
import { initSalud, viewSalud, bindSaludEvents, getSaludSubtab, setSaludSubtab } from './pages/health.js';
import { renderPublicPage } from './pages/public.js';
import { initDashboardData, getDashTab, setDashTab, DASH_TABS, buildAlerts } from './pages/dashboard-data.js';
import { openReportDialog } from './pages/dashboard.js';

initLogin(state);
initDashboard(state);
initPets(state);
initCard(state);
initHistory(state);
initConfig(state);
initSalud(state);

window.addEventListener('hashchange', route);

function route() {
  const h = location.hash;
  if (h.startsWith('#/public/')) {
    renderPublicPage(h.replace('#/public/', ''));
    return;
  }
  renderApp();
}

export function renderApp() {
  if (!state.user) { renderLogin(); return; }
  if (state.user.role === 'Espectador') { renderSpectador(); return; }
  const app = document.getElementById('app');
  const collapsed = localStorage.getItem('pli-sidebar-collapsed') === '1';
  app.innerHTML = `
  <div class="shell ${collapsed && window.innerWidth >= 1024 ? 'is-collapsed' : ''}">
    <div class="sidebar-hover-zone" id="sidebar-hover-zone" aria-hidden="true"></div>
    <div class="drawer-veil ${state.sidebarOpen ? 'show' : ''}" id="drawer-veil"></div>
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
        <div class="name">${escapeHtml(state.getSettings().systemName || 'FAM J VET')}<small>ID BOLIVIA</small></div>
      </div>
      <button class="btn btn-outline btn-sm" id="btn-esc-logout">${iconLogout} Cerrar sesión</button>
    </div>
    <div class="spectador-body">
      ${!pets.length ? `<div class="empty-state">${iconPaw}<div><b>No hay mascotas asociadas a este CI</b><p>Verifica que tu CI esté registrado correctamente.</p></div></div>`
      : pets.map(pet => `
        <div class="spectador-card">
          ${pet.status === 'Perdido' ? '<div class="public-alert">ESTA MASCOTA ESTÁ PERDIDA — POR FAVOR CONTACTAR AL PROPIETARIO</div>' : ''}
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
              <div><b>Vacunado</b><span>${pet.medical_vaccinated === 'Sí' ? 'Sí' : 'No'}</span></div>
              <div><b>Fecha nac.</b><span>${pet.birth_date || '—'}</span></div>
              <div><b>Hijos</b><span>${escapeHtml(pet.offspring || 'Ninguno')}</span></div>
              <div class="full"><b>Propietario</b><span>${escapeHtml(pet.owner_name)}</span></div>
              <div class="full"><b>Dirección</b><span>${escapeHtml(pet.owner_address || '—')}, ${escapeHtml(pet.owner_city || '')}</span></div>
              ${pet.medical_observations ? `<div class="full"><b>Observaciones</b><span>${escapeHtml(pet.medical_observations)}</span></div>` : ''}
              ${pet.medical_allergies ? `<div class="full"><b>Alergias</b><span>${escapeHtml(pet.medical_allergies)}</span></div>` : ''}
            </div>
            <div class="public-actions">
              <a class="btn btn-primary" href="tel:${pet.owner_phone}">Llamar al propietario</a>
              <a class="btn btn-gold" target="_blank" href="https://wa.me/${(pet.owner_phone || '').replace(/\D/g, '')}?text=${encodeURIComponent('Hola, soy ' + state.user.name + ', vi la información de ' + pet.name + ' en FAM J VET.')}">WhatsApp</a>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
  <p class="faint" style="text-align:center;margin-top:20px;font-size:11px;">FAM J VET Bolivia · Identificación animal</p>`;
  const logout = document.getElementById('btn-esc-logout');
  if (logout) logout.addEventListener('click', () => { state.setUser(null); setToken(null); state.view = 'dashboard'; renderApp(); });
}

/* ---------- Sidebar agrupado ---------- */
const NAV_GROUPS = () => {
  const isAdmin = state.user.role === 'Administrador';
  return [
    { label: 'General', items: [
      { id: 'dashboard', label: 'Panel principal', icon: iconHome, section: 'section-general' },
    ]},
    { label: 'Gestión', items: [
      { id: 'mascotas', label: 'Mascotas', icon: iconPaw, section: 'section-gestion' },
      { id: 'dashboard', label: 'Propietarios', icon: iconUsers, subtab: 'territorio', section: 'section-gestion' },
      { id: 'carnet', label: 'Carnets', icon: iconCard, section: 'section-gestion' },
      { id: 'buscar', label: 'Registros', icon: iconSearch, section: 'section-gestion' },
    ]},
    { label: 'Salud', items: [
      { id: 'salud', label: 'Salud', icon: iconStethoscope, subtab: 'vacunacion', section: 'section-salud' },
    ]},
    { label: 'Administración', items: [
      { id: 'config', label: 'Usuarios', icon: iconUser, adminOnly: true, section: 'section-admin' },
      { id: 'config', label: 'Configuración', icon: iconGear, adminOnly: true, section: 'section-admin' },
    ]},
  ].map(g => ({ ...g, items: g.items.filter(i => !i.adminOnly || isAdmin) }))
};

function sidebarHtml() {
  const tabLabels = Object.fromEntries(DASH_TABS);
  const subLabels = Object.fromEntries(DASH_TABS);
  return `
  <div class="sidebar ${state.sidebarOpen ? 'open' : ''}" id="sidebar">
    <div class="brand-mark">
      ${pawSvg()}
      <div class="name">${escapeHtml(state.getSettings().systemName || 'FAM J VET')}<small>ID BOLIVIA</small></div>
    </div>
    <button class="side-toggle" id="sidebar-toggle" title="Contraer / expandir">${iconChevronDown}</button>
    ${NAV_GROUPS().map(g => `
      <div class="nav-group-label">${g.label}</div>
      ${g.items.map(i => {
    let active = state.view === i.id;
    if (i.subtab && i.id === 'dashboard') active = active && getDashTab() === i.subtab;
    if (i.subtab && i.id === 'salud') active = active && getSaludSubtab() === i.subtab;
    const attr = i.id === 'reportes' ? `data-reporte="1"` : `data-nav="${i.id}"${i.subtab ? ` data-subtab="${i.subtab}"` : ''}`;
    return `<div class="nav-item ${active ? 'active' : ''} ${i.section || ''}" ${attr} title="${escapeHtml(i.label)}">${i.icon}<span>${i.label}</span></div>`;
  }).join('')}
    `).join('')}
    <div class="sidebar-foot">
      <div class="user-chip" id="user-chip" title="Opciones de cuenta">
        <div class="avatar">${state.user.name.split(' ').map(s => s[0]).slice(0, 2).join('')}</div>
        <div class="chip-txt">
          <div class="u-name">${escapeHtml(state.user.name)}</div>
          <div class="u-role">${state.user.role}</div>
        </div>
      </div>
    </div>
  </div>`;
}

/* ---------- Topbar (breadcrumbs, buscador, notificaciones, fecha, perfil) ---------- */
const VIEW_TITLES = () => {
  const dashTab = getDashTab();
  const saludTab = getSaludSubtab();
  const tabLabels = Object.fromEntries(DASH_TABS.concat([['salud', 'Salud'], ['padron', 'Padrón'], ['territorio', 'Territorio'], ['actividad', 'Actividad'], ['alertas', 'Alertas']]));
  const saludLabels = {
    vacunacion: 'Vacunación', desparasitacion: 'Desparasitación', enfermedades: 'Enfermedades',
    esterilizacion: 'Esterilización', historial: 'Historial clínico', agenda: 'Próximas atenciones',
  };
  return {
    dashboard: 'Panel principal', mascotas: 'Mascotas', carnet: 'Carnets', buscar: 'Búsqueda avanzada',
    historial: 'Historial', config: 'Configuración', salud: saludLabels[saludTab] || 'Salud',
  };
};

function notificationsHtml() {
  const { alerts, total } = buildAlerts(state.getPets());
  const top = alerts.slice(0, 5);
  const dotColor = { critica: 'var(--red)', alta: 'var(--gold)', media: 'var(--blue)', informativa: 'var(--text-2)' };
  return `
  <div class="menu-anchor topbar-right-item">
    <button class="btn-icon ${top.length ? 'btn-bell' : ''}" id="btn-bell" title="Notificaciones" aria-haspopup="true">${iconBell}${top.length ? '<span class="biz-dot"></span>' : ''}</button>
    <div class="menu-pop" id="menu-notif">
      <div class="menu-head"><span>Notificaciones</span><span>${total}</span></div>
      <div class="menu-scroll">
        ${top.length ? top.map(a => `
          <div class="notif-row" ${a.petId ? `data-open-pet="${a.petId}"` : ''}>
            <span class="n-dot" style="background:${dotColor[a.priority] || 'var(--text-2)'};"></span>
            <div><div class="n-title">${escapeHtml(a.title)}</div><div class="n-sub">${escapeHtml(a.desc || '')}</div></div>
          </div>`).join('') : `<div class="notif-row"><span class="n-dot" style="background:var(--brand-2);"></span><div><div class="n-title">Todo en orden</div><div class="n-sub">Sin alertas pendientes</div></div></div>`}
        ${alerts.length > top.length ? `<div class="notif-row" style="cursor:default;"><div><div class="n-sub">+ ${alerts.length - top.length} más en el centro de alertas del panel</div></div></div>` : ''}
      </div>
    </div>
  </div>`;
}

function profileMenuHtml() {
  const isAdmin = state.user.role === 'Administrador';
  return `
  <div class="menu-anchor">
    <button class="profile-btn" id="btn-profile" aria-haspopup="true">
      <div class="avatar" style="width:30px;height:30px;">${state.user.name.split(' ').map(s => s[0]).slice(0, 2).join('')}</div>
      <span style="font-size:12.5px; font-weight:600;">${escapeHtml(state.user.name)}</span>
      ${iconChevronDown.replace('<svg', '<svg class="chev"')}
    </button>
    <div class="menu-pop" id="menu-profile">
      <div style="padding:12px 14px; border-bottom:1px solid var(--border);">
        <div style="font-size:13px; font-weight:700;">${escapeHtml(state.user.name)}</div>
        <div style="font-size:11px; color:var(--text-2);">${escapeHtml(state.user.role)}</div>
      </div>
      ${isAdmin ? `<button class="menu-item" data-goto="config">${iconGear} Configuración y usuarios</button>` : ''}
      <button class="menu-item danger" data-action="logout">${iconLogout} Cerrar sesión</button>
    </div>
  </div>`;
}

function topbarHtml() {
  const d = new Date();
  const dateStr = d.toLocaleDateString('es-BO', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace(/^\w/, c => c.toUpperCase());
  const titles = VIEW_TITLES();
  const crumb = titles[state.view] || 'Inicio';
  return `
  <div class="topbar">
    <button class="btn-icon" id="btn-burger" title="Menú">${iconMenu}</button>
    <div class="crumbs">
      <span class="crumb-link" data-nav="dashboard">Inicio</span>
      ${state.view !== 'dashboard' ? `${iconChevronRight}<b>${crumb}</b>` : `${iconChevronRight}<b>Panel principal</b>`}
    </div>
    <div class="search-global">
      ${iconSearch}
      <input id="global-search" placeholder="Buscar mascota, propietario, CI, teléfono o carnet..." value="${escapeHtml(state.search)}" autocomplete="off">
      <kbd>Ctrl K</kbd>
    </div>
    <div class="topbar-right">
      <span class="top-date" title="Fecha actual">${dateStr}</span>
      ${notificationsHtml()}
      ${profileMenuHtml()}
      <button class="btn btn-primary btn-sm" data-action="new-pet">${iconPlus} Nueva mascota</button>
    </div>
  </div>`;
}

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    const i = document.getElementById('global-search');
    if (i) { e.preventDefault(); i.focus(); i.select(); }
  }
});

let escBound = false;
let drawerOpenedByHover = false;
let hoverCloseTimer = null;

function clearHoverCloseTimer() {
  if (hoverCloseTimer) {
    clearTimeout(hoverCloseTimer);
    hoverCloseTimer = null;
  }
}

function setDrawer(open, { temporary = false } = {}) {
  clearHoverCloseTimer();
  state.sidebarOpen = open;
  drawerOpenedByHover = open && temporary;
  document.getElementById('sidebar')?.classList.toggle('open', open);
  document.getElementById('drawer-veil')?.classList.toggle('show', open && !temporary);
  const burger = document.getElementById('btn-burger');
  if (burger) {
    burger.innerHTML = open ? iconX : iconMenu;
    burger.title = open ? 'Cerrar menú' : 'Abrir menú';
  }
}

function scheduleHoverClose() {
  clearHoverCloseTimer();
  if (!drawerOpenedByHover) return;
  hoverCloseTimer = setTimeout(() => {
    if (drawerOpenedByHover) setDrawer(false);
  }, 220);
}

function isDesktop() { return window.innerWidth >= 1024; }

function closeMenus(exceptId) {
  ['menu-notif', 'menu-profile'].forEach(id => {
    if (id !== exceptId) document.getElementById(id)?.classList.remove('show');
  });
  document.getElementById('btn-profile')?.classList.remove('open');
}

function toggleMenu(menuId) {
  const menu = document.getElementById(menuId);
  if (!menu) return;
  const willShow = !menu.classList.contains('show');
  closeMenus(menuId);
  menu.classList.toggle('show', willShow);
  if (menuId === 'menu-profile') document.getElementById('btn-profile')?.classList.toggle('open', willShow);
}

function bindShellEvents() {
  const burger = document.getElementById('btn-burger');
  if (burger) {
    burger.addEventListener('click', () => {
      if (isDesktop()) {
        // Escritorio: contraer / expandir el riel
        document.querySelector('.shell')?.classList.toggle('is-collapsed');
        const collapsed = document.querySelector('.shell')?.classList.contains('is-collapsed');
        try { localStorage.setItem('pli-sidebar-collapsed', collapsed ? '1' : '0'); } catch (_e) { }
      } else {
        setDrawer(!state.sidebarOpen);
      }
    });
  }
  const sideToggle = document.getElementById('sidebar-toggle');
  if (sideToggle) sideToggle.addEventListener('click', () => {
    document.querySelector('.shell')?.classList.toggle('is-collapsed');
    const collapsed = document.querySelector('.shell')?.classList.contains('is-collapsed');
    try { localStorage.setItem('pli-sidebar-collapsed', collapsed ? '1' : '0'); } catch (_e) { }
  });
  document.getElementById('drawer-veil')?.addEventListener('click', () => setDrawer(false));
  const canHoverSidebar = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (canHoverSidebar && !isDesktop()) {
    const hoverZone = document.getElementById('sidebar-hover-zone');
    const sidebar = document.getElementById('sidebar');
    hoverZone?.addEventListener('mouseenter', () => setDrawer(true, { temporary: true }));
    hoverZone?.addEventListener('mouseleave', scheduleHoverClose);
    sidebar?.addEventListener('mouseenter', clearHoverCloseTimer);
    sidebar?.addEventListener('mouseleave', scheduleHoverClose);
  }
  if (!escBound) {
    escBound = true;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.sidebarOpen) setDrawer(false);
      if (e.key === 'Escape') closeMenus(null);
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.menu-anchor')) closeMenus(null);
    });
  }
  // Navegación (incluye crumb Inicio y elementos internos)
  document.body.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      const view = nav.dataset.nav;
      const subtab = nav.dataset.subtab || '';
      navTo(view, subtab);
      return;
    }
    if (e.target.closest('[data-reporte]')) {
      state.view = 'dashboard';
      renderApp();
      setTimeout(() => openReportDialog(), 60);
      return;
    }
    const openPetBtn = e.target.closest('[data-open-pet]');
    if (openPetBtn) {
      if (openPetBtn.dataset.openPet) openPetDetail(openPetBtn.dataset.openPet, 'm');
      closeMenus(null);
      return;
    }
    const goto = e.target.closest('[data-goto]');
    if (goto) { navTo(goto.dataset.goto, ''); return; }
    const themeBtn = e.target.closest('[data-theme-toggle]');
    if (themeBtn) {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      state.applyTheme();
      closeMenus('menu-profile');
      renderApp();
      return;
    }
    const logout = e.target.closest('[data-action="logout"]');
    if (logout) { state.setUser(null); setToken(null); state.view = 'dashboard'; renderApp(); return; }
    const newPet = e.target.closest('[data-action="new-pet"]');
    if (newPet) { openPetModal(); return; }
  });
  // Menú de perfil / notificaciones
  document.getElementById('btn-profile')?.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu('menu-profile'); });
  document.getElementById('btn-bell')?.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu('menu-notif'); });
  const gs = document.getElementById('global-search');
  if (gs) gs.addEventListener('input', () => {
    state.search = gs.value;
    if (state.view !== 'mascotas') { state.view = 'mascotas'; renderApp(); setTimeout(() => { const i = document.getElementById('global-search'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 0); }
  });
}

/* Navegación con subpestañas (dashboard / salud) */
function navTo(view, subtab) {
  state.sidebarOpen = false;
  const viewChanged = state.view !== view;
  if (view === 'dashboard' && subtab) setDashTab(subtab);
  if (view === 'salud' && subtab) setSaludSubtab(subtab);
  state.view = view;
  if (viewChanged) {
    renderApp();
  } else {
    // Solo cambió subtab dentro del mismo view: no reconstruir el shell entero
    renderView();
    // Cerrar drawer en móvil
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('drawer-veil')?.classList.remove('show');
    state.sidebarOpen = false;
    const burger = document.getElementById('btn-burger');
    if (burger) { burger.innerHTML = iconMenu; burger.title = 'Abrir menú'; }
  }
}

export async function renderView() {
  const body = document.getElementById('page-body');
  if (!body) return;
  if (state.view === 'dashboard') body.innerHTML = viewDashboard();
  else if (state.view === 'mascotas') body.innerHTML = viewMascotas();
  else if (state.view === 'carnet') body.innerHTML = viewCarnet();
  else if (state.view === 'buscar') body.innerHTML = viewMascotas(true);
  else if (state.view === 'historial') body.innerHTML = viewHistorial();
  else if (state.view === 'salud') body.innerHTML = viewSalud();
  else if (state.view === 'config') body.innerHTML = state.user.role === 'Administrador' ? viewConfig() : `<p>No autorizado.</p>`;
  bindViewEvents();
  if (state.view === 'dashboard') drawCharts();
  if (state.view === 'carnet') await renderCardPreview();
}

function bindViewEvents() {
  bindPetsEvents();
  bindSaludEvents();
  bindDashboardEvents();
  bindConfigEvents();
  bindCarnetEvents();
}

/* Arranque (al final para que todo el shell esté definido antes) */
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