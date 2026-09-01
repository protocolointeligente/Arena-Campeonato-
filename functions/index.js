const crypto = require('crypto');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const asaasToken = defineSecret('ASAAS_WEBHOOK_TOKEN');
const mercadoPagoSecret = defineSecret('MERCADOPAGO_WEBHOOK_SECRET');
const mercadoPagoAccessToken = defineSecret('MERCADOPAGO_ACCESS_TOKEN');

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

exports.billingWebhook = onRequest({ secrets: [asaasToken, mercadoPagoSecret, mercadoPagoAccessToken], cors: false }, async (req, res) => {
  if (req.method !== 'POST') {res.status(405).send('Method not allowed'); return;}
  const provider = String(req.query.provider || '').toLowerCase();
  if (!['asaas', 'mercadopago'].includes(provider)) {res.status(400).send('Provider required'); return;}
  if (provider === 'asaas' && !equal(req.get('asaas-access-token'), asaasToken.value())) {res.status(401).send('Invalid signature'); return;}
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
