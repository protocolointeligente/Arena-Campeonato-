# Migration Phase 5a: Branding & Sponsors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let organizers set a championship logo, cover image, and sponsor list from the Configurações tab — the branding data both the public portal (Phase 5b) and the registration form (Phase 5c) need to render a hero/sponsor section, plus the accent-color save path already shipped in Phase 2d/3d gets folded into the same module for consistency.

**Architecture:** Sub-phase 5a of Phase 5, tracked at `docs/superpowers/plans/MIGRATION-PROGRESS.md` (row 5, "Public portal & registration"). Legacy source: `arena-campeonatos-v2-intervencao-19.html:797-807` (`ensureBranding`/`readAndResizeImage`/`setBrandImage`/`clearBrandImage`/`brandingConfigHTML`/`sponsorsConfigHTML`/`addSponsor`/`removeSponsor`). Split from the rest of Phase 5 (public portal rendering, registration form) because both of those consume `state.branding`/`state.sponsors` to render a hero image and sponsor strip — this sub-phase has to land first so there's real data to read, same dependency-ordering reasoning that split Phase 3 into 3a→3d and Phase 4 into 4a→4b.

**Rescope vs. the published audit — real architecture change, not cosmetic:** `MIGRATION-PROGRESS.md:39` flagged this explicitly before Phase 5 started: legacy's `readAndResizeImage` stores images as base64 data URIs directly in the Firestore document, and "Phase 5 (branding/sponsors) adds more images... worth switching to Firebase Storage + URL references before that lands, rather than compounding the same pattern a second time." This plan makes that switch **for the new branding/sponsor images only** — `state.branding.logo`, `state.branding.cover`, and `sponsor.logo` become Firebase Storage download-URL strings (a few hundred bytes) instead of base64 blobs (tens/hundreds of KB each). `compressPhoto` (Phase 2b, athlete/team photos) is **not touched here** — migrating already-shipped base64 photo fields to Storage is a separate, larger, data-migration-shaped task (existing documents would need backfilling), out of scope for a sub-phase whose job is to add the branding editor. This is a partial fix to the flagged risk, not the full one — worth stating plainly rather than implying the whole concern is closed.

**Pure vs. DOM split**, continuing the established pattern: `src/app/branding.js` gets pure mutators (`ensureBranding`, `setAccent`, `setBrandImage`, `clearBrandImage`, `addSponsor`, `removeSponsor`) operating on `state` and returning `{ok, reason?, ...}` like every other mutator in the codebase. `src/app/images.js` gets `resizeImage(file, maxW, maxH, quality)` — a DOM-touching (FileReader/Image/canvas) but still framework-free helper, same category as `roster.js`'s existing `compressPhoto`. `src/services/storage.js` is the only place that talks to Firebase Storage (upload + get a download URL), mirroring how `src/services/championships.js` is the only place that talks to Firestore. `src/pages/championship.js`'s `config()`/`bind()` stays the DOM/wiring layer, unchanged in kind from every prior phase.

**Tech Stack:** Same as prior phases — vanilla JS ES modules, Vitest, Firebase JS SDK v12 (already a dependency; `firebase/storage` is a new import path from the same package, no new npm dependency).

## Global Constraints

- Legacy source of truth: `arena-campeonatos-v2-intervencao-19.html:797-807`.
- Mutating functions return `{ok, reason?, ...}` — matches every prior phase's contract.
- `npm run build`, `npm run verify`, `npm test` must all succeed after every task.
- No new UI framework — `data-*` + `bind()`.
- **Every new/changed `class="..."` must be checked against `layout.css`/`tokens.css`**, for both the class's own rule and any descendant-selector rule (standing instruction since Phase 2d). This sub-phase introduces **no new CSS classes** — the branding/sponsor UI reuses `.card`, `.row`, `.muted`, `.btn`/`.btn.primary`/`.btn.ghost`, `.sm` (pre-existing gap, already used elsewhere since Phase 2b — not introduced here), `.team-row` (reused with exactly 3 children, the same shape already proven safe by the venues/officials rows in this same file), and `.miniphoto` (sized via inline `style=` on each `<img>`, the same convention the existing team-logo picker already uses at `src/pages/championship.js:42`).
- Avoid import cycles: `src/app/branding.js` imports only `uid` from `./utils.js` (a leaf module). `src/services/storage.js` imports `./firebase.js` (leaf) and `../app/images.js` (leaf) — no cycle risk.
- **Security, not cosmetic — Storage write rules must replicate Firestore's ownership check**, not just "any signed-in user": `firestore.rules`' `canManageChampionship()` already gates writes to a championship by `ownerUid` or `collaboratorEmails`; `storage.rules` (new file, this plan's Task 1) must gate the matching path the same way via a cross-service `firestore.get()`, or any authenticated user could overwrite any other organizer's branding images.
- No `platformAdmin` override in `storage.rules` (Firestore's rules have one via `isPlatformAdmin()`) — deliberate simplification, not silently dropped: `// ponytail: no platform-admin override in storage rules, add a firestore.get() check on platformAdmins/{uid} if superadmin ever needs to edit branding on an organizer's behalf`.
- No delete-on-replace/remove for Storage objects (old logo/cover/sponsor-logo files are orphaned when replaced or a sponsor is removed) — deliberate simplification: `// ponytail: no delete-on-replace, orphaned Storage objects accumulate — add deleteObject() cleanup if Storage costs matter`.

## File Structure

| File | Responsibility |
|---|---|
| `src/services/firebase.js` | Add: `storage` export (`getStorage(app)`) |
| `storage.rules` | New. Firebase Storage security rules — mirrors `firestore.rules`' ownership check |
| `firebase.json` | Add: `"storage": {"rules": "storage.rules"}` |
| `src/app/images.js` | New. `resizeImage(file, maxW, maxH, quality)` — DOM image resize, promise-based |
| `src/app/images.test.js` | New. Tests for the above |
| `src/services/storage.js` | New. `uploadBrandImage(championshipId, kind, file)`, `uploadSponsorLogo(championshipId, file)` — resize + upload to Storage, return download URL |
| `src/app/branding.js` | New. `ensureBranding`, `setAccent`, `setBrandImage`, `clearBrandImage`, `addSponsor`, `removeSponsor` — pure state mutators |
| `src/app/branding.test.js` | New. Tests for the above |
| `src/pages/championship.js` | Modify: `config()` grows a branding/sponsors card; `bind()` wires the new upload/clear/add/remove handlers |

---

### Task 1: Firebase Storage wiring — `firebase.js`, `storage.rules`, `firebase.json`

**Files:**
- Modify: `src/services/firebase.js`
- Create: `storage.rules`
- Modify: `firebase.json`

**Interfaces:**
- Consumes: nothing new.
- Produces: `storage` (a `FirebaseStorage` instance) exported from `src/services/firebase.js`, consumed by Task 3's `src/services/storage.js`.

- [ ] **Step 1: Add the `storage` export**

In `src/services/firebase.js`, add the import and export:

```js
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyALN9uPafzN_KU-_NG_P1QtQth_P82xOsQ',
  authDomain: 'arena-campeonatos-2c7ac.firebaseapp.com',
  projectId: 'arena-campeonatos-2c7ac',
  storageBucket: 'arena-campeonatos-2c7ac.firebasestorage.app',
  messagingSenderId: '151897061607',
  appId: '1:151897061607:web:786f47bcb11c505e130a42',
  measurementId: 'G-LP5D508Y6X',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const observeAuth = (callback) => onAuthStateChanged(auth, callback);
export const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const register = (email, password) => createUserWithEmailAndPassword(auth, email, password);
export const logout = () => signOut(auth);
```

- [ ] **Step 2: Create `storage.rules`**

At the repo root:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /championships/{championshipId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null
        && (
          firestore.get(/databases/(default)/documents/championships/$(championshipId)).data.ownerUid == request.auth.uid
          || (request.auth.token.email != null
              && request.auth.token.email.lower() in firestore.get(/databases/(default)/documents/championships/$(championshipId)).data.collaboratorEmails)
        );
      // ponytail: no platform-admin override here, add a firestore.get()
      // check on platformAdmins/{uid} if superadmin ever needs to edit
      // branding on an organizer's behalf.
    }
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 3: Wire `storage.rules` into `firebase.json`**

`firebase.json`:

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "storage": {
    "rules": "storage.rules"
  },
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "cleanUrls": true
  }
}
```

- [ ] **Step 4: Verify build still passes**

Run: `npm run build`
Expected: succeeds (this task adds no application code, only a new SDK import and config files).

- [ ] **Step 5: Commit**

```bash
git add src/services/firebase.js storage.rules firebase.json
git commit -m "feat: wire Firebase Storage for branding images"
```

---

### Task 2: `resizeImage` — `src/app/images.js`

**Files:**
- Create: `src/app/images.js`
- Create: `src/app/images.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `resizeImage(file, maxW, maxH, quality = 0.78): Promise<string>` — resolves to `''` given no file, rejects on a >8MB file, otherwise resolves to a `data:image/jpeg` URL scaled to fit `maxW`×`maxH` preserving aspect ratio. Consumed by Task 3's `src/services/storage.js`.

- [ ] **Step 1: Write the failing tests**

`src/app/images.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { resizeImage } from './images.js';

describe('resizeImage', () => {
  it('resolves to an empty string when no file is given', async () => {
    await expect(resizeImage(null, 500, 500)).resolves.toBe('');
  });

  it('rejects files larger than 8 MB without touching FileReader/Image', async () => {
    const big = { size: 9 * 1024 * 1024 };
    await expect(resizeImage(big, 500, 500)).rejects.toThrow('Imagem maior que 8 MB');
  });
  // Real decode/resize output is NOT unit-tested here: jsdom has no image
  // decoder or 2D canvas renderer, same accepted gap as roster.js's
  // compressPhoto (see docs/superpowers/plans/2026-08-15-migration-phase2b-roster.md).
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/images.test.js`
Expected: FAIL with "Failed to resolve import ./images.js" (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

`src/app/images.js`:

```js
export function resizeImage(file, maxW, maxH, quality = 0.78) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    if (file.size > 8 * 1024 * 1024) return reject(new Error('Imagem maior que 8 MB'));
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxW / img.width, maxH / img.height);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Imagem inválida'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/images.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/images.js src/app/images.test.js
git commit -m "feat: add resizeImage helper"
```

---

### Task 3: Storage upload service — `src/services/storage.js`

**Files:**
- Create: `src/services/storage.js`

**Interfaces:**
- Consumes: `storage` from `./firebase.js` (Task 1), `resizeImage` from `../app/images.js` (Task 2).
- Produces: `uploadBrandImage(championshipId, kind, file): Promise<string>` (`kind` is `'logo'|'cover'`), `uploadSponsorLogo(championshipId, file): Promise<string>` — both resolve to a Storage download URL, or `''` if no file was given. Consumed by Task 4's `championship.js` wiring.

No test file for this task: it's a thin wrapper around the Firebase Storage SDK (upload + get a URL), the same untested-thin-wrapper status every other `src/services/*.js` file already has in this codebase (`championships.js`, `registrations.js`, `audit.js` — none have unit tests; they're exercised through the app, not in isolation).

- [ ] **Step 1: Write the implementation**

`src/services/storage.js`:

```js
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase.js';
import { resizeImage } from '../app/images.js';

const BRAND_SPEC = {
  logo: { maxW: 500, maxH: 500, quality: 0.82 },
  cover: { maxW: 1400, maxH: 700, quality: 0.72 },
};

export async function uploadBrandImage(championshipId, kind, file) {
  const spec = BRAND_SPEC[kind];
  const dataUrl = await resizeImage(file, spec.maxW, spec.maxH, spec.quality);
  if (!dataUrl) return '';
  const path = `championships/${championshipId}/branding/${kind}-${Date.now()}.jpg`;
  const fileRef = ref(storage, path);
  await uploadString(fileRef, dataUrl, 'data_url');
  return getDownloadURL(fileRef);
}

export async function uploadSponsorLogo(championshipId, file) {
  const dataUrl = await resizeImage(file, 360, 180, 0.78);
  if (!dataUrl) return '';
  const path = `championships/${championshipId}/sponsors/${Date.now()}.jpg`;
  const fileRef = ref(storage, path);
  await uploadString(fileRef, dataUrl, 'data_url');
  return getDownloadURL(fileRef);
}

// ponytail: no delete-on-replace/remove — old Storage objects are orphaned
// when a logo/cover/sponsor image is replaced or a sponsor removed. Add
// deleteObject(fileRef) cleanup if Storage costs ever matter.
```

- [ ] **Step 2: Verify build still passes**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/services/storage.js
git commit -m "feat: add Storage upload service for branding images"
```

---

### Task 4: Branding domain module — `src/app/branding.js`

**Files:**
- Create: `src/app/branding.js`
- Create: `src/app/branding.test.js`

**Interfaces:**
- Consumes: `uid` from `./utils.js`.
- Produces: `ensureBranding(state): branding`, `setAccent(state, value): {ok}`, `setBrandImage(state, kind, url): {ok, reason?}`, `clearBrandImage(state, kind): {ok, reason?}`, `addSponsor(state, {name, url, logo}): {ok, reason?, sponsor?}`, `removeSponsor(state, id): {ok}` — consumed by Task 5's `championship.js`.

- [ ] **Step 1: Write the failing tests**

`src/app/branding.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { ensureBranding, setAccent, setBrandImage, clearBrandImage, addSponsor, removeSponsor } from './branding.js';

describe('ensureBranding', () => {
  it('defaults accent and sponsors on a fresh championship', () => {
    const state = {};
    const branding = ensureBranding(state);
    expect(branding.accent).toBe('#2fcf6b');
    expect(state.sponsors).toEqual([]);
  });

  it('keeps an existing accent and an existing sponsors array', () => {
    const state = { branding: { accent: '#ff0000' }, sponsors: [{ id: 's1', name: 'X', url: '', logo: '' }] };
    ensureBranding(state);
    expect(state.branding.accent).toBe('#ff0000');
    expect(state.sponsors).toHaveLength(1);
  });
});

describe('setAccent', () => {
  it('sets the accent color', () => {
    const state = {};
    setAccent(state, '#123456');
    expect(state.branding.accent).toBe('#123456');
  });

  it('falls back to the default when given an empty value', () => {
    const state = {};
    setAccent(state, '');
    expect(state.branding.accent).toBe('#2fcf6b');
  });
});

describe('setBrandImage / clearBrandImage', () => {
  it('sets the logo url', () => {
    const state = {};
    const result = setBrandImage(state, 'logo', 'https://example.com/logo.jpg');
    expect(result.ok).toBe(true);
    expect(state.branding.logo).toBe('https://example.com/logo.jpg');
  });

  it('refuses an invalid kind', () => {
    const state = {};
    const result = setBrandImage(state, 'banner', 'https://example.com/x.jpg');
    expect(result.ok).toBe(false);
  });

  it('clears the cover url', () => {
    const state = { branding: { cover: 'https://example.com/cover.jpg' } };
    clearBrandImage(state, 'cover');
    expect(state.branding.cover).toBe('');
  });
});

describe('addSponsor', () => {
  it('appends a trimmed-name sponsor with a generated id', () => {
    const state = {};
    const result = addSponsor(state, { name: '  Acme  ', url: 'acme.com', logo: 'https://x/logo.jpg' });
    expect(result.ok).toBe(true);
    expect(state.sponsors).toHaveLength(1);
    expect(state.sponsors[0]).toMatchObject({ name: 'Acme', url: 'acme.com', logo: 'https://x/logo.jpg' });
    expect(state.sponsors[0].id).toBeTruthy();
  });

  it('refuses a blank name without mutating sponsors', () => {
    const state = {};
    const result = addSponsor(state, { name: '  ' });
    expect(result.ok).toBe(false);
    expect(state.sponsors).toHaveLength(0);
  });
});

describe('removeSponsor', () => {
  it('removes a sponsor by id', () => {
    const state = { sponsors: [{ id: 's1', name: 'A' }, { id: 's2', name: 'B' }] };
    const result = removeSponsor(state, 's1');
    expect(result.ok).toBe(true);
    expect(state.sponsors).toEqual([{ id: 's2', name: 'B' }]);
  });

  it('returns ok:false when the sponsor is not found', () => {
    const state = { sponsors: [{ id: 's1', name: 'A' }] };
    const result = removeSponsor(state, 'ghost');
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/branding.test.js`
Expected: FAIL with "Failed to resolve import ./branding.js" (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

`src/app/branding.js`:

```js
import { uid } from './utils.js';

export function ensureBranding(state) {
  state.branding = state.branding || {};
  if (!state.branding.accent) state.branding.accent = '#2fcf6b';
  if (!Array.isArray(state.sponsors)) state.sponsors = [];
  return state.branding;
}

export function setAccent(state, value) {
  ensureBranding(state);
  state.branding.accent = value || '#2fcf6b';
  return { ok: true };
}

export function setBrandImage(state, kind, url) {
  ensureBranding(state);
  if (kind !== 'logo' && kind !== 'cover') return { ok: false, reason: 'Tipo inválido.' };
  state.branding[kind] = url || '';
  return { ok: true };
}

export function clearBrandImage(state, kind) {
  return setBrandImage(state, kind, '');
}

export function addSponsor(state, { name, url, logo } = {}) {
  ensureBranding(state);
  const trimmed = (name || '').trim();
  if (!trimmed) return { ok: false, reason: 'Informe o nome do patrocinador.' };
  const sponsor = { id: uid(), name: trimmed, url: (url || '').trim(), logo: logo || '' };
  state.sponsors.push(sponsor);
  return { ok: true, sponsor };
}

export function removeSponsor(state, id) {
  ensureBranding(state);
  const before = state.sponsors.length;
  state.sponsors = state.sponsors.filter((sponsor) => sponsor.id !== id);
  return { ok: state.sponsors.length < before };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/branding.test.js`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/branding.js src/app/branding.test.js
git commit -m "feat: add branding/sponsors domain module"
```

---

### Task 5: Wire the branding/sponsors UI — `src/pages/championship.js`

**Files:**
- Modify: `src/pages/championship.js`

**Interfaces:**
- Consumes: `ensureBranding, setAccent, setBrandImage, clearBrandImage, addSponsor, removeSponsor` from `../app/branding.js` (Task 4), `uploadBrandImage, uploadSponsorLogo` from `../services/storage.js` (Task 3), `uid` (already imported from `../app/utils.js`).
- Produces: nothing new for later tasks — this is the terminal DOM layer for 5a. Phase 5b's public portal will read `state.branding.logo/cover/accent` and `state.sponsors` directly off `state`, same as every other cross-phase field.

- [ ] **Step 1: Add the new imports**

In `src/pages/championship.js`, add two import lines after the existing `standings.js` import (line 14):

```js
import { ensureBranding, setAccent, setBrandImage, clearBrandImage, addSponsor, removeSponsor } from '../app/branding.js';
import { uploadBrandImage, uploadSponsorLogo } from '../services/storage.js';
```

- [ ] **Step 2: Replace `config()` to use `ensureBranding` and add the branding/sponsors card**

Replace the entire `config()` function (currently the single line starting `function config() { state.branding = state.branding || {}; ...`) with:

```js
  function brandingCardHTML() {
    const b = state.branding;
    return `<div class="card" style="margin-top:16px"><h2>Identidade visual</h2><div class="row" style="flex-wrap:wrap;align-items:flex-start"><div>${b.logo ? `<img class="miniphoto" src="${b.logo}" style="width:64px;height:64px;border-radius:10px;object-fit:contain;background:var(--surface-muted)">` : '<span class="muted">Sem logo</span>'}<div class="row" style="margin-top:8px"><label class="btn ghost sm">Selecionar logo<input type="file" accept="image/*" style="display:none" data-brand-input="logo"></label>${b.logo ? '<button class="btn ghost sm" data-clear-brand="logo">Remover</button>' : ''}</div></div><div>${b.cover ? `<img class="miniphoto" src="${b.cover}" style="width:160px;height:80px;border-radius:10px;object-fit:cover;background:var(--surface-muted)">` : '<span class="muted">Sem capa</span>'}<div class="row" style="margin-top:8px"><label class="btn ghost sm">Selecionar capa<input type="file" accept="image/*" style="display:none" data-brand-input="cover"></label>${b.cover ? '<button class="btn ghost sm" data-clear-brand="cover">Remover</button>' : ''}</div></div></div></div><div class="card" style="margin-top:16px"><h2>Patrocinadores</h2>${(state.sponsors || []).map((sponsor) => `<div class="team-row">${sponsor.logo ? `<img class="miniphoto" src="${sponsor.logo}" style="width:28px;height:28px;border-radius:5px;object-fit:contain;background:var(--surface-muted)">` : '<span>🏷️</span>'}<span>${esc(sponsor.name)}${sponsor.url ? ` <span class="muted">· ${esc(sponsor.url)}</span>` : ''}</span><button class="btn ghost" data-remove-sponsor="${esc(sponsor.id)}">Remover</button></div>`).join('') || '<p class="muted">Nenhum patrocinador cadastrado.</p>'}<div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap"><input data-new-sponsor-name placeholder="Nome do patrocinador" style="flex:1;min-width:160px"><input data-new-sponsor-url placeholder="Site (opcional)" style="flex:1;min-width:160px"><label class="btn ghost sm">Logo<input type="file" accept="image/*" style="display:none" data-new-sponsor-logo></label><button class="btn primary" data-add-sponsor>+ Adicionar</button></div></div>`;
  }
  function config() { ensureBranding(state); const criterios = state.cfg?.criterios || ['P', 'V', 'SG', 'GP']; return `<div class="card"><h2>Configurações</h2><label class="muted">Status<select data-status><option value="rascunho">Rascunho</option><option value="inscricoes">Inscrições abertas</option><option value="andamento">Em andamento</option><option value="encerrado">Encerrado</option></select></label><label class="muted">Cor principal<input type="color" data-accent value="${esc(state.branding.accent || '#2fcf6b')}"></label><button class="btn primary" data-save-config>Salvar configurações</button><button class="btn ghost" style="margin-top:8px" data-clear-results>↺ Zerar resultados</button></div>${brandingCardHTML()}<div class="card" style="margin-top:16px"><h2>Pontuação e desempate</h2><p class="muted" style="font-size:13px;margin:0 0 12px">Estas configurações valem para a fase ativa.</p><div class="row" style="flex-wrap:wrap"><label class="muted" style="flex:1;min-width:120px">Vitória<input type="number" data-win-pts value="${state.cfg?.winPts ?? 3}"></label><label class="muted" style="flex:1;min-width:120px">Empate<input type="number" data-draw-pts value="${state.cfg?.drawPts ?? 1}"></label><label class="muted" style="flex:1;min-width:120px">Derrota<input type="number" data-loss-pts value="${state.cfg?.lossPts ?? 0}"></label></div><div style="margin-top:14px"><span class="muted">Critérios de desempate (ordem)</span>${criteriaEditorHTML(criterios)}</div>${criterios.includes('DISC') ? `<div class="row" style="flex-wrap:wrap;margin-top:12px"><label class="muted" style="flex:1;min-width:160px">Cartão amarelo<input type="number" min="0" data-disc-yellow value="${state.cfg?.discYellow ?? 1}"></label><label class="muted" style="flex:1;min-width:160px">Cartão vermelho<input type="number" min="0" data-disc-red value="${state.cfg?.discRed ?? 5}"></label></div>` : ''}<label class="muted" style="margin-top:12px">Amarelos para suspensão<input type="number" min="0" data-yellow-limit value="${state.cfg?.yellowLimit || 3}"></label><button class="btn primary" style="margin-top:12px" data-save-scoring>Salvar pontuação e desempate</button></div><div class="card" style="margin-top:16px"><h2>Locais</h2>${(state.venues || []).map((venue) => `<div class="team-row"><span>📍</span><span>${esc(venue.name)}${venue.address ? ` <span class="muted">· ${esc(venue.address)}</span>` : ''}</span><button class="btn ghost" data-remove-venue="${esc(venue.id)}">Remover</button></div>`).join('') || '<p class="muted">Nenhum local cadastrado.</p>'}<div class="row" style="margin-top:12px;gap:8px"><input data-new-venue-name placeholder="Nome do local" style="flex:1"><input data-new-venue-address placeholder="Endereço (opcional)" style="flex:1"><button class="btn primary" data-add-venue>+ Adicionar</button></div></div><div class="card" style="margin-top:16px"><h2>Árbitros e mesários</h2>${(state.officials || []).map((official) => `<div class="team-row"><span>🧑‍⚖️</span><span>${esc(official.name)}${official.role ? ` <span class="muted">· ${esc(official.role)}</span>` : ''}</span><button class="btn ghost" data-remove-official="${esc(official.id)}">Remover</button></div>`).join('') || '<p class="muted">Nenhum oficial cadastrado.</p>'}<div class="row" style="margin-top:12px;gap:8px"><input data-new-official-name placeholder="Nome" style="flex:1"><input data-new-official-role placeholder="Função" style="width:140px"><button class="btn primary" data-add-official>+ Adicionar</button></div></div>`; }
```

(This is the existing `config()` body, unchanged except: `state.branding = state.branding || {};` → `ensureBranding(state);`, and `${brandingCardHTML()}` inserted between the Configurações card and the Pontuação card.)

- [ ] **Step 3: Update the accent-save handler and add the branding/sponsor handlers to `bind()`**

In `bind()`, find this existing fragment:

```js
const saveConfig = root.querySelector('[data-save-config]'); if (saveConfig) saveConfig.onclick = async () => { state.status = status.value; state.branding.accent = root.querySelector('[data-accent]').value; shell.style.setProperty('--championship-accent', state.branding.accent); await persist(); await addAudit(state.id, 'config_updated', 'Configurações atualizadas'); render(); };
```

Replace `state.branding.accent = root.querySelector('[data-accent]').value;` with `setAccent(state, root.querySelector('[data-accent]').value);` (same line, same position — only the accent-assignment expression changes).

Then, immediately after that `saveConfig` block (still inside `bind()`, anywhere after it — e.g. right before the closing `}` of `bind()`), add:

```js
root.querySelectorAll('[data-brand-input]').forEach((input) => input.onchange = async () => { const file = input.files[0]; if (!file) return; const kind = input.dataset.brandInput; let url; try { url = await uploadBrandImage(state.id, kind, file); } catch (error) { return toast(error.message || 'Não foi possível enviar a imagem.'); } setBrandImage(state, kind, url); await persist(); await addAudit(state.id, 'branding_updated', kind === 'logo' ? 'Logo atualizada' : 'Capa atualizada'); render(); });
root.querySelectorAll('[data-clear-brand]').forEach((button) => button.onclick = async () => { clearBrandImage(state, button.dataset.clearBrand); await persist(); await addAudit(state.id, 'branding_updated', button.dataset.clearBrand === 'logo' ? 'Logo removida' : 'Capa removida'); render(); });
const addSponsorBtn = root.querySelector('[data-add-sponsor]'); if (addSponsorBtn) addSponsorBtn.onclick = async () => { const nameInput = root.querySelector('[data-new-sponsor-name]'); const urlInput = root.querySelector('[data-new-sponsor-url]'); const logoInput = root.querySelector('[data-new-sponsor-logo]'); let logo = ''; try { const file = logoInput.files[0]; if (file) logo = await uploadSponsorLogo(state.id, file); } catch (error) { return toast(error.message || 'Não foi possível enviar a logo.'); } const result = addSponsor(state, { name: nameInput.value, url: urlInput.value, logo }); if (!result.ok) return toast(result.reason); await persist(); await addAudit(state.id, 'sponsor_added', `Patrocinador adicionado: ${result.sponsor.name}`); render(); };
root.querySelectorAll('[data-remove-sponsor]').forEach((button) => button.onclick = async () => { const result = removeSponsor(state, button.dataset.removeSponsor); if (!result.ok) return; await persist(); await addAudit(state.id, 'sponsor_removed', 'Patrocinador removido'); render(); });
```

- [ ] **Step 4: Run the full test suite, build, and route verification**

Run: `npm test && npm run build && npm run verify`
Expected: all green — this task adds no new pure-logic tests of its own (the logic it calls was already tested in Task 4), only DOM wiring.

- [ ] **Step 5: Manual smoke check**

Run: `npm run dev`, open a championship's Configurações tab. Confirm: selecting a logo/cover file uploads and shows a preview; "Remover" clears it; adding a sponsor with a name (and optional URL/logo) appends a row; removing a sponsor deletes its row; the existing accent-color picker and "Salvar configurações" button still work unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/pages/championship.js
git commit -m "feat: add branding/sponsors editor to Configurações tab"
```

---

## Final whole-branch review checklist (before merge)

- Confirm `publicState()` in `src/services/championships.js` does **not** need a change: `state.branding`/`state.sponsors` now hold short Storage URLs (not base64), and both fields are meant to be publicly visible (Phase 5b renders them on the public portal) — unlike `athlete.foto`, which `publicState()` strips because it's private. No stripping logic needed here; verify this reasoning still holds once Phase 5b is written.
- Confirm no new CSS classes were introduced (Global Constraints) — grep the diff for `class="` and check each token exists in `layout.css`/`tokens.css` or was already used elsewhere pre-existing (`.sm`).
- Confirm `storage.rules` write-gate matches `firestore.rules`' `canManageChampionship()` (owner or collaborator) — not "any signed-in user".
- Confirm the two `ponytail:` deferrals (no Storage delete-on-replace, no platform-admin override) are still accurately described and not silently expanded in scope during implementation.
