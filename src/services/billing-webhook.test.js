import { describe, expect, it } from 'vitest';
import { mercadoPagoManifest, normalizeAsaasEvent, normalizePaymentEvent, parseMercadoPagoSignature, shouldApplyPaymentEvent, signWebhookPayload, verifyAsaasWebhookToken, verifyMercadoPagoWebhook, verifyWebhookSignature } from './billing-webhook.js';

describe('billing webhook', () => {
  it('signs and verifies an HMAC payload', async () => {
    const signature = await signWebhookPayload('{"id":"evt_1"}', 'secret');
    expect(await verifyWebhookSignature('{"id":"evt_1"}', signature, 'secret')).toBe(true);
    expect(await verifyWebhookSignature('{"id":"evt_2"}', signature, 'secret')).toBe(false);
  });

  it('normalizes approved payment metadata', () => {
    expect(normalizePaymentEvent({ id: 'evt_1', data: { object: { id: 'pay_1', status: 'approved', metadata: { userId: 'u1', planId: 'pro' } } } })).toEqual({ eventId: 'evt_1', userId: 'u1', planId: 'pro', status: 'active', providerStatus: 'approved' });
  });

  it('rejects missing or already processed events', () => {
    expect(shouldApplyPaymentEvent({ eventId: 'evt_1', userId: 'u1' }, [])).toBe(true);
    expect(shouldApplyPaymentEvent({ eventId: 'evt_1', userId: 'u1' }, ['evt_1'])).toBe(false);
    expect(shouldApplyPaymentEvent({ eventId: '', userId: 'u1' }, [])).toBe(false);
  });

  it('supports Asaas token validation and PAYMENT_RECEIVED events', async () => {
    expect(await verifyAsaasWebhookToken('token', 'token')).toBe(true);
    expect(await verifyAsaasWebhookToken('wrong', 'token')).toBe(false);
    expect(normalizeAsaasEvent({ id: 'evt_a', event: 'PAYMENT_RECEIVED', payment: { id: 'pay_a', status: 'RECEIVED', externalReference: '{"userId":"u1","planId":"pro"}' } })).toMatchObject({ eventId: 'evt_a', userId: 'u1', planId: 'pro', status: 'active' });
  });

  it('supports Mercado Pago x-signature manifest validation', async () => {
    const requestId = 'req-1'; const dataId = 'pay-1'; const timestamp = '1704908010'; const secret = 'secret';
    const signature = await signWebhookPayload(mercadoPagoManifest({ dataId, requestId, timestamp }), secret);
    expect(parseMercadoPagoSignature(`ts=${timestamp},v1=${signature}`)).toMatchObject({ ts: timestamp, v1: signature });
    expect(await verifyMercadoPagoWebhook({ signature: `ts=${timestamp},v1=${signature}`, requestId, dataId, secret })).toBe(true);
  });
});
