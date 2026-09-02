import { describe, it, expect } from 'vitest';
import { shuffle, startDraw, revealNext, applyDraw, cancelDraw } from './draw.js';

function baseState(overrides = {}) {
  const teams = [{ id: 't1', nome: 'A' }, { id: 't2', nome: 'B' }, { id: 't3', nome: 'C' }, { id: 't4', nome: 'D' }, { id: 't5', nome: 'E' }];
  return {
    teams,
    formato: 'grupos',
    grupos: [],
    cfg: { nGrupos: 2 },
    activeCategoryId: 'c1',
    categories: [{ id: 'c1', nome: 'Principal', teams, activePhaseId: 'p1', phases: [{ id: 'p1', nome: 'Fase 1', formato: 'grupos', cfg: { nGrupos: 2 }, grupos: [], matches: [], participantTeamIds: null, progression: null }] }],
    ...overrides,
  };
}

describe('shuffle', () => {
  it('returns every original element exactly once, in some order', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input);
    expect(result).toHaveLength(5);
    expect(result.slice().sort()).toEqual(input.slice().sort());
  });

  it('does not mutate the input array', () => {
    const input = [1, 2, 3];
    shuffle(input);
    expect(input).toEqual([1, 2, 3]);
  });

  it('is deterministic given a fixed rng', () => {
    const rng = () => 0; // always picks index 0 — a degenerate but deterministic case
    expect(shuffle([1, 2, 3], rng)).toEqual([2, 3, 1]);
  });
});

describe('startDraw', () => {
  it('rejects fewer than 2 teams', () => {
    const state = baseState({ teams: [{ id: 't1', nome: 'A' }] });
    state.categories[0].teams = state.teams;
    expect(startDraw(state).ok).toBe(false);
  });

  it('builds a shuffled pool with every team, and empty groups matching nGrupos', () => {
    const state = baseState();
    const result = startDraw(state);
    expect(result.ok).toBe(true);
    expect(state.draw.pool).toHaveLength(5);
    expect(state.draw.pool.slice().sort()).toEqual(['t1', 't2', 't3', 't4', 't5']);
    expect(state.draw.groups).toEqual([[], []]);
    expect(state.draw.done).toBe(false);
  });

  it('builds a flat order (no groups) for a mata-mata draw', () => {
    const state = baseState({ formato: 'mata' });
    const result = startDraw(state);
    expect(result.ok).toBe(true);
    expect(state.draw.formato).toBe('mata');
    expect(state.draw.groups).toBeNull();
    expect(state.draw.order).toEqual([]);
  });
});

describe('revealNext', () => {
  it('rejects when no draw is in progress', () => {
    const state = baseState();
    expect(revealNext(state).ok).toBe(false);
  });

  it('moves one team from the pool into the smallest group each time (grupos)', () => {
    const state = baseState();
    startDraw(state);
    const drawnIds = [];
    for (let i = 0; i < 5; i++) {
      const result = revealNext(state);
      expect(result.ok).toBe(true);
      drawnIds.push(result.teamId);
    }
    expect(state.draw.pool).toEqual([]);
    expect(state.draw.done).toBe(true);
    expect(state.draw.groups[0].length + state.draw.groups[1].length).toBe(5);
    expect(Math.abs(state.draw.groups[0].length - state.draw.groups[1].length)).toBeLessThanOrEqual(1);
    expect(drawnIds.slice().sort()).toEqual(['t1', 't2', 't3', 't4', 't5']);
  });

  it('appends to a flat order for mata-mata', () => {
    const state = baseState({ formato: 'mata' });
    startDraw(state);
    revealNext(state);
    revealNext(state);
    expect(state.draw.order).toHaveLength(2);
  });

  it('rejects once the draw is already done', () => {
    const state = baseState();
    startDraw(state);
    for (let i = 0; i < 5; i++) {revealNext(state);}
    expect(revealNext(state).ok).toBe(false);
  });
});

describe('applyDraw', () => {
  it('rejects an unfinished draw', () => {
    const state = baseState();
    startDraw(state);
    revealNext(state);
    expect(applyDraw(state).ok).toBe(false);
  });

  it('commits the draw as participant order and generates the phase, reproducing the exact drawn groups', () => {
    const state = baseState();
    startDraw(state);
    for (let i = 0; i < 5; i++) {revealNext(state);}
    const drawnGroups = state.draw.groups.map((g) => g.slice());
    const result = applyDraw(state);
    expect(result.ok).toBe(true);
    expect(state.draw).toBeNull();
    const generatedGroups = state.grupos.map((g) => g.slice().sort());
    expect(generatedGroups).toEqual(drawnGroups.map((g) => g.slice().sort()));
  });

  it('commits a mata-mata draw as bracket seed order', () => {
    const state = baseState({ formato: 'mata' });
    startDraw(state);
    for (let i = 0; i < 5; i++) {revealNext(state);}
    const drawnOrder = state.draw.order.slice();
    const result = applyDraw(state);
    expect(result.ok).toBe(true);
    expect(state.bracket).toBeTruthy();
    expect(state.categories[0].phases[0].participantTeamIds).toEqual(drawnOrder);
  });
});

describe('cancelDraw', () => {
  it('clears an in-progress draw without touching the competition data', () => {
    const state = baseState();
    startDraw(state);
    revealNext(state);
    cancelDraw(state);
    expect(state.draw).toBeNull();
    expect(state.grupos).toEqual([]);
  });
});
