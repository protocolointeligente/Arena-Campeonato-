import { describe, it, expect } from 'vitest';
import { matchMeta, splitInfo, metaLine, setScore, saveMatchOps, clearResults, toISODate } from './matches.js';

describe('matchMeta', () => {
  it('creates an empty meta object when absent', () => {
    const match = {};
    expect(matchMeta(match)).toEqual({});
    expect(match.meta).toEqual({});
  });

  it('migrates a legacy free-text info string into structured fields, once', () => {
    const match = { info: '12/08/2026 · 19:00 · Ginásio Central' };
    const meta = matchMeta(match);
    expect(meta.date).toBe('2026-08-12');
    expect(meta.time).toBe('19:00');
    expect(meta.venueText).toBe('Ginásio Central');
    expect(meta._migrated).toBe(true);
  });

  it('does not migrate a non-date first segment into meta.date', () => {
    const match = { info: 'Ginásio Central' };
    const meta = matchMeta(match);
    expect(meta.date).toBeFalsy();
  });

  it('does not re-migrate once already migrated, even if info changes', () => {
    const match = { info: 'stale text', meta: { _migrated: true, date: 'kept' } };
    const meta = matchMeta(match);
    expect(meta.date).toBe('kept');
  });

  it('preserves existing meta fields already set', () => {
    const match = { meta: { venueId: 'v1' } };
    expect(matchMeta(match).venueId).toBe('v1');
  });
});

describe('toISODate', () => {
  it('converts dd/mm/yyyy to yyyy-mm-dd', () => {
    expect(toISODate('12/08/2026')).toBe('2026-08-12');
  });

  it('passes an already-ISO date through unchanged', () => {
    expect(toISODate('2026-08-12')).toBe('2026-08-12');
  });

  it('returns empty string for anything that is not a recognizable date', () => {
    expect(toISODate('Ginásio Central')).toBe('');
    expect(toISODate('')).toBe('');
    expect(toISODate(null)).toBe('');
  });
});

describe('splitInfo', () => {
  it('splits on · or | into date/time/local', () => {
    expect(splitInfo('12/08/2026 · 19:00 · Ginásio Central')).toEqual({ data: '12/08/2026', hora: '19:00', local: 'Ginásio Central' });
  });

  it('handles a lone date with nothing else', () => {
    expect(splitInfo('12/08/2026')).toEqual({ data: '12/08/2026', hora: '', local: '' });
  });

  it('returns all-empty for blank input', () => {
    expect(splitInfo('')).toEqual({ data: '', hora: '', local: '' });
    expect(splitInfo(null)).toEqual({ data: '', hora: '', local: '' });
  });
});

describe('metaLine', () => {
  it('joins date, time, venue name (falling back to venueText), and referee', () => {
    const state = { venues: [{ id: 'v1', name: 'Ginásio Central' }], officials: [{ id: 'o1', name: 'João' }] };
    const match = { meta: { date: '2026-08-12', time: '19:00', venueId: 'v1', refereeId: 'o1' } };
    expect(metaLine(state, match)).toBe('12/08/2026 · 19:00 · Ginásio Central · Árbitro: João');
  });

  it('falls back to free-text venueText when no venueId matches', () => {
    const state = { venues: [], officials: [] };
    const match = { meta: { venueText: 'Campo do bairro' } };
    expect(metaLine(state, match)).toBe('Campo do bairro');
  });

  it('omits empty parts and returns an empty string when nothing is set', () => {
    const state = { venues: [], officials: [] };
    expect(metaLine(state, { meta: {} })).toBe('');
  });
});

describe('setScore', () => {
  it('updates the field and returns before/after', () => {
    const state = { matches: [{ id: 'm1', hg: null, ag: null }] };
    const result = setScore(state, 'm1', 'hg', '2');
    expect(result).toEqual({ ok: true, before: { hg: null, ag: null }, after: { hg: 2, ag: null } });
    expect(state.matches[0].hg).toBe(2);
  });

  it('clears the field back to null on an empty string', () => {
    const state = { matches: [{ id: 'm1', hg: 2, ag: 1 }] };
    setScore(state, 'm1', 'hg', '');
    expect(state.matches[0].hg).toBeNull();
  });

  it('reports ok:false for an unknown match id', () => {
    const state = { matches: [] };
    expect(setScore(state, 'ghost', 'hg', '1')).toEqual({ ok: false });
  });
});

describe('saveMatchOps', () => {
  it('writes meta fields and recomputes match.info', () => {
    const state = { matches: [{ id: 'm1', home: 0, away: 1, meta: {} }], venues: [{ id: 'v1', name: 'Arena' }], officials: [] };
    const result = saveMatchOps(state, 'm1', { date: '2026-08-12', time: '19:00', venueId: 'v1', refereeId: '', tableOfficialId: '', status: 'live', notes: 'chuva prevista' });
    expect(result.ok).toBe(true);
    const match = state.matches[0];
    expect(match.meta).toMatchObject({ date: '2026-08-12', time: '19:00', venueId: 'v1', status: 'live', notes: 'chuva prevista' });
    expect(match.info).toBe('12/08/2026 · 19:00 · Arena');
  });

  it('defaults status to scheduled when not provided', () => {
    const state = { matches: [{ id: 'm1', meta: {} }], venues: [], officials: [] };
    saveMatchOps(state, 'm1', {});
    expect(state.matches[0].meta.status).toBe('scheduled');
  });

  it('reports ok:false for an unknown match id', () => {
    const state = { matches: [] };
    expect(saveMatchOps(state, 'ghost', {})).toEqual({ ok: false });
  });

  it('clearing the venue selection actually clears the displayed venue, even after a prior save populated venueText via migration', () => {
    const state = { matches: [{ id: 'm1', home: 0, away: 1, meta: {} }], venues: [{ id: 'v1', name: 'Arena' }], officials: [] };
    saveMatchOps(state, 'm1', { venueId: 'v1' });
    metaLine(state, state.matches[0]); // simulates a render pass, which triggers matchMeta's info-migration backfill
    saveMatchOps(state, 'm1', { venueId: '' });
    expect(metaLine(state, state.matches[0])).toBe('');
  });
});

describe('clearResults', () => {
  it('nulls every match score', () => {
    const state = { matches: [{ id: 'm1', hg: 2, ag: 1, scorers: ['x'] }] };
    clearResults(state);
    expect(state.matches[0]).toMatchObject({ hg: null, ag: null, scorers: [] });
  });

  it('resets every bracket tie score/winner without discarding team assignments', () => {
    const state = {
      matches: [],
      bracket: {
        rounds: [[{ id: 't1', a: 'x', b: 'y', ag1: 2, bg1: 0, winner: 'x', scorers: ['g'] }]],
        third: { id: 't2', a: null, b: null, ag1: 1, bg1: 1, apen: 3, bpen: 2, winner: 'x' },
      },
    };
    clearResults(state);
    const tie = state.bracket.rounds[0][0];
    expect(tie).toMatchObject({ a: 'x', b: 'y', ag1: null, bg1: null, winner: null, scorers: [] });
    expect(state.bracket.third).toMatchObject({ ag1: null, bg1: null, apen: null, bpen: null, winner: null });
  });

  it('is a no-op-safe on a state with no matches/bracket', () => {
    expect(clearResults({})).toEqual({ ok: true });
  });
});
