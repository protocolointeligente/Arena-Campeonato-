import { describe, it, expect } from 'vitest';
import { fmtDateBR, brl, ageFrom, slugify, isValidSlug } from './format.js';

describe('fmtDateBR', () => {
  it('converts ISO date to DD/MM/YYYY', () => {
    expect(fmtDateBR('2026-08-15')).toBe('15/08/2026');
  });

  it('returns empty string for falsy input', () => {
    expect(fmtDateBR('')).toBe('');
    expect(fmtDateBR(null)).toBe('');
  });

  it('passes through values that are not ISO dates', () => {
    expect(fmtDateBR('15/08/2026')).toBe('15/08/2026');
  });
});

describe('brl', () => {
  it('matches Intl BRL currency formatting', () => {
    expect(brl(150)).toBe(Number(150).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    expect(brl(150)).toContain('150,00');
    expect(brl(150)).toContain('R$');
  });

  it('handles zero and decimals', () => {
    expect(brl(0)).toContain('0,00');
    expect(brl(19.9)).toContain('19,90');
  });
});

describe('ageFrom', () => {
  it('returns null for falsy or invalid input', () => {
    expect(ageFrom('')).toBeNull();
    expect(ageFrom(null)).toBeNull();
    expect(ageFrom('not-a-date')).toBeNull();
  });

  it('computes full years elapsed, accounting for birthday not yet reached this year', () => {
    const now = new Date();
    const notYetBirthday = new Date(now.getFullYear() - 10, now.getMonth() + 1, now.getDate());
    // if month+1 overflows into next year, this test's premise breaks — guard it
    if (notYetBirthday.getFullYear() === now.getFullYear() - 10) {
      const iso = notYetBirthday.toISOString().slice(0, 10);
      expect(ageFrom(iso)).toBe(9);
    }
  });

  it('computes exact age when birthday already passed this year', () => {
    const now = new Date();
    const alreadyHadBirthday = new Date(now.getFullYear() - 20, 0, 1);
    const iso = alreadyHadBirthday.toISOString().slice(0, 10);
    expect(ageFrom(iso)).toBe(20);
  });
});

describe('slugify', () => {
  it('lowercases, strips accents, and hyphenates spaces', () => {
    expect(slugify('Copa do Bairro 2026')).toBe('copa-do-bairro-2026');
    expect(slugify('Campeonato Municipal — Várzea')).toBe('campeonato-municipal-varzea');
  });

  it('collapses repeated separators and trims leading/trailing hyphens', () => {
    expect(slugify('  --Copa!!  Verão--  ')).toBe('copa-verao');
  });

  it('returns an empty string for empty/falsy input', () => {
    expect(slugify('')).toBe('');
    expect(slugify(null)).toBe('');
  });

  it('truncates to 60 characters', () => {
    expect(slugify('a'.repeat(100)).length).toBe(60);
  });
});

describe('isValidSlug', () => {
  it('accepts a well-formed slug', () => {
    expect(isValidSlug('copa-do-bairro-2026')).toBe(true);
    expect(isValidSlug('abc')).toBe(true);
  });

  it('rejects too short, too long, uppercase, spaces, or leading/trailing hyphens', () => {
    expect(isValidSlug('ab')).toBe(false);
    expect(isValidSlug('a'.repeat(61))).toBe(false);
    expect(isValidSlug('Copa-2026')).toBe(false);
    expect(isValidSlug('copa 2026')).toBe(false);
    expect(isValidSlug('-copa')).toBe(false);
    expect(isValidSlug('copa-')).toBe(false);
    expect(isValidSlug('')).toBe(false);
  });
});



