# Phase 6b: Superadmin Platform Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the existing `renderSuperadmin` stub (currently: pending-payments approval only) into legacy's full platform overview — KPI counts, pending payments, and a "recent championships" list a superadmin can jump into — and make the panel reachable from the home page header.

**Architecture:** `src/services/superadmin.js` gets one new function, `platformOverview()`, that fetches championships + users + pending payments in parallel and shapes them into what the page needs. `src/pages/superadmin.js` is rewritten to render that data (reusing the `.grid`/`.card` KPI-tile pattern already established in `championship.js`'s `overview()`, and the `.row` list-row pattern established in Phase 6a). `src/pages/home.js` gets a conditional "⚡ Superadmin" header button, resolved async the same fire-and-forget way Phase 6a resolved `isSuperadmin()` in `championship.js`. "Open as superadmin" is just `navigate('/campeonatos/{id}')` — the existing championship route and Firestore rules (`canManageChampionship()` already includes `isPlatformAdmin()`) already support a superadmin opening any championship; no new route or function needed for that part.

**Tech Stack:** Vanilla JS ES modules, Firebase Firestore. No Vitest coverage for this phase — `src/pages/*.js` and `src/services/*.js` are Firebase-glue/page-wiring code with no unit tests anywhere in this codebase (confirmed: only `src/app/*.js` pure modules have `*.test.js` siblings), and Phase 6a's whole-branch review already accepted this as the established, intentional pattern for page-wiring tasks.

## Global Constraints

- Every new/changed `class="..."` must be checked against `src/styles/layout.css`/`tokens.css` for both the class's own rule and any `<class> <child-selector>` rule (standing instruction since Phase 2d). **Do not reuse `.alert-row` or `.registration-row`** — both are used elsewhere in this codebase (the current `superadmin.js` stub uses `.alert-row`; `championship.js` uses `.registration-row`) but neither has a matching CSS rule anywhere in `src/styles/` (verified by grep — this is a pre-existing, already-documented gap, not something to fix here, but also not something to propagate into new markup). Use `.row` (confirmed: `display:flex;gap:10px;align-items:center;` in `layout.css:5`) with inline `style="padding:10px 0;border-bottom:1px solid var(--line)"` instead — the exact pattern Phase 6a's review round established and verified correct for list rows of arbitrary child count.
- KPI tiles: reuse the `.grid` + `.card` + `<small>` + `<h2>` + `<p class="muted">` pattern from `championship.js`'s `overview()` function verbatim (both classes confirmed defined: `.grid` is `display:grid;grid-template-columns:repeat(3,1fr);gap:16px;` in `layout.css:14`, `.card` in `layout.css:13`).
- `esc()` (from `../app/utils.js`) must wrap every Firestore-sourced string rendered into HTML (`item.email`, `item.nome`, `item.ownerEmail`, `item.status`, plan names) — the current stub does NOT escape these; fix this while rewriting the file, don't carry the gap forward.
- Legacy reference: `arena-campeonatos-v2-intervencao-19.html` — `renderSuperadmin` (line 730, KPI/list markup and data shape), `isPlatformSuperadmin`/`loadPlatformAdmin` (lines 715-716, already covered by `src/services/superadmin.js`'s existing `isSuperadmin()` — no change needed there), `superOpenChamp` (line 731, maps to the existing `/campeonatos/{id}` route — no new function needed), header conditional superadmin button (line 765, `isPlatformSuperadmin()?'...⚡ Superadmin...':''`).
- Do not add a client-side cache for the superadmin check (legacy's `platformAdminProfile` global) — `isSuperadmin()` already re-queries per call, which is the existing, accepted pattern in this codebase (Phase 6a used it the same way in `championship.js`, fire-and-forget, no caching layer).
- Firestore rules need no change for this phase — `championships`/`users` collection-level queries are evaluated per-document against `canManageChampionship()`/`isPlatformAdmin()` respectively (confirmed by reading `firestore.rules`), so an unfiltered `.limit(100)` query already returns every document for a superadmin, matching legacy's identical unfiltered query.

---

### Task 1: `src/services/superadmin.js` — `platformOverview()`

**Files:**
- Modify: `src/services/superadmin.js`

**Interfaces:**
- Consumes: nothing new — reuses this file's own `isSuperadmin()` and `pendingPayments()`, and `db` from `../services/firebase.js` (already imported in this file).
- Produces (used by Task 2): `export async function platformOverview()` — resolves to `{ championships, totalChampionships, totalUsers, inProgress, pending }` where:
  - `championships`: array of up to 20 championship records (`{ id, nome, ownerEmail, status, updated, ... }`, whatever fields the Firestore doc has), sorted by `updated` descending.
  - `totalChampionships`: total count of the (up to 100) fetched championship docs.
  - `totalUsers`: total count of the (up to 100) fetched user docs.
  - `inProgress`: count of fetched championships with `status === 'andamento'`.
  - `pending`: the same array `pendingPayments()` already returns (array of `{ id, email, billing: {...}, ... }`).
  - Throws `Error('Acesso restrito ao superadmin.')` if the caller isn't a superadmin (same message/behavior as this file's existing `pendingPayments`/`approvePayment`).

- [ ] **Step 1: Read the current file**

Read `src/services/superadmin.js` to confirm its exact current content before editing (it's a 4-line file today: `isSuperadmin`, `pendingPayments`, `approvePayment`).

- [ ] **Step 2: Add `limit` to the Firestore import and add `platformOverview()`**

Change the import line from:

```javascript
import { collection, doc, getDoc, getDocs, query, where, updateDoc } from 'firebase/firestore';
```

to:

```javascript
import { collection, doc, getDoc, getDocs, limit, query, where, updateDoc } from 'firebase/firestore';
```

Add this function at the end of the file (after `approvePayment`):

```javascript
export async function platformOverview() {
  if (!(await isSuperadmin())) throw new Error('Acesso restrito ao superadmin.');
  const [championshipsSnapshot, usersSnapshot, pending] = await Promise.all([
    getDocs(query(collection(db, 'championships'), limit(100))),
    getDocs(query(collection(db, 'users'), limit(100))),
    pendingPayments(),
  ]);
  const championships = championshipsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  return {
    championships: championships.sort((a, b) => (b.updated || 0) - (a.updated || 0)).slice(0, 20),
    totalChampionships: championships.length,
    totalUsers: usersSnapshot.size,
    inProgress: championships.filter((item) => item.status === 'andamento').length,
    pending,
  };
}
```

- [ ] **Step 3: Verify the file is valid**

Run: `npm run build`
Expected: build succeeds (this file has no unit tests — `npm run build` is the correctness check for a syntax/import error, same verification method Phase 6a's page-wiring task used).

- [ ] **Step 4: Commit**

```bash
git add src/services/superadmin.js
git commit -m "feat: add platformOverview() (championships/users/pending KPIs) to superadmin service"
```

---

### Task 2: Expand `src/pages/superadmin.js`, add nav entry in `src/pages/home.js`

**Files:**
- Modify: `src/pages/superadmin.js` (full rewrite — the current file is a 3-line minimal stub)
- Modify: `src/pages/home.js`

**Interfaces:**
- Consumes (from Task 1): `platformOverview()` — see its return shape above.
- Consumes (existing, no change): `approvePayment(id)` from `../services/superadmin.js` (already exported, already used by the current stub); `isSuperadmin()` from `../services/superadmin.js` (already exported); `navigate` from `../app/router.js`; `esc` from `../app/utils.js`.
- No new exports from either file — both are page-level render functions already wired into `src/app/main.js`'s router (`renderSuperadmin` at `/superadmin`, `renderHome` at `/`) — no router changes needed.

- [ ] **Step 1: Read both current files**

Read `src/pages/superadmin.js` (current 3-line stub) and `src/pages/home.js` (current 6-line file) to confirm exact current content before editing.

- [ ] **Step 2: Rewrite `src/pages/superadmin.js`**

Replace the entire file with:

```javascript
import { navigate } from '../app/router.js';
import { esc } from '../app/utils.js';
import { platformOverview, approvePayment } from '../services/superadmin.js';

export async function renderSuperadmin(root) {
  root.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/">ARENA</a><button class="btn ghost" data-back>← Voltar</button></header><main class="section"><div class="hero" style="padding-top:10px;min-height:0"><h1>PAINEL <em>SUPERADMIN</em></h1><p class="muted">Visão operacional da plataforma ARENA.</p></div><div data-body><div class="card">Carregando plataforma...</div></div></main></div>`;
  root.querySelector('[data-back]').onclick = () => navigate('/');
  const body = root.querySelector('[data-body]');

  async function load() {
    try {
      const overview = await platformOverview();
      renderBody(overview);
    } catch (error) {
      body.innerHTML = `<div class="card"><h2>Acesso restrito</h2><p class="muted">${esc(error.message || 'Você não possui permissão de superadmin.')}</p></div>`;
    }
  }

  function renderBody(overview) {
    body.innerHTML = `<div class="grid" style="margin-top:18px"><div class="card"><small>CAMPEONATOS</small><h2>${overview.totalChampionships}</h2></div><div class="card"><small>USUÁRIOS</small><h2>${overview.totalUsers}</h2></div><div class="card"><small>EM ANDAMENTO</small><h2>${overview.inProgress}</h2></div><div class="card"><small>PAGAMENTOS PENDENTES</small><h2>${overview.pending.length}</h2></div></div><div class="card" style="margin-top:16px"><h2>Pagamentos pendentes</h2>${overview.pending.length ? overview.pending.map((item) => `<div class="row" style="padding:10px 0;border-bottom:1px solid var(--line)"><span style="flex:1"><strong>${esc(item.email || item.id)}</strong><br><span class="muted">${esc(item.billing?.planId || 'Plano')} · R$ ${Number(item.billing?.amount || 0).toFixed(2).replace('.', ',')}</span></span><button class="btn primary" data-approve="${esc(item.id)}">Liberar acesso</button></div>`).join('') : '<p class="muted">Nenhum pagamento pendente.</p>'}</div><div class="card" style="margin-top:16px"><h2>Campeonatos recentes</h2>${overview.championships.length ? overview.championships.map((item) => `<div class="row" style="padding:10px 0;border-bottom:1px solid var(--line)"><span style="flex:1"><strong>${esc(item.nome || item.id)}</strong><br><span class="muted">${esc(item.ownerEmail || '')} · ${esc(item.status || '')}</span></span><button class="btn ghost" data-open="${esc(item.id)}">Abrir</button></div>`).join('') : '<p class="muted">Nenhum campeonato.</p>'}</div>`;
    body.querySelectorAll('[data-approve]').forEach((button) => button.onclick = async () => { await approvePayment(button.dataset.approve); await load(); });
    body.querySelectorAll('[data-open]').forEach((button) => button.onclick = () => navigate(`/campeonatos/${button.dataset.open}`));
  }

  await load();
}
```

(`min-height:0` on the `.hero` inline style overrides its default `min-height:600px` — see `layout.css:9` — which is sized for the landing page's two-column hero and would otherwise leave a huge empty gap on this single-column admin panel; legacy's equivalent used a plain `<div class="hero" style="padding-top:10px">` inside a full-page app shell without this component's fixed min-height, so this is the one intentional deviation from copying legacy's inline style verbatim.)

- [ ] **Step 3: Add the conditional "⚡ Superadmin" header button in `src/pages/home.js`**

Add an import at the top:

```javascript
import { isSuperadmin } from '../services/superadmin.js';
```

so the top of the file reads:

```javascript
import { navigate } from '../app/router.js';
import { listMine, removeChampionship } from '../services/championships.js';
import { logout } from '../services/firebase.js';
import { isSuperadmin } from '../services/superadmin.js';
```

At the end of `renderHome`'s body (after the existing `try { ... } catch (error) { ... }` block that loads the championship list, still inside the `export async function renderHome(root) { ... }` function), add:

```javascript
  isSuperadmin().then((value) => { if (!value) return; const actions = root.querySelector('.topbar .actions'); if (!actions) return; actions.insertAdjacentHTML('afterbegin', '<button class="btn ghost" data-superadmin>⚡ Superadmin</button>'); root.querySelector('[data-superadmin]').onclick = () => navigate('/superadmin'); }).catch(() => {});
```

(Fire-and-forget, same pattern Phase 6a used for `championship.js`'s `superadmin` flag — the button simply doesn't appear until the async check resolves, and never appears at all for a non-superadmin or on error.)

- [ ] **Step 4: Manual smoke check**

Run: `npm run build`
Expected: build succeeds with no errors.

Run: `npm test`
Expected: full existing suite (242 tests) passes unchanged — this task touches no `src/app/*.js` module, so no test file is affected.

- [ ] **Step 5: Commit**

```bash
git add src/pages/superadmin.js src/pages/home.js
git commit -m "feat: build out superadmin panel (KPIs, championships list, open-as-superadmin) and add header nav entry"
```

---

## Self-Review Notes (already applied above)

- **Spec coverage:** `renderSuperadmin` (fully expanded from stub), `loadPlatformAdmin` (already covered by the existing `isSuperadmin()` — legacy's caching `platformAdminProfile` global is a micro-optimization this codebase already chose not to port in Phase 6a's `isSuperadmin()` usage; not re-litigated here), `superOpenChamp` (covered by the existing `/campeonatos/{id}` route + `navigate()`, no new function — a real function existed in legacy only because legacy was a single-page-state monolith without a router; this codebase already has the router, so porting a dedicated function would be re-implementing what `navigate()` already does). No task left as a placeholder.
- **Deferred, not forgotten (document in `MIGRATION-PROGRESS.md` after merge):** the platform-wide `.limit(100)` caps (matching legacy's identical cap) mean a platform with over 100 championships or users won't show the full count/list — same class of "no silent cap without a note" concern as elsewhere in this migration; legacy shipped the identical cap, so this is parity, not a new limitation.
- **Placeholder scan:** none — every step has runnable code.
- **Type consistency:** `platformOverview()`'s return shape (`championships`, `totalChampionships`, `totalUsers`, `inProgress`, `pending`) is used with those exact field names in Task 2's `renderBody()`.
