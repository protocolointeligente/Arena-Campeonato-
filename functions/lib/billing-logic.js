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
  const year = date.getUTCFullYear();
  let month = date.getUTCMonth() + 1;
  let day = date.getUTCDate();
  let targetYear = year;

  if (month > 11) {
    month = 0;
    targetYear++;
  }

  // Get the number of days in the target month
  const daysInMonth = new Date(Date.UTC(targetYear, month + 1, 0)).getUTCDate();

  // Clamp day to avoid overflow (e.g., Jan 31 + 1 month = Feb 28, not Mar 3)
  day = Math.min(day, daysInMonth);

  return Date.UTC(targetYear, month, day);
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
