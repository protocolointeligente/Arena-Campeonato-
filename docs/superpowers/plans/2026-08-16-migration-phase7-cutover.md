# Phase 7 — Build Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire `arena-campeonatos-v2-intervencao-19.html` (the legacy monolith currently shipped to production) and make the `src/` Vite app the real production build — safely, with a hard gate that refuses to flip until Phases 4/5/6 are actually done.

**Architecture:** Today `npm run build` runs `vite build` (which produces a real `dist/index.html` from the `src/` app) and then `scripts/prepare-legacy.mjs` **overwrites** that `dist/index.html` with the legacy monolith file's markup. Production currently serves the monolith, not `src/`, regardless of how much of `src/` is finished. Cutover = stop the overwrite and delete the monolith path. Because this plan may run before Phases 4–6 land on `main` (they're in progress in parallel), the actual destructive task (Task 4) is gated behind an automated parity check (Task 1) that reads `MIGRATION-PROGRESS.md` and refuses to proceed if any phase row isn't `✅ Done`.

**Tech Stack:** Node.js (`node:fs/promises`), Vite 7, Vitest, Firebase Hosting (`firebase.json`, `public: dist`), Vercel preview URLs (`vercel.json` rewrites).

## Global Constraints

- Do not remove `scripts/prepare-legacy.mjs` or delete `arena-campeonatos-v2-intervencao-19.html` (Task 4) until `node scripts/cutover-check.mjs` (Task 1) exits 0. If it doesn't, stop — that means Phase 4, 5, or 6 isn't merged to `main` yet.
- No new dependencies. No canary automation framework — this is a single-hosting-target app; a documented manual runbook (Task 3) covers it.
- Every step must leave `npm test`, `npm run build`, and `npm run verify` green before commit.

---

### Task 1: Phase-status gate script (`cutover-check.mjs`)

**Files:**
- Create: `scripts/cutover-check.mjs`
- Test: `scripts/cutover-check.test.mjs`

**Interfaces:**
- Produces: a script runnable as `node scripts/cutover-check.mjs` that exits 0 silently if phases 1–6 are all `✅ Done` in `docs/superpowers/plans/MIGRATION-PROGRESS.md`'s `## Phase status` table, or exits 1 and prints the incomplete phase numbers/names otherwise. Phase 7 itself is excluded from the check (this plan is what marks it done).
- Consumes: nothing from other tasks.

- [ ] **Step 1: Write the failing test**

```js
// scripts/cutover-check.test.mjs
import { test, expect } from 'vitest';
import { checkPhaseStatus } from './cutover-check.mjs';

test('passes when phases 1-6 are all Done', () => {
  const table = `
| # | Phase | Scope | Status | Plan | Merge commit |
|---|---|---|---|---|---|
| 1 | Shared foundations | x | ✅ Done | a | b |
| 2a | Categories | x | ✅ Done | a | b |
| 6 | Administration | x | ✅ Done | a | b |
| 7 | Build cutover | x | Not started | — | — |
`;
  expect(() => checkPhaseStatus(table)).not.toThrow();
});

test('throws listing incomplete phases', () => {
  const table = `
| # | Phase | Scope | Status | Plan | Merge commit |
|---|---|---|---|---|---|
| 1 | Shared foundations | x | ✅ Done | a | b |
| 4 | Reports & exports | x | Not started | — | — |
| 5 | Public portal & registration | x | Not started | — | — |
| 6 | Administration | x | Not started | — | — |
| 7 | Build cutover | x | Not started | — | — |
`;
  expect(() => checkPhaseStatus(table)).toThrow(/4 \(Reports & exports\), 5 \(Public portal & registration\), 6 \(Administration\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/cutover-check.test.mjs`
Expected: FAIL with "Failed to resolve import" or "checkPhaseStatus is not a function" (module doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/cutover-check.mjs
import { readFile } from 'node:fs/promises';

const PROGRESS_PATH = 'docs/superpowers/plans/MIGRATION-PROGRESS.md';

export function checkPhaseStatus(tableMarkdown) {
  const rows = tableMarkdown
    .split('\n')
    .filter((line) => line.startsWith('|') && !line.includes('---') && !line.includes('| # |'));

  const incomplete = [];
  for (const row of rows) {
    const cells = row.split('|').map((c) => c.trim());
    // cells[0] is '' (leading pipe), cells[1] = #, cells[2] = Phase, cells[4] = Status
    const num = cells[1];
    const name = cells[2];
    const status = cells[4];
    if (num === '7') continue; // this plan is what marks 7 done
    if (!status || !status.startsWith('✅')) {
      incomplete.push(`${num} (${name})`);
    }
  }

  if (incomplete.length > 0) {
    throw new Error(`Cutover blocked — incomplete phases: ${incomplete.join(', ')}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const full = await readFile(PROGRESS_PATH, 'utf8');
  const tableStart = full.indexOf('## Phase status');
  const tableSection = full.slice(tableStart, full.indexOf('\n## ', tableStart + 1));
  try {
    checkPhaseStatus(tableSection);
    console.log('OK: phases 1-6 all done, cutover is safe to run');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/cutover-check.test.mjs`
Expected: PASS (2 tests)

- [ ] **Step 5: Run against the real progress file to confirm current state**

Run: `node scripts/cutover-check.mjs`
Expected today: exits 1, prints `Cutover blocked — incomplete phases: 4 (Reports & exports), 5 (Public portal & registration), 6 (Administration)` (or whichever are still incomplete at run time) — this is the correct, expected result until Phases 4–6 merge to `main`.

- [ ] **Step 6: Commit**

```bash
git add scripts/cutover-check.mjs scripts/cutover-check.test.mjs
git commit -m "feat: add phase-status gate script for build cutover"
```

---

### Task 2: Expand `verify-routes.mjs` for Phase 4/5/6 surfaces

**Files:**
- Modify: `scripts/verify-routes.mjs`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `npm run verify` now also fails loudly if Phase 4 (reports/PDF), Phase 5 (public portal/registration), or Phase 6 (admin/superadmin/plans) entry points are missing from `src/app/main.js` — turns "did we actually wire this in main.js" into a build-time check instead of a manual read of the progress doc.

- [ ] **Step 1: Read current file to confirm exact content**

Current `scripts/verify-routes.mjs` (already read, reproduced for reference):

```js
import { readFile } from 'node:fs/promises';
const source = await readFile('src/app/main.js', 'utf8');
const expected = ['/demo', '/planos', '/superadmin', 'renderChampionship', 'renderPublicChampionship', 'renderRegistration', 'renderPublication'];
for (const route of expected) if (!source.includes(route)) throw new Error(`Rota ausente: ${route}`);
console.log(`OK: ${expected.length} grupos de rotas encontrados`);
```

- [ ] **Step 2: Add the new expected symbols**

Edit `scripts/verify-routes.mjs`'s `expected` array to append the symbols each of Phases 4/5/6 are scoped to introduce (per `MIGRATION-PROGRESS.md`'s phase table): `exportPDF` (Phase 4), `publicHome` (Phase 5), `renderSuperadmin` (Phase 6). These are the top-level entry points each phase's own plan names as its integration point into `main.js`; adjust to the actual exported/called name if a phase's implementation ends up naming it differently — check that phase's own plan doc under `docs/superpowers/plans/` before assuming this list is stale.

```js
import { readFile } from 'node:fs/promises';
const source = await readFile('src/app/main.js', 'utf8');
const expected = [
  '/demo', '/planos', '/superadmin',
  'renderChampionship', 'renderPublicChampionship', 'renderRegistration', 'renderPublication',
  'exportPDF', 'publicHome', 'renderSuperadmin',
];
for (const route of expected) if (!source.includes(route)) throw new Error(`Rota ausente: ${route}`);
console.log(`OK: ${expected.length} grupos de rotas encontrados`);
```

- [ ] **Step 3: Run it against current `main.js` to confirm it fails today (expected)**

Run: `npm run verify`
Expected today: `Error: Rota ausente: exportPDF` (or whichever symbol isn't wired yet) — correct, since Phase 4 isn't merged. This is the same kind of expected-red-until-dependencies-land result as Task 1.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-routes.mjs
git commit -m "feat: extend route verification to Phase 4/5/6 entry points"
```

---

### Task 3: Cutover runbook

**Files:**
- Create: `docs/superpowers/plans/PHASE7-CUTOVER-RUNBOOK.md`

**Interfaces:**
- Consumes: `scripts/cutover-check.mjs` (Task 1), `scripts/verify-routes.mjs` (Task 2).
- Produces: nothing consumed by later tasks — this is the human-facing runbook for whoever executes Task 4.

- [ ] **Step 1: Write the runbook**

```markdown
# Phase 7 Cutover Runbook

Manual steps to flip production from the legacy monolith to the `src/` Vite app.
Do not start until `node scripts/cutover-check.mjs` exits 0.

## Pre-flight

1. `git checkout main && git pull`
2. `node scripts/cutover-check.mjs` — must print `OK: phases 1-6 all done, cutover is safe to run`. If it doesn't, stop; the printed phase list is what's still missing.
3. `npm test` — must be green.
4. `npm run verify` — must be green (confirms Phase 4/5/6 entry points are wired into `main.js`).

## Canary build (no code changes yet)

5. `npx vite build` (skip `prepare-legacy.mjs` — run vite directly, not `npm run build`) to produce a `dist/` that is the real `src/` app, unmodified by the legacy overwrite.
6. `npx vite preview` and manually click through: home, a championship's Chaveamento/Tabela/Súmula/Disciplina tabs, PDF export, public portal link, registration flow, superadmin panel. Use the `run` skill if driving a real browser is useful.
7. Deploy this `dist/` to a Vercel preview URL (push a branch — Vercel's default preview-per-branch already does this, no extra config needed) and repeat the same manual pass against the preview URL, not just localhost.

## Cutover (Task 4 of the phase 7 plan)

8. Only after 1–7 all pass: execute Task 4 (removes `prepare-legacy.mjs` from the build script, deletes the legacy HTML file).
9. `npm run build && npm run verify` on the result — confirms the *production* build script (not just `vite build` directly) now emits the `src/` app.
10. Deploy to production (`firebase deploy --only hosting`, per `firebase.json`).
11. Smoke-test the production URL with the same manual pass as step 6.

## Rollback

If anything is wrong post-deploy: `git revert <cutover commit>`, `npm run build`, `firebase deploy --only hosting` again — this restores `prepare-legacy.mjs` and the legacy file, putting the monolith back in front of users. Keep the reverted commit's SHA noted in `MIGRATION-PROGRESS.md` if this happens, so the next cutover attempt knows what broke.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/PHASE7-CUTOVER-RUNBOOK.md
git commit -m "docs: write Phase 7 cutover runbook"
```

---

### Task 4: Execute the cutover (gated — do not run until Task 1's check passes)

**Files:**
- Modify: `package.json` (build script)
- Delete: `scripts/prepare-legacy.mjs`
- Delete: `arena-campeonatos-v2-intervencao-19.html`
- Modify: `docs/superpowers/plans/MIGRATION-PROGRESS.md` (mark Phase 7 row `✅ Done`)

**Interfaces:**
- Consumes: `scripts/cutover-check.mjs` (Task 1) as a hard precondition.
- Produces: `npm run build` now emits the `src/` app's own `dist/index.html` untouched — production and the `src/` app become the same thing.

- [ ] **Step 0: Gate check — do not proceed past this step until it passes**

Run: `node scripts/cutover-check.mjs`
Required: `OK: phases 1-6 all done, cutover is safe to run`. If this still fails, **stop this task here** — leave it unchecked and come back after Phases 4/5/6 merge to `main`. Do not comment out or bypass the check.

- [ ] **Step 1: Drop the legacy overwrite from the build script**

In `package.json`, change:
```json
"build": "vite build && node scripts/prepare-legacy.mjs",
```
to:
```json
"build": "vite build",
```

- [ ] **Step 2: Delete the legacy files**

```bash
rm scripts/prepare-legacy.mjs
rm arena-campeonatos-v2-intervencao-19.html
```

- [ ] **Step 3: Build and verify**

Run: `npm run build && npm run verify`
Expected: both succeed; `dist/index.html` now contains the `src/` app's own markup (check it references `/src/app/main.js` compiled output, not the legacy monolith's inline script).

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: all green (no test referenced `prepare-legacy.mjs` or the legacy HTML file — if any did, that test is itself dead weight from the migration and should be deleted, not fixed).

- [ ] **Step 5: Update the progress tracker**

In `docs/superpowers/plans/MIGRATION-PROGRESS.md`, change the Phase 7 row's Status from `Not started` to `✅ Done`, Plan column to `2026-08-16-migration-phase7-cutover.md`, and Merge commit to the commit hash from Step 6 below (fill in after committing).

- [ ] **Step 6: Commit**

```bash
git add package.json docs/superpowers/plans/MIGRATION-PROGRESS.md
git rm scripts/prepare-legacy.mjs arena-campeonatos-v2-intervencao-19.html
git commit -m "feat: cut production over to the src/ Vite app, retire legacy monolith"
```

- [ ] **Step 7: Follow the runbook's Canary and Cutover sections (Task 3's doc) for actual deployment**

This step is manual, outside the repo — deploy per `PHASE7-CUTOVER-RUNBOOK.md` steps 5–11 before considering Phase 7 fully complete.

---

## Self-review notes

- **Spec coverage:** progress table's Phase 7 scope = "remove `scripts/prepare-legacy.mjs` from the build" (Task 4 Step 1–2), "expand `scripts/verify-routes.mjs`" (Task 2), "canary" (Task 3 runbook + Task 4 Step 7), "retire the monolith" (Task 4 Step 2). All four covered.
- **Ordering safety:** Tasks 1–3 are safe to execute and merge to `main` today — they add a check script, a stricter verify step, and a doc; none of them touch the legacy build path. Task 4 is the only destructive task and carries its own hard gate at Step 0.
- **Known risk carried over from Phase 3d's follow-ups:** the `cfg` phase-scoping decision flagged in Phase 3d ("worth deciding alongside Phase 7's cutover") is a product decision, not a code task — surface it to the user before or during Task 4, don't silently pick one.
