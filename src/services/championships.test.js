import { describe, expect, it } from 'vitest';
import { directoryPageResult } from './championships.js';

describe('public championship directory pagination', () => {
  it('returns items and a nullable cursor without changing item shape', () => {
    const items = [{ id: 'a', nome: 'Copa A' }];
    expect(directoryPageResult(items, 'cursor-a')).toEqual({ items, nextCursor: 'cursor-a' });
    expect(directoryPageResult([], null)).toEqual({ items: [], nextCursor: null });
  });
});
