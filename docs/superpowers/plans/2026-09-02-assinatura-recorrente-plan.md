# Assinatura Recorrente Automática Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o checkout manual (chave Pix fixa + aprovação manual do superadmin) por assinatura recorrente automática via Mercado Pago e Asaas: o usuário escolhe plano e provedor, paga num link hospedado, ativa/renova/expira sozinho via webhook.

**Architecture:** `functions/` ganha `createCheckout` (cria a assinatura no provedor escolhido e devolve o link hospedado), `cancelSubscription` (cancela de verdade no provedor), `checkExpiredSubscriptions` (função agendada, rede de segurança), e `billingWebhook` estendido pra entender eventos de assinatura recorrente dos dois provedores — não só pagamento avulso. A decisão "este evento de webhook significa o quê" vira uma função pura testável em `functions/lib/billing-logic.js`, deixando `functions/index.js` fino (HTTP + Firestore), do mesmo jeito que o resto do projeto trata módulos que tocam Firebase. No frontend, `src/services/billing.js`, `src/pages/plans.js` e `src/pages/plans-billing.js` trocam o fluxo manual pelo automático.

**Tech Stack:** Cloud Functions v2 (Node 20, `firebase-functions`/`firebase-admin`, CommonJS), `node:test` (novo, só em `functions/` — sem dependência nova), Vitest no frontend (já existente).

## Global Constraints

- `functions/` é um pacote de deploy separado — só o conteúdo de `functions/` é enviado ao Cloud Functions. **Nunca** `require('../src/...')` dentro de `functions/`. Preço de plano fica duplicado à mão em `functions/index.js` (`PLAN_PRICES`), com comentário apontando pra `src/app/plans.js` como fonte da verdade.
- **Nunca confiar em preço vindo do cliente.** `createCheckout` sempre busca o valor em `PLAN_PRICES[planId]` no servidor, ignora qualquer `amount` que venha no corpo da requisição.
- Toda credencial de provedor de pagamento fica em `defineSecret`, nunca em código nem em variável de ambiente comum.
- `createCheckout`/`cancelSubscription` exigem `Authorization: Bearer <Firebase ID token>`, verificado com `admin.auth().verifyIdToken`. `billingWebhook` continua exigindo a assinatura/token do provedor (já existente), nunca ID token — quem chama é o provedor, não o navegador.
- Escrita em `users/{uid}.billing` dentro de transação: **sempre ler o `billing` existente antes de escrever** (via `tx.get`) e espalhar (`...existingBilling`) — `set(..., {merge:true})` faz merge raso; um campo de objeto aninhado como `billing` é **substituído inteiro**, não mesclado campo a campo. Toda leitura de transação vem antes de toda escrita (`tx.get` antes de `tx.create`/`tx.set`), senão o Firestore rejeita a transação em runtime.
- `functions/index.js` e seus novos handlers HTTP não ganham teste automatizado próprio — só a lógica pura em `functions/lib/billing-logic.js` é testada, mesmo padrão já usado no resto do projeto pra módulo que só faz fetch/Firestore (`src/services/championships.js`, `src/services/audit.js` etc. também não têm teste próprio).
- `npm test` (raiz) e `node --test` (dentro de `functions/`) precisam passar depois de cada tarefa que toca esses arquivos. `npm run build` depois da última tarefa.

## File Structure

| File | Responsibility |
|---|---|
| `functions/lib/billing-logic.js` | Puro, sem Firebase: normaliza evento de webhook (Asaas/Mercado Pago) pra `{eventId, reference, subscriptionId, status, periodEndMs}`, calcula próximo período e se passou do prazo de graça |
| `functions/lib/billing-logic.test.js` | Testes da acima, via `node:test` |
| `functions/package.json` | Modify: adiciona `"test": "node --test"` |
| `.github/workflows/ci.yml` | Modify: roda os testes de `functions/` também |
| `functions/index.js` | Modify: `createCheckout`, `cancelSubscription`, `checkExpiredSubscriptions` novos; `billingWebhook` reescrito em cima de `billing-logic.js` |
| `src/services/billing.js` | Modify: `requestPlan`/`PIX_KEY` saem, entram `createCheckout(planId, provider)` e `cancelSubscription()` |
| `src/pages/plans.js` | Modify: botões por provedor, estado pendente/ativo/cancelamento |
| `src/pages/plans-billing.js` | Modify: remove fila de aprovação manual, mantém auditoria + troca manual de emergência |
| `src/services/billing-webhook.js` | **Delete** — lógica equivalente nunca foi usada (roda no bundle do frontend, mas o webhook real é servido por `functions/index.js`, que nunca importou este arquivo); substituída por `functions/lib/billing-logic.js`, que fica no pacote certo |
| `src/services/billing-webhook.test.js` | **Delete** — junto com o arquivo acima |

---

### Task 1: Lógica pura de normalização de webhook — `functions/lib/billing-logic.js`

**Files:**
- Create: `functions/lib/billing-logic.js`
- Create: `functions/lib/billing-logic.test.js`
- Modify: `functions/package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces (consumido pela Task 5): `parseReference(raw): {userId,planId}|null`, `nextPeriodEnd(fromMs?): number`, `isPastGrace(currentPeriodEndMs, nowMs?, graceDays?): boolean`, `normalizeAsaasEvent(body): {eventId, reference, subscriptionId, status, periodEndMs}`, `normalizeMercadoPagoPreapproval(preapproval): {...mesmo formato}`, `normalizeMercadoPagoPayment(payment): {...mesmo formato}`. `status` é `'active'|'past_due'|'cancelled'|null` (`null` = evento reconhecido mas sem ação, ex.: assinatura ainda `pending`).

- [ ] **Step 1: Escrever os testes (falhando)**

Create `functions/lib/billing-logic.test.js`:
```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseReference, nextPeriodEnd, isPastGrace,
  normalizeAsaasEvent, normalizeMercadoPagoPreapproval, normalizeMercadoPagoPayment,
} = require('./billing-logic.js');

test('parseReference', async (t) => {
  await t.test('parses a valid userId/planId JSON string', () => {
    assert.deepEqual(parseReference('{"userId":"u1","planId":"pro"}'), { userId: 'u1', planId: 'pro' });
  });
  await t.test('returns null for missing fields, invalid JSON, or empty input', () => {
    assert.equal(parseReference('{"userId":"u1"}'), null);
    assert.equal(parseReference('not json'), null);
    assert.equal(parseReference(''), null);
    assert.equal(parseReference(undefined), null);
  });
});

test('nextPeriodEnd advances exactly one UTC month', () => {
  const start = Date.UTC(2026, 0, 31); // 31 Jan
  const end = nextPeriodEnd(start);
  assert.equal(new Date(end).getUTCMonth(), 1); // rola pra fevereiro
});

test('isPastGrace', async (t) => {
  const periodEnd = Date.UTC(2026, 0, 1);
  const day = 24 * 60 * 60 * 1000;
  await t.test('false antes do prazo de graça acabar', () => {
    assert.equal(isPastGrace(periodEnd, periodEnd + 2 * day), false);
  });
  await t.test('true depois do prazo de graça acabar', () => {
    assert.equal(isPastGrace(periodEnd, periodEnd + 4 * day), true);
  });
  await t.test('false pra período nunca definido (nunca ativou)', () => {
    assert.equal(isPastGrace(undefined, Date.now()), false);
  });
});

test('normalizeAsaasEvent', async (t) => {
  await t.test('PAYMENT_RECEIVED ativa e define período', () => {
    const result = normalizeAsaasEvent({ id: 'evt1', event: 'PAYMENT_RECEIVED', payment: { id: 'pay1', subscription: 'sub1', externalReference: '{"userId":"u1","planId":"pro"}' } });
    assert.equal(result.status, 'active');
    assert.equal(result.reference.userId, 'u1');
    assert.equal(result.subscriptionId, 'sub1');
    assert.ok(result.periodEndMs > Date.now());
  });
  await t.test('PAYMENT_OVERDUE move pra past_due sem período novo', () => {
    const result = normalizeAsaasEvent({ id: 'evt2', event: 'PAYMENT_OVERDUE', payment: { id: 'pay2', subscription: 'sub1', externalReference: '{"userId":"u1","planId":"pro"}' } });
    assert.equal(result.status, 'past_due');
    assert.equal(result.periodEndMs, null);
  });
  await t.test('SUBSCRIPTION_DELETED cancela', () => {
    const result = normalizeAsaasEvent({ id: 'evt3', event: 'SUBSCRIPTION_DELETED', subscription: { id: 'sub1', externalReference: '{"userId":"u1","planId":"pro"}' } });
    assert.equal(result.status, 'cancelled');
  });
  await t.test('evento não reconhecido normaliza pra status nulo (ignorado por quem chama)', () => {
    const result = normalizeAsaasEvent({ id: 'evt4', event: 'CHECKOUT_PAID', payment: {} });
    assert.equal(result.status, null);
  });
});

test('normalizeMercadoPagoPreapproval', async (t) => {
  await t.test('authorized ativa e define período', () => {
    const result = normalizeMercadoPagoPreapproval({ id: 'pre1', status: 'authorized', external_reference: '{"userId":"u1","planId":"pro"}' });
    assert.equal(result.status, 'active');
    assert.ok(result.periodEndMs > Date.now());
  });
  await t.test('cancelled e paused cancelam os dois', () => {
    assert.equal(normalizeMercadoPagoPreapproval({ id: 'pre1', status: 'cancelled' }).status, 'cancelled');
    assert.equal(normalizeMercadoPagoPreapproval({ id: 'pre1', status: 'paused' }).status, 'cancelled');
  });
  await t.test('status pending normaliza pra nulo (ignorado)', () => {
    assert.equal(normalizeMercadoPagoPreapproval({ id: 'pre1', status: 'pending' }).status, null);
  });
});

test('normalizeMercadoPagoPayment', async (t) => {
  await t.test('approved ativa, lendo a referência do metadata', () => {
    const result = normalizeMercadoPagoPayment({ id: 'pay1', status: 'approved', preapproval_id: 'pre1', metadata: { userId: 'u1', planId: 'pro' } });
    assert.equal(result.status, 'active');
    assert.equal(result.reference.userId, 'u1');
    assert.equal(result.subscriptionId, 'pre1');
  });
  await t.test('rejected move pra past_due', () => {
    assert.equal(normalizeMercadoPagoPayment({ id: 'pay2', status: 'rejected', metadata: { userId: 'u1', planId: 'pro' } }).status, 'past_due');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd functions && node --test`
Expected: FAIL — `Cannot find module './billing-logic.js'`

- [ ] **Step 3: Implementar**

Create `functions/lib/billing-logic.js`:
```js
'use strict';

const GRACE_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseReference(raw) {
  try {
    const value = JSON.parse(raw || '{}');
    return value && value.userId && value.planId ? { userId: String(value.userId), planId: String(value.planId) } : null;
  } catch {
    return null;
  }
}

function nextPeriodEnd(fromMs) {
  const date = new Date(fromMs == null ? Date.now() : fromMs);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.getTime();
}

function isPastGrace(currentPeriodEndMs, nowMs, graceDays) {
  const now = nowMs == null ? Date.now() : nowMs;
  const grace = graceDays == null ? GRACE_DAYS : graceDays;
  if (!Number.isFinite(currentPeriodEndMs)) {return false;}
  return now > currentPeriodEndMs + grace * MS_PER_DAY;
}

// Asaas manda um evento por momento do ciclo de vida da assinatura. Cada um carrega `payment`
// (uma cobrança gerada) ou `subscription` (o objeto da assinatura em si).
function normalizeAsaasEvent(body) {
  const event = String((body && body.event) || '');
  const payment = (body && body.payment) || {};
  const subscription = (body && body.subscription) || {};
  const reference = parseReference(payment.externalReference || subscription.externalReference);
  const eventId = String((body && body.id) || payment.id || subscription.id || '');
  const subscriptionId = String(payment.subscription || subscription.id || '');
  if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
    return { eventId, reference, subscriptionId, status: 'active', periodEndMs: nextPeriodEnd() };
  }
  if (event === 'PAYMENT_OVERDUE') {
    return { eventId, reference, subscriptionId, status: 'past_due', periodEndMs: null };
  }
  if (event === 'SUBSCRIPTION_DELETED') {
    return { eventId, reference, subscriptionId, status: 'cancelled', periodEndMs: null };
  }
  return { eventId, reference, subscriptionId, status: null, periodEndMs: null };
}

// Mercado Pago manda `type: 'subscription_preapproval'` quando a assinatura em si muda de
// status (usuário terminou o checkout hospedado, ou cancelou), e `type: 'payment'` /
// `'subscription_authorized_payment'` pra cada cobrança individual do ciclo.
function normalizeMercadoPagoPreapproval(preapproval) {
  const statusMap = { authorized: 'active', paused: 'cancelled', cancelled: 'cancelled' };
  const status = (preapproval && statusMap[preapproval.status]) || null;
  return {
    eventId: `preapproval_${(preapproval && preapproval.id) || ''}_${(preapproval && preapproval.status) || ''}`,
    reference: parseReference(preapproval && preapproval.external_reference),
    subscriptionId: String((preapproval && preapproval.id) || ''),
    status,
    periodEndMs: status === 'active' ? nextPeriodEnd() : null,
  };
}

function normalizeMercadoPagoPayment(payment) {
  const rawReference = payment && payment.metadata && Object.keys(payment.metadata).length
    ? JSON.stringify(payment.metadata)
    : (payment && payment.external_reference);
  const base = {
    eventId: String((payment && payment.id) || ''),
    reference: parseReference(rawReference),
    subscriptionId: String((payment && payment.preapproval_id) || ''),
  };
  if (payment && payment.status === 'approved') {return { ...base, status: 'active', periodEndMs: nextPeriodEnd() };}
  if (payment && payment.status === 'rejected') {return { ...base, status: 'past_due', periodEndMs: null };}
  return { ...base, status: null, periodEndMs: null };
}

module.exports = {
  parseReference,
  nextPeriodEnd,
  isPastGrace,
  normalizeAsaasEvent,
  normalizeMercadoPagoPreapproval,
  normalizeMercadoPagoPayment,
};
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd functions && node --test`
Expected: PASS — todos os `test`/`t.test` verdes

- [ ] **Step 5: Adicionar o script de teste no `functions/package.json`**

Find:
```json
{
  "name": "arena-functions",
  "private": true,
  "engines": { "node": "20" },
  "main": "index.js",
  "dependencies": {
    "firebase-admin": "^13.0.0",
    "firebase-functions": "^6.0.0"
  }
}
```

Replace with:
```json
{
  "name": "arena-functions",
  "private": true,
  "engines": { "node": "20" },
  "main": "index.js",
  "scripts": {
    "test": "node --test"
  },
  "dependencies": {
    "firebase-admin": "^13.0.0",
    "firebase-functions": "^6.0.0"
  }
}
```

- [ ] **Step 6: Rodar os testes da raiz do projeto pra garantir que nada quebrou**

Run: `npm test`
Expected: PASS (415/415, sem mudança — esta tarefa não toca `src/`)

- [ ] **Step 7: Fazer o CI rodar os testes de `functions/` também**

Find, em `.github/workflows/ci.yml`:
```yaml
      - name: Run tests
        run: npm test
```

Replace with:
```yaml
      - name: Run tests
        run: npm test

      - name: Run functions tests
        run: cd functions && node --test
```

- [ ] **Step 8: Commit**

```bash
git add functions/lib/billing-logic.js functions/lib/billing-logic.test.js functions/package.json .github/workflows/ci.yml
git commit -m "feat: add pure billing-event normalization logic for functions/

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Remover código morto — `src/services/billing-webhook.js`

**Files:**
- Delete: `src/services/billing-webhook.js`
- Delete: `src/services/billing-webhook.test.js`

**Interfaces:** Nenhuma — nada importa este arquivo (`grep -rln "billing-webhook" src --include="*.js"` só retorna o próprio arquivo e seu teste). A lógica equivalente e testada agora vive em `functions/lib/billing-logic.js` (Task 1), que é onde o webhook de verdade roda — este módulo em `src/services/` nunca poderia ser chamado pelo `functions/index.js` real (pacotes de deploy separados) e não tem nenhum outro chamador no frontend.

- [ ] **Step 1: Confirmar que não há chamador antes de apagar**

Run: `grep -rln "billing-webhook" src --include="*.js"`
Expected: só lista `src/services/billing-webhook.js` e `src/services/billing-webhook.test.js`

- [ ] **Step 2: Apagar os dois arquivos**

```bash
git rm src/services/billing-webhook.js src/services/billing-webhook.test.js
```

- [ ] **Step 3: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS (398/415 → a contagem cai pelos testes removidos deste arquivo; nenhum teste de outro arquivo quebra)

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove dead billing-webhook.js (never wired to the real functions/ webhook)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `createCheckout` — cria a assinatura no Mercado Pago ou no Asaas

**Files:**
- Modify: `functions/index.js`

**Interfaces:**
- Consumes: `parseReference` não é usado aqui (a referência é montada, não lida); nenhuma dependência da Task 1 nesta tarefa especificamente.
- Produces (consumido pela Task 6): endpoint HTTP `POST /createCheckout` — corpo `{planId: 'pro'|'enterprise', provider: 'mercadopago'|'asaas'}`, header `Authorization: Bearer <ID token>` — resposta `200 {checkoutUrl}` ou erro (`400` plano/provedor inválido, `401` sem token/token inválido, `502` provedor falhou).

Sem teste automatizado — HTTP handler que só faz `fetch` externo e escreve no Firestore (mesma convenção de `functions/index.js` inteiro, sem testes próprios). Verificação manual na Task 9.

- [ ] **Step 1: Adicionar o secret novo, o mapa de preços, e o helper de autenticação**

Find:
```js
const crypto = require('crypto');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const asaasToken = defineSecret('ASAAS_WEBHOOK_TOKEN');
const mercadoPagoSecret = defineSecret('MERCADOPAGO_WEBHOOK_SECRET');
const mercadoPagoAccessToken = defineSecret('MERCADOPAGO_ACCESS_TOKEN');
```

Replace with:
```js
const crypto = require('crypto');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const asaasWebhookToken = defineSecret('ASAAS_WEBHOOK_TOKEN');
const asaasAccessToken = defineSecret('ASAAS_ACCESS_TOKEN');
const mercadoPagoSecret = defineSecret('MERCADOPAGO_WEBHOOK_SECRET');
const mercadoPagoAccessToken = defineSecret('MERCADOPAGO_ACCESS_TOKEN');

// Mantido em dia à mão com src/app/plans.js — este pacote (functions/) é enviado ao deploy
// sozinho, sem acesso a src/, então não dá pra importar PLAN_DEFINITIONS direto. Nunca confiar
// em preço vindo do cliente: createCheckout sempre lê o valor daqui.
const PLAN_PRICES = { pro: { name: 'Pro', price: 49.9 }, enterprise: { name: 'Enterprise', price: 199.9 } };

async function requireUser(req, res) {
  const authHeader = req.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {res.status(401).send('Missing token'); return null;}
  try {
    return await admin.auth().verifyIdToken(token);
  } catch {
    res.status(401).send('Invalid token');
    return null;
  }
}
```

- [ ] **Step 2: Trocar as referências ao secret renomeado (`asaasToken` → `asaasWebhookToken`)**

`mpSignatureValid` em si não muda — só as duas referências a `asaasToken` no corpo de `billingWebhook`. Find:
```js
  if (provider === 'asaas' && !equal(req.get('asaas-access-token'), asaasToken.value())) {res.status(401).send('Invalid signature'); return;}
```

Replace with:
```js
  if (provider === 'asaas' && !equal(req.get('asaas-access-token'), asaasWebhookToken.value())) {res.status(401).send('Invalid signature'); return;}
```

Find:
```js
exports.billingWebhook = onRequest({ secrets: [asaasToken, mercadoPagoSecret, mercadoPagoAccessToken], cors: false }, async (req, res) => {
```

Replace with:
```js
exports.billingWebhook = onRequest({ secrets: [asaasWebhookToken, mercadoPagoSecret, mercadoPagoAccessToken], cors: false }, async (req, res) => {
```

- [ ] **Step 3: Adicionar `createCheckout`**

Find:
```js
exports.billingWebhook = onRequest({ secrets: [asaasWebhookToken, mercadoPagoSecret, mercadoPagoAccessToken], cors: false }, async (req, res) => {
```

Replace with:
```js
exports.createCheckout = onRequest({ secrets: [asaasAccessToken, mercadoPagoAccessToken], cors: true }, async (req, res) => {
  if (req.method !== 'POST') {res.status(405).send('Method not allowed'); return;}
  const decoded = await requireUser(req, res);
  if (!decoded) {return;}
  const { planId, provider } = req.body || {};
  const plan = PLAN_PRICES[planId];
  if (!plan) {res.status(400).send('Invalid plan'); return;}
  if (!['mercadopago', 'asaas'].includes(provider)) {res.status(400).send('Invalid provider'); return;}
  const reference = JSON.stringify({ userId: decoded.uid, planId });
  const returnUrl = 'https://arena-campeonatos.web.app/planos';

  let checkoutUrl, subscriptionId;
  try {
    if (provider === 'mercadopago') {
      const response = await fetch('https://api.mercadopago.com/preapproval', {
        method: 'POST',
        headers: { Authorization: `Bearer ${mercadoPagoAccessToken.value()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: `Arena Campeonatos — plano ${plan.name}`,
          external_reference: reference,
          payer_email: decoded.email,
          back_url: returnUrl,
          auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: plan.price, currency_id: 'BRL' },
        }),
      });
      if (!response.ok) {throw new Error(`Mercado Pago retornou ${response.status}`);}
      const created = await response.json();
      checkoutUrl = created.init_point;
      subscriptionId = String(created.id);
    } else {
      const nextDueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
      const response = await fetch('https://api.asaas.com/v3/checkouts', {
        method: 'POST',
        headers: { access_token: asaasAccessToken.value(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingTypes: ['CREDIT_CARD', 'PIX'],
          chargeTypes: ['RECURRENT'],
          minutesToExpire: 60,
          callback: { successUrl: returnUrl, cancelUrl: returnUrl, expiredUrl: returnUrl },
          items: [{ name: `Arena Campeonatos — plano ${plan.name}`, description: `Assinatura mensal do plano ${plan.name}`, quantity: 1, value: plan.price }],
          subscription: { cycle: 'MONTHLY', nextDueDate },
          externalReference: reference,
        }),
      });
      if (!response.ok) {throw new Error(`Asaas retornou ${response.status}`);}
      const created = await response.json();
      checkoutUrl = `https://checkout.asaas.com/${created.id}`;
      subscriptionId = String(created.id);
    }
  } catch (error) {
    res.status(502).send(error.message);
    return;
  }

  await db.collection('users').doc(decoded.uid).set({
    email: decoded.email || '',
    billing: { planId, status: 'pending', provider, subscriptionId, checkoutUrl, amount: plan.price, requestedAt: Date.now() },
    updated: Date.now(),
  }, { merge: true });

  res.status(200).json({ checkoutUrl });
});

exports.billingWebhook = onRequest({ secrets: [asaasWebhookToken, mercadoPagoSecret, mercadoPagoAccessToken], cors: false }, async (req, res) => {
```

- [ ] **Step 4: Rodar a suíte da raiz (não deve mudar — este arquivo não é coberto por `npm test`)**

Run: `npm test`
Expected: PASS, mesma contagem da Task 2

- [ ] **Step 5: Commit**

```bash
git add functions/index.js
git commit -m "feat: add createCheckout — creates a real Mercado Pago/Asaas subscription checkout

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `cancelSubscription` — cancela de verdade no provedor

**Files:**
- Modify: `functions/index.js`

**Interfaces:**
- Produces (consumido pela Task 6): endpoint HTTP `POST /cancelSubscription` — sem corpo, só `Authorization: Bearer <ID token>` — resposta `200 {ok:true}` ou erro (`400` sem assinatura pra cancelar, `401` sem token, `502` provedor falhou).

Sem teste automatizado, mesma razão da Task 3.

- [ ] **Step 1: Adicionar `cancelSubscription`**

Find:
```js
exports.billingWebhook = onRequest({ secrets: [asaasWebhookToken, mercadoPagoSecret, mercadoPagoAccessToken], cors: false }, async (req, res) => {
```

Replace with:
```js
exports.cancelSubscription = onRequest({ secrets: [asaasAccessToken, mercadoPagoAccessToken], cors: true }, async (req, res) => {
  if (req.method !== 'POST') {res.status(405).send('Method not allowed'); return;}
  const decoded = await requireUser(req, res);
  if (!decoded) {return;}
  const userRef = db.collection('users').doc(decoded.uid);
  const snap = await userRef.get();
  const billing = snap.data()?.billing;
  if (!billing?.subscriptionId || !billing?.provider) {res.status(400).send('Nenhuma assinatura ativa'); return;}

  try {
    if (billing.provider === 'mercadopago') {
      const response = await fetch(`https://api.mercadopago.com/preapproval/${billing.subscriptionId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${mercadoPagoAccessToken.value()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (!response.ok) {throw new Error(`Mercado Pago retornou ${response.status}`);}
    } else {
      const response = await fetch(`https://api.asaas.com/v3/subscriptions/${billing.subscriptionId}`, {
        method: 'DELETE',
        headers: { access_token: asaasAccessToken.value() },
      });
      if (!response.ok) {throw new Error(`Asaas retornou ${response.status}`);}
    }
  } catch (error) {
    res.status(502).send(error.message);
    return;
  }

  await userRef.set({ billing: { ...billing, status: 'cancelled', cancelledAt: Date.now() }, updated: Date.now() }, { merge: true });
  res.status(200).json({ ok: true });
});

exports.billingWebhook = onRequest({ secrets: [asaasWebhookToken, mercadoPagoSecret, mercadoPagoAccessToken], cors: false }, async (req, res) => {
```

- [ ] **Step 2: Rodar a suíte da raiz**

Run: `npm test`
Expected: PASS, mesma contagem da Task 3

- [ ] **Step 3: Commit**

```bash
git add functions/index.js
git commit -m "feat: add cancelSubscription — cancels the subscription at the provider, not just locally

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Reescrever `billingWebhook` sobre `billing-logic.js` + função agendada de expiração

**Files:**
- Modify: `functions/index.js`

**Interfaces:**
- Consumes: `parseReference` (não usado diretamente — vem embutido nos `normalize*`), `normalizeAsaasEvent`, `normalizeMercadoPagoPreapproval`, `normalizeMercadoPagoPayment`, `isPastGrace` de `./lib/billing-logic.js` (Task 1).
- Produces: `billingWebhook` continua em `POST /billingWebhook?provider=asaas|mercadopago`, agora processando assinatura recorrente, não só pagamento avulso. `checkExpiredSubscriptions` roda sozinha 1x/dia, sem endpoint.

Sem teste automatizado neste arquivo — a decisão de negócio (`normalizeAsaasEvent` etc.) já está testada na Task 1; aqui só resta orquestração HTTP/Firestore.

- [ ] **Step 1: Importar `billing-logic.js` e reescrever `billingWebhook`**

Find:
```js
const crypto = require('crypto');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
```

Replace with:
```js
const crypto = require('crypto');
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const {
  isPastGrace,
  normalizeAsaasEvent,
  normalizeMercadoPagoPreapproval,
  normalizeMercadoPagoPayment,
} = require('./lib/billing-logic.js');
```

Find the entire current `eventData`/`billingWebhook` block:
```js
async function eventData(provider, body) {
  if (provider === 'asaas') {
    const payment = body.payment || {};
    return { eventId: body.id || payment.id, status: payment.status, reference: payment.externalReference };
  }
  const paymentId = body.data?.id || body.id;
  let payment = body;
  if (paymentId && !body.metadata?.userId) {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${mercadoPagoAccessToken.value()}` } });
    if (!response.ok) throw new Error(`Mercado Pago API returned ${response.status}`);
    payment = await response.json();
  }
  return { eventId: paymentId, status: payment.status, reference: payment.metadata ? JSON.stringify(payment.metadata) : '' };
}

exports.billingWebhook = onRequest({ secrets: [asaasWebhookToken, mercadoPagoSecret, mercadoPagoAccessToken], cors: false }, async (req, res) => {
  if (req.method !== 'POST') {res.status(405).send('Method not allowed'); return;}
  const provider = String(req.query.provider || '').toLowerCase();
  if (!['asaas', 'mercadopago'].includes(provider)) {res.status(400).send('Provider required'); return;}
  if (provider === 'asaas' && !equal(req.get('asaas-access-token'), asaasWebhookToken.value())) {res.status(401).send('Invalid signature'); return;}
  if (provider === 'mercadopago' && !mpSignatureValid(req)) {res.status(401).send('Invalid signature'); return;}
  let data;
  try { data = await eventData(provider, req.body || {}); } catch (error) { res.status(502).send(error.message); return; }
  if (!data.eventId) {res.status(400).send('Event id required'); return;}
  const eventRef = db.collection('billingWebhookEvents').doc(String(data.eventId));
  const existing = await eventRef.get();
  if (existing.exists) {res.status(200).send('Already processed'); return;}
  let reference = {};
  try {reference = JSON.parse(data.reference || '{}');} catch {reference = {};}
  if (!reference.userId || !reference.planId) {res.status(400).send('Payment metadata required'); return;}
  const active = ['RECEIVED', 'CONFIRMED', 'approved', 'paid', 'succeeded'].includes(String(data.status));
  const status = active ? 'active' : ['CANCELLED', 'REFUNDED', 'rejected', 'cancelled', 'canceled'].includes(String(data.status)) ? 'denied' : 'pending';
  await db.runTransaction(async (tx) => {
    tx.create(eventRef, { provider, eventId: String(data.eventId), status, receivedAt: admin.firestore.FieldValue.serverTimestamp() });
    tx.set(db.collection('users').doc(String(reference.userId)), { billing: { planId: reference.planId, status, confirmedAt: admin.firestore.FieldValue.serverTimestamp(), provider }, updated: Date.now() }, { merge: true });
  });
  res.status(200).send('Processed');
});
```

Replace with:
```js
async function fetchMercadoPagoPayment(paymentId) {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${mercadoPagoAccessToken.value()}` } });
  if (!response.ok) {throw new Error(`Mercado Pago retornou ${response.status}`);}
  return response.json();
}

async function fetchMercadoPagoPreapproval(preapprovalId) {
  const response = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(preapprovalId)}`, { headers: { Authorization: `Bearer ${mercadoPagoAccessToken.value()}` } });
  if (!response.ok) {throw new Error(`Mercado Pago retornou ${response.status}`);}
  return response.json();
}

exports.billingWebhook = onRequest({ secrets: [asaasWebhookToken, mercadoPagoSecret, mercadoPagoAccessToken], cors: false }, async (req, res) => {
  if (req.method !== 'POST') {res.status(405).send('Method not allowed'); return;}
  const provider = String(req.query.provider || '').toLowerCase();
  if (!['asaas', 'mercadopago'].includes(provider)) {res.status(400).send('Provider required'); return;}
  if (provider === 'asaas' && !equal(req.get('asaas-access-token'), asaasWebhookToken.value())) {res.status(401).send('Invalid signature'); return;}
  if (provider === 'mercadopago' && !mpSignatureValid(req)) {res.status(401).send('Invalid signature'); return;}

  let normalized;
  try {
    if (provider === 'asaas') {
      normalized = normalizeAsaasEvent(req.body || {});
    } else {
      const type = String(req.body?.type || req.query.type || '');
      const dataId = req.body?.data?.id || req.query['data.id'];
      normalized = type === 'subscription_preapproval'
        ? normalizeMercadoPagoPreapproval(await fetchMercadoPagoPreapproval(dataId))
        : normalizeMercadoPagoPayment(await fetchMercadoPagoPayment(dataId));
    }
  } catch (error) {
    res.status(502).send(error.message);
    return;
  }

  if (!normalized.eventId) {res.status(400).send('Event id required'); return;}
  const eventRef = db.collection('billingWebhookEvents').doc(normalized.eventId);
  const existing = await eventRef.get();
  if (existing.exists) {res.status(200).send('Already processed'); return;}
  if (!normalized.reference || !normalized.status) {
    // Evento reconhecido mas sem ação (ex.: assinatura ainda pending, ou tipo que não tratamos)
    // — registra como visto pra um retry não reprocessar, mas não escreve billing.
    await eventRef.set({ provider, eventId: normalized.eventId, status: 'ignored', receivedAt: admin.firestore.FieldValue.serverTimestamp() });
    res.status(200).send('Ignored');
    return;
  }

  await db.runTransaction(async (tx) => {
    const userRef = db.collection('users').doc(normalized.reference.userId);
    const userSnap = await tx.get(userRef);
    const existingBilling = userSnap.data()?.billing || {};
    const billing = {
      ...existingBilling,
      planId: normalized.status === 'cancelled' ? 'free' : normalized.reference.planId,
      status: normalized.status,
      provider,
      subscriptionId: normalized.subscriptionId || existingBilling.subscriptionId || '',
      confirmedAt: Date.now(),
    };
    if (normalized.periodEndMs) {billing.currentPeriodEnd = normalized.periodEndMs;}
    tx.create(eventRef, { provider, eventId: normalized.eventId, status: normalized.status, receivedAt: admin.firestore.FieldValue.serverTimestamp() });
    tx.set(userRef, { billing, updated: Date.now() }, { merge: true });
  });
  res.status(200).send('Processed');
});

exports.checkExpiredSubscriptions = onSchedule('every 24 hours', async () => {
  const overdue = await db.collection('users').where('billing.status', 'in', ['active', 'past_due']).get();
  const now = Date.now();
  const batch = db.batch();
  let count = 0;
  overdue.forEach((docSnap) => {
    const billing = docSnap.data().billing;
    if (isPastGrace(billing?.currentPeriodEnd, now)) {
      batch.set(docSnap.ref, { billing: { ...billing, status: 'expired', planId: 'free' }, updated: now }, { merge: true });
      count += 1;
    }
  });
  if (count > 0) {await batch.commit();}
});
```

Note: a leitura da transação (`tx.get(userRef)`) vem **antes** de `tx.create`/`tx.set` de propósito — Firestore rejeita uma transação que lê depois de escrever.

- [ ] **Step 2: Rodar a suíte da raiz e o `node --test` de `functions/`**

Run: `npm test && (cd functions && node --test)`
Expected: PASS nos dois — este arquivo não tem teste próprio, mas `billing-logic.js` (Task 1) continua verde

- [ ] **Step 3: Commit**

```bash
git add functions/index.js
git commit -m "feat: rewrite billingWebhook for recurring subscriptions, add checkExpiredSubscriptions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Cliente — `src/services/billing.js`

**Files:**
- Modify: `src/services/billing.js`

**Interfaces:**
- Consumes: `PLAN_DEFINITIONS` de `../app/plans.js` (já importado); `auth` de `./firebase.js`.
- Produces (consumido pela Task 7): `createCheckout(planId, provider): Promise<{checkoutUrl}>`, `cancelSubscription(): Promise<{ok:true}>`, `getBilling()` inalterado.

Sem teste automatizado — este módulo já era Firebase-touching sem teste antes desta tarefa (`getBilling`/`requestPlan` nunca tiveram `billing.test.js`); a chamada de rede pro Cloud Function é a mesma categoria.

- [ ] **Step 1: Substituir `requestPlan` por `createCheckout`/`cancelSubscription`**

Find:
```js
import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { PLAN_DEFINITIONS } from '../app/plans.js';

export const PIX_KEY = 'f74010de-c262-497a-b257-c8c740920c53';
export const PLANS = Object.fromEntries(Object.entries(PLAN_DEFINITIONS).map(([id, plan]) => [id, { id, name: plan.name, price: plan.price, description: plan.limits.features.join(', ') }]));
const users = collection(db, 'users');
export function isSamePendingRequest(billing, planId) { return billing?.status === 'pending' && billing.planId === planId; }
export async function getBilling() { const user = auth.currentUser; if (!user) {return null;} const snap = await getDoc(doc(users, user.uid)); return snap.exists() ? snap.data() : null; }
export async function requestPlan(planId) { const user = auth.currentUser; const plan = PLANS[planId]; if (!user || !plan) {throw new Error('Faça login e escolha um plano válido.');} const ref = doc(users, user.uid); const current = await getDoc(ref); if (isSamePendingRequest(current.data()?.billing, planId)) {return { idempotent: true, planId };} await setDoc(ref, { email: user.email || '', billing: { planId, status: 'pending', paymentMethod: 'pix', pixKey: PIX_KEY, amount: plan.price, requestedAt: Date.now() }, updated: Date.now() }, { merge: true }); return { idempotent: false, planId }; }
```

Replace with:
```js
import { collection, doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { PLAN_DEFINITIONS } from '../app/plans.js';

export const PLANS = Object.fromEntries(Object.entries(PLAN_DEFINITIONS).map(([id, plan]) => [id, { id, name: plan.name, price: plan.price, description: plan.limits.features.join(', ') }]));
const users = collection(db, 'users');
const FUNCTIONS_BASE = 'https://us-central1-arena-campeonatos.cloudfunctions.net';

export function isSamePendingRequest(billing, planId) { return billing?.status === 'pending' && billing.planId === planId; }
export async function getBilling() { const user = auth.currentUser; if (!user) {return null;} const snap = await getDoc(doc(users, user.uid)); return snap.exists() ? snap.data() : null; }

async function callBillingFunction(name, body) {
  const user = auth.currentUser;
  if (!user) {throw new Error('Faça login.');}
  const idToken = await user.getIdToken();
  const response = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  if (!response.ok) {throw new Error(await response.text() || 'Não foi possível completar a operação.');}
  return response.json();
}

export async function createCheckout(planId, provider) {
  if (!PLANS[planId] || PLANS[planId].price === 0) {throw new Error('Plano inválido para assinatura paga.');}
  if (!['mercadopago', 'asaas'].includes(provider)) {throw new Error('Provedor de pagamento inválido.');}
  return callBillingFunction('createCheckout', { planId, provider });
}

export async function cancelSubscription() {
  return callBillingFunction('cancelSubscription', {});
}
```

- [ ] **Step 2: Rodar a suíte da raiz**

Run: `npm test`
Expected: PASS, mesma contagem da Task 2 (este arquivo nunca teve `billing.test.js`)

- [ ] **Step 3: Commit**

```bash
git add src/services/billing.js
git commit -m "feat: replace manual Pix request with createCheckout/cancelSubscription calls

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: `src/pages/plans.js` — botão por provedor, estado pendente/ativo/cancelamento

**Files:**
- Modify: `src/pages/plans.js`

**Interfaces:**
- Consumes: `createCheckout`, `cancelSubscription` de `../services/billing.js` (Task 6); `PLAN_DEFINITIONS`, `planCardsHTML`, `planLimitText`, `currentPlan` já existentes.

Sem teste automatizado — este arquivo já não tinha (`plans.test.js` não existe), é DOM/Firebase-glue como o resto das páginas.

- [ ] **Step 1: Trocar o import e o fluxo de escolha de plano**

Find:
```js
import { navigate } from '../app/router-v2.js';
import { toast } from '../app/ui.js';
import { auth } from '../services/firebase.js';
import { PLAN_DEFINITIONS, planCardsHTML, planLimitText, currentPlan, choosePlan, confirmPlanRequest } from '../app/plans.js';
import { requestPlan } from '../services/billing.js';
```

Replace with:
```js
import { navigate } from '../app/router-v2.js';
import { toast } from '../app/ui.js';
import { auth } from '../services/firebase.js';
import { PLAN_DEFINITIONS, planCardsHTML, planLimitText, currentPlan, choosePlan } from '../app/plans.js';
import { createCheckout, cancelSubscription } from '../services/billing.js';
```

Find:
```js
  function renderBody() {
    const planId = currentPlan(user);
    const plan = PLAN_DEFINITIONS[planId] || PLAN_DEFINITIONS.free;
    body.innerHTML = `<div class="hero" style="padding-top:10px;min-height:0"><h1>PLANOS E <em>COBRANÇA</em></h1><p class="muted">Gerencie sua assinatura e veja os limites do seu plano.</p></div><div class="card" style="margin-top:18px"><h2>Plano atual: ${plan.name}</h2><p class="muted">${planLimitText(planId)}</p><p class="muted" style="margin-top:8px">Status: ${user.billing?.status === 'active' ? '✅ Ativo' : user.billing?.status === 'pending' ? '⏳ Pendente' : '⚪ Grátis'}</p></div><div class="card" style="margin-top:16px"><h2>Escolha seu plano</h2><div class="grid" style="margin-top:12px">${planCardsHTML(planId)}</div></div>`;
    body.querySelectorAll('[data-choose-plan]').forEach((button) => {
      button.onclick = async () => {
        const planId = button.dataset.choosePlan;
        if (planId === currentPlan(user)) {return;}
        const result = choosePlan(user, planId);
        if (!result.ok) {return toast(result.reason);}
        if (result.pending) {
          const confirmed = confirmPlanRequest(user, planId);
          if (!confirmed.ok) {return toast(confirmed.reason);}
          const billingResult = await requestPlan(planId);
          toast(billingResult.idempotent ? 'Esta solicitação já está pendente.' : 'Solicitação de upgrade enviada! Aguarde aprovação do superadmin.');
        } else {
          toast(`Plano ${PLAN_DEFINITIONS[planId].name} ativado!`);
        }
        renderBody();
      };
    });
  }
```

Replace with:
```js
  function renderBody() {
    const planId = currentPlan(user);
    const plan = PLAN_DEFINITIONS[planId] || PLAN_DEFINITIONS.free;
    const billing = user.billing || {};
    const statusLabel = billing.status === 'active' ? '✅ Ativo' : billing.status === 'past_due' ? '⚠️ Pagamento atrasado' : billing.status === 'pending' ? '⏳ Pagamento pendente' : '⚪ Grátis';
    const pendingResume = billing.status === 'pending' && billing.checkoutUrl
      ? `<p class="muted" style="margin-top:8px"><a href="${billing.checkoutUrl}" target="_blank" rel="noopener">Finalizar pagamento pendente →</a></p>`
      : '';
    const cancelButton = billing.status === 'active'
      ? '<button class="btn ghost" style="margin-top:10px" data-cancel-subscription>Cancelar assinatura</button>'
      : '';
    body.innerHTML = `<div class="hero" style="padding-top:10px;min-height:0"><h1>PLANOS E <em>COBRANÇA</em></h1><p class="muted">Gerencie sua assinatura e veja os limites do seu plano.</p></div><div class="card" style="margin-top:18px"><h2>Plano atual: ${plan.name}</h2><p class="muted">${planLimitText(planId)}</p><p class="muted" style="margin-top:8px">Status: ${statusLabel}</p>${pendingResume}${cancelButton}</div><div class="card" style="margin-top:16px"><h2>Escolha seu plano</h2><div class="grid" style="margin-top:12px">${planCardsHTML(planId)}</div></div>`;

    body.querySelectorAll('[data-choose-plan]').forEach((button) => {
      button.onclick = async () => {
        const chosenId = button.dataset.choosePlan;
        if (chosenId === currentPlan(user)) {return;}
        const result = choosePlan(user, chosenId);
        if (!result.ok) {return toast(result.reason);}
        if (!result.pending) {
          toast(`Plano ${PLAN_DEFINITIONS[chosenId].name} ativado!`);
          return renderBody();
        }
        const provider = confirm('OK para pagar com Mercado Pago, Cancelar para pagar com Asaas.') ? 'mercadopago' : 'asaas';
        button.disabled = true;
        try {
          const { checkoutUrl } = await createCheckout(chosenId, provider);
          window.location.href = checkoutUrl;
        } catch (error) {
          toast(error.message || 'Não foi possível iniciar o pagamento.');
          button.disabled = false;
        }
      };
    });

    body.querySelector('[data-cancel-subscription]')?.addEventListener('click', async () => {
      if (!confirm('Cancelar sua assinatura? Você continua com acesso até o fim do período já pago.')) {return;}
      try {
        await cancelSubscription();
        toast('Assinatura cancelada.');
        renderBody();
      } catch (error) {
        toast(error.message || 'Não foi possível cancelar.');
      }
    });
  }
```

- [ ] **Step 2: Rodar a suíte da raiz**

Run: `npm test`
Expected: PASS, mesma contagem da Task 6

- [ ] **Step 3: Commit**

```bash
git add src/pages/plans.js
git commit -m "feat: wire plan checkout to createCheckout, add cancel/pending/past_due states

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: `src/pages/plans-billing.js` — painel do superadmin vira auditoria + emergência

**Files:**
- Modify: `src/pages/plans-billing.js`

**Interfaces:** Nenhuma nova — só remove a fila de aprovação manual (`Aprovar`/`Negar`), mantém a listagem de usuários/planos e o `select`+`Alterar` pra troca manual de emergência (já existia, continua igual).

Sem teste automatizado — este arquivo já não tinha.

- [ ] **Step 1: Remover a seção "Solicitações pendentes" e os handlers de aprovar/negar**

Find:
```js
  function renderBody(users) {
    const pending = users.filter((u) => u.billing?.status === 'pending');
    body.innerHTML = `<div class="grid" style="margin-top:18px"><div class="card"><small>TOTAL DE USUÁRIOS</small><h2>${users.length}</h2></div><div class="card"><small>PLANOS GRÁTIS</small><h2>${users.filter((u) => !u.billing?.planId || u.billing.planId === 'free').length}</h2></div><div class="card"><small>PLANOS PRO</small><h2>${users.filter((u) => u.billing?.planId === 'pro').length}</h2></div><div class="card"><small>PLANOS ENTERPRISE</small><h2>${users.filter((u) => u.billing?.planId === 'enterprise').length}</h2></div><div class="card"><small>PENDENTES</small><h2>${pending.length}</h2></div></div><div class="card" style="margin-top:16px"><h2>Solicitações pendentes</h2>${pending.length ? pending.map((item) => `<div class="row" style="padding:10px 0;border-bottom:1px solid var(--line)"><span style="flex:1"><strong>${esc(item.email || item.id)}</strong><br><span class="muted">Plano: ${esc(item.billing?.planId || 'free')} · R$ ${Number(item.billing?.amount || 0).toFixed(2).replace('.', ',')}</span></span><button class="btn primary" data-approve-plan="${esc(item.id)}" data-plan="${esc(item.billing?.planId)}">Aprovar</button><button class="btn ghost" data-deny-plan="${esc(item.id)}">Negar</button></div>`).join('') : '<p class="muted">Nenhuma solicitação pendente.</p>'}</div><div class="card" style="margin-top:16px"><h2>Todos os usuários</h2>${users.length ? users.map((item) => `<div class="row" style="padding:10px 0;border-bottom:1px solid var(--line)"><span style="flex:1;min-width:200px"><strong>${esc(item.email || item.id)}</strong><br><span class="muted">Plano: ${esc(item.billing?.planId || 'free')} · ${esc(item.billing?.status || 'none')}</span></span><select data-change-plan="${esc(item.id)}" style="width:140px">${Object.entries(PLAN_DEFINITIONS).map(([pid, p]) => `<option value="${pid}" ${item.billing?.planId === pid ? 'selected' : ''}>${p.name}</option>`).join('')}</select><button class="btn ghost sm" data-set-plan="${esc(item.id)}">Alterar</button></div>`).join('') : '<p class="muted">Nenhum usuário.</p>'}</div>`;
    body.querySelectorAll('[data-approve-plan]').forEach((button) => {
      button.onclick = async () => {
        const userId = button.dataset.approvePlan;
        const planId = button.dataset.plan;
        try {
          await updateDoc(doc(db, 'users', userId), { 'billing.status': 'active', 'billing.activatedAt': Date.now(), 'billing.activatedBy': auth.currentUser?.uid });
          toast(`Plano ${planId} ativado para ${userId}`);
          load();
        } catch { toast('Erro ao aprovar'); }
      };
    });
    body.querySelectorAll('[data-deny-plan]').forEach((button) => {
      button.onclick = async () => {
        const userId = button.dataset.denyPlan;
        if (!confirm('Negar esta solicitação?')) {return;}
        try {
          await updateDoc(doc(db, 'users', userId), { 'billing.status': 'denied', 'billing.deniedAt': Date.now() });
          toast('Solicitação negada');
          load();
        } catch { toast('Erro ao negar'); }
      };
    });
    body.querySelectorAll('[data-set-plan]').forEach((button) => {
```

Replace with:
```js
  function renderBody(users) {
    const pending = users.filter((u) => u.billing?.status === 'pending');
    const pastDue = users.filter((u) => u.billing?.status === 'past_due');
    body.innerHTML = `<div class="grid" style="margin-top:18px"><div class="card"><small>TOTAL DE USUÁRIOS</small><h2>${users.length}</h2></div><div class="card"><small>PLANOS GRÁTIS</small><h2>${users.filter((u) => !u.billing?.planId || u.billing.planId === 'free').length}</h2></div><div class="card"><small>PLANOS PRO</small><h2>${users.filter((u) => u.billing?.planId === 'pro').length}</h2></div><div class="card"><small>PLANOS ENTERPRISE</small><h2>${users.filter((u) => u.billing?.planId === 'enterprise').length}</h2></div><div class="card"><small>PENDENTES</small><h2>${pending.length}</h2></div><div class="card"><small>PAGAMENTO ATRASADO</small><h2>${pastDue.length}</h2></div></div><div class="card" style="margin-top:16px"><h2>Todos os usuários</h2><p class="muted">Ativação/renovação agora é automática via webhook do Mercado Pago/Asaas. O seletor abaixo é só pra correção manual de emergência (ex.: webhook falhou).</p>${users.length ? users.map((item) => `<div class="row" style="padding:10px 0;border-bottom:1px solid var(--line)"><span style="flex:1;min-width:200px"><strong>${esc(item.email || item.id)}</strong><br><span class="muted">Plano: ${esc(item.billing?.planId || 'free')} · ${esc(item.billing?.status || 'none')} · ${esc(item.billing?.provider || '—')}</span></span><select data-change-plan="${esc(item.id)}" style="width:140px">${Object.entries(PLAN_DEFINITIONS).map(([pid, p]) => `<option value="${pid}" ${item.billing?.planId === pid ? 'selected' : ''}>${p.name}</option>`).join('')}</select><button class="btn ghost sm" data-set-plan="${esc(item.id)}">Alterar</button></div>`).join('') : '<p class="muted">Nenhum usuário.</p>'}</div>`;
    body.querySelectorAll('[data-set-plan]').forEach((button) => {
```

- [ ] **Step 2: Rodar a suíte da raiz**

Run: `npm test`
Expected: PASS, mesma contagem da Task 7

- [ ] **Step 3: Commit**

```bash
git add src/pages/plans-billing.js
git commit -m "feat: turn superadmin billing panel into audit + emergency override (no manual approval)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Verificação final

**Files:** Nenhuma — só verificação.

- [ ] **Step 1: Suíte completa + build**

Run: `npm test && npm run build && (cd functions && node --test)`
Expected: tudo verde

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sem erro nos arquivos tocados

- [ ] **Step 3: Configurar os secrets reais (você faz isso — precisa das suas credenciais)**

```bash
firebase functions:secrets:set ASAAS_ACCESS_TOKEN
firebase functions:secrets:set MERCADOPAGO_ACCESS_TOKEN
firebase functions:secrets:set MERCADOPAGO_WEBHOOK_SECRET
firebase functions:secrets:set ASAAS_WEBHOOK_TOKEN
```

`MERCADOPAGO_ACCESS_TOKEN`/`MERCADOPAGO_WEBHOOK_SECRET`/`ASAAS_WEBHOOK_TOKEN` já devem existir se o webhook antigo chegou a ser configurado — só `ASAAS_ACCESS_TOKEN` é novo.

- [ ] **Step 4: Registrar a URL do webhook nos dois provedores**

Mercado Pago: painel de desenvolvedor → Webhooks → `https://us-central1-arena-campeonatos.cloudfunctions.net/billingWebhook?provider=mercadopago`, evento "Assinaturas" (`subscription_preapproval`) e "Pagamentos".
Asaas: painel → Integrações → Webhooks → `https://us-central1-arena-campeonatos.cloudfunctions.net/billingWebhook?provider=asaas`, eventos `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `SUBSCRIPTION_DELETED`.

- [ ] **Step 5: Deploy e teste ponta a ponta com um pagamento real (valor baixo, cancelar depois)**

```bash
firebase deploy --only functions
npm run build && firebase deploy --only hosting
```

Depois: entrar como usuário de teste, ir em Planos, assinar o plano Pro com Mercado Pago, confirmar que `billing.status` vira `active` sozinho (sem tocar no painel superadmin) e `checkoutUrl`/`currentPeriodEnd` aparecem no Firestore. Repetir com Asaas. Cancelar as duas assinaturas de teste no fim.
