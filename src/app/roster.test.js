import { describe, it, expect } from 'vitest';
import {
  teamById, athleteById, athName, teamNameById,
  addAthlete, updateAthlete, removeAthlete, setAthletePhoto, setTeamLogo, compressPhoto,
} from './roster.js';

function championship() {
  return {
    teams: [
      { id: 't1', nome: 'Equipe A', roster: [{ id: 'a1', nome: 'Ana', dob: '2005-01-01', numero: '10', foto: '' }] },
      { id: 't2', nome: 'Equipe B', roster: [] },
    ],
  };
}

describe('teamById', () => {
  it('finds a team by id', () => { expect(teamById(championship(), 't2').nome).toBe('Equipe B'); });
  it('returns null when not found', () => { expect(teamById(championship(), 'ghost')).toBeNull(); });
});

describe('athleteById', () => {
  it('finds the athlete and its team across all teams', () => {
    const result = athleteById(championship(), 'a1');
    expect(result.athlete.nome).toBe('Ana');
    expect(result.team.id).toBe('t1');
  });
  it('returns null when not found', () => { expect(athleteById(championship(), 'ghost')).toBeNull(); });
});

describe('athName', () => {
  it('returns the athlete name', () => { expect(athName(championship(), 'a1')).toBe('Ana'); });
  it('returns an em dash when not found', () => { expect(athName(championship(), 'ghost')).toBe('—'); });
});

describe('teamNameById', () => {
  it('returns the team name', () => { expect(teamNameById(championship(), 't1')).toBe('Equipe A'); });
  it('returns null when not found', () => { expect(teamNameById(championship(), 'ghost')).toBeNull(); });
});

describe('addAthlete', () => {
  it('appends a trimmed-name athlete with a generated id', () => {
    const team = { id: 't1', nome: 'A', roster: [] };
    const result = addAthlete(team, { nome: '  Bia  ', dob: '2006-02-02', numero: '7' });
    expect(result.ok).toBe(true);
    expect(team.roster).toHaveLength(1);
    expect(team.roster[0]).toMatchObject({ nome: 'Bia', dob: '2006-02-02', numero: '7', foto: '' });
    expect(team.roster[0].id).toBeTruthy();
  });

  it('refuses a blank name without mutating the roster', () => {
    const team = { id: 't1', nome: 'A', roster: [] };
    const result = addAthlete(team, { nome: '   ' });
    expect(result).toEqual({ ok: false, reason: 'Informe o nome.' });
    expect(team.roster).toHaveLength(0);
  });

  it('initializes roster when the team has none yet', () => {
    const team = { id: 't1', nome: 'A' };
    addAthlete(team, { nome: 'Cau' });
    expect(team.roster).toHaveLength(1);
  });
});

describe('updateAthlete', () => {
  it('updates fields and returns before/after snapshots', () => {
    const team = { id: 't1', roster: [{ id: 'a1', nome: 'Old', dob: '', numero: '' }] };
    const result = updateAthlete(team, 'a1', { nome: 'New Name', dob: '2000-01-01', numero: '9' });
    expect(result.ok).toBe(true);
    expect(result.before).toEqual({ id: 'a1', nome: 'Old', dob: '', numero: '' });
    expect(result.after).toMatchObject({ nome: 'New Name', dob: '2000-01-01', numero: '9' });
    expect(team.roster[0].nome).toBe('New Name');
  });

  it('keeps the existing name when a blank name is passed', () => {
    const team = { id: 't1', roster: [{ id: 'a1', nome: 'Kept', dob: '', numero: '' }] };
    updateAthlete(team, 'a1', { nome: '  ', dob: '', numero: '' });
    expect(team.roster[0].nome).toBe('Kept');
  });

  it('refuses when the athlete id does not exist', () => {
    const team = { id: 't1', roster: [] };
    expect(updateAthlete(team, 'ghost', { nome: 'X' })).toEqual({ ok: false, reason: 'Atleta não encontrado.' });
  });

  it('preserves dob and numero when they are omitted from the update payload', () => {
    const team = { id: 't1', roster: [{ id: 'a1', nome: 'Kept', dob: '2005-01-01', numero: '7' }] };
    updateAthlete(team, 'a1', { nome: 'Renamed' });
    expect(team.roster[0].dob).toBe('2005-01-01');
    expect(team.roster[0].numero).toBe('7');
  });
});

describe('removeAthlete', () => {
  it('removes the athlete', () => {
    const team = { id: 't1', roster: [{ id: 'a1', nome: 'A' }, { id: 'a2', nome: 'B' }] };
    const result = removeAthlete(team, 'a1');
    expect(result).toEqual({ ok: true });
    expect(team.roster.map((a) => a.id)).toEqual(['a2']);
  });

  it('reports ok:false when the id does not exist, without mutating the roster', () => {
    const team = { id: 't1', roster: [{ id: 'a1', nome: 'A' }] };
    const result = removeAthlete(team, 'ghost');
    expect(result).toEqual({ ok: false });
    expect(team.roster).toHaveLength(1);
  });
});

describe('setAthletePhoto', () => {
  it('sets the photo data URL', () => {
    const team = { id: 't1', roster: [{ id: 'a1', nome: 'A', foto: '' }] };
    const result = setAthletePhoto(team, 'a1', 'data:image/jpeg;base64,xyz');
    expect(result).toEqual({ ok: true });
    expect(team.roster[0].foto).toBe('data:image/jpeg;base64,xyz');
  });

  it('reports ok:false when the athlete id does not exist', () => {
    const team = { id: 't1', roster: [] };
    expect(setAthletePhoto(team, 'ghost', 'data:x')).toEqual({ ok: false });
  });
});

describe('setTeamLogo', () => {
  it('sets the team logo', () => {
    const team = { id: 't1', nome: 'A' };
    const result = setTeamLogo(team, 'data:image/jpeg;base64,logo');
    expect(result).toEqual({ ok: true });
    expect(team.logo).toBe('data:image/jpeg;base64,logo');
  });
});

describe('compressPhoto', () => {
  it('resolves to null when no file is given', async () => {
    await expect(compressPhoto(null)).resolves.toBeNull();
  });
  // Real image decode/canvas-crop behavior is NOT unit-tested here: jsdom has
  // no image decoder or 2D canvas renderer. See this plan's Architecture
  // section — manual/browser verification is the accepted gap, same class
  // as Phase 1/2a's "no browser in this sandbox" limitation.
});



