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
const { normalizeAsaasRegistrationEvent } = require('./lib/registration-fee-logic.js');

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

function equal(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}

function mpSignatureValid(req) {
  const parts = Object.fromEntries(String(req.get('x-signature') || '').split(',').map((part) => part.trim().split('=')));
  const dataId = String(req.query['data.id'] || req.body?.data?.id || '');
  const requestId = String(req.get('x-request-id') || '');
  const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`;
  const expected = crypto.createHmac('sha256', mercadoPagoSecret.value()).update(manifest).digest('hex');
  return !!parts.ts && !!parts.v1 && equal(expected, parts.v1);
}

exports.createCheckout = onRequest({ secrets: [asaasAccessToken, mercadoPagoAccessToken], cors: true }, async (req, res) => {
  if (req.method !== 'POST') {res.status(405).send('Method not allowed'); return;}
  const decoded = await requireUser(req, res);
  if (!decoded) {return;}
  const { planId, provider } = req.body || {};
  const plan = PLAN_PRICES[planId];
  if (!plan) {res.status(400).send('Invalid plan'); return;}
  if (!['mercadopago', 'asaas'].includes(provider)) {res.status(400).send('Invalid provider'); return;}
  const userRef = db.collection('users').doc(decoded.uid);
  const existingSnap = await userRef.get();
  const existingBilling = existingSnap.data()?.billing || {};
  if (existingBilling.status === 'active') {
    res.status(409).send('Você já tem uma assinatura ativa. Cancele-a antes de assinar outro plano.');
    return;
  }

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
      if (!created.id || !created.init_point) {throw new Error('Resposta inesperada do Mercado Pago.');}
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
      if (!created.id) {throw new Error('Resposta inesperada do Asaas.');}
      checkoutUrl = `https://checkout.asaas.com/${created.id}`;
      subscriptionId = String(created.id);
    }
  } catch (error) {
    res.status(502).send(error.message);
    return;
  }

  await userRef.set({
    email: decoded.email || '',
    billing: { ...existingBilling, planId, status: 'pending', provider, subscriptionId, checkoutUrl, amount: plan.price, requestedAt: Date.now() },
    updated: Date.now(),
  }, { merge: true });

  res.status(200).json({ checkoutUrl });
});

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
      if (type === 'subscription_preapproval') {
        normalized = normalizeMercadoPagoPreapproval(await fetchMercadoPagoPreapproval(dataId));
      } else if (type === 'payment' || type === 'subscription_authorized_payment') {
        // Mercado Pago's per-cycle subscription charges surface as regular Payment objects,
        // fetchable via /v1/payments/{id} — verify this against a real MP subscription during
        // the manual end-to-end test; if a subscription_authorized_payment notification's
        // data.id ever 404s here, it needs its own /authorized_payments/{id} fetch instead.
        normalized = normalizeMercadoPagoPayment(await fetchMercadoPagoPayment(dataId));
      } else {
        // Notification type we don't act on (a topic MP added later, etc.) — acknowledge so
        // MP doesn't keep retrying, but don't attempt to fetch or process it.
        res.status(200).send('Ignored');
        return;
      }
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
    // — registra como visto num doc SEPARADO (sufixo :ignored) pra um retry não reprocessar,
    // mas sem ocupar o id do evento real: um pagamento Mercado Pago manda notificação múltiplas
    // vezes conforme o status muda (pending → approved, por exemplo) com o MESMO id de pagamento
    // — se a marca de "ignorado" tivesse gravado no doc com esse id, a notificação seguinte
    // (a que de fato importa) bateria em "Already processed" e a assinatura nunca ativaria.
    await db.collection('billingWebhookEvents').doc(`${normalized.eventId}:ignored`).set({ provider, eventId: normalized.eventId, status: 'ignored', receivedAt: admin.firestore.FieldValue.serverTimestamp() });
    res.status(200).send('Ignored');
    return;
  }

  await db.runTransaction(async (tx) => {
    const userRef = db.collection('users').doc(normalized.reference.userId);
    const userSnap = await tx.get(userRef);
    const existingBilling = userSnap.data()?.billing || {};
    const billing = {
      ...existingBilling,
      planId: normalized.status === 'cancelled' ? (existingBilling.planId || 'free') : normalized.reference.planId,
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
  const overdue = await db.collection('users').where('billing.status', 'in', ['active', 'past_due', 'cancelled']).get();
  const now = Date.now();
  const toExpire = [];
  overdue.forEach((docSnap) => {
    const billing = docSnap.data().billing;
    if (isPastGrace(billing?.currentPeriodEnd, now)) {toExpire.push({ ref: docSnap.ref, billing });}
  });
  for (let i = 0; i < toExpire.length; i += 500) {
    const batch = db.batch();
    toExpire.slice(i, i + 500).forEach(({ ref, billing }) => {
      batch.set(ref, { billing: { ...billing, status: 'expired', planId: 'free' }, updated: now }, { merge: true });
    });
    await batch.commit();
  }
});

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
  if (req.method !== 'GET') {res.status(405).json({ error: 'Method not allowed' }); return;}
  const id = String(req.query.id || '');
  const slug = String(req.query.slug || '');
  if (!id && !slug) {res.status(400).json({ error: 'Informe ?id=<id-do-campeonato> ou ?slug=<url-personalizada>' }); return;}

  let docId = id;
  if (!docId) {
    const slugSnap = await db.collection('publicChampionships').where('publicSlug', '==', slug).limit(1).get();
    if (slugSnap.empty) {res.status(404).json({ error: 'Campeonato não encontrado' }); return;}
    docId = slugSnap.docs[0].id;
  }

  const snap = await db.collection('publicChampionships').doc(docId).get();
  if (!snap.exists) {res.status(404).json({ error: 'Campeonato não encontrado' }); return;}
  const docData = snap.data();
  let state = {};
  try { state = JSON.parse(docData.data || '{}'); } catch { state = {}; }

  res.set('Cache-Control', 'public, max-age=30');
  res.status(200).json({
    id: docId,
    nome: docData.nome || state.nome || '',
    modalidade: state.modalidade || '',
    formato: docData.formato || state.formato || '',
    status: docData.status || state.status || '',
    updated: docData.updated || 0,
    teams: (state.teams || []).map((team) => ({ id: team.id, nome: team.nome })),
    matches: (state.matches || []).map((match) => ({ id: match.id, home: match.home, away: match.away, hg: match.hg, ag: match.ag, rodada: match.rodada || null, meta: match.meta || {} })),
    grupos: state.grupos || [],
  });
});
