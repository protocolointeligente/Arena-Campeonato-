import { describe, it, expect } from 'vitest';
import { ensureBranding, setAccent, setBrandImage, clearBrandImage, addSponsor, removeSponsor } from './branding.js';

describe('ensureBranding', () => {
  it('defaults accent and sponsors on a fresh championship', () => {
    const state = {};
    const branding = ensureBranding(state);
    expect(branding.accent).toBe('#2fcf6b');
    expect(state.sponsors).toEqual([]);
  });

  it('keeps an existing accent and an existing sponsors array', () => {
    const state = { branding: { accent: '#ff0000' }, sponsors: [{ id: 's1', name: 'X', url: '', logo: '' }] };
    ensureBranding(state);
    expect(state.branding.accent).toBe('#ff0000');
    expect(state.sponsors).toHaveLength(1);
  });
});

describe('setAccent', () => {
  it('sets the accent color', () => {
    const state = {};
    setAccent(state, '#123456');
    expect(state.branding.accent).toBe('#123456');
  });

  it('falls back to the default when given an empty value', () => {
    const state = {};
    setAccent(state, '');
    expect(state.branding.accent).toBe('#2fcf6b');
  });
});

describe('setBrandImage / clearBrandImage', () => {
  it('sets the logo url', () => {
    const state = {};
    const result = setBrandImage(state, 'logo', 'https://example.com/logo.jpg');
    expect(result.ok).toBe(true);
    expect(state.branding.logo).toBe('https://example.com/logo.jpg');
  });

  it('refuses an invalid kind', () => {
    const state = {};
    const result = setBrandImage(state, 'banner', 'https://example.com/x.jpg');
    expect(result.ok).toBe(false);
  });

  it('clears the cover url', () => {
    const state = { branding: { cover: 'https://example.com/cover.jpg' } };
    clearBrandImage(state, 'cover');
    expect(state.branding.cover).toBe('');
  });
});

describe('addSponsor', () => {
  it('appends a trimmed-name sponsor with a generated id', () => {
    const state = {};
    const result = addSponsor(state, { name: '  Acme  ', url: 'acme.com', logo: 'https://x/logo.jpg' });
    expect(result.ok).toBe(true);
    expect(state.sponsors).toHaveLength(1);
    expect(state.sponsors[0]).toMatchObject({ name: 'Acme', url: 'acme.com', logo: 'https://x/logo.jpg' });
    expect(state.sponsors[0].id).toBeTruthy();
  });

  it('refuses a blank name without mutating sponsors', () => {
    const state = {};
    const result = addSponsor(state, { name: '  ' });
    expect(result.ok).toBe(false);
    expect(state.sponsors).toHaveLength(0);
  });
});

describe('removeSponsor', () => {
  it('removes a sponsor by id', () => {
    const state = { sponsors: [{ id: 's1', name: 'A' }, { id: 's2', name: 'B' }] };
    const result = removeSponsor(state, 's1');
    expect(result.ok).toBe(true);
    expect(state.sponsors).toEqual([{ id: 's2', name: 'B' }]);
  });

  it('returns ok:false when the sponsor is not found', () => {
    const state = { sponsors: [{ id: 's1', name: 'A' }] };
    const result = removeSponsor(state, 'ghost');
    expect(result.ok).toBe(false);
  });
});
