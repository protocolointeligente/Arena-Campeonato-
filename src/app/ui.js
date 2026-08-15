import { esc } from './utils.js';

let toastTimer = null;

export function ensureUiRoot() {
  if (!document.getElementById('toast')) {
    const toastEl = document.createElement('div');
    toastEl.id = 'toast';
    document.body.appendChild(toastEl);
  }
  if (!document.getElementById('modalBg')) {
    const backdrop = document.createElement('div');
    backdrop.id = 'modalBg';
    backdrop.className = 'modal-overlay';
    backdrop.innerHTML = '<div id="modalBox" class="card modal-card"></div>';
    backdrop.addEventListener('click', (event) => {
      if (event.target.id === 'modalBg') closeModal();
    });
    document.body.appendChild(backdrop);
  }
}

export function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

export function modal(html) {
  document.getElementById('modalBox').innerHTML = html;
  document.getElementById('modalBg').classList.add('open');
}

export function closeModal() {
  document.getElementById('modalBg').classList.remove('open');
}

export function loadingHTML(text) {
  return `<div class="center" style="padding:70px 0"><div class="spin"></div><p class="muted" style="margin-top:14px">${esc(text || 'Carregando...')}</p></div>`;
}
