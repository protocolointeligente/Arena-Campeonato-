const QUEUE_KEY = 'arena_sync_queue';

function readQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
}

function writeQueue(queue) { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-20))); }

export function enqueueSync(snapshot) {
  if (!snapshot?.id) {return [];} 
  const queue = readQueue().filter((item) => item.id !== snapshot.id);
  queue.push({ id: snapshot.id, queuedAt: Date.now(), snapshot });
  writeQueue(queue);
  return queue;
}

export function pendingSync() { return readQueue(); }

export async function flushSync(save) {
  const queue = readQueue();
  const remaining = [];
  for (const item of queue) {
    try { await save(item.snapshot); } catch { remaining.push(item); }
  }
  writeQueue(remaining);
  return { processed: queue.length - remaining.length, pending: remaining.length };
}

export function clearSyncQueue() { writeQueue([]); }
