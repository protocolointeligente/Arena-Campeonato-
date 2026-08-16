# Migration Phase 4a: Súmula & Match Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let organizers record goals, yellow cards, and red cards per athlete on a match or bracket tie (a "Súmula" modal) — the missing piece that makes Phase 3c's Artilharia tab and Phase 3d's Disciplina tab show real data instead of their permanent empty states, since both read `match.events`, which nothing in `src/` writes to yet.

**Architecture:** Sub-phase 4a of Phase 4, tracked at `docs/superpowers/plans/MIGRATION-PROGRESS.md`. Legacy source: `arena-campeonatos-v2-intervencao-19.html:1024-1037` (`sumulaModal`/`renderSumula`/`suObj`/`suAdd`/`suAddAnon`/`suDel`). Split from the rest of Phase 4 (PDF/JSON exports, `printSumula`) because this half unblocks real data for two already-shipped tabs and has zero dependency on the export/report machinery — the reverse isn't true (`printSumula`, Phase 4b, needs a populated `match.events` to print anything meaningful), so this half goes first, same dependency-ordering reasoning that split Phase 3 into 3a→3d.

**Rescope vs. the published audit:** none — `sumulaModal`/`renderSumula` are explicitly Phase 4 scope per `MIGRATION-PROGRESS.md`'s table; `suObj`/`suAdd`/`suAddAnon`/`suDel` are pulled forward as the plumbing those two functions need, same as every prior phase pulling forward a dependency's private helpers (e.g. Phase 3a pulling forward `tieObj`/`resolveTie`).

**Pure vs. DOM split**, continuing the established pattern: `src/app/matches.js` gains `addMatchEvent(obj, {type, teamId, athleteId, name})` and `removeMatchEvent(obj, index)` — pure mutators operating on a match-or-tie object (both shapes already carry `.events` per Phase 3c/3d's `allMatchObjs`/`scorerRanking`/`cardRanking`), returning `{ok, ...}` like every other mutator in the file. `src/pages/championship.js` gains a `sumulaModal(kind, id)` page function (DOM only) that resolves the target object (`state.matches` lookup for `kind==='match'`, `findTie` for `kind==='tie'`), renders the event list + per-athlete goal/card buttons, and self-refreshes in place after each action — the same pattern `rosterModal` already uses.

**Fixing a latent gap, not reproducing it:** `clearResults` (`src/app/matches.js`, Phase 3b) resets `match.hg`/`ag`/`scorers` and each tie's score fields, but never touches `.events` — flagged as a Phase 3d follow-up ("`clearResults` should reset whatever superset field replaces `scorers`" once it exists). Now that this phase makes `.events` a real, populated field, `clearResults` is fixed here (Task 1) to reset it too — the exact "natural place to decide the right behavior" the follow-up called for.

**Tech Stack:** Same as prior phases — vanilla JS ES modules, Vitest.

## Global Constraints

- Legacy source of truth: `arena-campeonatos-v2-intervencao-19.html:1024-1037`.
- Mutating functions return `{ok, reason?, ...}` — matches every prior phase's contract.
- `npm run build`, `npm run verify`, `npm test` must all succeed after every task.
- No new UI framework — `data-*` + `bind()`.
- Event `type` is one of `'goal' | 'yellow' | 'red'` — the same three values `scorerRanking`/`cardRanking` (Phase 3c) already filter on.
- **Every new/changed `class="..."` must be checked against `layout.css`/`tokens.css`**, for both the class's own rule and any descendant-selector rule (standing instruction since Phase 2d). This phase introduces **no new classes** — every new element reuses `.card` (the modal shell, `#modalBox`, already carries `.card.modal-card`), `.row`, `.muted`, `.btn`/`.btn.primary`/`.btn.ghost`, `.sm`, and `.team-row` (used with exactly 3 or 4 children per the grid's `34px 1fr auto auto` columns — see each task for the exact shape; Phase 3d's own review caught and fixed a 2-child `.team-row` mistake, so this is checked explicitly per row type below).
- Avoid import cycles: `src/app/matches.js` already imports from `./format.js`, `./ops.js`, `./engine.js` (one-directional). This phase adds one new import to `matches.js` — `uid` from `./utils.js`, a leaf module with no imports of its own, so no cycle risk.

## File Structure

| File | Responsibility |
|---|---|
| `src/app/matches.js` | Add: `addMatchEvent(obj, {type, teamId, athleteId, name})`, `removeMatchEvent(obj, index)`; fix: `clearResults` also resets `.events` — no DOM |
| `src/app/matches.test.js` | Tests for the above |
| `src/pages/championship.js` | Add "Súmula" button to `games()`'s match rows and `tieRow()`'s scoreable ties; add `sumulaModal(kind, id)` + its `bind()` wiring |

---

### Task 1: `addMatchEvent`/`removeMatchEvent` + `clearResults` fix — `src/app/matches.js`

**Files:**
- Modify: `src/app/matches.js`
- Modify: `src/app/matches.test.js`

**Interfaces:**
- Consumes: `uid` from `./utils.js` (new import).
- Produces: `addMatchEvent(obj, {type, teamId, athleteId, name}): {ok, reason?, event?}`, `removeMatchEvent(obj, index): {ok, reason?}` — consumed by Task 2's `sumulaModal`.

- [ ] **Step 1: Add the failing tests**

Append to `src/app/matches.test.js`:
```js
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
```
Update the top import line to include `addMatchEvent, removeMatchEvent`:
```js
import { matchMeta, splitInfo, metaLine, setScore, saveMatchOps, clearResults, allMatchObjs, addMatchEvent, removeMatchEvent } from './matches.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- matches`
Expected: FAIL — `addMatchEvent is not a function`.

- [ ] **Step 3: Implement in `src/app/matches.js`**

Add this import to the top of the file (alongside the existing ones):
```js
import { uid } from './utils.js';
```
Add at the end of the file (adapted from legacy `suAdd`/`suAddAnon`/`suDel`, `:1035-1037`, generalized into one add function covering both the athlete and anonymous cases — legacy's two functions differed only in whether `athleteId`/`name` were passed):
```js
const EVENT_TYPES = ['goal', 'yellow', 'red'];

export function addMatchEvent(obj, { type, teamId, athleteId, name } = {}) {
  if (!obj || !EVENT_TYPES.includes(type)) return { ok: false };
  obj.events = obj.events || [];
  const event = { id: uid(), type, teamId, athleteId: athleteId || null, name: name || '' };
  obj.events.push(event);
  return { ok: true, event };
}

export function removeMatchEvent(obj, index) {
  if (!obj || !Array.isArray(obj.events) || index < 0 || index >= obj.events.length) return { ok: false };
  obj.events.splice(index, 1);
  return { ok: true };
}
```

Then fix `clearResults` to also reset `.events`. Find:
```js
export function clearResults(state) {
  (state.matches || []).forEach((match) => { match.hg = null; match.ag = null; match.scorers = []; });
  if (state.bracket) {
    const resetTie = (tie) => { tie.ag1 = tie.bg1 = tie.ag2 = tie.bg2 = tie.apen = tie.bpen = null; tie.winner = null; tie.scorers = []; };
    (state.bracket.rounds || []).forEach((round) => round.forEach(resetTie));
    if (state.bracket.third) resetTie(state.bracket.third);
    advanceBracket(state.bracket, state.cfg);
  }
  return { ok: true };
}
```
Replace with:
```js
export function clearResults(state) {
  (state.matches || []).forEach((match) => { match.hg = null; match.ag = null; match.scorers = []; match.events = []; });
  if (state.bracket) {
    const resetTie = (tie) => { tie.ag1 = tie.bg1 = tie.ag2 = tie.bg2 = tie.apen = tie.bpen = null; tie.winner = null; tie.scorers = []; tie.events = []; };
    (state.bracket.rounds || []).forEach((round) => round.forEach(resetTie));
    if (state.bracket.third) resetTie(state.bracket.third);
    advanceBracket(state.bracket, state.cfg);
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- matches`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/matches.js src/app/matches.test.js
git commit -m "feat: add addMatchEvent/removeMatchEvent, fix clearResults to also reset match events"
```

---

### Task 2: Súmula modal — `src/pages/championship.js`

**Files:**
- Modify: `src/pages/championship.js`

**Interfaces:**
- Consumes: `addMatchEvent`, `removeMatchEvent` (Task 1) from `../app/matches.js`; `athName` from `../app/roster.js` (Phase 2b's `athName(state, athleteId): string`, not currently imported into this file — `teamById`/`teamNameById` are already imported).

No new automated tests (DOM wiring; Task 1's suite covers the logic). Same "no live browser in this sandbox" fallback as prior phases — verify by inspection, report `DONE_WITH_CONCERNS` if so.

- [ ] **Step 1: Extend imports**

Find:
```js
import { matchMeta, metaLine, setScore, saveMatchOps, clearResults } from '../app/matches.js';
```
Replace with:
```js
import { matchMeta, metaLine, setScore, saveMatchOps, clearResults, addMatchEvent, removeMatchEvent } from '../app/matches.js';
```

- [ ] **Step 2: Add the "Súmula" button to `games()`'s match rows**

Find:
```js
  function games() { if (state.formato === 'mata') return `<div class="card"><p class="muted">Esta fase usa chaveamento. Veja e registre os placares na aba "Chaveamento".</p></div>`; return `<div class="card"><div class="actions" style="justify-content:space-between"><div><h2>Jogos</h2><p class="muted">Registre os placares das partidas.</p></div><button class="btn" data-generate>Gerar tabela</button></div><div style="margin-top:18px">${(state.matches || []).map((match) => { const home = state.teams?.[match.home]?.nome || 'A definir'; const away = state.teams?.[match.away]?.nome || 'A definir'; const line = metaLine(state, match); const status = matchMeta(match).status; const statusText = status === 'live' ? 'AO VIVO' : status === 'postponed' ? 'Adiada' : status === 'cancelled' ? 'Cancelada' : ''; return `<div class="game-row"><strong>${esc(home)}</strong><input type="number" min="0" data-score="${match.id}:hg" value="${match.hg ?? ''}"><span>×</span><input type="number" min="0" data-score="${match.id}:ag" value="${match.ag ?? ''}"><strong>${esc(away)}</strong></div><div class="row" style="flex-wrap:wrap;padding:2px 0 12px"><span class="muted" style="flex:1">${statusText ? `<strong>${statusText}</strong> · ` : ''}${esc(line)}</span><button class="btn ghost sm" data-match-ops="${esc(match.id)}">Dados da partida</button></div>`; }).join('') || '<p class="muted">Nenhum jogo gerado ainda.</p>'}</div></div>`; }
```
Replace with:
```js
  function games() { if (state.formato === 'mata') return `<div class="card"><p class="muted">Esta fase usa chaveamento. Veja e registre os placares na aba "Chaveamento".</p></div>`; return `<div class="card"><div class="actions" style="justify-content:space-between"><div><h2>Jogos</h2><p class="muted">Registre os placares das partidas.</p></div><button class="btn" data-generate>Gerar tabela</button></div><div style="margin-top:18px">${(state.matches || []).map((match) => { const home = state.teams?.[match.home]?.nome || 'A definir'; const away = state.teams?.[match.away]?.nome || 'A definir'; const line = metaLine(state, match); const status = matchMeta(match).status; const statusText = status === 'live' ? 'AO VIVO' : status === 'postponed' ? 'Adiada' : status === 'cancelled' ? 'Cancelada' : ''; return `<div class="game-row"><strong>${esc(home)}</strong><input type="number" min="0" data-score="${match.id}:hg" value="${match.hg ?? ''}"><span>×</span><input type="number" min="0" data-score="${match.id}:ag" value="${match.ag ?? ''}"><strong>${esc(away)}</strong></div><div class="row" style="flex-wrap:wrap;padding:2px 0 12px"><span class="muted" style="flex:1">${statusText ? `<strong>${statusText}</strong> · ` : ''}${esc(line)}</span><button class="btn ghost sm" data-match-ops="${esc(match.id)}">Dados da partida</button><button class="btn ghost sm" data-sumula="match:${esc(match.id)}">📋 Súmula</button></div>`; }).join('') || '<p class="muted">Nenhum jogo gerado ainda.</p>'}</div></div>`; }
```

- [ ] **Step 3: Add the "Súmula" button to `tieRow()`'s scoreable ties**

Find:
```js
  function tieRow(tie) { const homeName = tie.a != null ? esc(teamNameById(state, tie.a) || '—') : 'A definir'; const awayName = tie.b != null ? esc(teamNameById(state, tie.b) || '—') : 'A definir'; const canScore = tie.a != null && tie.b != null; const single = !!state.cfg?.maoUnica; const winnerText = tie.winner != null ? ` <span class="muted">· vencedor: ${esc(teamNameById(state, tie.winner) || '—')}</span>` : ''; const showPen = canScore && tie.ag1 != null && tie.bg1 != null && (single || (tie.ag2 != null && tie.bg2 != null)); return `<div class="row" style="flex-wrap:wrap;padding:8px 0;border-bottom:1px solid var(--line)"><span style="flex:1">${homeName} <span class="muted">×</span> ${awayName}${winnerText}</span>${canScore ? `<input type="number" min="0" data-tie-score="${tie.id}:ag1" value="${tie.ag1 ?? ''}" style="width:50px" title="Placar 1ª perna — ${homeName}"><input type="number" min="0" data-tie-score="${tie.id}:bg1" value="${tie.bg1 ?? ''}" style="width:50px" title="Placar 1ª perna — ${awayName}">${!single ? `<input type="number" min="0" data-tie-score="${tie.id}:ag2" value="${tie.ag2 ?? ''}" style="width:50px" title="Placar 2ª perna — ${homeName}"><input type="number" min="0" data-tie-score="${tie.id}:bg2" value="${tie.bg2 ?? ''}" style="width:50px" title="Placar 2ª perna — ${awayName}">` : ''}${showPen ? `<input type="number" min="0" data-tie-score="${tie.id}:apen" value="${tie.apen ?? ''}" style="width:50px" title="Pênaltis — ${homeName}"><input type="number" min="0" data-tie-score="${tie.id}:bpen" value="${tie.bpen ?? ''}" style="width:50px" title="Pênaltis — ${awayName}">` : ''}` : ''}</div>`; }
```
Replace with:
```js
  function tieRow(tie) { const homeName = tie.a != null ? esc(teamNameById(state, tie.a) || '—') : 'A definir'; const awayName = tie.b != null ? esc(teamNameById(state, tie.b) || '—') : 'A definir'; const canScore = tie.a != null && tie.b != null; const single = !!state.cfg?.maoUnica; const winnerText = tie.winner != null ? ` <span class="muted">· vencedor: ${esc(teamNameById(state, tie.winner) || '—')}</span>` : ''; const showPen = canScore && tie.ag1 != null && tie.bg1 != null && (single || (tie.ag2 != null && tie.bg2 != null)); return `<div class="row" style="flex-wrap:wrap;padding:8px 0;border-bottom:1px solid var(--line)"><span style="flex:1">${homeName} <span class="muted">×</span> ${awayName}${winnerText}</span>${canScore ? `<input type="number" min="0" data-tie-score="${tie.id}:ag1" value="${tie.ag1 ?? ''}" style="width:50px" title="Placar 1ª perna — ${homeName}"><input type="number" min="0" data-tie-score="${tie.id}:bg1" value="${tie.bg1 ?? ''}" style="width:50px" title="Placar 1ª perna — ${awayName}">${!single ? `<input type="number" min="0" data-tie-score="${tie.id}:ag2" value="${tie.ag2 ?? ''}" style="width:50px" title="Placar 2ª perna — ${homeName}"><input type="number" min="0" data-tie-score="${tie.id}:bg2" value="${tie.bg2 ?? ''}" style="width:50px" title="Placar 2ª perna — ${awayName}">` : ''}${showPen ? `<input type="number" min="0" data-tie-score="${tie.id}:apen" value="${tie.apen ?? ''}" style="width:50px" title="Pênaltis — ${homeName}"><input type="number" min="0" data-tie-score="${tie.id}:bpen" value="${tie.bpen ?? ''}" style="width:50px" title="Pênaltis — ${awayName}">` : ''}<button class="btn ghost sm" data-sumula="tie:${esc(tie.id)}">📋 Súmula</button>` : ''}</div>`; }
```

- [ ] **Step 4: Add `sumulaModal()`**

Find (the end of `matchOpsModal()` — anchors the insertion right after it, keeping every modal function grouped together):
```js
  function games() { if (state.formato === 'mata')
```
Replace with:
```js
  function sumulaObj(kind, id) { return kind === 'match' ? (state.matches || []).find((m) => m.id === id) : findTie(state.bracket, id); }
  function sumulaModal(kind, id) {
    const obj = sumulaObj(kind, id);
    if (!obj) return;
    obj.events = obj.events || [];
    const sides = kind === 'match' ? [state.teams?.[obj.home], state.teams?.[obj.away]].filter(Boolean) : [obj.a, obj.b].map((tid) => teamById(state, tid)).filter(Boolean);
    const evHTML = obj.events.length ? obj.events.map((e, i) => { const icon = e.type === 'goal' ? '⚽' : (e.type === 'yellow' ? '🟨' : '🟥'); const name = e.athleteId ? athName(state, e.athleteId) : (e.name || '?'); return `<div class="team-row"><span>${icon}</span><span>${esc(name)} <span class="muted">— ${esc(teamNameById(state, e.teamId) || '—')}</span></span><span class="muted"></span><button class="btn ghost sm" data-sumula-remove="${i}">✕</button></div>`; }).join('') : '<p class="muted">Nenhum lance registrado.</p>';
    const teamPicker = sides.map((team) => { const roster = team.roster || []; return `<div style="margin-top:12px"><strong>${esc(team.nome)}</strong>${roster.length ? roster.map((athlete) => `<div class="team-row"><span>${athlete.numero ? esc(athlete.numero) : ''}</span><span>${esc(athlete.nome)}</span><span class="row"><button class="btn ghost sm" data-sumula-add="${esc(team.id)}:${esc(athlete.id)}:goal">⚽</button><button class="btn ghost sm" data-sumula-add="${esc(team.id)}:${esc(athlete.id)}:yellow">🟨</button><button class="btn ghost sm" data-sumula-add="${esc(team.id)}:${esc(athlete.id)}:red">🟥</button></span></div>`).join('') : '<p class="muted">Sem elenco cadastrado.</p>'}<div class="row" style="margin-top:6px"><button class="btn ghost sm" data-sumula-anon="${esc(team.id)}:goal">+ ⚽ s/ atleta</button><button class="btn ghost sm" data-sumula-anon="${esc(team.id)}:yellow">+ 🟨</button><button class="btn ghost sm" data-sumula-anon="${esc(team.id)}:red">+ 🟥</button></div></div>`; }).join('');
    modal(`<h3>📋 Súmula</h3><p class="muted">${sides.map((t) => esc(t.nome)).join(' × ')}</p><div style="margin:14px 0">${evHTML}</div><div style="border-top:1px solid var(--line);margin:10px 0"></div>${teamPicker}<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn primary" data-close-modal>Concluir</button></div>`);
    const box = document.getElementById('modalBox');
    box.querySelector('[data-close-modal]').onclick = () => { closeModal(); render(); };
    box.querySelectorAll('[data-sumula-add]').forEach((button) => button.onclick = async () => { const [teamId, athleteId, type] = button.dataset.sumulaAdd.split(':'); addMatchEvent(obj, { type, teamId, athleteId }); await persist(); sumulaModal(kind, id); });
    box.querySelectorAll('[data-sumula-anon]').forEach((button) => button.onclick = async () => { const [teamId, type] = button.dataset.sumulaAnon.split(':'); addMatchEvent(obj, { type, teamId, name: '' }); await persist(); sumulaModal(kind, id); });
    box.querySelectorAll('[data-sumula-remove]').forEach((button) => button.onclick = async () => { removeMatchEvent(obj, +button.dataset.sumulaRemove); await persist(); sumulaModal(kind, id); });
  }
  function games() { if (state.formato === 'mata')
```

- [ ] **Step 5: Add `athName` to the `roster.js` import**

Find:
```js
import { teamById, teamNameById, addAthlete, updateAthlete, removeAthlete, setAthletePhoto, setTeamLogo, compressPhoto } from '../app/roster.js';
```
Replace with:
```js
import { teamById, teamNameById, athName, addAthlete, updateAthlete, removeAthlete, setAthletePhoto, setTeamLogo, compressPhoto } from '../app/roster.js';
```

- [ ] **Step 6: Wire the `[data-sumula]` open-button handler in `bind()`**

Find:
```js
root.querySelectorAll('[data-match-ops]').forEach((button) => button.onclick = () => matchOpsModal(button.dataset.matchOps));
```
Replace with:
```js
root.querySelectorAll('[data-match-ops]').forEach((button) => button.onclick = () => matchOpsModal(button.dataset.matchOps)); root.querySelectorAll('[data-sumula]').forEach((button) => button.onclick = () => { const [kind, id] = button.dataset.sumula.split(':'); sumulaModal(kind, id); });
```

- [ ] **Step 7: CSS check**

Every element added reuses `.card` (the modal shell already has it), `.row`, `.muted`, `.btn`/`.btn.primary`/`.btn.ghost`, `.sm`. Both new `.team-row` shapes have exactly the child count their content needs against the `34px 1fr auto auto` grid: the event-list row has 4 children (icon / name+team / empty muted spacer / remove button — one child per column), and the athlete-picker row has 3 children (number / name / button group — same shape Phase 3d's criteria rows and suspended-player rows already established). No new selectors needed. Confirm by re-reading the markup before moving on.

- [ ] **Step 8: Run the full test suite and build**

Run: `npm test`
Expected: all tests pass.

Run: `npm run build && npm run verify`
Expected: both succeed.

- [ ] **Step 9: Manual smoke check (best-effort, same fallback as prior phases)**

If reachable: open a championship with a generated match and at least one team with roster athletes; click "Súmula" on a match row, add a goal for an athlete, confirm it appears in the event list and the counter persists after closing/reopening the modal; add an anonymous yellow card; remove an event; open Artilharia and Disciplina and confirm the goal/card now shows up (no longer the empty state). Repeat for a bracket tie's Súmula button once a mata-mata phase has scoreable ties. If not reachable, skip, verify by inspection, report `DONE_WITH_CONCERNS`.

- [ ] **Step 10: Commit**

```bash
git add src/pages/championship.js
git commit -m "feat: add a Súmula modal for recording match/tie goals and cards"
```

---

## Self-Review

**Spec coverage** — `sumulaModal`→`sumulaModal`, `renderSumula`→folded into `sumulaModal` (single self-refreshing function, matching `rosterModal`'s existing pattern rather than legacy's separate `sumulaModal`/`renderSumula` pair — legacy split them because `sumulaModal` did one-time setup (`window._su`) and `renderSumula` re-rendered; `src/`'s version has no global mutable `window._su`, so one function suffices), `suObj`→`sumulaObj`, `suAdd`/`suAddAnon`→unified into one `addMatchEvent` call with/without `athleteId`, `suDel`→`removeMatchEvent`. `printSumula` — explicitly out of scope, Phase 4b (needs `matchContext`/jsPDF report machinery this phase doesn't touch).

**Placeholder scan** — no TBD/TODO; every step has literal code.

**Type consistency** — `addMatchEvent(obj, {type, teamId, athleteId, name})`/`removeMatchEvent(obj, index)` signatures are used identically in Task 1's tests and Task 2's DOM handlers. `sumulaModal(kind, id)` matches the existing `matchOpsModal(matchId)`/`rosterModal(teamId)` no-`state`-parameter convention (all three close over the page's local `state`).
