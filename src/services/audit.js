import { addDoc, collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db, auth } from './firebase.js';
import { auditHash } from '../app/audit-integrity.js';
export async function addAudit(championshipId, action, summary, before = null, after = null) { const user = auth.currentUser; if (!user) {return;} const logs = collection(db, 'championships', championshipId, 'auditLogs'); const latest = await getDocs(query(logs, orderBy('createdAtMs', 'desc'), limit(1))); const previousHash = latest.docs[0]?.data()?.hash || ''; const entry = { action, summary, before: before ? JSON.stringify(before).slice(0, 4000) : null, after: after ? JSON.stringify(after).slice(0, 4000) : null, actorUid: user.uid, actorEmail: user.email || '', createdAtMs: Date.now() }; return addDoc(logs, { ...entry, previousHash, hash: auditHash(entry, previousHash) }); }
export async function listAudit(championshipId) { const result = await getDocs(query(collection(db, 'championships', championshipId, 'auditLogs'), orderBy('createdAtMs', 'desc'), limit(80))); return result.docs.map((item) => ({ id: item.id, ...item.data() })); }


