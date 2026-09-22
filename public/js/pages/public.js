import { api } from '../api.js';
import { statusBadge, speciesLabel, placeholderPhoto, escapeHtml } from '../utils.js';

export async function renderPublicPage(id) {
  const app = document.getElementById('app');
  try {
    const pet = await api.getPublicPet(id);
    const lost = pet.status === 'Perdido';
    app.innerHTML = `
    <div class="public-page">
      <a href="#/" style="position:absolute; top:14px; left:14px; color:#fff; opacity:.7; text-decoration:none; font-size:13px; z-index:10;">← Volver</a>
      <div class="public-card">
        ${lost ? `<div class="public-alert">🚨 ¡ESTA MASCOTA ESTÁ PERDIDA! — POR FAVOR CONTACTAR AL PROPIETARIO</div>` : ''}
        <div class="public-photo-wrap">
          <img class="public-photo" src="${pet.photo || placeholderPhoto()}" alt="${escapeHtml(pet.name)}">
        </div>
        <div class="public-body">
          <h1>${escapeHtml(pet.name)}</h1>
          <div class="sub">${speciesLabel(pet.species)} · ${escapeHtml(pet.breed || 'Raza no especificada')} · N° ${pet.carnet_number}</div>
          <div style="margin-top:10px;">${statusBadge(pet.status)}</div>
          <div class="public-grid">
            <div><b>Sexo</b><span>${pet.sex || '—'}</span></div>
            <div><b>Color</b><span>${escapeHtml(pet.color || '—')}</span></div>
            <div><b>Peso</b><span>${pet.weight ? pet.weight + ' kg' : '—'}</span></div>
            <div><b>Vacunado</b><span>${pet.medical_vaccinated === 'Sí' ? '✅ Sí' : '❌ No'}</span></div>
            <div class="full" style="grid-column:1/-1;"><b>Propietario</b><span>${escapeHtml(pet.owner_name)}</span></div>
            <div class="full" style="grid-column:1/-1;"><b>Dirección</b><span>${escapeHtml(pet.owner_address || '—')}, ${escapeHtml(pet.owner_city || '')}</span></div>
            ${pet.medical_observations ? `<div class="full" style="grid-column:1/-1;"><b>Observaciones médicas</b><span>${escapeHtml(pet.medical_observations)}</span></div>` : ''}
            ${pet.medical_allergies ? `<div class="full" style="grid-column:1/-1;"><b>Alergias</b><span>${escapeHtml(pet.medical_allergies)}</span></div>` : ''}
          </div>
          <div class="public-actions">
            <a class="btn btn-primary" href="tel:${pet.owner_phone}">📞 Llamar al propietario</a>
            <a class="btn btn-gold" target="_blank" href="https://wa.me/${(pet.owner_phone || '').replace(/\D/g, '')}?text=${encodeURIComponent('Hola, encontré a ' + pet.name + ' (carnet ' + pet.carnet_number + '). Vi su información en Pet Llama ID.')}">💬 WhatsApp</a>
          </div>
          <p class="faint" style="margin-top:16px; font-size:11px;">Verificado por Pet Llama ID Bolivia · Documento de identificación animal</p>
        </div>
      </div>
    </div>`;
  } catch {
    app.innerHTML = `<div class="public-page"><div class="public-card"><div class="public-body" style="padding-top:40px;"><h1>No encontrado</h1><p class="sub">Este código QR no corresponde a ningún registro activo en Pet Llama ID.</p><a href="#/" class="btn btn-primary" style="margin-top:18px;">Ir al sistema</a></div></div></div>`;
  }
}
