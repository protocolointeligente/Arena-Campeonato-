import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase.js';

export const PIX_KEY = 'f74010de-c262-497a-b257-c8c740920c53';
export const PLANS = {
  essencial: { id: 'essencial', name: 'Essencial', price: 39.90, description: '1 campeonato com equipes ilimitadas.' },
  gestao: { id: 'gestao', name: 'Gestão', price: 69.90, description: 'Até 3 campeonatos simultâneos.' },
  liga: { id: 'liga', name: 'Liga', price: 119.90, description: 'Até 10 campeonatos simultâneos.' },
  pro: { id: 'pro', name: 'Pro', price: 199.90, description: 'Campeonatos simultâneos ilimitados.' },
};
const users = collection(db, 'users');
export async function getBilling() { const user = auth.currentUser; if (!user) return null; const snap = await getDoc(doc(users, user.uid)); return snap.exists() ? snap.data() : null; }
export async function requestPlan(planId) { const user = auth.currentUser; const plan = PLANS[planId]; if (!user || !plan) throw new Error('Faça login e escolha um plano válido.'); await setDoc(doc(users, user.uid), { email: user.email || '', billing: { planId, status: 'pending', paymentMethod: 'pix', pixKey: PIX_KEY, amount: plan.price, requestedAt: Date.now() }, updated: Date.now() }, { merge: true }); }
