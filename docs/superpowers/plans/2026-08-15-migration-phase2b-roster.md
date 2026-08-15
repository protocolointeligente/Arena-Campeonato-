# Migration Phase 2b: Teams & Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an organizer manage each team's full roster (athletes with name/birthdate/number/photo) and a team logo, ported from the legacy monolith and wired into `src/pages/championship.js`'s existing "Equipes" tab.

**Architecture:** Sub-phase 2b of Phase 2, tracked at `docs/superpowers/plans/MIGRATION-PROGRESS.md`. Two rescoping corrections from the original audit, found while reading the actual legacy source before writing this plan (the audit's function→domain grouping was approximate):
- `delT` (`arena-campeonatos-v2-intervencao-19.html:785`) is **not** team deletion — it's the "delete championship" confirmation modal on the home/list screen (`Excluir campeonato?…`, wired to `confDel`). That flow already exists in `src/pages/home.js` (native `confirm()` + `removeChampionship()`), functionally equivalent. Not part of this phase.
- `readAndResizeImage` (`:800`) is used only by `setBrandImage` and `addSponsor` (branding/sponsors, confirmed by grepping every call site) — it belongs with Phase 5, not here. Athlete photos and team logos use the separate, simpler `compressPhoto` (fixed 96×96 square crop), which *is* this phase's scope.
- `renTeam` (`:1041`) needs no new port: `src/pages/championship.js`'s existing "Salvar equipes" flow (Phase-1-era, untouched) already renames teams. Legacy's version additionally syncs a rename into `state.cfg.seedNames` — that array doesn't exist in `src/` yet (it's part of the draw/seeding engine, Phase 3a) — deferred there, tracked in `MIGRATION-PROGRESS.md`.

**Data model addition:** `team.roster: [{id, nome, dob, numero, foto}]`, `team.logo: string`. Both already read defensively elsewhere in the codebase (`team.roster || []` pattern), so this is additive, not a migration.

**Pure vs. DOM split, continuing Phase 1/2a's pattern:** `src/app/roster.js` holds every read/write against `team`/`state` objects, no DOM. `championship.js` adds the roster UI (a modal per team, opened from the "Equipes" tab) using Phase 1's `modal()`/`closeModal()` instead of legacy's `window._ea` global + inline `onclick` pattern.

**Testing limitation, stated up front:** `compressPhoto` decodes an image via `FileReader`/`Image`/`<canvas>`. jsdom (this project's test environment) does not implement real image decoding or 2D canvas rendering — there is no way to unit-test the actual crop/resize pixel output without adding a canvas-polyfill dependency, which is out of proportion to one function. This plan tests only what's genuinely testable without real decoding (the `no file → null` contract) and ports the rest as a close, low-risk transcription of code that has run in legacy production. Full visual verification is a manual/QA item, same class as the "no browser available in this sandbox" gap already logged for Phase 1 and 2a.

**Tech Stack:** Same as Phase 1/2a — vanilla JS ES modules, Vitest.

## Global Constraints

- Legacy source of truth: `arena-campeonatos-v2-intervencao-19.html:678-682, 800(excluded — see above), 896, 922, 1008-1019`.
- Athlete/photo ids use `uid()` from `src/app/utils.js`.
- Mutating functions in `src/app/roster.js` return `{ok: boolean, reason?: string, ...}` rather than calling `toast`/`persist`/`render` directly — same contract style as `src/app/categories.js`'s `removeCategory`. The UI layer (`championship.js`) decides what to do with the result.
- `npm run build`, `npm run verify`, and `npm test` must all succeed after every task.
- No new UI framework — `data-*` attributes + `bind()`, matching the rest of `src/pages/*`.

## File Structure

| File | Responsibility |
|---|---|
| `src/app/roster.js` | Pure functions: `teamById`, `athleteById`, `athName`, `teamNameById`, `addAthlete`, `updateAthlete`, `removeAthlete`, `setAthletePhoto`, `setTeamLogo`, `compressPhoto` — no DOM except `compressPhoto`'s browser-API image decode (documented exception above) |
| `src/app/roster.test.js` | Tests for the above (excluding `compressPhoto`'s image-decode path, per the stated limitation) |
| `src/pages/championship.js` | Modify: `teams()` view gains a roster count + "Elenco" button and a logo picker per team; new roster-modal builder function; `bind()` wires the new buttons |
| `src/styles/layout.css` | Modify: small additions for the roster modal's photo-picker row, reusing existing `.card`/`.btn`/`.muted` primitives where possible |

---

### Task 1: Pure roster functions — `src/app/roster.js`

**Files:**
- Create: `src/app/roster.js`
- Create: `src/app/roster.test.js`

**Interfaces:**
- Consumes: `uid` from `./utils.js`.
- Produces: `teamById(state, id)`, `athleteById(state, athleteId): {athlete, team} | null`, `athName(state, athleteId): string`, `teamNameById(state, id): string | null`, `addAthlete(team, {nome, dob, numero}): {ok, reason?, athlete?}`, `updateAthlete(team, athleteId, {nome, dob, numero}): {ok, reason?, before?, after?}`, `removeAthlete(team, athleteId): {ok}`, `setAthletePhoto(team, athleteId, dataUrl): {ok}`, `setTeamLogo(team, dataUrl): void`, `compressPhoto(file): Promise<string|null>` — imported by Task 2.

- [ ] **Step 1: Write the failing tests**

Create `src/app/roster.test.js`:
```js
import { describe, it, expect } from 'vitest';
import {
  teamById, athleteById, athName, teamNameById,
  addAthlete, updateAthlete, removeAthlete, setAthletePhoto, setTeamLogo, compressPhoto,
} from './roster.js';

function championship() {
  return {
    teams: [
      { id: 't1', nome: 'Equipe A', roster: [{ id: 'a1', nome: 'Ana', dob: '2005-01-01', numero: '10', foto: '' }] },
      { id: 't2', nome: 'Equipe B', roster: [] },
    ],
  };
}

describe('teamById', () => {
  it('finds a team by id', () => { expect(teamById(championship(), 't2').nome).toBe('Equipe B'); });
  it('returns null when not found', () => { expect(teamById(championship(), 'ghost')).toBeNull(); });
});

describe('athleteById', () => {
  it('finds the athlete and its team across all teams', () => {
    const result = athleteById(championship(), 'a1');
    expect(result.athlete.nome).toBe('Ana');
    expect(result.team.id).toBe('t1');
  });
  it('returns null when not found', () => { expect(athleteById(championship(), 'ghost')).toBeNull(); });
});

describe('athName', () => {
  it('returns the athlete name', () => { expect(athName(championship(), 'a1')).toBe('Ana'); });
  it('returns an em dash when not found', () => { expect(athName(championship(), 'ghost')).toBe('—'); });
});

describe('teamNameById', () => {
  it('returns the team name', () => { expect(teamNameById(championship(), 't1')).toBe('Equipe A'); });
  it('returns null when not found', () => { expect(teamNameById(championship(), 'ghost')).toBeNull(); });
});

describe('addAthlete', () => {
  it('appends a trimmed-name athlete with a generated id', () => {
    const team = { id: 't1', nome: 'A', roster: [] };
    const result = addAthlete(team, { nome: '  Bia  ', dob: '2006-02-02', numero: '7' });
    expect(result.ok).toBe(true);
    expect(team.roster).toHaveLength(1);
    expect(team.roster[0]).toMatchObject({ nome: 'Bia', dob: '2006-02-02', numero: '7', foto: '' });
    expect(team.roster[0].id).toBeTruthy();
  });

  it('refuses a blank name without mutating the roster', () => {
    const team = { id: 't1', nome: 'A', roster: [] };
    const result = addAthlete(team, { nome: '   ' });
    expect(result).toEqual({ ok: false, reason: 'Informe o nome.' });
    expect(team.roster).toHaveLength(0);
  });

  it('initializes roster when the team has none yet', () => {
    const team = { id: 't1', nome: 'A' };
    addAthlete(team, { nome: 'Cau' });
    expect(team.roster).toHaveLength(1);
  });
});

describe('updateAthlete', () => {
  it('updates fields and returns before/after snapshots', () => {
    const team = { id: 't1', roster: [{ id: 'a1', nome: 'Old', dob: '', numero: '' }] };
    const result = updateAthlete(team, 'a1', { nome: 'New Name', dob: '2000-01-01', numero: '9' });
    expect(result.ok).toBe(true);
    expect(result.before).toEqual({ id: 'a1', nome: 'Old', dob: '', numero: '' });
    expect(result.after).toMatchObject({ nome: 'New Name', dob: '2000-01-01', numero: '9' });
    expect(team.roster[0].nome).toBe('New Name');
  });

  it('keeps the existing name when a blank name is passed', () => {
    const team = { id: 't1', roster: [{ id: 'a1', nome: 'Kept', dob: '', numero: '' }] };
    updateAthlete(team, 'a1', { nome: '  ', dob: '', numero: '' });
    expect(team.roster[0].nome).toBe('Kept');
  });

  it('refuses when the athlete id does not exist', () => {
    const team = { id: 't1', roster: [] };
    expect(updateAthlete(team, 'ghost', { nome: 'X' })).toEqual({ ok: false, reason: 'Atleta não encontrado.' });
  });
});

describe('removeAthlete', () => {
  it('removes the athlete', () => {
    const team = { id: 't1', roster: [{ id: 'a1', nome: 'A' }, { id: 'a2', nome: 'B' }] };
    const result = removeAthlete(team, 'a1');
    expect(result).toEqual({ ok: true });
    expect(team.roster.map((a) => a.id)).toEqual(['a2']);
  });

  it('reports ok:false when the id does not exist, without mutating the roster', () => {
    const team = { id: 't1', roster: [{ id: 'a1', nome: 'A' }] };
    const result = removeAthlete(team, 'ghost');
    expect(result).toEqual({ ok: false });
    expect(team.roster).toHaveLength(1);
  });
});

describe('setAthletePhoto', () => {
  it('sets the photo data URL', () => {
    const team = { id: 't1', roster: [{ id: 'a1', nome: 'A', foto: '' }] };
    const result = setAthletePhoto(team, 'a1', 'data:image/jpeg;base64,xyz');
    expect(result).toEqual({ ok: true });
    expect(team.roster[0].foto).toBe('data:image/jpeg;base64,xyz');
  });

  it('reports ok:false when the athlete id does not exist', () => {
    const team = { id: 't1', roster: [] };
    expect(setAthletePhoto(team, 'ghost', 'data:x')).toEqual({ ok: false });
  });
});

describe('setTeamLogo', () => {
  it('sets the team logo', () => {
    const team = { id: 't1', nome: 'A' };
    setTeamLogo(team, 'data:image/jpeg;base64,logo');
    expect(team.logo).toBe('data:image/jpeg;base64,logo');
  });
});

describe('compressPhoto', () => {
  it('resolves to null when no file is given', async () => {
    await expect(compressPhoto(null)).resolves.toBeNull();
  });
  // Real image decode/canvas-crop behavior is NOT unit-tested here: jsdom has
  // no image decoder or 2D canvas renderer. See this plan's Architecture
  // section — manual/browser verification is the accepted gap, same class
  // as Phase 1/2a's "no browser in this sandbox" limitation.
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- roster`
Expected: FAIL — `Cannot find module './roster.js'`.

- [ ] **Step 3: Implement `src/app/roster.js`**

Adapted from legacy `teamById`/`athleteById`/`athName`/`teamNameById`(`:678-680,896` — plain-value return instead of legacy's escaped-HTML-with-fallback-markup return, since `esc()` and fallback markup are UI concerns handled in Task 2, matching Phase 1/2a's pure-data convention)/`addAthlete`/`editAthlete`+`saveAthlete` (merged into one `updateAthlete`, since this port replaces legacy's `window._ea` global-state two-step with a single call taking an explicit `athleteId`)/`delAthlete`/`eaPhoto`'s photo-assignment half (the file-picker DOM half moves to Task 2)/`pickLogo`'s logo-assignment half/`compressPhoto` (`:682`, converted from callback to Promise — every other async operation in `src/` uses Promises, and this makes the `no file` case explicit rather than relying on every call site to guard it):

```js
import { uid } from './utils.js';

export function teamById(state, id) {
  return (state.teams || []).find((team) => team.id === id) || null;
}

export function athleteById(state, athleteId) {
  for (const team of state.teams || []) {
    const athlete = (team.roster || []).find((item) => item.id === athleteId);
    if (athlete) return { athlete, team };
  }
  return null;
}

export function athName(state, athleteId) {
  const result = athleteById(state, athleteId);
  return result ? result.athlete.nome : '—';
}

export function teamNameById(state, id) {
  const team = teamById(state, id);
  return team ? team.nome : null;
}

export function addAthlete(team, { nome, dob, numero }) {
  const trimmed = (nome || '').trim();
  if (!trimmed) return { ok: false, reason: 'Informe o nome.' };
  team.roster = team.roster || [];
  const athlete = { id: uid(), nome: trimmed, dob: (dob || '').trim(), numero: (numero || '').trim(), foto: '' };
  team.roster.push(athlete);
  return { ok: true, athlete };
}

export function updateAthlete(team, athleteId, { nome, dob, numero }) {
  const athlete = (team.roster || []).find((item) => item.id === athleteId);
  if (!athlete) return { ok: false, reason: 'Atleta não encontrado.' };
  const before = { ...athlete };
  athlete.nome = (nome || athlete.nome).trim();
  athlete.dob = (dob || '').trim();
  athlete.numero = (numero || '').trim();
  return { ok: true, before, after: { ...athlete } };
}

export function removeAthlete(team, athleteId) {
  const before = (team.roster || []).length;
  team.roster = (team.roster || []).filter((item) => item.id !== athleteId);
  return { ok: team.roster.length < before };
}

export function setAthletePhoto(team, athleteId, dataUrl) {
  const athlete = (team.roster || []).find((item) => item.id === athleteId);
  if (!athlete) return { ok: false };
  athlete.foto = dataUrl;
  return { ok: true };
}

export function setTeamLogo(team, dataUrl) {
  team.logo = dataUrl;
}

export function compressPhoto(file) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 96;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve(null);
      img.src = reader.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- roster`
Expected: `18 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/app/roster.js src/app/roster.test.js
git commit -m "feat: port roster data model (athlete CRUD, team logo, compressPhoto) from legacy"
```

---

### Task 2: Wire roster management into `src/pages/championship.js`

**Files:**
- Modify: `src/pages/championship.js`
- Modify: `src/styles/layout.css`

**Interfaces:**
- Consumes: `teamById`, `addAthlete`, `updateAthlete`, `removeAthlete`, `setAthletePhoto`, `setTeamLogo`, `compressPhoto` from `../app/roster.js`; `modal`, `closeModal`, `toast` from `../app/ui.js` (Phase 1).

No new automated tests — same rationale as Phase 2a Task 2 (Task 1's suite covers the logic; this is DOM wiring). Same "no live browser in this sandbox" fallback: verify by inspection, report `DONE_WITH_CONCERNS` if a real check isn't possible.

- [ ] **Step 1: Add the import**

Add to the existing import block in `src/pages/championship.js`:
```js
import { teamById, addAthlete, updateAthlete, removeAthlete, setAthletePhoto, setTeamLogo, compressPhoto } from '../app/roster.js';
```

- [ ] **Step 2: Show roster count, a logo picker, and an "Elenco" button per team**

In the `teams()` view function, change the per-team row template from:
```js
${(state.teams || []).map((team, index) => `<div class="team-row"><span>${index + 1}</span><input data-team="${esc(team.id)}" value="${esc(team.nome)}"><button class="btn ghost" data-remove-team="${esc(team.id)}">Remover</button></div>`).join('') || '<p class="muted">Nenhuma equipe cadastrada.</p>'}
```
to:
```js
${(state.teams || []).map((team, index) => `<div class="team-row">${team.logo ? `<img class="miniphoto" data-pick-logo="${esc(team.id)}" src="${team.logo}" style="width:28px;height:28px;border-radius:5px;object-fit:cover;cursor:pointer">` : `<span data-pick-logo="${esc(team.id)}" style="cursor:pointer">${index + 1}</span>`}<input data-team="${esc(team.id)}" value="${esc(team.nome)}"><button class="btn ghost" data-roster="${esc(team.id)}">Elenco (${(team.roster || []).length})</button><button class="btn ghost" data-remove-team="${esc(team.id)}">Remover</button></div>`).join('') || '<p class="muted">Nenhuma equipe cadastrada.</p>'}
```

- [ ] **Step 3: Add the roster-modal builder**

Add a new function alongside the other view functions:
```js
function rosterModal(teamId) {
  const team = teamById(state, teamId);
  if (!team) return;
  team.roster = team.roster || [];
  modal(`<h3>Elenco — ${esc(team.nome)}</h3><div style="margin-top:12px">${team.roster.map((athlete) => `<div class="team-row"><span>${athlete.foto ? `<img class="miniphoto" src="${athlete.foto}" style="width:28px;height:28px;border-radius:50%;object-fit:cover">` : '👤'}</span><input data-athlete-name="${esc(athlete.id)}" value="${esc(athlete.nome)}" placeholder="Nome"><input type="number" data-athlete-numero="${esc(athlete.id)}" value="${esc(athlete.numero || '')}" placeholder="Nº" style="width:70px"><button class="btn ghost sm" data-athlete-photo="${esc(athlete.id)}">📷</button><button class="btn ghost sm" data-athlete-remove="${esc(athlete.id)}">🗑</button></div>`).join('') || '<p class="muted">Nenhum atleta cadastrado.</p>'}</div><div class="row" style="margin-top:12px;gap:8px"><input data-new-athlete-name placeholder="Nome do novo atleta" style="flex:1"><button class="btn primary" data-add-athlete="${esc(team.id)}">+ Adicionar</button></div><div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn ghost" data-close-modal>Fechar</button></div>`);
}
```

- [ ] **Step 4: Wire the new handlers in `bind()`**

Add inside `bind()` (alongside the existing team handlers):
```js
root.querySelectorAll('[data-roster]').forEach((button) => button.onclick = () => rosterModal(button.dataset.roster));
root.querySelectorAll('[data-pick-logo]').forEach((el) => el.onclick = () => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = async () => { const file = input.files[0]; if (!file) return; const dataUrl = await compressPhoto(file); if (!dataUrl) return toast('Falha na imagem'); setTeamLogo(teamById(state, el.dataset.pickLogo), dataUrl); await persist(); render(); }; input.click(); });
```

Inside `rosterModal(teamId)`, wire its own controls right after the `modal(...)` call (the modal's DOM is now in `#modalBox`, query within it):
```js
function rosterModal(teamId) {
  const team = teamById(state, teamId);
  if (!team) return;
  team.roster = team.roster || [];
  modal(`...`); // unchanged from Step 3
  const box = document.getElementById('modalBox');
  box.querySelector('[data-close-modal]').onclick = () => closeModal();
  box.querySelectorAll('[data-athlete-name]').forEach((input) => input.onchange = async () => { updateAthlete(team, input.dataset.athleteName, { nome: input.value, dob: '', numero: box.querySelector(`[data-athlete-numero="${input.dataset.athleteName}"]`).value }); await persist(); await addAudit(state.id, 'athlete_updated', 'Atleta atualizado'); render(); });
  box.querySelectorAll('[data-athlete-numero]').forEach((input) => input.onchange = async () => { updateAthlete(team, input.dataset.athleteNumero, { nome: box.querySelector(`[data-athlete-name="${input.dataset.athleteNumero}"]`).value, dob: '', numero: input.value }); await persist(); await addAudit(state.id, 'athlete_updated', 'Atleta atualizado'); render(); });
  box.querySelectorAll('[data-athlete-remove]').forEach((button) => button.onclick = async () => { removeAthlete(team, button.dataset.athleteRemove); await persist(); await addAudit(state.id, 'athlete_removed', 'Atleta removido'); rosterModal(teamId); });
  box.querySelectorAll('[data-athlete-photo]').forEach((button) => button.onclick = () => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = async () => { const file = input.files[0]; if (!file) return; const dataUrl = await compressPhoto(file); if (!dataUrl) return toast('Falha na imagem'); setAthletePhoto(team, button.dataset.athletePhoto, dataUrl); await persist(); rosterModal(teamId); }; input.click(); });
  const addButton = box.querySelector('[data-add-athlete]');
  if (addButton) addButton.onclick = async () => { const nameInput = box.querySelector('[data-new-athlete-name]'); const result = addAthlete(team, { nome: nameInput.value }); if (!result.ok) return toast(result.reason); await persist(); await addAudit(state.id, 'athlete_added', `Atleta adicionado: ${result.athlete.nome}`); rosterModal(teamId); };
}
```

(This function is now fully self-contained — building the modal HTML and wiring its own controls — so it doesn't need a slot in the page-level `render()`/`bind()` cycle; it's only invoked from the `[data-roster]` click handler and re-invoked by itself after any mutation, exactly like legacy's `editAthlete`/`saveAthlete` re-opening via `renderManage()`.)

Replace the single-function version from Step 3 with this complete one (Step 3's snippet was the HTML-building half only, shown separately for readability — implement it as one function).

- [ ] **Step 5: Add the CSS**

Append to `src/styles/layout.css` if `.miniphoto` isn't already covering this (check first — the legacy CSS class `.miniphoto` may need porting; if it's absent, add):
```css
.miniphoto { display: inline-block; vertical-align: middle; }
```

- [ ] **Step 6: Run the full test suite and build**

Run: `npm test`
Expected: all tests pass (Phase 1 + 2a's 41 + Task 1's 18 = 59).

Run: `npm run build && npm run verify`
Expected: both succeed.

- [ ] **Step 7: Manual smoke check (best-effort, same fallback as prior phases)**

If a live browser is reachable: open a championship, "Equipes" tab, click "Elenco" on a team, add an athlete, confirm it appears with a working "Nº" field, remove it, pick a team logo image and confirm the thumbnail updates.

If not reachable, skip and report `DONE_WITH_CONCERNS`, verified by inspection instead.

- [ ] **Step 8: Commit**

```bash
git add src/pages/championship.js src/styles/layout.css
git commit -m "feat: wire roster management (athletes, photos, team logo) into championship Equipes tab"
```

---

## Self-Review

**Spec coverage** — `addAthlete`, `delAthlete`→`removeAthlete`, `editAthlete`+`saveAthlete`→`updateAthlete`, `athleteById`, `athName`, `eaPhoto`→`setAthletePhoto`+file-picker wiring, `compressPhoto`, `pickLogo`→`setTeamLogo`+file-picker wiring, `teamById`, `teamNameById`, `teamLogoMini`→inline logo thumbnail in the team row — all covered. `delT` and `readAndResizeImage` are explicitly rescoped out (see Architecture section) with a stated reason, not silently dropped. `renTeam` needs no new work (existing flow already covers it); its `seedNames` half is tracked as a Phase 3a follow-up.

**Placeholder scan** — no TBD/TODO; every step has literal code.

**Type consistency** — function names/signatures match between Task 1's exports and Task 2's call sites.
