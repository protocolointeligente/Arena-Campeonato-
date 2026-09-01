// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ensureUiRoot, toast, modal, closeModal, loadingHTML } from './ui.js';

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
});

describe('ensureUiRoot', () => {
  it('creates #toast and #modalBg/#modalBox once', () => {
    ensureUiRoot();
    ensureUiRoot();
    expect(document.querySelectorAll('#toast').length).toBe(1);
    expect(document.querySelectorAll('#modalBg').length).toBe(1);
    expect(document.querySelector('#modalBg #modalBox')).not.toBeNull();
  });

  it('does not remove #app', () => {
    ensureUiRoot();
    expect(document.getElementById('app')).not.toBeNull();
  });
});

describe('toast', () => {
  it('sets the message and shows it', () => {
    vi.useFakeTimers();
    ensureUiRoot();
    toast('Salvo');
    const el = document.getElementById('toast');
    expect(el.textContent).toBe('Salvo');
    expect(el.classList.contains('show')).toBe(true);
    vi.advanceTimersByTime(2400);
    expect(el.classList.contains('show')).toBe(false);
    vi.useRealTimers();
  });
});

describe('modal / closeModal', () => {
  it('opens with the given html and closes', () => {
    ensureUiRoot();
    modal('<h3>Título</h3>');
    expect(document.getElementById('modalBox').innerHTML).toBe('<h3>Título</h3>');
    expect(document.getElementById('modalBg').classList.contains('open')).toBe(true);
    closeModal();
    expect(document.getElementById('modalBg').classList.contains('open')).toBe(false);
  });

  it('closes when the backdrop itself is clicked, not its content', () => {
    ensureUiRoot();
    modal('<h3>Título</h3>');
    document.getElementById('modalBox').click();
    expect(document.getElementById('modalBg').classList.contains('open')).toBe(true);
    document.getElementById('modalBg').click();
    expect(document.getElementById('modalBg').classList.contains('open')).toBe(false);
  });
});

describe('loadingHTML', () => {
  it('renders a spinner with the given text, escaped', () => {
    const html = loadingHTML('<x>');
    expect(html).toContain('&lt;x&gt;');
    expect(html).toContain('class="spin"');
  });

  it('defaults to "Carregando..." when no text given', () => {
    expect(loadingHTML()).toContain('Carregando...');
  });
});



