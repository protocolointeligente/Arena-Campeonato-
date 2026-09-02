import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/' });
global.window = dom.window;
global.document = dom.window.document;
global.history = dom.window.history;

const { route, navigate } = await import('./router-v2.js');

describe('router-v2', () => {
  it('extracts named route params on navigate (path-to-regexp v8 returns {regexp, keys}, does not mutate an array argument)', () => {
    const handler = vi.fn();
    route('/campeonatos/:id', handler);
    navigate('/campeonatos/abc123');
    expect(handler).toHaveBeenCalledWith({ id: 'abc123' });
  });

  it('extracts multiple params in order', () => {
    const handler = vi.fn();
    route('/equipe/:id/:teamId', handler);
    navigate('/equipe/champ1/team2');
    expect(handler).toHaveBeenCalledWith({ id: 'champ1', teamId: 'team2' });
  });
});
