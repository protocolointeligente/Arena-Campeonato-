import { addDoc, collection, collectionGroup, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db, auth } from './firebase.js';
import { auditHash } from '../app/audit-integrity.js';
// Best-effort: toda chamada aqui é feita como `await addAudit(...)` direto no onclick de
// quem edita o campeonato (salvar equipes, aprovar inscrição, etc.), sem try/catch no
// chamador. Se isso lançar, vira unhandled rejection e o ErrorBoundary global apaga a tela
// inteira mesmo quando o save principal já tinha dado certo — registro de auditoria não pode
// derrubar a ação real. (A regra de auditLogs agora checa o campeonato pai via
// canManageParent(); antes lia ownerUid do próprio doc de log e negava todo organizador.)
export async function addAudit(championshipId, action, summary, before = null, after = null) {
  const user = auth.currentUser;
  if (!user) {return;}
  try {
    const logs = collection(db, 'championships', championshipId, 'auditLogs');
    const latest = await getDocs(query(logs, orderBy('createdAtMs', 'desc'), limit(1)));
    const previousHash = latest.docs[0]?.data()?.hash || '';
    const entry = { action, summary, before: before ? JSON.stringify(before).slice(0, 4000) : null, after: after ? JSON.stringify(after).slice(0, 4000) : null, actorUid: user.uid, actorEmail: user.email || '', createdAtMs: Date.now() };
    return await addDoc(logs, { ...entry, previousHash, hash: auditHash(entry, previousHash) });
  } catch (error) {
    console.warn('[audit] não foi possível registrar o evento (segue sem travar a ação principal):', error);
    return null;
  }
}
export async function listAudit(championshipId) { const result = await getDocs(query(collection(db, 'championships', championshipId, 'auditLogs'), orderBy('createdAtMs', 'desc'), limit(80))); return result.docs.map((item) => ({ id: item.id, ...item.data() })); }



// Central de auditoria do superadmin: logs de todos os campeonatos (regra collectionGroup só
// libera platformAdmins). Ordena no cliente pra não exigir índice de collectionGroup.
export async function listPlatformAudit(max = 300) {
  const result = await getDocs(query(collectionGroup(db, 'auditLogs'), limit(max)));
  return result.docs
    .map((item) => {
      const data = item.data();
      return { id: item.id, championshipId: item.ref.parent.parent?.id || null, ...data, ts: data.createdAtMs || null, user: data.actorEmail || data.actorUid || null };
    })
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));
}
