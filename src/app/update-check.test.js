// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { isOutdated, fetchLatestBuild, watchForUpdates } from './update-check.js';

describe('update-check', () => {
  it('só acusa versão nova quando os ids diferem', () => {
    expect(isOutdated('a', 'b')).toBe(true);
    expect(isOutdated('a', 'a')).toBe(false);
    expect(isOutdated(null, 'b')).toBe(false);
    expect(isOutdated('a', null)).toBe(false);
  });

  it('lê o build de /version.json sem cache', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ build: 'x1' }) }));
    expect(await fetchLatestBuild(fetchImpl)).toBe('x1');
    expect(fetchImpl.mock.calls[0][1]).toEqual({ cache: 'no-store' });
  });

  it('avisa uma vez quando sai deploy novo', async () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ build: 'novo' }) }));
    const stop = watchForUpdates(onUpdate, { current: 'velho', intervalMs: 1000, fetchImpl });
    await vi.advanceTimersByTimeAsync(3500);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    stop();
    vi.useRealTimers();
  });
});
