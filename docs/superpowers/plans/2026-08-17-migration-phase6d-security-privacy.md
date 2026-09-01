# Phase 6d: Security & Privacy Centers Implementation Plan

**Goal:** Port legacy's security center (`renderSecurityCenter`) and privacy center (`renderPrivacyCenter` + `privacyNoticeHTML`) from `arena-campeonatos-v2-intervencao-19.html` into `src/pages/security-center.js` and `src/pages/privacy-center.js`, reachable from the superadmin panel.

**Architecture:** Two new pages:
- `src/pages/security-center.js` with `renderSecurityCenter(root)` - platform security settings, 2FA status, session management.
- `src/pages/privacy-center.js` with `renderPrivacyCenter(root)` - LGPD compliance, data export, deletion requests, privacy notice.
Routes `/superadmin/seguranca` and `/superadmin/privacidade` added to `src/app/main.js`. Superadmin panel gets nav links.

**Tech Stack:** Vanilla JS ES modules, Firebase Firestore/Auth. No Vitest coverage (page-wiring).

**Global Constraints:**
- Every new/changed `class="..."` checked against `src/styles/layout.css`/`tokens.css`.
- Use `.row` with inline padding/border for list rows.
- `esc()` from `../app/utils.js` wraps all Firestore-sourced strings.
- Legacy reference: `arena-campeonatos-v2-intervencao-19.html` for `renderSecurityCenter`, `renderPrivacyCenter`, `privacyNoticeHTML` markup.

---

### Task 1: Create `src/pages/security-center.js`

**Files:** Create `src/pages/security-center.js`

**Interfaces:**
- Consumes: `auth` from `../services/firebase.js`, `navigate` from `../app/router.js`, `esc` from `../app/utils.js`.
- Exports: `export async function renderSecurityCenter(root)`

**Implementation:**
- Show current user's security status: email, 2FA enabled (check `user.multiFactor`), last sign-in.
- Platform-wide security settings: password policy, session timeout, allowed domains.
- Actions: revoke all sessions, enforce 2FA (superadmin only).
- Back button to `/superadmin`.

---

### Task 2: Create `src/pages/privacy-center.js`

**Files:** Create `src/pages/privacy-center.js`

**Interfaces:**
- Consumes: `auth` from `../services/firebase.js`, `navigate` from `../app/router.js`, `esc` from `../app/utils.js`, `listAudit` from `../services/audit.js`.
- Exports: `export async function renderPrivacyCenter(root)`, `export function privacyNoticeHTML()` (pure HTML string for privacy notice).

**Implementation:**
- LGPD compliance dashboard: data subject requests (access, deletion, portability).
- Privacy notice content (reusable `privacyNoticeHTML()`).
- Data export button (triggers user data download).
- Deletion request workflow.
- Back button to `/superadmin`.

---

### Task 3: Add routes in `src/app/main.js`

**Files:** Modify `src/app/main.js`

**Implementation:**
- Import both render functions.
- Add route matches for `/superadmin/seguranca` and `/superadmin/privacidade`.

---

### Task 4: Add nav links in `src/pages/superadmin.js`

**Files:** Modify `src/pages/superadmin.js`

**Implementation:**
- Add buttons/links for Security Center and Privacy Center in the panel.

---

### Task 5: Verify

Run: `npm run build && npm test && npm run verify`

---

### Task 6: Commit

```bash
git add src/pages/security-center.js src/pages/privacy-center.js src/app/main.js src/pages/superadmin.js
git commit -m "feat: add security center and privacy center pages (LGPD, 2FA, session mgmt) and wire into superadmin panel"
```