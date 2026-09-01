# Placar Eletrônico por Modalidade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give organizers a projectable electronic scoreboard (score, clock, period, fouls, timeouts, penalties, server) operated from a control panel inside the championship page and displayed full-screen in a second browser window/monitor, adapted to the championship's modality.

**Architecture:** All new state (`clock`/`fouls`/`timeouts`/`penalties`/`server`) lives inside the existing `match`/`tie` object, which is already persisted as an opaque JSON blob (`saveChampionship`) — no schema or Firestore rules changes. A pure module (`src/app/scoreboard.js`) holds the mutators and the read-model (`scoreboardPayload`). The control panel is a new tab (`scoreboard-control.js`) reusing the championship page's existing `store`/`persist`/permission plumbing. The projection page (`scoreboard-display.js`) is a new standalone route that subscribes to the private championship document via `onSnapshot` (same mechanism `public-championship.js` already uses for the public one) and re-renders every second, computing elapsed clock time from timestamps instead of writing every tick.

**Tech Stack:** Vanilla JS ES modules, Immer (via the existing `ChampionshipStore`), Firebase Firestore, Vitest.

## Global Constraints

- No changes to `src/app/schemas.js` or `firestore.rules` — scoreboard fields ride inside the existing JSON blob.
- Mutating pure functions return `{ok, reason?}` (or mutate silently and return `{ok:true}`) — same contract as `src/app/matches.js`.
- Follow the codebase's existing explicit, repetitive `bindEvents` idiom in `src/pages/championship/index.js` (one `querySelectorAll(...).forEach(...)` block per `data-*` attribute) — do not introduce a generic/dynamic dispatch helper there.
- Every new `class="..."` must have a matching rule added to `src/styles/layout.css` (checked against both the class's own rule and any descendant-selector rule).
- `npm test` must pass after every task; run `npm run build` after the final task.
- Portuguese UI strings, matching existing tabs' tone (e.g. "Não foi possível...", "Placar", "Faltas").

## File Structure

| File | Responsibility |
|---|---|
| `src/app/scoreboard.js` | Pure: locate a match/tie (`findScoreboardObj`), clock/foul/timeout/penalty/server mutators, `scoreboardMode`, `scoreboardPayload` (read-model for both the control panel and the projector) |
| `src/app/scoreboard.test.js` | Tests for the above |
| `src/app/championship-store.js` | Modify: add `clockToggle`/`clockReset`/`setPeriod`/`adjustFoul`/`adjustTimeout`/`adjustPenalty`/`toggleServer` methods, wrapping `scoreboard.js` mutators in `this.produce()` |
| `src/pages/championship/tabs/scoreboard-control.js` | Pure tab renderer: `renderScoreboardControl(store, ctx)` — big-button control panel, layout adapted to `payload.mode` |
| `src/pages/championship/tabs/scoreboard-control.test.js` | Tests for the above |
| `src/pages/championship/tabs/games.js` | Modify: add a "🖥️ Placar" button per match row |
| `src/pages/championship/tabs/games.test.js` | Modify: assert the new button renders |
| `src/app/bracket-utils.js` | Modify: add a "🖥️ Placar" button per scoreable tie row |
| `src/pages/championship/index.js` | Modify: register the `placar` tab, track the selected match/tie (`placarTarget`), wire `data-open-scoreboard`/`data-scoreboard-*` event delegation |
| `src/services/championships.js` | Modify: add `subscribeChampionship(id, cb)` (private-collection `onSnapshot`, reusing `parseSnapshot`) |
| `src/pages/scoreboard-display.js` | New: `scoreboardFrameHTML(payload, championshipName)` (pure) + `renderScoreboardDisplay(root, championshipId, matchId, kind)` (Firebase glue, full-screen route) |
| `src/pages/scoreboard-display.test.js` | Tests for `scoreboardFrameHTML` |
| `src/app/main.js` | Modify: register route `/placar/:id/:matchId` |
| `src/styles/layout.css` | Add `.scoreboard-*` rules for both the control panel and the projection screen |

---

### Task 1: Pure scoreboard logic — `src/app/scoreboard.js`

**Files:**
- Create: `src/app/scoreboard.js`
- Create: `src/app/scoreboard.test.js`

**Interfaces:**
- Consumes: `findTie` from `./engine.js`; `teamNameById` from `./roster.js`; `MODALITIES` from `./templates.js`.
- Produces (consumed by Task 2, Task 3, Task 6): `findScoreboardObj(state, id, kind): obj|null`, `currentElapsedMs(obj): number`, `formatClock(ms): 'MM:SS'`, `clockToggle(obj): {ok}`, `clockReset(obj): {ok}`, `setPeriod(obj, delta): {ok, reason?}`, `adjustFoul(obj, side, delta): {ok, reason?}`, `adjustTimeout(obj, side, delta): {ok, reason?}`, `adjustPenalty(obj, side, delta): {ok, reason?}`, `toggleServer(obj): {ok}`, `scoreboardMode(state): 'goals'|'sets'|'combat'|'points'`, `scoreboardPayload(state, id, kind): {id, kind, leg, homeField, awayField, homeName, awayName, hg, ag, mode, clock:{running,period,elapsedMs}, fouls:{home,away}, timeouts:{home,away}, penalties:{home,away}, server}|null`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/scoreboard.test.js`:
```js
import { describe, it, expect, vi } from 'vitest';
import {
  findScoreboardObj, currentElapsedMs, formatClock, clockToggle, clockReset, setPeriod,
  adjustFoul, adjustTimeout, adjustPenalty, toggleServer, scoreboardMode, scoreboardPayload,
} from './scoreboard.js';

describe('findScoreboardObj', () => {
  it('finds a league/group match by id', () => {
    const state = { matches: [{ id: 'm1' }, { id: 'm2' }] };
    expect(findScoreboardObj(state, 'm2', 'match')).toBe(state.matches[1]);
  });

  it('finds a bracket tie by id, including the third-place tie', () => {
    const state = { bracket: { rounds: [[{ id: 't1' }]], third: { id: 't2' } } };
    expect(findScoreboardObj(state, 't2', 'tie')).toBe(state.bracket.third);
  });

  it('returns null for an unknown id', () => {
    expect(findScoreboardObj({ matches: [] }, 'ghost', 'match')).toBeNull();
  });
});

describe('formatClock', () => {
  it('formats milliseconds as MM:SS', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(65000)).toBe('01:05');
  });

  it('clamps negative values to zero', () => {
    expect(formatClock(-500)).toBe('00:00');
  });
});

describe('clock mutators', () => {
  it('accumulates elapsed time across pause/resume, ignoring time while paused', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const obj = {};
    clockToggle(obj);
    vi.advanceTimersByTime(5000);
    clockToggle(obj);
    expect(obj.clock).toMatchObject({ running: false, elapsedMs: 5000 });
    vi.advanceTimersByTime(3000);
    expect(currentElapsedMs(obj)).toBe(5000);
    clockToggle(obj);
    vi.advanceTimersByTime(2000);
    expect(currentElapsedMs(obj)).toBe(7000);
    vi.useRealTimers();
  });

  it('resets running state, start time and elapsed time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const obj = {};
    clockToggle(obj);
    vi.advanceTimersByTime(9000);
    clockReset(obj);
    expect(obj.clock).toMatchObject({ running: false, startedAt: null, elapsedMs: 0 });
    vi.useRealTimers();
  });

  it('moves the period up or down within 1..20', () => {
    const obj = {};
    expect(setPeriod(obj, 1)).toEqual({ ok: true });
    expect(obj.clock.period).toBe(2);
    expect(setPeriod(obj, -5)).toMatchObject({ ok: false });
    expect(obj.clock.period).toBe(2);
  });
});

describe('counters', () => {
  it('adjusts fouls per side and clamps at zero', () => {
    const obj = {};
    expect(adjustFoul(obj, 'home', 1)).toEqual({ ok: true });
    expect(obj.fouls).toEqual({ home: 1, away: 0 });
    expect(adjustFoul(obj, 'home', -5)).toMatchObject({ ok: false });
    expect(obj.fouls.home).toBe(1);
  });

  it('adjusts timeouts and penalties independently of fouls', () => {
    const obj = {};
    adjustTimeout(obj, 'away', 2);
    adjustPenalty(obj, 'home', 1);
    expect(obj.timeouts).toEqual({ home: 0, away: 2 });
    expect(obj.penalties).toEqual({ home: 1, away: 0 });
  });

  it('rejects an unknown side without mutating', () => {
    const obj = {};
    expect(adjustFoul(obj, 'ref', 1)).toMatchObject({ ok: false });
    expect(obj.fouls).toBeUndefined();
  });
});

describe('toggleServer', () => {
  it('cycles home -> away -> none -> home', () => {
    const obj = {};
    toggleServer(obj);
    expect(obj.server).toBe('home');
    toggleServer(obj);
    expect(obj.server).toBe('away');
    toggleServer(obj);
    expect(obj.server).toBeNull();
  });
});

describe('scoreboardMode', () => {
  it('is goals for team ball sports', () => {
    expect(scoreboardMode({ modalidade: 'futebol', scoreType: 'goals' })).toBe('goals');
  });

  it('is sets for set-based sports', () => {
    expect(scoreboardMode({ modalidade: 'voleibol', scoreType: 'sets' })).toBe('sets');
  });

  it('is combat for lutas modalities scored in points', () => {
    expect(scoreboardMode({ modalidade: 'judô', scoreType: 'points' })).toBe('combat');
  });

  it('is points for other individual modalities scored in points', () => {
    expect(scoreboardMode({ modalidade: 'natação', scoreType: 'points' })).toBe('points');
  });
});

describe('scoreboardPayload', () => {
  const baseState = { modalidade: 'futebol', scoreType: 'goals', teams: [{ nome: 'Leões' }, { nome: 'Tigres' }] };

  it('reads a league/group match by index-based home/away', () => {
    const state = { ...baseState, matches: [{ id: 'm1', home: 0, away: 1, hg: 2, ag: 1 }] };
    const payload = scoreboardPayload(state, 'm1', 'match');
    expect(payload).toMatchObject({ homeName: 'Leões', awayName: 'Tigres', hg: 2, ag: 1, homeField: 'hg', awayField: 'ag', mode: 'goals', leg: null });
    expect(payload.clock).toMatchObject({ running: false, period: 1, elapsedMs: 0 });
  });

  it('reads a single-leg bracket tie by id-based a/b, always leg 1', () => {
    const state = { ...baseState, cfg: { maoUnica: true }, teams: [{ id: 'a', nome: 'Alfa' }, { id: 'b', nome: 'Beta' }], bracket: { rounds: [[{ id: 't1', a: 'a', b: 'b', ag1: 3, bg1: 1 }]], third: null } };
    const payload = scoreboardPayload(state, 't1', 'tie');
    expect(payload).toMatchObject({ homeName: 'Alfa', awayName: 'Beta', hg: 3, ag: 1, homeField: 'ag1', awayField: 'bg1', leg: 1 });
  });

  it('moves a two-leg tie to leg 2 once leg 1 is complete', () => {
    const state = { ...baseState, cfg: { maoUnica: false }, teams: [{ id: 'a', nome: 'Alfa' }, { id: 'b', nome: 'Beta' }], bracket: { rounds: [[{ id: 't1', a: 'a', b: 'b', ag1: 2, bg1: 0, ag2: null, bg2: null }]], third: null } };
    const payload = scoreboardPayload(state, 't1', 'tie');
    expect(payload).toMatchObject({ homeField: 'ag2', awayField: 'bg2', leg: 2, hg: null, ag: null });
  });

  it('returns null for an unknown id', () => {
    expect(scoreboardPayload({ matches: [] }, 'ghost', 'match')).toBeNull();
  });

  it('does not mutate the source object when reading', () => {
    const state = { ...baseState, matches: [{ id: 'm1', home: 0, away: 1 }] };
    scoreboardPayload(state, 'm1', 'match');
    expect(state.matches[0].clock).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- scoreboard`
Expected: FAIL with "Failed to resolve import './scoreboard.js'" or similar

- [ ] **Step 3: Write the implementation**

Create `src/app/scoreboard.js`:
```js
import { findTie } from './engine.js';
import { teamNameById } from './roster.js';
import { MODALITIES } from './templates.js';

const SIDES = ['home', 'away'];

export function findScoreboardObj(state, id, kind) {
  if (kind === 'tie') {return findTie(state.bracket, id);}
  return (state.matches || []).find((m) => m.id === id) || null;
}

function ensureScoreboard(obj) {
  obj.clock = obj.clock || { running: false, startedAt: null, elapsedMs: 0, period: 1 };
  obj.fouls = obj.fouls || { home: 0, away: 0 };
  obj.timeouts = obj.timeouts || { home: 0, away: 0 };
  obj.penalties = obj.penalties || { home: 0, away: 0 };
  if (obj.server === undefined) {obj.server = null;}
  return obj;
}

export function currentElapsedMs(obj) {
  const clock = obj?.clock;
  if (!clock) {return 0;}
  if (clock.running && clock.startedAt) {return (clock.elapsedMs || 0) + (Date.now() - clock.startedAt);}
  return clock.elapsedMs || 0;
}

export function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function clockToggle(obj) {
  ensureScoreboard(obj);
  if (obj.clock.running) {
    obj.clock.elapsedMs = currentElapsedMs(obj);
    obj.clock.running = false;
    obj.clock.startedAt = null;
  } else {
    obj.clock.running = true;
    obj.clock.startedAt = Date.now();
  }
  return { ok: true };
}

export function clockReset(obj) {
  ensureScoreboard(obj);
  obj.clock.running = false;
  obj.clock.startedAt = null;
  obj.clock.elapsedMs = 0;
  return { ok: true };
}

export function setPeriod(obj, delta) {
  ensureScoreboard(obj);
  const next = (obj.clock.period || 1) + delta;
  if (next < 1 || next > 20) {return { ok: false, reason: 'Período fora do intervalo.' };}
  obj.clock.period = next;
  return { ok: true };
}

function adjustCounter(obj, key, side, delta) {
  ensureScoreboard(obj);
  if (!SIDES.includes(side)) {return { ok: false, reason: 'Lado inválido.' };}
  const next = (obj[key][side] || 0) + delta;
  if (next < 0 || next > 99) {return { ok: false, reason: 'Valor fora do intervalo.' };}
  obj[key][side] = next;
  return { ok: true };
}

export function adjustFoul(obj, side, delta) {return adjustCounter(obj, 'fouls', side, delta);}
export function adjustTimeout(obj, side, delta) {return adjustCounter(obj, 'timeouts', side, delta);}
export function adjustPenalty(obj, side, delta) {return adjustCounter(obj, 'penalties', side, delta);}

export function toggleServer(obj) {
  ensureScoreboard(obj);
  obj.server = obj.server === 'home' ? 'away' : obj.server === 'away' ? null : 'home';
  return { ok: true };
}

export function scoreboardMode(state) {
  const category = MODALITIES[state.modalidade]?.category;
  if (state.scoreType === 'sets') {return 'sets';}
  if (state.scoreType === 'points') {return category === 'lutas' ? 'combat' : 'points';}
  return 'goals';
}

export function scoreboardPayload(state, id, kind) {
  const obj = findScoreboardObj(state, id, kind);
  if (!obj) {return null;}
  const clock = obj.clock || { running: false, startedAt: null, elapsedMs: 0, period: 1 };
  const fouls = obj.fouls || { home: 0, away: 0 };
  const timeouts = obj.timeouts || { home: 0, away: 0 };
  const penalties = obj.penalties || { home: 0, away: 0 };
  const singleLeg = kind !== 'tie' || !!state.cfg?.maoUnica;
  const leg = kind === 'tie' && !singleLeg && obj.ag1 != null && obj.bg1 != null ? 2 : 1;
  const homeField = kind === 'tie' ? `ag${leg}` : 'hg';
  const awayField = kind === 'tie' ? `bg${leg}` : 'ag';
  const homeName = kind === 'tie' ? (teamNameById(state, obj.a) || 'A definir') : (state.teams?.[obj.home]?.nome || 'A definir');
  const awayName = kind === 'tie' ? (teamNameById(state, obj.b) || 'A definir') : (state.teams?.[obj.away]?.nome || 'A definir');
  return {
    id, kind, leg: kind === 'tie' ? leg : null,
    homeField, awayField, homeName, awayName,
    hg: obj[homeField] ?? null, ag: obj[awayField] ?? null,
    mode: scoreboardMode(state),
    clock: { running: !!clock.running, period: clock.period || 1, elapsedMs: currentElapsedMs({ clock }) },
    fouls, timeouts, penalties, server: obj.server ?? null,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- scoreboard`
Expected: PASS (all `describe` blocks green)

- [ ] **Step 5: Commit**

```bash
git add src/app/scoreboard.js src/app/scoreboard.test.js
git commit -m "feat: add pure scoreboard logic (clock, fouls, timeouts, penalties, server)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Wire scoreboard mutators into `ChampionshipStore`

**Files:**
- Modify: `src/app/championship-store.js`

**Interfaces:**
- Consumes: `findScoreboardObj`, `clockToggle`, `clockReset`, `setPeriod`, `adjustFoul`, `adjustTimeout`, `adjustPenalty`, `toggleServer` from `./scoreboard.js` (Task 1).
- Produces (consumed by Task 5): `store.clockToggle(id, kind)`, `store.clockReset(id, kind)`, `store.setPeriod(id, kind, delta): {ok, reason?}|undefined`, `store.adjustFoul(id, kind, side, delta)`, `store.adjustTimeout(id, kind, side, delta)`, `store.adjustPenalty(id, kind, side, delta)`, `store.toggleServer(id, kind)`.

No dedicated test file — `ChampionshipStore` methods are thin `this.produce()` wrappers around the already-tested `scoreboard.js` functions, matching the existing convention (`setScore`/`setTieScore`/`addMatchEvent` etc. have no store-level tests either; they're covered at the `matches.js` level).

- [ ] **Step 1: Add the import**

In `src/app/championship-store.js`, find:
```js
import { addAthlete, updateAthlete, removeAthlete, setAthletePhoto, setTeamLogo } from './roster.js';
```

Replace with:
```js
import { addAthlete, updateAthlete, removeAthlete, setAthletePhoto, setTeamLogo } from './roster.js';
import { findScoreboardObj, clockToggle as scoreboardClockToggle, clockReset as scoreboardClockReset, setPeriod as scoreboardSetPeriod, adjustFoul as scoreboardAdjustFoul, adjustTimeout as scoreboardAdjustTimeout, adjustPenalty as scoreboardAdjustPenalty, toggleServer as scoreboardToggleServer } from './scoreboard.js';
```

- [ ] **Step 2: Add the store methods**

In `src/app/championship-store.js`, find this exact block (the end of the Bracket section):
```js
  genCross() {
    return this.produce((draft) => {
      return genCross(draft);
    });
  }

  // Teams
```

Replace it with:
```js
  genCross() {
    return this.produce((draft) => {
      return genCross(draft);
    });
  }

  // Scoreboard
  clockToggle(id, kind) {
    this.produce((draft) => {
      const obj = findScoreboardObj(draft, id, kind);
      if (obj) {scoreboardClockToggle(obj);}
    });
  }

  clockReset(id, kind) {
    this.produce((draft) => {
      const obj = findScoreboardObj(draft, id, kind);
      if (obj) {scoreboardClockReset(obj);}
    });
  }

  setPeriod(id, kind, delta) {
    let result;
    this.produce((draft) => {
      const obj = findScoreboardObj(draft, id, kind);
      if (obj) {result = scoreboardSetPeriod(obj, delta);}
    });
    return result;
  }

  adjustFoul(id, kind, side, delta) {
    this.produce((draft) => {
      const obj = findScoreboardObj(draft, id, kind);
      if (obj) {scoreboardAdjustFoul(obj, side, delta);}
    });
  }

  adjustTimeout(id, kind, side, delta) {
    this.produce((draft) => {
      const obj = findScoreboardObj(draft, id, kind);
      if (obj) {scoreboardAdjustTimeout(obj, side, delta);}
    });
  }

  adjustPenalty(id, kind, side, delta) {
    this.produce((draft) => {
      const obj = findScoreboardObj(draft, id, kind);
      if (obj) {scoreboardAdjustPenalty(obj, side, delta);}
    });
  }

  toggleServer(id, kind) {
    this.produce((draft) => {
      const obj = findScoreboardObj(draft, id, kind);
      if (obj) {scoreboardToggleServer(obj);}
    });
  }

  // Teams
```

- [ ] **Step 3: Run the full test suite to confirm nothing broke**

Run: `npm test`
Expected: PASS (same pass count as before this task, plus Task 1's new `scoreboard.test.js`)

- [ ] **Step 4: Commit**

```bash
git add src/app/championship-store.js
git commit -m "feat: expose scoreboard clock/foul/timeout/penalty/server methods on ChampionshipStore

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Control panel tab — `scoreboard-control.js`

**Files:**
- Create: `src/pages/championship/tabs/scoreboard-control.js`
- Create: `src/pages/championship/tabs/scoreboard-control.test.js`
- Modify: `src/styles/layout.css`

**Interfaces:**
- Consumes: `scoreboardPayload`, `formatClock` from `../../../app/scoreboard.js` (Task 1); `esc` from `../../../app/utils.ts`.
- Produces (consumed by Task 5): `renderScoreboardControl(store, ctx): string` — a tab renderer with the same `(store, ctx)` signature as every other file in `src/pages/championship/tabs/`, reading `ctx.placarTarget: {id, kind}|null`. Emits `data-scoreboard-score`, `data-scoreboard-clock`, `data-scoreboard-period`, `data-scoreboard-foul`, `data-scoreboard-timeout`, `data-scoreboard-penalty`, `data-scoreboard-server`, `data-scoreboard-open` attributes, each valued `"{kind}:{id}[:extra...]"`.

- [ ] **Step 1: Write the failing tests**

Create `src/pages/championship/tabs/scoreboard-control.test.js`:
```js
import { describe, expect, it } from 'vitest';
import { renderScoreboardControl } from './scoreboard-control.js';

const goalsState = { modalidade: 'futebol', scoreType: 'goals', teams: [{ nome: 'Leões' }, { nome: 'Tigres' }], matches: [{ id: 'm1', home: 0, away: 1, hg: 1, ag: 0 }] };
const setsState = { modalidade: 'voleibol', scoreType: 'sets', teams: [{ nome: 'A' }, { nome: 'B' }], matches: [{ id: 'm1', home: 0, away: 1 }] };
const combatState = { modalidade: 'judô', scoreType: 'points', teams: [{ nome: 'A' }, { nome: 'B' }], matches: [{ id: 'm1', home: 0, away: 1 }] };

describe('renderScoreboardControl', () => {
  it('shows a placeholder when no match is selected', () => {
    const html = renderScoreboardControl({ getState: () => goalsState }, { placarTarget: null });
    expect(html).toContain('Selecione uma partida');
  });

  it('shows a not-found message for a stale target', () => {
    const html = renderScoreboardControl({ getState: () => goalsState }, { placarTarget: { id: 'ghost', kind: 'match' } });
    expect(html).toContain('não encontrada');
  });

  it('renders team names, score buttons, and fouls/timeouts for a goals-mode match', () => {
    const html = renderScoreboardControl({ getState: () => goalsState }, { placarTarget: { id: 'm1', kind: 'match' } });
    expect(html).toContain('Leões');
    expect(html).toContain('Faltas');
    expect(html).toContain('Tempos técnicos');
    expect(html).toContain('data-scoreboard-score="match:m1:hg:1"');
    expect(html).toContain('data-scoreboard-open="match:m1"');
  });

  it('renders a server toggle for a sets-mode match, without fouls', () => {
    const html = renderScoreboardControl({ getState: () => setsState }, { placarTarget: { id: 'm1', kind: 'match' } });
    expect(html).toContain('Saque');
    expect(html).not.toContain('Faltas');
  });

  it('renders penalties for a combat-mode match, without a server toggle', () => {
    const html = renderScoreboardControl({ getState: () => combatState }, { placarTarget: { id: 'm1', kind: 'match' } });
    expect(html).toContain('Penalidades');
    expect(html).not.toContain('Saque');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- scoreboard-control`
Expected: FAIL with "Failed to resolve import './scoreboard-control.js'"

- [ ] **Step 3: Write the implementation**

Create `src/pages/championship/tabs/scoreboard-control.js`:
```js
import { scoreboardPayload, formatClock } from '../../../app/scoreboard.js';
import { esc } from '../../../app/utils.ts';

export function renderScoreboardControl(store, ctx) {
  const target = ctx.placarTarget;
  if (!target) {
    return `<div class="card"><p class="muted">Selecione uma partida nas abas "Jogos" ou "Chaveamento" e clique em "🖥️ Placar" para operar o placar eletrônico.</p></div>`;
  }
  const payload = scoreboardPayload(store.getState(), target.id, target.kind);
  if (!payload) {
    return `<div class="card"><p class="muted">Partida não encontrada.</p></div>`;
  }
  const ref = (...parts) => [target.kind, target.id, ...parts].join(':');
  const counterRow = (label, key, attr) => `
    <div class="scoreboard-counter">
      <span class="muted">${label}</span>
      <div class="row"><span>${esc(payload.homeName)}</span><button class="btn ghost sm" data-${attr}="${ref('home', '-1')}">-</button><strong>${payload[key].home}</strong><button class="btn ghost sm" data-${attr}="${ref('home', '1')}">+</button></div>
      <div class="row"><span>${esc(payload.awayName)}</span><button class="btn ghost sm" data-${attr}="${ref('away', '-1')}">-</button><strong>${payload[key].away}</strong><button class="btn ghost sm" data-${attr}="${ref('away', '1')}">+</button></div>
    </div>`;
  return `
    <div class="card scoreboard-control">
      <div class="actions" style="justify-content:space-between">
        <h2>Placar ao vivo</h2>
        <button class="btn primary" data-scoreboard-open="${ref()}">🖥️ Abrir tela de projeção</button>
      </div>
      <div class="scoreboard-score-row">
        <div>
          <span>${esc(payload.homeName)}</span>
          <div class="row">
            <button class="btn ghost" data-scoreboard-score="${ref(payload.homeField, '-1')}">-</button>
            <strong class="scoreboard-big">${payload.hg ?? 0}</strong>
            <button class="btn ghost" data-scoreboard-score="${ref(payload.homeField, '1')}">+</button>
          </div>
        </div>
        <div>
          <span>${esc(payload.awayName)}</span>
          <div class="row">
            <button class="btn ghost" data-scoreboard-score="${ref(payload.awayField, '-1')}">-</button>
            <strong class="scoreboard-big">${payload.ag ?? 0}</strong>
            <button class="btn ghost" data-scoreboard-score="${ref(payload.awayField, '1')}">+</button>
          </div>
        </div>
      </div>
      <div class="scoreboard-clock-row">
        <strong>${formatClock(payload.clock.elapsedMs)}</strong>
        <button class="btn" data-scoreboard-clock="${ref('toggle')}">${payload.clock.running ? 'Pausar' : 'Iniciar'}</button>
        <button class="btn ghost" data-scoreboard-clock="${ref('reset')}">Zerar</button>
        <span class="muted">${payload.mode === 'sets' ? 'Set' : payload.leg ? 'Perna' : 'Período'}</span>
        ${payload.leg ? `<strong>${payload.leg}</strong>` : `
          <button class="btn ghost sm" data-scoreboard-period="${ref('-1')}">-</button>
          <strong>${payload.clock.period}</strong>
          <button class="btn ghost sm" data-scoreboard-period="${ref('1')}">+</button>
        `}
      </div>
      ${payload.mode === 'goals' ? `${counterRow('Faltas', 'fouls', 'scoreboard-foul')}${counterRow('Tempos técnicos', 'timeouts', 'scoreboard-timeout')}` : ''}
      ${payload.mode === 'combat' ? counterRow('Penalidades', 'penalties', 'scoreboard-penalty') : ''}
      ${payload.mode === 'sets' ? `<div class="scoreboard-server-row"><span class="muted">Saque</span><button class="btn ghost" data-scoreboard-server="${ref()}">${payload.server === 'home' ? esc(payload.homeName) : payload.server === 'away' ? esc(payload.awayName) : '—'}</button></div>` : ''}
    </div>
  `;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- scoreboard-control`
Expected: PASS

- [ ] **Step 5: Add control panel styles**

In `src/styles/layout.css`, append at the end of the file:
```css

/* Scoreboard control */
.scoreboard-control { display: flex; flex-direction: column; gap: 20px; }
.scoreboard-score-row { display: flex; justify-content: space-around; gap: 16px; flex-wrap: wrap; }
.scoreboard-score-row > div { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.scoreboard-big { font-size: 48px; font-weight: 800; }
.scoreboard-clock-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.scoreboard-counter { display: flex; flex-direction: column; gap: 6px; padding-top: 12px; border-top: 1px solid var(--line); }
.scoreboard-server-row { display: flex; align-items: center; gap: 12px; }
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/championship/tabs/scoreboard-control.js src/pages/championship/tabs/scoreboard-control.test.js src/styles/layout.css
git commit -m "feat: add scoreboard control panel tab renderer

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: "🖥️ Placar" buttons on match and tie rows

**Files:**
- Modify: `src/pages/championship/tabs/games.js`
- Modify: `src/pages/championship/tabs/games.test.js`
- Modify: `src/app/bracket-utils.js`

**Interfaces:**
- Produces (consumed by Task 5): a `data-open-scoreboard="match:{id}"` button per row in `renderGames`, and a `data-open-scoreboard="tie:{id}"` button per scoreable row in `tieRow`.

- [ ] **Step 1: Write the failing test**

In `src/pages/championship/tabs/games.test.js`, add a new test after the existing one:
```js
  it('renders a scoreboard button per match', () => {
    const html = renderGames({ getState: () => ({ scoreType: 'goals', formato: 'liga', teams: [{ nome: 'A' }, { nome: 'B' }], matches: [{ id: 'm1', home: 0, away: 1 }] }) });
    expect(html).toContain('data-open-scoreboard="match:m1"');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- games`
Expected: FAIL — `data-open-scoreboard="match:m1"` not found in output

- [ ] **Step 3: Add the button to `renderGames`**

In `src/pages/championship/tabs/games.js`, find:
```js
              <button class="btn ghost sm" data-match-ops="${esc(match.id)}">Dados da partida</button>
              <button class="btn ghost sm" data-sumula="match:${esc(match.id)}">📋 Súmula</button>
```

Replace with:
```js
              <button class="btn ghost sm" data-match-ops="${esc(match.id)}">Dados da partida</button>
              <button class="btn ghost sm" data-sumula="match:${esc(match.id)}">📋 Súmula</button>
              <button class="btn ghost sm" data-open-scoreboard="match:${esc(match.id)}">🖥️ Placar</button>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- games`
Expected: PASS

- [ ] **Step 5: Add the button to `tieRow`**

In `src/app/bracket-utils.js`, find:
```js
        <button class="btn ghost sm" data-sumula="tie:${esc(tie.id)}">📋 Súmula</button>
      ` : ''}
```

Replace with:
```js
        <button class="btn ghost sm" data-sumula="tie:${esc(tie.id)}">📋 Súmula</button>
        <button class="btn ghost sm" data-open-scoreboard="tie:${esc(tie.id)}">🖥️ Placar</button>
      ` : ''}
```

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/pages/championship/tabs/games.js src/pages/championship/tabs/games.test.js src/app/bracket-utils.js
git commit -m "feat: add scoreboard launch button to match and tie rows

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Wire the `placar` tab and control events into `championship/index.js`

**Files:**
- Modify: `src/pages/championship/index.js`

**Interfaces:**
- Consumes: `renderScoreboardControl` from `./tabs/scoreboard-control.js` (Task 3); `store.clockToggle`/`clockReset`/`setPeriod`/`adjustFoul`/`adjustTimeout`/`adjustPenalty`/`toggleServer` (Task 2); `store.setScore`/`store.setTieScore`/`store.findTie` (pre-existing).

No dedicated automated test — this file has no existing test file (DOM/Firebase orchestration is verified manually across this codebase, e.g. `public-championship.js`/`registration.js`); Step 8 below is the manual verification for this task.

- [ ] **Step 1: Import the new tab renderer**

In `src/pages/championship/index.js`, find:
```js
import { renderDocuments } from './tabs/documents.js';
```

Replace with:
```js
import { renderDocuments } from './tabs/documents.js';
import { renderScoreboardControl } from './tabs/scoreboard-control.js';
```

- [ ] **Step 2: Register the tab renderer**

Find:
```js
const TAB_RENDERERS = {
  overview: renderOverview,
```

Replace with:
```js
const TAB_RENDERERS = {
  overview: renderOverview,
  placar: renderScoreboardControl,
```

(Intentionally not added to the visible tab nav array — it's only reached via the "🖥️ Placar" button, which always has a specific match/tie to show.)

- [ ] **Step 3: Track the selected match/tie**

Find:
```js
  const store = createChampionshipStore(initial);
  let tab = 'overview';
```

Replace with:
```js
  const store = createChampionshipStore(initial);
  let tab = 'overview';
  let placarTarget = null;
```

- [ ] **Step 4: Pass `placarTarget` into both `TAB_RENDERERS[tab](...)` calls**

Find (inside `render()`):
```js
    content.innerHTML = TAB_RENDERERS[tab] ? TAB_RENDERERS[tab](store, { registrations, auditRows, superadmin, persist, tab, setTab: (t) => { tab = t; }, esc, toast, modal, closeModal, navigate, uid, auth, addAudit, downloadChampionshipPDF, championshipJSON, exportTeamsReport, exportRosterReport, exportScheduleReport, exportStandingsReport, exportScorersReport, exportDisciplineReport, exportOfficialsReport, exportResultsReport, exportRoundBulletin, exportPDF, printSumula, exportAthleteCards, viewRelatoriosHTML, uploadBrandImage, uploadSponsorLogo, deleteImageByUrl, uploadAthletePhoto, uploadTeamLogo, listRegistrations, updateRegistration, listAudit, isSuperadmin, isOwner, can, roleLabel, inviteManager, removeManager, changeManagerRole, ensureCollaborators }) : '';
```

Replace with:
```js
    content.innerHTML = TAB_RENDERERS[tab] ? TAB_RENDERERS[tab](store, { registrations, auditRows, superadmin, persist, tab, setTab: (t) => { tab = t; }, esc, toast, modal, closeModal, navigate, uid, auth, addAudit, downloadChampionshipPDF, championshipJSON, exportTeamsReport, exportRosterReport, exportScheduleReport, exportStandingsReport, exportScorersReport, exportDisciplineReport, exportOfficialsReport, exportResultsReport, exportRoundBulletin, exportPDF, printSumula, exportAthleteCards, viewRelatoriosHTML, uploadBrandImage, uploadSponsorLogo, deleteImageByUrl, uploadAthletePhoto, uploadTeamLogo, listRegistrations, updateRegistration, listAudit, isSuperadmin, isOwner, can, roleLabel, inviteManager, removeManager, changeManagerRole, ensureCollaborators, placarTarget }) : '';
```

Find (inside `store.subscribe(...)`):
```js
      content.innerHTML = TAB_RENDERERS[tab](store, { registrations, auditRows, superadmin, persist, tab, setTab: (t) => { tab = t; }, esc, toast, modal, closeModal, navigate, uid, auth, addAudit, downloadChampionshipPDF, championshipJSON, exportTeamsReport, exportRosterReport, exportScheduleReport, exportStandingsReport, exportScorersReport, exportDisciplineReport, exportOfficialsReport, exportResultsReport, exportRoundBulletin, exportPDF, printSumula, exportAthleteCards, viewRelatoriosHTML, uploadBrandImage, uploadSponsorLogo, deleteImageByUrl, uploadAthletePhoto, uploadTeamLogo, listRegistrations, updateRegistration, listAudit, isSuperadmin, isOwner, can, roleLabel, inviteManager, removeManager, changeManagerRole, ensureCollaborators });
```

Replace with:
```js
      content.innerHTML = TAB_RENDERERS[tab](store, { registrations, auditRows, superadmin, persist, tab, setTab: (t) => { tab = t; }, esc, toast, modal, closeModal, navigate, uid, auth, addAudit, downloadChampionshipPDF, championshipJSON, exportTeamsReport, exportRosterReport, exportScheduleReport, exportStandingsReport, exportScorersReport, exportDisciplineReport, exportOfficialsReport, exportResultsReport, exportRoundBulletin, exportPDF, printSumula, exportAthleteCards, viewRelatoriosHTML, uploadBrandImage, uploadSponsorLogo, deleteImageByUrl, uploadAthletePhoto, uploadTeamLogo, listRegistrations, updateRegistration, listAudit, isSuperadmin, isOwner, can, roleLabel, inviteManager, removeManager, changeManagerRole, ensureCollaborators, placarTarget });
```

- [ ] **Step 5: Wire the "🖥️ Placar" launch button in `bindEvents`**

`bindEvents` is a module-level function (declared outside `mount()`), so it cannot close over `mount()`'s local `placarTarget` variable directly — `setPlacarTarget` must be built inside `mount()` (where `placarTarget` lives) and passed in through `ctx`, the same way `setTab` already is.

Find (inside `render()`):
```js
  bindEvents(root, store, { persist, tab, setTab: (t) => { tab = t; }, render, registrations, auditRows, superadmin });
  bindRegistrationSearch(root);
  }
```

Replace with:
```js
  bindEvents(root, store, { persist, tab, setTab: (t) => { tab = t; }, setPlacarTarget: (id, kind) => { placarTarget = { id, kind }; }, render, registrations, auditRows, superadmin });
  bindRegistrationSearch(root);
  }
```

Find (inside `store.subscribe(...)`):
```js
    bindEvents(root, store, { persist, tab, setTab: (t) => { tab = t; }, render, registrations, auditRows, superadmin });
    bindRegistrationSearch(root);
  }
```

Replace with:
```js
    bindEvents(root, store, { persist, tab, setTab: (t) => { tab = t; }, setPlacarTarget: (id, kind) => { placarTarget = { id, kind }; }, render, registrations, auditRows, superadmin });
    bindRegistrationSearch(root);
  }
```

Find:
```js
function bindEvents(root, store, ctx) {
  const { persist, tab, setTab, render, registrations, auditRows, superadmin } = ctx;
```

Replace with:
```js
function bindEvents(root, store, ctx) {
  const { persist, tab, setTab, setPlacarTarget, render, registrations, auditRows, superadmin } = ctx;
```

Find:
```js
  // Match ops
  root.querySelectorAll('[data-match-ops]').forEach((button) => button.onclick = () => matchOpsModal(button.dataset.matchOps, store, { persist, addAudit }));
```

Replace with:
```js
  // Match ops
  root.querySelectorAll('[data-match-ops]').forEach((button) => button.onclick = () => matchOpsModal(button.dataset.matchOps, store, { persist, addAudit }));

  // Open scoreboard control
  root.querySelectorAll('[data-open-scoreboard]').forEach((button) => button.onclick = () => {
    const [kind, id] = button.dataset.openScoreboard.split(':');
    setPlacarTarget(id, kind);
    setTab('placar');
    render();
  });
```

- [ ] **Step 6: Wire the scoreboard control buttons in `bindEvents`**

Find:
```js
  // Tie scores
  root.querySelectorAll('[data-tie-score]').forEach((input) => input.onchange = async () => {
    const [tieId, field] = input.dataset.tieScore.split(':');
    const tie = store.findTie(tieId);
    if (!tie) {return;}
    tie[field] = input.value === '' ? null : Number(input.value);
    store.advanceBracket();
    await persist();
    await addAudit(store.getState().id, 'tie_score_updated', 'Placar do chaveamento atualizado');
  });
```

Replace with:
```js
  // Tie scores
  root.querySelectorAll('[data-tie-score]').forEach((input) => input.onchange = async () => {
    const [tieId, field] = input.dataset.tieScore.split(':');
    const tie = store.findTie(tieId);
    if (!tie) {return;}
    tie[field] = input.value === '' ? null : Number(input.value);
    store.advanceBracket();
    await persist();
    await addAudit(store.getState().id, 'tie_score_updated', 'Placar do chaveamento atualizado');
  });

  // Scoreboard: score +/- (store.setScore/setTieScore call store.produce() internally, which
  // triggers store.subscribe()'s notify -> re-render — no explicit render() needed here, same
  // as the plain [data-score] handler above)
  root.querySelectorAll('[data-scoreboard-score]').forEach((button) => button.onclick = async () => {
    const [kind, id, field, deltaStr] = button.dataset.scoreboardScore.split(':');
    const delta = Number(deltaStr);
    if (kind === 'tie') {
      const tie = store.findTie(id);
      if (!tie) {return;}
      store.setTieScore(id, field, Math.max(0, (tie[field] || 0) + delta));
    } else {
      const match = (store.getState().matches || []).find((item) => item.id === id);
      if (!match) {return;}
      const result = store.setScore(id, field, Math.max(0, (match[field] || 0) + delta));
      if (!result.ok) {toast(result.reason || 'Não foi possível atualizar o placar.'); return;}
    }
    await persist();
  });

  // Scoreboard: clock
  root.querySelectorAll('[data-scoreboard-clock]').forEach((button) => button.onclick = async () => {
    const [kind, id, action] = button.dataset.scoreboardClock.split(':');
    if (action === 'toggle') {store.clockToggle(id, kind);} else {store.clockReset(id, kind);}
    await persist();
  });

  // Scoreboard: period
  root.querySelectorAll('[data-scoreboard-period]').forEach((button) => button.onclick = async () => {
    const [kind, id, deltaStr] = button.dataset.scoreboardPeriod.split(':');
    store.setPeriod(id, kind, Number(deltaStr));
    await persist();
  });

  // Scoreboard: fouls
  root.querySelectorAll('[data-scoreboard-foul]').forEach((button) => button.onclick = async () => {
    const [kind, id, side, deltaStr] = button.dataset.scoreboardFoul.split(':');
    store.adjustFoul(id, kind, side, Number(deltaStr));
    await persist();
  });

  // Scoreboard: timeouts
  root.querySelectorAll('[data-scoreboard-timeout]').forEach((button) => button.onclick = async () => {
    const [kind, id, side, deltaStr] = button.dataset.scoreboardTimeout.split(':');
    store.adjustTimeout(id, kind, side, Number(deltaStr));
    await persist();
  });

  // Scoreboard: penalties
  root.querySelectorAll('[data-scoreboard-penalty]').forEach((button) => button.onclick = async () => {
    const [kind, id, side, deltaStr] = button.dataset.scoreboardPenalty.split(':');
    store.adjustPenalty(id, kind, side, Number(deltaStr));
    await persist();
  });

  // Scoreboard: server toggle
  root.querySelectorAll('[data-scoreboard-server]').forEach((button) => button.onclick = async () => {
    const [kind, id] = button.dataset.scoreboardServer.split(':');
    store.toggleServer(id, kind);
    await persist();
  });

  // Scoreboard: open projection window (no store mutation, no re-render needed)
  root.querySelectorAll('[data-scoreboard-open]').forEach((button) => button.onclick = () => {
    const [kind, id] = button.dataset.scoreboardOpen.split(':');
    const query = kind === 'tie' ? '?kind=tie' : '';
    window.open(`/placar/${store.getState().id}/${id}${query}`, '_blank', 'noopener');
  });
```

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 8: Manual verification**

Run: `npm run dev`, open a championship with at least one generated match, go to the "Jogos" tab, click "🖥️ Placar". Confirm:
- The panel shows team names, score buttons, clock (Iniciar/Pausar/Zerar), and period controls.
- Clicking "Iniciar" starts the clock ticking (re-open the tab or wait — the panel itself doesn't tick live, only the projection page does; the panel's clock number updates on any button click).
- Score +/- buttons update the number and match the "Jogos" tab's score after switching tabs.
- "Abrir tela de projeção" opens a new tab at `/placar/<id>/<matchId>`.

- [ ] **Step 9: Commit**

```bash
git add src/pages/championship/index.js
git commit -m "feat: wire scoreboard control tab and event handlers into the championship page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: `subscribeChampionship` — live read for the projector

**Files:**
- Modify: `src/services/championships.js`

**Interfaces:**
- Produces (consumed by Task 7): `subscribeChampionship(id, cb: (state|null) => void): unsubscribe`. Calls `cb(null)` when the document doesn't exist or the read is denied (e.g. logged-out viewer); otherwise calls `cb(parsedState)` on every update, same shape as `getChampionship`.

No dedicated test file — this module has no existing tests (Firebase-touching service layer is exercised manually, same as `getChampionship`/`saveChampionship`).

- [ ] **Step 1: Add `onSnapshot` to the import**

In `src/services/championships.js`, find:
```js
import { collection, doc, getDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
```

Replace with:
```js
import { collection, doc, getDoc, getDocs, onSnapshot, query, where, writeBatch } from 'firebase/firestore';
```

- [ ] **Step 2: Add `subscribeChampionship`**

Find:
```js
export async function getChampionship(id) { const snapshot = await getDoc(doc(privateCollection, id)); return snapshot.exists() ? parseSnapshot(snapshot) : null; }
```

Replace with:
```js
export async function getChampionship(id) { const snapshot = await getDoc(doc(privateCollection, id)); return snapshot.exists() ? parseSnapshot(snapshot) : null; }

export function subscribeChampionship(id, cb) {
  return onSnapshot(doc(privateCollection, id), (snapshot) => {
    cb(snapshot.exists() ? parseSnapshot(snapshot) : null);
  }, () => cb(null));
}
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/services/championships.js
git commit -m "feat: add subscribeChampionship for live scoreboard projection

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Projection page — `scoreboard-display.js` + route

**Files:**
- Create: `src/pages/scoreboard-display.js`
- Create: `src/pages/scoreboard-display.test.js`
- Modify: `src/app/main.js`
- Modify: `src/styles/layout.css`

**Interfaces:**
- Consumes: `subscribeChampionship` from `../services/championships.js` (Task 6); `scoreboardPayload`, `formatClock` from `../app/scoreboard.js` (Task 1); `esc` from `../app/utils.ts`; `navigate` from `../app/router-v2.js`.
- Produces: `scoreboardFrameHTML(payload, championshipName): string` (pure, tested); `renderScoreboardDisplay(root, championshipId, matchId, kind): void` (Firebase glue, mounted by the route).

- [ ] **Step 1: Write the failing test**

Create `src/pages/scoreboard-display.test.js`:
```js
import { describe, expect, it } from 'vitest';
import { scoreboardFrameHTML } from './scoreboard-display.js';
import { scoreboardPayload } from '../app/scoreboard.js';

describe('scoreboardFrameHTML', () => {
  it('shows a not-found message when there is no payload', () => {
    expect(scoreboardFrameHTML(null, 'Copa X')).toContain('não encontrada');
  });

  it('renders team names, score, clock and modality-specific extras for a goals match', () => {
    const state = { nome: 'Copa X', modalidade: 'futebol', scoreType: 'goals', teams: [{ nome: 'Leões' }, { nome: 'Tigres' }], matches: [{ id: 'm1', home: 0, away: 1, hg: 2, ag: 1 }] };
    const payload = scoreboardPayload(state, 'm1', 'match');
    const html = scoreboardFrameHTML(payload, state.nome);
    expect(html).toContain('Leões');
    expect(html).toContain('Tigres');
    expect(html).toContain('>2<');
    expect(html).toContain('00:00');
    expect(html).toContain('Faltas');
  });

  it('shows the server side for a sets match instead of fouls', () => {
    const state = { nome: 'Copa X', modalidade: 'voleibol', scoreType: 'sets', teams: [{ nome: 'A' }, { nome: 'B' }], matches: [{ id: 'm1', home: 0, away: 1, server: 'home' }] };
    const payload = scoreboardPayload(state, 'm1', 'match');
    const html = scoreboardFrameHTML(payload, state.nome);
    expect(html).toContain('Saque');
    expect(html).not.toContain('Faltas');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- scoreboard-display`
Expected: FAIL with "Failed to resolve import './scoreboard-display.js'"

- [ ] **Step 3: Write the implementation**

Create `src/pages/scoreboard-display.js`:
```js
import { subscribeChampionship } from '../services/championships.js';
import { scoreboardPayload, formatClock } from '../app/scoreboard.js';
import { esc } from '../app/utils.ts';
import { navigate } from '../app/router-v2.js';

export function scoreboardFrameHTML(payload, championshipName) {
  if (!payload) {
    return `<div class="scoreboard-display"><p>Partida não encontrada.</p></div>`;
  }
  const periodLabel = payload.mode === 'sets' ? `Set ${payload.clock.period}` : payload.leg ? `${payload.leg}ª perna` : `Período ${payload.clock.period}`;
  const extra = payload.mode === 'goals'
    ? `<div class="meta-row"><span>Faltas ${payload.fouls.home} × ${payload.fouls.away}</span><span>Tempos técnicos ${payload.timeouts.home} × ${payload.timeouts.away}</span></div>`
    : payload.mode === 'combat'
    ? `<div class="meta-row"><span>Penalidades ${payload.penalties.home} × ${payload.penalties.away}</span></div>`
    : payload.mode === 'sets'
    ? `<div class="meta-row"><span>Saque: ${payload.server === 'home' ? esc(payload.homeName) : payload.server === 'away' ? esc(payload.awayName) : '—'}</span></div>`
    : '';
  return `
    <div class="scoreboard-display">
      <button class="btn fullscreen-btn" data-scoreboard-fullscreen type="button">⛶ Tela cheia</button>
      <small>${esc(championshipName || '')} · ${periodLabel}</small>
      <div class="teams">
        <div><div class="team-name">${esc(payload.homeName)}</div><div class="team-score">${payload.hg ?? 0}</div></div>
        <div><div class="team-name">${esc(payload.awayName)}</div><div class="team-score">${payload.ag ?? 0}</div></div>
      </div>
      <div class="clock">${formatClock(payload.clock.elapsedMs)}</div>
      ${extra}
    </div>
  `;
}

export function renderScoreboardDisplay(root, championshipId, matchId, kind = 'match') {
  root.__publicUnsubscribe?.();
  root.innerHTML = `<div class="scoreboard-display"><p>Carregando placar...</p></div>`;
  let latestState = null;

  function bindFullscreen() {
    root.querySelector('[data-scoreboard-fullscreen]')?.addEventListener('click', () => {
      document.documentElement.requestFullscreen?.();
    });
  }

  function paint() {
    if (!latestState) {return;}
    root.innerHTML = scoreboardFrameHTML(scoreboardPayload(latestState, matchId, kind), latestState.nome);
    bindFullscreen();
  }

  const unsubscribe = subscribeChampionship(championshipId, (state) => {
    if (!state) {
      root.innerHTML = `<div class="scoreboard-display"><p>Faça login para ver este placar.</p><button class="btn" data-scoreboard-login type="button">Entrar</button></div>`;
      root.querySelector('[data-scoreboard-login]')?.addEventListener('click', () => navigate('/login'));
      return;
    }
    latestState = state;
    paint();
  });
  const tick = setInterval(paint, 1000);
  root.__publicUnsubscribe = () => { unsubscribe(); clearInterval(tick); };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- scoreboard-display`
Expected: PASS

- [ ] **Step 5: Register the route**

In `src/app/main.js`, find:
```js
import { renderPublication } from '../pages/publication.js';
```

Replace with:
```js
import { renderPublication } from '../pages/publication.js';
import { renderScoreboardDisplay } from '../pages/scoreboard-display.js';
```

Find:
```js
route('/campeonatos/:id', safeRoute((params) => renderChampionship(mainContent, params.id)));
```

Replace with:
```js
route('/campeonatos/:id', safeRoute((params) => renderChampionship(mainContent, params.id)));
route('/placar/:id/:matchId', safeRoute((params) => {
  const kind = new URLSearchParams(window.location.search).get('kind') || 'match';
  renderScoreboardDisplay(mainContent, params.id, params.matchId, kind);
}));
```

- [ ] **Step 6: Add projection page styles**

In `src/styles/layout.css`, append at the end of the file (after Task 3's additions):
```css

/* Scoreboard projection */
.scoreboard-display { min-height: 100vh; background: #05070a; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; padding: 24px; text-align: center; }
.scoreboard-display .teams { display: flex; align-items: center; justify-content: center; gap: 48px; width: 100%; }
.scoreboard-display .team-name { font-size: clamp(24px, 4vw, 48px); font-weight: 700; text-transform: uppercase; }
.scoreboard-display .team-score { font-size: clamp(80px, 16vw, 220px); font-weight: 900; line-height: 1; font-variant-numeric: tabular-nums; }
.scoreboard-display .clock { font-size: clamp(40px, 8vw, 96px); font-variant-numeric: tabular-nums; }
.scoreboard-display .meta-row { display: flex; gap: 32px; font-size: clamp(16px, 2.4vw, 28px); color: #9aa5b1; flex-wrap: wrap; justify-content: center; }
.scoreboard-display .fullscreen-btn { position: fixed; top: 16px; right: 16px; }
```

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: PASS (all tests, including Tasks 1–7)

- [ ] **Step 8: Build check**

Run: `npm run build`
Expected: builds without errors

- [ ] **Step 9: Manual end-to-end verification**

Run: `npm run dev`. Open a championship, go to "Jogos", click "🖥️ Placar", then "Abrir tela de projeção". In the new tab/window, confirm:
- Team names, score, clock (00:00), and period show correctly, styled full-screen dark.
- Clicking "⛶ Tela cheia" enters fullscreen.
- Back in the control tab, click "Iniciar" on the clock and a score +1 button — within ~1-2s the projection tab updates on its own (no manual refresh).
- Reload the projection tab — the clock keeps counting from the correct elapsed time (not reset to 0).

- [ ] **Step 10: Commit**

```bash
git add src/pages/scoreboard-display.js src/pages/scoreboard-display.test.js src/app/main.js src/styles/layout.css
git commit -m "feat: add full-screen scoreboard projection page and /placar route

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
