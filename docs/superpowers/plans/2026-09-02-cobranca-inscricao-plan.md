# Cobrança de Inscrição das Equipes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an organizer configure a fixed registration fee (R$) + their own Asaas Wallet ID; once a team's registration is approved, the team can pay that fee through an Asaas checkout with an 8% split going to Arena, and both the team and the organizer can see the payment status.

**Architecture:** Two new unauthenticated Cloud Functions (`createRegistrationCheckout`, `registrationFeeWebhook`) backed by a pure, tested logic module (`functions/lib/registration-fee-logic.js`), following the exact pattern already used for subscription billing (`functions/lib/billing-logic.js` + `billingWebhook`). The fee/walletId live as plain top-level fields on the private `championships/{id}` state (same pattern as `publicSlug`). The fee actually charged is frozen onto `feeAmount` on the registration document at the moment of approval — `createRegistrationCheckout` always prices off that frozen value, never off a live re-read of the championship's current fee, so a fee change after approval never affects an already-approved team. A new public page reads the registration doc directly (now publicly `get`-able by id) to show status and trigger payment.

**Tech Stack:** Same as rest of repo — vanilla JS ES modules, Vite, Vitest, Firebase (Firestore/Functions), Immer via `ChampionshipStore.produce()`. Cloud Functions package is CommonJS (`functions/`), tested with Node's built-in `node:test` for pure logic only — HTTP handlers get no automated tests, per established convention.

## Global Constraints

- Split is always **8% to Arena / 92% to the organizer's Wallet ID** (`percentualValue: 92` in the Asaas `split` array) — never read a percentage from the client.
- Registration fee is a **flat number in R$ per championship** (not per category) — 0/empty disables the whole feature.
- Fee is only chargeable **after a registration is approved** — approving never itself charges anything; it only unlocks the pay button for the team.
- `feeAmount` is frozen on the registration document at the moment of approval and is the single source of truth for price in `createRegistrationCheckout` — never re-read the championship's live `registrationFee` there.
- `createRegistrationCheckout` and `registrationFeeWebhook` are **unauthenticated** (`onRequest`, no `requireUser`) — same trust level as the existing anonymous registration-submission flow.
- `registrationFeeWebhook` reuses the existing `ASAAS_WEBHOOK_TOKEN` secret but writes idempotency markers to its **own** collection (`registrationFeeWebhookEvents`), separate from `billingWebhookEvents`.
- A registration document is readable by anyone **by exact id** (`allow get: if true`) but the full collection stays organizer-only (`allow list, update, delete: if canManageChampionship()`).
- Follow the `data-*="kind:id"` event-delegation convention and the `store.produce()` auto-render convention already used throughout `championship-store.js` / `championship/index.js`.
- `firestore.rules` is touched in Task 3 → run `node scripts/security-audit.mjs` before committing that task.

---

## File Structure

| File | Change |
|---|---|
| `functions/lib/registration-fee-logic.js` | New. Pure, tested: `parseRegistrationReference`, `normalizeAsaasRegistrationEvent`. |
| `functions/lib/registration-fee-logic.test.js` | New. `node:test` coverage for the above. |
| `functions/index.js` | Add `createRegistrationCheckout`, `registrationFeeWebhook`. |
| `firestore.rules` | Split `registrations/{registrationId}` read rule into `get` (public) vs `list/update/delete` (organizer only). |
| `src/app/championship-store.js` | Add `setRegistrationFee(fee, walletId)`. |
| `src/pages/championship/tabs/config.js` | Add "Taxa de inscrição (R$)" + "Wallet ID Asaas" fields. |
| `src/pages/championship/index.js` | Wire the new config fields into save; freeze `feeAmount`/`feeStatus` on approve. |
| `src/pages/championship/tabs/registrations.js` | Show a payment-status badge on approved registrations that have a fee. |
| `src/pages/championship/tabs/registrations.test.js` | Extend for the new badge. |
| `src/services/billing.js` | Add `createRegistrationCheckout(championshipId, registrationId)` client wrapper. |
| `src/pages/registration-status.js` | New public page: status + pay button. |
| `src/pages/registration-status.test.js` | New. Tests the pure `registrationStatusHTML`. |
| `src/pages/registration.js` | Confirmation screen gets a link to the new status page. |
| `src/pages/registration.test.js` | Extend to cover the new link. |
| `src/app/main.js` | New route `/inscrever/:championshipId/status/:registrationId`. |

---

### Task 1: Pure registration-fee webhook logic

**Files:**
- Create: `functions/lib/registration-fee-logic.js`
- Test: `functions/lib/registration-fee-logic.test.js`

**Interfaces:**
- Produces: `parseRegistrationReference(raw: string) => {championshipId: string, registrationId: string} | null`; `normalizeAsaasRegistrationEvent(body: object) => {eventId: string, reference: {championshipId, registrationId} | null, status: 'paid' | null}`.

- [ ] **Step 1: Write the failing tests**

```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseRegistrationReference, normalizeAsaasRegistrationEvent } = require('./registration-fee-logic.js');

test('parseRegistrationReference', async (t) => {
  await t.test('parses a valid championshipId/registrationId JSON string', () => {
    assert.deepEqual(
      parseRegistrationReference('{"championshipId":"c1","registrationId":"r1"}'),
      { championshipId: 'c1', registrationId: 'r1' },
    );
  });
  await t.test('returns null for missing fields, invalid JSON, or empty input', () => {
    assert.equal(parseRegistrationReference('{"championshipId":"c1"}'), null);
    assert.equal(parseRegistrationReference('not json'), null);
    assert.equal(parseRegistrationReference(''), null);
    assert.equal(parseRegistrationReference(undefined), null);
  });
});

test('normalizeAsaasRegistrationEvent', async (t) => {
  const reference = '{"championshipId":"c1","registrationId":"r1"}';

  await t.test('PAYMENT_RECEIVED and PAYMENT_CONFIRMED normalize to status paid', () => {
    for (const event of ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']) {
      const result = normalizeAsaasRegistrationEvent({ event, id: 'evt1', payment: { id: 'pay1', externalReference: reference } });
      assert.equal(result.eventId, 'evt1');
      assert.deepEqual(result.reference, { championshipId: 'c1', registrationId: 'r1' });
      assert.equal(result.status, 'paid');
    }
  });

  await t.test('other event types normalize to status null', () => {
    const result = normalizeAsaasRegistrationEvent({ event: 'PAYMENT_OVERDUE', id: 'evt2', payment: { id: 'pay2', externalReference: reference } });
    assert.equal(result.status, null);
  });

  await t.test('falls back to payment.id when the top-level id is missing', () => {
    const result = normalizeAsaasRegistrationEvent({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay3', externalReference: reference } });
    assert.equal(result.eventId, 'pay3');
  });

  await t.test('handles a missing or malformed externalReference', () => {
    const result = normalizeAsaasRegistrationEvent({ event: 'PAYMENT_RECEIVED', id: 'evt4', payment: { id: 'pay4' } });
    assert.equal(result.reference, null);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd functions && node --test lib/registration-fee-logic.test.js`
Expected: FAIL with `Cannot find module './registration-fee-logic.js'`

- [ ] **Step 3: Write the implementation**

```js
'use strict';

function parseRegistrationReference(raw) {
  try {
    const value = JSON.parse(raw || '{}');
    return value && value.championshipId && value.registrationId
      ? { championshipId: String(value.championshipId), registrationId: String(value.registrationId) }
      : null;
  } catch {
    return null;
  }
}

// Taxa de inscrição é uma cobrança avulsa (checkout DETACHED), diferente da assinatura de plano
// tratada em billing-logic.js — reaproveita o mesmo shape de payload do Asaas (`event`,
// `payment.externalReference`) mas com seu próprio domínio de status: só interessa saber se a
// cobrança foi paga, não há ciclo recorrente pra acompanhar aqui.
function normalizeAsaasRegistrationEvent(body) {
  const event = String((body && body.event) || '');
  const payment = (body && body.payment) || {};
  const reference = parseRegistrationReference(payment.externalReference);
  const eventId = String((body && body.id) || payment.id || '');
  const status = (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') ? 'paid' : null;
  return { eventId, reference, status };
}

module.exports = { parseRegistrationReference, normalizeAsaasRegistrationEvent };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd functions && node --test lib/registration-fee-logic.test.js`
Expected: PASS, 0 failures

- [ ] **Step 5: Commit**

```bash
git add functions/lib/registration-fee-logic.js functions/lib/registration-fee-logic.test.js
git commit -m "feat: add pure registration-fee webhook normalization logic"
```

---

### Task 2: Cloud Functions — `createRegistrationCheckout` and `registrationFeeWebhook`

**Files:**
- Modify: `functions/index.js`

**Interfaces:**
- Consumes: `normalizeAsaasRegistrationEvent` from Task 1 (`./lib/registration-fee-logic.js`); `equal`, `db`, `asaasAccessToken`, `asaasWebhookToken` already defined in this file.
- Produces: two exported `onRequest` handlers. `createRegistrationCheckout` reads/writes `championships/{id}/registrations/{id}` and reads `championships/{id}` for `asaasWalletId`. `registrationFeeWebhook` reads/writes the same registration doc and writes `registrationFeeWebhookEvents/{eventId}`.

No automated test for this task, per this repo's established convention (Cloud Function HTTP handlers get no automated tests — the money logic they call into is what Task 1 tests). Manual verification happens after deploy, same as the subscription webhook.

- [ ] **Step 1: Add the import**

Find:
```js
const {
  isPastGrace,
  normalizeAsaasEvent,
  normalizeMercadoPagoPreapproval,
  normalizeMercadoPagoPayment,
} = require('./lib/billing-logic.js');
```

Replace:
```js
const {
  isPastGrace,
  normalizeAsaasEvent,
  normalizeMercadoPagoPreapproval,
  normalizeMercadoPagoPayment,
} = require('./lib/billing-logic.js');
const { normalizeAsaasRegistrationEvent } = require('./lib/registration-fee-logic.js');
```

- [ ] **Step 2: Add the two functions**

Find (the end of the file):
```js
// Read-only public API — third parties (a scoreboard on a projector, a media outlet, a widget
// on the organizer's own site) can pull a championship's live data without bundling the
// Firebase SDK. Backed by the same publicChampionships doc the public portal itself reads, so
// there's no separate data path to keep in sync. `home`/`away` on each match are indices into
// `teams`, same as the app's own internal shape — not pre-resolved names, to keep the payload
// small when there are many matches.
exports.publicApi = onRequest({ cors: true }, async (req, res) => {
```

Replace:
```js
// Cria um checkout Asaas avulso pra taxa de inscrição de UMA equipe já aprovada. Sem
// autenticação — mesmo nível de confiança do envio de inscrição em si, que também é anônimo.
// O preço vem sempre de registration.feeAmount, o valor CONGELADO no momento em que o
// organizador aprovou (ver approve-registration em championship/index.js) — nunca do
// championship.registrationFee ao vivo, pra uma mudança de taxa depois da aprovação nunca afetar
// quem já foi aprovado.
exports.createRegistrationCheckout = onRequest({ secrets: [asaasAccessToken], cors: true }, async (req, res) => {
  if (req.method !== 'POST') {res.status(405).send('Method not allowed'); return;}
  const { championshipId, registrationId } = req.body || {};
  if (!championshipId || !registrationId) {res.status(400).send('championshipId e registrationId são obrigatórios'); return;}

  const regRef = db.collection('championships').doc(String(championshipId)).collection('registrations').doc(String(registrationId));
  const regSnap = await regRef.get();
  if (!regSnap.exists) {res.status(404).send('Inscrição não encontrada'); return;}
  const registration = regSnap.data();
  if (registration.status !== 'approved') {res.status(409).send('Inscrição ainda não foi aprovada.'); return;}
  if (registration.feeStatus === 'paid') {res.status(409).send('Esta inscrição já foi paga.'); return;}
  const amount = Number(registration.feeAmount);
  if (!(amount > 0)) {res.status(409).send('Esta inscrição não tem taxa de inscrição configurada.'); return;}

  const champSnap = await db.collection('championships').doc(String(championshipId)).get();
  let champState = {};
  try { champState = JSON.parse(champSnap.data()?.data || '{}'); } catch { champState = {}; }
  const walletId = champState.asaasWalletId;
  if (!walletId) {res.status(409).send('Campeonato sem Wallet ID Asaas configurado.'); return;}

  const reference = JSON.stringify({ championshipId: String(championshipId), registrationId: String(registrationId) });
  const statusUrl = `https://arena-campeonatos.web.app/inscrever/${championshipId}/status/${registrationId}`;

  let checkoutUrl;
  try {
    // chargeTypes DETACHED = cobrança avulsa (não recorrente), diferente do checkout de
    // assinatura (createCheckout usa RECURRENT) — verificar contra a doc/conta Asaas real antes
    // do primeiro pagamento de verdade, mesma ressalva já registrada pro billingWebhook do MP.
    const response = await fetch('https://api.asaas.com/v3/checkouts', {
      method: 'POST',
      headers: { access_token: asaasAccessToken.value(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        billingTypes: ['CREDIT_CARD', 'PIX'],
        chargeTypes: ['DETACHED'],
        minutesToExpire: 60,
        callback: { successUrl: statusUrl, cancelUrl: statusUrl, expiredUrl: statusUrl },
        items: [{ name: `Taxa de inscrição — ${registration.teamName || 'equipe'}`, description: 'Taxa de inscrição no campeonato', quantity: 1, value: amount }],
        split: [{ walletId: String(walletId), percentualValue: 92 }],
        externalReference: reference,
      }),
    });
    if (!response.ok) {throw new Error(`Asaas retornou ${response.status}`);}
    const created = await response.json();
    if (!created.id) {throw new Error('Resposta inesperada do Asaas.');}
    checkoutUrl = `https://checkout.asaas.com/${created.id}`;
  } catch (error) {
    res.status(502).send(error.message);
    return;
  }

  await regRef.set({ feeCheckoutUrl: checkoutUrl }, { merge: true });
  res.status(200).json({ checkoutUrl });
});

exports.registrationFeeWebhook = onRequest({ secrets: [asaasWebhookToken], cors: false }, async (req, res) => {
  if (req.method !== 'POST') {res.status(405).send('Method not allowed'); return;}
  if (!equal(req.get('asaas-access-token'), asaasWebhookToken.value())) {res.status(401).send('Invalid signature'); return;}

  const normalized = normalizeAsaasRegistrationEvent(req.body || {});
  if (!normalized.eventId) {res.status(400).send('Event id required'); return;}

  const eventRef = db.collection('registrationFeeWebhookEvents').doc(normalized.eventId);
  const existing = await eventRef.get();
  if (existing.exists) {res.status(200).send('Already processed'); return;}
  if (!normalized.reference || normalized.status !== 'paid') {
    // Mesma razão do sufixo :ignored em billingWebhook: um pagamento manda notificação mais de
    // uma vez conforme o status muda, sempre com o MESMO id — gravar o "ignorado" no doc do id
    // real bloquearia a notificação seguinte (a que de fato importa) via "Already processed".
    await db.collection('registrationFeeWebhookEvents').doc(`${normalized.eventId}:ignored`).set({ eventId: normalized.eventId, status: 'ignored', receivedAt: admin.firestore.FieldValue.serverTimestamp() });
    res.status(200).send('Ignored');
    return;
  }

  const regRef = db.collection('championships').doc(normalized.reference.championshipId).collection('registrations').doc(normalized.reference.registrationId);
  await db.runTransaction(async (tx) => {
    const regSnap = await tx.get(regRef);
    if (!regSnap.exists) {return;}
    tx.create(eventRef, { eventId: normalized.eventId, status: 'paid', receivedAt: admin.firestore.FieldValue.serverTimestamp() });
    tx.set(regRef, { feeStatus: 'paid', feePaidAt: Date.now() }, { merge: true });
  });
  res.status(200).send('Processed');
});

// Read-only public API — third parties (a scoreboard on a projector, a media outlet, a widget
// on the organizer's own site) can pull a championship's live data without bundling the
// Firebase SDK. Backed by the same publicChampionships doc the public portal itself reads, so
// there's no separate data path to keep in sync. `home`/`away` on each match are indices into
// `teams`, same as the app's own internal shape — not pre-resolved names, to keep the payload
// small when there are many matches.
exports.publicApi = onRequest({ cors: true }, async (req, res) => {
```

- [ ] **Step 3: Sanity-check the file loads**

Run: `cd functions && node -e "require('./index.js')"`
Expected: no output, exit code 0 (this only checks the module parses/loads under Node — Cloud Functions runtime config is not exercised locally)

- [ ] **Step 4: Commit**

```bash
git add functions/index.js
git commit -m "feat: add createRegistrationCheckout and registrationFeeWebhook Cloud Functions"
```

---

### Task 3: Firestore rules — public single-doc read for registrations

**Files:**
- Modify: `firestore.rules`

**Interfaces:**
- Consumes: existing `canManageChampionship()` helper (unchanged).
- Produces: registration docs become readable by exact id by anyone; listing/writing stays organizer-only. No code elsewhere depends on a new interface — this is a rules-only change.

- [ ] **Step 1: Split the read rule**

Find:
```
      match /registrations/{registrationId} {
        allow read, update, delete: if canManageChampionship();
        allow create: if exists(/databases/$(database)/documents/publicChampionships/$(championshipId))
```

Replace:
```
      match /registrations/{registrationId} {
        // get = ler UM documento específico por id (o time já recebeu o protocolo/id no envio,
        // mesmo modelo de confiança de um link de confirmação por e-mail) — usado pela página
        // pública de status/pagamento. list continua exigindo ser o organizador, senão dava pra
        // enumerar todas as inscrições de um campeonato sem autenticar.
        allow get: if true;
        allow list, update, delete: if canManageChampionship();
        allow create: if exists(/databases/$(database)/documents/publicChampionships/$(championshipId))
```

- [ ] **Step 2: Run the security audit script**

Run: `node scripts/security-audit.mjs`
Expected: exits 0 / reports no new findings tied to this change (this repo runs this script by convention whenever `firestore.rules` is touched — read its output and address anything it flags before continuing)

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat: allow public get-by-id read on registrations for the status page"
```

---

### Task 4: `ChampionshipStore.setRegistrationFee`

**Files:**
- Modify: `src/app/championship-store.js`
- Test: `src/integration.test.js`

**Interfaces:**
- Produces: `store.setRegistrationFee(fee: number|string, walletId: string) => void`. Sets `draft.registrationFee` (a non-negative number, 2-decimal rounded, 0 if invalid/empty) and `draft.asaasWalletId` (trimmed string) via `this.produce()`.

- [ ] **Step 1: Write the failing test**

Find (in `src/integration.test.js`):
```js
      const sponsorResult = store.addSponsor({ name: 'Sponsor 1', url: 'https://sponsor.com' });
      expect(sponsorResult.ok).toBe(true);
      state = store.getState();
      expect(state.sponsors).toHaveLength(1);
    });

    it('should persist custom discipline weights and criterion order', async () => {
```

Replace:
```js
      const sponsorResult = store.addSponsor({ name: 'Sponsor 1', url: 'https://sponsor.com' });
      expect(sponsorResult.ok).toBe(true);
      state = store.getState();
      expect(state.sponsors).toHaveLength(1);
    });

    it('should set the registration fee and Asaas wallet id', async () => {
      const { createChampionshipStore } = await import('./app/championship-store.js');
      const store = createChampionshipStore({ id: 'test-fee', nome: 'Test', formato: 'liga', cfg: {}, teams: [], matches: [], categories: [] });

      store.setRegistrationFee('49.9', ' wallet-abc ');
      let state = store.getState();
      expect(state.registrationFee).toBe(49.9);
      expect(state.asaasWalletId).toBe('wallet-abc');

      store.setRegistrationFee('', '');
      state = store.getState();
      expect(state.registrationFee).toBe(0);
      expect(state.asaasWalletId).toBe('');

      store.setRegistrationFee('-10', 'wallet-x');
      state = store.getState();
      expect(state.registrationFee).toBe(0);
    });

    it('should persist custom discipline weights and criterion order', async () => {
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/integration.test.js -t "registration fee"`
Expected: FAIL with `store.setRegistrationFee is not a function`

- [ ] **Step 3: Implement**

Find (in `src/app/championship-store.js`):
```js
  // Availability against other championships must be checked by the caller first
  // (services/championships.js's checkSlugAvailable) — this only validates format and writes.
  setPublicSlug(value) {
    const slug = slugify(value);
    if (slug && !isValidSlug(slug)) {
      toastError('URL personalizada inválida — use letras, números e hífen, 3 a 60 caracteres.');
      return { ok: false };
    }
    this.produce((draft) => {
      draft.publicSlug = slug;
    });
    return { ok: true, slug };
  }
```

Replace:
```js
  // Availability against other championships must be checked by the caller first
  // (services/championships.js's checkSlugAvailable) — this only validates format and writes.
  setPublicSlug(value) {
    const slug = slugify(value);
    if (slug && !isValidSlug(slug)) {
      toastError('URL personalizada inválida — use letras, números e hífen, 3 a 60 caracteres.');
      return { ok: false };
    }
    this.produce((draft) => {
      draft.publicSlug = slug;
    });
    return { ok: true, slug };
  }

  // Valor "atual" configurado pelo organizador — cada aprovação de inscrição congela esse valor
  // em registration.feeAmount naquele momento (ver championship/index.js), então mudar aqui
  // depois nunca afeta quem já foi aprovado. 0 = recurso desligado.
  setRegistrationFee(fee, walletId) {
    const parsed = Number(fee);
    const amount = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0;
    this.produce((draft) => {
      draft.registrationFee = amount;
      draft.asaasWalletId = String(walletId || '').trim();
    });
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/integration.test.js -t "registration fee"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/championship-store.js src/integration.test.js
git commit -m "feat: add ChampionshipStore.setRegistrationFee"
```

---

### Task 5: Config UI — fee and Wallet ID fields

**Files:**
- Modify: `src/pages/championship/tabs/config.js`
- Modify: `src/pages/championship/index.js`

**Interfaces:**
- Consumes: `store.setRegistrationFee(fee, walletId)` from Task 4.
- Produces: two new inputs, `[data-registration-fee]` and `[data-asaas-wallet-id]`, read by the existing `data-save-config` click handler.

- [ ] **Step 1: Add the fields to the config tab**

Find (in `src/pages/championship/tabs/config.js`):
```js
      <label class="muted" style="margin-top:12px;display:block">URL personalizada do portal público<input data-public-slug maxlength="60" placeholder="ex: copa-do-bairro-2026" value="${esc(state.publicSlug || '')}"></label>
      <p class="muted" style="font-size:12px;margin-top:4px">Se preenchido, o portal fica em ${esc(location.origin)}/c/&lt;url&gt; em vez do link padrão. Deixe em branco pra usar o link padrão.</p>
      <button class="btn primary" data-save-config>Salvar configurações</button>
```

Replace:
```js
      <label class="muted" style="margin-top:12px;display:block">URL personalizada do portal público<input data-public-slug maxlength="60" placeholder="ex: copa-do-bairro-2026" value="${esc(state.publicSlug || '')}"></label>
      <p class="muted" style="font-size:12px;margin-top:4px">Se preenchido, o portal fica em ${esc(location.origin)}/c/&lt;url&gt; em vez do link padrão. Deixe em branco pra usar o link padrão.</p>
      <label class="muted" style="margin-top:12px;display:block">Taxa de inscrição (R$)<input type="number" min="0" step="0.01" data-registration-fee value="${state.registrationFee || ''}"></label>
      <label class="muted" style="margin-top:8px;display:block">Wallet ID Asaas<input data-asaas-wallet-id placeholder="ex: 22e49670-27e4-4e78-a924-000000000000" value="${esc(state.asaasWalletId || '')}"></label>
      <p class="muted" style="font-size:12px;margin-top:4px">Encontre o Wallet ID no painel Asaas em Minha Conta → Integrações. Preencha os dois campos pra cobrar dos times ao aprovar cada inscrição (Arena fica com 8%); deixe em branco pra não cobrar nada.</p>
      <button class="btn primary" data-save-config>Salvar configurações</button>
```

- [ ] **Step 2: Wire the save handler**

Find (in `src/pages/championship/index.js`):
```js
    const slugEl = root.querySelector('[data-public-slug]');
    if (slugEl) {
      const desired = slugify(slugEl.value);
      if (desired && desired !== store.getState().publicSlug) {
        const available = await checkSlugAvailable(desired, store.getState().id);
        if (!available) {return toast('Essa URL já está em uso por outro campeonato. Escolha outra.');}
      }
      const slugResult = store.setPublicSlug(slugEl.value);
      if (!slugResult.ok) {return;}
    }
    await persist();
```

Replace:
```js
    const slugEl = root.querySelector('[data-public-slug]');
    if (slugEl) {
      const desired = slugify(slugEl.value);
      if (desired && desired !== store.getState().publicSlug) {
        const available = await checkSlugAvailable(desired, store.getState().id);
        if (!available) {return toast('Essa URL já está em uso por outro campeonato. Escolha outra.');}
      }
      const slugResult = store.setPublicSlug(slugEl.value);
      if (!slugResult.ok) {return;}
    }
    const feeEl = root.querySelector('[data-registration-fee]');
    const walletEl = root.querySelector('[data-asaas-wallet-id]');
    if (feeEl && walletEl) {store.setRegistrationFee(feeEl.value, walletEl.value);}
    await persist();
```

- [ ] **Step 3: Manual check**

Run: `npm run build`
Expected: build succeeds (this task adds no new automated test — it's pure UI wiring over the already-tested `setRegistrationFee`; `npm test` in Task 9's final pass covers no-regression)

- [ ] **Step 4: Commit**

```bash
git add src/pages/championship/tabs/config.js src/pages/championship/index.js
git commit -m "feat: add registration fee and Asaas wallet id fields to config tab"
```

---

### Task 6: Freeze fee on approval + payment badge in the registrations tab

**Files:**
- Modify: `src/pages/championship/index.js`
- Modify: `src/pages/championship/tabs/registrations.js`
- Test: `src/pages/championship/tabs/registrations.test.js`

**Interfaces:**
- Consumes: `store.getState().registrationFee` (Task 4/5).
- Produces: on approve, the registration document gains `feeStatus: 'pending'` and `feeAmount: <frozen number>` when a fee is configured (nothing added when it isn't). `registrationStatusLabel`/`renderRegistrations` signature unchanged; `renderRegistrations` now also renders a badge for `item.feeStatus`.

- [ ] **Step 1: Write the failing test**

Find (in `src/pages/championship/tabs/registrations.test.js`):
```js
  it('filters registrations by team, responsible or protocol', () => {
```

Add, directly before it:
```js
  it('shows a payment badge for approved registrations with a fee', () => {
    const dom = new JSDOM('<div id="root"></div>');
    const root = dom.window.document.querySelector('#root');
    root.innerHTML = renderRegistrations({}, { registrations: [
      { id: 'p1', teamName: 'Paga', status: 'approved', feeStatus: 'paid', feeAmount: 50, athletes: [] },
      { id: 'p2', teamName: 'Pendente', status: 'approved', feeStatus: 'pending', feeAmount: 50, athletes: [] },
      { id: 'p3', teamName: 'Sem taxa', status: 'approved', athletes: [] },
    ] });
    const rows = root.querySelectorAll('[data-registration-row]');
    expect(rows[0].textContent).toMatch(/pago/i);
    expect(rows[0].textContent).toMatch(/50/);
    expect(rows[1].textContent).toMatch(/aguardando/i);
    expect(rows[2].textContent).not.toMatch(/pago|aguardando/i);
  });

```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/championship/tabs/registrations.test.js -t "payment badge"`
Expected: FAIL — `rows[0].textContent` doesn't match `/pago/i`

- [ ] **Step 3: Implement the badge**

Find (in `src/pages/championship/tabs/registrations.js`):
```js
          <span class="tag">${registrationStatusLabel(item.status)}</span>
          ${item.status === 'pending' ? `
            <button class="btn primary" data-approve-registration="${item.id}">Aprovar</button>
            <button class="btn ghost" data-reject-registration="${item.id}">Recusar</button>
          ` : ''}
```

Replace:
```js
          <span class="tag">${registrationStatusLabel(item.status)}</span>
          ${item.status === 'approved' && item.feeStatus ? `<span class="tag" style="color:var(--${item.feeStatus === 'paid' ? 'success' : 'warning'})">${item.feeStatus === 'paid' ? `Pago · R$ ${Number(item.feeAmount || 0).toFixed(2)}` : `Aguardando pagamento · R$ ${Number(item.feeAmount || 0).toFixed(2)}`}</span>` : ''}
          ${item.status === 'pending' ? `
            <button class="btn primary" data-approve-registration="${item.id}">Aprovar</button>
            <button class="btn ghost" data-reject-registration="${item.id}">Recusar</button>
          ` : ''}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/pages/championship/tabs/registrations.test.js`
Expected: PASS, all tests in the file green

- [ ] **Step 5: Freeze the fee on approval**

Find (in `src/pages/championship/index.js`):
```js
  root.querySelectorAll('[data-approve-registration]').forEach((button) => button.onclick = async () => {
    if (!superadmin && !can(store.getState(), auth.currentUser, 'registrations')) {return toast('Seu perfil não pode analisar inscrições.');}
    button.disabled = true;
    try {
      await updateRegistration(store.getState().id, button.dataset.approveRegistration, { status: 'approved', reviewedAt: Date.now(), reviewedBy: auth.currentUser?.uid || null });
      const item = registrations.find((entry) => entry.id === button.dataset.approveRegistration);
      if (item) {item.status = 'approved';}
      await addAudit(store.getState().id, 'registration_approved', `Inscrição aprovada: ${item?.teamName || button.dataset.approveRegistration}`);
      render();
    } catch (error) {button.disabled = false; toast(error.message || 'Não foi possível aprovar a inscrição.');}
  });
```

Replace:
```js
  root.querySelectorAll('[data-approve-registration]').forEach((button) => button.onclick = async () => {
    if (!superadmin && !can(store.getState(), auth.currentUser, 'registrations')) {return toast('Seu perfil não pode analisar inscrições.');}
    button.disabled = true;
    try {
      const fee = Number(store.getState().registrationFee) || 0;
      const feeFields = fee > 0 ? { feeStatus: 'pending', feeAmount: fee } : {};
      await updateRegistration(store.getState().id, button.dataset.approveRegistration, { status: 'approved', reviewedAt: Date.now(), reviewedBy: auth.currentUser?.uid || null, ...feeFields });
      const item = registrations.find((entry) => entry.id === button.dataset.approveRegistration);
      if (item) {item.status = 'approved'; Object.assign(item, feeFields);}
      await addAudit(store.getState().id, 'registration_approved', `Inscrição aprovada: ${item?.teamName || button.dataset.approveRegistration}`);
      render();
    } catch (error) {button.disabled = false; toast(error.message || 'Não foi possível aprovar a inscrição.');}
  });
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/championship/index.js src/pages/championship/tabs/registrations.js src/pages/championship/tabs/registrations.test.js
git commit -m "feat: freeze registration fee on approval and show payment badge to organizer"
```

---

### Task 7: Client checkout wrapper

**Files:**
- Modify: `src/services/billing.js`

**Interfaces:**
- Produces: `createRegistrationCheckout(championshipId: string, registrationId: string) => Promise<{checkoutUrl: string}>`. Unauthenticated (unlike `createCheckout`/`cancelSubscription`, does not use `callBillingFunction`/`auth.currentUser`).

- [ ] **Step 1: Implement**

Find (in `src/services/billing.js`):
```js
export async function cancelSubscription() {
  return callBillingFunction('cancelSubscription', {});
}
```

Replace:
```js
export async function cancelSubscription() {
  return callBillingFunction('cancelSubscription', {});
}

// Sem autenticação — o time pagando a taxa de inscrição nunca fez login, só tem o id da
// inscrição (recebido no protocolo de envio).
export async function createRegistrationCheckout(championshipId, registrationId) {
  const response = await fetch(`${FUNCTIONS_BASE}/createRegistrationCheckout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ championshipId, registrationId }),
  });
  if (!response.ok) {throw new Error(await response.text() || 'Não foi possível gerar o pagamento.');}
  return response.json();
}
```

- [ ] **Step 2: Manual check**

Run: `npm run build`
Expected: succeeds (no existing test file covers `billing.js` directly — it's a thin fetch wrapper exercised end-to-end by Task 8's page; the exported function is what Task 8 imports and calls)

- [ ] **Step 3: Commit**

```bash
git add src/services/billing.js
git commit -m "feat: add createRegistrationCheckout client wrapper"
```

---

### Task 8: Public registration-status page + confirmation-screen link + route

**Files:**
- Create: `src/pages/registration-status.js`
- Test: `src/pages/registration-status.test.js`
- Modify: `src/pages/registration.js`
- Test: `src/pages/registration.test.js`
- Modify: `src/app/main.js`

**Interfaces:**
- Consumes: `registrationStatusLabel` from `./championship/tabs/registrations.js` (Task 6, unchanged signature); `createRegistrationCheckout` from `../services/billing.js` (Task 7).
- Produces: `registrationStatusHTML({championshipName, registration}) => string` (pure, tested); `renderRegistrationStatus(root, championshipId, registrationId) => Promise<void>`; route `/inscrever/:championshipId/status/:registrationId`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest';
import { registrationStatusHTML } from './registration-status.js';

describe('registrationStatusHTML', () => {
  it('shows just the status when no fee is configured', () => {
    const html = registrationStatusHTML({ championshipName: 'Copa Teste', registration: { teamName: 'Aurora', status: 'approved' } });
    expect(html).toContain('Aurora');
    expect(html).toContain('Aprovada');
    expect(html).not.toContain('data-pay-fee');
  });

  it('shows a pay button when approved with a pending fee', () => {
    const html = registrationStatusHTML({ championshipName: 'Copa Teste', registration: { teamName: 'Aurora', status: 'approved', feeStatus: 'pending', feeAmount: 49.9 } });
    expect(html).toContain('data-pay-fee');
    expect(html).toContain('49.90');
  });

  it('shows a paid confirmation when the fee is already paid', () => {
    const html = registrationStatusHTML({ championshipName: 'Copa Teste', registration: { teamName: 'Aurora', status: 'approved', feeStatus: 'paid', feeAmount: 49.9 } });
    expect(html).not.toContain('data-pay-fee');
    expect(html).toMatch(/pagamento confirmado/i);
  });

  it('never shows a pay button before approval, even with a fee configured', () => {
    const html = registrationStatusHTML({ championshipName: 'Copa Teste', registration: { teamName: 'Aurora', status: 'pending', feeAmount: 49.9 } });
    expect(html).not.toContain('data-pay-fee');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/registration-status.test.js`
Expected: FAIL — cannot find module `./registration-status.js`

- [ ] **Step 3: Implement the page**

```js
import { navigate } from '../app/router-v2.js';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase.js';
import { esc } from '../app/utils.ts';
import { toastError } from '../components/Toast.js';
import { createRegistrationCheckout } from '../services/billing.js';
import { registrationStatusLabel } from './championship/tabs/registrations.js';

export function registrationStatusHTML({ championshipName, registration }) {
  const feeAmount = Number(registration.feeAmount || 0);
  const showPay = registration.status === 'approved' && registration.feeStatus === 'pending' && feeAmount > 0;
  const paid = registration.status === 'approved' && registration.feeStatus === 'paid';
  return `
    <div class="card" style="max-width:520px;margin:40px auto">
      <small>ACOMPANHAMENTO DE INSCRIÇÃO</small>
      <h1>${esc(championshipName)}</h1>
      <p><strong>${esc(registration.teamName || 'Equipe')}</strong></p>
      <p class="muted">Status: <strong>${registrationStatusLabel(registration.status)}</strong></p>
      ${paid ? `<p class="muted">✅ Pagamento confirmado — R$ ${feeAmount.toFixed(2)}</p>` : ''}
      ${showPay ? `<button class="btn primary" data-pay-fee style="margin-top:12px">Pagar inscrição (R$ ${feeAmount.toFixed(2)})</button>` : ''}
      <button class="btn ghost" style="margin-top:16px" data-back>← Voltar ao campeonato</button>
    </div>
  `;
}

export async function renderRegistrationStatus(root, championshipId, registrationId) {
  root.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/">ARENA</a></header><main class="section"><div class="card">Carregando...</div></main></div>`;

  const [champSnap, regSnap] = await Promise.all([
    getDoc(doc(db, 'publicChampionships', championshipId)),
    getDoc(doc(db, 'championships', championshipId, 'registrations', registrationId)),
  ]);
  if (!regSnap.exists()) {
    root.querySelector('main').innerHTML = '<div class="card"><h2>Inscrição não encontrada</h2></div>';
    return;
  }
  const championshipName = champSnap.exists() ? (champSnap.data().nome || 'Campeonato') : 'Campeonato';
  const registration = { id: regSnap.id, ...regSnap.data() };

  root.querySelector('main').innerHTML = registrationStatusHTML({ championshipName, registration });
  root.querySelector('[data-back]').onclick = () => navigate(`/publico/${championshipId}`);
  const payBtn = root.querySelector('[data-pay-fee]');
  if (payBtn) {
    payBtn.onclick = async () => {
      payBtn.disabled = true;
      payBtn.textContent = 'Gerando pagamento...';
      try {
        const { checkoutUrl } = await createRegistrationCheckout(championshipId, registrationId);
        window.location.href = checkoutUrl;
      } catch (error) {
        toastError(error.message || 'Não foi possível gerar o pagamento.');
        payBtn.disabled = false;
        payBtn.textContent = `Pagar inscrição (R$ ${Number(registration.feeAmount || 0).toFixed(2)})`;
      }
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/pages/registration-status.test.js`
Expected: PASS

- [ ] **Step 5: Add the route**

Find (in `src/app/main.js`):
```js
import { renderDrawDisplay } from '../pages/draw-display.js';
```

Replace:
```js
import { renderDrawDisplay } from '../pages/draw-display.js';
import { renderRegistrationStatus } from '../pages/registration-status.js';
```

Find:
```js
route('/sorteio/:id', safeRoute((params) => renderDrawDisplay(mainContent, params.id)));
```

Replace:
```js
route('/sorteio/:id', safeRoute((params) => renderDrawDisplay(mainContent, params.id)));
route('/inscrever/:championshipId/status/:registrationId', safeRoute((params) => renderRegistrationStatus(mainContent, params.championshipId, params.registrationId)));
```

- [ ] **Step 6: Add the confirmation-screen link**

Find (in `src/pages/registration.js`):
```js
      form.innerHTML = `
        <div style="text-align:center;padding:24px">
          <div style="font-size:48px;margin-bottom:16px">✅</div>
          <h2>Inscrição enviada</h2>
          <p class="muted">O organizador analisará os dados antes de confirmar a participação.</p>
          <p>Protocolo: <strong data-protocol>${esc(registration.id)}</strong> <button class="btn ghost sm" type="button" data-copy-protocol>Copiar</button></p>
          <button class="btn ghost" style="margin-top:16px" data-back>← Voltar ao campeonato</button>
        </div>
      `;
      root.querySelector('[data-back]').onclick = () => navigate(`/publico/${id}`);
      root.querySelector('[data-copy-protocol]').onclick = async (event) => {
        try { await copyRegistrationProtocol(registration.id); event.currentTarget.textContent = 'Copiado'; }
        catch { event.currentTarget.textContent = 'Falha ao copiar'; }
      };
```

Replace:
```js
      form.innerHTML = `
        <div style="text-align:center;padding:24px">
          <div style="font-size:48px;margin-bottom:16px">✅</div>
          <h2>Inscrição enviada</h2>
          <p class="muted">O organizador analisará os dados antes de confirmar a participação.</p>
          <p>Protocolo: <strong data-protocol>${esc(registration.id)}</strong> <button class="btn ghost sm" type="button" data-copy-protocol>Copiar</button></p>
          <button class="btn primary" style="margin-top:16px" data-track-registration>Acompanhar inscrição e pagamento →</button>
          <button class="btn ghost" style="margin-top:8px" data-back>← Voltar ao campeonato</button>
        </div>
      `;
      root.querySelector('[data-back]').onclick = () => navigate(`/publico/${id}`);
      root.querySelector('[data-track-registration]').onclick = () => navigate(`/inscrever/${id}/status/${registration.id}`);
      root.querySelector('[data-copy-protocol]').onclick = async (event) => {
        try { await copyRegistrationProtocol(registration.id); event.currentTarget.textContent = 'Copiado'; }
        catch { event.currentTarget.textContent = 'Falha ao copiar'; }
      };
```

- [ ] **Step 7: Run the existing registration test suite**

Run: `npm test -- src/pages/registration.test.js`
Expected: PASS — this file tests only `validateRegistrationForm`/`copyRegistrationProtocol`, which are untouched, so it stays green with no edits needed.

- [ ] **Step 8: Commit**

```bash
git add src/pages/registration-status.js src/pages/registration-status.test.js src/pages/registration.js src/app/main.js
git commit -m "feat: add public registration-status page with payment button"
```

---

### Task 9: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, 0 failures

- [ ] **Step 2: Run the functions test suite**

Run: `cd functions && node --test`
Expected: all tests pass, 0 failures

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: 0 errors

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: succeeds

- [ ] **Step 5: Verify routes**

Run: `node scripts/verify-routes.mjs`
Expected: passes (this repo runs this script by convention whenever routes are added — Task 8 added `/inscrever/:championshipId/status/:registrationId`)

- [ ] **Step 6: Re-run the security audit**

Run: `node scripts/security-audit.mjs`
Expected: passes (final check after all `firestore.rules`/`functions/` changes in this branch)
