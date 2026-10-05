import { escapeHtml } from '../utils.js';

let state = null;

export function initHistory(s) {
  state = s;
}

export function viewHistorial() {
  const hist = state.getHistory();
  return `
  <div class="page-head"><div><h1>Historial</h1><p>Registro de creaciones, ediciones, impresiones y descargas del sistema.</p></div></div>
  <div class="table-wrap">
    ${hist.length ? `<table><thead><tr><th>Acción</th><th>Entidad</th><th>Usuario</th><th>Fecha</th><th>Hora</th></tr></thead>
    <tbody>${hist.map(h => `<tr><td><b>${h.action}</b></td><td>${escapeHtml(h.entity)}</td><td>${escapeHtml(h.user)}</td><td>${h.date}</td><td>${h.time}</td></tr>`).join('')}</tbody></table>`
      : `<div class="empty-state"><div><b>Sin actividad</b><p>Las acciones del sistema aparecerán aquí.</p></div></div>`}
  </div>`;
}
