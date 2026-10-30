/* ============================================================
   PÁGINA PÚBLICA DEL QR — Presentación FAMUVET
   Cuando se escanea el QR de una mascota, se muestra la
   libreta veterinaria digital completa (presentación + salud).
   ============================================================ */

import { api } from '../api.js';
import { state } from '../state.js';
import { escapeHtml, speciesLabel, placeholderPhoto } from '../utils.js';
import { initPresentation, viewPresentation, bindPresentationEvents } from './presentation.js';

let currentPetId = null;

export async function renderPublicPage(id) {
  const app = document.getElementById('app');
  currentPetId = id;

  try {
    // Cargar datos de la mascota y sus registros de salud
    const pet = await api.getPublicPet(id);
    await state.loadHealthRecords(id);

    const s = await api.getSettings().catch(() => ({}));
    state.setSettings(s);

    app.innerHTML = await viewPresentation(id);
    bindPresentationEvents();
  } catch {
    app.innerHTML = `
    <div class="hc-view" style="padding:40px 20px; text-align:center; max-width:440px; margin:0 auto;">
      <div style="font-size:48px; margin-bottom:16px;">🐾</div>
      <h2 style="color:var(--hc-navy); margin-bottom:8px;">No encontrado</h2>
      <p style="color:var(--hc-ink); opacity:.8;">Este código QR no corresponde a ningún registro activo en FAM J VET.</p>
      <a href="#/" class="btn btn-primary" style="margin-top:16px;">Ir al sistema</a>
    </div>`;
  }
}

// Exponer para que app.js pueda llamar si es necesario
export { initPresentation };

// Helper para establecer settings en el estado (usado por la presentación)
export function setPublicSettings(settings) {
  if (state && state.getSettings) {
    const current = state.getSettings();
    state.getSettings = () => ({ ...current, ...settings });
  }
}
