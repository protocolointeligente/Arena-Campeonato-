import { addDoc, collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db, auth } from './firebase.js';
import { auditHash } from '../app/audit-integrity.js';
// Best-effort: toda chamada aqui é feita como `await addAudit(...)` direto no onclick de
// quem edita o campeonato (salvar equipes, aprovar inscrição, etc.), sem try/catch no
// chamador. Se isso lançar, vira unhandled rejection e o ErrorBoundary global apaga a tela
// inteira mesmo quando o save principal já tinha dado certo — registro de auditoria não pode
// derrubar a ação real. (Hoje isso dispara sempre: a regra do Firestore em auditLogs checa
// `resource.data.ownerUid`, mas `resource` ali é o próprio doc de auditoria — que nunca tem
// esse campo — não o campeonato pai; é bug de regra separado, registrado, não corrigido aqui.)
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


