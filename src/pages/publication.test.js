import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderPublication, shareLink, createQrDataUrl } from './publication.js';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'https://arena.test' });
global.window = dom.window;
global.document = dom.window.document;
global.location = dom.window.location;

describe('publication page', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it('renders public and registration links for the championship', () => {
    const root = document.querySelector('#app');
    renderPublication(root, 'cup-1');
    expect(root.querySelectorAll('[data-copy]')).toHaveLength(2);
    expect(root.querySelector('[data-copy="https://arena.test/publico/cup-1"]')).toBeTruthy();
    expect(root.querySelector('[data-copy="https://arena.test/inscrever/cup-1"]')).toBeTruthy();
  });

  it('copies a link and confirms the action', async () => {
    const root = document.querySelector('#app');
    renderPublication(root, 'cup-1');
    const button = root.querySelector('[data-copy]');
    await button.onclick();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://arena.test/publico/cup-1');
    expect(button.textContent).toBe('Link copiado');
  });

  it('shares through the native share sheet when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share });
    await expect(shareLink('https://arena.test/publico/cup-1')).resolves.toBe('Link compartilhado');
    expect(share).toHaveBeenCalledWith({ title: 'Campeonato ARENA', url: 'https://arena.test/publico/cup-1' });
  });

  it('offers a downloadable social card action', () => {
    const root = document.querySelector('#app');
    renderPublication(root, 'cup-1');
    expect(root.querySelector('[data-social-card]')).toBeTruthy();
  });

  it('exposes QR actions for public and registration links', () => {
    const root = document.querySelector('#app');
    renderPublication(root, 'cup-1');
    expect(root.querySelectorAll('[data-qr]')).toHaveLength(2);
    expect(createQrDataUrl).toBeTypeOf('function');
  });
});
