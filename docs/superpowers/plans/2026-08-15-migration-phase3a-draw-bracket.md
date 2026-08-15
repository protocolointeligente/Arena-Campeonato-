# Migration Phase 3a: Draw & Bracket Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `mata` (mata-mata / single-elimination bracket) phase format actually work end-to-end — generate a bracket from a phase's participants, enter tie scores (including two-legged and penalty shootouts), and watch winners advance round by round — closing the gap Phase 2d deliberately left open.

**Architecture:** Sub-phase 3a of Phase 3, tracked at `docs/superpowers/plans/MIGRATION-PROGRESS.md`. Legacy source: `arena-campeonatos-v2-intervencao-19.html:665-675` (bracket math) and `:952,956` (`renderBracketView`/`findTie`).

**Rescope vs. the published audit (same pattern as every prior sub-phase):**
- `tieObj` and `resolveTie` are pulled forward from Phase 3b's audit scope, because `makeBracketFromOrdered`/`advanceBracket` — both squarely 3a's own listed scope — cannot work without them. 3b still owns everything else in its list: the rich match-ops modal (`openMatchOps`/`saveMatchOps`/`opsConfigHTML`), disciplinary events (`matchEvents`), venue/official assignment per match, free-text fields (`info1`/`info2`), quick-fill helpers (`mark`/`clearResults`), and dashboard widgets (`nextMatchesCard`/`allMatchObjs`/`h2h`). This phase ships only the score fields a tie needs to resolve a winner (`ag1`/`bg1`/`ag2`/`bg2`/`apen`/`bpen`) via a minimal, functional (not decorative) score-entry UI.
- **Fixing a latent legacy bug, not a rescope:** legacy's `phaseComplete`/`qualifiedFromPhase` call a function named `winnerOf` that is never defined anywhere in the 12,000-line monolith (confirmed by exhaustive grep) — a dead `ReferenceError` path if either branch were ever reached in production. This phase defines `winnerOf(tie)` properly in `engine.js` (the natural home, alongside `tieObj`/`advanceBracket`) as the trivial `tie.winner` read it always should have been. `phaseComplete`'s `mata` branch (stubbed `return false` in Phase 2d, pending this) is updated to use the real check.
- `drawBracket`/`drawGroups`/`runDraw`/`toggleSeed`/`refreshSeeds`/`seedOrder`/`genCross`/`renderDraw`/`confirmDraw`/`finishDraw` are **not ported**. All belong to legacy's interactive championship-*creation* wizard (`setupDraft`/`drawResult` state, manual seed picking, an animated draw-reveal ceremony) — a rich, separate UI flow that the already-modernized `src/pages/new-championship.js` doesn't use at all (same reasoning Phase 2d already applied to `setFmt`/`renderFmtOpts`). `generateActivePhase`'s `mata` branch instead uses the same simple ordered-participants path `liga`/`grupos`/`gxg` already use — no manual seeding, no draw ceremony. If that richer flow is ever wanted, it's layered on top of this phase's now-working bracket engine, not blocking it.
- `renderMataFromGroups` is **not ported** — it seeds a follow-up bracket phase from a completed groups phase's classified teams, which needs `computeStandings` (Phase 3c, not built yet). Same reasoning as Phase 2d's deferral of `applyProgression`/`qualifiedFromPhase`.
- **`qualifiedFromPhase`'s `mata` branch remains deferred to Phase 3c** (as Phase 2d already documented) — but it can now be built correctly once 3c lands, since `winnerOf` and a real `bracket.rounds` exist. This phase does not touch `qualifiedFromPhase`.

**Pure vs. DOM split**, continuing the established pattern: `src/app/engine.js` (already pure fixture math from Phase 2d) gains the bracket math — still pure, no DOM. `src/app/phases.js` gets a two-line update (format list + a real completion check, no new import — see Task 2's note on avoiding a circular dependency). `championship.js` gets a new "Chaveamento" tab.

**Tech Stack:** Same as prior phases — vanilla JS ES modules, Vitest.

## Global Constraints

- Legacy source of truth: `arena-campeonatos-v2-intervencao-19.html:665-675, 952, 956`.
- Tie/bracket ids use `uid()` from `src/app/utils.js`, same as every other entity.
- Mutating functions return `{ok, reason?, ...}` where they can fail; pure getters/computed values return plain values.
- `npm run build`, `npm run verify`, `npm test` must all succeed after every task.
- No new UI framework — `data-*` + `bind()`.
- **Every new/changed `class="..."` must be checked against `layout.css`/`tokens.css`**, for both the class's own rule and any `<class> descendant-selector>` rule (standing instruction since Phase 2d). Note the CSS rule that matters here is a **descendant** combinator (`.row input`, not `.row > input`) — an `<input>` nested inside a `<label>` that is itself a `.row` child is still covered; only an input with no `.row`/`.team-row`/`.game-row`/`.ath-row` ancestor at all, or a bare `select`'s absence, is the actual defect class to watch for.

## File Structure

| File | Responsibility |
|---|---|
| `src/app/engine.js` | Modify: add `tieObj`, `nextPow2`, `makeBracketFromOrdered`, `resolveTie`, `winnerOf`, `loserOf`, `advanceBracket`, `findTie`; wire the `mata` branch into `generateActivePhase` |
| `src/app/engine.test.js` | Modify: tests for the above |
| `src/app/phases.js` | Modify: `PHASE_FORMATS` gains `mata`; `phaseComplete`'s `mata` branch does a real check |
| `src/app/phases.test.js` | Modify: update the two tests that assert the old stubbed behavior |
| `src/pages/championship.js` | Modify: new "Chaveamento" tab (`bracketView()`/`tieRow()`), `fasesView()` gains "Mão única"/"3º lugar" toggles for `mata` phases, `games()` gains a one-line redirect note for `mata` phases |
| `src/pages/new-championship.js` | Modify: re-add the `mata` option to the creation form's format `<select>` (Phase 2d removed it as a dead end; it's a real, working path now) |
| `src/styles/layout.css` | Modify: `.bracket-cols`/`.bcol` — a genuine new visual need (a horizontally-scrolling multi-column bracket tree has no existing equivalent layout in this codebase) |

---

### Task 1: Bracket math in `src/app/engine.js`

**Files:**
- Modify: `src/app/engine.js`
- Modify: `src/app/engine.test.js`

**Interfaces:**
- Consumes: `uid` from `./utils.js` (already imported).
- Produces (new exports): `tieObj(a, b): tie`, `nextPow2(n): number`, `makeBracketFromOrdered(ids, cfg): {rounds, third?}`, `resolveTie(tie, single): void` (mutates `tie.winner` in place), `winnerOf(tie): id|null`, `loserOf(tie): id|null`, `advanceBracket(bracket, cfg): void` (mutates in place), `findTie(bracket, id): tie|null`.
- Modifies: `generateActivePhase(state)` gains a `mata` branch; the final `else` branch's message changes (see Step 3).

- [ ] **Step 1: Write the failing tests**

Add to `src/app/engine.test.js` (new `describe` blocks, alongside the existing ones — do not remove any existing test):
```js
import {
  roundRobin, buildFixtures, buildGxg, generateActivePhase,
  tieObj, nextPow2, makeBracketFromOrdered, resolveTie, winnerOf, loserOf, advanceBracket, findTie,
} from './engine.js';

describe('tieObj', () => {
  it('builds a tie node with both sides and null scores/winner', () => {
    const tie = tieObj('t1', 't2');
    expect(tie.a).toBe('t1');
    expect(tie.b).toBe('t2');
    expect(tie.ag1).toBeNull();
    expect(tie.bg1).toBeNull();
    expect(tie.ag2).toBeNull();
    expect(tie.bg2).toBeNull();
    expect(tie.apen).toBeNull();
    expect(tie.bpen).toBeNull();
    expect(tie.winner).toBeNull();
    expect(tie.id).toBeTruthy();
    expect(tie.scorers).toEqual([]);
  });
});

describe('nextPow2', () => {
  it('rounds up to the next power of 2, or stays if already one', () => {
    expect(nextPow2(1)).toBe(1);
    expect(nextPow2(2)).toBe(2);
    expect(nextPow2(3)).toBe(4);
    expect(nextPow2(4)).toBe(4);
    expect(nextPow2(5)).toBe(8);
    expect(nextPow2(9)).toBe(16);
  });
});

describe('makeBracketFromOrdered', () => {
  it('builds one round of ties for a power-of-2 team count, pairing consecutively', () => {
    const bracket = makeBracketFromOrdered(['t1', 't2', 't3', 't4'], {});
    expect(bracket.rounds).toHaveLength(2);
    expect(bracket.rounds[0]).toHaveLength(2);
    expect(bracket.rounds[0][0].a).toBe('t1');
    expect(bracket.rounds[0][0].b).toBe('t2');
    expect(bracket.rounds[0][1].a).toBe('t3');
    expect(bracket.rounds[0][1].b).toBe('t4');
    expect(bracket.rounds[1]).toHaveLength(1);
    expect(bracket.rounds[1][0].a).toBeNull();
  });

  it('pads with a bye (null) for a non-power-of-2 count', () => {
    const bracket = makeBracketFromOrdered(['t1', 't2', 't3'], {});
    expect(bracket.rounds[0]).toHaveLength(2);
    expect(bracket.rounds[0][1].b).toBeNull();
  });

  it('adds a third-place tie when there are 4+ teams and cfg.terceiro is not explicitly false', () => {
    expect(makeBracketFromOrdered(['t1', 't2', 't3', 't4'], {}).third).toBeDefined();
    expect(makeBracketFromOrdered(['t1', 't2', 't3', 't4'], { terceiro: false }).third).toBeUndefined();
    expect(makeBracketFromOrdered(['t1', 't2'], {}).third).toBeUndefined();
  });
});

describe('resolveTie', () => {
  it('auto-advances a bye (only one side present) with no scores needed', () => {
    const tie = tieObj('t1', null);
    resolveTie(tie, true);
    expect(tie.winner).toBe('t1');
  });

  it('is undecided when both sides are empty', () => {
    const tie = tieObj(null, null);
    resolveTie(tie, true);
    expect(tie.winner).toBeNull();
  });

  it('single-leg: higher ag1/bg1 wins, unfilled stays undecided', () => {
    const tie = tieObj('t1', 't2');
    resolveTie(tie, true);
    expect(tie.winner).toBeNull();
    tie.ag1 = 2; tie.bg1 = 1;
    resolveTie(tie, true);
    expect(tie.winner).toBe('t1');
  });

  it('two-leg: aggregates ag1+ag2 vs bg1+bg2, needs both legs filled', () => {
    const tie = tieObj('t1', 't2');
    tie.ag1 = 1; tie.bg1 = 0;
    resolveTie(tie, false);
    expect(tie.winner).toBeNull(); // leg 2 not filled yet
    tie.ag2 = 0; tie.bg2 = 2;
    resolveTie(tie, false);
    expect(tie.winner).toBe('t2'); // 1+0=1 vs 0+2=2
  });

  it('breaks an aggregate tie with penalties, or stays undecided without them', () => {
    const tie = tieObj('t1', 't2');
    tie.ag1 = 1; tie.bg1 = 1;
    resolveTie(tie, true);
    expect(tie.winner).toBeNull();
    tie.apen = 5; tie.bpen = 4;
    resolveTie(tie, true);
    expect(tie.winner).toBe('t1');
  });
});

describe('winnerOf / loserOf', () => {
  it('winnerOf reads the resolved winner, or null', () => {
    const tie = tieObj('t1', 't2');
    expect(winnerOf(tie)).toBeNull();
    tie.winner = 't1';
    expect(winnerOf(tie)).toBe('t1');
  });

  it('loserOf returns the side that did not win, or null if undecided', () => {
    const tie = tieObj('t1', 't2');
    expect(loserOf(tie)).toBeNull();
    tie.winner = 't1';
    expect(loserOf(tie)).toBe('t2');
  });
});

describe('advanceBracket', () => {
  it('propagates winners round to round and fills the third-place tie from semifinal losers', () => {
    const bracket = makeBracketFromOrdered(['t1', 't2', 't3', 't4'], {});
    const [semi1, semi2] = bracket.rounds[0];
    semi1.ag1 = 2; semi1.bg1 = 0; // t1 beats t2
    semi2.ag1 = 1; semi2.bg1 = 3; // t4 beats t3
    advanceBracket(bracket, { maoUnica: true });
    expect(semi1.winner).toBe('t1');
    expect(semi2.winner).toBe('t4');
    const final = bracket.rounds[1][0];
    expect(final.a).toBe('t1');
    expect(final.b).toBe('t4');
    expect(bracket.third.a).toBe('t2');
    expect(bracket.third.b).toBe('t3');
    final.ag1 = 0; final.bg1 = 1;
    advanceBracket(bracket, { maoUnica: true });
    expect(final.winner).toBe('t4');
  });

  it('leaves later rounds undecided until earlier ones resolve', () => {
    const bracket = makeBracketFromOrdered(['t1', 't2', 't3', 't4'], {});
    advanceBracket(bracket, { maoUnica: true });
    expect(bracket.rounds[1][0].a).toBeNull();
    expect(bracket.rounds[1][0].b).toBeNull();
  });
});

describe('findTie', () => {
  it('finds a tie by id in any round, or the third-place tie, or returns null', () => {
    const bracket = makeBracketFromOrdered(['t1', 't2', 't3', 't4'], {});
    const finalId = bracket.rounds[1][0].id;
    expect(findTie(bracket, finalId)).toBe(bracket.rounds[1][0]);
    expect(findTie(bracket, bracket.third.id)).toBe(bracket.third);
    expect(findTie(bracket, 'ghost')).toBeNull();
    expect(findTie(null, 'x')).toBeNull();
  });
});

describe('generateActivePhase — mata format', () => {
  function championship() {
    return {
      teams: [{ id: 't1' }, { id: 't2' }, { id: 't3' }, { id: 't4' }],
      categories: [{ id: 'c1', teams: [{ id: 't1' }, { id: 't2' }, { id: 't3' }, { id: 't4' }], phases: [{ id: 'p1', nome: 'Fase 1', formato: 'mata', cfg: { turnos: 1 }, grupos: [], matches: [], bracket: null }], activePhaseId: 'p1' }],
      activeCategoryId: 'c1',
      formato: 'mata', cfg: { turnos: 1 }, grupos: [], matches: [], bracket: null,
    };
  }

  it('generates a bracket from the phase participants, in order, no manual seeding', () => {
    const state = championship();
    const result = generateActivePhase(state);
    expect(result).toEqual({ ok: true });
    expect(state.bracket.rounds[0].map((t) => t.a)).toEqual(['t1', 't3']);
    expect(state.bracket.rounds[0].map((t) => t.b)).toEqual(['t2', 't4']);
    expect(state.matches).toEqual([]);
    expect(state.categories[0].phases[0].status).toBe('andamento');
  });

  it('reports ok:false for a genuinely unknown format', () => {
    const state = championship();
    state.categories[0].phases[0].formato = 'bogus';
    const result = generateActivePhase(state);
    expect(result).toEqual({ ok: false, reason: 'Formato de fase desconhecido.' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- engine`
Expected: FAIL — none of `tieObj`/`nextPow2`/`makeBracketFromOrdered`/`resolveTie`/`winnerOf`/`loserOf`/`advanceBracket`/`findTie` exist yet, and the `mata` test expects behavior the current `else` branch doesn't provide.

- [ ] **Step 3: Implement**

Add to `src/app/engine.js` (after the existing `buildGxg`, before `generateActivePhase`) — adapted from legacy `tieObj`/`nextPow2`/`makeBracketFromOrdered`/`resolveTie`/`loserOf`/`advanceBracket` (`:665-675`) and `findTie` (`:956`), converted to explicit-parameter pure functions (no reach into a global `state`), plus the new `winnerOf` fixing the undefined-function bug described in this plan's Rescope note:

```js
export function tieObj(a, b) {
  return { id: uid(), a, b, ag1: null, bg1: null, ag2: null, bg2: null, apen: null, bpen: null, winner: null, info1: '', info2: '', scorers: [] };
}

export function nextPow2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function makeBracketFromOrdered(ids, cfg) {
  const list = ids.slice();
  const size = nextPow2(list.length);
  while (list.length < size) list.push(null);
  const rounds = [];
  let cur = [];
  for (let i = 0; i < list.length; i += 2) cur.push(tieObj(list[i], list[i + 1]));
  rounds.push(cur);
  while (cur.length > 1) {
    const next = [];
    for (let i = 0; i < cur.length; i += 2) next.push(tieObj(null, null));
    rounds.push(next);
    cur = next;
  }
  const bracket = { rounds };
  if (size >= 4 && (!cfg || cfg.terceiro !== false)) bracket.third = tieObj(null, null);
  return bracket;
}

export function resolveTie(tie, single) {
  if (tie.a == null && tie.b == null) { tie.winner = null; return; }
  if (tie.a == null || tie.b == null) { tie.winner = tie.a || tie.b; return; }
  let ag, bg;
  if (single) { ag = tie.ag1; bg = tie.bg1; }
  else { ag = (tie.ag1 || 0) + (tie.ag2 || 0); bg = (tie.bg1 || 0) + (tie.bg2 || 0); }
  const filled = single ? (tie.ag1 != null && tie.bg1 != null) : (tie.ag1 != null && tie.bg1 != null && tie.ag2 != null && tie.bg2 != null);
  if (!filled) { tie.winner = null; return; }
  if (ag > bg) tie.winner = tie.a;
  else if (bg > ag) tie.winner = tie.b;
  else if (tie.apen != null && tie.bpen != null && tie.apen !== tie.bpen) tie.winner = tie.apen > tie.bpen ? tie.a : tie.b;
  else tie.winner = null;
}

export function winnerOf(tie) {
  return tie && tie.winner != null ? tie.winner : null;
}

export function loserOf(tie) {
  if (tie.winner == null) return null;
  return tie.winner === tie.a ? tie.b : tie.a;
}

export function advanceBracket(bracket, cfg) {
  const rounds = bracket.rounds;
  const single = !!(cfg && cfg.maoUnica);
  rounds.forEach((round) => round.forEach((tie) => resolveTie(tie, single)));
  for (let r = 0; r < rounds.length - 1; r++) {
    rounds[r].forEach((tie, i) => {
      const target = rounds[r + 1][Math.floor(i / 2)];
      target[i % 2 === 0 ? 'a' : 'b'] = tie.winner;
    });
  }
  if (bracket.third && rounds.length >= 2) {
    const semis = rounds[rounds.length - 2];
    if (semis.length === 2) {
      bracket.third.a = loserOf(semis[0]);
      bracket.third.b = loserOf(semis[1]);
    }
  }
  rounds.forEach((round) => round.forEach((tie) => resolveTie(tie, single)));
  if (bracket.third) resolveTie(bracket.third, single);
}

export function findTie(bracket, id) {
  if (!bracket) return null;
  for (const round of bracket.rounds) {
    const tie = round.find((t) => t.id === id);
    if (tie) return tie;
  }
  if (bracket.third && bracket.third.id === id) return bracket.third;
  return null;
}
```

In `generateActivePhase`, replace:
```js
  } else {
    return { ok: false, reason: 'Este formato ainda não está disponível nesta fase da migração.' };
  }
```
with:
```js
  } else if (phase.formato === 'mata') {
    const ids = participants.map((ti) => teams[ti].id);
    phase.bracket = makeBracketFromOrdered(ids, phase.cfg);
  } else {
    return { ok: false, reason: 'Formato de fase desconhecido.' };
  }
```
(`phase.grupos = []; phase.matches = []; phase.bracket = null;` already run before this `if`/`else if` chain, so the `mata` branch only needs to set `phase.bracket` — `matches`/`grupos` correctly stay empty for a bracket phase, matching legacy where `mata` phases never populate `state.matches`.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- engine`
Expected: all tests pass (12 existing + this task's new ones).

- [ ] **Step 5: Commit**

```bash
git add src/app/engine.js src/app/engine.test.js
git commit -m "feat: port bracket math (tieObj/makeBracketFromOrdered/resolveTie/advanceBracket) and wire mata format into generateActivePhase"
```

---

### Task 2: `mata` becomes a real phase format — `src/app/phases.js`

**Files:**
- Modify: `src/app/phases.js`
- Modify: `src/app/phases.test.js`

**Interfaces:**
- Modifies: `PHASE_FORMATS` gains a fourth entry; `phaseComplete`'s `mata` branch.
- **Does not import from `src/app/engine.js`.** `engine.js` already imports from `phases.js` (Phase 2d's `generateActivePhase` does) — importing back would create a circular dependency. `phaseComplete`'s bracket-completion check is a one-line read of `tie.winner`, cheap enough to inline directly rather than importing `winnerOf` for it.

- [ ] **Step 1: Update the tests**

In `src/app/phases.test.js`, find the `PHASE_FORMATS` test and replace it:
```js
describe('PHASE_FORMATS', () => {
  it('lists liga/grupos/gxg/mata', () => {
    expect(PHASE_FORMATS).toEqual([
      ['liga', 'Pontos Corridos'],
      ['grupos', 'Fase de Grupos'],
      ['gxg', 'Grupo × Grupo'],
      ['mata', 'Mata-Mata'],
    ]);
  });
});
```

Find the `phaseComplete` test's mata case:
```js
  it('is false for mata format — bracket completion needs the draw engine (Phase 3a)', () => {
    expect(phaseComplete({ formato: 'mata', bracket: {} })).toBe(false);
  });
```
Replace it with:
```js
  it('mata format is complete once the final tie has a winner', () => {
    expect(phaseComplete({ formato: 'mata', bracket: null })).toBe(false);
    expect(phaseComplete({ formato: 'mata', bracket: { rounds: [[{ winner: null }]] } })).toBe(false);
    expect(phaseComplete({ formato: 'mata', bracket: { rounds: [[{ winner: 't1' }]] } })).toBe(true);
    expect(phaseComplete({ formato: 'mata', bracket: { rounds: [[], [{ winner: 't1' }]] } })).toBe(true);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- phases`
Expected: FAIL — `PHASE_FORMATS` is missing `mata`, and the old stubbed `phaseComplete` always returns `false` for `mata`.

- [ ] **Step 3: Implement**

In `src/app/phases.js`, change:
```js
export const PHASE_FORMATS = [
  ['liga', 'Pontos Corridos'],
  ['grupos', 'Fase de Grupos'],
  ['gxg', 'Grupo × Grupo'],
];
```
to:
```js
export const PHASE_FORMATS = [
  ['liga', 'Pontos Corridos'],
  ['grupos', 'Fase de Grupos'],
  ['gxg', 'Grupo × Grupo'],
  ['mata', 'Mata-Mata'],
];
```

Change:
```js
export function phaseComplete(phase) {
  if (!phase) return false;
  // mata (bracket) completion needs winnerOf/tieObj — Phase 3a/3b. Unreachable today:
  // the format picker never offers 'mata' yet (see this plan's Rescope note).
  if (phase.formato === 'mata') return false;
  return (phase.matches || []).length > 0 && (phase.matches || []).every((m) => m.hg != null && m.ag != null);
}
```
to:
```js
export function phaseComplete(phase) {
  if (!phase) return false;
  if (phase.formato === 'mata') {
    if (!phase.bracket) return false;
    const rounds = phase.bracket.rounds || [];
    const last = rounds[rounds.length - 1];
    return !!(last && last[0] && last[0].winner != null);
  }
  return (phase.matches || []).length > 0 && (phase.matches || []).every((m) => m.hg != null && m.ag != null);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- phases`
Expected: all tests pass.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all pass — confirms nothing else assumed `PHASE_FORMATS` had exactly 3 entries or that `mata` was unreachable.

- [ ] **Step 6: Commit**

```bash
git add src/app/phases.js src/app/phases.test.js
git commit -m "feat: make mata a selectable phase format with a real completion check"
```

---

### Task 3: Wire the "Chaveamento" tab and tie scoring into `src/pages/championship.js`

**Files:**
- Modify: `src/pages/championship.js`
- Modify: `src/pages/new-championship.js`
- Modify: `src/styles/layout.css`

**Interfaces:**
- Consumes: `advanceBracket`, `findTie` from `../app/engine.js` (extends the existing `generateActivePhase` import line); `teamNameById` from `../app/roster.js` (extends the existing import line).

No new automated tests (DOM wiring; Tasks 1–2's suites cover the logic). Same "no live browser in this sandbox" fallback as prior phases — verify by inspection, report `DONE_WITH_CONCERNS` if so.

- [ ] **Step 1: Extend imports**

Change:
```js
import { teamById, addAthlete, updateAthlete, removeAthlete, setAthletePhoto, setTeamLogo, compressPhoto } from '../app/roster.js';
```
to:
```js
import { teamById, teamNameById, addAthlete, updateAthlete, removeAthlete, setAthletePhoto, setTeamLogo, compressPhoto } from '../app/roster.js';
```

Change:
```js
import { generateActivePhase } from '../app/engine.js';
```
to:
```js
import { generateActivePhase, advanceBracket, findTie } from '../app/engine.js';
```

- [ ] **Step 2: Add a "Chaveamento" tab**

In `mount()`'s tab list, insert `['chave','Chaveamento']` right after `['jogos','Jogos']`:
```js
<nav class="championship-tabs">${[['overview','Visão geral'],['categorias','Categorias'],['fases','Fases'],['jogos','Jogos'],['chave','Chaveamento'],['classif','Tabela'],['equipes','Equipes'],['inscricoes','Inscrições'],['publicacao','Publicação'],['historico','Histórico'],['config','Configurações']].map(([key,label]) => `<button data-tab="${key}">${label}</button>`).join('')}</nav>
```

In `render()`'s ternary dispatch, add the `chave` branch right after `jogos`:
```js
content.innerHTML = tab === 'overview' ? overview() : tab === 'categorias' ? categoriesView() : tab === 'fases' ? fasesView() : tab === 'jogos' ? games() : tab === 'chave' ? bracketView() : tab === 'classif' ? standings() : tab === 'equipes' ? teams() : tab === 'inscricoes' ? registrationsView() : tab === 'publicacao' ? '<div class="card"><h2>Publicação</h2><p class="muted">Copie os links públicos para divulgar o campeonato.</p><button class="btn primary" data-publication>Abrir central de publicação</button></div>' : tab === 'historico' ? auditView() : config();
```

- [ ] **Step 3: Add `bracketView()`/`roundLabel()`/`tieRow()`**

Add alongside the other view functions (e.g. right after `games()`). `advanceBracket` runs on every render — this matches legacy's own placement (`renderBracketView` called `advanceBracket` first thing, so the tree is always freshly resolved, no separate "advance" action needed). Every `<input>` here is a direct or nested-in-`<label>`-but-still-descendant child of the tie's `.row` — the CSS rule is a descendant selector, both patterns are covered:
```js
function roundLabel(size) { return { 2: 'Final', 4: 'Semifinal', 8: 'Quartas de final', 16: 'Oitavas de final', 32: '16-avos' }[size] || `${size}-avos`; }
function tieRow(tie) { const homeName = tie.a != null ? esc(teamNameById(state, tie.a) || '—') : 'A definir'; const awayName = tie.b != null ? esc(teamNameById(state, tie.b) || '—') : 'A definir'; const canScore = tie.a != null && tie.b != null; const single = !!state.cfg?.maoUnica; const winnerText = tie.winner != null ? ` <span class="muted">· vencedor: ${esc(teamNameById(state, tie.winner) || '—')}</span>` : ''; const showPen = canScore && tie.ag1 != null && tie.bg1 != null && (single || (tie.ag2 != null && tie.bg2 != null)); return `<div class="row" style="flex-wrap:wrap;padding:8px 0;border-bottom:1px solid var(--line)"><span style="flex:1">${homeName} <span class="muted">×</span> ${awayName}${winnerText}</span>${canScore ? `<input type="number" min="0" data-tie-score="${tie.id}:ag1" value="${tie.ag1 ?? ''}" style="width:50px" title="Placar 1ª perna — ${homeName}"><input type="number" min="0" data-tie-score="${tie.id}:bg1" value="${tie.bg1 ?? ''}" style="width:50px" title="Placar 1ª perna — ${awayName}">${!single ? `<input type="number" min="0" data-tie-score="${tie.id}:ag2" value="${tie.ag2 ?? ''}" style="width:50px" title="Placar 2ª perna — ${homeName}"><input type="number" min="0" data-tie-score="${tie.id}:bg2" value="${tie.bg2 ?? ''}" style="width:50px" title="Placar 2ª perna — ${awayName}">` : ''}${showPen ? `<input type="number" min="0" data-tie-score="${tie.id}:apen" value="${tie.apen ?? ''}" style="width:50px" title="Pênaltis — ${homeName}"><input type="number" min="0" data-tie-score="${tie.id}:bpen" value="${tie.bpen ?? ''}" style="width:50px" title="Pênaltis — ${awayName}">` : ''}` : ''}</div>`; }
function bracketView() { if (state.formato !== 'mata') return `<div class="card"><p class="muted">Esta fase não usa chaveamento. Troque o formato da fase ativa para "Mata-Mata" na aba Fases.</p></div>`; if (!state.bracket) return `<div class="card"><p class="muted">Nenhum chaveamento gerado ainda. Use "Gerar/Refazer" na aba Fases.</p></div>`; advanceBracket(state.bracket, state.cfg); const rounds = state.bracket.rounds; return `<div class="card"><h2>Chaveamento</h2><div class="bracket-cols">${rounds.map((round) => `<div class="bcol"><h3 class="muted">${roundLabel(round.length * 2)}</h3>${round.map((tie) => tieRow(tie)).join('')}</div>`).join('')}${state.bracket.third ? `<div class="bcol"><h3 class="muted">Disputa de 3º lugar</h3>${tieRow(state.bracket.third)}</div>` : ''}</div></div>`; }
```

- [ ] **Step 4: Give `games()` a one-line redirect for `mata` phases**

Find:
```js
function games() { return `<div class="card"><div class="actions" style="justify-content:space-between">...
```
Change its opening to short-circuit for `mata` (the rest of the function body is unchanged — only add this one line before the existing `return`):
```js
function games() { if (state.formato === 'mata') return `<div class="card"><p class="muted">Esta fase usa chaveamento. Veja e registre os placares na aba "Chaveamento".</p></div>`; return `<div class="card"><div class="actions" style="justify-content:space-between">...
```
(Keep everything else in `games()` exactly as it is today — this only adds the early return.)

- [ ] **Step 5: Add "Mão única"/"3º lugar" toggles to `fasesView()` for `mata` phases**

In `fasesView()`'s per-phase `.row` (the one that already holds the phase-name input, format `<select>`, and the conditional turnos/nGrupos inputs), add — right after the existing `${phase.formato === 'grupos' ? ... : ''}` block, before the `<span class="muted">` status text:
```js
${phase.formato === 'mata' ? `<label class="muted" style="display:flex;align-items:center;gap:4px"><input type="checkbox" data-phase-mao-unica="${esc(phase.id)}" ${phase.cfg?.maoUnica ? 'checked' : ''}> Mão única</label><label class="muted" style="display:flex;align-items:center;gap:4px"><input type="checkbox" data-phase-terceiro="${esc(phase.id)}" ${phase.cfg?.terceiro !== false ? 'checked' : ''}> 3º lugar</label>` : ''}
```

- [ ] **Step 6: Wire the new handlers in `bind()`**

Add, near the existing `[data-phase-ngrupos]` handler:
```js
root.querySelectorAll('[data-phase-mao-unica]').forEach((input) => input.onchange = async () => { const phase = activeCategory(state).phases.find((p) => p.id === input.dataset.phaseMaoUnica); if (!phase) return; phase.cfg = phase.cfg || {}; phase.cfg.maoUnica = input.checked; await persist(); render(); });
root.querySelectorAll('[data-phase-terceiro]').forEach((input) => input.onchange = async () => { const phase = activeCategory(state).phases.find((p) => p.id === input.dataset.phaseTerceiro); if (!phase) return; phase.cfg = phase.cfg || {}; phase.cfg.terceiro = input.checked; await persist(); render(); });
```
(`terceiro` only takes effect on the next "Gerar/Refazer" — the third-place tie object is created at generation time, same as legacy. `maoUnica` takes effect immediately on the next render, since `resolveTie` reads it live every time `advanceBracket` runs. Both behaviors match legacy exactly — do not "fix" this asymmetry, it isn't a bug.)

Add, near the other `bind()` handlers (e.g. after the `[data-generate]` handler):
```js
root.querySelectorAll('[data-tie-score]').forEach((input) => input.onchange = async () => { const [tieId, field] = input.dataset.tieScore.split(':'); const tie = findTie(state.bracket, tieId); if (!tie) return; tie[field] = input.value === '' ? null : Number(input.value); await persist(); await addAudit(state.id, 'tie_score_updated', 'Placar do chaveamento atualizado'); render(); });
```

- [ ] **Step 7: Re-add the `mata` option to the creation wizard**

In `src/pages/new-championship.js`, the format `<select>` currently reads:
```html
<select name="format" style="display:block;width:100%;margin:8px 0 16px;padding:12px"><option value="liga">Liga</option><option value="grupos">Grupos</option><option value="mata">Mata-mata</option></select>
```
Wait — check the current file first (Phase 2d removed this option because `mata` was a dead end at the time). Add it back if it's missing:
```html
<option value="mata">Mata-mata</option>
```
right after the `grupos` option, so the three options are `liga`/`grupos`/`mata` again. `mata` is now a real, working path (this phase's whole point), so the wizard should offer it.

- [ ] **Step 8: Add the bracket layout CSS**

`src/styles/layout.css` has no existing multi-column, horizontally-scrolling layout to reuse — a genuine new visual need (per this plan's Global Constraints note on when new CSS is warranted). Add:
```css
.bracket-cols { display: flex; gap: 20px; overflow-x: auto; padding-bottom: 8px; }
.bcol { flex: 0 0 240px; min-width: 240px; }
```

- [ ] **Step 9: Run the full test suite and build**

Run: `npm test`
Expected: all tests pass.

Run: `npm run build && npm run verify`
Expected: both succeed.

- [ ] **Step 10: Manual smoke check (best-effort, same fallback as prior phases)**

If reachable: create a championship with the `mata` format (or switch an existing phase's format to Mata-Mata in Fases), add 4 teams, click "Gerar/Refazer", open "Chaveamento", confirm two semifinal ties and one final tie (plus a third-place tie) render with team names; enter scores for both semifinals, confirm the final tie's two sides populate with the winners and the third-place tie's two sides populate with the losers; enter a final score, confirm a "vencedor" badge appears.

If not reachable, skip, verify by inspection, report `DONE_WITH_CONCERNS`.

- [ ] **Step 11: Commit**

```bash
git add src/pages/championship.js src/pages/new-championship.js src/styles/layout.css
git commit -m "feat: wire Chaveamento tab, tie scoring, and mao-unica/terceiro toggles into championship management"
```

---

## Self-Review

**Spec coverage** (against the audit list, with this plan's documented rescoping): `drawBracket`/`drawGroups`/`runDraw`/`toggleSeed`/`refreshSeeds`/`seedOrder`/`genCross`/`renderDraw`/`confirmDraw`/`finishDraw` — explicitly rescoped out (creation-wizard concern, see Rescope note). `makeBracketFromOrdered`, `buildFixtures`, `buildGxg`, `nextPow2`, `roundRobin` — `buildFixtures`/`buildGxg`/`roundRobin`/`nextPow2` already landed in Phase 2d; `makeBracketFromOrdered` lands here. `renderBracketView`→`bracketView()`/`tieRow()`. `renderMataFromGroups` — explicitly rescoped to Phase 3c (needs `computeStandings`). `advanceBracket`, `loserOf`, `findTie` — all covered, Task 1. `tieObj`/`resolveTie` — pulled forward from 3b's list with rationale. `winnerOf` — not in the original audit list at all (it's called by 2d-era `phaseComplete`/`qualifiedFromPhase` in legacy but never defined there — a latent bug); defined here since it's this phase's natural home and Task 2 needs it.

**Placeholder scan** — no TBD/TODO; every step has literal code.

**Type consistency** — `bracket`/`tie`/`cfg` parameter shapes match across `engine.js`'s new exports and `championship.js`'s call sites (`advanceBracket(bracket, cfg)`, `findTie(bracket, id)`, both taking the bracket object directly, not reaching into a global `state` the way legacy's originals did — consistent with every other `engine.js`/`phases.js` function already established in Phase 2d).
