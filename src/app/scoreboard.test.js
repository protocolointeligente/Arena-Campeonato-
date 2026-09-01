import { describe, it, expect, vi } from 'vitest';
import {
  findScoreboardObj, currentElapsedMs, formatClock, clockToggle, clockReset, setPeriod,
  adjustFoul, adjustTimeout, adjustPenalty, toggleServer, scoreboardMode, scoreboardPayload,
} from './scoreboard.js';

describe('findScoreboardObj', () => {
  it('finds a league/group match by id', () => {
    const state = { matches: [{ id: 'm1' }, { id: 'm2' }] };
    expect(findScoreboardObj(state, 'm2', 'match')).toBe(state.matches[1]);
  });

  it('finds a bracket tie by id, including the third-place tie', () => {
    const state = { bracket: { rounds: [[{ id: 't1' }]], third: { id: 't2' } } };
    expect(findScoreboardObj(state, 't2', 'tie')).toBe(state.bracket.third);
  });

  it('returns null for an unknown id', () => {
    expect(findScoreboardObj({ matches: [] }, 'ghost', 'match')).toBeNull();
  });
});

describe('formatClock', () => {
  it('formats milliseconds as MM:SS', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(65000)).toBe('01:05');
  });

  it('clamps negative values to zero', () => {
    expect(formatClock(-500)).toBe('00:00');
  });
});

describe('clock mutators', () => {
  it('accumulates elapsed time across pause/resume, ignoring time while paused', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const obj = {};
    clockToggle(obj);
    vi.advanceTimersByTime(5000);
    clockToggle(obj);
    expect(obj.clock).toMatchObject({ running: false, elapsedMs: 5000 });
    vi.advanceTimersByTime(3000);
    expect(currentElapsedMs(obj)).toBe(5000);
    clockToggle(obj);
    vi.advanceTimersByTime(2000);
    expect(currentElapsedMs(obj)).toBe(7000);
    vi.useRealTimers();
  });

  it('resets running state, start time and elapsed time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const obj = {};
    clockToggle(obj);
    vi.advanceTimersByTime(9000);
    clockReset(obj);
    expect(obj.clock).toMatchObject({ running: false, startedAt: null, elapsedMs: 0 });
    vi.useRealTimers();
  });

  it('moves the period up or down within 1..20', () => {
    const obj = {};
    expect(setPeriod(obj, 1)).toEqual({ ok: true });
    expect(obj.clock.period).toBe(2);
    expect(setPeriod(obj, -5)).toMatchObject({ ok: false });
    expect(obj.clock.period).toBe(2);
  });
});

describe('counters', () => {
  it('adjusts fouls per side and clamps at zero', () => {
    const obj = {};
    expect(adjustFoul(obj, 'home', 1)).toEqual({ ok: true });
    expect(obj.fouls).toEqual({ home: 1, away: 0 });
    expect(adjustFoul(obj, 'home', -5)).toMatchObject({ ok: false });
    expect(obj.fouls.home).toBe(1);
  });

  it('adjusts timeouts and penalties independently of fouls', () => {
    const obj = {};
    adjustTimeout(obj, 'away', 2);
    adjustPenalty(obj, 'home', 1);
    expect(obj.timeouts).toEqual({ home: 0, away: 2 });
    expect(obj.penalties).toEqual({ home: 1, away: 0 });
  });

  it('rejects an unknown side without mutating', () => {
    const obj = {};
    expect(adjustFoul(obj, 'ref', 1)).toMatchObject({ ok: false });
    expect(obj.fouls).toBeUndefined();
  });
});

describe('toggleServer', () => {
  it('cycles home -> away -> none -> home', () => {
    const obj = {};
    toggleServer(obj);
    expect(obj.server).toBe('home');
    toggleServer(obj);
    expect(obj.server).toBe('away');
    toggleServer(obj);
    expect(obj.server).toBeNull();
  });
});

describe('scoreboardMode', () => {
  it('is goals for team ball sports', () => {
    expect(scoreboardMode({ modalidade: 'futebol', scoreType: 'goals' })).toBe('goals');
  });

  it('is sets for set-based sports', () => {
    expect(scoreboardMode({ modalidade: 'voleibol', scoreType: 'sets' })).toBe('sets');
  });

  it('is combat for lutas modalities scored in points', () => {
    expect(scoreboardMode({ modalidade: 'judô', scoreType: 'points' })).toBe('combat');
  });

  it('is points for other individual modalities scored in points', () => {
    expect(scoreboardMode({ modalidade: 'natação', scoreType: 'points' })).toBe('points');
  });
});

describe('scoreboardPayload', () => {
  const baseState = { modalidade: 'futebol', scoreType: 'goals', teams: [{ nome: 'Leões' }, { nome: 'Tigres' }] };

  it('reads a league/group match by index-based home/away', () => {
    const state = { ...baseState, matches: [{ id: 'm1', home: 0, away: 1, hg: 2, ag: 1 }] };
    const payload = scoreboardPayload(state, 'm1', 'match');
    expect(payload).toMatchObject({ homeName: 'Leões', awayName: 'Tigres', hg: 2, ag: 1, homeField: 'hg', awayField: 'ag', mode: 'goals', leg: null });
    expect(payload.clock).toMatchObject({ running: false, period: 1, elapsedMs: 0 });
  });

  it('reads a single-leg bracket tie by id-based a/b, always leg 1', () => {
    const state = { ...baseState, cfg: { maoUnica: true }, teams: [{ id: 'a', nome: 'Alfa' }, { id: 'b', nome: 'Beta' }], bracket: { rounds: [[{ id: 't1', a: 'a', b: 'b', ag1: 3, bg1: 1 }]], third: null } };
    const payload = scoreboardPayload(state, 't1', 'tie');
    expect(payload).toMatchObject({ homeName: 'Alfa', awayName: 'Beta', hg: 3, ag: 1, homeField: 'ag1', awayField: 'bg1', leg: 1 });
  });

  it('moves a two-leg tie to leg 2 once leg 1 is complete', () => {
    const state = { ...baseState, cfg: { maoUnica: false }, teams: [{ id: 'a', nome: 'Alfa' }, { id: 'b', nome: 'Beta' }], bracket: { rounds: [[{ id: 't1', a: 'a', b: 'b', ag1: 2, bg1: 0, ag2: null, bg2: null }]], third: null } };
    const payload = scoreboardPayload(state, 't1', 'tie');
    expect(payload).toMatchObject({ homeField: 'ag2', awayField: 'bg2', leg: 2, hg: null, ag: null });
  });

  it('returns null for an unknown id', () => {
    expect(scoreboardPayload({ matches: [] }, 'ghost', 'match')).toBeNull();
  });

  it('does not mutate the source object when reading', () => {
    const state = { ...baseState, matches: [{ id: 'm1', home: 0, away: 1 }] };
    scoreboardPayload(state, 'm1', 'match');
    expect(state.matches[0].clock).toBeUndefined();
  });
});
