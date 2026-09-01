# Phase 6e: Plans & Billing Implementation Plan

**Goal:** Port legacy's plans & billing UI from `arena-campeonatos-v2-intervencao-19.html` — `choosePlan`, `currentPlan`, `planCardsHTML`, `planLimitText`, `canCreateChampionship`, `confirmPlanRequest`, `approvePendingPlan` — into `src/pages/plans-billing.js` (superadmin view) and `src/pages/plans.js` (organizer view), with supporting pure functions in `src/app/plans.js`.

**Architecture:**
- Pure module: `src/app/plans.js` — plan definitions, limits, `planCardsHTML()`, `planLimitText()`, `canCreateChampionship()`, `choosePlan()`, `currentPlan()`, `confirmPlanRequest()`.
- Organizer page: `src/pages/plans.js` with `renderPlans(root)` — shows current plan, upgrade options, limits. Route `/planos`.
- Superadmin page: `src/pages/plans-billing.js` with `renderPlansBilling(root)` — manages all users' plans, approves pending requests. Route `/superadmin/planos`.
- `approvePendingPlan` in `src/services/superadmin.js` (or new billing service).

**Tech Stack:** Vanilla JS ES modules, Firebase Firestore. `src/app/plans.js` gets Vitest coverage (pure functions). Page-wiring has no tests.

**Global Constraints:**
- Every new/changed `class="..."` checked against `src/styles/layout.css`/`tokens.css`.
- Use `.grid` + `.card` for plan cards (pattern from `championship.js` `overview()`).
- `esc()` wraps all Firestore-sourced strings.
- Legacy reference: `arena-campeonatos-v2-intervencao-19.html` for plan definitions, `planCardsHTML`, billing flow.

---

### Task 1: Create `src/app/plans.js` (pure module)

**Files:** Create `src/app/plans.js`

**Exports:**
- `PLAN_DEFINITIONS` — object keyed by planId (`free`, `pro`, `enterprise`) with `{ name, price, limits: { maxChampionships, maxTeams, maxAthletes, maxStorageMB, features: [...] } }`.
- `planCardsHTML(currentPlanId)` — returns HTML string for plan comparison cards.
- `planLimitText(planId)` — returns human-readable limit summary.
- `canCreateChampionship(state, planId)` — returns `{ ok: boolean, reason?: string }`.
- `choosePlan(user, planId)` — returns `{ ok: boolean, reason?: string, pending?: boolean }` (sets `billing.status: 'pending'` for paid plans).
- `currentPlan(user)` — returns planId string.
- `confirmPlanRequest(user, planId)` — organizer confirms upgrade request.

**Tests:** Create `src/app/plans.test.js` with coverage for all pure functions.

---

### Task 2: Create `src/pages/plans.js` (organizer view)

**Files:** Create `src/pages/plans.js`

**Interfaces:**
- Consumes: `auth` from `../services/firebase.js`, `planCardsHTML`, `planLimitText`, `currentPlan`, `choosePlan`, `confirmPlanRequest` from `../app/plans.js`, `navigate` from `../app/router.js`, `esc` from `../app/utils.js`, `toast` from `../app/ui.js`.
- Exports: `export async function renderPlans(root)`

**Implementation:**
- Show current plan badge + limits.
- Render plan cards with `planCardsHTML()`.
- "Upgrade" buttons call `choosePlan()` / `confirmPlanRequest()`.
- Back button to `/`.

---

### Task 3: Create `src/pages/plans-billing.js` (superadmin view)

**Files:** Create `src/pages/plans-billing.js`

**Interfaces:**
- Consumes: `db` from `../services/firebase.js`, `PLAN_DEFINITIONS` from `../app/plans.js`, `navigate` from `../app/router.js`, `esc` from `../app/utils.js`, `approvePayment` from `../services/superadmin.js` (reuse for plan approval).
- Exports: `export async function renderPlansBilling(root)`

**Implementation:**
- Table of all users with their plan, status, limits usage.
- Approve/deny pending plan requests.
- Manual plan override for any user.
- Back button to `/superadmin`.

---

### Task 4: Add routes in `src/app/main.js`

**Files:** Modify `src/app/main.js`

**Implementation:**
- Import `renderPlans`, `renderPlansBilling`.
- Add routes: `/planos` (organizer), `/superadmin/planos` (superadmin).

---

### Task 5: Add nav links

**Files:** 
- Modify `src/pages/home.js` — add "Planos" button in header for organizers.
- Modify `src/pages/superadmin.js` — add "Planos e Cobrança" link.

---

### Task 6: Verify

Run: `npm run build && npm test && npm run verify`

---

### Task 7: Commit

```bash
git add src/app/plans.js src/app/plans.test.js src/pages/plans.js src/pages/plans-billing.js src/app/main.js src/pages/home.js src/pages/superadmin.js
git commit -m "feat: add plans & billing (organizer upgrade flow, superadmin management, plan definitions with limits)"
```