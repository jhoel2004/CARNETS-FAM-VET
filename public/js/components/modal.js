export function openModal(size, innerHtml) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'active-modal-overlay';
  overlay.innerHTML = `<div class="modal ${size}">${innerHtml}</div>`;
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
  overlay.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeModal));
}

export function closeModal() {
  const m = document.getElementById('active-modal-overlay');
  if (m) m.remove();
}
