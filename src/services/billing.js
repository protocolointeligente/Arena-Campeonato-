import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { PLAN_DEFINITIONS } from '../app/plans.js';

export const PIX_KEY = 'f74010de-c262-497a-b257-c8c740920c53';
export const PLANS = Object.fromEntries(Object.entries(PLAN_DEFINITIONS).map(([id, plan]) => [id, { id, name: plan.name, price: plan.price, description: plan.limits.features.join(', ') }]));
const users = collection(db, 'users');
export function isSamePendingRequest(billing, planId) { return billing?.status === 'pending' && billing.planId === planId; }
export async function getBilling() { const user = auth.currentUser; if (!user) {return null;} const snap = await getDoc(doc(users, user.uid)); return snap.exists() ? snap.data() : null; }
export async function requestPlan(planId) { const user = auth.currentUser; const plan = PLANS[planId]; if (!user || !plan) {throw new Error('Faça login e escolha um plano válido.');} const ref = doc(users, user.uid); const current = await getDoc(ref); if (isSamePendingRequest(current.data()?.billing, planId)) {return { idempotent: true, planId };} await setDoc(ref, { email: user.email || '', billing: { planId, status: 'pending', paymentMethod: 'pix', pixKey: PIX_KEY, amount: plan.price, requestedAt: Date.now() }, updated: Date.now() }, { merge: true }); return { idempotent: false, planId }; }


