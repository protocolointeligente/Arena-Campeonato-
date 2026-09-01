import { esc } from '../app/utils.ts';

let toastContainer = null;
let toastId = 0;

function ensureContainer() {
  if (toastContainer) {return toastContainer;}
  
  toastContainer = document.createElement('div');
  toastContainer.id = 'toast-container';
  toastContainer.setAttribute('role', 'region');
  toastContainer.setAttribute('aria-label', 'Notificações');
  toastContainer.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastContainer);
  
  return toastContainer;
}

export function toast(message, { type = 'info', duration = 3000, action } = {}) {
  const container = ensureContainer();
  const id = `toast-${++toastId}`;
  
  const toastEl = document.createElement('div');
  toastEl.id = id;
  toastEl.className = `toast toast-${type}`;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  
  let html = `<span class="toast-message">${esc(message)}</span>`;
  
  if (action) {
    html += `<button type="button" class="toast-action" data-toast-action>${esc(action.label)}</button>`;
  }
  
  html += `<button type="button" class="toast-close" aria-label="Fechar notificação" data-toast-close>✕</button>`;
  
  toastEl.innerHTML = html;
  container.appendChild(toastEl);
  
  // Animate in
  requestAnimationFrame(() => toastEl.classList.add('show'));
  
  const removeToast = () => {
    toastEl.classList.remove('show');
    toastEl.addEventListener('transitionend', () => toastEl.remove(), { once: true });
  };
  
  const closeBtn = toastEl.querySelector('[data-toast-close]');
  if (closeBtn) {closeBtn.addEventListener('click', removeToast);}
  
  if (action) {
    const actionBtn = toastEl.querySelector('[data-toast-action]');
    actionBtn.addEventListener('click', () => {
      action.onClick();
      removeToast();
    });
  }
  
  if (duration > 0) {
    setTimeout(removeToast, duration);
  }
  
  return { id, close: removeToast };
}

export function toastSuccess(message, options) { return toast(message, { ...options, type: 'success' }); }
export function toastError(message, options) { return toast(message, { ...options, type: 'error' }); }
export function toastWarning(message, options) { return toast(message, { ...options, type: 'warning' }); }
export function toastInfo(message, options) { return toast(message, { ...options, type: 'info' }); }

