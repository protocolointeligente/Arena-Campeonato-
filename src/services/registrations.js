import { addDoc, collection, doc, getDocs, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from './firebase.js';

export async function listRegistrations(championshipId) { const result = await getDocs(query(collection(db, 'championships', championshipId, 'registrations'), orderBy('created', 'desc'))); return result.docs.map((item) => ({ id: item.id, ...item.data() })); }
export async function submitRegistration(championshipId, data) { return addDoc(collection(db, 'championships', championshipId, 'registrations'), { ...data, status: 'pending', created: Date.now() }); }
export async function updateRegistration(championshipId, registrationId, data) { return updateDoc(doc(db, 'championships', championshipId, 'registrations', registrationId), data); }
