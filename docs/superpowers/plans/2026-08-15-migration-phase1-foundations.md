# Migration Phase 1: Shared Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the legacy monolith's shared primitives (`esc`, `clone`/`deep`, `uid`, `fmtDateBR`, `brl`, `ageFrom`, `toast`, `modal`/`closeModal`, `loadingHTML`) into `src/app/`, back every port with a test that pins its behavior to the legacy implementation, and remove the duplicated/ad-hoc copies already scattered across `src/pages/*` and `src/services/*`.

**Architecture:** This is Phase 1 of 7 in the incremental "strangler fig" migration agreed with the user (see the published audit artifact from this session). Every later phase (categories, phases/formats, draw engine, match engine, reports, public portal, admin) will build UI on top of these primitives, so nothing in this phase is allowed to be a stub — each function's output is asserted against the legacy source line it was ported from. `arena-campeonatos-v2-intervencao-19.html` (the file that still ships to production via `scripts/prepare-legacy.mjs`) is the source of truth for exact behavior; deviations are only acceptable where explicitly called out below with a reason.

**Tech Stack:** Vite 7, vanilla JS ES modules (no framework — matches existing `src/` code), Vitest + jsdom for tests (new dependency, added in Task 1).

## Global Constraints

- Legacy source of truth: `arena-campeonatos-v2-intervencao-19.html` (line numbers below refer to this file as of this session).
- No new UI framework — every existing `src/pages/*.js` file is plain functions returning template strings, matching that pattern.
- `esc()` in this migration keeps the **src/ superset behavior** (escapes `'` in addition to `&<>"`) rather than the legacy subset — src/ already has three independent copies of the superset version (`championship.js:8`, `public-championship.js:4`, plus the pattern is copy-pasted correctly each time), so the superset is the de facto standard already in use and it is strictly safer. This is a deliberate, one-time deviation — do not re-introduce the legacy subset.
- `npm run build` (`vite build && node scripts/prepare-legacy.mjs`) and `npm run verify` must both still succeed after every task — this phase must never break the production build path, even though production currently serves the legacy file, not `src/`.
- Every new module goes in `src/app/` (joins `main.js`, `router.js`, `state.js`, `theme.js` — the existing home for cross-cutting app code, as opposed to `src/pages/` and `src/services/`).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/app/utils.js` | `esc`, `clone`, `uid` — pure, no DOM |
| `src/app/utils.test.js` | Tests for the above |
| `src/app/format.js` | `fmtDateBR`, `brl`, `ageFrom` — pure, no DOM |
| `src/app/format.test.js` | Tests for the above |
| `src/app/ui.js` | `toast`, `modal`, `closeModal`, `loadingHTML`, `ensureUiRoot` — DOM-touching |
| `src/app/ui.test.js` | jsdom tests for the above |
| `src/styles/layout.css` | Modify: add `.toast` / `.spin` / `.modal-overlay` rules |
| `src/app/main.js` | Modify: call `ensureUiRoot()` once at boot |
| `src/pages/championship.js` | Modify: drop local `esc`/`clone`, use `uid()` for new team ids, `toast()` instead of `alert()` |
| `src/pages/public-championship.js` | Modify: drop local `esc` |
| `src/pages/registration.js` | Modify: use shared `esc` where it builds HTML (currently none needed — verify) |
| `src/services/championships.js` | Modify: drop local `clone` |
| `package.json` | Modify: add `vitest`, `jsdom` devDependencies and `test` script |

---

### Task 1: Add Vitest as the test runner

**Files:**
- Modify: `package.json`
- Create: `src/app/smoke.test.js`

**Interfaces:**
- Produces: `npm test` command, available to every later task in this plan and every later phase.

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest jsdom`
Expected: `package.json` gains `vitest` and `jsdom` under `devDependencies`.

- [ ] **Step 2: Add the test script**

In `package.json`, inside `"scripts"`, add:
```json
"test": "vitest run"
```
Full `scripts` block becomes:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build && node scripts/prepare-legacy.mjs",
  "preview": "vite preview",
  "verify": "node scripts/verify-routes.mjs",
  "test": "vitest run"
}
```

- [ ] **Step 3: Write a smoke test**

Create `src/app/smoke.test.js`:
```js
import { describe, it, expect } from 'vitest';

describe('vitest setup', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Run it**

Run: `npm test`
Expected: `1 passed`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/app/smoke.test.js
git commit -m "chore: add vitest as the test runner"
```

---

### Task 2: Port `esc`, `clone`, `uid` into `src/app/utils.js`

**Files:**
- Create: `src/app/utils.js`
- Create: `src/app/utils.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `esc(value: any): string`, `clone(value: any): any`, `uid(): string` — imported by every later task and every later phase's HTML-building code.

- [ ] **Step 1: Write the failing tests**

Create `src/app/utils.test.js`:
```js
import { describe, it, expect, vi } from 'vitest';
import { esc, clone, uid } from './utils.js';

describe('esc', () => {
  it('escapes html-significant characters', () => {
    expect(esc('<b>&"\'')).toBe('&lt;b&gt;&amp;&quot;&#39;');
  });

  it('returns empty string for null/undefined', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });

  it('stringifies non-string values', () => {
    expect(esc(42)).toBe('42');
  });

  it('passes through plain text unchanged', () => {
    expect(esc('Equipe A')).toBe('Equipe A');
  });
});

describe('clone', () => {
  it('deep clones nested objects', () => {
    const original = { a: 1, nested: { b: [1, 2, { c: 3 }] } };
    const copy = clone(original);
    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
    expect(copy.nested).not.toBe(original.nested);
    copy.nested.b.push(4);
    expect(original.nested.b).toEqual([1, 2, { c: 3 }]);
  });
});

describe('uid', () => {
  it('matches the legacy id shape: base36 timestamp + 5-char base36 suffix', () => {
    const id = uid();
    expect(id).toMatch(/^[a-z0-9]+[a-z0-9]{5}$/);
  });

  it('produces unique ids across calls', () => {
    const ids = new Set(Array.from({ length: 50 }, () => uid()));
    expect(ids.size).toBe(50);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- utils`
Expected: FAIL — `Cannot find module './utils.js'`.

- [ ] **Step 3: Implement `src/app/utils.js`**

Ported from legacy `esc` (`arena-campeonatos-v2-intervencao-19.html:318`, extended to also escape `'` per the Global Constraints note above), `deep` (`:576`, renamed `clone` to match the name already used three times in `src/`), and `uid` (`:317`, verbatim):

```js
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- utils`
Expected: `9 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/app/utils.js src/app/utils.test.js
git commit -m "feat: port esc/clone/uid from legacy into src/app/utils.js"
```

---

### Task 3: Port `fmtDateBR`, `brl`, `ageFrom` into `src/app/format.js`

**Files:**
- Create: `src/app/format.js`
- Create: `src/app/format.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `fmtDateBR(value: string): string`, `brl(value: number): string`, `ageFrom(dob: string): number|null`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/format.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { fmtDateBR, brl, ageFrom } from './format.js';

describe('fmtDateBR', () => {
  it('converts ISO date to DD/MM/YYYY', () => {
    expect(fmtDateBR('2026-08-15')).toBe('15/08/2026');
  });

  it('returns empty string for falsy input', () => {
    expect(fmtDateBR('')).toBe('');
    expect(fmtDateBR(null)).toBe('');
  });

  it('passes through values that are not ISO dates', () => {
    expect(fmtDateBR('15/08/2026')).toBe('15/08/2026');
  });
});

describe('brl', () => {
  it('matches Intl BRL currency formatting', () => {
    expect(brl(150)).toBe(Number(150).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    expect(brl(150)).toContain('150,00');
    expect(brl(150)).toContain('R$');
  });

  it('handles zero and decimals', () => {
    expect(brl(0)).toContain('0,00');
    expect(brl(19.9)).toContain('19,90');
  });
});

describe('ageFrom', () => {
  it('returns null for falsy or invalid input', () => {
    expect(ageFrom('')).toBeNull();
    expect(ageFrom(null)).toBeNull();
    expect(ageFrom('not-a-date')).toBeNull();
  });

  it('computes full years elapsed, accounting for birthday not yet reached this year', () => {
    const now = new Date();
    const notYetBirthday = new Date(now.getFullYear() - 10, now.getMonth() + 1, now.getDate());
    // if month+1 overflows into next year, this test's premise breaks — guard it
    if (notYetBirthday.getFullYear() === now.getFullYear() - 10) {
      const iso = notYetBirthday.toISOString().slice(0, 10);
      expect(ageFrom(iso)).toBe(9);
    }
  });

  it('computes exact age when birthday already passed this year', () => {
    const now = new Date();
    const alreadyHadBirthday = new Date(now.getFullYear() - 20, 0, 1);
    const iso = alreadyHadBirthday.toISOString().slice(0, 10);
    expect(ageFrom(iso)).toBe(20);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- format`
Expected: FAIL — `Cannot find module './format.js'`.

- [ ] **Step 3: Implement `src/app/format.js`**

Ported verbatim from legacy `fmtDateBR` (`:934`), `brl` (`:471`), `ageFrom` (`:681`):

```js
export function fmtDateBR(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
  return value;
}

export function brl(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ageFrom(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth)) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- format`
Expected: `8 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/app/format.js src/app/format.test.js
git commit -m "feat: port fmtDateBR/brl/ageFrom from legacy into src/app/format.js"
```

---

### Task 4: Port `toast`/`modal`/`closeModal`/`loadingHTML` into `src/app/ui.js`

**Files:**
- Create: `src/app/ui.js`
- Create: `src/app/ui.test.js`
- Modify: `src/app/main.js`
- Modify: `src/styles/layout.css`

**Interfaces:**
- Consumes: `esc` from `./utils.js`.
- Produces: `ensureUiRoot(): void`, `toast(message: string): void`, `modal(html: string): void`, `closeModal(): void`, `loadingHTML(text?: string): string` — imported by every page from Phase 2 onward instead of `alert()`/`confirm()`/ad-hoc `insertAdjacentHTML('beforeend', ...)`.

Legacy's `toast`/`modal`/`closeModal` (`:321-324`) rely on `#toast`/`#modalBg`/`#modalBox` already existing in the page's static HTML, and a global `$ = (selector, el = document) => el.querySelector(selector)`. `src/`'s `index.html` only has `#app`, so this port adds `ensureUiRoot()` to lazily create those three nodes once, appended to `document.body` (siblings of `#app`, so router-driven `innerHTML` swaps on `#app` never wipe them out).

- [ ] **Step 1: Write the failing tests**

Create `src/app/ui.test.js`:
```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ensureUiRoot, toast, modal, closeModal, loadingHTML } from './ui.js';

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
});

describe('ensureUiRoot', () => {
  it('creates #toast and #modalBg/#modalBox once', () => {
    ensureUiRoot();
    ensureUiRoot();
    expect(document.querySelectorAll('#toast').length).toBe(1);
    expect(document.querySelectorAll('#modalBg').length).toBe(1);
    expect(document.querySelector('#modalBg #modalBox')).not.toBeNull();
  });

  it('does not remove #app', () => {
    ensureUiRoot();
    expect(document.getElementById('app')).not.toBeNull();
  });
});

describe('toast', () => {
  it('sets the message and shows it', () => {
    vi.useFakeTimers();
    ensureUiRoot();
    toast('Salvo');
    const el = document.getElementById('toast');
    expect(el.textContent).toBe('Salvo');
    expect(el.classList.contains('show')).toBe(true);
    vi.advanceTimersByTime(2400);
    expect(el.classList.contains('show')).toBe(false);
    vi.useRealTimers();
  });
});

describe('modal / closeModal', () => {
  it('opens with the given html and closes', () => {
    ensureUiRoot();
    modal('<h3>Título</h3>');
    expect(document.getElementById('modalBox').innerHTML).toBe('<h3>Título</h3>');
    expect(document.getElementById('modalBg').classList.contains('open')).toBe(true);
    closeModal();
    expect(document.getElementById('modalBg').classList.contains('open')).toBe(false);
  });

  it('closes when the backdrop itself is clicked, not its content', () => {
    ensureUiRoot();
    modal('<h3>Título</h3>');
    document.getElementById('modalBox').click();
    expect(document.getElementById('modalBg').classList.contains('open')).toBe(true);
    document.getElementById('modalBg').click();
    expect(document.getElementById('modalBg').classList.contains('open')).toBe(false);
  });
});

describe('loadingHTML', () => {
  it('renders a spinner with the given text, escaped', () => {
    const html = loadingHTML('<x>');
    expect(html).toContain('&lt;x&gt;');
    expect(html).toContain('class="spin"');
  });

  it('defaults to "Carregando..." when no text given', () => {
    expect(loadingHTML()).toContain('Carregando...');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- ui`
Expected: FAIL — `Cannot find module './ui.js'`.

- [ ] **Step 3: Implement `src/app/ui.js`**

Ported from legacy `toast`/`modal`/`closeModal`/`loadingHTML` (`:321-325`) and the backdrop-click listener (`:324`):

```js
import { esc } from './utils.js';

let toastTimer = null;

export function ensureUiRoot() {
  if (!document.getElementById('toast')) {
    const toastEl = document.createElement('div');
    toastEl.id = 'toast';
    document.body.appendChild(toastEl);
  }
  if (!document.getElementById('modalBg')) {
    const backdrop = document.createElement('div');
    backdrop.id = 'modalBg';
    backdrop.className = 'modal-overlay';
    backdrop.innerHTML = '<div id="modalBox" class="card modal-card"></div>';
    backdrop.addEventListener('click', (event) => {
      if (event.target.id === 'modalBg') closeModal();
    });
    document.body.appendChild(backdrop);
  }
}

export function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

export function modal(html) {
  document.getElementById('modalBox').innerHTML = html;
  document.getElementById('modalBg').classList.add('open');
}

export function closeModal() {
  document.getElementById('modalBg').classList.remove('open');
}

export function loadingHTML(text) {
  return `<div class="center" style="padding:70px 0"><div class="spin"></div><p class="muted" style="margin-top:14px">${esc(text || 'Carregando...')}</p></div>`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- ui`
Expected: `8 passed`.

- [ ] **Step 5: Wire `ensureUiRoot()` into boot**

In `src/app/main.js`, add the import and call it once, right after `applyTheme()`:

```js
import { ensureUiRoot } from './ui.js';
```

```js
const root = document.querySelector('#app');
applyTheme();
ensureUiRoot();
```

- [ ] **Step 6: Add the CSS**

In `src/styles/layout.css`, append:
```css
#toast { position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%) translateY(150%); background: var(--surface-muted); border: 1px solid var(--line); color: var(--text); padding: 12px 20px; border-radius: 10px; z-index: 200; transition: .35s; box-shadow: 0 8px 24px rgba(0,0,0,.18); font-weight: 600; }
#toast.show { transform: translateX(-50%) translateY(0); }
.spin { width: 34px; height: 34px; border: 3px solid var(--line); border-top-color: var(--brand); border-radius: 50%; animation: rot .8s linear infinite; margin: 0 auto; }
@keyframes rot { to { transform: rotate(360deg); } }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: none; place-items: center; padding: 20px; z-index: 100; }
.modal-overlay.open { display: grid; }
```

- [ ] **Step 7: Run the full test suite and build**

Run: `npm test`
Expected: all tests pass (smoke + utils + format + ui).

Run: `npm run build && npm run verify`
Expected: both succeed, no errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/ui.js src/app/ui.test.js src/app/main.js src/styles/layout.css
git commit -m "feat: port toast/modal/loadingHTML from legacy into src/app/ui.js"
```

---

### Task 5: Remove the duplicated/ad-hoc copies in existing pages

**Files:**
- Modify: `src/pages/championship.js`
- Modify: `src/pages/public-championship.js`
- Modify: `src/services/championships.js`

**Interfaces:**
- Consumes: `esc`, `clone`, `uid` from `../app/utils.js`; `toast` from `../app/ui.js`.
- Produces: nothing new — this task is pure DRY cleanup + one UX fix (native `alert()` → `toast()`), with no behavior change to anything already tested elsewhere.

- [ ] **Step 1: `src/services/championships.js` — drop the local `clone`**

Change:
```js
const clone = (value) => JSON.parse(JSON.stringify(value));
```
to:
```js
import { clone } from '../app/utils.js';
```
placed with the other imports at the top of the file (after the `firebase/firestore` and `./firebase.js` imports).

- [ ] **Step 2: `src/pages/public-championship.js` — drop the local `esc`**

Change:
```js
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
```
to:
```js
import { esc } from '../app/utils.js';
```
placed with the other imports at the top of the file.

- [ ] **Step 3: `src/pages/championship.js` — drop local `esc`/`clone`, use `uid()`, use `toast()` instead of `alert()`**

Change the top of the file from:
```js
import { navigate } from '../app/router.js';
import { getChampionship, saveChampionship } from '../services/championships.js';
import { listRegistrations, updateRegistration } from '../services/registrations.js';
import { addAudit, listAudit } from '../services/audit.js';
import { downloadChampionshipPDF } from '../services/pdf.js';

const clone = (v) => JSON.parse(JSON.stringify(v));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
```
to:
```js
import { navigate } from '../app/router.js';
import { getChampionship, saveChampionship } from '../services/championships.js';
import { listRegistrations, updateRegistration } from '../services/registrations.js';
import { addAudit, listAudit } from '../services/audit.js';
import { downloadChampionshipPDF } from '../services/pdf.js';
import { esc, clone, uid } from '../app/utils.js';
import { toast } from '../app/ui.js';
```

Replace every `${Date.now()}-${state.teams.length}` and `${Date.now()}-${Math.random()}` id literal (there are three: in the approve-registration handler, the add-team handler, and the generate-fixtures handler) with `uid()`. Example for the add-team handler:
```js
const add = root.querySelector('[data-add-team]'); if (add) add.onclick = () => { state.teams = state.teams || []; state.teams.push({ id: uid(), nome: `Equipe ${state.teams.length + 1}`, roster: [] }); render(); };
```
And for the generate-fixtures handler, replace:
```js
if ((state.teams || []).length < 2) return alert('Cadastre pelo menos duas equipes.');
```
with:
```js
if ((state.teams || []).length < 2) return toast('Cadastre pelo menos duas equipes.');
```
and each `match.id` literal `${Date.now()}-${home}-${away}` with `uid()`.

- [ ] **Step 4: Run the full test suite and build**

Run: `npm test`
Expected: all tests still pass — this task touches no tested logic, only call sites.

Run: `npm run build && npm run verify`
Expected: both succeed.

- [ ] **Step 5: Manual smoke check**

Run: `npm run dev`, open the app, go to a championship, open the "Jogos" tab, click "Gerar tabela" with fewer than 2 teams registered.
Expected: a toast reading "Cadastre pelo menos duas equipes." appears bottom-center and fades after ~2.4s — no native browser `alert()` dialog.

- [ ] **Step 6: Commit**

```bash
git add src/pages/championship.js src/pages/public-championship.js src/services/championships.js
git commit -m "refactor: consolidate esc/clone/uid usage on src/app/utils.js, replace alert() with toast()"
```

---

## Self-Review

**Spec coverage** — every function named in the "Fundações compartilhadas" row of the published audit (`toast`, `modal`, `closeModal`, `loadingHTML`, `fmtDateBR`, `brl`, `ageFrom`, `deep`/`clone`, `uid`) has a task above. `esc` and `svgIcon` were in the wider "UI kit" bucket of the audit; `esc` is included here since every later phase's HTML-building code needs it immediately. `svgIcon` (icon rendering) is deferred to whichever later phase first needs an icon the current inline-SVG `replaceEmojiIcons` approach doesn't already cover — it isn't a blocking dependency for Phase 2.

**Placeholder scan** — no TBD/TODO markers; every step has literal code, not a description of code.

**Type consistency** — `esc`/`clone`/`uid` are used with the same names and signatures across Tasks 2, 4, and 5. `toast`/`modal`/`closeModal`/`loadingHTML` are used with the same names and signatures across Task 4 and Task 5.
