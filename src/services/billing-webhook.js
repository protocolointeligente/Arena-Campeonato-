const encoder = new TextEncoder();

export async function signWebhookPayload(payload, secret) {
  if (!secret) {throw new Error('Segredo do webhook ausente.');}
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyWebhookSignature(payload, signature, secret) {
  if (!signature || !secret) {return false;}
  const expected = await signWebhookPayload(payload, secret);
  if (expected.length !== signature.length) {return false;}
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);}
  return mismatch === 0;
}

export function normalizePaymentEvent(event) {
  const payment = event?.data?.object || event?.data || event?.payment || event;
  const status = String(payment?.status || '').toLowerCase();
  const statusMap = { approved: 'active', paid: 'active', received: 'active', confirmed: 'active', succeeded: 'active', pending: 'pending', rejected: 'denied', cancelled: 'denied', canceled: 'denied', refunded: 'denied' };
  return {
    eventId: String(event?.id || payment?.id || ''),
    userId: String(payment?.metadata?.userId || payment?.metadata?.uid || payment?.userId || ''),
    planId: String(payment?.metadata?.planId || payment?.planId || ''),
    status: statusMap[status] || 'pending',
    providerStatus: status,
  };
}

export function shouldApplyPaymentEvent(event, processedIds = []) {
  return !!event?.eventId && !!event?.userId && !processedIds.includes(event.eventId);
}

export function mercadoPagoManifest({ dataId, requestId, timestamp }) {
  return `id:${dataId};request-id:${requestId};ts:${timestamp};`;
}

export function parseMercadoPagoSignature(header = '') {
  return Object.fromEntries(String(header).split(',').map((part) => part.split('=').map((value) => value.trim())).filter(([key, value]) => key && value));
}

export async function verifyMercadoPagoWebhook({ signature, requestId, dataId, secret }) {
  const parts = parseMercadoPagoSignature(signature);
  if (!parts.ts || !parts.v1 || !requestId || !dataId) {return false;}
  return verifyWebhookSignature(mercadoPagoManifest({ dataId, requestId, timestamp: parts.ts }), parts.v1, secret);
}

export async function verifyAsaasWebhookToken(receivedToken, configuredToken) {
  if (!receivedToken || !configuredToken || receivedToken.length !== configuredToken.length) {return false;}
  let mismatch = 0;
  for (let i = 0; i < configuredToken.length; i++) {mismatch |= receivedToken.charCodeAt(i) ^ configuredToken.charCodeAt(i);}
  return mismatch === 0;
}

export function normalizeAsaasEvent(event) {
  const payment = event?.payment || {};
  const status = String(payment.status || '').toUpperCase();
  return normalizePaymentEvent({ id: event?.id || event?.eventId || payment.id, data: { object: { ...payment, status, metadata: payment.externalReference ? parseExternalReference(payment.externalReference) : {} } } });
}

export function normalizeMercadoPagoEvent(event, payment = {}) {
  return normalizePaymentEvent({ id: event?.id || event?.data?.id, data: { object: { ...payment, status: payment.status, metadata: payment.metadata || {} } } });
}

function parseExternalReference(value) {
  try { return JSON.parse(value); } catch { return {}; }
}
