import { describe, it, expect } from 'vitest';
import { computeStandings, standingsForPhase, qualifiedFromPhase, applyProgression, scorerRanking, cardRanking, standsToRows } from './standings.js';

const teams = [{ id: 'a', nome: 'Alfa' }, { id: 'b', nome: 'Beta' }, { id: 'c', nome: 'Gama' }];

describe('computeStandings', () => {
  it('computes points/goals from finished matches, defaulting to 3/1/0', () => {
    const matches = [
      { home: 0, away: 1, hg: 2, ag: 1 },
      { home: 1, away: 2, hg: 0, ag: 0 },
      { home: 0, away: 2, hg: null, ag: null },
    ];
    const st = computeStandings(teams, [0, 1, 2], matches, {});
    const byIdx = Object.fromEntries(st.map((s) => [s.team, s]));
    expect(byIdx[0]).toMatchObject({ P: 3, J: 1, V: 1, E: 0, D: 0, GP: 2, GC: 1, SG: 1 });
    expect(byIdx[1]).toMatchObject({ P: 1, J: 2, V: 0, E: 1, D: 1 });
    expect(byIdx[2]).toMatchObject({ P: 1, J: 1, V: 0, E: 1, D: 0 });
  });

  it('sorts by the configured criteria order', () => {
    const matches = [{ home: 0, away: 2, hg: 3, ag: 3 }, { home: 1, away: 2, hg: 1, ag: 1 }];
    const st = computeStandings(teams, [0, 1, 2], matches, { criterios: ['GP'] });
    expect(st.map((s) => s.team)).toEqual([2, 0, 1]);
  });

  it('applies confronto direto as the final tiebreak when every prior criterion ties', () => {
    const four = [...teams, { id: 'd', nome: 'Delta' }];
    const matches = [
      { home: 0, away: 1, hg: 2, ag: 0 },
      { home: 0, away: 2, hg: 0, ag: 2 },
      { home: 1, away: 3, hg: 2, ag: 0 },
    ];
    const st = computeStandings(four, [0, 1, 2, 3], matches, {});
    expect(st.map((s) => s.team)).toEqual([2, 0, 1, 3]);
  });

  it('computes DISC as negative fair-play points from yellow/red events', () => {
    const matches = [{ home: 0, away: 1, hg: 0, ag: 0, events: [{ type: 'yellow', teamId: 'a' }, { type: 'red', teamId: 'b' }] }];
    const st = computeStandings(teams.slice(0, 2), [0, 1], matches, { discYellow: 1, discRed: 5 });
    const byIdx = Object.fromEntries(st.map((s) => [s.team, s]));
    expect(byIdx[0].DISC).toBe(-1);
    expect(byIdx[1].DISC).toBe(-5);
  });

  it('returns an empty array for empty idxs', () => {
    expect(computeStandings(teams, [], [], {})).toEqual([]);
  });
});

describe('standingsForPhase', () => {
  it("uses the phase's own matches and cfg when no explicit matches are passed", () => {
    const state = { teams };
    const phase = { matches: [{ home: 0, away: 1, hg: 1, ag: 0 }], cfg: { winPts: 2 } };
    const st = standingsForPhase(state, phase, [0, 1]);
    expect(st.find((s) => s.team === 0).P).toBe(2);
  });

  it('accepts an explicit matches override, used for per-group slices', () => {
    const state = { teams, cfg: { winPts: 3 } };
    const phase = { matches: [], cfg: null };
    const st = standingsForPhase(state, phase, [0, 1], [{ home: 0, away: 1, hg: 1, ag: 0 }]);
    expect(st.find((s) => s.team === 0).P).toBe(3);
  });
});

describe('qualifiedFromPhase', () => {
  it('overall mode: top N by the phase standings, across all its participants', () => {
    const state = { teams };
    const phase = { formato: 'liga', matches: [{ home: 0, away: 1, hg: 2, ag: 0 }, { home: 1, away: 2, hg: 0, ag: 0 }], cfg: {}, participantTeamIds: null };
    expect(qualifiedFromPhase(state, phase, 'overall', 1)).toEqual(['a']);
  });

  it('perGroup mode: top N from each grupos-phase group', () => {
    const state = { teams };
    const phase = { formato: 'grupos', grupos: [['a', 'b'], ['c']], matches: [{ home: 0, away: 1, hg: 3, ag: 0, grupo: 0 }], cfg: {} };
    expect(qualifiedFromPhase(state, phase, 'perGroup', 1)).toEqual(['a', 'c']);
  });

  it('mata format: the bracket champion, if decided', () => {
    const state = { teams };
    const phase = { formato: 'mata', bracket: { rounds: [[{ a: 'a', b: 'b', winner: 'a' }]] } };
    expect(qualifiedFromPhase(state, phase, 'overall', 1)).toEqual(['a']);
  });

  it('mata format: empty when the final has no winner yet', () => {
    const state = { teams };
    const phase = { formato: 'mata', bracket: { rounds: [[{ a: 'a', b: 'b', winner: null }]] } };
    expect(qualifiedFromPhase(state, phase, 'overall', 1)).toEqual([]);
  });
});

describe('applyProgression', () => {
  function setup() {
    const src = { id: 'p1', formato: 'liga', matches: [{ home: 0, away: 1, hg: 2, ag: 0 }], cfg: {}, progression: { targetPhaseId: 'p2', mode: 'overall', count: 1 } };
    const target = { id: 'p2', nome: 'Fase 2', formato: 'liga', grupos: ['stale'], matches: ['stale'], bracket: { rounds: [] }, status: 'planejada' };
    const category = { id: 'c1', teams: [], phases: [src, target], activePhaseId: 'p1' };
    const state = { teams, activeCategoryId: 'c1', categories: [category], formato: 'liga', cfg: {}, matches: src.matches, grupos: [], bracket: null };
    return { state, category };
  }

  it('sends qualifiers to the target phase and switches to it', () => {
    const { state, category } = setup();
    const result = applyProgression(state, category, 'p1');
    expect(result).toEqual({ ok: true, count: 1, targetName: 'Fase 2' });
    const target = category.phases[1];
    expect(target.participantTeamIds).toEqual(['a']);
    expect(target.matches).toEqual([]);
    expect(target.grupos).toEqual([]);
    expect(target.bracket).toBeNull();
    expect(category.activePhaseId).toBe('p2');
  });

  it('reports incomplete without applying when the source phase still has pending matches, unless forced', () => {
    const { state, category } = setup();
    category.phases[0].matches.push({ home: 0, away: 1, hg: null, ag: null });
    expect(applyProgression(state, category, 'p1')).toEqual({ ok: false, reason: 'incomplete' });
    expect(category.phases[1].participantTeamIds).toBeUndefined();
    const forced = applyProgression(state, category, 'p1', { force: true });
    expect(forced.ok).toBe(true);
  });

  it('reports no-target when the source phase has no progression configured', () => {
    const { state, category } = setup();
    category.phases[0].progression = null;
    expect(applyProgression(state, category, 'p1')).toEqual({ ok: false, reason: 'no-target' });
  });

  it('reports target-missing when the configured target phase no longer exists', () => {
    const { state, category } = setup();
    category.phases[0].progression.targetPhaseId = 'ghost';
    expect(applyProgression(state, category, 'p1')).toEqual({ ok: false, reason: 'target-missing' });
  });

  it('reports no-qualifiers when standings produce nobody to send', () => {
    const { state, category } = setup();
    category.phases[0].formato = 'grupos';
    category.phases[0].grupos = [];
    category.phases[0].progression.mode = 'perGroup';
    expect(applyProgression(state, category, 'p1')).toEqual({ ok: false, reason: 'no-qualifiers' });
  });
});

describe('scorerRanking', () => {
  it('counts goal events per athlete across matches and bracket ties, sorted by goals desc', () => {
    const state = {
      teams: [{ id: 'a', nome: 'Alfa', roster: [{ id: 'ath1', nome: 'Zeca' }] }],
      matches: [{ id: 'm1', events: [{ type: 'goal', athleteId: 'ath1', teamId: 'a' }, { type: 'goal', athleteId: 'ath1', teamId: 'a' }] }],
      bracket: { rounds: [[{ id: 't1', events: [{ type: 'goal', athleteId: null, name: 'Anônimo', teamId: 'a' }] }]] },
    };
    const rows = scorerRanking(state);
    expect(rows[0]).toMatchObject({ athleteId: 'ath1', name: 'Zeca', goals: 2 });
    expect(rows[1]).toMatchObject({ name: 'Anônimo', goals: 1 });
  });

  it('returns an empty list when no events exist yet', () => {
    expect(scorerRanking({ matches: [{ id: 'm1' }] })).toEqual([]);
  });
});

describe('cardRanking', () => {
  it('counts yellow/red cards per athlete, sorted by a red-weighted score', () => {
    const state = {
      teams: [{ id: 'a', nome: 'Alfa', roster: [{ id: 'ath1', nome: 'Zeca' }, { id: 'ath2', nome: 'Duda' }] }],
      matches: [{ id: 'm1', events: [{ type: 'red', athleteId: 'ath1', teamId: 'a' }, { type: 'yellow', athleteId: 'ath2', teamId: 'a' }] }],
    };
    const rows = cardRanking(state);
    expect(rows[0]).toMatchObject({ athleteId: 'ath1', y: 0, r: 1 });
    expect(rows[1]).toMatchObject({ athleteId: 'ath2', y: 1, r: 0 });
  });

  it('excludes athletes with zero cards and ignores non-card event types', () => {
    const state = { matches: [{ id: 'm1', events: [{ type: 'goal', athleteId: 'x', teamId: 'a' }] }] };
    expect(cardRanking(state)).toEqual([]);
  });
});

describe('standsToRows', () => {
  it('formats standings rows as flat arrays for tabular export', () => {
    const st = [{ team: 0, P: 9, J: 3, V: 3, E: 0, D: 0, GP: 6, GC: 1, SG: 5, pct: 100 }];
    expect(standsToRows(teams, st)).toEqual([[1, 'Alfa', 9, 3, 3, 0, 0, 6, 1, '+5', '100.0']]);
  });
});
