# Migration Phase 2a: Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an organizer split one championship into multiple categories (e.g. "Sub-15", "Sub-17", "Feminino"), each with its own teams and match schedule, ported from the legacy monolith's category system and wired into the existing `src/pages/championship.js` league engine.

**Architecture:** This is sub-phase 2a of Phase 2 ("Motor de campeonato — dados") in the migration tracked at `docs/superpowers/plans/MIGRATION-PROGRESS.md`. Legacy's category system (`arena-campeonatos-v2-intervencao-19.html:583-606`) nests `category.phases[].{formato,cfg,matches,bracket,...}` because legacy already had multi-format phases when categories were added. `src/` does not have phases/formats yet (that's sub-phase 2d) — building the full nested shape now would be speculative. **Deliberate scope decision:** this phase gives each category a flat `{id, nome, ordem, teams, matches}` — a team+match bucket — reusing `championship.js`'s existing league engine (`teams()`, `games()`, `standings()`, `generate`) unchanged. Phase 2d will layer `phases[]` on top of each category the same way legacy's own `ensurePhases`/`newPhaseFromRoot` auto-migrates flat data into a first phase — so this shape is a real step of the target architecture, not throwaway.

This flat shape isn't a guess: `src/services/championships.js`'s existing `publicState()` (shipped before this plan, untouched by it) already contains `(state.categories || []).forEach((category) => (category.teams || []).forEach((team) => delete team.registration));` — the codebase already expects `category.teams` to exist in exactly this shape.

**Root-mirroring, kept from legacy:** legacy keeps the *active* category's data flattened onto the root state object (`state.teams`, `state.matches`) so the rest of the app (which reads those directly) doesn't need to become category-aware. This plan keeps that pattern — `loadCategoryIntoRoot`/`saveRootIntoActive` — specifically so `championship.js`'s `teams()`, `games()`, `standings()`, and the `generate` handler need **zero changes**: they keep reading/writing `state.teams`/`state.matches` exactly as today; only category switching mirrors data in and out.

**Out of scope, deferred to Phase 6 (Administration):** `categoryTeamLimitReached`/`canAddTeams`/`categorySnapshot` — these enforce billing-plan team limits per category. Building them now would mean either faking plan-limit logic or coupling this phase to billing UI that doesn't exist in `src/` yet. They land together with the rest of the plan-limit UI in Phase 6.

**Framework-pattern deviation from legacy:** legacy's `categoryBar()` renders `onclick="switchCategory('id')"` inline attribute strings, calling global functions. `src/` has no global functions — every existing page (`championship.js`'s `teams()`/`games()`) renders `data-*` attributes and wires clicks via `querySelectorAll(...).onclick =` in a `bind()` step. `categoryBar()` and the new categories tab follow that existing `src/` convention, not legacy's inline-handler string.

**Tech Stack:** Same as Phase 1 — vanilla JS ES modules, Vitest for the pure logic module (`src/app/categories.js` has no DOM, tested the same way `utils.js`/`format.js` were in Phase 1).

## Global Constraints

- Legacy source of truth for the ported logic: `arena-campeonatos-v2-intervencao-19.html:583-606` (`categorySnapshot`, `ensureCategories`, `activeCategory`, `switchCategory`, `categoryBar`, `addCategory`, `renameCategory`, `removeCategory` — `categorySnapshot` itself is out of scope per the deferral above, but its neighbors' control flow is the reference).
- Category ids use `uid()` from `src/app/utils.js` (Phase 1), matching every other id in the app.
- `npm run build`, `npm run verify`, and `npm test` (scoped by `vitest.config.js` to `src/**/*.test.js`) must all succeed after every task.
- No new UI framework — plain vanilla JS, `data-*` attribute + `bind()` wiring, matching `src/pages/championship.js`'s existing convention.
- `removeCategory` keeps legacy's native `confirm()` dialog (`arena-campeonatos-v2-intervencao-19.html:606`) rather than building a custom confirm-modal component — that component isn't itself in this phase's function list, and legacy uses native `confirm()` here too despite having its own modal system, so this isn't a downgrade.

## File Structure

| File | Responsibility |
|---|---|
| `src/app/categories.js` | Pure category data-model functions: `ensureCategories`, `activeCategory`, `loadCategoryIntoRoot`, `saveRootIntoActive`, `switchCategory`, `addCategory`, `renameCategory`, `removeCategory` — no DOM |
| `src/app/categories.test.js` | Tests for the above |
| `src/pages/championship.js` | Modify: call `ensureCategories`/`loadCategoryIntoRoot` on mount, call `saveRootIntoActive` before every persist, add a "Categorias" tab, add the category-switcher bar, wire the new click/change handlers in `bind()` |
| `src/styles/layout.css` | Modify: add `.catbar`/`.catpill`/`.catpill.active` rules |

---

### Task 1: Pure category data-model — `src/app/categories.js`

**Files:**
- Create: `src/app/categories.js`
- Create: `src/app/categories.test.js`

**Interfaces:**
- Consumes: `clone`, `uid` from `./utils.js` (Phase 1).
- Produces: `ensureCategories(state): state`, `activeCategory(state): category`, `loadCategoryIntoRoot(state, category): void`, `saveRootIntoActive(state): void`, `switchCategory(state, id): state`, `addCategory(state): state`, `renameCategory(state, id, name): state`, `removeCategory(state, id): {ok: boolean, reason?: string}` — imported by Task 2.

- [ ] **Step 1: Write the failing tests**

Create `src/app/categories.test.js`:
```js
import { describe, it, expect } from 'vitest';
import {
  ensureCategories, activeCategory, loadCategoryIntoRoot, saveRootIntoActive,
  switchCategory, addCategory, renameCategory, removeCategory,
} from './categories.js';

function championship(overrides = {}) {
  return { teams: [{ id: 't1', nome: 'Equipe A' }], matches: [{ id: 'm1', home: 0, away: 0 }], ...overrides };
}

describe('ensureCategories', () => {
  it('migrates flat teams/matches into a first category when none exist', () => {
    const state = championship();
    ensureCategories(state);
    expect(state.categories).toHaveLength(1);
    expect(state.categories[0].nome).toBe('Categoria principal');
    expect(state.categories[0].teams).toEqual([{ id: 't1', nome: 'Equipe A' }]);
    expect(state.categories[0].matches).toEqual([{ id: 'm1', home: 0, away: 0 }]);
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
  it('loadCategoryIntoRoot copies a deep clone onto state.teams/state.matches', () => {
    const category = { id: 'c1', teams: [{ id: 't1', nome: 'A' }], matches: [{ id: 'm1' }] };
    const state = { teams: [], matches: [] };
    loadCategoryIntoRoot(state, category);
    expect(state.teams).toEqual(category.teams);
    expect(state.teams).not.toBe(category.teams);
  });

  it('saveRootIntoActive writes a deep clone of root back into the active category', () => {
    const state = { categories: [{ id: 'c1', teams: [], matches: [] }], activeCategoryId: 'c1', teams: [{ id: 't1', nome: 'Edited' }], matches: [] };
    saveRootIntoActive(state);
    expect(state.categories[0].teams).toEqual([{ id: 't1', nome: 'Edited' }]);
    expect(state.categories[0].teams).not.toBe(state.teams);
  });
});

describe('switchCategory', () => {
  it('saves the outgoing category, then loads the target category into root', () => {
    const state = {
      categories: [
        { id: 'c1', nome: 'A', teams: [{ id: 't1', nome: 'Original' }], matches: [] },
        { id: 'c2', nome: 'B', teams: [{ id: 't2', nome: 'Team B' }], matches: [] },
      ],
      activeCategoryId: 'c1',
      teams: [{ id: 't1', nome: 'Edited before switch' }],
      matches: [],
    };
    switchCategory(state, 'c2');
    expect(state.activeCategoryId).toBe('c2');
    expect(state.teams).toEqual([{ id: 't2', nome: 'Team B' }]);
    expect(state.categories[0].teams).toEqual([{ id: 't1', nome: 'Edited before switch' }]);
  });

  it('is a no-op when switching to the already-active category', () => {
    const state = { categories: [{ id: 'c1', teams: [{ id: 't1' }], matches: [] }], activeCategoryId: 'c1', teams: [{ id: 'unsaved-edit' }], matches: [] };
    switchCategory(state, 'c1');
    expect(state.teams).toEqual([{ id: 'unsaved-edit' }]);
  });

  it('is a no-op when the target id does not exist', () => {
    const state = { categories: [{ id: 'c1', teams: [], matches: [] }], activeCategoryId: 'c1', teams: [{ id: 'unsaved-edit' }], matches: [] };
    switchCategory(state, 'ghost');
    expect(state.activeCategoryId).toBe('c1');
    expect(state.teams).toEqual([{ id: 'unsaved-edit' }]);
  });
});

describe('addCategory', () => {
  it('appends a new empty category, saving the outgoing one first, and switches to it', () => {
    const state = { categories: [{ id: 'c1', nome: 'A', teams: [], matches: [] }], activeCategoryId: 'c1', teams: [{ id: 'edited' }], matches: [] };
    addCategory(state);
    expect(state.categories).toHaveLength(2);
    expect(state.categories[0].teams).toEqual([{ id: 'edited' }]);
    expect(state.categories[1].nome).toBe('Categoria 2');
    expect(state.categories[1].teams).toEqual([]);
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
    const state = { categories: [{ id: 'c1', nome: 'A', teams: [], matches: [] }], activeCategoryId: 'c1', teams: [], matches: [] };
    const result = removeCategory(state, 'c1');
    expect(result).toEqual({ ok: false, reason: 'O campeonato precisa ter pelo menos uma categoria.' });
    expect(state.categories).toHaveLength(1);
  });

  it('removes a non-active category without disturbing root state', () => {
    const state = { categories: [{ id: 'c1', nome: 'A', teams: [], matches: [] }, { id: 'c2', nome: 'B', teams: [], matches: [] }], activeCategoryId: 'c1', teams: [{ id: 'active-edit' }], matches: [] };
    const result = removeCategory(state, 'c2');
    expect(result).toEqual({ ok: true });
    expect(state.categories.map((c) => c.id)).toEqual(['c1']);
    expect(state.activeCategoryId).toBe('c1');
  });

  it('removing the active category switches root to the new first category', () => {
    const state = { categories: [{ id: 'c1', nome: 'A', teams: [{ id: 'from-a' }], matches: [] }, { id: 'c2', nome: 'B', teams: [{ id: 'from-b' }], matches: [] }], activeCategoryId: 'c2', teams: [{ id: 'unsaved' }], matches: [] };
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
Expected: FAIL — `Cannot find module './categories.js'`.

- [ ] **Step 3: Implement `src/app/categories.js`**

Adapted from legacy `ensureCategories`/`activeCategory`/`loadCategoryIntoRoot`(`loadPhaseIntoRoot`'s matches/teams-only slice)/`saveRootIntoActive`/`switchCategory`/`addCategory`/`renameCategory`/`removeCategory` (`arena-campeonatos-v2-intervencao-19.html:587-606`), simplified to the flat `{teams, matches}` shape per this plan's Architecture section (no `phases[]` yet):

```js
import { clone, uid } from './utils.js';

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
  return state;
}

export function activeCategory(state) {
  return state.categories.find((category) => category.id === state.activeCategoryId) || state.categories[0];
}

export function loadCategoryIntoRoot(state, category) {
  state.teams = clone(category.teams || []);
  state.matches = clone(category.matches || []);
}

export function saveRootIntoActive(state) {
  const category = activeCategory(state);
  if (!category) return;
  category.teams = clone(state.teams || []);
  category.matches = clone(state.matches || []);
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
  const category = {
    id: uid(),
    nome: `Categoria ${state.categories.length + 1}`,
    ordem: state.categories.length + 1,
    teams: [],
    matches: [],
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
Expected: `16 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/app/categories.js src/app/categories.test.js
git commit -m "feat: port category data model (ensureCategories/switchCategory/addCategory/...) from legacy"
```

---

### Task 2: Wire categories into `src/pages/championship.js`

**Files:**
- Modify: `src/pages/championship.js`
- Modify: `src/styles/layout.css`

**Interfaces:**
- Consumes: `ensureCategories`, `activeCategory`, `loadCategoryIntoRoot`, `saveRootIntoActive`, `switchCategory`, `addCategory`, `renameCategory`, `removeCategory` from `../app/categories.js` (Task 1).

This task has no new automated tests — Task 1's suite already covers the logic being wired in; this task is DOM plumbing, verified by the existing build/verify pipeline plus the manual check in Step 6 (same "no live browser in this sandbox" fallback as Phase 1 Task 5 — inspect the wiring by reading the diff instead, report DONE_WITH_CONCERNS if a real browser check isn't possible, the controller will note it).

- [ ] **Step 1: Add the imports**

At the top of `src/pages/championship.js`, add to the existing import block:

```js
import { ensureCategories, activeCategory, loadCategoryIntoRoot, saveRootIntoActive, switchCategory, addCategory, renameCategory, removeCategory } from '../app/categories.js';
```

- [ ] **Step 2: Load categories on mount**

In `mount(root, initial)`, right after the line `let state = clone(initial); let tab = 'overview'; let registrations = []; let auditRows = [];`, add:

```js
ensureCategories(state);
loadCategoryIntoRoot(state, activeCategory(state));
```

- [ ] **Step 3: Save the active category before every persist**

In the `persist()` function, change:
```js
async function persist() { root.querySelector('[data-save]').textContent = 'Salvando...'; state.updated = Date.now(); await saveChampionship(state); root.querySelector('[data-save]').textContent = 'Salvo'; }
```
to:
```js
async function persist() { root.querySelector('[data-save]').textContent = 'Salvando...'; saveRootIntoActive(state); state.updated = Date.now(); await saveChampionship(state); root.querySelector('[data-save]').textContent = 'Salvo'; }
```

- [ ] **Step 4: Add a "Categorias" tab and the category-switcher bar**

In the tabs array inside the shell's `innerHTML` template, change:
```js
${[['overview','Visão geral'],['jogos','Jogos'],['classif','Tabela'],['equipes','Equipes'],['inscricoes','Inscrições'],['publicacao','Publicação'],['historico','Histórico'],['config','Configurações']].map(([key,label]) => `<button data-tab="${key}">${label}</button>`).join('')}
```
to:
```js
${[['overview','Visão geral'],['categorias','Categorias'],['jogos','Jogos'],['classif','Tabela'],['equipes','Equipes'],['inscricoes','Inscrições'],['publicacao','Publicação'],['historico','Histórico'],['config','Configurações']].map(([key,label]) => `<button data-tab="${key}">${label}</button>`).join('')}
```

Immediately before `<nav class="championship-tabs">` in that same template literal, add a placeholder the render step will fill:
```js
<div data-categorybar></div>
```
(So the opening of that section reads `...</div><div data-categorybar></div><nav class="championship-tabs">...`.)

- [ ] **Step 5: Render the category bar and the categories tab**

Add a `categoryBar()` function alongside the other view functions (`overview`, `teams`, `games`, ...):

```js
function categoryBar() {
  if (!state.categories || state.categories.length < 2) return '';
  return `<div class="catbar">${state.categories.map((category) => `<button class="catpill ${category.id === state.activeCategoryId ? 'active' : ''}" data-category="${esc(category.id)}">${esc(category.nome)}</button>`).join('')}</div>`;
}

function categoriesView() {
  return `<div class="card"><div class="actions" style="justify-content:space-between"><div><h2>Categorias</h2><p class="muted">Separe atletas e jogos por categoria (ex.: sub-15, feminino).</p></div><button class="btn primary" data-add-category>+ Adicionar categoria</button></div><div style="margin-top:18px">${state.categories.map((category) => `<div class="team-row"><span>${category.id === state.activeCategoryId ? '●' : ''}</span><input data-category-name="${esc(category.id)}" value="${esc(category.nome)}"><button class="btn ghost" data-remove-category="${esc(category.id)}">Remover</button></div>`).join('')}</div></div>`;
}
```

In `render()`, add the `categoryBar()` fill and the `'categorias'` tab branch. Change:
```js
function render() { root.querySelectorAll('[data-tab]').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab)); content.innerHTML = tab === 'overview' ? overview() : tab === 'jogos' ? games() : tab === 'classif' ? standings() : tab === 'equipes' ? teams() : tab === 'inscricoes' ? registrationsView() : tab === 'publicacao' ? '<div class="card"><h2>Publicação</h2><p class="muted">Copie os links públicos para divulgar o campeonato.</p><button class="btn primary" data-publication>Abrir central de publicação</button></div>' : tab === 'historico' ? auditView() : config(); bind(); }
```
to:
```js
function render() { root.querySelectorAll('[data-tab]').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab)); root.querySelector('[data-categorybar]').innerHTML = categoryBar(); content.innerHTML = tab === 'overview' ? overview() : tab === 'categorias' ? categoriesView() : tab === 'jogos' ? games() : tab === 'classif' ? standings() : tab === 'equipes' ? teams() : tab === 'inscricoes' ? registrationsView() : tab === 'publicacao' ? '<div class="card"><h2>Publicação</h2><p class="muted">Copie os links públicos para divulgar o campeonato.</p><button class="btn primary" data-publication>Abrir central de publicação</button></div>' : tab === 'historico' ? auditView() : config(); bind(); }
```

- [ ] **Step 6: Wire the new handlers in `bind()`**

Inside `bind()`, add (anywhere alongside the other `root.querySelectorAll(...)`/`root.querySelector(...)` wiring — after the `[data-jump]` block reads naturally):

```js
root.querySelectorAll('[data-category]').forEach((button) => button.onclick = () => { switchCategory(state, button.dataset.category); tab = 'overview'; render(); });
const addCategoryBtn = root.querySelector('[data-add-category]'); if (addCategoryBtn) addCategoryBtn.onclick = async () => { addCategory(state); await persist(); await addAudit(state.id, 'category_added', 'Categoria criada'); render(); };
root.querySelectorAll('[data-category-name]').forEach((input) => input.onchange = async () => { renameCategory(state, input.dataset.categoryName, input.value); await persist(); await addAudit(state.id, 'category_renamed', 'Categoria renomeada'); render(); });
root.querySelectorAll('[data-remove-category]').forEach((button) => button.onclick = async () => { if (!confirm('Excluir esta categoria e suas equipes e jogos?')) return; const result = removeCategory(state, button.dataset.removeCategory); if (!result.ok) return toast(result.reason); await persist(); await addAudit(state.id, 'category_removed', 'Categoria excluída'); render(); });
```

- [ ] **Step 7: Add the CSS**

Append to `src/styles/layout.css` (adapted from legacy `arena-campeonatos-v2-intervencao-19.html:206` to this project's token names — `--line`/`--surface-muted`/`--brand`/`--text`/`--muted` in place of legacy's `--line2`/`--panel`/`--grass`/`--txt`):

```css
.catbar { display: flex; gap: 8px; align-items: center; overflow-x: auto; padding: 10px 0 2px; margin-top: 8px; }
.catpill { border: 1px solid var(--line); background: var(--surface-muted); color: var(--muted); padding: 8px 12px; border-radius: 999px; white-space: nowrap; font-weight: 700; font-size: 13px; cursor: pointer; }
.catpill:hover { border-color: var(--brand); color: var(--text); }
.catpill.active { background: var(--brand); border-color: var(--brand); color: white; }
```

- [ ] **Step 8: Run the full test suite and build**

Run: `npm test`
Expected: all tests pass (Phase 1's 23 + Task 1's 16 = 39).

Run: `npm run build && npm run verify`
Expected: both succeed.

- [ ] **Step 9: Manual smoke check (best-effort)**

If a live browser is reachable in this environment: `npm run dev`, open a championship, confirm the "Categorias" tab lists one category named "Categoria principal" pre-populated with any existing teams, adding a category shows a second pill in the bar, switching pills swaps the "Equipes"/"Jogos" content, and removing the last remaining category is refused with a toast.

If no live browser is reachable (as in Phase 1), skip this step, verify by reading the diff instead, and report status DONE_WITH_CONCERNS noting why — the controller will note it in the ledger, same as Phase 1 Task 5.

- [ ] **Step 10: Commit**

```bash
git add src/pages/championship.js src/styles/layout.css
git commit -m "feat: wire categories into championship management (tab, switcher bar, CRUD)"
```

---

## Self-Review

**Spec coverage** — every function in this sub-phase's row of `MIGRATION-PROGRESS.md` (`addCategory`, `removeCategory`, `renameCategory`, `ensureCategories`, `activeCategory`, `switchCategory`, `categoryBar`) has a task above. `categorySnapshot`, `categoryTeamLimitReached`, `canAddTeams` are explicitly deferred to Phase 6 with a stated reason (billing-plan coupling), not silently dropped — `MIGRATION-PROGRESS.md`'s Phase 6 row already lists the billing-plan functions they belong with.

**Placeholder scan** — no TBD/TODO; every step has literal code.

**Type consistency** — `ensureCategories`/`activeCategory`/`loadCategoryIntoRoot`/`saveRootIntoActive`/`switchCategory`/`addCategory`/`renameCategory`/`removeCategory` are used with the same names and signatures across Task 1 and Task 2.
