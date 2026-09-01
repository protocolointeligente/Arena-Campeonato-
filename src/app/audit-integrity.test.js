import { describe, expect, it } from 'vitest';
import { auditHash, verifyAuditChain } from './audit-integrity.js';

describe('audit integrity', () => {
  it('changes when the entry or chain predecessor changes', () => {
    const entry = { action: 'score_updated', summary: '2 x 1', actorUid: 'u1', createdAtMs: 1 };
    expect(auditHash(entry, 'prev')).toBe(auditHash(entry, 'prev'));
    expect(auditHash(entry, 'prev')).not.toBe(auditHash({ ...entry, summary: '3 x 1' }, 'prev'));
    expect(auditHash(entry, 'prev')).not.toBe(auditHash(entry, 'other'));
  });

  it('verifies a valid chain and reports a tampered entry', () => {
    const first = { id: '1', action: 'created', summary: 'A', actorUid: 'u', createdAtMs: 1, previousHash: '' };
    first.hash = auditHash(first, '');
    const second = { id: '2', action: 'updated', summary: 'B', actorUid: 'u', createdAtMs: 2, previousHash: first.hash };
    second.hash = auditHash(second, first.hash);
    expect(verifyAuditChain([second, first])).toEqual({ ok: true });
    expect(verifyAuditChain([{ ...second, summary: 'alterado' }, first]).ok).toBe(false);
  });
});
