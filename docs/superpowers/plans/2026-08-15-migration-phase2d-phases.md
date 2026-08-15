# Migration Phase 2d: Phases & Format (liga/grupos/mata-mata) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an organizer split a category into multiple sequential phases (liga/grupos/gxg), each with its own format, matches, and grouping, and configure automatic progression of classified teams from one phase to the next — ported from legacy and wired into `src/pages/championship.js`.

**Architecture:** Sub-phase 2d of Phase 2, tracked at `docs/superpowers/plans/MIGRATION-PROGRESS.md`. Legacy source: `arena-campeonatos-v2-intervencao-19.html:576-632` (phase data model + `viewFases`) and `:637-639` (`roundRobin`/`buildFixtures`/`buildGxg`).

**Rescope vs. the published audit (same pattern as Phase 2a/2b/2c's rescoping):**
- `roundRobin`/`buildFixtures`/`buildGxg` are pulled forward from Phase 3a ("Draw & bracket engine") into this phase, because `generateActivePhase` cannot actually work without them — they're pure, self-contained, and have no dependency on the interactive seeding/draw UI (`drawBracket`/`toggleSeed`/`confirmDraw`/...) that's the rest of 3a's scope.
- `mata` (bracket) format is **excluded** from this phase's format picker and from `generateActivePhase`. Legacy's `mata` branch needs `makeBracketFromOrdered`/`tieObj` (bracket-tie shape owned by Phase 3b) — pulling that forward too would swallow 3a and 3b whole. The format `<select>` in this phase only offers `liga`/`grupos`/`gxg`; `setPhaseFormat`/`generateActivePhase` still accept any format value defensively (so old/foreign data doesn't crash) but the UI never produces `mata`.
- `applyProgression`/`qualifiedFromPhase` are **not ported**. Both need `computeStandings` (Phase 3c, not built yet) to rank teams, and the `mata` branch of `qualifiedFromPhase` also needs `winnerOf` (Phase 3b). Shipping a "Classificar →" button that can't compute who's classified would violate "every ported function must actually work, not stub." This phase ships progression **configuration** only (pick target phase, mode, count — pure data, no computation) so organizers can set it up ahead of time; the actual classify-and-advance action is Phase 3c's job, once standings exist to answer "who's classified."
- `setFmt`/`renderFmtOpts` are **not ported**. They belong to legacy's `setupDraft`/`renderSetup` championship-creation wizard (manual seeding, draw reveal) — a different, already-modernized code path in `src/pages/new-championship.js` that doesn't use the legacy draft/draw flow at all. If a richer creation wizard is ever wanted, that's Phase 3a's concern (it owns the rest of the draw UI), not 2d's.
- `progressBar` (from the audit's function list) does not exist as a standalone function in legacy — it's inline markup inside `viewFases`'s progression row. Covered here the same way, inline in `fasesView()`.

**Data model change:** `state.categories[].matches` (flat, introduced pre-migration) is replaced by `state.categories[].phases[]` (each phase carrying its own `formato`/`cfg`/`grupos`/`matches`/`bracket`/`participantTeamIds`/`progression`), matching legacy's actual shape. `category.matches` is folded into `phases[0].matches` and deleted the first time `ensurePhases` runs on a category that predates this phase — a one-way, lossless migration (same pattern Phase 2a used for `state.teams`/`state.matches` → `category.teams`/`category.matches`).

**Pure vs. DOM split**, continuing the established pattern: `src/app/phases.js` holds phase CRUD/config, no DOM, no engine math. `src/app/engine.js` holds the pure round-robin/fixture math plus `generateActivePhase` (which orchestrates phases.js + categories.js + the math, but is still pure — no DOM). `championship.js` gets a new "Fases" tab.

**Tech Stack:** Same as prior phases — vanilla JS ES modules, Vitest.

## Global Constraints

- Legacy source of truth: `arena-campeonatos-v2-intervencao-19.html:576-632, 637-639`.
- Phase ids use `uid()` from `src/app/utils.js`, same as every other entity.
- Mutating functions return `{ok, reason?, ...}` where they can fail; pure getters/computed values return plain values — matching `src/app/categories.js`/`src/app/roster.js`/`src/app/ops.js`'s established contract.
- `npm run build`, `npm run verify`, `npm test` must all succeed after every task.
- No new UI framework — `data-*` + `bind()`.
- **Every new/changed `class="..."` must be checked against `layout.css`/`tokens.css`** for both the class's own rule and any `<class> <child-selector>` rule, before the task is considered done (standing instruction from Phase 2d onward — see `MIGRATION-PROGRESS.md`'s process note). In particular: `<input>`/`<select>` are only styled inside `.team-row`, `.game-row`, `.ath-row`, `.row`, or as a bare `select` — an input placed directly in a `.card` or a plain `<div>` renders unstyled.

## File Structure

| File | Responsibility |
|---|---|
| `src/app/phases.js` | Pure functions: `PHASE_FORMATS`, `ensurePhases`, `loadPhaseIntoRoot`, `saveRootIntoPhase`, `activePhaseOf`, `phaseParticipants`, `phaseComplete`, `addPhase`, `renamePhase`, `removePhase`, `switchPhase`, `setPhaseFormat`, `setProgressTarget`, `setProgressMode`, `setProgressCount`, `progressionSummary` — no DOM |
| `src/app/phases.test.js` | Tests for the above |
| `src/app/engine.js` | Pure functions: `roundRobin`, `buildFixtures`, `buildGxg`, `generateActivePhase` — no DOM |
| `src/app/engine.test.js` | Tests for the above |
| `src/app/categories.js` | Modify: `ensureCategories`/`loadCategoryIntoRoot`/`saveRootIntoActive`/`addCategory` route through `phases.js` instead of a flat `category.matches` |
| `src/app/categories.test.js` | Modify: update assertions for the new `category.phases[]` shape |
| `src/pages/championship.js` | Modify: new "Fases" tab (`fasesView()`); `data-generate` (Jogos tab) now calls `generateActivePhase` instead of its ad-hoc round-robin loop |

---

### Task 1: Pure phase functions — `src/app/phases.js`

**Files:**
- Create: `src/app/phases.js`
- Create: `src/app/phases.test.js`

**Interfaces:**
- Consumes: `clone`, `uid` from `./utils.js`.
- Produces: `PHASE_FORMATS: [key,label][]`, `ensurePhases(category, state): category`, `loadPhaseIntoRoot(state, phase): void`, `saveRootIntoPhase(state, phase): void`, `activePhaseOf(category): phase|undefined`, `phaseParticipants(state, phase): number[]`, `phaseComplete(phase): boolean`, `addPhase(state, category): phase`, `renamePhase(category, id, name): {ok}`, `removePhase(state, category, id): {ok, reason?}`, `switchPhase(state, category, id): category`, `setPhaseFormat(state, category, id, fmt): {ok}`, `setProgressTarget(category, srcId, targetId): {ok}`, `setProgressMode(category, srcId, mode): {ok}`, `setProgressCount(category, srcId, count): {ok}`, `progressionSummary(category, phase): string` — all imported by Task 2 (`engine.js`) and Task 3/4 (`categories.js`/`championship.js`).

- [ ] **Step 1: Write the failing tests**

Create `src/app/phases.test.js`:
```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- phases`
Expected: FAIL — `Cannot find module './phases.js'`.

- [ ] **Step 3: Implement `src/app/phases.js`**

Adapted from legacy `ensurePhases`/`newPhaseFromRoot`/`phaseSnapshot`/`loadPhaseIntoRoot`/`saveRootIntoActive`(phase half)/`activePhase`/`phaseParticipants`/`phaseComplete`/`addPhase`/`renamePhase`/`removePhase`/`switchPhase`/`setPhaseFormat`/`setProgressTarget`/`setProgressMode`/`setProgressCount`/`progressionSummary` (`:576-621`), converted to the `state`-param + `{ok, ...}` contract already established by `categories.js`/`ops.js`:

```js
import { clone, uid } from './utils.js';

export const PHASE_FORMATS = [
  ['liga', 'Pontos Corridos'],
  ['grupos', 'Fase de Grupos'],
  ['gxg', 'Grupo × Grupo'],
];

function blankPhase(state, nome, ordem) {
  return {
    id: uid(),
    nome,
    ordem,
    status: 'planejada',
    formato: 'liga',
    cfg: clone(state.cfg || {}),
    grupos: [],
    matches: [],
    bracket: null,
    participantTeamIds: null,
    progression: null,
  };
}

export function ensurePhases(category, state) {
  if (!Array.isArray(category.phases) || !category.phases.length) {
    const phase = {
      id: uid(),
      nome: 'Fase principal',
      ordem: 1,
      status: 'planejada',
      formato: state.formato || 'liga',
      cfg: clone(state.cfg || {}),
      grupos: [],
      matches: clone(category.matches || []),
      bracket: null,
      participantTeamIds: null,
      progression: null,
    };
    category.phases = [phase];
    category.activePhaseId = phase.id;
    delete category.matches;
  }
  if (!category.activePhaseId || !category.phases.some((p) => p.id === category.activePhaseId)) {
    category.activePhaseId = category.phases[0].id;
  }
  return category;
}

export function loadPhaseIntoRoot(state, phase) {
  state.formato = phase.formato || 'liga';
  state.cfg = clone(phase.cfg || {});
  state.grupos = clone(phase.grupos || []);
  state.matches = clone(phase.matches || []);
  state.bracket = phase.bracket ? clone(phase.bracket) : null;
}

export function saveRootIntoPhase(state, phase) {
  if (!phase) return;
  const keepParticipants = phase.participantTeamIds;
  const keepProgression = phase.progression;
  phase.formato = state.formato || 'liga';
  phase.cfg = clone(state.cfg || {});
  phase.grupos = clone(state.grupos || []);
  phase.matches = clone(state.matches || []);
  phase.bracket = state.bracket ? clone(state.bracket) : null;
  phase.participantTeamIds = keepParticipants || null;
  phase.progression = keepProgression || null;
}

export function activePhaseOf(category) {
  return (category.phases || []).find((p) => p.id === category.activePhaseId) || (category.phases || [])[0];
}

export function phaseParticipants(state, phase) {
  const ids = phase && Array.isArray(phase.participantTeamIds) && phase.participantTeamIds.length
    ? phase.participantTeamIds
    : null;
  const teams = state.teams || [];
  return ids
    ? ids.map((id) => teams.findIndex((t) => t.id === id)).filter((i) => i >= 0)
    : teams.map((_, i) => i);
}

export function phaseComplete(phase) {
  if (!phase) return false;
  // mata (bracket) completion needs winnerOf/tieObj — Phase 3a/3b. Unreachable today:
  // the format picker never offers 'mata' yet (see this plan's Rescope note).
  if (phase.formato === 'mata') return false;
  return (phase.matches || []).length > 0 && (phase.matches || []).every((m) => m.hg != null && m.ag != null);
}

export function addPhase(state, category) {
  ensurePhases(category, state);
  saveRootIntoPhase(state, activePhaseOf(category));
  const ordem = category.phases.length + 1;
  const phase = blankPhase(state, `Fase ${ordem}`, ordem);
  category.phases.push(phase);
  category.activePhaseId = phase.id;
  loadPhaseIntoRoot(state, phase);
  return phase;
}

export function renamePhase(category, id, name) {
  const phase = (category.phases || []).find((p) => p.id === id);
  if (!phase) return { ok: false };
  phase.nome = (name || '').trim() || 'Fase';
  return { ok: true };
}

export function removePhase(state, category, id) {
  if (category.phases.length <= 1) {
    return { ok: false, reason: 'A categoria precisa ter pelo menos uma fase.' };
  }
  saveRootIntoPhase(state, activePhaseOf(category));
  category.phases = category.phases.filter((p) => p.id !== id);
  if (category.activePhaseId === id) {
    category.activePhaseId = category.phases[0].id;
    loadPhaseIntoRoot(state, category.phases[0]);
  }
  return { ok: true };
}

export function switchPhase(state, category, id) {
  if (category.activePhaseId === id) return category;
  const phase = (category.phases || []).find((p) => p.id === id);
  if (!phase) return category;
  saveRootIntoPhase(state, activePhaseOf(category));
  category.activePhaseId = id;
  loadPhaseIntoRoot(state, phase);
  return category;
}

export function setPhaseFormat(state, category, id, fmt) {
  saveRootIntoPhase(state, activePhaseOf(category));
  const phase = (category.phases || []).find((p) => p.id === id);
  if (!phase) return { ok: false };
  phase.formato = fmt;
  phase.grupos = [];
  phase.matches = [];
  phase.bracket = null;
  if (category.activePhaseId === id) loadPhaseIntoRoot(state, phase);
  return { ok: true };
}

export function setProgressTarget(category, srcId, targetId) {
  const phase = (category.phases || []).find((p) => p.id === srcId);
  if (!phase) return { ok: false };
  phase.progression = phase.progression || {};
  phase.progression.targetPhaseId = targetId || null;
  return { ok: true };
}

export function setProgressMode(category, srcId, mode) {
  const phase = (category.phases || []).find((p) => p.id === srcId);
  if (!phase) return { ok: false };
  phase.progression = phase.progression || {};
  phase.progression.mode = mode;
  phase.progression.count = phase.progression.count || 2;
  return { ok: true };
}

export function setProgressCount(category, srcId, count) {
  const phase = (category.phases || []).find((p) => p.id === srcId);
  if (!phase) return { ok: false };
  phase.progression = phase.progression || {};
  phase.progression.count = Math.max(1, +count || 1);
  return { ok: true };
}

export function progressionSummary(category, phase) {
  if (!phase.progression || !phase.progression.targetPhaseId) return 'Progressão não configurada';
  const target = (category.phases || []).find((p) => p.id === phase.progression.targetPhaseId);
  const mode = phase.progression.mode === 'perGroup' ? 'por grupo' : 'geral';
  return `${phase.progression.count || 2} classificado(s) ${mode} → ${target ? target.nome : 'fase removida'}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- phases`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/phases.js src/app/phases.test.js
git commit -m "feat: port phase CRUD/format/progression-config data model from legacy"
```

---

### Task 2: Pure fixture engine — `src/app/engine.js`

**Files:**
- Create: `src/app/engine.js`
- Create: `src/app/engine.test.js`

**Interfaces:**
- Consumes: `uid` from `./utils.js`; `activeCategory`, `saveRootIntoActive` from `./categories.js`; `ensurePhases`, `activePhaseOf`, `phaseParticipants`, `loadPhaseIntoRoot` from `./phases.js`.
- Produces: `roundRobin(indices): number[][][]`, `buildFixtures(idxs, turnos): match[]`, `buildGxg(idxsA, idxsB, turnos): match[]`, `generateActivePhase(state): {ok, reason?}` — imported by Task 4 (`championship.js`).

Note: this task depends on Task 3 (`categories.js`'s `activeCategory`/`saveRootIntoActive`) only through *imports*, not through any code change to `categories.js` — write this task's code now, referencing the existing `categories.js` exports (unchanged names, already present today). Task 3 changes what `saveRootIntoActive` does internally, not its signature.

- [ ] **Step 1: Write the failing tests**

Create `src/app/engine.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { roundRobin, buildFixtures, buildGxg, generateActivePhase } from './engine.js';

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
    const result = generateActivePhase(state);
    expect(result).toEqual({ ok: false, reason: 'Interzonas precisa de pelo menos 4 equipes.' });
  });

  it('generates a gxg phase split into two groups of teams', () => {
    const state = championship();
    state.categories[0].phases[0].formato = 'gxg';
    const result = generateActivePhase(state);
    expect(result).toEqual({ ok: true });
    expect(state.grupos).toHaveLength(2);
    expect(state.matches).toHaveLength(4);
  });

  it('reports ok:false for an unsupported format (mata — deferred to Phase 3a)', () => {
    const state = championship();
    state.categories[0].phases[0].formato = 'mata';
    const result = generateActivePhase(state);
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- engine`
Expected: FAIL — `Cannot find module './engine.js'`.

- [ ] **Step 3: Implement `src/app/engine.js`**

Adapted from legacy `roundRobin`/`buildFixtures`/`buildGxg` (`:637-639`, converted from the mutate-`d.matches` legacy shape to a pure return value) and `generateActivePhase` (`:622-630`, `mata` branch replaced with an explicit rejection per this plan's Rescope note):

```js
import { uid } from './utils.js';
import { activeCategory, saveRootIntoActive } from './categories.js';
import { ensurePhases, activePhaseOf, phaseParticipants, loadPhaseIntoRoot } from './phases.js';

export function roundRobin(teams) {
  let t = teams.slice();
  const bye = t.length % 2 !== 0;
  if (bye) t.push(-1);
  const n = t.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const g = [];
    for (let i = 0; i < n / 2; i++) {
      let h = t[i], a = t[n - 1 - i];
      if (h !== -1 && a !== -1) {
        if (r % 2 === 1 && i === 0) [h, a] = [a, h];
        g.push([h, a]);
      }
    }
    rounds.push(g);
    t.splice(1, 0, t.pop());
  }
  return rounds;
}

export function buildFixtures(idxs, turnos) {
  let rounds = roundRobin(idxs);
  if (turnos >= 2) rounds = rounds.concat(rounds.map((g) => g.map(([h, a]) => [a, h])));
  const matches = [];
  rounds.forEach((g, ri) => g.forEach(([h, a]) => matches.push({ id: uid(), rodada: ri + 1, home: h, away: a, hg: null, ag: null, info: '', scorers: [] })));
  return matches;
}

export function buildGxg(idxsA, idxsB, turnos) {
  const matches = [];
  idxsA.forEach((a, ai) => idxsB.forEach((b) => matches.push({ id: uid(), rodada: ai + 1, home: a, away: b, hg: null, ag: null, info: '', scorers: [] })));
  if (turnos >= 2) idxsA.forEach((a, ai) => idxsB.forEach((b) => matches.push({ id: uid(), rodada: idxsA.length + ai + 1, home: b, away: a, hg: null, ag: null, info: '', scorers: [] })));
  return matches;
}

export function generateActivePhase(state) {
  saveRootIntoActive(state);
  const category = activeCategory(state);
  ensurePhases(category, state);
  const phase = activePhaseOf(category);
  const participants = phaseParticipants(state, phase);
  if (participants.length < 2) return { ok: false, reason: 'A fase precisa ter pelo menos 2 equipes participantes.' };
  const teams = state.teams || [];
  const turnos = (phase.cfg && phase.cfg.turnos) || 1;
  phase.grupos = [];
  phase.matches = [];
  phase.bracket = null;
  if (phase.formato === 'liga') {
    phase.matches = buildFixtures(participants, turnos);
  } else if (phase.formato === 'grupos') {
    const ng = Math.max(1, Math.min((phase.cfg && phase.cfg.nGrupos) || 2, participants.length));
    phase.grupos = Array.from({ length: ng }, () => []);
    participants.forEach((ti, i) => phase.grupos[i % ng].push(teams[ti].id));
    phase.grupos.forEach((group, gi) => {
      const idxs = group.map((id) => teams.findIndex((t) => t.id === id));
      buildFixtures(idxs, turnos).forEach((match) => { match.grupo = gi; phase.matches.push(match); });
    });
  } else if (phase.formato === 'gxg') {
    if (participants.length < 4) return { ok: false, reason: 'Interzonas precisa de pelo menos 4 equipes.' };
    const groups = [[], []];
    participants.forEach((ti, i) => groups[i % 2].push(teams[ti].id));
    phase.grupos = groups;
    const idxsA = groups[0].map((id) => teams.findIndex((t) => t.id === id));
    const idxsB = groups[1].map((id) => teams.findIndex((t) => t.id === id));
    phase.matches = buildGxg(idxsA, idxsB, turnos);
  } else {
    return { ok: false, reason: 'Este formato ainda não está disponível nesta fase da migração.' };
  }
  phase.status = 'andamento';
  loadPhaseIntoRoot(state, phase);
  return { ok: true };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- engine`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/engine.js src/app/engine.test.js
git commit -m "feat: port round-robin/gxg fixture engine and generateActivePhase from legacy"
```

---

### Task 3: Route `src/app/categories.js` through phases

**Files:**
- Modify: `src/app/categories.js`
- Modify: `src/app/categories.test.js`

**Interfaces:**
- Consumes (new): `ensurePhases`, `loadPhaseIntoRoot`, `saveRootIntoPhase`, `activePhaseOf` from `./phases.js`.
- Produces: same exports and signatures as before (`ensureCategories`, `activeCategory`, `loadCategoryIntoRoot`, `saveRootIntoActive`, `switchCategory`, `addCategory`, `renameCategory`, `removeCategory`) — callers in `championship.js` and `engine.js` are unaffected by this task.

- [ ] **Step 1: Update the tests for the new `category.phases[]` shape**

Replace `src/app/categories.test.js` in full:
```js
import { describe, it, expect } from 'vitest';
import {
  ensureCategories, activeCategory, loadCategoryIntoRoot, saveRootIntoActive,
  switchCategory, addCategory, renameCategory, removeCategory,
} from './categories.js';

function championship(overrides = {}) {
  return { teams: [{ id: 't1', nome: 'Equipe A' }], matches: [{ id: 'm1', home: 0, away: 0 }], formato: 'liga', cfg: { turnos: 1 }, ...overrides };
}

describe('ensureCategories', () => {
  it('migrates flat teams/matches into a first category, with matches folded into its first phase', () => {
    const state = championship();
    ensureCategories(state);
    expect(state.categories).toHaveLength(1);
    expect(state.categories[0].nome).toBe('Categoria principal');
    expect(state.categories[0].teams).toEqual([{ id: 't1', nome: 'Equipe A' }]);
    expect(state.categories[0].matches).toBeUndefined();
    expect(state.categories[0].phases).toHaveLength(1);
    expect(state.categories[0].phases[0].matches).toEqual([{ id: 'm1', home: 0, away: 0 }]);
    expect(state.activeCategoryId).toBe(state.categories[0].id);
  });

  it('does not duplicate categories on a second call', () => {
    const state = championship();
    ensureCategories(state);
    const firstId = state.categories[0].id;
    ensureCategories(state);
    expect(state.categories).toHaveLength(1);
    expect(state.categories[0].id).toBe(firstId);
  });

  it('repairs an activeCategoryId pointing at a category that no longer exists', () => {
    const state = championship({ categories: [{ id: 'c1', nome: 'A', teams: [], matches: [] }], activeCategoryId: 'ghost' });
    ensureCategories(state);
    expect(state.activeCategoryId).toBe('c1');
  });

  it('leaves an already-valid activeCategoryId untouched', () => {
    const state = championship({ categories: [{ id: 'c1', nome: 'A', teams: [], matches: [] }, { id: 'c2', nome: 'B', teams: [], matches: [] }], activeCategoryId: 'c2' });
    ensureCategories(state);
    expect(state.activeCategoryId).toBe('c2');
  });

  it('ensures phases on every pre-existing category, not just the active one', () => {
    const state = championship({ categories: [{ id: 'c1', nome: 'A', teams: [], matches: [] }, { id: 'c2', nome: 'B', teams: [], matches: [] }], activeCategoryId: 'c1' });
    ensureCategories(state);
    expect(state.categories[0].phases).toHaveLength(1);
    expect(state.categories[1].phases).toHaveLength(1);
  });
});

describe('activeCategory', () => {
  it('returns the category matching activeCategoryId', () => {
    const state = { categories: [{ id: 'c1', nome: 'A' }, { id: 'c2', nome: 'B' }], activeCategoryId: 'c2' };
    expect(activeCategory(state).nome).toBe('B');
  });

  it('falls back to the first category when activeCategoryId matches nothing', () => {
    const state = { categories: [{ id: 'c1', nome: 'A' }], activeCategoryId: 'ghost' };
    expect(activeCategory(state).nome).toBe('A');
  });
});

describe('loadCategoryIntoRoot / saveRootIntoActive', () => {
  it('loadCategoryIntoRoot copies teams and the active phase\'s matches onto root', () => {
    const category = { id: 'c1', teams: [{ id: 't1', nome: 'A' }], phases: [{ id: 'p1', formato: 'liga', matches: [{ id: 'm1' }] }], activePhaseId: 'p1' };
    const state = { teams: [], matches: [] };
    loadCategoryIntoRoot(state, category);
    expect(state.teams).toEqual(category.teams);
    expect(state.teams).not.toBe(category.teams);
    expect(state.matches).toEqual([{ id: 'm1' }]);
    expect(state.formato).toBe('liga');
  });

  it('saveRootIntoActive writes a deep clone of teams and the phase snapshot back into the active category', () => {
    const category = { id: 'c1', teams: [], phases: [{ id: 'p1', formato: 'liga', matches: [] }], activePhaseId: 'p1' };
    const state = { categories: [category], activeCategoryId: 'c1', teams: [{ id: 't1', nome: 'Edited' }], formato: 'liga', matches: [{ id: 'new-match' }] };
    saveRootIntoActive(state);
    expect(state.categories[0].teams).toEqual([{ id: 't1', nome: 'Edited' }]);
    expect(state.categories[0].teams).not.toBe(state.teams);
    expect(state.categories[0].phases[0].matches).toEqual([{ id: 'new-match' }]);
  });
});

describe('switchCategory', () => {
  it('saves the outgoing category (teams + active phase), then loads the target category into root', () => {
    const state = {
      categories: [
        { id: 'c1', nome: 'A', teams: [{ id: 't1', nome: 'Original' }], phases: [{ id: 'p1', formato: 'liga', matches: [] }], activePhaseId: 'p1' },
        { id: 'c2', nome: 'B', teams: [{ id: 't2', nome: 'Team B' }], phases: [{ id: 'p2', formato: 'liga', matches: [] }], activePhaseId: 'p2' },
      ],
      activeCategoryId: 'c1',
      teams: [{ id: 't1', nome: 'Edited before switch' }],
      formato: 'liga', matches: [],
    };
    switchCategory(state, 'c2');
    expect(state.activeCategoryId).toBe('c2');
    expect(state.teams).toEqual([{ id: 't2', nome: 'Team B' }]);
    expect(state.categories[0].teams).toEqual([{ id: 't1', nome: 'Edited before switch' }]);
  });

  it('is a no-op when switching to the already-active category', () => {
    const state = { categories: [{ id: 'c1', teams: [{ id: 't1' }], phases: [{ id: 'p1', matches: [] }], activePhaseId: 'p1' }], activeCategoryId: 'c1', teams: [{ id: 'unsaved-edit' }], matches: [] };
    switchCategory(state, 'c1');
    expect(state.teams).toEqual([{ id: 'unsaved-edit' }]);
  });

  it('is a no-op when the target id does not exist', () => {
    const state = { categories: [{ id: 'c1', teams: [], phases: [{ id: 'p1', matches: [] }], activePhaseId: 'p1' }], activeCategoryId: 'c1', teams: [{ id: 'unsaved-edit' }], matches: [] };
    switchCategory(state, 'ghost');
    expect(state.activeCategoryId).toBe('c1');
    expect(state.teams).toEqual([{ id: 'unsaved-edit' }]);
  });
});

describe('addCategory', () => {
  it('appends a new category with one blank liga phase, saving the outgoing one first, and switches to it', () => {
    const state = { categories: [{ id: 'c1', nome: 'A', teams: [], phases: [{ id: 'p1', formato: 'liga', matches: [] }], activePhaseId: 'p1' }], activeCategoryId: 'c1', teams: [{ id: 'edited' }], formato: 'liga', cfg: {}, matches: [] };
    addCategory(state);
    expect(state.categories).toHaveLength(2);
    expect(state.categories[0].teams).toEqual([{ id: 'edited' }]);
    expect(state.categories[1].nome).toBe('Categoria 2');
    expect(state.categories[1].teams).toEqual([]);
    expect(state.categories[1].phases).toHaveLength(1);
    expect(state.categories[1].phases[0].nome).toBe('Fase principal');
    expect(state.activeCategoryId).toBe(state.categories[1].id);
    expect(state.teams).toEqual([]);
  });
});

describe('renameCategory', () => {
  it('trims the name', () => {
    const state = { categories: [{ id: 'c1', nome: 'A' }] };
    renameCategory(state, 'c1', '  Sub-15  ');
    expect(state.categories[0].nome).toBe('Sub-15');
  });

  it('falls back to "Categoria" for a blank name', () => {
    const state = { categories: [{ id: 'c1', nome: 'A' }] };
    renameCategory(state, 'c1', '   ');
    expect(state.categories[0].nome).toBe('Categoria');
  });

  it('is a no-op when the id does not exist', () => {
    const state = { categories: [{ id: 'c1', nome: 'A' }] };
    renameCategory(state, 'ghost', 'New name');
    expect(state.categories[0].nome).toBe('A');
  });
});

describe('removeCategory', () => {
  it('refuses to remove the last remaining category', () => {
    const state = { categories: [{ id: 'c1', nome: 'A', teams: [], phases: [{ id: 'p1', matches: [] }], activePhaseId: 'p1' }], activeCategoryId: 'c1', teams: [], matches: [] };
    const result = removeCategory(state, 'c1');
    expect(result).toEqual({ ok: false, reason: 'O campeonato precisa ter pelo menos uma categoria.' });
    expect(state.categories).toHaveLength(1);
  });

  it('removes a non-active category without disturbing root state', () => {
    const state = { categories: [{ id: 'c1', nome: 'A', teams: [], phases: [{ id: 'p1', matches: [] }], activePhaseId: 'p1' }, { id: 'c2', nome: 'B', teams: [], phases: [{ id: 'p2', matches: [] }], activePhaseId: 'p2' }], activeCategoryId: 'c1', teams: [{ id: 'active-edit' }], matches: [] };
    const result = removeCategory(state, 'c2');
    expect(result).toEqual({ ok: true });
    expect(state.categories.map((c) => c.id)).toEqual(['c1']);
    expect(state.activeCategoryId).toBe('c1');
  });

  it('removing the active category switches root to the new first category', () => {
    const state = { categories: [{ id: 'c1', nome: 'A', teams: [{ id: 'from-a' }], phases: [{ id: 'p1', formato: 'liga', matches: [] }], activePhaseId: 'p1' }, { id: 'c2', nome: 'B', teams: [{ id: 'from-b' }], phases: [{ id: 'p2', matches: [] }], activePhaseId: 'p2' }], activeCategoryId: 'c2', teams: [{ id: 'unsaved' }], matches: [] };
    const result = removeCategory(state, 'c2');
    expect(result).toEqual({ ok: true });
    expect(state.categories.map((c) => c.id)).toEqual(['c1']);
    expect(state.activeCategoryId).toBe('c1');
    expect(state.teams).toEqual([{ id: 'from-a' }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- categories`
Expected: FAIL — old `categories.js` still stores flat `category.matches`, so the new phase-shaped assertions don't match.

- [ ] **Step 3: Implement the changes in `src/app/categories.js`**

Replace `src/app/categories.js` in full:
```js
import { clone, uid } from './utils.js';
import { ensurePhases, loadPhaseIntoRoot, saveRootIntoPhase, activePhaseOf } from './phases.js';

export function ensureCategories(state) {
  if (!state) return state;
  if (!Array.isArray(state.categories) || !state.categories.length) {
    const category = {
      id: uid(),
      nome: 'Categoria principal',
      ordem: 1,
      teams: clone(state.teams || []),
      matches: clone(state.matches || []),
    };
    state.categories = [category];
    state.activeCategoryId = category.id;
  }
  if (!state.activeCategoryId || !state.categories.some((category) => category.id === state.activeCategoryId)) {
    state.activeCategoryId = state.categories[0].id;
  }
  state.categories.forEach((category) => {
    if (!Array.isArray(category.teams)) category.teams = clone(state.teams || []);
    ensurePhases(category, state);
  });
  return state;
}

export function activeCategory(state) {
  return (state.categories || []).find((category) => category.id === state.activeCategoryId) || (state.categories || [])[0];
}

export function loadCategoryIntoRoot(state, category) {
  ensurePhases(category, state);
  state.teams = clone(category.teams || []);
  loadPhaseIntoRoot(state, activePhaseOf(category));
}

export function saveRootIntoActive(state) {
  const category = activeCategory(state);
  if (!category) return;
  ensurePhases(category, state);
  category.teams = clone(state.teams || []);
  saveRootIntoPhase(state, activePhaseOf(category));
}

export function switchCategory(state, id) {
  if (!state || state.activeCategoryId === id) return state;
  const category = state.categories.find((item) => item.id === id);
  if (!category) return state;
  saveRootIntoActive(state);
  state.activeCategoryId = id;
  loadCategoryIntoRoot(state, category);
  return state;
}

export function addCategory(state) {
  saveRootIntoActive(state);
  const phase = {
    id: uid(),
    nome: 'Fase principal',
    ordem: 1,
    status: 'planejada',
    formato: 'liga',
    cfg: clone(state.cfg || {}),
    grupos: [],
    matches: [],
    bracket: null,
    participantTeamIds: null,
    progression: null,
  };
  const category = {
    id: uid(),
    nome: `Categoria ${state.categories.length + 1}`,
    ordem: state.categories.length + 1,
    teams: [],
    phases: [phase],
    activePhaseId: phase.id,
  };
  state.categories.push(category);
  state.activeCategoryId = category.id;
  loadCategoryIntoRoot(state, category);
  return state;
}

export function renameCategory(state, id, name) {
  const category = state.categories.find((item) => item.id === id);
  if (!category) return state;
  category.nome = (name || '').trim() || 'Categoria';
  return state;
}

export function removeCategory(state, id) {
  if (state.categories.length <= 1) {
    return { ok: false, reason: 'O campeonato precisa ter pelo menos uma categoria.' };
  }
  saveRootIntoActive(state);
  state.categories = state.categories.filter((category) => category.id !== id);
  if (state.activeCategoryId === id) {
    state.activeCategoryId = state.categories[0].id;
    loadCategoryIntoRoot(state, state.categories[0]);
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- categories`
Expected: all tests pass.

- [ ] **Step 5: Run the full suite (catches any other module relying on `category.matches`)**

Run: `npm test`
Expected: all tests pass — `grep -rn "category.matches\|\.matches\b" src/pages/championship.js` first to confirm nothing else reads `category.matches` directly (only `state.matches`, the root mirror, which still works unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/app/categories.js src/app/categories.test.js
git commit -m "refactor: route category match data through phases, matching legacy's shape"
```

---

### Task 4: Wire the "Fases" tab and the fixture engine into `src/pages/championship.js`

**Files:**
- Modify: `src/pages/championship.js`

**Interfaces:**
- Consumes: `PHASE_FORMATS`, `addPhase`, `renamePhase`, `removePhase`, `switchPhase`, `setPhaseFormat`, `setProgressTarget`, `setProgressMode`, `setProgressCount`, `progressionSummary` from `../app/phases.js`; `generateActivePhase` from `../app/engine.js`.

No new automated tests (DOM wiring; Tasks 1–2's suites cover the logic). Same "no live browser in this sandbox" fallback as prior phases — verify by inspection, report `DONE_WITH_CONCERNS` if so.

- [ ] **Step 1: Add the imports**

Add to the import block:
```js
import { PHASE_FORMATS, addPhase, renamePhase, removePhase, switchPhase, setPhaseFormat, setProgressTarget, setProgressMode, setProgressCount, progressionSummary } from '../app/phases.js';
import { generateActivePhase } from '../app/engine.js';
```

- [ ] **Step 2: Add a "Fases" tab**

In `mount()`'s tab list, insert `['fases','Fases']` right after `['categorias','Categorias']`:
```js
<nav class="championship-tabs">${[['overview','Visão geral'],['categorias','Categorias'],['fases','Fases'],['jogos','Jogos'],['classif','Tabela'],['equipes','Equipes'],['inscricoes','Inscrições'],['publicacao','Publicação'],['historico','Histórico'],['config','Configurações']].map(([key,label]) => `<button data-tab="${key}">${label}</button>`).join('')}</nav>
```

In `render()`'s ternary dispatch, add the `fases` branch right after `categorias`:
```js
content.innerHTML = tab === 'overview' ? overview() : tab === 'categorias' ? categoriesView() : tab === 'fases' ? fasesView() : tab === 'jogos' ? games() : tab === 'classif' ? standings() : tab === 'equipes' ? teams() : tab === 'inscricoes' ? registrationsView() : tab === 'publicacao' ? '<div class="card"><h2>Publicação</h2><p class="muted">Copie os links públicos para divulgar o campeonato.</p><button class="btn primary" data-publication>Abrir central de publicação</button></div>' : tab === 'historico' ? auditView() : config();
```

- [ ] **Step 3: Add `fasesView()`**

Add alongside the other view functions (e.g. right after `categoriesView()`). Every `<input>`/`<select>` here is a direct child of a `.row` (or a bare `select`, styled unconditionally) — no fixed-column `.team-row` used, since a phase row's child count varies with how many later phases exist for progression config:
```js
function fasesView() { const category = activeCategory(state); const phases = category.phases || []; return `<div class="card"><div class="actions" style="justify-content:space-between"><div><h2>Fases</h2><p class="muted">Configure o formato da disputa e a passagem automática dos classificados para a próxima fase.</p></div><button class="btn primary" data-add-phase>+ Nova fase</button></div><div style="margin-top:18px">${phases.map((phase, pi) => { const later = phases.filter((_, i) => i > pi); const prog = phase.progression || {}; const participantsCount = (phase.participantTeamIds && phase.participantTeamIds.length) || (state.teams || []).length; return `<div style="padding:14px 0;border-bottom:1px solid var(--line)"><div class="row" style="flex-wrap:wrap"><input data-phase-name="${esc(phase.id)}" value="${esc(phase.nome)}" style="flex:1;min-width:180px;font-weight:700"><select data-phase-format="${esc(phase.id)}">${PHASE_FORMATS.map(([key, label]) => `<option value="${key}" ${phase.formato === key ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select><span class="muted">${phase.status === 'andamento' ? 'Em andamento' : 'Planejada'} · ${(phase.matches || []).length} jogos · ${participantsCount} participantes</span><button class="btn ghost sm" data-switch-phase="${esc(phase.id)}">Abrir</button>${phase.id === category.activePhaseId ? `<button class="btn gold sm" data-generate-phase>Gerar/Refazer</button>` : ''}${phases.length > 1 ? `<button class="btn ghost sm" data-remove-phase="${esc(phase.id)}">Excluir</button>` : ''}</div>${later.length ? `<div class="row" style="flex-wrap:wrap;margin-top:10px"><select data-progress-target="${esc(phase.id)}"><option value="">Progressão não configurada</option>${later.map((t) => `<option value="${esc(t.id)}" ${prog.targetPhaseId === t.id ? 'selected' : ''}>→ ${esc(t.nome)}</option>`).join('')}</select><select data-progress-mode="${esc(phase.id)}"><option value="overall" ${prog.mode !== 'perGroup' ? 'selected' : ''}>Melhores no geral</option>${phase.formato === 'grupos' ? `<option value="perGroup" ${prog.mode === 'perGroup' ? 'selected' : ''}>Melhores de cada grupo</option>` : ''}</select><input type="number" min="1" data-progress-count="${esc(phase.id)}" value="${prog.count || 2}" style="width:70px"><span class="muted">${esc(progressionSummary(category, phase))}</span></div>` : ''}</div>`; }).join('')}</div></div>`; }
```

- [ ] **Step 4: Wire the Fases tab's handlers in `bind()`**

Add to `bind()`:
```js
const addPhaseBtn = root.querySelector('[data-add-phase]'); if (addPhaseBtn) addPhaseBtn.onclick = async () => { addPhase(state, activeCategory(state)); tab = 'fases'; await persist(); await addAudit(state.id, 'phase_added', 'Fase criada'); render(); };
root.querySelectorAll('[data-phase-name]').forEach((input) => input.onchange = async () => { renamePhase(activeCategory(state), input.dataset.phaseName, input.value); await persist(); await addAudit(state.id, 'phase_renamed', 'Fase renomeada'); });
root.querySelectorAll('[data-phase-format]').forEach((select) => select.onchange = async () => { setPhaseFormat(state, activeCategory(state), select.dataset.phaseFormat, select.value); await persist(); await addAudit(state.id, 'phase_format_changed', 'Formato da fase alterado'); render(); });
root.querySelectorAll('[data-switch-phase]').forEach((button) => button.onclick = async () => { switchPhase(state, activeCategory(state), button.dataset.switchPhase); tab = 'overview'; await persist(); render(); });
root.querySelectorAll('[data-remove-phase]').forEach((button) => button.onclick = async () => { if (!confirm('Excluir esta fase e todos os jogos vinculados a ela?')) return; const result = removePhase(state, activeCategory(state), button.dataset.removePhase); if (!result.ok) return toast(result.reason); await persist(); await addAudit(state.id, 'phase_removed', 'Fase excluída'); render(); });
const generatePhaseBtn = root.querySelector('[data-generate-phase]'); if (generatePhaseBtn) generatePhaseBtn.onclick = async () => { const result = generateActivePhase(state); if (!result.ok) return toast(result.reason); await persist(); await addAudit(state.id, 'phase_generated', 'Jogos da fase gerados'); render(); };
root.querySelectorAll('[data-progress-target]').forEach((select) => select.onchange = async () => { setProgressTarget(activeCategory(state), select.dataset.progressTarget, select.value); await persist(); render(); });
root.querySelectorAll('[data-progress-mode]').forEach((select) => select.onchange = async () => { setProgressMode(activeCategory(state), select.dataset.progressMode, select.value); await persist(); render(); });
root.querySelectorAll('[data-progress-count]').forEach((input) => input.onchange = async () => { setProgressCount(activeCategory(state), input.dataset.progressCount, input.value); await persist(); });
```

- [ ] **Step 5: Replace the Jogos tab's ad-hoc round-robin with `generateActivePhase`**

Find the existing `data-generate` handler in `bind()`:
```js
const generate = root.querySelector('[data-generate]'); if (generate) generate.onclick = () => { if ((state.teams || []).length < 2) return toast('Cadastre pelo menos duas equipes.'); state.matches = []; for (let home = 0; home < state.teams.length; home++) for (let away = home + 1; away < state.teams.length; away++) state.matches.push({ id: uid(), home, away, hg: null, ag: null, rodada: 1 }); render(); };
```
Replace it with (drops the placeholder nested-loop pairing — which ignored phase format entirely — in favor of the real engine, shared with the Fases tab's "Gerar/Refazer" button):
```js
const generate = root.querySelector('[data-generate]'); if (generate) generate.onclick = async () => { const result = generateActivePhase(state); if (!result.ok) return toast(result.reason); await persist(); await addAudit(state.id, 'games_generated', 'Jogos gerados'); render(); };
```

- [ ] **Step 6: CSS check**

Every element added in Step 3 is either a bare `<select>` (styled unconditionally by `layout.css`'s `select` rule) or a direct child of a `.row` div (styled by `.row input`). No new CSS class introduced, no `.team-row` used (its fixed 4-column grid doesn't fit a row whose child count varies). Confirm by re-reading the markup in Step 3 before moving on — every `<input>` must be a `.row`'s direct child, not nested inside another wrapper first.

- [ ] **Step 7: Run the full test suite and build**

Run: `npm test`
Expected: all tests pass.

Run: `npm run build && npm run verify`
Expected: both succeed.

- [ ] **Step 8: Manual smoke check (best-effort, same fallback as prior phases)**

If reachable: open a championship with 4+ teams, "Fases" tab, add a second phase, switch its format to "Fase de Grupos", click "Gerar/Refazer", confirm match rows with `grupo` show up correctly in "Jogos"; switch between phases and confirm matches swap; set a progression target/mode/count on the first phase and confirm the summary text updates.

If not reachable, skip, verify by inspection, report `DONE_WITH_CONCERNS`.

- [ ] **Step 9: Commit**

```bash
git add src/pages/championship.js
git commit -m "feat: wire phases tab and fixture-generation engine into championship management"
```

---

## Self-Review

**Spec coverage** (against the audit list, with this plan's documented rescoping):
`addPhase`, `removePhase`, `renamePhase`, `ensurePhases`, `activePhase`→`activePhaseOf`, `switchPhase`, `phaseBar`→rendered inline in `fasesView()` (phase rows double as the switcher, matching how `categoriesView()` already does this rather than a separate pill bar), `phaseSnapshot`→folded into `loadPhaseIntoRoot`/`saveRootIntoPhase`, `phaseComplete`, `phaseParticipants`, `newPhaseFromRoot`→folded into `ensurePhases`/`addCategory`, `loadPhaseIntoRoot`, `saveRootIntoActive`(phase half)→`saveRootIntoPhase`, `loadCategoryIntoRoot`, `setPhaseFormat`, `generateActivePhase`, `setProgressMode`, `setProgressCount`, `setProgressTarget`, `progressBar`→inline in `fasesView()`, `progressionSummary` — all covered. `setFmt`/`renderFmtOpts`/`applyProgression`/`qualifiedFromPhase` — explicitly rescoped out, with rationale, in this plan's "Rescope vs. the published audit" section.

**Placeholder scan** — no TBD/TODO; every step has literal code.

**Type consistency** — `category`/`phase`/`state` parameter order matches across `phases.js`, `engine.js`, `categories.js`, and `championship.js`'s call sites (`state` first where root mutation is involved, `category` first for category-scoped pure ops like `renamePhase`/`setProgressTarget`, matching `categories.js`'s existing `renameCategory(state, id, name)` vs. this plan's `renamePhase(category, id, name)` — the latter doesn't need `state` since it never touches root).
