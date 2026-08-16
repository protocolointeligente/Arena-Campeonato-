# Migration Phase 3c: Standings & Scorers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Tabela tab real standings — per-group tables for `grupos`/`gxg` phases, tie-break criteria (including confronto direto and a disciplinary fair-play column), and a `mata` redirect note matching `games()`'s existing pattern — plus a working "Classificar →" progression button (finally wiring `applyProgression`/`qualifiedFromPhase`, dead buttons since Phase 2d), a "Gerar mata-mata" cross-bracket flow for `grupos` phases (`genCross`/`renderMataFromGroups`, deferred by Phase 3a), and a new Artilharia (top scorers) tab.

**Architecture:** Sub-phase 3c of Phase 3, tracked at `docs/superpowers/plans/MIGRATION-PROGRESS.md`. Legacy source: `arena-campeonatos-v2-intervencao-19.html:613-621` (`standingsForPhase`/`qualifiedFromPhase`/`applyProgression`), `:641-650` (`h2h`/`computeStandings`), `:693-694` (`scorerRanking`/`cardRanking`), `:923` (`standingsTable`), `:968-969` (`renderMataFromGroups`/`genCross`), `:1092` (`standsToRows`), `:684-687,895` (`allMatchObjs`).

**Rescope vs. the published audit:**
- `cardRanking` is ported as a pure, tested function but gets no UI caller this phase — its only legacy caller (`viewDisciplina`) is explicit Phase 3d scope (disciplinary suspensions). Same "early, not dead" status Phase 2b/2c's read-helpers had before their own callers landed.
- `standsToRows` is ported pure/tested but uncalled — its only legacy caller is Phase 4's PDF export (`reportStandingsBlocks`).
- `migrateScorers`/`ensureEvents` (legacy's old-`scorers`-field-to-`events` compat shim) are **not** ported: every `src/` championship is created fresh via `new-championship.js`, so `match.scorers` is never populated by any `src/` UI (unlike `matchMeta`'s `info`-string migration, which Phase 3b needed because `buildFixtures`/`buildGxg` really do populate `match.info`). `scorerRanking`/`cardRanking` read `match.events` directly — empty until Phase 4's súmula UI writes to it, exactly like legacy's own fresh-championship state.
- `drawBracket`/`drawGroups`/`runDraw`/`toggleSeed`/`refreshSeeds`/`seedOrder`/`renderDraw`/`confirmDraw`/`finishDraw` (legacy's animated creation-wizard seed-draw screen, `setupDraft`-based) are **not** in scope — they're a different screen (`new-championship.js`) with no dependency on `computeStandings`, unlike `genCross`/`renderMataFromGroups` which were deferred here specifically because they needed it.
- The public portal's own standings (`publicMiniStandings`/`publicTopScorers`) stay out of scope — explicitly Phase 5, and `public-championship.js`'s standings display is a placeholder team list, unrelated to this phase's admin-side work.
- `isSeed`/seed-star badges in the standings table are skipped — `cfg.seedNames` has no editor anywhere in `src/` yet (deferred with the creation-wizard draw screen above), so the badge would never render. No new code for a condition that can't currently be true.

**Fixing latent legacy issues, not reproducing them:**
- `standingsForPhase`'s legacy implementation temporarily overwrites the *global* `state.cfg` with the phase's own `cfg`, calls `computeStandings()` (which reads `state.cfg` internally), then restores it in a `finally` block — a mutate-global-and-restore hack forced by `computeStandings` having no `cfg` parameter of its own. This port gives `computeStandings` an explicit `cfg` argument instead, so `standingsForPhase` passes `phase.cfg` straight through with no global mutation at all. Same external behavior, no shared-state footgun.
- The Phase 2d follow-up bug — `setPhaseFormat` never resets `progression.mode` off `'perGroup'` when a phase's format changes away from `grupos`, leaving the mode `<select>` and the summary text disagreeing — is fixed here (Task 4), as flagged in that follow-up as "the natural place to decide the right behavior."
- The Phase 3a follow-up bug — `standings()` (Tabela tab) shows an all-zero table for a `mata` phase instead of redirecting, unlike `games()`/`config()`'s existing one-line redirect — is fixed here (Task 5), matching the pattern those two already use.

**Pure vs. DOM split**, continuing the established pattern: `src/app/standings.js` (new) and `src/app/matches.js` (extended) hold all data computation, no DOM. `src/app/standings.js` also gains `genCross` (mutates `state.bracket`, same contract as `engine.js`'s existing `advanceBracket`, which it calls). `src/pages/championship.js`'s `standings()` is rewritten, `bracketView()` is extended for `grupos` phases, `fasesView()` gains a "Classificar →" button, and a new `scorersView()`/Artilharia tab is added.

**Tech Stack:** Same as prior phases — vanilla JS ES modules, Vitest.

## Global Constraints

- Legacy source of truth: `arena-campeonatos-v2-intervencao-19.html:613-621, 641-650, 665-694, 923-926, 968-969, 1092`.
- Mutating functions return `{ok, reason?, ...}`; pure getters return plain values — matching every prior phase's contract.
- `npm run build`, `npm run verify`, `npm test` must all succeed after every task.
- No new UI framework — `data-*` + `bind()`.
- **Every new/changed `class="..."` must be checked against `layout.css`/`tokens.css`**, for both the class's own rule and any descendant-selector rule (standing instruction since Phase 2d). This phase introduces **no new classes** — every new element reuses `.card`, `.table-wrap table`, `.actions`, `.btn`/`.btn.primary`/`.btn.ghost`, and the already-precedented (if unstyled) `.sm` modifier (`matches.js`'s Phase 3b `matchOpsModal` button already used `class="btn ghost sm"` with no CSS rule — do not add a new pattern, reuse that exact precedent). Qualification-zone row highlighting uses an inline `style="background:var(--surface-muted)"` (an existing design token), not a new class.
- Avoid import cycles: `src/app/standings.js` may import from `src/app/matches.js`, `src/app/roster.js`, `src/app/phases.js`, `src/app/categories.js`, and `src/app/engine.js` (all one-directional). **Correction found during Task 2's review:** `src/app/matches.js` already imports `advanceBracket` from `src/app/engine.js` (added in Phase 3b's review-fix commit, `clearResults` calls it) — so `engine.js` must **not** import `standings.js` (that would close the cycle `engine.js → standings.js → matches.js → engine.js`). `genCross` therefore lives in `standings.js`, not `engine.js` (Task 3, revised below), importing `makeBracketFromOrdered`/`advanceBracket` from `engine.js` the same one-directional way `matches.js` already does.

## File Structure

| File | Responsibility |
|---|---|
| `src/app/matches.js` | Add: `allMatchObjs(state)` — flattens `state.matches` + every bracket tie (rounds + third place) into one array, no DOM |
| `src/app/standings.js` | Create: `computeStandings`, `standingsForPhase`, `qualifiedFromPhase`, `applyProgression`, `scorerRanking`, `cardRanking`, `standsToRows`, `CRIT_LABEL`, `genCross` — no DOM |
| `src/app/standings.test.js` | Tests for the above |
| `src/app/phases.js` | Fix: `setPhaseFormat` resets `progression.mode` off `'perGroup'` when leaving `grupos` |
| `src/pages/championship.js` | Rewrite `standings()` (per-group/gxg tables, mata redirect, tie-break legend); extend `bracketView()` for `grupos` phases (`genCross` wiring); add "Classificar →" to `fasesView()`; add `scorersView()` + Artilharia tab |

---

### Task 1: `allMatchObjs` — `src/app/matches.js`

**Files:**
- Modify: `src/app/matches.js`
- Modify: `src/app/matches.test.js`

**Interfaces:**
- Produces: `allMatchObjs(state): Array<match|tie>` — consumed by Task 2's `scorerRanking`/`cardRanking`.

- [ ] **Step 1: Add the failing tests**

Append to `src/app/matches.test.js`:
```js
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
```
Update the top import line to include `allMatchObjs`:
```js
import { matchMeta, splitInfo, metaLine, setScore, saveMatchOps, clearResults, allMatchObjs } from './matches.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- matches`
Expected: FAIL — `allMatchObjs is not a function` (or `undefined`).

- [ ] **Step 3: Implement `allMatchObjs` in `src/app/matches.js`**

Add at the end of the file (adapted from legacy `allMatchObjs`, `:895`, dropping the `{obj,kind}` wrapper — nothing in this phase needs the `kind` tag):
```js
export function allMatchObjs(state) {
  const out = [...(state.matches || [])];
  if (state.bracket) {
    (state.bracket.rounds || []).forEach((round) => out.push(...round));
    if (state.bracket.third) out.push(state.bracket.third);
  }
  return out;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- matches`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/matches.js src/app/matches.test.js
git commit -m "feat: add allMatchObjs, flattening matches and bracket ties for ranking computations"
```

---

### Task 2: Standings, progression, and scorer/card rankings — `src/app/standings.js`

**Files:**
- Create: `src/app/standings.js`
- Create: `src/app/standings.test.js`

**Interfaces:**
- Consumes: `allMatchObjs` from `./matches.js`; `athName` from `./roster.js`; `phaseParticipants`, `phaseComplete`, `loadPhaseIntoRoot` from `./phases.js`; `saveRootIntoActive` from `./categories.js`.
- Produces: `computeStandings(teams, idxs, matches, cfg): Array<stat>`, `standingsForPhase(state, phase, idxs, matches?): Array<stat>`, `qualifiedFromPhase(state, phase, mode, count): string[]`, `applyProgression(state, category, srcId, opts?): {ok, reason?, count?, targetName?}`, `scorerRanking(state): Array<row>`, `cardRanking(state): Array<row>`, `standsToRows(teams, st): Array<Array>`, `CRIT_LABEL: object` — imported by Task 3 (`engine.js`) and Task 5 (`championship.js`).

- [ ] **Step 1: Write the failing tests**

Create `src/app/standings.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { computeStandings, standingsForPhase, qualifiedFromPhase, applyProgression, scorerRanking, cardRanking, standsToRows } from './standings.js';

const teams = [{ id: 'a', nome: 'Alfa' }, { id: 'b', nome: 'Beta' }, { id: 'c', nome: 'Gama' }];

describe('computeStandings', () => {
  it('computes points/goals from finished matches, defaulting to 3/1/0', () => {
    const matches = [
      { home: 0, away: 1, hg: 2, ag: 1 },
      { home: 1, away: 2, hg: 0, ag: 0 },
      { home: 0, away: 2, hg: null, ag: null },
    ];
    const st = computeStandings(teams, [0, 1, 2], matches, {});
    const byIdx = Object.fromEntries(st.map((s) => [s.team, s]));
    expect(byIdx[0]).toMatchObject({ P: 3, J: 1, V: 1, E: 0, D: 0, GP: 2, GC: 1, SG: 1 });
    expect(byIdx[1]).toMatchObject({ P: 1, J: 2, V: 0, E: 1, D: 1 });
    expect(byIdx[2]).toMatchObject({ P: 1, J: 1, V: 0, E: 1, D: 0 });
  });

  it('sorts by the configured criteria order', () => {
    const matches = [{ home: 0, away: 2, hg: 3, ag: 3 }, { home: 1, away: 2, hg: 1, ag: 1 }];
    const st = computeStandings(teams, [0, 1, 2], matches, { criterios: ['GP'] });
    expect(st.map((s) => s.team)).toEqual([2, 0, 1]);
  });

  it('applies confronto direto as the final tiebreak when every prior criterion ties', () => {
    const four = [...teams, { id: 'd', nome: 'Delta' }];
    const matches = [
      { home: 0, away: 1, hg: 2, ag: 0 },
      { home: 0, away: 2, hg: 0, ag: 2 },
      { home: 1, away: 3, hg: 2, ag: 0 },
    ];
    const st = computeStandings(four, [0, 1, 2, 3], matches, {});
    expect(st.map((s) => s.team)).toEqual([2, 0, 1, 3]);
  });

  it('computes DISC as negative fair-play points from yellow/red events', () => {
    const matches = [{ home: 0, away: 1, hg: 0, ag: 0, events: [{ type: 'yellow', teamId: 'a' }, { type: 'red', teamId: 'b' }] }];
    const st = computeStandings(teams.slice(0, 2), [0, 1], matches, { discYellow: 1, discRed: 5 });
    const byIdx = Object.fromEntries(st.map((s) => [s.team, s]));
    expect(byIdx[0].DISC).toBe(-1);
    expect(byIdx[1].DISC).toBe(-5);
  });

  it('returns an empty array for empty idxs', () => {
    expect(computeStandings(teams, [], [], {})).toEqual([]);
  });
});

describe('standingsForPhase', () => {
  it("uses the phase's own matches and cfg when no explicit matches are passed", () => {
    const state = { teams };
    const phase = { matches: [{ home: 0, away: 1, hg: 1, ag: 0 }], cfg: { winPts: 2 } };
    const st = standingsForPhase(state, phase, [0, 1]);
    expect(st.find((s) => s.team === 0).P).toBe(2);
  });

  it('accepts an explicit matches override, used for per-group slices', () => {
    const state = { teams, cfg: { winPts: 3 } };
    const phase = { matches: [], cfg: null };
    const st = standingsForPhase(state, phase, [0, 1], [{ home: 0, away: 1, hg: 1, ag: 0 }]);
    expect(st.find((s) => s.team === 0).P).toBe(3);
  });
});

describe('qualifiedFromPhase', () => {
  it('overall mode: top N by the phase standings, across all its participants', () => {
    const state = { teams };
    const phase = { formato: 'liga', matches: [{ home: 0, away: 1, hg: 2, ag: 0 }, { home: 1, away: 2, hg: 0, ag: 0 }], cfg: {}, participantTeamIds: null };
    expect(qualifiedFromPhase(state, phase, 'overall', 1)).toEqual(['a']);
  });

  it('perGroup mode: top N from each grupos-phase group', () => {
    const state = { teams };
    const phase = { formato: 'grupos', grupos: [['a', 'b'], ['c']], matches: [{ home: 0, away: 1, hg: 3, ag: 0, grupo: 0 }], cfg: {} };
    expect(qualifiedFromPhase(state, phase, 'perGroup', 1)).toEqual(['a', 'c']);
  });

  it('mata format: the bracket champion, if decided', () => {
    const state = { teams };
    const phase = { formato: 'mata', bracket: { rounds: [[{ a: 'a', b: 'b', winner: 'a' }]] } };
    expect(qualifiedFromPhase(state, phase, 'overall', 1)).toEqual(['a']);
  });

  it('mata format: empty when the final has no winner yet', () => {
    const state = { teams };
    const phase = { formato: 'mata', bracket: { rounds: [[{ a: 'a', b: 'b', winner: null }]] } };
    expect(qualifiedFromPhase(state, phase, 'overall', 1)).toEqual([]);
  });
});

describe('applyProgression', () => {
  function setup() {
    const src = { id: 'p1', formato: 'liga', matches: [{ home: 0, away: 1, hg: 2, ag: 0 }], cfg: {}, progression: { targetPhaseId: 'p2', mode: 'overall', count: 1 } };
    const target = { id: 'p2', nome: 'Fase 2', formato: 'liga', grupos: ['stale'], matches: ['stale'], bracket: { rounds: [] }, status: 'planejada' };
    const category = { id: 'c1', teams: [], phases: [src, target], activePhaseId: 'p1' };
    const state = { teams, activeCategoryId: 'c1', categories: [category], formato: 'liga', cfg: {}, matches: src.matches, grupos: [], bracket: null };
    return { state, category };
  }

  it('sends qualifiers to the target phase and switches to it', () => {
    const { state, category } = setup();
    const result = applyProgression(state, category, 'p1');
    expect(result).toEqual({ ok: true, count: 1, targetName: 'Fase 2' });
    const target = category.phases[1];
    expect(target.participantTeamIds).toEqual(['a']);
    expect(target.matches).toEqual([]);
    expect(target.grupos).toEqual([]);
    expect(target.bracket).toBeNull();
    expect(category.activePhaseId).toBe('p2');
  });

  it('reports incomplete without applying when the source phase still has pending matches, unless forced', () => {
    const { state, category } = setup();
    category.phases[0].matches.push({ home: 0, away: 1, hg: null, ag: null });
    expect(applyProgression(state, category, 'p1')).toEqual({ ok: false, reason: 'incomplete' });
    expect(category.phases[1].participantTeamIds).toBeUndefined();
    const forced = applyProgression(state, category, 'p1', { force: true });
    expect(forced.ok).toBe(true);
  });

  it('reports no-target when the source phase has no progression configured', () => {
    const { state, category } = setup();
    category.phases[0].progression = null;
    expect(applyProgression(state, category, 'p1')).toEqual({ ok: false, reason: 'no-target' });
  });

  it('reports target-missing when the configured target phase no longer exists', () => {
    const { state, category } = setup();
    category.phases[0].progression.targetPhaseId = 'ghost';
    expect(applyProgression(state, category, 'p1')).toEqual({ ok: false, reason: 'target-missing' });
  });

  it('reports no-qualifiers when standings produce nobody to send', () => {
    const { state, category } = setup();
    category.phases[0].formato = 'grupos';
    category.phases[0].grupos = [];
    category.phases[0].progression.mode = 'perGroup';
    expect(applyProgression(state, category, 'p1')).toEqual({ ok: false, reason: 'no-qualifiers' });
  });
});

describe('scorerRanking', () => {
  it('counts goal events per athlete across matches and bracket ties, sorted by goals desc', () => {
    const state = {
      teams: [{ id: 'a', nome: 'Alfa', roster: [{ id: 'ath1', nome: 'Zeca' }] }],
      matches: [{ id: 'm1', events: [{ type: 'goal', athleteId: 'ath1', teamId: 'a' }, { type: 'goal', athleteId: 'ath1', teamId: 'a' }] }],
      bracket: { rounds: [[{ id: 't1', events: [{ type: 'goal', athleteId: null, name: 'Anônimo', teamId: 'a' }] }]] },
    };
    const rows = scorerRanking(state);
    expect(rows[0]).toMatchObject({ athleteId: 'ath1', name: 'Zeca', goals: 2 });
    expect(rows[1]).toMatchObject({ name: 'Anônimo', goals: 1 });
  });

  it('returns an empty list when no events exist yet', () => {
    expect(scorerRanking({ matches: [{ id: 'm1' }] })).toEqual([]);
  });
});

describe('cardRanking', () => {
  it('counts yellow/red cards per athlete, sorted by a red-weighted score', () => {
    const state = {
      teams: [{ id: 'a', nome: 'Alfa', roster: [{ id: 'ath1', nome: 'Zeca' }, { id: 'ath2', nome: 'Duda' }] }],
      matches: [{ id: 'm1', events: [{ type: 'red', athleteId: 'ath1', teamId: 'a' }, { type: 'yellow', athleteId: 'ath2', teamId: 'a' }] }],
    };
    const rows = cardRanking(state);
    expect(rows[0]).toMatchObject({ athleteId: 'ath1', y: 0, r: 1 });
    expect(rows[1]).toMatchObject({ athleteId: 'ath2', y: 1, r: 0 });
  });

  it('excludes athletes with zero cards and ignores non-card event types', () => {
    const state = { matches: [{ id: 'm1', events: [{ type: 'goal', athleteId: 'x', teamId: 'a' }] }] };
    expect(cardRanking(state)).toEqual([]);
  });
});

describe('standsToRows', () => {
  it('formats standings rows as flat arrays for tabular export', () => {
    const st = [{ team: 0, P: 9, J: 3, V: 3, E: 0, D: 0, GP: 6, GC: 1, SG: 5, pct: 100 }];
    expect(standsToRows(teams, st)).toEqual([[1, 'Alfa', 9, 3, 3, 0, 0, 6, 1, '+5', '100.0']]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- standings`
Expected: FAIL — `Cannot find module './standings.js'`.

- [ ] **Step 3: Implement `src/app/standings.js`**

Adapted from legacy `h2h`/`computeStandings`/`standingsForPhase`/`qualifiedFromPhase`/`applyProgression`/`scorerRanking`/`cardRanking`/`standsToRows` (`:613-621, 641-650, 693-694, 1092`), converted to explicit `state`/`cfg` parameters instead of legacy's implicit global `state.cfg` reads:

```js
import { allMatchObjs } from './matches.js';
import { athName } from './roster.js';
import { phaseParticipants, phaseComplete, loadPhaseIntoRoot } from './phases.js';
import { saveRootIntoActive } from './categories.js';

export const CRIT_LABEL = { P: 'Pontos', V: 'Vitórias', SG: 'Saldo de gols', GP: 'Gols pró', GC: 'Gols contra', DISC: 'Disciplina (fair-play)', CD: 'Confronto direto' };
const CRIT_DIR = { P: 'desc', V: 'desc', SG: 'desc', GP: 'desc', GC: 'asc', DISC: 'desc' };

function emptyStat(i) { return { team: i, P: 0, J: 0, V: 0, E: 0, D: 0, GP: 0, GC: 0, SG: 0, pct: 0 }; }

function h2h(aIdx, bIdx, matches) {
  let pa = 0, pb = 0;
  matches.forEach((m) => {
    if (m.hg == null || m.ag == null) return;
    if (m.home === aIdx && m.away === bIdx) { if (m.hg > m.ag) pa += 3; else if (m.hg < m.ag) pb += 3; else { pa++; pb++; } }
    else if (m.home === bIdx && m.away === aIdx) { if (m.hg > m.ag) pb += 3; else if (m.hg < m.ag) pa += 3; else { pa++; pb++; } }
  });
  return pa - pb;
}

export function computeStandings(teams, idxs, matches, cfg = {}) {
  const map = {};
  idxs.forEach((i) => { map[i] = emptyStat(i); });
  const winPts = cfg.winPts != null ? cfg.winPts : 3;
  const drawPts = cfg.drawPts != null ? cfg.drawPts : 1;
  const lossPts = cfg.lossPts != null ? cfg.lossPts : 0;
  (matches || []).forEach((m) => {
    if (m.hg == null || m.ag == null) return;
    const H = map[m.home], A = map[m.away];
    if (H) { H.J++; H.GP += m.hg; H.GC += m.ag; if (m.hg > m.ag) { H.V++; H.P += winPts; } else if (m.hg < m.ag) { H.D++; H.P += lossPts; } else { H.E++; H.P += drawPts; } }
    if (A) { A.J++; A.GP += m.ag; A.GC += m.hg; if (m.ag > m.hg) { A.V++; A.P += winPts; } else if (m.ag < m.hg) { A.D++; A.P += lossPts; } else { A.E++; A.P += drawPts; } }
  });
  const arr = Object.values(map);
  const yp = cfg.discYellow != null ? cfg.discYellow : 1;
  const rp = cfg.discRed != null ? cfg.discRed : 5;
  const byId = {};
  idxs.forEach((i) => { if (teams[i]) byId[teams[i].id] = map[i]; });
  (matches || []).forEach((m) => (m.events || []).forEach((e) => {
    const s = byId[e.teamId];
    if (!s) return;
    if (e.type === 'yellow') s.CY = (s.CY || 0) + 1;
    else if (e.type === 'red') s.CR = (s.CR || 0) + 1;
  }));
  arr.forEach((s) => { s.SG = s.GP - s.GC; s.pct = s.J && winPts > 0 ? Math.round((s.P / (s.J * winPts)) * 1000) / 10 : 0; s.CY = s.CY || 0; s.CR = s.CR || 0; s.DISC = -(s.CY * yp + s.CR * rp); });
  const order = cfg.criterios || ['P', 'V', 'SG', 'GP'];
  const legacyH2H = !order.includes('CD') && cfg.confrontoDireto !== false;
  arr.sort((a, b) => {
    for (const c of order) {
      if (c === 'CD') { const h = h2h(b.team, a.team, matches || []); if (h !== 0) return h; continue; }
      const dir = CRIT_DIR[c] || 'desc';
      const diff = dir === 'asc' ? a[c] - b[c] : b[c] - a[c];
      if (diff) return diff;
    }
    if (legacyH2H) { const d = h2h(b.team, a.team, matches || []); if (d !== 0) return d; }
    return 0;
  });
  return arr;
}

export function standingsForPhase(state, phase, idxs, matches) {
  return computeStandings(state.teams || [], idxs, matches || phase.matches || [], phase.cfg || state.cfg || {});
}

export function qualifiedFromPhase(state, phase, mode, count) {
  count = Math.max(1, +count || 1);
  const teams = state.teams || [];
  if (phase.formato === 'grupos' && mode === 'perGroup') {
    const out = [];
    (phase.grupos || []).forEach((group, gi) => {
      const idxs = group.map((id) => teams.findIndex((t) => t.id === id)).filter((i) => i >= 0);
      const ms = (phase.matches || []).filter((m) => (m.grupo || 0) === gi);
      standingsForPhase(state, phase, idxs, ms).slice(0, count).forEach((x) => out.push(teams[x.team].id));
    });
    return out;
  }
  if (phase.formato === 'mata' && phase.bracket) {
    const rounds = phase.bracket.rounds || [];
    const last = rounds[rounds.length - 1];
    const winner = last && last[0] && last[0].winner != null ? last[0].winner : null;
    return winner ? [winner] : [];
  }
  const idxs = phaseParticipants(state, phase);
  return standingsForPhase(state, phase, idxs, phase.matches || []).slice(0, count).map((x) => teams[x.team].id);
}

export function applyProgression(state, category, srcId, { force = false } = {}) {
  saveRootIntoActive(state);
  const src = (category.phases || []).find((p) => p.id === srcId);
  if (!src || !src.progression || !src.progression.targetPhaseId) return { ok: false, reason: 'no-target' };
  const target = (category.phases || []).find((p) => p.id === src.progression.targetPhaseId);
  if (!target) return { ok: false, reason: 'target-missing' };
  if (!phaseComplete(src) && !force) return { ok: false, reason: 'incomplete' };
  const ids = qualifiedFromPhase(state, src, src.progression.mode || 'overall', src.progression.count || 2);
  if (!ids.length) return { ok: false, reason: 'no-qualifiers' };
  target.participantTeamIds = [...new Set(ids)];
  target.status = 'planejada';
  target.grupos = [];
  target.matches = [];
  target.bracket = null;
  category.activePhaseId = target.id;
  loadPhaseIntoRoot(state, target);
  return { ok: true, count: ids.length, targetName: target.nome };
}

export function scorerRanking(state) {
  const agg = {};
  allMatchObjs(state).forEach((m) => (m.events || []).forEach((e) => {
    if (e.type !== 'goal') return;
    const key = e.athleteId || `n:${(e.name || '').toLowerCase()}|${e.teamId || ''}`;
    if (!agg[key]) agg[key] = { athleteId: e.athleteId, name: e.athleteId ? athName(state, e.athleteId) : (e.name || '—'), teamId: e.teamId, goals: 0 };
    agg[key].goals++;
  }));
  return Object.values(agg).sort((a, b) => b.goals - a.goals);
}

export function cardRanking(state) {
  const agg = {};
  allMatchObjs(state).forEach((m) => (m.events || []).forEach((e) => {
    if (e.type !== 'yellow' && e.type !== 'red') return;
    const key = e.athleteId || `n:${(e.name || '').toLowerCase()}|${e.teamId || ''}`;
    if (!agg[key]) agg[key] = { athleteId: e.athleteId, name: e.athleteId ? athName(state, e.athleteId) : (e.name || '—'), teamId: e.teamId, y: 0, r: 0 };
    if (e.type === 'yellow') agg[key].y++; else agg[key].r++;
  }));
  return Object.values(agg).filter((r) => r.y || r.r).sort((a, b) => (b.r * 3 + b.y) - (a.r * 3 + a.y));
}

export function standsToRows(teams, st) {
  return st.map((s, i) => [i + 1, teams[s.team].nome, s.P, s.J, s.V, s.E, s.D, s.GP, s.GC, (s.SG > 0 ? '+' : '') + s.SG, s.pct.toFixed(1)]);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- standings`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/standings.js src/app/standings.test.js
git commit -m "feat: port standings computation, progression, and scorer/card rankings from legacy"
```

---

### Task 3: Cross-bracket generation — `genCross` in `src/app/standings.js`

**Revised during Task 2's review** (see Global Constraints' import-cycle correction above): `genCross` was originally planned for `src/app/engine.js`, but `matches.js` (a `standings.js` dependency) already imports `engine.js` — an `engine.js → standings.js` import would close a cycle. `genCross` lives in `standings.js` instead, importing from `engine.js` the same one-directional way `matches.js` already does.

**Files:**
- Modify: `src/app/standings.js`
- Modify: `src/app/standings.test.js`

**Interfaces:**
- Consumes: `makeBracketFromOrdered`, `advanceBracket` from `./engine.js`; existing `computeStandings` (same file, from Task 2).
- Produces: `genCross(state): {ok}` — imported by Task 5.

- [ ] **Step 1: Add the failing tests**

Append to `src/app/standings.test.js`:
```js
describe('genCross', () => {
  it("builds a cross-seeded bracket from each group's top classificam finishers", () => {
    const teams = [{ id: 'a1' }, { id: 'a2' }, { id: 'b1' }, { id: 'b2' }];
    const state = {
      teams,
      cfg: { classificam: 2 },
      grupos: [['a1', 'a2'], ['b1', 'b2']],
      matches: [
        { home: 0, away: 1, hg: 2, ag: 0, grupo: 0 },
        { home: 2, away: 3, hg: 2, ag: 0, grupo: 1 },
      ],
    };
    const result = genCross(state);
    expect(result).toEqual({ ok: true });
    expect(state.bracket).toBeTruthy();
    const ids = state.bracket.rounds[0].flatMap((tie) => [tie.a, tie.b]).sort();
    expect(ids).toEqual(['a1', 'a2', 'b1', 'b2']);
  });

  it('never assigns the same team to two ties, even with uneven group sizes', () => {
    const teams = [{ id: 'a1' }, { id: 'a2' }, { id: 'b1' }];
    const state = { teams, cfg: { classificam: 2 }, grupos: [['a1', 'a2'], ['b1']], matches: [] };
    const result = genCross(state);
    expect(result).toEqual({ ok: true });
    const ids = state.bracket.rounds[0].flatMap((tie) => [tie.a, tie.b]).filter((id) => id != null);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```
Add `genCross` to `src/app/standings.test.js`'s top import line:
```js
import { computeStandings, standingsForPhase, qualifiedFromPhase, applyProgression, scorerRanking, cardRanking, standsToRows, genCross } from './standings.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- standings`
Expected: FAIL — `genCross is not a function`.

- [ ] **Step 3: Implement `genCross` in `src/app/standings.js`**

Add this import to the top of `src/app/standings.js` (alongside the existing ones):
```js
import { makeBracketFromOrdered, advanceBracket } from './engine.js';
```
Then add the function (adapted from legacy `genCross`, `:969`; it calls the file's own `computeStandings` directly, no import needed for that):
```js
export function genCross(state) {
  const classificam = (state.cfg && state.cfg.classificam) || 2;
  const byPos = [];
  (state.grupos || []).forEach((group, gi) => {
    const idxs = group.map((id) => state.teams.findIndex((t) => t.id === id));
    const st = computeStandings(state.teams, idxs, (state.matches || []).filter((m) => m.grupo === gi), state.cfg || {});
    for (let p = 0; p < classificam; p++) {
      byPos[p] = byPos[p] || [];
      byPos[p].push(st[p] ? state.teams[st[p].team].id : null);
    }
  });
  let seedList = [];
  const W = byPos[0] || [], R = byPos[1] || [];
  if (classificam >= 2 && W.length === R.length && W.length > 1) {
    // Legacy's own R[j]-with-R[i]-fallback can assign the same team to two ties at once when a
    // group has fewer teams than `classificam` (R[j] and R[i] can resolve to the same id). Track
    // used ids and fall back to a null bye instead of a duplicate — makeBracketFromOrdered/
    // advanceBracket already treat null slots as byes, so this degrades safely.
    const used = new Set();
    for (let i = 0; i < W.length; i++) {
      const w = W[i];
      const j = i % 2 === 0 ? i + 1 : i - 1;
      let r = R[j] != null ? R[j] : R[i];
      if (r != null && used.has(r)) r = null;
      if (w != null) used.add(w);
      if (r != null) used.add(r);
      seedList.push(w);
      seedList.push(r);
    }
  } else {
    byPos.forEach((arr) => arr.forEach((id) => seedList.push(id)));
  }
  state.bracket = makeBracketFromOrdered(seedList, state.cfg);
  advanceBracket(state.bracket, state.cfg || {});
  return { ok: true };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- standings`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/standings.js src/app/standings.test.js
git commit -m "feat: add genCross, building a cross-seeded bracket from group standings"
```

---

### Task 4: Fix `setPhaseFormat`'s stale `progression.mode` — `src/app/phases.js`

**Files:**
- Modify: `src/app/phases.js`
- Modify: `src/app/phases.test.js`

**Interfaces:** No new exports — `setPhaseFormat`'s existing signature/contract is unchanged.

- [ ] **Step 1: Add the failing test**

Append inside the existing `describe('setPhaseFormat', ...)` block in `src/app/phases.test.js`:
```js
  it('resets a perGroup progression mode to overall when leaving grupos format', () => {
    const state = { formato: 'grupos', matches: [] };
    const category = { phases: [{ id: 'p1', formato: 'grupos', grupos: [], matches: [], bracket: null, progression: { mode: 'perGroup', count: 2, targetPhaseId: 'p2' } }], activePhaseId: 'p1' };
    setPhaseFormat(state, category, 'p1', 'liga');
    expect(category.phases[0].progression.mode).toBe('overall');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- phases`
Expected: FAIL — mode is still `'perGroup'`.

- [ ] **Step 3: Fix `setPhaseFormat`**

In `src/app/phases.js`, find:
```js
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
```
Replace with:
```js
export function setPhaseFormat(state, category, id, fmt) {
  saveRootIntoPhase(state, activePhaseOf(category));
  const phase = (category.phases || []).find((p) => p.id === id);
  if (!phase) return { ok: false };
  phase.formato = fmt;
  phase.grupos = [];
  phase.matches = [];
  phase.bracket = null;
  if (fmt !== 'grupos' && phase.progression && phase.progression.mode === 'perGroup') phase.progression.mode = 'overall';
  if (category.activePhaseId === id) loadPhaseIntoRoot(state, phase);
  return { ok: true };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- phases`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/phases.js src/app/phases.test.js
git commit -m "fix: reset perGroup progression mode when a phase leaves grupos format"
```

---

### Task 5: Wire standings, progression, cross-bracket, and Artilharia into `src/pages/championship.js`

**Files:**
- Modify: `src/pages/championship.js`

**Interfaces:**
- Consumes: `computeStandings`, `applyProgression`, `scorerRanking`, `CRIT_LABEL`, `genCross` from `../app/standings.js`.

No new automated tests (DOM wiring; Task 2/3's suites cover the logic). Same "no live browser in this sandbox" fallback as prior phases — verify by inspection, report `DONE_WITH_CONCERNS` if so.

- [ ] **Step 1: Extend imports**

Find:
```js
import { generateActivePhase, advanceBracket, findTie } from '../app/engine.js';
```
Replace with:
```js
import { generateActivePhase, advanceBracket, findTie } from '../app/engine.js';
import { computeStandings, applyProgression, scorerRanking, CRIT_LABEL, genCross } from '../app/standings.js';
```

- [ ] **Step 2: Add the Artilharia tab to the nav and the "Classificar →" button's markup**

Find:
```js
['classif','Tabela'],['equipes','Equipes'],['inscricoes','Inscrições']
```
Replace with:
```js
['classif','Tabela'],['equipes','Equipes'],['artilharia','Artilharia'],['inscricoes','Inscrições']
```

Find (inside `render()`):
```js
tab === 'equipes' ? teams() : tab === 'inscricoes'
```
Replace with:
```js
tab === 'equipes' ? teams() : tab === 'artilharia' ? scorersView() : tab === 'inscricoes'
```

Find (inside `fasesView()`, the progression-row segment):
```js
<input type="number" min="1" data-progress-count="${esc(phase.id)}" value="${prog.count || 2}" style="width:70px"><span class="muted">${esc(progressionSummary(category, phase))}</span></div>` : ''}
```
Replace with:
```js
<input type="number" min="1" data-progress-count="${esc(phase.id)}" value="${prog.count || 2}" style="width:70px"><span class="muted">${esc(progressionSummary(category, phase))}</span>${prog.targetPhaseId ? `<button class="btn primary sm" data-apply-progress="${esc(phase.id)}">Classificar →</button>` : ''}</div>` : ''}
```

- [ ] **Step 3: Rewrite `standings()` and add `standingsTableHTML()`/`scorersView()`**

Find:
```js
function standings() { const rows = (state.teams || []).map((team, index) => ({ team, index, p: 0, j: 0, gp: 0, gc: 0 })); (state.matches || []).forEach((match) => { if (match.hg == null || match.ag == null) return; const home = rows[match.home], away = rows[match.away]; if (!home || !away) return; home.j++; away.j++; home.gp += +match.hg; home.gc += +match.ag; away.gp += +match.ag; away.gc += +match.hg; if (+match.hg > +match.ag) home.p += 3; else if (+match.hg < +match.ag) away.p += 3; else { home.p++; away.p++; } }); rows.sort((a, b) => b.p - a.p || (b.gp - b.gc) - (a.gp - a.gc)); return `<div class="card"><h2>Tabela de classificação</h2><div class="table-wrap"><table><thead><tr><th>#</th><th>Equipe</th><th>P</th><th>J</th><th>GP</th><th>GC</th><th>SG</th></tr></thead><tbody>${rows.map((row, i) => `<tr><td>${i + 1}</td><td><strong>${esc(row.team.nome)}</strong></td><td>${row.p}</td><td>${row.j}</td><td>${row.gp}</td><td>${row.gc}</td><td>${row.gp - row.gc}</td></tr>`).join('')}</tbody></table></div></div>`; }
```
Replace with:
```js
function standingsTableHTML(st, highlight) {
  const showDisc = !!(state.cfg && state.cfg.criterios && state.cfg.criterios.includes('DISC'));
  return `<div class="table-wrap"><table><thead><tr><th>#</th><th>Equipe</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th><th>%</th>${showDisc ? '<th>DISC</th>' : ''}</tr></thead><tbody>${st.map((s, i) => `<tr${highlight && i < highlight ? ' style="background:var(--surface-muted)"' : ''}><td>${i + 1}</td><td><strong>${esc(state.teams[s.team].nome)}</strong></td><td>${s.P}</td><td>${s.J}</td><td>${s.V}</td><td>${s.E}</td><td>${s.D}</td><td>${s.GP}</td><td>${s.GC}</td><td>${s.SG > 0 ? '+' : ''}${s.SG}</td><td>${s.pct.toFixed(1)}</td>${showDisc ? `<td>${s.DISC}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}

function standings() {
  if (state.formato === 'mata') return `<div class="card"><p class="muted">Esta fase usa chaveamento. Veja e registre os placares na aba "Chaveamento".</p></div>`;
  const criteriaLine = `<p class="muted" style="margin:0 0 12px;font-size:13px">Desempate: ${(state.cfg?.criterios || ['P', 'V', 'SG', 'GP']).map((c) => CRIT_LABEL[c] || c).join(' › ')}${state.cfg?.confrontoDireto !== false && !(state.cfg?.criterios || []).includes('CD') ? ' › Confronto direto' : ''}</p>`;
  if (state.formato === 'grupos') {
    if (!(state.grupos || []).length) return `<div class="card"><p class="muted">Nenhum grupo gerado ainda.</p></div>`;
    return state.grupos.map((group, gi) => {
      const idxs = group.map((id) => state.teams.findIndex((t) => t.id === id));
      const st = computeStandings(state.teams, idxs, (state.matches || []).filter((m) => m.grupo === gi), state.cfg || {});
      return `<div class="card" style="margin-top:${gi ? '16px' : '0'}"><h2>Grupo ${String.fromCharCode(65 + gi)}</h2>${standingsTableHTML(st, state.cfg?.classificam || 2)}</div>`;
    }).join('');
  }
  if (state.formato === 'gxg') {
    const A = (state.grupos?.[0] || []).map((id) => state.teams.findIndex((t) => t.id === id));
    const B = (state.grupos?.[1] || []).map((id) => state.teams.findIndex((t) => t.id === id));
    const stA = computeStandings(state.teams, A, state.matches || [], state.cfg || {});
    const stB = computeStandings(state.teams, B, state.matches || [], state.cfg || {});
    return `<div class="card"><h2>Grupo A</h2>${standingsTableHTML(stA, 0)}</div><div class="card" style="margin-top:16px"><h2>Grupo B</h2>${standingsTableHTML(stB, 0)}</div>`;
  }
  const st = computeStandings(state.teams || [], (state.teams || []).map((_, i) => i), state.matches || [], state.cfg || {});
  return `<div class="card"><h2>Tabela de classificação</h2>${criteriaLine}${standingsTableHTML(st, 0)}</div>`;
}

function scorersView() {
  const rows = scorerRanking(state);
  if (!rows.length) return `<div class="card"><p class="muted">Nenhum gol registrado ainda.</p></div>`;
  return `<div class="card"><h2>Artilharia</h2><div class="table-wrap"><table><thead><tr><th>#</th><th>Atleta</th><th>Equipe</th><th>Gols</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${r.teamId ? esc(teamNameById(state, r.teamId) || '—') : '—'}</td><td>${r.goals}</td></tr>`).join('')}</tbody></table></div></div>`;
}
```

- [ ] **Step 4: Extend `bracketView()` for `grupos` phases**

Find:
```js
function bracketView() { if (state.formato !== 'mata') return `<div class="card"><p class="muted">Esta fase não usa chaveamento. Troque o formato da fase ativa para "Mata-Mata" na aba Fases.</p></div>`; if (!state.bracket) return `<div class="card"><p class="muted">Nenhum chaveamento gerado ainda. Use "Gerar/Refazer" na aba Fases.</p></div>`; advanceBracket(state.bracket, state.cfg); const rounds = state.bracket.rounds; return `<div class="card"><h2>Chaveamento</h2><div class="bracket-cols">${rounds.map((round) => `<div class="bcol"><h3 class="muted">${roundLabel(round.length * 2)}</h3>${round.map((tie) => tieRow(tie)).join('')}</div>`).join('')}${state.bracket.third ? `<div class="bcol"><h3 class="muted">Disputa de 3º lugar</h3>${tieRow(state.bracket.third)}</div>` : ''}</div></div>`; }
```
Replace with:
```js
function bracketView() {
  if (state.formato === 'grupos') {
    if (!(state.grupos || []).length) return `<div class="card"><p class="muted">Gere os jogos da fase primeiro, na aba "Fases".</p></div>`;
    if (!state.bracket) return `<div class="card"><p class="muted" style="margin-bottom:14px">Gere o mata-mata cruzando os classificados de cada grupo.</p><button class="btn primary" data-gen-cross>⚔️ Gerar mata-mata</button></div>`;
  } else if (state.formato !== 'mata') {
    return `<div class="card"><p class="muted">Esta fase não usa chaveamento. Troque o formato da fase ativa para "Mata-Mata" na aba Fases.</p></div>`;
  }
  if (!state.bracket) return `<div class="card"><p class="muted">Nenhum chaveamento gerado ainda. Use "Gerar/Refazer" na aba Fases.</p></div>`;
  advanceBracket(state.bracket, state.cfg);
  const rounds = state.bracket.rounds;
  return `<div class="card">${state.formato === 'grupos' ? '<div class="actions" style="justify-content:flex-end;margin-bottom:8px"><button class="btn ghost sm" data-regen-cross>↺ Regerar</button></div>' : ''}<h2>Chaveamento</h2><div class="bracket-cols">${rounds.map((round) => `<div class="bcol"><h3 class="muted">${roundLabel(round.length * 2)}</h3>${round.map((tie) => tieRow(tie)).join('')}</div>`).join('')}${state.bracket.third ? `<div class="bcol"><h3 class="muted">Disputa de 3º lugar</h3>${tieRow(state.bracket.third)}</div>` : ''}</div></div>`;
}
```

- [ ] **Step 5: Wire the new handlers in `bind()`**

Find:
```js
root.querySelectorAll('[data-match-ops]').forEach((button) => button.onclick = () => matchOpsModal(button.dataset.matchOps)); const saveConfig
```
Replace with:
```js
root.querySelectorAll('[data-match-ops]').forEach((button) => button.onclick = () => matchOpsModal(button.dataset.matchOps)); root.querySelectorAll('[data-apply-progress]').forEach((button) => button.onclick = async () => { const category = activeCategory(state); const phaseId = button.dataset.applyProgress; let result = applyProgression(state, category, phaseId); if (!result.ok && result.reason === 'incomplete') { if (!confirm('A fase ainda possui jogos pendentes. Avançar com a classificação atual?')) return; result = applyProgression(state, category, phaseId, { force: true }); } if (!result.ok) return toast({ 'no-target': 'Configure a fase de destino', 'target-missing': 'Fase de destino não encontrada', 'no-qualifiers': 'Ainda não há classificados definidos' }[result.reason] || 'Não foi possível classificar'); tab = 'fases'; await persist(); await addAudit(state.id, 'phase_progressed', `${result.count} classificado(s) enviados para ${esc(result.targetName)}`); render(); }); const genCrossBtn = root.querySelector('[data-gen-cross]'); if (genCrossBtn) genCrossBtn.onclick = async () => { genCross(state); await persist(); await addAudit(state.id, 'bracket_generated', 'Mata-mata gerado a partir dos grupos'); render(); }; const regenCrossBtn = root.querySelector('[data-regen-cross]'); if (regenCrossBtn) regenCrossBtn.onclick = async () => { if (!confirm('Regerar o mata-mata? O chaveamento atual será substituído.')) return; genCross(state); await persist(); await addAudit(state.id, 'bracket_generated', 'Mata-mata regerado'); render(); }; const saveConfig
```

- [ ] **Step 6: CSS check**

Every element added in Steps 2–5 reuses `.card`, `.table-wrap table`, `.actions`, `.btn`/`.btn.primary`/`.btn.ghost`, and the already-unstyled-but-precedented `.sm` modifier (Phase 3b's `matchOpsModal` button). The qualification-zone highlight is an inline `style`, not a class. No new selectors needed. Confirm by re-reading the markup before moving on.

- [ ] **Step 7: Run the full test suite and build**

Run: `npm test`
Expected: all tests pass.

Run: `npm run build && npm run verify`
Expected: both succeed.

- [ ] **Step 8: Manual smoke check (best-effort, same fallback as prior phases)**

If reachable: create a `grupos`-format phase, generate it, enter enough scores to complete a group, open Tabela and confirm two per-group tables render with the top `classificam` rows highlighted; go to Fases, set a progression target/mode/count on that phase, click "Classificar →", confirm the target phase receives `participantTeamIds` and becomes active; go to Chaveamento, click "Gerar mata-mata", confirm a bracket appears; open Artilharia and confirm it shows the empty state (no goal events exist yet — expected until Phase 4).

If not reachable, skip, verify by inspection, report `DONE_WITH_CONCERNS`.

- [ ] **Step 9: Commit**

```bash
git add src/pages/championship.js
git commit -m "feat: wire per-group standings, progression, cross-bracket generation, and an Artilharia tab into championship management"
```

---

## Self-Review

**Spec coverage** — `computeStandings`, `standingsForPhase`, `qualifiedFromPhase`, `applyProgression`, `standingsTable`→`standingsTableHTML`, `standsToRows`, `scorerRanking`→`scorerRanking`+`scorersView`, `cardRanking` (ported, uncalled until 3d's `viewDisciplina`), `h2h` (private helper inside `computeStandings`), `allMatchObjs`, `genCross`, `renderMataFromGroups`→folded into `bracketView()`'s `grupos` branch — all covered. `drawBracket`/`drawGroups`/`runDraw`/`toggleSeed`/`refreshSeeds`/`seedOrder`/`renderDraw`/`confirmDraw`/`finishDraw`/`isSeed` — explicitly rescoped with rationale (creation-wizard screen, unrelated to standings).

**Placeholder scan** — no TBD/TODO; every step has literal code.

**Type consistency** — `computeStandings(teams, idxs, matches, cfg)` signature is consistent across `standings.js` (including its own `genCross`) and `championship.js`'s `standings()`/`bracketView()` call sites. `state`/`category`/`srcId` parameter order in `applyProgression` matches `categories.js`/`phases.js`'s existing `state, category, id` convention.
