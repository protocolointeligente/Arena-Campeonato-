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
