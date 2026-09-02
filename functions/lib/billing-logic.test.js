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

test('nextPeriodEnd advances exactly one UTC month, clamping to the target month\'s last day', () => {
  const start = Date.UTC(2026, 0, 31); // 31 Jan
  const end = nextPeriodEnd(start);
  const endDate = new Date(end);
  assert.equal(endDate.getUTCMonth(), 1); // rola pra fevereiro, não março
  assert.equal(endDate.getUTCDate(), 28); // 2026 não é bissexto — fev tem 28 dias
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
  await t.test('PAYMENT_CONFIRMED também ativa e define período (mesmo efeito de PAYMENT_RECEIVED)', () => {
    const result = normalizeAsaasEvent({ id: 'evt1b', event: 'PAYMENT_CONFIRMED', payment: { id: 'pay1b', subscription: 'sub1', externalReference: '{"userId":"u1","planId":"pro"}' } });
    assert.equal(result.status, 'active');
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
