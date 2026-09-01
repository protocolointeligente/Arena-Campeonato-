export function auditHash(entry, previousHash = '') {
  const source = `${previousHash}|${entry.action || ''}|${entry.summary || ''}|${entry.actorUid || ''}|${entry.createdAtMs || ''}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) { hash ^= source.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function verifyAuditChain(entries = []) {
  let previousHash = '';
  for (const entry of entries.slice().sort((a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0))) {
    if (!entry.hash) { previousHash = ''; continue; }
    if ((entry.previousHash || '') !== previousHash || entry.hash !== auditHash(entry, entry.previousHash || '')) {
      return { ok: false, id: entry.id || null, reason: 'Registro de auditoria inconsistente.' };
    }
    previousHash = entry.hash;
  }
  return { ok: true };
}
