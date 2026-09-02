import { describe, it, expect } from 'vitest';
import { matchMeta, splitInfo, metaLine, setScore, saveMatchOps, clearResults, allMatchObjs, scheduleConflicts, addMatchEvent, removeMatchEvent, toISODate } from './matches.js';

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

  // Regression: a real ChampionshipStore returns Immer's frozen finalized state (Immer
  // freezes deeply by default, unconditionally, not just in dev). Every existing test above
  // calls matchMeta on a plain object, which never exercises that path — matchMeta's direct
  // `match.meta = match.meta || {}` throws on a frozen match the moment any read-only caller
  // (renderGames, scheduleConflicts, the PDF reports) touches a match that hasn't been
  // migrated yet.
  describe('on a frozen match (real store output)', () => {
    it('does not throw, and returns the already-set meta unchanged', () => {
      const match = Object.freeze({ id: 'm1', meta: Object.freeze({ venueId: 'v1' }) });
      expect(() => matchMeta(match)).not.toThrow();
      expect(matchMeta(match).venueId).toBe('v1');
    });

    it('derives the same fields a mutable match would, without writing back', () => {
      const info = '12/08/2026 · 19:00 · Ginásio Central';
      const frozen = Object.freeze({ id: 'm1', info });
      const meta = matchMeta(frozen);
      expect(meta).toMatchObject({ date: '2026-08-12', time: '19:00', venueText: 'Ginásio Central' });
      expect(frozen.meta).toBeUndefined();
    });

    it('returns an empty object when there is nothing to derive', () => {
      const frozen = Object.freeze({ id: 'm1' });
      expect(matchMeta(frozen)).toEqual({});
    });
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
  it('marks a match as finished when both score fields are filled', () => {
    const state = { matches: [{ id: 'm1', hg: null, ag: null, meta: { status: 'scheduled' } }] };
    setScore(state, 'm1', 'hg', '2');
    setScore(state, 'm1', 'ag', '1');
    expect(state.matches[0].meta.status).toBe('finished');
  });

  it('updates the field and returns before/after', () => {
    const state = { matches: [{ id: 'm1', hg: null, ag: null }] };
    const result = setScore(state, 'm1', 'hg', '2');
    expect(result).toEqual({ ok: true, before: { hg: null, ag: null }, after: { hg: 2, ag: null } });
    expect(state.matches[0].hg).toBe(2);
  });

  it('clears the field back to null on an empty string', () => {
    const state = { matches: [{ id: 'm1', hg: 2, ag: 1, meta: { status: 'finished' } }] };
    setScore(state, 'm1', 'hg', '');
    expect(state.matches[0].hg).toBeNull();
    expect(state.matches[0].meta.status).toBe('scheduled');
  });

  it('resets finished match status when clearing all results', () => {
    const state = { matches: [{ id: 'm1', hg: 2, ag: 1, meta: { status: 'finished' }, events: [{ type: 'goal' }] }] };
    clearResults(state);
    expect(state.matches[0]).toMatchObject({ hg: null, ag: null, events: [], meta: { status: 'scheduled' } });
  });

  it('reports ok:false for an unknown match id', () => {
    const state = { matches: [] };
    expect(setScore(state, 'ghost', 'hg', '1')).toEqual({ ok: false });
  });

  it('rejects invalid fields and values without mutating the match', () => {
    const state = { matches: [{ id: 'm1', hg: 1, ag: 2 }] };
    expect(setScore(state, 'm1', 'home', 3).ok).toBe(false);
    expect(setScore(state, 'm1', 'hg', -1).ok).toBe(false);
    expect(setScore(state, 'm1', 'hg', 'abc').ok).toBe(false);
    expect(setScore(state, 'm1', 'hg', 100).ok).toBe(false);
    expect(state.matches[0]).toMatchObject({ hg: 1, ag: 2 });
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

  it('rejects invalid operational data without mutating the match', () => {
    const state = { matches: [{ id: 'm1', meta: { date: '2026-08-12', status: 'scheduled' } }], venues: [], officials: [] };
    expect(saveMatchOps(state, 'm1', { date: '12/08/2026', time: '25:99', status: 'unknown' }).ok).toBe(false);
    expect(state.matches[0].meta).toEqual({ date: '2026-08-12', status: 'scheduled' });
  });

  it('clearing the venue selection wipes stale legacy venueText migrated from match.info', () => {
    // match.info carries real legacy free text with a location segment; matchMeta's
    // one-time migration (triggered inside saveMatchOps) backfills it into meta.venueText.
    const state = { matches: [{ id: 'm1', home: 0, away: 1, info: '12/08/2026 · 19:00 · Ginásio Central', meta: {} }], venues: [], officials: [] };
    const result = saveMatchOps(state, 'm1', { venueId: '' });
    expect(result.ok).toBe(true);
    expect(state.matches[0].meta.venueText).toBe('');
    expect(metaLine(state, state.matches[0])).not.toContain('Ginásio Central');
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

describe('allMatchObjs', () => {
  it('returns league/group matches when there is no bracket', () => {
    const state = { matches: [{ id: 'm1' }, { id: 'm2' }] };
    expect(allMatchObjs(state)).toEqual([{ id: 'm1' }, { id: 'm2' }]);
  });

  it('includes every bracket tie plus the third-place tie', () => {
    const state = {
      matches: [],
      bracket: { rounds: [[{ id: 't1' }, { id: 't2' }], [{ id: 't3' }]], third: { id: 't4' } },
    };
    expect(allMatchObjs(state)).toEqual([{ id: 't1' }, { id: 't2' }, { id: 't3' }, { id: 't4' }]);
  });

  it('handles a state with no matches or bracket', () => {
    expect(allMatchObjs({})).toEqual([]);
  });
});

describe('scheduleConflicts', () => {
  it('detects shared venue and referee in the same time slot', () => {
    const state = { matches: [
      { id: 'm1', home: 0, away: 1, meta: { date: '2026-08-12', time: '19:00', venueId: 'v1', refereeId: 'o1' } },
      { id: 'm2', home: 0, away: 2, meta: { date: '2026-08-12', time: '19:00', venueId: 'v1', refereeId: 'o1' } },
      { id: 'm3', home: 1, away: 2, meta: { date: '2026-08-12', time: '20:00', venueId: 'v1', refereeId: 'o1' } },
    ] };
    const conflicts = scheduleConflicts(state);
    expect(conflicts).toHaveLength(3);
    expect(conflicts.map((item) => item.resource)).toEqual(expect.arrayContaining(['venueId', 'refereeId', 'teamId']));
    expect(conflicts[0].matchIds).toEqual(['m1', 'm2']);
  });

  it('ignores unscheduled matches and empty resources', () => {
    expect(scheduleConflicts({ matches: [{ id: 'm1', meta: {} }, { id: 'm2', meta: { date: '2026-08-12', time: '19:00' } }] })).toEqual([]);
  });
});

describe('addMatchEvent', () => {
  it('appends a goal event with a generated id, defaulting athleteId to null and name to empty string', () => {
    const match = { id: 'm1' };
    const result = addMatchEvent(match, { type: 'goal', teamId: 't1', athleteId: 'a1' });
    expect(result.ok).toBe(true);
    expect(match.events).toHaveLength(1);
    expect(match.events[0]).toMatchObject({ type: 'goal', teamId: 't1', athleteId: 'a1', name: '' });
    expect(match.events[0].id).toBeTruthy();
  });

  it('records an anonymous event (no athleteId) with a free-text name', () => {
    const match = {};
    const result = addMatchEvent(match, { type: 'yellow', teamId: 't1', name: 'Torcedor 7' });
    expect(result.event).toMatchObject({ type: 'yellow', teamId: 't1', athleteId: null, name: 'Torcedor 7' });
  });

  it('rejects an unknown event type without mutating the object', () => {
    const match = {};
    const result = addMatchEvent(match, { type: 'foul', teamId: 't1' });
    expect(result).toEqual({ ok: false });
    expect(match.events).toBeUndefined();
  });

  it('rejects events without a team and preserves anonymous events with a team', () => {
    const match = {};
    expect(addMatchEvent(match, { type: 'goal' }).ok).toBe(false);
    expect(match.events).toBeUndefined();
    expect(addMatchEvent(match, { type: 'goal', teamId: 't1', name: '' }).ok).toBe(true);
  });

  it('appends to an existing events array on a bracket tie object, same as a match', () => {
    const tie = { id: 't1', events: [{ id: 'e0', type: 'goal', teamId: 't1', athleteId: null, name: '' }] };
    addMatchEvent(tie, { type: 'red', teamId: 't2', athleteId: 'a9' });
    expect(tie.events).toHaveLength(2);
    expect(tie.events[1]).toMatchObject({ type: 'red', teamId: 't2', athleteId: 'a9' });
  });
});

describe('removeMatchEvent', () => {
  it('removes an event by index', () => {
    const match = { events: [{ id: 'e0', type: 'goal' }, { id: 'e1', type: 'yellow' }] };
    const result = removeMatchEvent(match, 0);
    expect(result).toEqual({ ok: true });
    expect(match.events).toEqual([{ id: 'e1', type: 'yellow' }]);
  });

  it('rejects an out-of-range index without mutating', () => {
    const match = { events: [{ id: 'e0', type: 'goal' }] };
    expect(removeMatchEvent(match, 5)).toEqual({ ok: false });
    expect(removeMatchEvent(match, -1)).toEqual({ ok: false });
    expect(match.events).toHaveLength(1);
  });

  it('rejects removing from an object with no events array', () => {
    expect(removeMatchEvent({}, 0)).toEqual({ ok: false });
  });

  it('rejects a non-integer index without mutating', () => {
    const match = { events: [{ id: 'e0', type: 'goal' }, { id: 'e1', type: 'yellow' }] };
    expect(removeMatchEvent(match, NaN)).toEqual({ ok: false });
    expect(removeMatchEvent(match, 0.5)).toEqual({ ok: false });
    expect(match.events).toHaveLength(2);
  });
});

describe('clearResults events reset', () => {
  it('clears match.events alongside scores', () => {
    const state = { matches: [{ id: 'm1', hg: 2, ag: 1, scorers: ['x'], events: [{ id: 'e0', type: 'goal' }] }] };
    clearResults(state);
    expect(state.matches[0].events).toEqual([]);
  });

  it('clears bracket tie events alongside scores', () => {
    const state = { matches: [], bracket: { rounds: [[{ id: 't1', a: 'x', b: 'y', ag1: 2, events: [{ id: 'e0', type: 'yellow' }] }]], third: null } };
    clearResults(state);
    expect(state.bracket.rounds[0][0].events).toEqual([]);
  });
});

describe('modality score limits', () => {
  it('allows higher point scores for point-based modalities', () => {
    const state = { scoreType: 'points', matches: [{ id: 'm1', home: 0, away: 1 }] };
    expect(setScore(state, 'm1', 'hg', 500).ok).toBe(true);
    expect(setScore({ scoreType: 'goals', matches: [{ id: 'm1', home: 0, away: 1 }] }, 'm1', 'hg', 500).ok).toBe(false);
  });

  it('rejects tied final scores for sets and points', () => {
    const state = { scoreType: 'sets', matches: [{ id: 'm1', home: 0, away: 1, hg: 1, ag: 0 }] };
    expect(setScore(state, 'm1', 'ag', 1)).toMatchObject({ ok: false });
    expect(state.matches[0].ag).toBe(0);
  });

  it('enforces setsToWin for set-based modalities', () => {
    const state = { scoreType: 'sets', cfg: { setsToWin: 2 }, matches: [{ id: 'm1', home: 0, away: 1, hg: null, ag: null }] };
    expect(setScore(state, 'm1', 'hg', 3).ok).toBe(true);
    expect(setScore(state, 'm1', 'ag', 0)).toMatchObject({ ok: false });
    expect(state.matches[0].ag).toBeNull();
    expect(setScore(state, 'm1', 'hg', 2).ok).toBe(true);
    expect(setScore(state, 'm1', 'ag', 1).ok).toBe(true);
  });
});



