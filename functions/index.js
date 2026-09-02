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
