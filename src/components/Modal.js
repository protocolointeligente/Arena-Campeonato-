import { esc } from '../app/utils.ts';

const modalStack = [];
let overlay = null;
let previousActiveElement = null;

function ensureOverlay() {
  if (overlay) {return overlay;}
  
  overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = '<div class="modal-container"><div class="modal-content"></div></div>';
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });
  
  // Focus trap for overlay
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      const focusableElements = overlay.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length === 0) {return;}
      
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  
  document.body.appendChild(overlay);
  return overlay;
}

export function openModal({ title, content, size = 'md', closeOnEscape = true, onClose, footer }) {
  const overlay = ensureOverlay();
  const container = overlay.querySelector('.modal-container');
  const modalContent = overlay.querySelector('.modal-content');
  
  // Save previously focused element
  previousActiveElement = document.activeElement;
  
  const modalId = `modal-${Date.now()}`;
  modalStack.push({ id: modalId, onClose, overlay, previousActiveElement });
  
  container.className = `modal-container modal-${size}`;
  
  let html = '';
  if (title) {
    html += `
      <div class="modal-header">
        <h2 class="modal-title">${esc(title)}</h2>
        <button type="button" class="modal-close" aria-label="Fechar modal" data-modal-close>✕</button>
      </div>
    `;
  }
  
  html += `<div class="modal-body">${content}</div>`;
  
  if (footer) {
    html += `<div class="modal-footer">${footer}</div>`;
  }
  
  modalContent.innerHTML = html;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  
  const closeBtn = modalContent.querySelector('[data-modal-close]');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeModal(modalId));
  }
  
  const handleEscape = (e) => {
    if (e.key === 'Escape' && closeOnEscape && modalStack[modalStack.length - 1]?.id === modalId) {
      closeModal(modalId);
    }
  };
  
  document.addEventListener('keydown', handleEscape);
  
  const modalInstance = modalStack.find(m => m.id === modalId);
  if (modalInstance) {
    modalInstance.escapeHandler = handleEscape;
  }
  
  // Focus management - focus first focusable element
  requestAnimationFrame(() => {
    const focusableElements = modalContent.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements.length) {
      focusableElements[0].focus();
    } else {
      // If no focusable elements, focus the container for screen readers
      container.setAttribute('tabindex', '-1');
      container.focus();
    }
  });
  
  return modalId;
}

export function closeModal(modalId = null) {
  if (!modalStack.length) {return;}
  
  const index = modalId 
    ? modalStack.findIndex(m => m.id === modalId)
    : modalStack.length - 1;
  
  if (index === -1) {return;}
  
  const modal = modalStack[index];
  
  if (modal.escapeHandler) {
    document.removeEventListener('keydown', modal.escapeHandler);
  }
  
  if (modal.onClose) {modal.onClose();}
  
  modalStack.splice(index, 1);
  
  if (!modalStack.length) {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    // Restore focus to previously active element
    if (modal.previousActiveElement && typeof modal.previousActiveElement.focus === 'function') {
      modal.previousActiveElement.focus();
    }
  } else {
    // Focus the new top modal's first element
    const topModal = modalStack[modalStack.length - 1];
    const topContent = topModal.overlay.querySelector('.modal-content');
    if (topContent) {
      const focusableElements = topContent.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length) {
        focusableElements[0].focus();
      }
    }
  }
  
  return true;
}

export function closeAllModals() {
  while (modalStack.length) {
    closeModal();
  }
}

export function Modal({ isOpen, title, children, size = 'md', onClose, footer, closeOnEscape = true }) {
  if (!isOpen) {return null;}
  
  const modalId = openModal({ title, content: children, size, onClose, footer, closeOnEscape });
  
  return {
    close: () => closeModal(modalId),
    id: modalId,
  };
}

export function getActiveModal() {
  return modalStack[modalStack.length - 1] || null;
}

