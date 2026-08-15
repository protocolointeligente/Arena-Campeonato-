import { describe, it, expect } from 'vitest';
import {
  PHASE_FORMATS, ensurePhases, loadPhaseIntoRoot, saveRootIntoPhase, activePhaseOf,
  phaseParticipants, phaseComplete, addPhase, renamePhase, removePhase, switchPhase,
  setPhaseFormat, setProgressTarget, setProgressMode, setProgressCount, progressionSummary,
} from './phases.js';

describe('PHASE_FORMATS', () => {
  it('lists liga/grupos/gxg only — mata is deferred to Phase 3a', () => {
    expect(PHASE_FORMATS).toEqual([
      ['liga', 'Pontos Corridos'],
      ['grupos', 'Fase de Grupos'],
      ['gxg', 'Grupo × Grupo'],
    ]);
  });
});

describe('ensurePhases', () => {
  it('migrates a flat category.matches into a first phase, then deletes it', () => {
    const state = { formato: 'liga', cfg: { turnos: 1 } };
    const category = { id: 'c1', matches: [{ id: 'm1', home: 0, away: 1 }] };
    ensurePhases(category, state);
    expect(category.phases).toHaveLength(1);
    expect(category.phases[0].nome).toBe('Fase principal');
    expect(category.phases[0].formato).toBe('liga');
    expect(category.phases[0].matches).toEqual([{ id: 'm1', home: 0, away: 1 }]);
    expect(category.activePhaseId).toBe(category.phases[0].id);
    expect(category.matches).toBeUndefined();
  });

  it('defaults formato to liga and matches to [] when the category has neither', () => {
    const state = {};
    const category = { id: 'c1' };
    ensurePhases(category, state);
    expect(category.phases[0].formato).toBe('liga');
    expect(category.phases[0].matches).toEqual([]);
  });

  it('does not duplicate phases on a second call', () => {
    const state = {};
    const category = { id: 'c1', matches: [] };
    ensurePhases(category, state);
    const firstId = category.phases[0].id;
    ensurePhases(category, state);
    expect(category.phases).toHaveLength(1);
    expect(category.phases[0].id).toBe(firstId);
  });

  it('repairs an activePhaseId pointing at a phase that no longer exists', () => {
    const category = { id: 'c1', phases: [{ id: 'p1' }], activePhaseId: 'ghost' };
    ensurePhases(category, {});
    expect(category.activePhaseId).toBe('p1');
  });

  it('leaves an already-valid activePhaseId untouched', () => {
    const category = { id: 'c1', phases: [{ id: 'p1' }, { id: 'p2' }], activePhaseId: 'p2' };
    ensurePhases(category, {});
    expect(category.activePhaseId).toBe('p2');
  });
});

describe('loadPhaseIntoRoot / saveRootIntoPhase', () => {
  it('loadPhaseIntoRoot copies a deep clone of phase fields onto state', () => {
    const phase = { formato: 'grupos', cfg: { nGrupos: 2 }, grupos: [['t1']], matches: [{ id: 'm1' }], bracket: null };
    const state = {};
    loadPhaseIntoRoot(state, phase);
    expect(state.formato).toBe('grupos');
    expect(state.cfg).toEqual({ nGrupos: 2 });
    expect(state.grupos).toEqual([['t1']]);
    expect(state.matches).toEqual([{ id: 'm1' }]);
    expect(state.bracket).toBeNull();
    expect(state.matches).not.toBe(phase.matches);
  });

  it('saveRootIntoPhase writes root fields onto the phase and preserves participantTeamIds/progression', () => {
    const phase = { participantTeamIds: ['t1'], progression: { mode: 'overall' } };
    const state = { formato: 'liga', cfg: { turnos: 2 }, grupos: [], matches: [{ id: 'm2' }], bracket: null };
    saveRootIntoPhase(state, phase);
    expect(phase.formato).toBe('liga');
    expect(phase.matches).toEqual([{ id: 'm2' }]);
    expect(phase.participantTeamIds).toEqual(['t1']);
    expect(phase.progression).toEqual({ mode: 'overall' });
  });

  it('saveRootIntoPhase is a no-op for a null phase', () => {
    expect(() => saveRootIntoPhase({}, null)).not.toThrow();
  });
});

describe('activePhaseOf', () => {
  it('returns the phase matching activePhaseId, falling back to the first', () => {
    const category = { phases: [{ id: 'p1' }, { id: 'p2' }], activePhaseId: 'p2' };
    expect(activePhaseOf(category).id).toBe('p2');
    expect(activePhaseOf({ phases: [{ id: 'p1' }], activePhaseId: 'ghost' }).id).toBe('p1');
  });
});

describe('phaseParticipants', () => {
  it('returns all team indices when participantTeamIds is absent', () => {
    const state = { teams: [{ id: 't1' }, { id: 't2' }] };
    expect(phaseParticipants(state, {})).toEqual([0, 1]);
  });

  it('maps participantTeamIds to indices, dropping unknown ids', () => {
    const state = { teams: [{ id: 't1' }, { id: 't2' }] };
    const phase = { participantTeamIds: ['t2', 'ghost'] };
    expect(phaseParticipants(state, phase)).toEqual([1]);
  });
});

describe('phaseComplete', () => {
  it('is false for a null phase or a phase with no matches', () => {
    expect(phaseComplete(null)).toBe(false);
    expect(phaseComplete({ formato: 'liga', matches: [] })).toBe(false);
  });

  it('is true only when every match has both scores set', () => {
    const phase = { formato: 'liga', matches: [{ hg: 1, ag: 0 }, { hg: null, ag: null }] };
    expect(phaseComplete(phase)).toBe(false);
    phase.matches[1] = { hg: 2, ag: 2 };
    expect(phaseComplete(phase)).toBe(true);
  });

  it('is false for mata format — bracket completion needs the draw engine (Phase 3a)', () => {
    expect(phaseComplete({ formato: 'mata', bracket: {} })).toBe(false);
  });
});

describe('addPhase', () => {
  it('appends a blank liga phase, saving the outgoing phase first, and switches to it', () => {
    const state = { formato: 'liga', cfg: { turnos: 1 }, grupos: [], matches: [{ id: 'edited' }], bracket: null };
    const category = { id: 'c1', phases: [{ id: 'p1', nome: 'Fase principal' }], activePhaseId: 'p1' };
    const phase = addPhase(state, category);
    expect(category.phases).toHaveLength(2);
    expect(category.phases[0].matches).toEqual([{ id: 'edited' }]);
    expect(phase.nome).toBe('Fase 2');
    expect(phase.formato).toBe('liga');
    expect(phase.matches).toEqual([]);
    expect(category.activePhaseId).toBe(phase.id);
    expect(state.matches).toEqual([]);
  });
});

describe('renamePhase', () => {
  it('trims the name, falls back to "Fase" for blank', () => {
    const category = { phases: [{ id: 'p1', nome: 'A' }] };
    renamePhase(category, 'p1', '  Grupos  ');
    expect(category.phases[0].nome).toBe('Grupos');
    renamePhase(category, 'p1', '   ');
    expect(category.phases[0].nome).toBe('Fase');
  });

  it('reports ok:false for an unknown id', () => {
    const category = { phases: [{ id: 'p1', nome: 'A' }] };
    expect(renamePhase(category, 'ghost', 'X')).toEqual({ ok: false });
  });
});

describe('removePhase', () => {
  it('refuses to remove the last remaining phase', () => {
    const category = { phases: [{ id: 'p1' }], activePhaseId: 'p1' };
    const result = removePhase({}, category, 'p1');
    expect(result).toEqual({ ok: false, reason: 'A categoria precisa ter pelo menos uma fase.' });
    expect(category.phases).toHaveLength(1);
  });

  it('removes a non-active phase without disturbing root state', () => {
    const state = { formato: 'liga', matches: [{ id: 'active-edit' }] };
    const category = { phases: [{ id: 'p1' }, { id: 'p2' }], activePhaseId: 'p1' };
    const result = removePhase(state, category, 'p2');
    expect(result).toEqual({ ok: true });
    expect(category.phases.map((p) => p.id)).toEqual(['p1']);
    expect(category.activePhaseId).toBe('p1');
  });

  it('removing the active phase switches root to the new first phase', () => {
    const state = { formato: 'liga', matches: [{ id: 'unsaved' }] };
    const category = { phases: [{ id: 'p1', formato: 'grupos', matches: [{ id: 'from-p1' }] }, { id: 'p2' }], activePhaseId: 'p2' };
    const result = removePhase(state, category, 'p2');
    expect(result).toEqual({ ok: true });
    expect(category.activePhaseId).toBe('p1');
    expect(state.matches).toEqual([{ id: 'from-p1' }]);
  });
});

describe('switchPhase', () => {
  it('saves the outgoing phase, then loads the target phase into root', () => {
    const state = { formato: 'liga', matches: [{ id: 'edited-before-switch' }] };
    const category = {
      phases: [{ id: 'p1', formato: 'liga', matches: [] }, { id: 'p2', formato: 'grupos', matches: [{ id: 'p2-match' }] }],
      activePhaseId: 'p1',
    };
    switchPhase(state, category, 'p2');
    expect(category.activePhaseId).toBe('p2');
    expect(state.matches).toEqual([{ id: 'p2-match' }]);
    expect(category.phases[0].matches).toEqual([{ id: 'edited-before-switch' }]);
  });

  it('is a no-op when switching to the already-active phase', () => {
    const state = { matches: [{ id: 'unsaved' }] };
    const category = { phases: [{ id: 'p1' }], activePhaseId: 'p1' };
    switchPhase(state, category, 'p1');
    expect(state.matches).toEqual([{ id: 'unsaved' }]);
  });

  it('is a no-op when the target id does not exist', () => {
    const state = { matches: [{ id: 'unsaved' }] };
    const category = { phases: [{ id: 'p1' }], activePhaseId: 'p1' };
    switchPhase(state, category, 'ghost');
    expect(category.activePhaseId).toBe('p1');
    expect(state.matches).toEqual([{ id: 'unsaved' }]);
  });
});

describe('setPhaseFormat', () => {
  it('changes the format and clears grupos/matches/bracket', () => {
    const state = { formato: 'liga', matches: [] };
    const category = { phases: [{ id: 'p1', formato: 'liga', grupos: [], matches: [{ id: 'stale' }], bracket: { rounds: [] } }], activePhaseId: 'p1' };
    const result = setPhaseFormat(state, category, 'p1', 'grupos');
    expect(result).toEqual({ ok: true });
    expect(category.phases[0].formato).toBe('grupos');
    expect(category.phases[0].matches).toEqual([]);
    expect(category.phases[0].bracket).toBeNull();
  });

  it('re-syncs root when the changed phase is the active one', () => {
    const state = { formato: 'liga', matches: [{ id: 'old' }] };
    const category = { phases: [{ id: 'p1', formato: 'liga', matches: [{ id: 'old' }] }], activePhaseId: 'p1' };
    setPhaseFormat(state, category, 'p1', 'gxg');
    expect(state.formato).toBe('gxg');
    expect(state.matches).toEqual([]);
  });

  it('reports ok:false for an unknown id', () => {
    const category = { phases: [{ id: 'p1' }], activePhaseId: 'p1' };
    expect(setPhaseFormat({}, category, 'ghost', 'grupos')).toEqual({ ok: false });
  });
});

describe('progression config', () => {
  it('setProgressTarget/Mode/Count build up a progression object', () => {
    const category = { phases: [{ id: 'p1' }] };
    setProgressTarget(category, 'p1', 'p2');
    setProgressMode(category, 'p1', 'perGroup');
    setProgressCount(category, 'p1', '3');
    expect(category.phases[0].progression).toEqual({ targetPhaseId: 'p2', mode: 'perGroup', count: 3 });
  });

  it('setProgressCount floors at 1 and ignores non-numeric input', () => {
    const category = { phases: [{ id: 'p1' }] };
    setProgressCount(category, 'p1', '-5');
    expect(category.phases[0].progression.count).toBe(1);
    setProgressCount(category, 'p1', 'abc');
    expect(category.phases[0].progression.count).toBe(1);
  });

  it('report ok:false for an unknown source phase id', () => {
    const category = { phases: [{ id: 'p1' }] };
    expect(setProgressTarget(category, 'ghost', 'p1')).toEqual({ ok: false });
    expect(setProgressMode(category, 'ghost', 'overall')).toEqual({ ok: false });
    expect(setProgressCount(category, 'ghost', 2)).toEqual({ ok: false });
  });
});

describe('progressionSummary', () => {
  it('reports "not configured" when there is no target', () => {
    expect(progressionSummary({ phases: [] }, {})).toBe('Progressão não configurada');
  });

  it('describes count, mode, and target phase name', () => {
    const category = { phases: [{ id: 'p2', nome: 'Semifinal' }] };
    const phase = { progression: { targetPhaseId: 'p2', mode: 'perGroup', count: 2 } };
    expect(progressionSummary(category, phase)).toBe('2 classificado(s) por grupo → Semifinal');
  });

  it('falls back to "geral" and "fase removida" when unset/missing', () => {
    const category = { phases: [] };
    const phase = { progression: { targetPhaseId: 'ghost', count: 1 } };
    expect(progressionSummary(category, phase)).toBe('1 classificado(s) geral → fase removida');
  });
});
