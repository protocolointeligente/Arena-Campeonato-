import { describe, expect, it, beforeEach } from 'vitest';
import { clearSyncQueue, enqueueSync, flushSync, pendingSync } from './offline-queue.js';

describe('offline sync queue', () => {
  beforeEach(() => {
    const values = {};
    globalThis.localStorage = { getItem: (key) => values[key] || null, setItem: (key, value) => { values[key] = value; }, clear: () => Object.keys(values).forEach((key) => delete values[key]) };
    localStorage.clear(); clearSyncQueue();
  });

  it('keeps only the newest snapshot per championship', () => {
    enqueueSync({ id: 'c1', updated: 1 }); enqueueSync({ id: 'c1', updated: 2 });
    expect(pendingSync()).toHaveLength(1);
    expect(pendingSync()[0].snapshot.updated).toBe(2);
  });

  it('removes successfully synchronized snapshots and retains failures', async () => {
    enqueueSync({ id: 'ok' }); enqueueSync({ id: 'fail' });
    const result = await flushSync(async (snapshot) => { if (snapshot.id === 'fail') {throw new Error('offline');} });
    expect(result).toEqual({ processed: 1, pending: 1 });
    expect(pendingSync().map((item) => item.id)).toEqual(['fail']);
  });
});
