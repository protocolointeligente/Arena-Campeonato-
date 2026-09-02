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
