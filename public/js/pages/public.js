/* ============================================================
   PÁGINA PÚBLICA DEL QR — Presentación FAMUVET
   Cuando se escanea el QR de una mascota, se muestra la
   libreta veterinaria digital completa (presentación + salud).
   ============================================================ */

import { api } from '../api.js';
import { state } from '../state.js';
import { initPresentation, viewPresentation, bindPresentationEvents } from './presentation.js';

let currentPetId = null;

export async function renderPublicPage(id) {
  const app = document.getElementById('app');
  currentPetId = id;

  // Aplicar fondo del body para la vista pública
  document.body.style.background = 'none';

  try {
    // La consulta pública no requiere token: el QR debe funcionar sin iniciar sesión.
    const pet = await api.getPublicPet(id);
    await Promise.all([
      state.loadPublicHealthRecords(id),
      api.getSettings().catch(() => ({})).then(s => state.setSettings(s)),
    ]);

    app.innerHTML = await viewPresentation(pet.id || id);
    bindPresentationEvents();
  } catch (e) {
    console.error('Error cargando mascota pública:', e);
    app.innerHTML = `
    <div class="hc-view" style="text-align:center;">
      <div>
        <div style="font-size:64px; margin-bottom:16px;">🐾</div>
        <h2 style="color:var(--navy); margin-bottom:8px; font-family:'Barlow Condensed',sans-serif; font-size:28px;">No encontrado</h2>
        <p style="color:var(--ink); opacity:.8; font-family:Barlow,sans-serif; max-width:300px; margin:0 auto 20px;">
          Este código QR no corresponde a ningún registro activo en FAMUVET.
        </p>
        <a href="#/" style="color:var(--blue); text-decoration:none; font-family:Barlow,sans-serif; font-weight:600;">
          ← Ir al sistema
        </a>
      </div>
    </div>`;
  }
}

// Exponer para que app.js pueda llamar si es necesario
export { initPresentation };

// Helper para establecer settings en el estado (usado por la presentación)
export function setPublicSettings(settings) {
  if (state && state.setSettings) {
    state.setSettings({ ...state.getSettings(), ...settings });
  }
}
