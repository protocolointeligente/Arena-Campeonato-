import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' });
global.window = dom.window;
global.document = dom.window.document;
let store = {};
global.localStorage = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, value) => { store[key] = String(value); },
  removeItem: (key) => { delete store[key]; },
};

const { applyTheme, toggleTheme } = await import('./theme.js');

describe('theme', () => {
  beforeEach(() => { store = {}; document.documentElement.removeAttribute('data-theme'); });

  it('applies the theme to the DOM without recursing infinitely', () => {
    expect(() => applyTheme('dark')).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('arena_theme')).toBe('dark');
  });

  it('toggles between light and dark', () => {
    applyTheme('light');
    toggleTheme();
    expect(document.documentElement.dataset.theme).toBe('dark');
    toggleTheme();
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
