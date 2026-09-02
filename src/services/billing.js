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


