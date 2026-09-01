# Phase 6b+: Beta Hardening Implementation Plan

**Goal:** Port legacy's `renderBetaHardening` from `arena-campeonatos-v2-intervencao-19.html` into `src/pages/beta-hardening.js`, reachable from the superadmin panel. This is a platform-wide feature flag / beta program management panel.

**Architecture:** New page `src/pages/beta-hardening.js` with `renderBetaHardening(root)`. Route `/superadmin/beta` added to `src/app/main.js`. Superadmin panel gets nav link.

**Tech Stack:** Vanilla JS ES modules, Firebase Firestore. No Vitest coverage (page-wiring).

**Global Constraints:**
- Every new/changed `class="..."` checked against `src/styles/layout.css`/`tokens.css`.
- Use `.row` with inline padding/border for list rows.
- `esc()` wraps all Firestore-sourced strings.
- Legacy reference: `arena-campeonatos-v2-intervencao-19.html` for `renderBetaHardening` markup.

---

### Task 1: Create `src/pages/beta-hardening.js`

**Files:** Create `src/pages/beta-hardening.js`

**Interfaces:**
- Consumes: `db` from `../services/firebase.js`, `navigate` from `../app/router.js`, `esc` from `../app/utils.js`.
- Exports: `export async function renderBetaHardening(root)`

**Implementation:**
- List all beta features (flags) with descriptions.
- For each feature: enable/disable toggle, target audience (all users, specific emails, percentage rollout).
- Show current adoption metrics per feature.
- Back button to `/superadmin`.

---

### Task 2: Add route in `src/app/main.js`

**Files:** Modify `src/app/main.js`

**Implementation:**
- Import `renderBetaHardening`.
- Add route match for `/superadmin/beta`.

---

### Task 3: Add nav link in `src/pages/superadmin.js`

**Files:** Modify `src/pages/superadmin.js`

**Implementation:**
- Add "Beta & Hardening" button/link in the panel.

---

### Task 4: Verify

Run: `npm run build && npm test && npm run verify`

---

### Task 5: Commit

```bash
git add src/pages/beta-hardening.js src/app/main.js src/pages/superadmin.js
git commit -m "feat: add beta hardening / feature flags management page and wire into superadmin panel"
```