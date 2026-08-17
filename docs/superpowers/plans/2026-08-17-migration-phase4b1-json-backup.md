# Migration Phase 4b1: JSON Export & Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an organizer download a championship's full state as a `.json` backup file from Configurações, and import that file back in as a brand-new championship from the dashboard — the simplest, dependency-free slice of Phase 4b (Reports & exports), split out first because it needs no new library and no report-layout design work.

**Architecture:** Sub-phase 4b1 of Phase 4b (itself a sub-phase of Phase 4), tracked at `docs/superpowers/plans/MIGRATION-PROGRESS.md`. Legacy source: `arena-campeonatos-v2-intervencao-19.html:1241` (`exportJSON`), `:1242` (`importJSON`). Split from the rest of Phase 4b (the 13 `jspdf-autotable`-based PDF reports, the combined `exportPDF`, `printSumula`, `exportAthleteCards`) because JSON backup has zero dependency on report-table layout or the new `jspdf-autotable` package those need — it's pure JSON serialization plus Firestore's existing `saveChampionship`.

**Rescope vs. the published audit:** none — `exportJSON`/`importJSON` are explicitly Phase 4 scope per `MIGRATION-PROGRESS.md`'s table.

**Pure vs. DOM split**, continuing the established pattern: a new `src/app/exports.js` holds `championshipJSON(state): {filename, content}` (pure — builds the export filename and JSON string) and `parseChampionshipImport(text): {ok, reason?, value?}` (pure — validates and normalizes an imported JSON payload, assigning a fresh id). Both are pure functions with no DOM/Firebase access, matching every other `src/app/*.js` module. The Blob/anchor-click download trigger and the file-picker/`FileReader`/`saveChampionship` orchestration are thin DOM wrappers inline in `src/pages/championship.js` and `src/pages/home.js` respectively — matching the existing inline-DOM-trigger convention already used for `pickLogo`/`eaPhoto` (create an `<input type=file>`, wire `onchange`, `.click()`) rather than adding new files to the untested `src/services/` layer (no `src/services/*.test.js` exists anywhere in this codebase — `src/services/pdf.js`'s `downloadChampionshipPDF` is the established precedent for "DOM/Firebase-triggering export logic stays thin and untested, real logic lives in a tested `src/app/*.js` pure function").

**Tech Stack:** Same as prior phases — vanilla JS ES modules, Vitest. No new dependency.

## Global Constraints

- Legacy source of truth: `arena-campeonatos-v2-intervencao-19.html:1241-1242`.
- Pure functions return plain values (`championshipJSON`) or `{ok, reason?, ...}` (`parseChampionshipImport`) — matching every prior phase's contract.
- `npm run build`, `npm run verify`, `npm test` must all succeed after every task.
- No new UI framework — `data-*` + `bind()`.
- **Every new/changed `class="..."` must be checked against `layout.css`/`tokens.css`**, for both the class's own rule and any descendant-selector rule (standing instruction since Phase 2d). This phase introduces **no new classes** — the JSON button in `config()` reuses `.btn`/`.btn.ghost`/`.sm` (the existing `data-clear-results` button it sits beside already uses this exact combination), and the Home screen's import button reuses `.btn`/`.btn.ghost` (matching `data-tutorial`'s existing button).
- `src/app/exports.js` has no imports — filename/JSON generation and import validation need nothing from any other `src/app/*.js` module. No import-cycle risk.

## File Structure

| File | Responsibility |
|---|---|
| `src/app/exports.js` | Create: `championshipJSON(state)`, `parseChampionshipImport(text)` — no DOM |
| `src/app/exports.test.js` | Tests for the above |
| `src/pages/championship.js` | Add "⬇ JSON" button to `config()`'s share/data row; wire `bind()` to build a Blob and trigger the download |
| `src/pages/home.js` | Add "⬆ Importar .json" button to the header; wire a file-picker + `FileReader` flow that validates, saves, and opens the imported championship |

---

### Task 1: `championshipJSON`/`parseChampionshipImport` — `src/app/exports.js`

**Files:**
- Create: `src/app/exports.js`
- Create: `src/app/exports.test.js`

**Interfaces:**
- Consumes: `uid` from `./utils.js`.
- Produces: `championshipJSON(state): {filename, content}`, `parseChampionshipImport(text): {ok, reason?, value?}` — consumed by Task 2 (`championship.js`) and Task 3 (`home.js`).

- [ ] **Step 1: Write the failing tests**

Create `src/app/exports.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { championshipJSON, parseChampionshipImport } from './exports.js';

describe('championshipJSON', () => {
  it('builds a slugified filename from the championship name and pretty-printed JSON content', () => {
    const state = { nome: 'Copa do Bairro 2026!', formato: 'liga', teams: [{ id: 't1', nome: 'Alfa' }] };
    const result = championshipJSON(state);
    expect(result.filename).toBe('Copa_do_Bairro_2026_.json');
    expect(JSON.parse(result.content)).toEqual(state);
    expect(result.content).toContain('\n');
  });

  it('falls back to "campeonato" when nome is missing', () => {
    const result = championshipJSON({ formato: 'liga' });
    expect(result.filename).toBe('campeonato.json');
  });
});

describe('parseChampionshipImport', () => {
  it('accepts a valid export, assigning a fresh id and defaulting seedNames', () => {
    const original = { id: 'old-id', nome: 'Copa', formato: 'liga', cfg: { winPts: 3 }, teams: [] };
    const result = parseChampionshipImport(JSON.stringify(original));
    expect(result.ok).toBe(true);
    expect(result.value.id).toBeTruthy();
    expect(result.value.id).not.toBe('old-id');
    expect(result.value.nome).toBe('Copa');
    expect(result.value.cfg.seedNames).toEqual([]);
  });

  it('preserves an existing cfg.seedNames instead of overwriting it', () => {
    const original = { formato: 'mata', cfg: { seedNames: ['Brasil'] } };
    const result = parseChampionshipImport(JSON.stringify(original));
    expect(result.value.cfg.seedNames).toEqual(['Brasil']);
  });

  it('rejects malformed JSON', () => {
    expect(parseChampionshipImport('{not json')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects valid JSON missing cfg or formato', () => {
    expect(parseChampionshipImport(JSON.stringify({ nome: 'Copa' }))).toEqual({ ok: false, reason: 'invalid' });
    expect(parseChampionshipImport(JSON.stringify({ cfg: {} }))).toEqual({ ok: false, reason: 'invalid' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- exports`
Expected: FAIL — `Cannot find module './exports.js'`.

- [ ] **Step 3: Implement `src/app/exports.js`**

Adapted from legacy `exportJSON`/`importJSON` (`:1241-1242`), with the Blob/file-picker DOM parts stripped out — this file only builds the filename/content string and validates/normalizes the parsed object:
```js
import { uid } from './utils.js';

export function championshipJSON(state) {
  const filename = `${(state.nome || 'campeonato').replace(/[^\w-]+/g, '_')}.json`;
  return { filename, content: JSON.stringify(state, null, 2) };
}

export function parseChampionshipImport(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (!value || !value.cfg || !value.formato) return { ok: false, reason: 'invalid' };
  value.id = uid();
  value.cfg.seedNames = value.cfg.seedNames || [];
  return { ok: true, value };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- exports`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/exports.js src/app/exports.test.js
git commit -m "feat: add championshipJSON/parseChampionshipImport for JSON backup export and import"
```

---

### Task 2: "⬇ JSON" export button — `src/pages/championship.js`

**Files:**
- Modify: `src/pages/championship.js`

**Interfaces:**
- Consumes: `championshipJSON` (Task 1) from `../app/exports.js`.

No new automated tests (DOM wiring; Task 1's suite covers the logic). Same "no live browser in this sandbox" fallback as prior phases — verify by inspection, report `DONE_WITH_CONCERNS` if so.

- [ ] **Step 1: Add the import**

Find:
```js
import { computeStandings, applyProgression, scorerRanking, cardRanking, CRIT_LABEL, genCross, suspensionInfo, critMove, critRemove, critAdd } from '../app/standings.js';
```
Replace with:
```js
import { computeStandings, applyProgression, scorerRanking, cardRanking, CRIT_LABEL, genCross, suspensionInfo, critMove, critRemove, critAdd } from '../app/standings.js';
import { championshipJSON } from '../app/exports.js';
```

- [ ] **Step 2: Add the button to `config()`'s share/data card**

Find:
```js
<button class="btn ghost" style="margin-top:8px" data-clear-results>↺ Zerar resultados</button></div>
```
Replace with:
```js
<button class="btn ghost" style="margin-top:8px" data-clear-results>↺ Zerar resultados</button><button class="btn ghost" style="margin-top:8px" data-export-json>⬇ Baixar backup (.json)</button></div>
```

- [ ] **Step 3: Wire the handler in `bind()`**

Find:
```js
const clearBtn = root.querySelector('[data-clear-results]'); if (clearBtn) clearBtn.onclick = async () => { if (!confirm('Zerar todos os placares e o chaveamento desta fase?')) return; clearResults(state); await persist(); await addAudit(state.id, 'results_cleared', 'Resultados zerados'); render(); };
```
Replace with:
```js
const clearBtn = root.querySelector('[data-clear-results]'); if (clearBtn) clearBtn.onclick = async () => { if (!confirm('Zerar todos os placares e o chaveamento desta fase?')) return; clearResults(state); await persist(); await addAudit(state.id, 'results_cleared', 'Resultados zerados'); render(); }; const exportJsonBtn = root.querySelector('[data-export-json]'); if (exportJsonBtn) exportJsonBtn.onclick = () => { const { filename, content } = championshipJSON(state); const blob = new Blob([content], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href); toast('Backup exportado'); };
```

- [ ] **Step 4: CSS check**

The new button reuses `.btn`/`.btn.ghost` exactly like the `data-clear-results` button beside it. No new selectors. Confirm by re-reading the markup before moving on.

- [ ] **Step 5: Run the full test suite and build**

Run: `npm test`
Expected: all tests pass.

Run: `npm run build && npm run verify`
Expected: both succeed.

- [ ] **Step 6: Manual smoke check (best-effort, same fallback as prior phases)**

If reachable: open Configurações, click "Baixar backup (.json)", confirm a `.json` file downloads named after the championship and contains the full state when opened. If not reachable, skip, verify by inspection, report `DONE_WITH_CONCERNS`.

- [ ] **Step 7: Commit**

```bash
git add src/pages/championship.js
git commit -m "feat: add a JSON backup download button to Configurações"
```

---

### Task 3: "⬆ Importar .json" button — `src/pages/home.js`

**Files:**
- Modify: `src/pages/home.js`

**Interfaces:**
- Consumes: `parseChampionshipImport` (Task 1) from `../app/exports.js`; `saveChampionship` from `../services/championships.js` (already used by `championship.js`, not yet imported here).

No new automated tests (DOM wiring; Task 1's suite covers the logic). Same fallback as Task 2.

- [ ] **Step 1: Add the imports**

Find:
```js
import { navigate } from '../app/router.js';
import { listMine, removeChampionship } from '../services/championships.js';
import { logout } from '../services/firebase.js';
```
Replace with:
```js
import { navigate } from '../app/router.js';
import { listMine, removeChampionship, saveChampionship } from '../services/championships.js';
import { logout } from '../services/firebase.js';
import { parseChampionshipImport } from '../app/exports.js';
import { toast } from '../app/ui.js';
```

- [ ] **Step 2: Add the import button to the header actions**

Find:
```js
root.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/" data-link>ARENA</a><div class="actions"><button class="btn ghost" data-tutorial>Tutorial</button><button class="btn ghost" data-logout>Sair</button></div></header><main class="section"><div class="actions" style="justify-content:space-between"><div><small>PAINEL DO ORGANIZADOR</small><h1>Meus campeonatos</h1></div><button class="btn primary" data-new>+ Criar campeonato</button></div><div data-list class="grid" style="margin-top:24px"><div class="card">Carregando campeonatos...</div></div></main></div>`;
```
Replace with:
```js
root.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/" data-link>ARENA</a><div class="actions"><button class="btn ghost" data-import-json>⬆ Importar .json</button><button class="btn ghost" data-tutorial>Tutorial</button><button class="btn ghost" data-logout>Sair</button></div></header><main class="section"><div class="actions" style="justify-content:space-between"><div><small>PAINEL DO ORGANIZADOR</small><h1>Meus campeonatos</h1></div><button class="btn primary" data-new>+ Criar campeonato</button></div><div data-list class="grid" style="margin-top:24px"><div class="card">Carregando campeonatos...</div></div></main></div>`;
```

- [ ] **Step 3: Wire the handler**

Find:
```js
  root.querySelector('[data-new]').onclick = () => navigate('/campeonatos/novo');
```
Replace with:
```js
  root.querySelector('[data-new]').onclick = () => navigate('/campeonatos/novo');
  root.querySelector('[data-import-json]').onclick = () => { const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json'; input.onchange = () => { const file = input.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = async () => { const result = parseChampionshipImport(String(reader.result)); if (!result.ok) return toast('Arquivo inválido'); await saveChampionship(result.value); toast('Importado para sua conta'); navigate(`/campeonatos/${result.value.id}`); }; reader.readAsText(file); }; input.click(); };
```

- [ ] **Step 4: CSS check**

The new button reuses `.btn`/`.btn.ghost`, matching `data-tutorial`/`data-logout` right beside it. No new selectors.

- [ ] **Step 5: Run the full test suite and build**

Run: `npm test`
Expected: all tests pass.

Run: `npm run build && npm run verify`
Expected: both succeed.

- [ ] **Step 6: Manual smoke check (best-effort, same fallback as prior phases)**

If reachable: export a championship's JSON backup (Task 2), then from the dashboard click "Importar .json" and select that file — confirm it navigates to a new championship with the same name/teams/phases, distinct from the original (new id). Try importing a non-JSON or unrelated JSON file and confirm the "Arquivo inválido" toast appears instead of a crash. If not reachable, skip, verify by inspection, report `DONE_WITH_CONCERNS`.

- [ ] **Step 7: Commit**

```bash
git add src/pages/home.js
git commit -m "feat: add JSON backup import to the dashboard, creating a new championship"
```

---

## Self-Review

**Spec coverage** — `exportJSON`→`championshipJSON` + inline download trigger, `importJSON`→`parseChampionshipImport` + inline file-picker/save flow — both covered, with the pure validation/serialization logic isolated and tested per this migration's established pure/DOM split.

**Placeholder scan** — no TBD/TODO; every step has literal code.

**Type consistency** — `championshipJSON(state): {filename, content}` and `parseChampionshipImport(text): {ok, reason?, value?}` signatures are used identically in Task 1's tests and Tasks 2/3's DOM call sites. `saveChampionship`'s existing signature (`value` with `.id` set) is reused unchanged — `parseChampionshipImport` assigns `value.id = uid()` before Task 3 calls it, matching what `saveChampionship` requires (verified against `src/services/championships.js:47-52`, which keys the Firestore write on `value.id`).
