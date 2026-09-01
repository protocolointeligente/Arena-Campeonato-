# Phase 6b+/6c: Audit Center Implementation Plan

**Goal:** Port legacy's audit center (`renderAuditCenter` from `arena-campeonatos-v2-intervencao-19.html`) into `src/pages/audit-center.js`, reachable from the superadmin panel.

**Architecture:** New page `src/pages/audit-center.js` with `renderAuditCenter(root)`. Route `/superadmin/auditoria` added to `src/app/main.js`. Superadmin panel gets a nav link to it. Reuses existing `listAudit` from `src/services/audit.js` (already ported in Phase 6a).

**Tech Stack:** Vanilla JS ES modules, Firebase Firestore. No Vitest coverage (page-wiring).

**Global Constraints:**
- Every new/changed `class="..."` checked against `src/styles/layout.css`/`tokens.css` (standing instruction since Phase 2d).
- Use `.row` with inline `style="padding:10px 0;border-bottom:1px solid var(--line)"` for list rows (Phase 6a pattern).
- `esc()` from `../app/utils.js` must wrap every Firestore-sourced string.
- Legacy reference: `arena-campeonatos-v2-intervencao-19.html` lines around 730-750 for `renderAuditCenter` markup and data shape.

---

### Task 1: Create `src/pages/audit-center.js`

**Files:**
- Create: `src/pages/audit-center.js`

**Interfaces:**
- Consumes: `listAudit` from `../services/audit.js` (already exported), `navigate` from `../app/router.js`, `esc` from `../app/utils.js`.
- Exports: `export async function renderAuditCenter(root)`

**Implementation:**
- Fetch audit logs with `listAudit()` (no championship filter - platform-wide).
- Render KPI tiles: total logs, today's logs, unique users.
- Render paginated table: timestamp, user, action, summary, before/after (truncated).
- Back button to `/superadmin`.
- Use `.grid` + `.card` for KPIs (pattern from `championship.js` `overview()`).
- Use `.row` with inline padding/border for list rows.

---

### Task 2: Add route in `src/app/main.js`

**Files:**
- Modify: `src/app/main.js`

**Implementation:**
- Import `renderAuditCenter` from `../pages/audit-center.js`.
- Add route match for `/superadmin/auditoria` in `dynamicRoute()`.

---

### Task 3: Add nav link in `src/pages/superadmin.js`

**Files:**
- Modify: `src/pages/superadmin.js`

**Implementation:**
- Add a button/link in the superadmin panel header or body to navigate to `/superadmin/auditoria`.

---

### Task 4: Verify

Run: `npm run build && npm test && npm run verify`

Expected: build succeeds, all existing tests pass.

---

### Task 5: Commit

```bash
git add src/pages/audit-center.js src/app/main.js src/pages/superadmin.js
git commit -m "feat: add audit center page (platform-wide audit log viewer) and wire into superadmin panel"
```