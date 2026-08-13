import { collection, doc, getDoc, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { auth } from './firebase.js';
export async function isSuperadmin() { const user = auth.currentUser; if (!user) return false; const snapshot = await getDoc(doc(db, 'platformAdmins', user.uid)); return snapshot.exists() && snapshot.data().role === 'superadmin'; }
export async function pendingPayments() { if (!(await isSuperadmin())) throw new Error('Acesso restrito ao superadmin.'); const result = await getDocs(query(collection(db, 'users'), where('billing.status', '==', 'pending'))); return result.docs.map((item) => ({ id: item.id, ...item.data() })); }
export async function approvePayment(userId) { if (!(await isSuperadmin())) throw new Error('Acesso restrito ao superadmin.'); return updateDoc(doc(db, 'users', userId), { 'billing.status': 'active', 'billing.activatedAt': Date.now(), 'billing.activatedBy': auth.currentUser.uid }); }
