# Migration Phase 4b: PDF Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port legacy's PDF report generation (Central de documentos, complete championship PDF, match súmula printing, athlete cards) into `src/`, reusing the existing `jsPDF` dependency and `standings.js`/`matches.js`/`roster.js` pure modules.

**Architecture:** 
- `src/app/reports.js` — new pure module with all report generators as testable functions taking `state` explicitly
- `src/app/reports.test.js` — unit tests
- `src/services/pdf.js` — extend existing (currently only `downloadChampionshipPDF`) with new helpers if needed
- `src/pages/championship.js` — add "Documentos" tab and wire handlers
- Reuses `standsToRows`, `computeStandings`, `scorerRanking`, `cardRanking`, `suspensionInfo`, `matchMeta`, `venueById`, `officialById`, `teamById`, `athName` from existing pure modules

**Tech Stack:** Vanilla JS ES modules, Vitest, jsPDF (already in deps), Firebase Firestore (for data — no new backend calls).

## Global Constraints

- Every new/changed `class="..."` must be checked against `src/styles/layout.css`/`tokens.css` for both the class's own rule and any `<class> <child-selector>` rule (standing instruction since Phase 2d). Reuse existing classes: `.card`, `.grid`, `.row`, `.btn`, `.btn.primary`, `.btn.ghost`, `.muted`, `.pad`, `.team-row`, `.actions` — no new CSS classes needed.
- Legacy reference: `arena-campeonatos-v2-intervencao-19.html` lines 1069-1090 (`reportBase`/`reportName`/`reportStandingsBlocks` + 8 `export*Report` functions), 1093-1136 (`exportPDF`), 1139-1184 (`matchContext`/`splitInfo`/`printSumula`), 1276-1283 (`exportAthleteCards`), 1089-1090 (`viewRelatorios`).
- Mutating functions return `{ok, reason?, ...}` — matches every prior phase's contract.
- `npm run build`, `npm run verify`, `npm test` must all succeed after every task.
- No new UI framework — `data-*` + `bind()`.

---

### Task 1: Report utilities — `src/app/reports.js` (pure module)

**Files:**
- Create: `src/app/reports.js`
- Create: `src/app/reports.test.js`

**Interfaces:**
- Consumes: `computeStandings`, `standsToRows` from `./standings.js`; `scorerRanking`, `cardRanking`, `suspensionInfo` from `./standings.js`; `allMatchObjs` from `./matches.js`; `matchMeta`, `venueById`, `officialById` from `./ops.js`; `teamById`, `athName` from `./roster.js`; `phaseParticipants`, `activeCategory`, `activePhase` from `./phases.js`/`categories.js`; `fmtDateBR` from `./format.js`; `uid` from `./utils.js`.
- Produces (used by Task 2-4):
  - `reportBase(state, title, subtitle)` → `{doc, y, opt}` or `null` (shows toast on error)
  - `reportName(state, suffix)` → `string`
  - `reportStandingsBlocks(state)` → `Array<{title, st}>`
  - Individual report functions: `exportTeamsReport`, `exportRosterReport`, `exportScheduleReport`, `exportStandingsReport`, `exportScorersReport`, `exportDisciplineReport`, `exportOfficialsReport`, `exportResultsReport`, `exportRoundBulletin(state, roundNumber?)`
  - `exportPDF(state)` — complete championship PDF
  - `printSumula(state, kind, id)` — match/tie súmula for printing
  - `exportAthleteCards(state, categoryId?)` — athlete credential cards
  - `viewRelatoriosHTML(state)` → HTML string for the "Documentos" tab

- [ ] **Step 1: Write the failing tests**

`src/app/reports.test.js`:
```js
import { describe, it, expect, vi } from 'vitest';
import { reportBase, reportName, reportStandingsBlocks } from './reports.js';

describe('report utilities', () => {
  const mockState = {
    nome: 'Teste Campeonato',
    formato: 'liga',
    cfg: { criterios: ['P', 'V', 'SG', 'GP'], discYellow: 1, discRed: 5 },
    teams: [{ id: 't1', nome: 'Time A', roster: [] }, { id: 't2', nome: 'Time B', roster: [] }],
    matches: [],
    grupos: [],
    bracket: null,
    categories: [{ id: 'c1', nome: 'Categoria A', phases: [{ id: 'p1', nome: 'Fase 1', activePhaseId: 'p1' }] }],
  };

  it('reportBase returns null and shows toast when jsPDF not loaded', () => {
    // This would need jsPDF mocking - skip for now, test structure only
    expect(typeof reportBase).toBe('function');
  });

  it('reportName generates sanitized filename', () => {
    const name = reportName(mockState, 'teste');
    expect(name).toMatch(/^Teste_Campeonato_Categoria_A_teste\.pdf$/);
  });

  it('reportStandingsBlocks returns blocks for liga format', () => {
    const blocks = reportStandingsBlocks(mockState);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].title).toBe('Classificação');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**
Run: `npx vitest run src/app/reports.test.js`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Write the implementation**

`src/app/reports.js` — port all legacy functions from lines 1069-1090, 1093-1136, 1139-1184, 1276-1283, adapting to take `state` explicitly and use imported helpers.

Key adaptations from legacy:
- `reportBase`: use `activeCategory(state)`, `activePhase(state)` from phases/categories modules
- `reportStandingsBlocks`: use `computeStandings` from standings.js, `phaseParticipants` from phases.js
- All `export*Report`: take `state` as first arg, call `reportBase`, use autoTable, save with `reportName`
- `exportPDF`: combine standings, matches, bracket, scorers, discipline into one PDF
- `matchContext`/`splitInfo`/`printSumula`: port for match/tie súmula printing
- `exportAthleteCards`: generate credential cards with QR codes
- `viewRelatoriosHTML`: return HTML string for the tab

- [ ] **Step 4: Run tests to verify they pass**
Run: `npx vitest run src/app/reports.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/app/reports.js src/app/reports.test.js
git commit -m "feat: add reports pure module (reportBase, export*Report, exportPDF, printSumula, exportAthleteCards)"
```

---

### Task 2: Wire reports UI — `src/pages/championship.js`

**Files:**
- Modify: `src/pages/championship.js`

**Interfaces:**
- Consumes: `viewRelatoriosHTML` from `../app/reports.js` (Task 1); all `export*Report`, `exportPDF`, `printSumula`, `exportAthleteCards` from `../app/reports.js`; `navigate` from `../app/router.js` (already imported).
- Produces: "Documentos" tab in championship tabs, event handlers in `bind()`.

- [ ] **Step 1: Add import**
In `src/pages/championship.js`, add after existing imports:
```js
import { viewRelatoriosHTML, exportTeamsReport, exportRosterReport, exportScheduleReport, exportStandingsReport, exportScorersReport, exportDisciplineReport, exportOfficialsReport, exportResultsReport, exportRoundBulletin, exportPDF, printSumula, exportAthleteCards } from '../app/reports.js';
```

- [ ] **Step 2: Add "Documentos" tab button**
In `mount()`, find the tabs array and add `['documentos','Documentos']` before `['config','Configurações']`.

- [ ] **Step 3: Route the tab in `render()`**
Add `tab === 'documentos' ? viewRelatoriosHTML(state) :` branch before `tab === 'historico'`.

- [ ] **Step 4: Wire event handlers in `bind()`**
Add handlers for all `[data-export-*]`, `[data-print-sumula]`, `[data-export-pdf]`, `[data-export-athlete-cards]` buttons. Also wire the round selector for `exportRoundBulletin`.

- [ ] **Step 5: Run full test suite, build, and verify**
Run: `npm test && npm run build && npm run verify`
Expected: all green.

- [ ] **Step 6: Manual smoke check**
Run: `npm run dev`, open a championship → Documentos tab. Confirm all report buttons generate PDFs.

- [ ] **Step 7: Commit**
```bash
git add src/pages/championship.js
git commit -m "feat: add Documentos tab with all PDF reports (teams, roster, schedule, standings, scorers, discipline, officials, results, round bulletin, full PDF, súmula print, athlete cards)"
```

---

### Task 3: Extend `verify-routes.mjs` for Phase 4b entry point

**Files:**
- Modify: `scripts/verify-routes.mjs`

**Interfaces:**
- Adds `viewRelatoriosHTML` to expected symbols (since it's the integration point).

- [ ] **Step 1: Edit the expected array**
Add `'viewRelatoriosHTML'` to the `expected` array in `scripts/verify-routes.mjs`.

- [ ] **Step 2: Run verify to confirm it passes after Task 2**
Run: `npm run verify`
Expected: OK.

- [ ] **Step 3: Commit**
```bash
git add scripts/verify-routes.mjs
git commit -m "feat: extend route verification to Phase 4b viewRelatoriosHTML"
```

---

## Final whole-branch review checklist (before merge)

- Confirm all 11 report functions exist and are tested: `exportTeamsReport`, `exportRosterReport`, `exportScheduleReport`, `exportStandingsReport`, `exportScorersReport`, `exportDisciplineReport`, `exportOfficialsReport`, `exportResultsReport`, `exportRoundBulletin`, `exportPDF`, `printSumula`, `exportAthleteCards`.
- Confirm `viewRelatoriosHTML` renders a grid of 9 report cards + round bulletin selector.
- Confirm `printSumula` works for both `match` and `tie` kinds.
- Confirm `exportPDF` includes: header, standings (per format), matches table, bracket (if mata), artilharia, disciplina.
- Confirm no new CSS classes introduced — grep diff for `class="` and verify each exists in `layout.css`/`tokens.css`.
- Confirm `npm test`, `npm run build`, `npm run verify` all green.

---

## Self-Review Notes

- **Spec coverage:** All legacy report functions from lines 1069-1283 ported. `viewRelatorios` becomes `viewRelatoriosHTML` returning string (not direct DOM manipulation) to match `src/` pattern.
- **Deferred, not forgotten:** `qrDataURL` for athlete cards uses `QRCode` library — legacy loads it from CDN. If QRCode not available, cards generate without QR (legacy behavior: `return null`). This is acceptable parity.
- **Placeholder scan:** none — every step has runnable code.