import { describe, it, expect } from 'vitest';
import {
  roundRobin, buildFixtures, buildGxg, generateActivePhase,
  tieObj, nextPow2, makeBracketFromOrdered, resolveTie, winnerOf, loserOf, advanceBracket, findTie,
} from './engine.js';
import { ensureCategories, activeCategory } from './categories.js';
import { addPhase, setPhaseFormat, switchPhase } from './phases.js';

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
    state.formato = 'grupos';
    state.cfg = { turnos: 1, nGrupos: 2 };
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
    state.formato = 'gxg';
    const result = generateActivePhase(state);
    expect(result).toEqual({ ok: false, reason: 'Interzonas precisa de pelo menos 4 equipes.' });
  });

  it('generates a gxg phase split into two groups of teams', () => {
    const state = championship();
    state.categories[0].phases[0].formato = 'gxg';
    state.formato = 'gxg';
    const result = generateActivePhase(state);
    expect(result).toEqual({ ok: true });
    expect(state.grupos).toHaveLength(2);
    expect(state.matches).toHaveLength(4);
  });
});

describe('tieObj', () => {
  it('builds a tie node with both sides and null scores/winner', () => {
    const tie = tieObj('t1', 't2');
    expect(tie.a).toBe('t1');
    expect(tie.b).toBe('t2');
    expect(tie.ag1).toBeNull();
    expect(tie.bg1).toBeNull();
    expect(tie.ag2).toBeNull();
    expect(tie.bg2).toBeNull();
    expect(tie.apen).toBeNull();
    expect(tie.bpen).toBeNull();
    expect(tie.winner).toBeNull();
    expect(tie.id).toBeTruthy();
    expect(tie.scorers).toEqual([]);
  });
});

describe('nextPow2', () => {
  it('rounds up to the next power of 2, or stays if already one', () => {
    expect(nextPow2(1)).toBe(1);
    expect(nextPow2(2)).toBe(2);
    expect(nextPow2(3)).toBe(4);
    expect(nextPow2(4)).toBe(4);
    expect(nextPow2(5)).toBe(8);
    expect(nextPow2(9)).toBe(16);
  });
});

describe('makeBracketFromOrdered', () => {
  it('builds one round of ties for a power-of-2 team count, pairing consecutively', () => {
    const bracket = makeBracketFromOrdered(['t1', 't2', 't3', 't4'], {});
    expect(bracket.rounds).toHaveLength(2);
    expect(bracket.rounds[0]).toHaveLength(2);
    expect(bracket.rounds[0][0].a).toBe('t1');
    expect(bracket.rounds[0][0].b).toBe('t2');
    expect(bracket.rounds[0][1].a).toBe('t3');
    expect(bracket.rounds[0][1].b).toBe('t4');
    expect(bracket.rounds[1]).toHaveLength(1);
    expect(bracket.rounds[1][0].a).toBeNull();
  });

  it('pads with a bye (null) for a non-power-of-2 count', () => {
    const bracket = makeBracketFromOrdered(['t1', 't2', 't3'], {});
    expect(bracket.rounds[0]).toHaveLength(2);
    expect(bracket.rounds[0][1].b).toBeNull();
  });

  it('adds a third-place tie when there are 4+ teams and cfg.terceiro is not explicitly false', () => {
    expect(makeBracketFromOrdered(['t1', 't2', 't3', 't4'], {}).third).toBeDefined();
    expect(makeBracketFromOrdered(['t1', 't2', 't3', 't4'], { terceiro: false }).third).toBeUndefined();
    expect(makeBracketFromOrdered(['t1', 't2'], {}).third).toBeUndefined();
  });
});

describe('resolveTie', () => {
  it('auto-advances a bye (only one side present) with no scores needed', () => {
    const tie = tieObj('t1', null);
    resolveTie(tie, true);
    expect(tie.winner).toBe('t1');
  });

  it('is undecided when both sides are empty', () => {
    const tie = tieObj(null, null);
    resolveTie(tie, true);
    expect(tie.winner).toBeNull();
  });

  it('single-leg: higher ag1/bg1 wins, unfilled stays undecided', () => {
    const tie = tieObj('t1', 't2');
    resolveTie(tie, true);
    expect(tie.winner).toBeNull();
    tie.ag1 = 2; tie.bg1 = 1;
    resolveTie(tie, true);
    expect(tie.winner).toBe('t1');
  });

  it('two-leg: aggregates ag1+ag2 vs bg1+bg2, needs both legs filled', () => {
    const tie = tieObj('t1', 't2');
    tie.ag1 = 1; tie.bg1 = 0;
    resolveTie(tie, false);
    expect(tie.winner).toBeNull(); // leg 2 not filled yet
    tie.ag2 = 0; tie.bg2 = 2;
    resolveTie(tie, false);
    expect(tie.winner).toBe('t2'); // 1+0=1 vs 0+2=2
  });

  it('breaks an aggregate tie with penalties, or stays undecided without them', () => {
    const tie = tieObj('t1', 't2');
    tie.ag1 = 1; tie.bg1 = 1;
    resolveTie(tie, true);
    expect(tie.winner).toBeNull();
    tie.apen = 5; tie.bpen = 4;
    resolveTie(tie, true);
    expect(tie.winner).toBe('t1');
  });
});

describe('winnerOf / loserOf', () => {
  it('winnerOf reads the resolved winner, or null', () => {
    const tie = tieObj('t1', 't2');
    expect(winnerOf(tie)).toBeNull();
    tie.winner = 't1';
    expect(winnerOf(tie)).toBe('t1');
  });

  it('loserOf returns the side that did not win, or null if undecided', () => {
    const tie = tieObj('t1', 't2');
    expect(loserOf(tie)).toBeNull();
    tie.winner = 't1';
    expect(loserOf(tie)).toBe('t2');
  });
});

describe('advanceBracket', () => {
  it('propagates winners round to round and fills the third-place tie from semifinal losers', () => {
    const bracket = makeBracketFromOrdered(['t1', 't2', 't3', 't4'], {});
    const [semi1, semi2] = bracket.rounds[0];
    semi1.ag1 = 2; semi1.bg1 = 0; // t1 beats t2
    semi2.ag1 = 1; semi2.bg1 = 3; // t4 beats t3
    advanceBracket(bracket, { maoUnica: true });
    expect(semi1.winner).toBe('t1');
    expect(semi2.winner).toBe('t4');
    const final = bracket.rounds[1][0];
    expect(final.a).toBe('t1');
    expect(final.b).toBe('t4');
    expect(bracket.third.a).toBe('t2');
    expect(bracket.third.b).toBe('t3');
    final.ag1 = 0; final.bg1 = 1;
    advanceBracket(bracket, { maoUnica: true });
    expect(final.winner).toBe('t4');
  });

  it('leaves later rounds undecided until earlier ones resolve', () => {
    const bracket = makeBracketFromOrdered(['t1', 't2', 't3', 't4'], {});
    advanceBracket(bracket, { maoUnica: true });
    expect(bracket.rounds[1][0].a).toBeNull();
    expect(bracket.rounds[1][0].b).toBeNull();
  });
});

describe('findTie', () => {
  it('finds a tie by id in any round, or the third-place tie, or returns null', () => {
    const bracket = makeBracketFromOrdered(['t1', 't2', 't3', 't4'], {});
    const finalId = bracket.rounds[1][0].id;
    expect(findTie(bracket, finalId)).toBe(bracket.rounds[1][0]);
    expect(findTie(bracket, bracket.third.id)).toBe(bracket.third);
    expect(findTie(bracket, 'ghost')).toBeNull();
    expect(findTie(null, 'x')).toBeNull();
  });
});

describe('generateActivePhase — mata format', () => {
  function championship() {
    return {
      teams: [{ id: 't1' }, { id: 't2' }, { id: 't3' }, { id: 't4' }],
      categories: [{ id: 'c1', teams: [{ id: 't1' }, { id: 't2' }, { id: 't3' }, { id: 't4' }], phases: [{ id: 'p1', nome: 'Fase 1', formato: 'mata', cfg: { turnos: 1 }, grupos: [], matches: [], bracket: null }], activePhaseId: 'p1' }],
      activeCategoryId: 'c1',
      formato: 'mata', cfg: { turnos: 1 }, grupos: [], matches: [], bracket: null,
    };
  }

  it('generates a bracket from the phase participants, in order, no manual seeding', () => {
    const state = championship();
    const result = generateActivePhase(state);
    expect(result).toEqual({ ok: true });
    expect(state.bracket.rounds[0].map((t) => t.a)).toEqual(['t1', 't3']);
    expect(state.bracket.rounds[0].map((t) => t.b)).toEqual(['t2', 't4']);
    expect(state.matches).toEqual([]);
    expect(state.categories[0].phases[0].status).toBe('andamento');
  });

  it('reports ok:false for a genuinely unknown format', () => {
    const state = championship();
    state.categories[0].phases[0].formato = 'bogus';
    state.formato = 'bogus'; // root state.formato is the source of truth — saveRootIntoActive would otherwise clobber the phase override back to 'mata'
    const result = generateActivePhase(state);
    expect(result).toEqual({ ok: false, reason: 'Formato de fase desconhecido.' });
  });
});

describe('cross-module round trip', () => {
  it('composes ensureCategories, phase add/format/switch, and generateActivePhase like championship.js does', () => {
    const state = {
      id: 'ch1',
      teams: [{ id: 't1' }, { id: 't2' }, { id: 't3' }, { id: 't4' }],
      categories: [],
      matches: [],
      formato: 'liga',
      cfg: { turnos: 1 },
    };

    ensureCategories(state);
    expect(state.categories).toHaveLength(1);
    expect(activeCategory(state).phases).toHaveLength(1);

    let result = generateActivePhase(state);
    expect(result).toEqual({ ok: true });
    expect(state.matches).toHaveLength(6);

    addPhase(state, activeCategory(state));
    expect(state.matches).toHaveLength(0);
    expect(activeCategory(state).phases[0].matches).toHaveLength(6);

    setPhaseFormat(state, activeCategory(state), activeCategory(state).activePhaseId, 'grupos');
    result = generateActivePhase(state);
    expect(result).toEqual({ ok: true });
    expect(state.grupos.length).toBeGreaterThan(0);
    expect(state.matches.every((m) => m.grupo != null)).toBe(true);

    switchPhase(state, activeCategory(state), activeCategory(state).phases[0].id);
    expect(state.matches).toHaveLength(6);
    expect(state.formato).toBe('liga');
    expect(activeCategory(state).phases[0].matches).toHaveLength(6);
  });
});
