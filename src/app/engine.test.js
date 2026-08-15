import { describe, it, expect } from 'vitest';
import { roundRobin, buildFixtures, buildGxg, generateActivePhase } from './engine.js';

describe('roundRobin', () => {
  it('pairs every team against every other team exactly once, for an even count', () => {
    const rounds = roundRobin([0, 1, 2, 3]);
    const pairs = rounds.flat().map(([h, a]) => [h, a].sort().join('-'));
    expect(rounds).toHaveLength(3);
    expect(new Set(pairs).size).toBe(6);
  });

  it('inserts a bye for an odd count — one team sits out each round', () => {
    const rounds = roundRobin([0, 1, 2]);
    expect(rounds).toHaveLength(3);
    rounds.forEach((round) => expect(round.length).toBeLessThanOrEqual(1));
  });
});

describe('buildFixtures', () => {
  it('builds one match object per round-robin pairing for a single turno', () => {
    const matches = buildFixtures([0, 1, 2, 3], 1);
    expect(matches).toHaveLength(6);
    matches.forEach((m) => {
      expect(m.id).toBeTruthy();
      expect(m.hg).toBeNull();
      expect(m.ag).toBeNull();
      expect(m.scorers).toEqual([]);
    });
  });

  it('doubles fixtures with reversed home/away for turnos:2', () => {
    const matches = buildFixtures([0, 1, 2, 3], 2);
    expect(matches).toHaveLength(12);
  });
});

describe('buildGxg', () => {
  it('pairs every team in group A against every team in group B once for turnos:1', () => {
    const matches = buildGxg([0, 1], [2, 3], 1);
    expect(matches).toHaveLength(4);
    expect(matches.every((m) => [0, 1].includes(m.home) && [2, 3].includes(m.away))).toBe(true);
  });

  it('adds the reverse leg for turnos:2', () => {
    const matches = buildGxg([0, 1], [2, 3], 2);
    expect(matches).toHaveLength(8);
    expect(matches.some((m) => [2, 3].includes(m.home) && [0, 1].includes(m.away))).toBe(true);
  });
});

describe('generateActivePhase', () => {
  function championship() {
    return {
      teams: [{ id: 't1' }, { id: 't2' }, { id: 't3' }, { id: 't4' }],
      categories: [{ id: 'c1', teams: [{ id: 't1' }, { id: 't2' }, { id: 't3' }, { id: 't4' }], phases: [{ id: 'p1', nome: 'Fase 1', formato: 'liga', cfg: { turnos: 1 }, grupos: [], matches: [], bracket: null }], activePhaseId: 'p1' }],
      activeCategoryId: 'c1',
      formato: 'liga', cfg: { turnos: 1 }, grupos: [], matches: [], bracket: null,
    };
  }

  it('refuses with fewer than 2 participants', () => {
    const state = championship();
    state.teams = [{ id: 't1' }];
    state.categories[0].teams = state.teams;
    const result = generateActivePhase(state);
    expect(result).toEqual({ ok: false, reason: 'A fase precisa ter pelo menos 2 equipes participantes.' });
  });

  it('generates a liga phase\'s matches and writes them onto root state', () => {
    const state = championship();
    const result = generateActivePhase(state);
    expect(result).toEqual({ ok: true });
    expect(state.matches).toHaveLength(6);
    expect(state.categories[0].phases[0].status).toBe('andamento');
  });

  it('generates a grupos phase split into cfg.nGrupos groups', () => {
    const state = championship();
    state.categories[0].phases[0].formato = 'grupos';
    state.categories[0].phases[0].cfg = { turnos: 1, nGrupos: 2 };
    const result = generateActivePhase(state);
    expect(result).toEqual({ ok: true });
    expect(state.grupos).toHaveLength(2);
    expect(state.matches.every((m) => m.grupo === 0 || m.grupo === 1)).toBe(true);
  });

  it('refuses gxg with fewer than 4 participants', () => {
    const state = championship();
    state.teams = state.teams.slice(0, 3);
    state.categories[0].teams = state.teams;
    state.categories[0].phases[0].formato = 'gxg';
    const result = generateActivePhase(state);
    expect(result).toEqual({ ok: false, reason: 'Interzonas precisa de pelo menos 4 equipes.' });
  });

  it('generates a gxg phase split into two groups of teams', () => {
    const state = championship();
    state.categories[0].phases[0].formato = 'gxg';
    const result = generateActivePhase(state);
    expect(result).toEqual({ ok: true });
    expect(state.grupos).toHaveLength(2);
    expect(state.matches).toHaveLength(4);
  });

  it('reports ok:false for an unsupported format (mata — deferred to Phase 3a)', () => {
    const state = championship();
    state.categories[0].phases[0].formato = 'mata';
    const result = generateActivePhase(state);
    expect(result.ok).toBe(false);
  });
});
