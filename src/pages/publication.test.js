import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

const { getPublicSlug } = vi.hoisted(() => ({ getPublicSlug: vi.fn().mockResolvedValue('') }));
vi.mock('../services/championships.js', () => ({ getPublicSlug }));

const { renderPublication, shareLink, createQrDataUrl } = await import('./publication.js');

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'https://arena.test' });
global.window = dom.window;
global.document = dom.window.document;
global.location = dom.window.location;

describe('publication page', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    getPublicSlug.mockReset().mockResolvedValue('');
  });

  it('renders public and registration links for the championship', async () => {
    const root = document.querySelector('#app');
    await renderPublication(root, 'cup-1');
    expect(root.querySelectorAll('[data-copy]')).toHaveLength(3);
    expect(root.querySelector('[data-copy="https://arena.test/publico/cup-1"]')).toBeTruthy();
    expect(root.querySelector('[data-copy="https://arena.test/inscrever/cup-1"]')).toBeTruthy();
  });

  it('offers a copyable iframe embed snippet for the standings widget', async () => {
    const root = document.querySelector('#app');
    await renderPublication(root, 'cup-1');
    const embedCode = root.querySelector('.card:nth-of-type(3) code')?.textContent || '';
    expect(embedCode).toContain('<iframe');
    expect(embedCode).toContain('https://arena.test/embed/cup-1');
    expect(root.querySelector('[data-open="https://arena.test/embed/cup-1"]')).toBeTruthy();
  });

  it('uses the custom /c/<slug> link instead of /publico/<id> once one is configured', async () => {
    getPublicSlug.mockResolvedValue('copa-do-bairro-2026');
    const root = document.querySelector('#app');
    await renderPublication(root, 'cup-1');
    expect(root.querySelector('[data-copy="https://arena.test/c/copa-do-bairro-2026"]')).toBeTruthy();
    expect(root.querySelector('[data-copy="https://arena.test/publico/cup-1"]')).toBeFalsy();
  });

  it('falls back to the /publico/<id> link if the slug lookup fails', async () => {
    getPublicSlug.mockRejectedValue(new Error('offline'));
    const root = document.querySelector('#app');
    await renderPublication(root, 'cup-1');
    expect(root.querySelector('[data-copy="https://arena.test/publico/cup-1"]')).toBeTruthy();
  });

  it('copies a link and confirms the action', async () => {
    const root = document.querySelector('#app');
    await renderPublication(root, 'cup-1');
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

  it('offers a downloadable social card action', async () => {
    const root = document.querySelector('#app');
    await renderPublication(root, 'cup-1');
    expect(root.querySelector('[data-social-card]')).toBeTruthy();
  });

  it('exposes QR actions for public and registration links', async () => {
    const root = document.querySelector('#app');
    await renderPublication(root, 'cup-1');
    expect(root.querySelectorAll('[data-qr]')).toHaveLength(2); // embed widget has no QR of its own
    expect(createQrDataUrl).toBeTypeOf('function');
  });
});
