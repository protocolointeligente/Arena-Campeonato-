import { describe, it, expect, vi } from 'vitest';
import { esc, clone, uid } from './utils.js';

describe('esc', () => {
  it('escapes html-significant characters', () => {
    expect(esc('<b>&"\'')).toBe('&lt;b&gt;&amp;&quot;&#39;');
  });

  it('returns empty string for null/undefined', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });

  it('stringifies non-string values', () => {
    expect(esc(42)).toBe('42');
  });

  it('passes through plain text unchanged', () => {
    expect(esc('Equipe A')).toBe('Equipe A');
  });
});

describe('clone', () => {
  it('deep clones nested objects', () => {
    const original = { a: 1, nested: { b: [1, 2, { c: 3 }] } };
    const copy = clone(original);
    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
    expect(copy.nested).not.toBe(original.nested);
    copy.nested.b.push(4);
    expect(original.nested.b).toEqual([1, 2, { c: 3 }]);
  });
});

describe('uid', () => {
  it('matches the legacy id shape: base36 timestamp + 5-char base36 suffix', () => {
    const id = uid();
    expect(id).toMatch(/^[a-z0-9]+[a-z0-9]{5}$/);
  });

  it('produces unique ids across calls', () => {
    const ids = new Set(Array.from({ length: 50 }, () => uid()));
    expect(ids.size).toBe(50);
  });
});
