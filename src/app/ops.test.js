import { describe, it, expect } from 'vitest';
import {
  STAFF_ROLES, ensureOps, venueById, officialById,
  addVenue, removeVenue, addOfficial, removeOfficial, setTeamStaff,
} from './ops.js';

describe('STAFF_ROLES', () => {
  it('lists the four legacy roles in order', () => {
    expect(STAFF_ROLES).toEqual([
      ['tecnico', 'Técnico'],
      ['auxiliar', 'Auxiliar técnico'],
      ['preparador', 'Preparador físico'],
      ['medico', 'Médico / Fisioterapeuta'],
    ]);
  });
});

describe('ensureOps', () => {
  it('initializes venues and officials as empty arrays when absent', () => {
    const state = {};
    ensureOps(state);
    expect(state.venues).toEqual([]);
    expect(state.officials).toEqual([]);
  });

  it('leaves existing arrays untouched', () => {
    const state = { venues: [{ id: 'v1' }], officials: [{ id: 'o1' }] };
    ensureOps(state);
    expect(state.venues).toEqual([{ id: 'v1' }]);
    expect(state.officials).toEqual([{ id: 'o1' }]);
  });
});

describe('venueById / officialById', () => {
  it('finds by id, returns null when missing', () => {
    const state = { venues: [{ id: 'v1', name: 'Ginásio' }], officials: [{ id: 'o1', name: 'João' }] };
    expect(venueById(state, 'v1').name).toBe('Ginásio');
    expect(venueById(state, 'ghost')).toBeNull();
    expect(officialById(state, 'o1').name).toBe('João');
    expect(officialById(state, 'ghost')).toBeNull();
  });
});

describe('addVenue', () => {
  it('appends a trimmed venue with a generated id', () => {
    const state = { venues: [] };
    const result = addVenue(state, { name: '  Ginásio Central  ', address: 'Rua A, 100' });
    expect(result.ok).toBe(true);
    expect(state.venues).toHaveLength(1);
    expect(state.venues[0]).toMatchObject({ name: 'Ginásio Central', address: 'Rua A, 100' });
    expect(state.venues[0].id).toBeTruthy();
  });

  it('refuses a blank name without mutating', () => {
    const state = { venues: [] };
    const result = addVenue(state, { name: '   ' });
    expect(result).toEqual({ ok: false, reason: 'Informe o nome do local.' });
    expect(state.venues).toHaveLength(0);
  });

  it('initializes venues when absent', () => {
    const state = {};
    addVenue(state, { name: 'Quadra 1' });
    expect(state.venues).toHaveLength(1);
  });
});

describe('removeVenue', () => {
  it('removes by id', () => {
    const state = { venues: [{ id: 'v1' }, { id: 'v2' }] };
    expect(removeVenue(state, 'v1')).toEqual({ ok: true });
    expect(state.venues.map((v) => v.id)).toEqual(['v2']);
  });

  it('reports ok:false for an unknown id, without mutating', () => {
    const state = { venues: [{ id: 'v1' }] };
    expect(removeVenue(state, 'ghost')).toEqual({ ok: false });
    expect(state.venues).toHaveLength(1);
  });
});

describe('addOfficial', () => {
  it('appends a trimmed official with a generated id', () => {
    const state = { officials: [] };
    const result = addOfficial(state, { name: '  Maria  ', role: 'Árbitra', phone: '11999999999' });
    expect(result.ok).toBe(true);
    expect(state.officials[0]).toMatchObject({ name: 'Maria', role: 'Árbitra', phone: '11999999999' });
  });

  it('refuses a blank name', () => {
    const state = { officials: [] };
    expect(addOfficial(state, { name: '' })).toEqual({ ok: false, reason: 'Informe o nome do oficial.' });
  });
});

describe('removeOfficial', () => {
  it('removes by id', () => {
    const state = { officials: [{ id: 'o1' }, { id: 'o2' }] };
    expect(removeOfficial(state, 'o1')).toEqual({ ok: true });
    expect(state.officials.map((o) => o.id)).toEqual(['o2']);
  });

  it('reports ok:false for an unknown id', () => {
    const state = { officials: [{ id: 'o1' }] };
    expect(removeOfficial(state, 'ghost')).toEqual({ ok: false });
  });
});

describe('setTeamStaff', () => {
  it('sets a trimmed value under the given role key', () => {
    const team = {};
    const result = setTeamStaff(team, 'tecnico', '  Carlos Silva  ');
    expect(result).toEqual({ ok: true });
    expect(team.staff).toEqual({ tecnico: 'Carlos Silva' });
  });

  it('initializes staff when absent and preserves other keys', () => {
    const team = { staff: { auxiliar: 'Ana' } };
    setTeamStaff(team, 'medico', 'Dr. Paulo');
    expect(team.staff).toEqual({ auxiliar: 'Ana', medico: 'Dr. Paulo' });
  });

  it('reports ok:false for a null team', () => {
    expect(setTeamStaff(null, 'tecnico', 'X')).toEqual({ ok: false });
  });
});
