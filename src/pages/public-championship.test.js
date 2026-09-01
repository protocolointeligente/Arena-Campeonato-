import { describe, it, expect } from 'vitest';
import { publicStandings, matchRows, liveMatchRows, disciplineRows, mergePollVotes, teamPortalData, teamPortalPath, liveUpdateKey, publicUpdateKey } from './public-championship.js';

const category = {
  nome: 'Adulto',
  teams: [{ id: 'a', nome: 'Alfa' }, { id: 'b', nome: 'Beta' }],
  activePhaseId: 'p1',
  phases: [{ id: 'p1', nome: 'Liga', cfg: { winPts: 3, drawPts: 1, lossPts: 0 }, participantTeamIds: ['a', 'b'], matches: [{ id: 'm1', home: 0, away: 1, hg: 2, ag: 0 }] }],
};

describe('public championship projections', () => {
  it('aggregates persisted public poll votes without trusting embedded totals', () => {
    const state = { polls: [{ id: 'p1', status: 'published', options: [{ id: 'a', votes: 99 }, { id: 'b', votes: 99 }] }] };
    const result = mergePollVotes(state, [{ pollId: 'p1', optionId: 'a', voterKey: 'device-1' }, { pollId: 'p1', optionId: 'a', voterKey: 'device-1' }, { pollId: 'p1', optionId: 'b', voterKey: 'device-2' }]);
    expect(result.polls[0].options.map((option) => option.votes)).toEqual([1, 1]);
  });

  it('projects standings with team names and computed points', () => {
    const rows = publicStandings(category, { cfg: category.phases[0].cfg });
    expect(rows[0]).toMatchObject({ name: 'Alfa', P: 3, J: 1, SG: 2, position: 1 });
    expect(rows[1]).toMatchObject({ name: 'Beta', P: 0, J: 1, SG: -2, position: 2 });
  });

  it('projects a dedicated team portal without exposing other teams data', () => {
    const result = teamPortalData(category, { teams: category.teams, cfg: category.phases[0].cfg }, 'a');
    expect(result.team.nome).toBe('Alfa');
    expect(result.matches).toHaveLength(1);
    expect(teamPortalData(category, {}, 'missing')).toBeNull();
  });

  it('builds encoded team portal links for sharing', () => {
    expect(teamPortalPath('copa 2026', 'time/a')).toBe('/equipe/copa%202026/time%2Fa');
  });

  it('creates a stable key for live score notification changes', () => {
    const live = { ...category, phases: [{ ...category.phases[0], matches: [{ ...category.phases[0].matches[0], meta: { status: 'live' } }] }] };
    expect(liveUpdateKey(live, {})).toContain('m1:2-0-live');
  });

  it('creates a notification key only from published communications', () => {
    const state = { announcements: [{ id: 'a1', status: 'published', updated: 2 }, { id: 'a2', status: 'draft' }], polls: [{ id: 'p1', status: 'published', question: 'MVP?' }] };
    expect(publicUpdateKey(state)).toBe('a:a1:2|p:p1:MVP?');
  });

  it('projects match rows with readable team names', () => {
    expect(matchRows(category, {})).toEqual([expect.objectContaining({ id: 'm1', homeName: 'Alfa', awayName: 'Beta' })]);
  });

  it('projects only matches marked as live', () => {
    const liveCategory = { ...category, phases: [{ ...category.phases[0], matches: [{ ...category.phases[0].matches[0], meta: { status: 'live' } }] }] };
    expect(liveMatchRows(liveCategory, {})).toHaveLength(1);
    expect(liveMatchRows(category, {})).toEqual([]);
  });

  it('projects discipline rankings from match events', () => {
    const disciplineCategory = { ...category, phases: [{ ...category.phases[0], matches: [{ ...category.phases[0].matches[0], events: [{ type: 'yellow', athleteId: 'a1', teamId: 'a' }] }] }] };
    const state = { ...category, teams: [{ id: 'a', nome: 'Alfa', roster: [{ id: 'a1', nome: 'Joao' }] }, { id: 'b', nome: 'Beta' }] };
    expect(disciplineRows(disciplineCategory, state)[0]).toMatchObject({ name: 'Joao', y: 1, r: 0 });
  });
});
