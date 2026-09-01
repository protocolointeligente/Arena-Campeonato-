import { describe, it, expect } from 'vitest';
import { championshipJSON, parseChampionshipImport } from './exports.js';

describe('championshipJSON', () => {
  it('builds a slugified filename from the championship name and pretty-printed JSON content', () => {
    const state = { nome: 'Copa do Bairro 2026!', formato: 'liga', teams: [{ id: 't1', nome: 'Alfa' }] };
    const result = championshipJSON(state);
    expect(result.filename).toBe('Copa_do_Bairro_2026_.json');
    expect(JSON.parse(result.content)).toEqual(state);
    expect(result.content).toContain('\n');
  });

  it('falls back to "campeonato" when nome is missing', () => {
    const result = championshipJSON({ formato: 'liga' });
    expect(result.filename).toBe('campeonato.json');
  });
});

describe('parseChampionshipImport', () => {
  it('accepts a valid export, assigning a fresh id and defaulting seedNames', () => {
    const original = { id: 'old-id', nome: 'Copa', formato: 'liga', cfg: { winPts: 3 }, teams: [] };
    const result = parseChampionshipImport(JSON.stringify(original));
    expect(result.ok).toBe(true);
    expect(result.value.id).toBeTruthy();
    expect(result.value.id).not.toBe('old-id');
    expect(result.value.nome).toBe('Copa');
    expect(result.value.cfg.seedNames).toEqual([]);
  });

  it('preserves an existing cfg.seedNames instead of overwriting it', () => {
    const original = { formato: 'mata', cfg: { seedNames: ['Brasil'] } };
    const result = parseChampionshipImport(JSON.stringify(original));
    expect(result.value.cfg.seedNames).toEqual(['Brasil']);
  });

  it('rejects malformed JSON', () => {
    expect(parseChampionshipImport('{not json')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects valid JSON missing cfg or formato', () => {
    expect(parseChampionshipImport(JSON.stringify({ nome: 'Copa' }))).toEqual({ ok: false, reason: 'invalid' });
    expect(parseChampionshipImport(JSON.stringify({ cfg: {} }))).toEqual({ ok: false, reason: 'invalid' });
  });

  it('round-trips through championshipJSON, stripping owner identity and collaborators', () => {
    const original = { id: 'orig-id', nome: 'Copa', formato: 'liga', cfg: { winPts: 3 }, teams: [], ownerUid: 'owner-123', ownerEmail: 'owner@example.com', collaborators: [{ email: 'friend@example.com', role: 'admin' }], billing: { plan: 'pro' } };
    const exported = championshipJSON(original);
    const result = parseChampionshipImport(exported.content);
    expect(result.ok).toBe(true);
    expect(result.value.id).not.toBe('orig-id');
    expect(result.value.ownerUid).toBeUndefined();
    expect(result.value.ownerEmail).toBeUndefined();
    expect(result.value.collaborators).toBeUndefined();
    expect(result.value.billing).toBeUndefined();
  });

  it('rejects a non-object cfg without throwing', () => {
    expect(() => parseChampionshipImport(JSON.stringify({ formato: 'liga', cfg: 'not-an-object' }))).not.toThrow();
    expect(parseChampionshipImport(JSON.stringify({ formato: 'liga', cfg: 'not-an-object' }))).toEqual({ ok: false, reason: 'invalid' });
    expect(parseChampionshipImport(JSON.stringify({ formato: 'liga', cfg: null }))).toEqual({ ok: false, reason: 'invalid' });
  });
});



