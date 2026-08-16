# Migration Phase 3d: Discipline & Suspensions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Disciplina tab (card ranking + suspension warnings) to championship management, and let organizers configure scoring points, tie-break criteria order, disciplinary fair-play penalties, and the yellow-card suspension limit — all currently hardcoded to defaults with no editor anywhere in `src/`.

**Architecture:** Sub-phase 3d of Phase 3, tracked at `docs/superpowers/plans/MIGRATION-PROGRESS.md`. Legacy source: `arena-campeonatos-v2-intervencao-19.html:696` (`suspensionInfo`), `:974-981` (`viewDisciplina`), `:1052-1065` (`criteriaEditor`/`critTail`/`critCommit`/`critMove`/`critRemove`/`critAdd`).

**Rescope vs. the published audit:**
- `optCrit`/`optTurnos` (`:837-838`) are **not** ported — both belong to the legacy creation-wizard screen (`renderFmtOpts`, `setupDraft`-based, same screen already rescoped out of Phase 3a/3c for `drawBracket`/`drawGroups`/etc.). `optTurnos`'s job (a `turnos`/`nGrupos` editor) is already covered in `src/` by Phase 2d's number inputs in `fasesView()` (`src/pages/championship.js`, `[data-phase-turnos]`/`[data-phase-ngrupos]`). `optCrit`'s job (a 3-preset tie-break dropdown) is superseded by this phase's own `criteriaEditor` port — a strictly more capable drag-order editor covering the same `cfg.criterios` field. Porting a second, weaker editor for the same field alongside the real one would just be dead UI.
- `criteriaEditor`/`critTail`'s legacy fallback default is `['P','V','SG','GP','DISC']` (DISC included) when `cfg.criterios` is unset — but every other `src/` read site already defaults to `['P','V','SG','GP']` (no DISC): `src/app/standings.js:46` (`computeStandings`) and `src/pages/championship.js:67` (the Tabela tab's criteria legend). This phase's port uses that same `['P','V','SG','GP']` default everywhere for consistency, rather than introducing a third, divergent fallback for one editor. This only affects the rarely-hit case of `cfg.criterios` being completely absent (real championships get it seeded at creation) — DISC remains fully selectable from the "add criterion" pool either way.

**Pure vs. DOM split**, continuing the established pattern: `src/app/standings.js` gains `suspensionInfo` (reuses the file's existing `allMatchObjs` import) and `critMove`/`critRemove`/`critAdd` (pure array transforms — no `persist`/render side effects, unlike legacy's `critCommit`-wrapped versions). `src/pages/championship.js` gains `disciplineView()` (new "Disciplina" tab, same shape as Phase 3c's `scorersView()`) and extends `config()` with a scoring/tie-break card (`criteriaEditorHTML()` local render helper + new `bind()` handlers).

**Tech Stack:** Same as prior phases — vanilla JS ES modules, Vitest.

## Global Constraints

- Legacy source of truth: `arena-campeonatos-v2-intervencao-19.html:696, 974-981, 1052-1065`.
- Mutating functions return `{ok, reason?, ...}`; pure getters/transforms return plain values — matching every prior phase's contract. `critMove`/`critRemove`/`critAdd` return a new `criterios` array (no mutation, no `{ok}` wrapper) — they're pure transforms like `standsToRows`, not state-mutating operations.
- `npm run build`, `npm run verify`, `npm test` must all succeed after every task.
- No new UI framework — `data-*` + `bind()`.
- **Every new/changed `class="..."` must be checked against `layout.css`/`tokens.css`**, for both the class's own rule and any descendant-selector rule (standing instruction since Phase 2d). This phase introduces **no new classes** — every new element reuses `.card`, `.table-wrap table`, `.team-row` (3 children — index/label/button-group — fits its `34px 1fr auto auto` grid with the 4th column left empty, same as any row that doesn't need it), `.row`, `.muted`, `.btn`/`.btn.primary`/`.btn.ghost`, and the already-precedented `.sm` modifier. The suspended-players warning card uses an inline `style="border-color:var(--accent)"` (an existing token, amber — semantically matches "yellow card"), not a new class, same pattern as Phase 3c's inline qualification-zone highlight.
- Default `cfg.criterios` is `['P', 'V', 'SG', 'GP']` everywhere in this phase's new code (see Rescope above) — matches `src/app/standings.js:46` and `src/pages/championship.js:67`.
- Avoid import cycles: `src/app/standings.js` already imports from `matches.js`/`roster.js`/`phases.js`/`categories.js`/`engine.js` (all one-directional, established in Phase 3c). This phase adds no new imports to `standings.js` — `suspensionInfo` reuses the file's existing `allMatchObjs` import, `critMove`/`critRemove`/`critAdd` need no imports at all.

## File Structure

| File | Responsibility |
|---|---|
| `src/app/standings.js` | Add: `suspensionInfo(state, athleteId)`, `critMove(criterios, i, dir)`, `critRemove(criterios, i)`, `critAdd(criterios, value)` — no DOM |
| `src/app/standings.test.js` | Tests for the above |
| `src/pages/championship.js` | Add "Disciplina" tab (`disciplineView()`); extend `config()` with a scoring/tie-break/discipline card (`criteriaEditorHTML()` + new `bind()` handlers) |

---

### Task 1: `suspensionInfo` — `src/app/standings.js`

**Files:**
- Modify: `src/app/standings.js`
- Modify: `src/app/standings.test.js`

**Interfaces:**
- Consumes: the file's existing `allMatchObjs` import (no new imports).
- Produces: `suspensionInfo(state, athleteId): {y, r, suspended, reason}` — consumed by Task 3's `disciplineView()`.

- [ ] **Step 1: Add the failing tests**

Append to `src/app/standings.test.js`:
```js
describe('suspensionInfo', () => {
  it('flags a red card as an immediate suspension', () => {
    const state = { matches: [{ id: 'm1', events: [{ type: 'red', athleteId: 'ath1' }] }] };
    expect(suspensionInfo(state, 'ath1')).toEqual({ y: 0, r: 1, suspended: true, reason: 'vermelho' });
  });

  it('flags the Nth yellow card as a suspension, using cfg.yellowLimit', () => {
    const state = {
      cfg: { yellowLimit: 2 },
      matches: [
        { id: 'm1', events: [{ type: 'yellow', athleteId: 'ath1' }] },
        { id: 'm2', events: [{ type: 'yellow', athleteId: 'ath1' }] },
      ],
    };
    expect(suspensionInfo(state, 'ath1')).toEqual({ y: 2, r: 0, suspended: true, reason: '2º amarelo' });
  });

  it('defaults yellowLimit to 3 when cfg has none', () => {
    const state = { matches: [{ id: 'm1', events: [{ type: 'yellow', athleteId: 'ath1' }, { type: 'yellow', athleteId: 'ath1' }] }] };
    expect(suspensionInfo(state, 'ath1')).toEqual({ y: 2, r: 0, suspended: false, reason: '' });
  });

  it('ignores events for other athletes and non-card event types', () => {
    const state = { matches: [{ id: 'm1', events: [{ type: 'goal', athleteId: 'ath1' }, { type: 'yellow', athleteId: 'ath2' }] }] };
    expect(suspensionInfo(state, 'ath1')).toEqual({ y: 0, r: 0, suspended: false, reason: '' });
  });
});
```
Add `suspensionInfo` to `src/app/standings.test.js`'s top import line (find the line starting `import { computeStandings, ...} from './standings.js';` and add `suspensionInfo` to the list).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- standings`
Expected: FAIL — `suspensionInfo is not a function`.

- [ ] **Step 3: Implement `suspensionInfo` in `src/app/standings.js`**

Add at the end of the file (adapted from legacy `suspensionInfo`, `:696`, converted from an implicit global `state`/`allMatchObjs()` read to an explicit `state` parameter):
```js
export function suspensionInfo(state, athleteId) {
  const lim = (state.cfg && state.cfg.yellowLimit) || 3;
  let y = 0, r = 0;
  allMatchObjs(state).forEach((m) => (m.events || []).forEach((e) => {
    if (e.athleteId !== athleteId) return;
    if (e.type === 'yellow') y++;
    else if (e.type === 'red') r++;
  }));
  const pending = r > 0 || (lim > 0 && y > 0 && y % lim === 0);
  return { y, r, suspended: pending, reason: r > 0 ? 'vermelho' : (pending ? lim + 'º amarelo' : '') };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- standings`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/standings.js src/app/standings.test.js
git commit -m "feat: add suspensionInfo, computing per-athlete card counts and suspension status"
```

---

### Task 2: `critMove`/`critRemove`/`critAdd` — `src/app/standings.js`

**Files:**
- Modify: `src/app/standings.js`
- Modify: `src/app/standings.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `critMove(criterios, i, dir): string[]`, `critRemove(criterios, i): string[]`, `critAdd(criterios, value): string[]` — each returns a full criteria array (with `'P'` fixed first), consumed by Task 4's `config()` bind handlers.

- [ ] **Step 1: Add the failing tests**

Append to `src/app/standings.test.js`:
```js
describe('critMove/critRemove/critAdd', () => {
  it('critMove swaps two tail entries by index, keeping P fixed first', () => {
    expect(critMove(['P', 'V', 'SG', 'GP'], 0, 1)).toEqual(['P', 'SG', 'V', 'GP']);
  });

  it('critMove is a no-op past either boundary', () => {
    const order = ['P', 'V', 'SG', 'GP'];
    expect(critMove(order, 0, -1)).toEqual(order);
    expect(critMove(order, 2, 1)).toEqual(order);
  });

  it('critRemove drops a tail entry by index', () => {
    expect(critRemove(['P', 'V', 'SG', 'GP'], 1)).toEqual(['P', 'V', 'GP']);
  });

  it('critAdd appends a new criterion once, ignoring duplicates', () => {
    expect(critAdd(['P', 'V'], 'DISC')).toEqual(['P', 'V', 'DISC']);
    expect(critAdd(['P', 'V', 'DISC'], 'DISC')).toEqual(['P', 'V', 'DISC']);
  });

  it('all three treat a missing/empty criterios array as just P', () => {
    expect(critMove(undefined, 0, 1)).toEqual(['P']);
    expect(critAdd([], 'V')).toEqual(['P', 'V']);
  });
});
```
Add `critMove, critRemove, critAdd` to `src/app/standings.test.js`'s top import line.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- standings`
Expected: FAIL — `critMove is not a function`.

- [ ] **Step 3: Implement in `src/app/standings.js`**

Add at the end of the file (adapted from legacy `critTail`/`critMove`/`critRemove`/`critAdd`, `:1061-1065`, with `critCommit`'s `persist()`/`renderManage()` side effects dropped — callers persist/render themselves, same split as every other pure function in this file):
```js
export function critMove(criterios, i, dir) {
  const tail = (criterios || []).filter((c) => c !== 'P');
  const j = i + dir;
  if (j < 0 || j >= tail.length) return ['P', ...tail];
  [tail[i], tail[j]] = [tail[j], tail[i]];
  return ['P', ...tail];
}

export function critRemove(criterios, i) {
  const tail = (criterios || []).filter((c) => c !== 'P');
  tail.splice(i, 1);
  return ['P', ...tail];
}

export function critAdd(criterios, value) {
  const tail = (criterios || []).filter((c) => c !== 'P');
  if (value && !tail.includes(value)) tail.push(value);
  return ['P', ...tail];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- standings`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/standings.js src/app/standings.test.js
git commit -m "feat: add pure critMove/critRemove/critAdd tie-break criteria transforms"
```

---

### Task 3: Disciplina tab — `src/pages/championship.js`

**Files:**
- Modify: `src/pages/championship.js`

**Interfaces:**
- Consumes: `cardRanking` (already imported, Phase 3c), `suspensionInfo` (Task 1) from `../app/standings.js`.

No new automated tests (DOM wiring; Task 1's suite covers the logic). Same "no live browser in this sandbox" fallback as prior phases — verify by inspection, report `DONE_WITH_CONCERNS` if so.

- [ ] **Step 1: Extend the `standings.js` import**

Find:
```js
import { computeStandings, applyProgression, scorerRanking, CRIT_LABEL, genCross } from '../app/standings.js';
```
Replace with:
```js
import { computeStandings, applyProgression, scorerRanking, cardRanking, CRIT_LABEL, genCross, suspensionInfo, critMove, critRemove, critAdd } from '../app/standings.js';
```
(`cardRanking`, `critMove`, `critRemove`, `critAdd` are also needed by Task 4 — importing them together now avoids a second edit to this line.)

- [ ] **Step 2: Add the "Disciplina" tab to the nav and the tab-render switch**

Find:
```js
['equipes','Equipes'],['artilharia','Artilharia'],['inscricoes','Inscrições']
```
Replace with:
```js
['equipes','Equipes'],['artilharia','Artilharia'],['disciplina','Disciplina'],['inscricoes','Inscrições']
```

Find:
```js
tab === 'artilharia' ? scorersView() : tab === 'inscricoes'
```
Replace with:
```js
tab === 'artilharia' ? scorersView() : tab === 'disciplina' ? disciplineView() : tab === 'inscricoes'
```

- [ ] **Step 3: Add `disciplineView()`**

Find:
```js
  function scorersView() {
    const rows = scorerRanking(state);
    if (!rows.length) return `<div class="card"><p class="muted">Nenhum gol registrado ainda.</p></div>`;
    return `<div class="card"><h2>Artilharia</h2><div class="table-wrap"><table><thead><tr><th>#</th><th>Atleta</th><th>Equipe</th><th>Gols</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${r.teamId ? esc(teamNameById(state, r.teamId) || '—') : '—'}</td><td>${r.goals}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
```
Replace with:
```js
  function scorersView() {
    const rows = scorerRanking(state);
    if (!rows.length) return `<div class="card"><p class="muted">Nenhum gol registrado ainda.</p></div>`;
    return `<div class="card"><h2>Artilharia</h2><div class="table-wrap"><table><thead><tr><th>#</th><th>Atleta</th><th>Equipe</th><th>Gols</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${r.teamId ? esc(teamNameById(state, r.teamId) || '—') : '—'}</td><td>${r.goals}</td></tr>`).join('')}</tbody></table></div></div>`;
  }

  function disciplineView() {
    const lim = (state.cfg && state.cfg.yellowLimit) || 3;
    const rows = cardRanking(state);
    const suspended = [];
    (state.teams || []).forEach((team) => (team.roster || []).forEach((athlete) => { const info = suspensionInfo(state, athlete.id); if (info.suspended) suspended.push({ athlete, team, info }); }));
    const suspHTML = suspended.length ? `<div class="card" style="margin-bottom:16px;border-color:var(--accent)"><h2>⛔ Suspensos para o próximo jogo</h2>${suspended.map((x) => `<div class="team-row"><span>⛔</span><span><strong>${esc(x.athlete.nome)}</strong> <span class="muted">— ${esc(x.team.nome)}</span></span><span class="muted">${esc(x.info.reason)}</span></div>`).join('')}</div>` : '';
    const table = rows.length ? `<div class="card"><h2>Cartões</h2><div class="table-wrap"><table><thead><tr><th>#</th><th>Atleta</th><th>Equipe</th><th>🟨</th><th>🟥</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${r.teamId ? esc(teamNameById(state, r.teamId) || '—') : '—'}</td><td>${r.y || ''}</td><td>${r.r || ''}</td></tr>`).join('')}</tbody></table></div></div>` : `<div class="card"><p class="muted">Nenhum cartão registrado.</p></div>`;
    return `<p class="muted" style="margin:0 0 12px;font-size:13px">Regra de suspensão: cartão vermelho ou ${lim} amarelos = 1 jogo de suspensão.</p>${suspHTML}${table}`;
  }
```

- [ ] **Step 4: CSS check**

Every element added in Steps 2–3 reuses `.card`, `.table-wrap table`, `.team-row` (3 children — the ⛔ spacer fills the 34px column, matching every other `.team-row` usage in the file), `.muted`. The suspension-warning card's `border-color:var(--accent)` is an inline style using an existing token, not a new class. No new selectors needed. Confirm by re-reading the markup before moving on.

- [ ] **Step 5: Run the full test suite and build**

Run: `npm test`
Expected: all tests pass.

Run: `npm run build && npm run verify`
Expected: both succeed.

- [ ] **Step 6: Manual smoke check (best-effort, same fallback as prior phases)**

If reachable: open a championship with athletes who have goal/card `events` (none will exist yet — Phase 4's súmula UI is what writes them — so the empty states are the expected result today); open Disciplina and confirm the empty-cards message renders with no suspended-players banner. If not reachable, skip, verify by inspection, report `DONE_WITH_CONCERNS`.

- [ ] **Step 7: Commit**

```bash
git add src/pages/championship.js
git commit -m "feat: add a Disciplina tab showing card rankings and suspension warnings"
```

---

### Task 4: Scoring, tie-break, and discipline config editor — `src/pages/championship.js`

**Files:**
- Modify: `src/pages/championship.js`

**Interfaces:**
- Consumes: `CRIT_LABEL` (already imported), `critMove`/`critRemove`/`critAdd` (Task 3's import line already added them).

No new automated tests (DOM wiring; Task 2's suite covers the logic). Same fallback as Task 3.

- [ ] **Step 1: Add `criteriaEditorHTML()` local render helper**

Find (the end of `disciplineView()`, added in Task 3 — this anchors the insertion right after it):
```js
    return `<p class="muted" style="margin:0 0 12px;font-size:13px">Regra de suspensão: cartão vermelho ou ${lim} amarelos = 1 jogo de suspensão.</p>${suspHTML}${table}`;
  }
```
Replace with:
```js
    return `<p class="muted" style="margin:0 0 12px;font-size:13px">Regra de suspensão: cartão vermelho ou ${lim} amarelos = 1 jogo de suspensão.</p>${suspHTML}${table}`;
  }

  function criteriaEditorHTML(order) {
    const tail = order.filter((c) => c !== 'P');
    const pool = ['V', 'SG', 'GP', 'GC', 'CD', 'DISC'].filter((c) => !order.includes(c));
    const rows = tail.map((c, i) => `<div class="team-row"><span>${i + 2}</span><span>${esc(CRIT_LABEL[c] || c)}</span><span class="row"><button class="btn ghost sm" data-crit-move="${i}:-1" ${i === 0 ? 'disabled' : ''}>↑</button><button class="btn ghost sm" data-crit-move="${i}:1" ${i === tail.length - 1 ? 'disabled' : ''}>↓</button><button class="btn ghost sm" data-crit-remove="${i}">×</button></span></div>`).join('');
    const add = pool.length ? `<div class="row" style="margin-top:10px"><select data-crit-add-select style="flex:1">${pool.map((c) => `<option value="${esc(c)}">${esc(CRIT_LABEL[c] || c)}</option>`).join('')}</select><button class="btn ghost sm" data-crit-add>+ Incluir</button></div>` : '';
    return `<p class="muted" style="font-size:13px">Pontos é fixo em 1º; use ↑ e ↓ para reordenar os demais.</p><div class="team-row"><span>1</span><span>Pontos</span><span class="muted">fixo</span></div>${rows}${add}`;
  }
```

- [ ] **Step 2: Extend `config()` with the scoring/tie-break/discipline card**

Find:
```js
  function config() { state.branding = state.branding || {}; return `<div class="card"><h2>Configurações</h2><label class="muted">Status<select data-status><option value="rascunho">Rascunho</option><option value="inscricoes">Inscrições abertas</option><option value="andamento">Em andamento</option><option value="encerrado">Encerrado</option></select></label><label class="muted">Cor principal<input type="color" data-accent value="${esc(state.branding.accent || '#2fcf6b')}"></label><button class="btn primary" data-save-config>Salvar configurações</button><button class="btn ghost" style="margin-top:8px" data-clear-results>↺ Zerar resultados</button></div><div class="card" style="margin-top:16px"><h2>Locais</h2>
```
Replace with:
```js
  function config() { state.branding = state.branding || {}; const criterios = state.cfg?.criterios || ['P', 'V', 'SG', 'GP']; return `<div class="card"><h2>Configurações</h2><label class="muted">Status<select data-status><option value="rascunho">Rascunho</option><option value="inscricoes">Inscrições abertas</option><option value="andamento">Em andamento</option><option value="encerrado">Encerrado</option></select></label><label class="muted">Cor principal<input type="color" data-accent value="${esc(state.branding.accent || '#2fcf6b')}"></label><button class="btn primary" data-save-config>Salvar configurações</button><button class="btn ghost" style="margin-top:8px" data-clear-results>↺ Zerar resultados</button></div><div class="card" style="margin-top:16px"><h2>Pontuação e desempate</h2><div class="row" style="flex-wrap:wrap"><label class="muted" style="flex:1;min-width:120px">Vitória<input type="number" data-win-pts value="${state.cfg?.winPts ?? 3}"></label><label class="muted" style="flex:1;min-width:120px">Empate<input type="number" data-draw-pts value="${state.cfg?.drawPts ?? 1}"></label><label class="muted" style="flex:1;min-width:120px">Derrota<input type="number" data-loss-pts value="${state.cfg?.lossPts ?? 0}"></label></div><div style="margin-top:14px"><span class="muted">Critérios de desempate (ordem)</span>${criteriaEditorHTML(criterios)}</div>${criterios.includes('DISC') ? `<div class="row" style="flex-wrap:wrap;margin-top:12px"><label class="muted" style="flex:1;min-width:160px">Cartão amarelo<input type="number" min="0" data-disc-yellow value="${state.cfg?.discYellow ?? 1}"></label><label class="muted" style="flex:1;min-width:160px">Cartão vermelho<input type="number" min="0" data-disc-red value="${state.cfg?.discRed ?? 5}"></label></div>` : ''}<label class="muted" style="margin-top:12px">Amarelos para suspensão<input type="number" min="0" data-yellow-limit value="${state.cfg?.yellowLimit || 3}"></label><button class="btn primary" style="margin-top:12px" data-save-scoring>Salvar pontuação e desempate</button></div><div class="card" style="margin-top:16px"><h2>Locais</h2>
```

- [ ] **Step 3: Wire the new handlers in `bind()`**

Find:
```js
const saveConfig = root.querySelector('[data-save-config]'); if (saveConfig) saveConfig.onclick = async () => { state.status = status.value; state.branding.accent = root.querySelector('[data-accent]').value; shell.style.setProperty('--championship-accent', state.branding.accent); await persist(); await addAudit(state.id, 'config_updated', 'Configurações atualizadas'); render(); };
```
Replace with:
```js
const saveConfig = root.querySelector('[data-save-config]'); if (saveConfig) saveConfig.onclick = async () => { state.status = status.value; state.branding.accent = root.querySelector('[data-accent]').value; shell.style.setProperty('--championship-accent', state.branding.accent); await persist(); await addAudit(state.id, 'config_updated', 'Configurações atualizadas'); render(); }; root.querySelectorAll('[data-crit-move]').forEach((button) => button.onclick = async () => { const [i, dir] = button.dataset.critMove.split(':').map(Number); state.cfg = state.cfg || {}; state.cfg.criterios = critMove(state.cfg.criterios || ['P', 'V', 'SG', 'GP'], i, dir); await persist(); render(); }); root.querySelectorAll('[data-crit-remove]').forEach((button) => button.onclick = async () => { state.cfg = state.cfg || {}; state.cfg.criterios = critRemove(state.cfg.criterios || ['P', 'V', 'SG', 'GP'], +button.dataset.critRemove); await persist(); render(); }); const critAddBtn = root.querySelector('[data-crit-add]'); if (critAddBtn) critAddBtn.onclick = async () => { const select = root.querySelector('[data-crit-add-select]'); if (!select || !select.value) return; state.cfg = state.cfg || {}; state.cfg.criterios = critAdd(state.cfg.criterios || ['P', 'V', 'SG', 'GP'], select.value); await persist(); render(); }; const saveScoringBtn = root.querySelector('[data-save-scoring]'); if (saveScoringBtn) saveScoringBtn.onclick = async () => { state.cfg = state.cfg || {}; state.cfg.winPts = +root.querySelector('[data-win-pts]').value || 0; state.cfg.drawPts = +root.querySelector('[data-draw-pts]').value || 0; state.cfg.lossPts = +root.querySelector('[data-loss-pts]').value || 0; const discYellowInput = root.querySelector('[data-disc-yellow]'); if (discYellowInput) state.cfg.discYellow = Math.max(0, +discYellowInput.value || 0); const discRedInput = root.querySelector('[data-disc-red]'); if (discRedInput) state.cfg.discRed = Math.max(0, +discRedInput.value || 0); state.cfg.yellowLimit = Math.max(0, +root.querySelector('[data-yellow-limit]').value || 0); await persist(); await addAudit(state.id, 'scoring_updated', 'Pontuação e desempate atualizados'); render(); };
```

- [ ] **Step 4: CSS check**

Every element added in Steps 1–2 reuses `.card`, `.row`, `.muted`, `.team-row` (3 children, same as Task 3's suspension rows), `.btn`/`.btn.primary`/`.btn.ghost`, and the `.sm` modifier. No new selectors needed. Confirm by re-reading the markup before moving on.

- [ ] **Step 5: Run the full test suite and build**

Run: `npm test`
Expected: all tests pass.

Run: `npm run build && npm run verify`
Expected: both succeed.

- [ ] **Step 6: Manual smoke check (best-effort, same fallback as prior phases)**

If reachable: open Configurações, confirm "Pontuação e desempate" shows the win/draw/loss point fields and the tie-break order list starting with a fixed "Pontos"; use ↑/↓ to reorder a criterion and confirm it persists after a tab switch; add "Disciplina (fair-play)" from the pool select and confirm the yellow/red-card fields appear; remove it again and confirm they disappear; change "Amarelos para suspensão" and save. If not reachable, skip, verify by inspection, report `DONE_WITH_CONCERNS`.

- [ ] **Step 7: Commit**

```bash
git add src/pages/championship.js
git commit -m "feat: add scoring points, tie-break order, and discipline config editor"
```

---

## Self-Review

**Spec coverage** — `suspensionInfo` (Task 1), `viewDisciplina`→`disciplineView` (Task 3), `criteriaEditor`→`criteriaEditorHTML` + `critTail`/`critMove`/`critRemove`/`critAdd`→pure `critMove`/`critRemove`/`critAdd` (Tasks 2 & 4) — all covered. `optCrit`/`optTurnos` — explicitly rescoped with rationale (creation-wizard screen, superseded by existing `src/` editors).

**Placeholder scan** — no TBD/TODO; every step has literal code.

**Type consistency** — `suspensionInfo(state, athleteId)` signature matches `cardRanking(state)`/`scorerRanking(state)`'s existing `state`-first convention. `critMove/critRemove/critAdd(criterios, ...)` all take and return the same shape (full array, `'P'` first) — consistent across Task 2's implementation and Task 4's call sites. `disciplineView()`/`criteriaEditorHTML()` follow the exact no-argument-closure-over-`state` pattern every other page-local render function in `src/pages/championship.js` already uses (e.g. `scorersView()`, `standings()`).
