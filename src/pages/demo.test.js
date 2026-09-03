// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderDemo } from './demo.js';

vi.mock('../app/router-v2.js', () => ({ navigate: vi.fn() }));

beforeEach(() => { document.body.innerHTML = '<div id="app"></div>'; });

describe('renderDemo', () => {
  it('mostra o botão pro portal público ao vivo do campeonato demo permanente', async () => {
    const { navigate } = await import('../app/router-v2.js');
    const root = document.getElementById('app');
    renderDemo(root);
    const liveBtn = root.querySelector('[data-open-live]');
    expect(liveBtn).not.toBeNull();
    expect(liveBtn.textContent).toMatch(/portal ao vivo/i);
    liveBtn.click();
    expect(navigate).toHaveBeenCalledWith('/c/demo');
  });

  it('tem 7 miniaturas reais com legenda, cada uma abrindo o lightbox', () => {
    const root = document.getElementById('app');
    renderDemo(root);
    const thumbs = root.querySelectorAll('[data-gallery-item]');
    expect(thumbs.length).toBe(7);
    [...thumbs].forEach((thumb) => {
      expect(thumb.dataset.src).toMatch(/^\/landing\//);
      expect(thumb.closest('.demo-tour-item').querySelector('p').textContent.length).toBeGreaterThan(0);
    });
    expect(root.querySelector('dialog[data-lightbox]')).not.toBeNull();
  });

  it('CTA final leva pro cadastro', async () => {
    const { navigate } = await import('../app/router-v2.js');
    const root = document.getElementById('app');
    renderDemo(root);
    root.querySelector('[data-route="/register"]').click();
    expect(navigate).toHaveBeenCalledWith('/register');
  });
});
