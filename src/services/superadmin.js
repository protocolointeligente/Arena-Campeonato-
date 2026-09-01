import { collection, doc, getDoc, getDocs, limit, query, where, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase.js';
export async function isSuperadmin() { const user = auth.currentUser; if (!user) {return false;} const snapshot = await getDoc(doc(db, 'platformAdmins', user.uid)); return snapshot.exists() && snapshot.data().role === 'superadmin'; }
export async function pendingPayments() { if (!(await isSuperadmin())) {throw new Error('Acesso restrito ao superadmin.');} const result = await getDocs(query(collection(db, 'users'), where('billing.status', '==', 'pending'))); return result.docs.map((item) => ({ id: item.id, ...item.data() })); }
export async function approvePayment(userId) { if (!(await isSuperadmin())) {throw new Error('Acesso restrito ao superadmin.');} return updateDoc(doc(db, 'users', userId), { 'billing.status': 'active', 'billing.activatedAt': Date.now(), 'billing.activatedBy': auth.currentUser.uid }); }

export async function platformOverview() {
  if (!(await isSuperadmin())) {throw new Error('Acesso restrito ao superadmin.');}
  const [championshipsSnapshot, usersSnapshot, pending] = await Promise.all([
    getDocs(query(collection(db, 'championships'), limit(100))),
    getDocs(query(collection(db, 'users'), limit(100))),
    pendingPayments(),
  ]);
  const championships = championshipsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  return {
    championships: championships.sort((a, b) => (b.updated || 0) - (a.updated || 0)).slice(0, 20),
    totalChampionships: championships.length,
    totalUsers: usersSnapshot.size,
    inProgress: championships.filter((item) => item.status === 'andamento').length,
    pending,
  };
}


