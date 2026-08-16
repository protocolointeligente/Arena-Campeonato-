# Migration Phase 3b: Matches & Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give organizers a real match-scoring workflow for `liga`/`grupos`/`gxg` phases — instant score entry with an audit trail (matching every other tab's established pattern, replacing the Jogos tab's current bulk "Salvar resultados" button), a "Dados da partida" modal to schedule date/time/venue/referee/table-official/status/notes (finally wiring `venueById`/`officialById` from Phase 2c to a real caller), and a "Zerar resultados" reset action.

**Architecture:** Sub-phase 3b of Phase 3, tracked at `docs/superpowers/plans/MIGRATION-PROGRESS.md`. Legacy source: `arena-campeonatos-v2-intervencao-19.html:933-948` (`matchMeta`/`fmtDateBR`/`metaLine`/`openMatchOps`/`saveMatchOps`/`matchRow`/`setScore`) and `:1066` (`clearResults`).

**Rescope vs. the published audit:**
- `tieObj`/`resolveTie` already landed in Phase 3a (pulled forward there because the bracket engine needed them). `setTie`/`tieHTML` are already functionally covered by 3a's `[data-tie-score]` handler/`tieRow()` — this phase doesn't touch bracket ties at all (legacy's own `openMatchOps`/`saveMatchOps` never did either — they operate on `state.matches` only, never `state.bracket`).
- `matchEvents` is a one-line getter (`m.events||[]`) with no real caller until Phase 4 builds the goal/card-entry UI (`sumulaModal` — not in any Phase 3 scope). Not exported this phase — YAGNI, nothing to call it yet.
- `matchContext` is only consumed by Phase 4's `printSumula`/`sumulaModal`. Deferred with them.
- `h2h` is `computeStandings`'s tiny internal helper (Phase 3c) — shipping it split across two phases adds no value; it lands with `computeStandings` in 3c.
- `mark` is a DOM helper for the legacy creation-wizard's seed-picker chips (`.pchip`) — same "creation wizard, not this flow" exclusion Phase 3a already applied to `toggleSeed`/`refreshSeeds`.
- `nextMatchesCard` needs `suspensionInfo` (Phase 3d, disciplinary suspensions) as a direct dependency — deferred until 3d exists.
- `allMatchObjs` has no caller in any Phase 3 scope (its legacy callers are Phase 4's export/report functions) — deferred until something needs it.

**Fixing latent legacy issues, not reproducing them:**
- `splitInfo`'s last line (`parts.slice(2).join(' · ')||(parts.length<3?(parts[1]?'':parts[1]):'')`) is dead/self-contradicting legacy code — the fallback expression always evaluates to an empty-ish value no matter its inputs. Ported as `parts.slice(2).join(' · ') || ''`, which is what that line actually ever produced.

**Data model note:** `match.meta` (date/time/venueId/refereeId/tableOfficialId/status/notes) is a new lazily-created object on each match, exactly mirroring legacy's shape. `match.info` (already an existing field on every match from `buildFixtures`/`buildGxg`, Phase 2d) becomes a computed display string (`metaLine`) written whenever `match.meta` is saved — same dual-field approach as legacy, needed for compatibility with the still-shipping legacy monolith's data (a match saved by legacy may already carry a free-text `info` string; `matchMeta`'s one-time migration parses it into structured fields the first time this code touches that match).

**Pure vs. DOM split**, continuing the established pattern: `src/app/matches.js` holds all data mutation, no DOM. `championship.js`'s `games()` view and `bind()` gain the instant-score wiring and the new "Dados da partida" modal; `config()` gains "Zerar resultados".

**Tech Stack:** Same as prior phases — vanilla JS ES modules, Vitest.

## Global Constraints

- Legacy source of truth: `arena-campeonatos-v2-intervencao-19.html:930-948, 1066, 1152-1156`.
- Mutating functions return `{ok, reason?, ...}`; pure getters return plain values — matching every prior phase's contract.
- `npm run build`, `npm run verify`, `npm test` must all succeed after every task.
- No new UI framework — `data-*` + `bind()`.
- **Every new/changed `class="..."` must be checked against `layout.css`/`tokens.css`**, for both the class's own rule and any descendant-selector rule (standing instruction since Phase 2d). `.tag` has NO rule anywhere in `src/styles/` (a pre-existing gap from before this migration, already used unstyled in `registrationsView`) — do not add a NEW use of `.tag` in this phase; render status text as plain `<span class="muted">` content instead. `<textarea>` is not covered by any existing selector (`.row input,select,input[type=color]` never includes it) — a `<textarea>` needs an explicit inline `style` for border/background/color/border-radius/padding, matching the values already used by the covered inputs (`border:1px solid var(--line);background:var(--surface-muted);color:var(--text);border-radius:8px;padding:10px`).

## File Structure

| File | Responsibility |
|---|---|
| `src/app/matches.js` | Pure functions: `matchMeta`, `splitInfo`, `metaLine`, `setScore`, `saveMatchOps`, `clearResults` — no DOM |
| `src/app/matches.test.js` | Tests for the above |
| `src/pages/championship.js` | Modify: `games()` gains a status/meta line and a "Dados da partida" button per match; new `matchOpsModal()`; `bind()`'s `[data-score]`/`[data-save-games]` handler replaced with instant per-cell scoring; `config()` gains "Zerar resultados" |

---

### Task 1: Pure match-meta and scoring functions — `src/app/matches.js`

**Files:**
- Create: `src/app/matches.js`
- Create: `src/app/matches.test.js`

**Interfaces:**
- Consumes: `fmtDateBR` from `./format.js`; `venueById`, `officialById` from `./ops.js`.
- Produces: `matchMeta(match): meta`, `splitInfo(info): {data, hora, local}`, `metaLine(state, match): string`, `setScore(state, matchId, field, value): {ok, before?, after?}`, `saveMatchOps(state, matchId, fields): {ok, before?, after?}`, `clearResults(state): {ok}` — imported by Task 2.

- [ ] **Step 1: Write the failing tests**

Create `src/app/matches.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { matchMeta, splitInfo, metaLine, setScore, saveMatchOps, clearResults } from './matches.js';

describe('matchMeta', () => {
  it('creates an empty meta object when absent', () => {
    const match = {};
    expect(matchMeta(match)).toEqual({});
    expect(match.meta).toEqual({});
  });

  it('migrates a legacy free-text info string into structured fields, once', () => {
    const match = { info: '12/08/2026 · 19:00 · Ginásio Central' };
    const meta = matchMeta(match);
    expect(meta.date).toBe('12/08/2026');
    expect(meta.time).toBe('19:00');
    expect(meta.venueText).toBe('Ginásio Central');
    expect(meta._migrated).toBe(true);
  });

  it('does not re-migrate once already migrated, even if info changes', () => {
    const match = { info: 'stale text', meta: { _migrated: true, date: 'kept' } };
    const meta = matchMeta(match);
    expect(meta.date).toBe('kept');
  });

  it('preserves existing meta fields already set', () => {
    const match = { meta: { venueId: 'v1' } };
    expect(matchMeta(match).venueId).toBe('v1');
  });
});

describe('splitInfo', () => {
  it('splits on · or | into date/time/local', () => {
    expect(splitInfo('12/08/2026 · 19:00 · Ginásio Central')).toEqual({ data: '12/08/2026', hora: '19:00', local: 'Ginásio Central' });
  });

  it('handles a lone date with nothing else', () => {
    expect(splitInfo('12/08/2026')).toEqual({ data: '12/08/2026', hora: '', local: '' });
  });

  it('returns all-empty for blank input', () => {
    expect(splitInfo('')).toEqual({ data: '', hora: '', local: '' });
    expect(splitInfo(null)).toEqual({ data: '', hora: '', local: '' });
  });
});

describe('metaLine', () => {
  it('joins date, time, venue name (falling back to venueText), and referee', () => {
    const state = { venues: [{ id: 'v1', name: 'Ginásio Central' }], officials: [{ id: 'o1', name: 'João' }] };
    const match = { meta: { date: '2026-08-12', time: '19:00', venueId: 'v1', refereeId: 'o1' } };
    expect(metaLine(state, match)).toBe('12/08/2026 · 19:00 · Ginásio Central · Árbitro: João');
  });

  it('falls back to free-text venueText when no venueId matches', () => {
    const state = { venues: [], officials: [] };
    const match = { meta: { venueText: 'Campo do bairro' } };
    expect(metaLine(state, match)).toBe('Campo do bairro');
  });

  it('omits empty parts and returns an empty string when nothing is set', () => {
    const state = { venues: [], officials: [] };
    expect(metaLine(state, { meta: {} })).toBe('');
  });
});

describe('setScore', () => {
  it('updates the field and returns before/after', () => {
    const state = { matches: [{ id: 'm1', hg: null, ag: null }] };
    const result = setScore(state, 'm1', 'hg', '2');
    expect(result).toEqual({ ok: true, before: { hg: null, ag: null }, after: { hg: 2, ag: null } });
    expect(state.matches[0].hg).toBe(2);
  });

  it('clears the field back to null on an empty string', () => {
    const state = { matches: [{ id: 'm1', hg: 2, ag: 1 }] };
    setScore(state, 'm1', 'hg', '');
    expect(state.matches[0].hg).toBeNull();
  });

  it('reports ok:false for an unknown match id', () => {
    const state = { matches: [] };
    expect(setScore(state, 'ghost', 'hg', '1')).toEqual({ ok: false });
  });
});

describe('saveMatchOps', () => {
  it('writes meta fields and recomputes match.info', () => {
    const state = { matches: [{ id: 'm1', home: 0, away: 1, meta: {} }], venues: [{ id: 'v1', name: 'Arena' }], officials: [] };
    const result = saveMatchOps(state, 'm1', { date: '2026-08-12', time: '19:00', venueId: 'v1', refereeId: '', tableOfficialId: '', status: 'live', notes: 'chuva prevista' });
    expect(result.ok).toBe(true);
    const match = state.matches[0];
    expect(match.meta).toMatchObject({ date: '2026-08-12', time: '19:00', venueId: 'v1', status: 'live', notes: 'chuva prevista' });
    expect(match.info).toBe('12/08/2026 · 19:00 · Arena');
  });

  it('defaults status to scheduled when not provided', () => {
    const state = { matches: [{ id: 'm1', meta: {} }], venues: [], officials: [] };
    saveMatchOps(state, 'm1', {});
    expect(state.matches[0].meta.status).toBe('scheduled');
  });

  it('reports ok:false for an unknown match id', () => {
    const state = { matches: [] };
    expect(saveMatchOps(state, 'ghost', {})).toEqual({ ok: false });
  });
});

describe('clearResults', () => {
  it('nulls every match score', () => {
    const state = { matches: [{ id: 'm1', hg: 2, ag: 1, scorers: ['x'] }] };
    clearResults(state);
    expect(state.matches[0]).toMatchObject({ hg: null, ag: null, scorers: [] });
  });

  it('resets every bracket tie score/winner without discarding team assignments', () => {
    const state = {
      matches: [],
      bracket: {
        rounds: [[{ id: 't1', a: 'x', b: 'y', ag1: 2, bg1: 0, winner: 'x', scorers: ['g'] }]],
        third: { id: 't2', a: null, b: null, ag1: 1, bg1: 1, apen: 3, bpen: 2, winner: 'x' },
      },
    };
    clearResults(state);
    const tie = state.bracket.rounds[0][0];
    expect(tie).toMatchObject({ a: 'x', b: 'y', ag1: null, bg1: null, winner: null, scorers: [] });
    expect(state.bracket.third).toMatchObject({ ag1: null, bg1: null, apen: null, bpen: null, winner: null });
  });

  it('is a no-op-safe on a state with no matches/bracket', () => {
    expect(clearResults({})).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- matches`
Expected: FAIL — `Cannot find module './matches.js'`.

- [ ] **Step 3: Implement `src/app/matches.js`**

Adapted from legacy `matchMeta`/`splitInfo`/`metaLine`/`setScore`/`saveMatchOps`(the `x.*=...` assignments from `openMatchOps`'s modal + `saveMatchOps`)/`clearResults` (`:930-948, 1066, 1152-1156`), converted to the `state`-param + `{ok, ...}` contract:

```js
import { fmtDateBR } from './format.js';
import { venueById, officialById } from './ops.js';

export function matchMeta(match) {
  match.meta = match.meta || {};
  if (match.info && !match.meta._migrated) {
    const parts = splitInfo(match.info);
    match.meta.date = match.meta.date || parts.data;
    match.meta.time = match.meta.time || parts.hora;
    match.meta.venueText = match.meta.venueText || parts.local;
    match.meta._migrated = true;
  }
  return match.meta;
}

export function splitInfo(info) {
  if (!info) return { data: '', hora: '', local: '' };
  const parts = info.split(/[·|]/).map((s) => s.trim());
  return { data: parts[0] || '', hora: parts[1] || '', local: parts.slice(2).join(' · ') || '' };
}

export function metaLine(state, match) {
  const meta = matchMeta(match);
  const venue = venueById(state, meta.venueId);
  const official = officialById(state, meta.refereeId);
  return [fmtDateBR(meta.date), meta.time, (venue && venue.name) || meta.venueText, official && `Árbitro: ${official.name}`]
    .filter(Boolean)
    .join(' · ');
}

export function setScore(state, matchId, field, value) {
  const match = (state.matches || []).find((m) => m.id === matchId);
  if (!match) return { ok: false };
  const before = { hg: match.hg, ag: match.ag };
  match[field] = value === '' || value == null ? null : Number(value);
  const after = { hg: match.hg, ag: match.ag };
  return { ok: true, before, after };
}

export function saveMatchOps(state, matchId, { date, time, venueId, refereeId, tableOfficialId, status, notes } = {}) {
  const match = (state.matches || []).find((m) => m.id === matchId);
  if (!match) return { ok: false };
  const meta = matchMeta(match);
  const before = { ...meta };
  meta.date = date || '';
  meta.time = time || '';
  meta.venueId = venueId || '';
  meta.refereeId = refereeId || '';
  meta.tableOfficialId = tableOfficialId || '';
  meta.status = status || 'scheduled';
  meta.notes = notes || '';
  match.info = metaLine(state, match);
  return { ok: true, before, after: { ...meta } };
}

export function clearResults(state) {
  (state.matches || []).forEach((match) => { match.hg = null; match.ag = null; match.scorers = []; });
  if (state.bracket) {
    const resetTie = (tie) => { tie.ag1 = tie.bg1 = tie.ag2 = tie.bg2 = tie.apen = tie.bpen = null; tie.winner = null; tie.scorers = []; };
    (state.bracket.rounds || []).forEach((round) => round.forEach(resetTie));
    if (state.bracket.third) resetTie(state.bracket.third);
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- matches`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/matches.js src/app/matches.test.js
git commit -m "feat: port match scheduling meta, instant scoring, and results-reset from legacy"
```

---

### Task 2: Wire instant scoring, match-ops modal, and reset into `src/pages/championship.js`

**Files:**
- Modify: `src/pages/championship.js`

**Interfaces:**
- Consumes: `matchMeta`, `metaLine`, `setScore`, `saveMatchOps`, `clearResults` from `../app/matches.js`; `venueById`, `officialById` from `../app/ops.js` (extends the existing `ops.js` import).

No new automated tests (DOM wiring; Task 1's suite covers the logic). Same "no live browser in this sandbox" fallback as prior phases — verify by inspection, report `DONE_WITH_CONCERNS` if so.

- [ ] **Step 1: Extend imports**

Change:
```js
import { STAFF_ROLES, ensureOps, addVenue, removeVenue, addOfficial, removeOfficial, setTeamStaff } from '../app/ops.js';
```
to:
```js
import { STAFF_ROLES, ensureOps, addVenue, removeVenue, addOfficial, removeOfficial, setTeamStaff, venueById, officialById } from '../app/ops.js';
```

Add a new import line:
```js
import { matchMeta, metaLine, setScore, saveMatchOps, clearResults } from '../app/matches.js';
```

- [ ] **Step 2: Enrich `games()`'s match rows with a status/meta line and a "Dados da partida" button**

Find `games()`:
```js
function games() { if (state.formato === 'mata') return `<div class="card"><p class="muted">Esta fase usa chaveamento. Veja e registre os placares na aba "Chaveamento".</p></div>`; return `<div class="card"><div class="actions" style="justify-content:space-between"><div><h2>Jogos</h2><p class="muted">Registre os placares das partidas.</p></div><button class="btn" data-generate>Gerar tabela</button></div><div style="margin-top:18px">${(state.matches || []).map((match) => { const home = state.teams?.[match.home]?.nome || 'A definir'; const away = state.teams?.[match.away]?.nome || 'A definir'; return `<div class="game-row"><strong>${esc(home)}</strong><input type="number" min="0" data-score="${match.id}:hg" value="${match.hg ?? ''}"><span>×</span><input type="number" min="0" data-score="${match.id}:ag" value="${match.ag ?? ''}"><strong>${esc(away)}</strong></div>`; }).join('') || '<p class="muted">Nenhum jogo gerado ainda.</p>'}</div><button class="btn primary" style="margin-top:18px" data-save-games>Salvar resultados</button></div>`; }
```
Replace with (drops `data-save-games`'s bulk-save button — scoring is now instant per cell, matching every other tab; adds a status/meta line and a "Dados da partida" button per match, both inside a new sibling `.row` under each `.game-row`, never touching `.game-row`'s own children):
```js
function games() { if (state.formato === 'mata') return `<div class="card"><p class="muted">Esta fase usa chaveamento. Veja e registre os placares na aba "Chaveamento".</p></div>`; return `<div class="card"><div class="actions" style="justify-content:space-between"><div><h2>Jogos</h2><p class="muted">Registre os placares das partidas.</p></div><button class="btn" data-generate>Gerar tabela</button></div><div style="margin-top:18px">${(state.matches || []).map((match) => { const home = state.teams?.[match.home]?.nome || 'A definir'; const away = state.teams?.[match.away]?.nome || 'A definir'; const line = metaLine(state, match); const status = matchMeta(match).status; const statusText = status === 'live' ? 'AO VIVO' : status === 'postponed' ? 'Adiada' : status === 'cancelled' ? 'Cancelada' : ''; return `<div class="game-row"><strong>${esc(home)}</strong><input type="number" min="0" data-score="${match.id}:hg" value="${match.hg ?? ''}"><span>×</span><input type="number" min="0" data-score="${match.id}:ag" value="${match.ag ?? ''}"><strong>${esc(away)}</strong></div><div class="row" style="flex-wrap:wrap;padding:2px 0 12px"><span class="muted" style="flex:1">${statusText ? `<strong>${statusText}</strong> · ` : ''}${esc(line)}</span><button class="btn ghost sm" data-match-ops="${esc(match.id)}">Dados da partida</button></div>`; }).join('') || '<p class="muted">Nenhum jogo gerado ainda.</p>'}</div></div>`; }
```

- [ ] **Step 3: Add `matchOpsModal()`**

Add alongside `rosterModal()` (e.g. right after it):
```js
function matchOpsModal(matchId) { const match = (state.matches || []).find((m) => m.id === matchId); if (!match) return; const meta = matchMeta(match); const home = state.teams?.[match.home]?.nome || 'A definir'; const away = state.teams?.[match.away]?.nome || 'A definir'; modal(`<h3>Dados da partida</h3><p class="muted">${esc(home)} × ${esc(away)}</p><div class="row" style="flex-wrap:wrap;margin-top:12px"><input type="date" data-op-date value="${esc(meta.date || '')}" style="flex:1;min-width:140px"><input type="time" data-op-time value="${esc(meta.time || '')}" style="flex:1;min-width:100px"></div><div class="row" style="flex-wrap:wrap;margin-top:10px"><select data-op-venue style="flex:1;min-width:160px"><option value="">Local — selecionar</option>${(state.venues || []).map((v) => `<option value="${esc(v.id)}" ${meta.venueId === v.id ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select><select data-op-status style="flex:1;min-width:140px">${[['scheduled', 'Agendada'], ['live', 'Em andamento'], ['finished', 'Encerrada'], ['postponed', 'Adiada'], ['cancelled', 'Cancelada']].map(([key, label]) => `<option value="${key}" ${(meta.status || 'scheduled') === key ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></div><div class="row" style="flex-wrap:wrap;margin-top:10px"><select data-op-referee style="flex:1;min-width:160px"><option value="">Árbitro — selecionar</option>${(state.officials || []).map((o) => `<option value="${esc(o.id)}" ${meta.refereeId === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select><select data-op-table style="flex:1;min-width:160px"><option value="">Mesário — selecionar</option>${(state.officials || []).map((o) => `<option value="${esc(o.id)}" ${meta.tableOfficialId === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></div><textarea data-op-notes placeholder="Observações" style="width:100%;min-height:70px;margin-top:10px;border:1px solid var(--line);background:var(--surface-muted);color:var(--text);border-radius:8px;padding:10px">${esc(meta.notes || '')}</textarea><div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn ghost" data-close-modal>Cancelar</button><button class="btn primary" data-save-match-ops="${esc(matchId)}">Salvar</button></div>`); const box = document.getElementById('modalBox'); box.querySelector('[data-close-modal]').onclick = () => closeModal(); box.querySelector('[data-save-match-ops]').onclick = async () => { const result = saveMatchOps(state, matchId, { date: box.querySelector('[data-op-date]').value, time: box.querySelector('[data-op-time]').value, venueId: box.querySelector('[data-op-venue]').value, refereeId: box.querySelector('[data-op-referee]').value, tableOfficialId: box.querySelector('[data-op-table]').value, status: box.querySelector('[data-op-status]').value, notes: box.querySelector('[data-op-notes]').value }); if (!result.ok) return; await persist(); await addAudit(state.id, 'match_updated', `Dados da partida alterados: ${esc(home)} × ${esc(away)}`); closeModal(); render(); }; }
```

- [ ] **Step 4: Replace `bind()`'s score-saving handlers with instant per-cell scoring, and wire `matchOpsModal`**

Find:
```js
const saveGames = root.querySelector('[data-save-games]'); if (saveGames) saveGames.onclick = async () => { root.querySelectorAll('[data-score]').forEach((input) => { const [id, field] = input.dataset.score.split(':'); const match = state.matches.find((item) => item.id === id); if (match) match[field] = input.value === '' ? null : Number(input.value); }); await persist(); await addAudit(state.id, 'scores_updated', 'Resultados atualizados'); render(); };
```
Replace with:
```js
root.querySelectorAll('[data-score]').forEach((input) => input.onchange = async () => { const [matchId, field] = input.dataset.score.split(':'); const result = setScore(state, matchId, field, input.value); if (!result.ok) return; const match = state.matches.find((item) => item.id === matchId); const home = state.teams?.[match.home]?.nome || '?'; const away = state.teams?.[match.away]?.nome || '?'; await persist(); await addAudit(state.id, 'score_updated', `Placar alterado: ${esc(home)} ${result.after.hg ?? '–'} × ${result.after.ag ?? '–'} ${esc(away)}`); render(); });
root.querySelectorAll('[data-match-ops]').forEach((button) => button.onclick = () => matchOpsModal(button.dataset.matchOps));
```

- [ ] **Step 5: Add "Zerar resultados" to `config()`**

Find the settings card in `config()`:
```js
function config() { state.branding = state.branding || {}; return `<div class="card"><h2>Configurações</h2><label class="muted">Status<select data-status><option value="rascunho">Rascunho</option><option value="inscricoes">Inscrições abertas</option><option value="andamento">Em andamento</option><option value="encerrado">Encerrado</option></select></label><label class="muted">Cor principal<input type="color" data-accent value="${esc(state.branding.accent || '#2fcf6b')}"></label><button class="btn primary" data-save-config>Salvar configurações</button></div>...
```
Add a "Zerar resultados" button right after `data-save-config`'s button, still inside the same `<div class="card">`:
```js
<button class="btn ghost" style="margin-top:8px" data-clear-results>↺ Zerar resultados</button>
```
(The rest of `config()` is unchanged.)

Add its handler in `bind()`, near the `data-save-config` handler:
```js
const clearBtn = root.querySelector('[data-clear-results]'); if (clearBtn) clearBtn.onclick = async () => { if (!confirm('Zerar todos os placares e o chaveamento desta fase?')) return; clearResults(state); await persist(); await addAudit(state.id, 'results_cleared', 'Resultados zerados'); render(); };
```

- [ ] **Step 6: CSS check**

Every element added in Steps 2–5 is either a bare `<select>`, a direct `.row` child, or the explicitly inline-styled `<textarea>` in Step 3. No new `.tag`, no new `.team-row`/`.game-row` usage (`.game-row`'s own line is unchanged from before this task — only a new sibling `.row` div was added after it). Confirm by re-reading the markup before moving on.

- [ ] **Step 7: Run the full test suite and build**

Run: `npm test`
Expected: all tests pass.

Run: `npm run build && npm run verify`
Expected: both succeed.

- [ ] **Step 8: Manual smoke check (best-effort, same fallback as prior phases)**

If reachable: open a championship's Jogos tab, enter a score in one cell, confirm it saves instantly (no separate "Salvar" click needed) and an audit entry appears in Histórico; click "Dados da partida", set a venue/referee/status, save, confirm the meta line under the match updates; go to Configurações, click "Zerar resultados", confirm scores clear.

If not reachable, skip, verify by inspection, report `DONE_WITH_CONCERNS`.

- [ ] **Step 9: Commit**

```bash
git add src/pages/championship.js
git commit -m "feat: wire instant scoring, match-ops scheduling modal, and results reset into championship management"
```

---

## Self-Review

**Spec coverage** — `matchMeta`, `fmtDateBR` (already existed, reused), `metaLine`, `openMatchOps`/`saveMatchOps`→`matchOpsModal`/`saveMatchOps`, `matchRow`→enriched inline in `games()`, `setScore`, `clearResults` — all covered. `tieObj`/`resolveTie` (3a), `setTie`/`tieHTML` (3a's tie-score handler/`tieRow`), `matchEvents`/`matchContext`/`h2h`/`mark`/`nextMatchesCard`/`allMatchObjs` — explicitly rescoped with rationale.

**Placeholder scan** — no TBD/TODO; every step has literal code.

**Type consistency** — `state`/`matchId`/`match` parameter order matches across `matches.js` and `championship.js`'s call sites, consistent with `ops.js`'s `state, id` convention.
