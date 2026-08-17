# Phase 6a: Collaborators & Roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port legacy's collaborator/role system (owner can invite managers with scoped roles — admin/results/registrations/viewer) into `src/`, gate saving on having a real role, and add a management UI tab.

**Architecture:** A new pure module `src/app/collaborators.js` holds all role logic as testable functions that take `(state, user)` explicitly — no reads of `auth.currentUser` inside the module, matching every other `src/app/*.js` module's style (`categories.js`, `phases.js`, `roster.js`). `src/pages/championship.js` is the only caller that imports `auth` from `services/firebase.js` and passes `auth.currentUser` in. A new "Gerenciamento" tab lists/edits collaborators; the shared `persist()` function is gated so a user with no role can't silently save.

**Tech Stack:** Vanilla JS ES modules, Vitest, Firebase Auth/Firestore (already wired — `state.ownerUid`/`state.collaborators` already round-trip through `services/championships.js`, no backend change needed).

## Global Constraints

- Every new/changed `class="..."` must be checked against `src/styles/layout.css`/`tokens.css` for both the class's own rule and any `<class> <child-selector>` rule (standing instruction since Phase 2d, see `docs/superpowers/plans/MIGRATION-PROGRESS.md`). Reuse only classes already used elsewhere in `championship.js` (`card`, `team-row`, `row`, `btn`, `btn primary`, `btn ghost`, `btn ghost sm`, `muted`, `actions`) — no new classes needed for this phase.
- Match existing code style in the touched files: no semicolons omitted, arrow functions, `esc()` on every user-supplied string rendered into HTML, `{ ok, reason }` / `{ ok, ... }` return shape for mutating functions (see `roster.js`, `categories.js`).
- Legacy reference: `arena-campeonatos-v2-intervencao-19.html` lines 435-445 (`COLLAB_ROLES`, `ensureCollaborators`, `isOwner`, `myCollaborator`, `myRole`, `can`, `roleLabel`, `inviteManager`, `changeManagerRole`, `removeManager`).
- Do not add `isPlatformSuperadmin()` override to `isOwner` yet — that's Phase 6b (superadmin panel doesn't exist in `src/` yet). Leave a one-line comment noting this so 6b's implementer finds it.

---

### Task 1: `src/app/collaborators.js` — role logic module

**Files:**
- Create: `src/app/collaborators.js`
- Test: `src/app/collaborators.test.js`

**Interfaces:**
- Consumes: `uid` from `./utils.js` (`export function uid()`, no args, returns string).
- Produces (used by Task 2's UI code and by `championship.js`'s `persist()`):
  - `export const COLLAB_ROLES` — `{ admin: {name, desc}, results: {name, desc}, registrations: {name, desc}, viewer: {name, desc} }`
  - `export function ensureCollaborators(state)` — void, mutates `state.collaborators` into an array if missing.
  - `export function isOwner(state, user)` — `user` is `{uid, email} | null`. Returns boolean.
  - `export function myCollaborator(state, user)` — returns the matching non-revoked collaborator object or `null`.
  - `export function myRole(state, user)` — returns `'owner' | 'admin' | 'results' | 'registrations' | 'viewer' | 'none'`.
  - `export function can(state, user, permission)` — `permission` is `'view' | 'results' | 'registrations' | 'admin'`. Returns boolean.
  - `export function roleLabel(state, user)` — returns a display string (`'Proprietário'`, a `COLLAB_ROLES[role].name`, or `'Sem acesso'`).
  - `export function inviteManager(state, user, { email, role })` — returns `{ ok: true, collaborator }` or `{ ok: false, reason }`.
  - `export function removeManager(state, user, id)` — returns `{ ok: boolean }`.
  - `export function changeManagerRole(state, user, id, role)` — returns `{ ok: boolean }`.

- [ ] **Step 1: Write the failing tests**

```javascript
// src/app/collaborators.test.js
import { describe, it, expect } from 'vitest';
import {
  COLLAB_ROLES, ensureCollaborators, isOwner, myCollaborator, myRole, can,
  roleLabel, inviteManager, removeManager, changeManagerRole,
} from './collaborators.js';

const OWNER = { uid: 'owner-1', email: 'owner@example.com' };
const OTHER = { uid: 'other-1', email: 'other@example.com' };

function championship(overrides = {}) {
  return { ownerUid: OWNER.uid, ownerEmail: OWNER.email, collaborators: [], ...overrides };
}

describe('ensureCollaborators', () => {
  it('initializes a missing collaborators array', () => {
    const state = { ownerUid: OWNER.uid };
    ensureCollaborators(state);
    expect(state.collaborators).toEqual([]);
  });

  it('leaves an existing array untouched', () => {
    const state = championship({ collaborators: [{ id: 'c1', email: 'x@x.com', role: 'admin', status: 'active' }] });
    ensureCollaborators(state);
    expect(state.collaborators).toHaveLength(1);
  });
});

describe('isOwner', () => {
  it('is true when user.uid matches state.ownerUid', () => {
    expect(isOwner(championship(), OWNER)).toBe(true);
  });

  it('is false for a non-owner', () => {
    expect(isOwner(championship(), OTHER)).toBe(false);
  });

  it('is false for no user', () => {
    expect(isOwner(championship(), null)).toBe(false);
  });
});

describe('myCollaborator / myRole / can', () => {
  it('owner gets role "owner" and can do everything', () => {
    const state = championship();
    expect(myRole(state, OWNER)).toBe('owner');
    expect(can(state, OWNER, 'admin')).toBe(true);
    expect(can(state, OWNER, 'view')).toBe(true);
  });

  it('a stranger with no collaborator entry gets role "none" and no permission', () => {
    const state = championship();
    expect(myCollaborator(state, OTHER)).toBeNull();
    expect(myRole(state, OTHER)).toBe('none');
    expect(can(state, OTHER, 'view')).toBe(false);
  });

  it('an active collaborator gets their assigned role', () => {
    const state = championship({ collaborators: [{ id: 'c1', email: OTHER.email, role: 'results', status: 'active' }] });
    expect(myRole(state, OTHER)).toBe('results');
    expect(can(state, OTHER, 'results')).toBe(true);
    expect(can(state, OTHER, 'view')).toBe(true);
    expect(can(state, OTHER, 'admin')).toBe(false);
    expect(can(state, OTHER, 'registrations')).toBe(false);
  });

  it('a revoked collaborator is treated as having no role', () => {
    const state = championship({ collaborators: [{ id: 'c1', email: OTHER.email, role: 'admin', status: 'revoked' }] });
    expect(myCollaborator(state, OTHER)).toBeNull();
    expect(myRole(state, OTHER)).toBe('none');
  });

  it('email match is case-insensitive', () => {
    const state = championship({ collaborators: [{ id: 'c1', email: 'OTHER@EXAMPLE.COM', role: 'viewer', status: 'active' }] });
    expect(myRole(state, OTHER)).toBe('viewer');
  });

  it('viewer can only view; registrations role covers view+registrations', () => {
    const state = championship({ collaborators: [{ id: 'c1', email: OTHER.email, role: 'registrations', status: 'active' }] });
    expect(can(state, OTHER, 'view')).toBe(true);
    expect(can(state, OTHER, 'registrations')).toBe(true);
    expect(can(state, OTHER, 'results')).toBe(false);
  });
});

describe('roleLabel', () => {
  it('labels the owner', () => {
    expect(roleLabel(championship(), OWNER)).toBe('Proprietário');
  });

  it('labels a named role from COLLAB_ROLES', () => {
    const state = championship({ collaborators: [{ id: 'c1', email: OTHER.email, role: 'admin', status: 'active' }] });
    expect(roleLabel(state, OTHER)).toBe(COLLAB_ROLES.admin.name);
  });

  it('labels a stranger as having no access', () => {
    expect(roleLabel(championship(), OTHER)).toBe('Sem acesso');
  });
});

describe('inviteManager', () => {
  it('rejects when the caller is neither owner nor admin', () => {
    const state = championship();
    const result = inviteManager(state, OTHER, { email: 'new@x.com', role: 'viewer' });
    expect(result.ok).toBe(false);
  });

  it('rejects an invalid email', () => {
    const state = championship();
    const result = inviteManager(state, OWNER, { email: 'not-an-email', role: 'viewer' });
    expect(result.ok).toBe(false);
  });

  it('rejects inviting the owner\'s own email', () => {
    const state = championship();
    const result = inviteManager(state, OWNER, { email: OWNER.email, role: 'admin' });
    expect(result.ok).toBe(false);
  });

  it('adds a new active collaborator', () => {
    const state = championship();
    const result = inviteManager(state, OWNER, { email: 'new@x.com', role: 'results' });
    expect(result.ok).toBe(true);
    expect(state.collaborators).toHaveLength(1);
    expect(state.collaborators[0]).toMatchObject({ email: 'new@x.com', role: 'results', status: 'active' });
  });

  it('re-inviting an existing email updates role and reactivates it', () => {
    const state = championship({ collaborators: [{ id: 'c1', email: 'new@x.com', role: 'viewer', status: 'revoked' }] });
    const result = inviteManager(state, OWNER, { email: 'new@x.com', role: 'admin' });
    expect(result.ok).toBe(true);
    expect(state.collaborators).toHaveLength(1);
    expect(state.collaborators[0]).toMatchObject({ role: 'admin', status: 'active' });
  });

  it('an admin collaborator (not just the owner) can invite', () => {
    const state = championship({ collaborators: [{ id: 'c1', email: OTHER.email, role: 'admin', status: 'active' }] });
    const result = inviteManager(state, OTHER, { email: 'third@x.com', role: 'viewer' });
    expect(result.ok).toBe(true);
  });
});

describe('changeManagerRole', () => {
  it('rejects when the caller is not the owner', () => {
    const state = championship({ collaborators: [{ id: 'c1', email: OTHER.email, role: 'viewer', status: 'active' }] });
    const result = changeManagerRole(state, OTHER, 'c1', 'admin');
    expect(result.ok).toBe(false);
    expect(state.collaborators[0].role).toBe('viewer');
  });

  it('owner changes a collaborator role', () => {
    const state = championship({ collaborators: [{ id: 'c1', email: OTHER.email, role: 'viewer', status: 'active' }] });
    const result = changeManagerRole(state, OWNER, 'c1', 'admin');
    expect(result.ok).toBe(true);
    expect(state.collaborators[0].role).toBe('admin');
  });

  it('no-ops for an unknown id', () => {
    const state = championship();
    const result = changeManagerRole(state, OWNER, 'ghost', 'admin');
    expect(result.ok).toBe(false);
  });
});

describe('removeManager', () => {
  it('rejects when the caller is not the owner', () => {
    const state = championship({ collaborators: [{ id: 'c1', email: OTHER.email, role: 'viewer', status: 'active' }] });
    const result = removeManager(state, OTHER, 'c1');
    expect(result.ok).toBe(false);
    expect(state.collaborators).toHaveLength(1);
  });

  it('owner removes a collaborator', () => {
    const state = championship({ collaborators: [{ id: 'c1', email: OTHER.email, role: 'viewer', status: 'active' }] });
    const result = removeManager(state, OWNER, 'c1');
    expect(result.ok).toBe(true);
    expect(state.collaborators).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/app/collaborators.test.js`
Expected: FAIL — `Cannot find module './collaborators.js'` (or similar resolution error), since the module doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```javascript
// src/app/collaborators.js
import { uid } from './utils.js';

export const COLLAB_ROLES = {
  admin: { name: 'Administrador', desc: 'Pode gerenciar praticamente todo o campeonato.' },
  results: { name: 'Resultados e súmulas', desc: 'Pode operar partidas, placares, eventos e consultar competição.' },
  registrations: { name: 'Inscrições', desc: 'Pode analisar inscrições, equipes e atletas.' },
  viewer: { name: 'Leitura interna', desc: 'Pode acessar o painel sem editar dados.' },
};

export function ensureCollaborators(state) {
  state.collaborators = Array.isArray(state.collaborators) ? state.collaborators : [];
}

// NOTE: legacy also OR's in isPlatformSuperadmin() here so platform superadmins can
// manage any championship. That panel doesn't exist in src/ yet (Phase 6b) — add the
// override there once it does, rather than guessing its shape now.
export function isOwner(state, user) {
  return !!(state && user && state.ownerUid === user.uid);
}

export function myCollaborator(state, user) {
  ensureCollaborators(state);
  const email = (user?.email || '').toLowerCase();
  if (!email) return null;
  return state.collaborators.find((c) => (c.email || '').toLowerCase() === email && c.status !== 'revoked') || null;
}

export function myRole(state, user) {
  if (isOwner(state, user)) return 'owner';
  const collaborator = myCollaborator(state, user);
  return collaborator ? collaborator.role : 'none';
}

export function can(state, user, permission) {
  const role = myRole(state, user);
  if (role === 'owner' || role === 'admin') return true;
  if (role === 'results') return ['view', 'results'].includes(permission);
  if (role === 'registrations') return ['view', 'registrations'].includes(permission);
  if (role === 'viewer') return permission === 'view';
  return false;
}

export function roleLabel(state, user) {
  const role = myRole(state, user);
  if (role === 'owner') return 'Proprietário';
  return COLLAB_ROLES[role]?.name || 'Sem acesso';
}

export function inviteManager(state, user, { email, role }) {
  if (!isOwner(state, user) && !can(state, user, 'admin')) return { ok: false, reason: 'Sem permissão.' };
  const trimmedEmail = (email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) return { ok: false, reason: 'Informe um e-mail válido.' };
  if (trimmedEmail === (state.ownerEmail || '').toLowerCase()) return { ok: false, reason: 'Este e-mail já é o proprietário.' };
  const chosenRole = COLLAB_ROLES[role] ? role : 'viewer';
  ensureCollaborators(state);
  const existing = state.collaborators.find((c) => (c.email || '').toLowerCase() === trimmedEmail);
  if (existing) {
    existing.role = chosenRole;
    existing.status = 'active';
    return { ok: true, collaborator: existing };
  }
  const collaborator = { id: uid(), email: trimmedEmail, role: chosenRole, status: 'active', createdAt: Date.now() };
  state.collaborators.push(collaborator);
  return { ok: true, collaborator };
}

export function changeManagerRole(state, user, id, role) {
  if (!isOwner(state, user)) return { ok: false, reason: 'Sem permissão.' };
  ensureCollaborators(state);
  const collaborator = state.collaborators.find((c) => c.id === id);
  if (!collaborator) return { ok: false, reason: 'Colaborador não encontrado.' };
  collaborator.role = COLLAB_ROLES[role] ? role : collaborator.role;
  return { ok: true };
}

export function removeManager(state, user, id) {
  if (!isOwner(state, user)) return { ok: false, reason: 'Sem permissão.' };
  ensureCollaborators(state);
  const before = state.collaborators.length;
  state.collaborators = state.collaborators.filter((c) => c.id !== id);
  return { ok: state.collaborators.length < before };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/app/collaborators.test.js`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/collaborators.js src/app/collaborators.test.js
git commit -m "feat: port collaborator role logic (isOwner/myRole/can/inviteManager/removeManager/changeManagerRole)"
```

---

### Task 2: Wire collaborators into `championship.js` — Gerenciamento tab + gated persist

**Files:**
- Modify: `src/pages/championship.js`

**Interfaces:**
- Consumes (from Task 1): `COLLAB_ROLES, ensureCollaborators, isOwner, myRole, can, roleLabel, inviteManager, removeManager, changeManagerRole` from `../app/collaborators.js`.
- Consumes: `auth` from `../services/firebase.js` (`auth.currentUser` is `{uid, email, ...} | null`, standard Firebase SDK shape already used by `services/championships.js`).
- No new exports — this task only changes page-level wiring.

- [ ] **Step 1: Add the import and a `user` accessor**

In `src/pages/championship.js`, add to the top import block (after the existing `matches.js` import, before `engine.js`):

```javascript
import { auth } from '../services/firebase.js';
import { COLLAB_ROLES, ensureCollaborators, isOwner, myRole, can, roleLabel, inviteManager, removeManager, changeManagerRole } from '../app/collaborators.js';
```

- [ ] **Step 2: Gate `persist()` on having a real role**

Find (line 36):

```javascript
  async function persist() { root.querySelector('[data-save]').textContent = 'Salvando...'; saveRootIntoActive(state); state.updated = Date.now(); try { await saveChampionship(state); root.querySelector('[data-save]').textContent = 'Salvo'; } catch (error) { root.querySelector('[data-save]').textContent = 'Erro ao salvar'; toast(error.message || 'Não foi possível salvar.'); } }
```

Replace with:

```javascript
  async function persist() { if (!can(state, auth.currentUser, 'results') && !can(state, auth.currentUser, 'registrations') && !can(state, auth.currentUser, 'admin')) { toast('Seu perfil não tem permissão para esta ação.'); return; } root.querySelector('[data-save]').textContent = 'Salvando...'; saveRootIntoActive(state); state.updated = Date.now(); try { await saveChampionship(state); root.querySelector('[data-save]').textContent = 'Salvo'; } catch (error) { root.querySelector('[data-save]').textContent = 'Erro ao salvar'; toast(error.message || 'Não foi possível salvar.'); } }
```

(`can(..., 'admin')` covers `role === 'owner'` too, since Task 1's `can()` returns `true` for both `owner` and `admin` roles — matches legacy's `persist()` gate.)

- [ ] **Step 3: Add the "Gerenciamento" tab button**

Find the tabs array in `mount()` (line 32), inside the `.map(([key,label]) => ...)` list:

```javascript
${[['overview','Visão geral'],['categorias','Categorias'],['fases','Fases'],['jogos','Jogos'],['chave','Chaveamento'],['classif','Tabela'],['equipes','Equipes'],['artilharia','Artilharia'],['disciplina','Disciplina'],['inscricoes','Inscrições'],['publicacao','Publicação'],['historico','Histórico'],['config','Configurações']].map(([key,label]) => `<button data-tab="${key}">${label}</button>`).join('')}
```

Add `['gerenciamento','Gerenciamento']` right before `['config','Configurações']`:

```javascript
${[['overview','Visão geral'],['categorias','Categorias'],['fases','Fases'],['jogos','Jogos'],['chave','Chaveamento'],['classif','Tabela'],['equipes','Equipes'],['artilharia','Artilharia'],['disciplina','Disciplina'],['inscricoes','Inscrições'],['publicacao','Publicação'],['historico','Histórico'],['gerenciamento','Gerenciamento'],['config','Configurações']].map(([key,label]) => `<button data-tab="${key}">${label}</button>`).join('')}
```

- [ ] **Step 4: Route the tab to a new `managementView()` render function**

Find the `render()` function's ternary chain (line 37):

```javascript
  function render() { root.querySelectorAll('[data-tab]').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab)); root.querySelector('[data-categorybar]').innerHTML = categoryBar(); content.innerHTML = tab === 'overview' ? overview() : tab === 'categorias' ? categoriesView() : tab === 'fases' ? fasesView() : tab === 'jogos' ? games() : tab === 'chave' ? bracketView() : tab === 'classif' ? standings() : tab === 'equipes' ? teams() : tab === 'artilharia' ? scorersView() : tab === 'disciplina' ? disciplineView() : tab === 'inscricoes' ? registrationsView() : tab === 'publicacao' ? '<div class="card"><h2>Publicação</h2><p class="muted">Copie os links públicos para divulgar o campeonato.</p><button class="btn primary" data-publication>Abrir central de publicação</button></div>' : tab === 'historico' ? auditView() : config(); bind(); }
```

Add a `tab === 'gerenciamento' ? managementView() :` branch right before `tab === 'historico'`:

```javascript
  function render() { root.querySelectorAll('[data-tab]').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab)); root.querySelector('[data-categorybar]').innerHTML = categoryBar(); content.innerHTML = tab === 'overview' ? overview() : tab === 'categorias' ? categoriesView() : tab === 'fases' ? fasesView() : tab === 'jogos' ? games() : tab === 'chave' ? bracketView() : tab === 'classif' ? standings() : tab === 'equipes' ? teams() : tab === 'artilharia' ? scorersView() : tab === 'disciplina' ? disciplineView() : tab === 'inscricoes' ? registrationsView() : tab === 'publicacao' ? '<div class="card"><h2>Publicação</h2><p class="muted">Copie os links públicos para divulgar o campeonato.</p><button class="btn primary" data-publication>Abrir central de publicação</button></div>' : tab === 'gerenciamento' ? managementView() : tab === 'historico' ? auditView() : config(); bind(); }
```

- [ ] **Step 5: Add `managementView()`**

Add this function right after `auditView()` (line 111, before `config()`):

```javascript
  function managementView() {
    ensureCollaborators(state);
    if (!isOwner(state, auth.currentUser) && !can(state, auth.currentUser, 'admin')) return '<div class="card"><p class="muted">Sem permissão para gerenciar acessos.</p></div>';
    const rows = state.collaborators.map((c) => `<div class="team-row"><span>${esc(c.email)}</span><select data-mgr-role="${esc(c.id)}">${Object.entries(COLLAB_ROLES).map(([key, meta]) => `<option value="${esc(key)}" ${c.role === key ? 'selected' : ''}>${esc(meta.name)}</option>`).join('')}</select><button class="btn ghost" data-mgr-remove="${esc(c.id)}">Remover</button></div>`).join('') || '<p class="muted">Nenhum colaborador adicionado.</p>';
    return `<div class="card"><h2>Gerenciamento de acesso</h2><p class="muted">Convide pessoas para ajudar a operar este campeonato com um papel específico.</p><div style="margin-top:18px">${rows}</div><div class="row" style="margin-top:12px;gap:8px"><input data-new-mgr-email placeholder="E-mail" type="email" style="flex:1"><select data-new-mgr-role>${Object.entries(COLLAB_ROLES).map(([key, meta]) => `<option value="${esc(key)}">${esc(meta.name)}</option>`).join('')}</select><button class="btn primary" data-add-mgr>+ Convidar</button></div></div>`;
  }
```

- [ ] **Step 6: Wire the tab's event handlers into `bind()`**

Find the end of `bind()`'s body — the last handler block before its closing `}` (the `[data-remove-official]` handler, right before the final `}` that ends `bind()`, line 113). Insert the following right after that `[data-remove-official]` block and before the closing `}` of `bind()`:

```javascript
 const addMgrBtn = root.querySelector('[data-add-mgr]'); if (addMgrBtn) addMgrBtn.onclick = async () => { const emailInput = root.querySelector('[data-new-mgr-email]'); const roleSelect = root.querySelector('[data-new-mgr-role]'); const result = inviteManager(state, auth.currentUser, { email: emailInput.value, role: roleSelect.value }); if (!result.ok) return toast(result.reason); await persist(); await addAudit(state.id, 'collaborator_invited', `Acesso concedido: ${result.collaborator.email}`); render(); }; root.querySelectorAll('[data-mgr-role]').forEach((select) => select.onchange = async () => { const result = changeManagerRole(state, auth.currentUser, select.dataset.mgrRole, select.value); if (!result.ok) return toast(result.reason); await persist(); await addAudit(state.id, 'collaborator_role_changed', 'Papel de colaborador alterado'); render(); }); root.querySelectorAll('[data-mgr-remove]').forEach((button) => button.onclick = async () => { if (!confirm('Remover o acesso deste colaborador?')) return; const result = removeManager(state, auth.currentUser, button.dataset.mgrRemove); if (!result.ok) return toast(result.reason); await persist(); await addAudit(state.id, 'collaborator_removed', 'Acesso de colaborador removido'); render(); });
```

- [ ] **Step 7: Manual smoke check (no page-level test harness exists for `championship.js` — matches every prior phase's page-wiring task)**

Run: `npm run build`
Expected: build succeeds with no errors (catches import typos / syntax errors in the edited file).

Run: `npm test`
Expected: all existing tests plus Task 1's new `collaborators.test.js` pass, nothing regressed.

- [ ] **Step 8: Commit**

```bash
git add src/pages/championship.js
git commit -m "feat: add Gerenciamento tab (invite/remove/change-role) and gate persist() on role"
```

---

## Self-Review Notes (already applied above)

- **Spec coverage:** `inviteManager/removeManager/changeManagerRole/ensureCollaborators/myCollaborator/myRole/roleLabel/can/isOwner` — all ported in Task 1. `COLLAB_ROLES` ported as a named export (was a bare `const` in legacy, not in the phase's function list, but every function depends on it and the UI needs its labels — no placeholder left in its place).
- **Deferred, not forgotten (document in `MIGRATION-PROGRESS.md` after merge):**
  - `isOwner`'s superadmin override — needs Phase 6b's superadmin panel to exist first.
  - Per-action gating beyond the master `persist()` gate (legacy also double-checks inside `setScore`/`saveAthlete` specifically) — `persist()` is the single choke point every mutating handler in `championship.js` already routes through, so gating it once covers every save; a viewer-role user can still *see* input fields and type into them before their save silently no-ops with a toast, rather than having inputs disabled/hidden. Matches this migration's established pattern of shipping the data-correctness gate first and deferring UI polish (see Phase 3d's `yellowLimit` follow-up for precedent).
  - Tabs are not hidden per-role (a viewer sees the "Gerenciamento" tab button but gets a "Sem permissão" card on click) — cheaper diff than conditionally filtering the tab array, consistent with how `auditView`-adjacent legacy code (`viewAuditLog`) also gates inside the render function rather than hiding nav.
- **Placeholder scan:** none — every step has runnable code.
- **Type consistency:** `can(state, user, permission)` signature is identical across Task 1's implementation and every Task 2 call site. `result.collaborator` (from `inviteManager`) and `result.reason` (from all four gated functions) are used consistently.
