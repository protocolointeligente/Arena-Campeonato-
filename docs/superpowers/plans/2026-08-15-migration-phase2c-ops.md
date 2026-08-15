# Migration Phase 2c: Venues, Officials & Team Staff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an organizer maintain a championship-wide pool of venues and match officials, and let each team record its technical staff (coach, assistant, physical trainer, doctor) — ported from legacy and wired into `src/pages/championship.js`.

**Architecture:** Sub-phase 2c of Phase 2, tracked at `docs/superpowers/plans/MIGRATION-PROGRESS.md`. Legacy source: `arena-campeonatos-v2-intervencao-19.html:930-942` (`ensureOps`/`venueById`/`officialById`/`addVenue`/`delVenue`/`addOfficial`/`delOfficial`) and `:1000-1021` (`staffRow`/`setStaff`, four fixed roles — `tecnico`, `auxiliar`, `preparador`, `medico` — read at `:1000-1003`).

Two distinct data shapes, both small:
- **Venues/officials** are championship-wide lists (`state.venues: [{id,name,address}]`, `state.officials: [{id,name,role,phone}]`) — used later by Phase 3b's match-scheduling UI (`openMatchOps`), which isn't built yet. This phase ships CRUD + a management view only; wiring them into match scheduling is Phase 3b's job.
- **Team staff** (`team.staff: {tecnico,auxiliar,preparador,medico}`) is per-team, and legacy renders it right inside the team's roster view (`:997-1003`, immediately after the athlete list) — so this phase adds a "Comissão técnica" section to the roster modal Phase 2b already built, the natural, legacy-matching placement.

**Pure vs. DOM split**, continuing the established pattern: `src/app/ops.js` holds all data mutation, no DOM. `championship.js`'s `config()` view gets a venues/officials management card (a natural fit — `config()` is already the championship-wide settings tab); `rosterModal` (Phase 2b) gets the four staff rows.

**Tech Stack:** Same as prior phases — vanilla JS ES modules, Vitest.

## Global Constraints

- Legacy source of truth: `arena-campeonatos-v2-intervencao-19.html:930-942, 997-1003, 1020-1021`.
- Venue/official ids use `uid()` from `src/app/utils.js`.
- Mutating functions return `{ok, reason?, ...}`, matching `src/app/categories.js`/`src/app/roster.js`'s established contract.
- `npm run build`, `npm run verify`, `npm test` must all succeed after every task.
- No new UI framework — `data-*` + `bind()`.

## File Structure

| File | Responsibility |
|---|---|
| `src/app/ops.js` | Pure functions: `ensureOps`, `venueById`, `officialById`, `addVenue`, `removeVenue`, `addOfficial`, `removeOfficial`, `setTeamStaff`, plus the exported `STAFF_ROLES` constant — no DOM |
| `src/app/ops.test.js` | Tests for the above |
| `src/pages/championship.js` | Modify: `ensureOps(state)` on mount; `config()` gains a venues/officials card; `rosterModal` gains a "Comissão técnica" section; `bind()`/the modal's own wiring gain the new handlers |
| `src/styles/layout.css` | Modify: small additions for the staff rows and venue/official list rows, reusing `.team-row`/`.card`/`.muted` where possible |

---

### Task 1: Pure ops functions — `src/app/ops.js`

**Files:**
- Create: `src/app/ops.js`
- Create: `src/app/ops.test.js`

**Interfaces:**
- Consumes: `uid` from `./utils.js`.
- Produces: `STAFF_ROLES: [key,label][]`, `ensureOps(state): state`, `venueById(state, id)`, `officialById(state, id)`, `addVenue(state, {name, address}): {ok, reason?, venue?}`, `removeVenue(state, id): {ok}`, `addOfficial(state, {name, role, phone}): {ok, reason?, official?}`, `removeOfficial(state, id): {ok}`, `setTeamStaff(team, key, value): {ok}` — imported by Task 2.

- [ ] **Step 1: Write the failing tests**

Create `src/app/ops.test.js`:
```js
import { describe, it, expect } from 'vitest';
import {
  STAFF_ROLES, ensureOps, venueById, officialById,
  addVenue, removeVenue, addOfficial, removeOfficial, setTeamStaff,
} from './ops.js';

describe('STAFF_ROLES', () => {
  it('lists the four legacy roles in order', () => {
    expect(STAFF_ROLES).toEqual([
      ['tecnico', 'Técnico'],
      ['auxiliar', 'Auxiliar técnico'],
      ['preparador', 'Preparador físico'],
      ['medico', 'Médico / Fisioterapeuta'],
    ]);
  });
});

describe('ensureOps', () => {
  it('initializes venues and officials as empty arrays when absent', () => {
    const state = {};
    ensureOps(state);
    expect(state.venues).toEqual([]);
    expect(state.officials).toEqual([]);
  });

  it('leaves existing arrays untouched', () => {
    const state = { venues: [{ id: 'v1' }], officials: [{ id: 'o1' }] };
    ensureOps(state);
    expect(state.venues).toEqual([{ id: 'v1' }]);
    expect(state.officials).toEqual([{ id: 'o1' }]);
  });
});

describe('venueById / officialById', () => {
  it('finds by id, returns null when missing', () => {
    const state = { venues: [{ id: 'v1', name: 'Ginásio' }], officials: [{ id: 'o1', name: 'João' }] };
    expect(venueById(state, 'v1').name).toBe('Ginásio');
    expect(venueById(state, 'ghost')).toBeNull();
    expect(officialById(state, 'o1').name).toBe('João');
    expect(officialById(state, 'ghost')).toBeNull();
  });
});

describe('addVenue', () => {
  it('appends a trimmed venue with a generated id', () => {
    const state = { venues: [] };
    const result = addVenue(state, { name: '  Ginásio Central  ', address: 'Rua A, 100' });
    expect(result.ok).toBe(true);
    expect(state.venues).toHaveLength(1);
    expect(state.venues[0]).toMatchObject({ name: 'Ginásio Central', address: 'Rua A, 100' });
    expect(state.venues[0].id).toBeTruthy();
  });

  it('refuses a blank name without mutating', () => {
    const state = { venues: [] };
    const result = addVenue(state, { name: '   ' });
    expect(result).toEqual({ ok: false, reason: 'Informe o nome do local.' });
    expect(state.venues).toHaveLength(0);
  });

  it('initializes venues when absent', () => {
    const state = {};
    addVenue(state, { name: 'Quadra 1' });
    expect(state.venues).toHaveLength(1);
  });
});

describe('removeVenue', () => {
  it('removes by id', () => {
    const state = { venues: [{ id: 'v1' }, { id: 'v2' }] };
    expect(removeVenue(state, 'v1')).toEqual({ ok: true });
    expect(state.venues.map((v) => v.id)).toEqual(['v2']);
  });

  it('reports ok:false for an unknown id, without mutating', () => {
    const state = { venues: [{ id: 'v1' }] };
    expect(removeVenue(state, 'ghost')).toEqual({ ok: false });
    expect(state.venues).toHaveLength(1);
  });
});

describe('addOfficial', () => {
  it('appends a trimmed official with a generated id', () => {
    const state = { officials: [] };
    const result = addOfficial(state, { name: '  Maria  ', role: 'Árbitra', phone: '11999999999' });
    expect(result.ok).toBe(true);
    expect(state.officials[0]).toMatchObject({ name: 'Maria', role: 'Árbitra', phone: '11999999999' });
  });

  it('refuses a blank name', () => {
    const state = { officials: [] };
    expect(addOfficial(state, { name: '' })).toEqual({ ok: false, reason: 'Informe o nome do oficial.' });
  });
});

describe('removeOfficial', () => {
  it('removes by id', () => {
    const state = { officials: [{ id: 'o1' }, { id: 'o2' }] };
    expect(removeOfficial(state, 'o1')).toEqual({ ok: true });
    expect(state.officials.map((o) => o.id)).toEqual(['o2']);
  });

  it('reports ok:false for an unknown id', () => {
    const state = { officials: [{ id: 'o1' }] };
    expect(removeOfficial(state, 'ghost')).toEqual({ ok: false });
  });
});

describe('setTeamStaff', () => {
  it('sets a trimmed value under the given role key', () => {
    const team = {};
    const result = setTeamStaff(team, 'tecnico', '  Carlos Silva  ');
    expect(result).toEqual({ ok: true });
    expect(team.staff).toEqual({ tecnico: 'Carlos Silva' });
  });

  it('initializes staff when absent and preserves other keys', () => {
    const team = { staff: { auxiliar: 'Ana' } };
    setTeamStaff(team, 'medico', 'Dr. Paulo');
    expect(team.staff).toEqual({ auxiliar: 'Ana', medico: 'Dr. Paulo' });
  });

  it('reports ok:false for a null team', () => {
    expect(setTeamStaff(null, 'tecnico', 'X')).toEqual({ ok: false });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- ops`
Expected: FAIL — `Cannot find module './ops.js'`.

- [ ] **Step 3: Implement `src/app/ops.js`**

Adapted from legacy `ensureOps`/`venueById`/`officialById`/`addVenue`/`delVenue`/`addOfficial`/`delOfficial` (`:930-942`) and `setStaff` (`:1021`), converted to the `{ok, ...}` return contract; `STAFF_ROLES` extracted from the four `staffRow(...)` call sites at `:1000-1003`:

```js
import { uid } from './utils.js';

export const STAFF_ROLES = [
  ['tecnico', 'Técnico'],
  ['auxiliar', 'Auxiliar técnico'],
  ['preparador', 'Preparador físico'],
  ['medico', 'Médico / Fisioterapeuta'],
];

export function ensureOps(state) {
  state.venues = Array.isArray(state.venues) ? state.venues : [];
  state.officials = Array.isArray(state.officials) ? state.officials : [];
  return state;
}

export function venueById(state, id) {
  return (state.venues || []).find((venue) => venue.id === id) || null;
}

export function officialById(state, id) {
  return (state.officials || []).find((official) => official.id === id) || null;
}

export function addVenue(state, { name, address }) {
  const trimmed = (name || '').trim();
  if (!trimmed) return { ok: false, reason: 'Informe o nome do local.' };
  state.venues = state.venues || [];
  const venue = { id: uid(), name: trimmed, address: (address || '').trim() };
  state.venues.push(venue);
  return { ok: true, venue };
}

export function removeVenue(state, id) {
  const before = (state.venues || []).length;
  state.venues = (state.venues || []).filter((venue) => venue.id !== id);
  return { ok: state.venues.length < before };
}

export function addOfficial(state, { name, role, phone }) {
  const trimmed = (name || '').trim();
  if (!trimmed) return { ok: false, reason: 'Informe o nome do oficial.' };
  state.officials = state.officials || [];
  const official = { id: uid(), name: trimmed, role: (role || '').trim(), phone: (phone || '').trim() };
  state.officials.push(official);
  return { ok: true, official };
}

export function removeOfficial(state, id) {
  const before = (state.officials || []).length;
  state.officials = (state.officials || []).filter((official) => official.id !== id);
  return { ok: state.officials.length < before };
}

export function setTeamStaff(team, key, value) {
  if (!team) return { ok: false };
  team.staff = team.staff || {};
  team.staff[key] = (value || '').trim();
  return { ok: true };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- ops`
Expected: `17 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/app/ops.js src/app/ops.test.js
git commit -m "feat: port venues/officials/team-staff data model from legacy"
```

---

### Task 2: Wire venues/officials and team staff into `src/pages/championship.js`

**Files:**
- Modify: `src/pages/championship.js`
- Modify: `src/styles/layout.css`

**Interfaces:**
- Consumes: `STAFF_ROLES`, `ensureOps`, `addVenue`, `removeVenue`, `addOfficial`, `removeOfficial`, `setTeamStaff` from `../app/ops.js`.

No new automated tests (DOM wiring; Task 1's suite covers the logic). Same "no live browser in this sandbox" fallback as prior phases — verify by inspection, report `DONE_WITH_CONCERNS` if so.

- [ ] **Step 1: Add the import and call `ensureOps` on mount**

Add to the import block:
```js
import { STAFF_ROLES, ensureOps, addVenue, removeVenue, addOfficial, removeOfficial, setTeamStaff } from '../app/ops.js';
```

In `mount()`, alongside the existing `ensureCategories(state); loadCategoryIntoRoot(state, activeCategory(state));` line, add:
```js
ensureOps(state);
```

- [ ] **Step 2: Add a venues/officials card to `config()`**

In the `config()` view function, append (inside the same returned template, after the existing branding-color field, before the closing `</div>` of the settings card — or as a second `<div class="card">` sibling, matching how other tabs already stack multiple cards):
```js
<div class="card" style="margin-top:16px"><h2>Locais</h2>${(state.venues || []).map((venue) => `<div class="team-row"><span>📍</span><span style="flex:1">${esc(venue.name)}${venue.address ? ` <span class="muted">· ${esc(venue.address)}</span>` : ''}</span><button class="btn ghost" data-remove-venue="${esc(venue.id)}">Remover</button></div>`).join('') || '<p class="muted">Nenhum local cadastrado.</p>'}<div class="row" style="margin-top:12px;gap:8px"><input data-new-venue-name placeholder="Nome do local" style="flex:1"><input data-new-venue-address placeholder="Endereço (opcional)" style="flex:1"><button class="btn primary" data-add-venue>+ Adicionar</button></div></div><div class="card" style="margin-top:16px"><h2>Árbitros e mesários</h2>${(state.officials || []).map((official) => `<div class="team-row"><span>🧑‍⚖️</span><span style="flex:1">${esc(official.name)}${official.role ? ` <span class="muted">· ${esc(official.role)}</span>` : ''}</span><button class="btn ghost" data-remove-official="${esc(official.id)}">Remover</button></div>`).join('') || '<p class="muted">Nenhum oficial cadastrado.</p>'}<div class="row" style="margin-top:12px;gap:8px"><input data-new-official-name placeholder="Nome" style="flex:1"><input data-new-official-role placeholder="Função" style="width:140px"><button class="btn primary" data-add-official>+ Adicionar</button></div></div>
```
(Note: since `.team-row` here has 2 children — an icon `<span>` and the flexible name `<span>` — plus a remove button, that's 3 children, fitting the `.team-row` grid without repeating Phase 2b's overflow bug. Confirm this before implementing — count the children in what you actually write.)

- [ ] **Step 3: Wire the venue/official handlers in `bind()`**

```js
const addVenueBtn = root.querySelector('[data-add-venue]'); if (addVenueBtn) addVenueBtn.onclick = async () => { const nameInput = root.querySelector('[data-new-venue-name]'); const addrInput = root.querySelector('[data-new-venue-address]'); const result = addVenue(state, { name: nameInput.value, address: addrInput.value }); if (!result.ok) return toast(result.reason); await persist(); await addAudit(state.id, 'venue_added', `Local adicionado: ${result.venue.name}`); render(); };
root.querySelectorAll('[data-remove-venue]').forEach((button) => button.onclick = async () => { removeVenue(state, button.dataset.removeVenue); await persist(); await addAudit(state.id, 'venue_removed', 'Local removido'); render(); });
const addOfficialBtn = root.querySelector('[data-add-official]'); if (addOfficialBtn) addOfficialBtn.onclick = async () => { const nameInput = root.querySelector('[data-new-official-name]'); const roleInput = root.querySelector('[data-new-official-role]'); const result = addOfficial(state, { name: nameInput.value, role: roleInput.value }); if (!result.ok) return toast(result.reason); await persist(); await addAudit(state.id, 'official_added', `Oficial adicionado: ${result.official.name}`); render(); };
root.querySelectorAll('[data-remove-official]').forEach((button) => button.onclick = async () => { removeOfficial(state, button.dataset.removeOfficial); await persist(); await addAudit(state.id, 'official_removed', 'Oficial removido'); render(); });
```

- [ ] **Step 4: Add a "Comissão técnica" section to `rosterModal` (Phase 2b)**

In `rosterModal`'s built HTML (inside the `modal(...)` call), after the athlete list section and before the "add athlete" row, insert:
```js
<h3 style="margin-top:18px">Comissão técnica</h3><div style="margin-top:8px">${STAFF_ROLES.map(([key, label]) => `<div class="team-row"><span style="flex:1">${esc(label)}</span><input data-staff="${esc(team.id)}:${key}" value="${esc((team.staff || {})[key] || '')}" placeholder="Nome" style="flex:1"></div>`).join('')}</div>
```
Then in `rosterModal`'s own wiring block (alongside its other `box.querySelectorAll(...)` handlers), add:
```js
box.querySelectorAll('[data-staff]').forEach((input) => input.onchange = async () => { const [staffTeamId, key] = input.dataset.staff.split(':'); setTeamStaff(teamById(state, staffTeamId), key, input.value); await persist(); render(); });
```
(Follow the rename-handler precedent from Phase 2a/2b's fix — do NOT call `rosterModal(teamId)` again after this save, since that would steal input focus the same way the category-rename bug did; a background `render()` alone is enough to keep the rest of the page in sync, and the staff input already shows what the user typed.)

- [ ] **Step 5: Add any missing CSS**

Check `src/styles/layout.css` for what's already present (`.team-row`, `.row`, `.card`, `.muted` all exist from prior phases). If the venues/officials/staff rows render correctly with existing classes (per the 3-children-fits-the-grid note in Step 2), no new CSS should be needed — confirm by counting children in every new `.team-row` usage before concluding no CSS change is required. If a genuine new visual need turns up, add the minimal rule for it here.

- [ ] **Step 6: Run the full test suite and build**

Run: `npm test`
Expected: all tests pass (62 + 17 = 79).

Run: `npm run build && npm run verify`
Expected: both succeed.

- [ ] **Step 7: Manual smoke check (best-effort, same fallback as prior phases)**

If reachable: open a championship, "Configurações" tab, add a venue and an official, remove one of each; open a team's "Elenco" modal, fill in a "Técnico" name, confirm it saves without losing focus.

If not reachable, skip, verify by inspection, report `DONE_WITH_CONCERNS`.

- [ ] **Step 8: Commit**

```bash
git add src/pages/championship.js src/styles/layout.css
git commit -m "feat: wire venues/officials management and team staff into championship Configurações and Elenco"
```

---

## Self-Review

**Spec coverage** — `addVenue`, `delVenue`→`removeVenue`, `venueById`, `addOfficial`, `delOfficial`→`removeOfficial`, `officialById`, `staffRow`→rendered inline in `rosterModal` (a UI-layer template, not a standalone port — matches the pure/DOM split already established), `setStaff`→`setTeamStaff` — all covered.

**Placeholder scan** — no TBD/TODO; every step has literal code.

**Type consistency** — names/signatures match between Task 1 exports and Task 2 call sites.
