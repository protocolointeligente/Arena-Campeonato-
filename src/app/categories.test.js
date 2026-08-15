import { describe, it, expect } from 'vitest';
import {
  ensureCategories, activeCategory, loadCategoryIntoRoot, saveRootIntoActive,
  switchCategory, addCategory, renameCategory, removeCategory,
} from './categories.js';

function championship(overrides = {}) {
  return { teams: [{ id: 't1', nome: 'Equipe A' }], matches: [{ id: 'm1', home: 0, away: 0 }], ...overrides };
}

describe('ensureCategories', () => {
  it('migrates flat teams/matches into a first category when none exist', () => {
    const state = championship();
    ensureCategories(state);
    expect(state.categories).toHaveLength(1);
    expect(state.categories[0].nome).toBe('Categoria principal');
    expect(state.categories[0].teams).toEqual([{ id: 't1', nome: 'Equipe A' }]);
    expect(state.categories[0].matches).toEqual([{ id: 'm1', home: 0, away: 0 }]);
    expect(state.activeCategoryId).toBe(state.categories[0].id);
  });

  it('does not duplicate categories on a second call', () => {
    const state = championship();
    ensureCategories(state);
    const firstId = state.categories[0].id;
    ensureCategories(state);
    expect(state.categories).toHaveLength(1);
    expect(state.categories[0].id).toBe(firstId);
  });

  it('repairs an activeCategoryId pointing at a category that no longer exists', () => {
    const state = championship({ categories: [{ id: 'c1', nome: 'A', teams: [], matches: [] }], activeCategoryId: 'ghost' });
    ensureCategories(state);
    expect(state.activeCategoryId).toBe('c1');
  });

  it('leaves an already-valid activeCategoryId untouched', () => {
    const state = championship({ categories: [{ id: 'c1', nome: 'A', teams: [], matches: [] }, { id: 'c2', nome: 'B', teams: [], matches: [] }], activeCategoryId: 'c2' });
    ensureCategories(state);
    expect(state.activeCategoryId).toBe('c2');
  });
});

describe('activeCategory', () => {
  it('returns the category matching activeCategoryId', () => {
    const state = { categories: [{ id: 'c1', nome: 'A' }, { id: 'c2', nome: 'B' }], activeCategoryId: 'c2' };
    expect(activeCategory(state).nome).toBe('B');
  });

  it('falls back to the first category when activeCategoryId matches nothing', () => {
    const state = { categories: [{ id: 'c1', nome: 'A' }], activeCategoryId: 'ghost' };
    expect(activeCategory(state).nome).toBe('A');
  });
});

describe('loadCategoryIntoRoot / saveRootIntoActive', () => {
  it('loadCategoryIntoRoot copies a deep clone onto state.teams/state.matches', () => {
    const category = { id: 'c1', teams: [{ id: 't1', nome: 'A' }], matches: [{ id: 'm1' }] };
    const state = { teams: [], matches: [] };
    loadCategoryIntoRoot(state, category);
    expect(state.teams).toEqual(category.teams);
    expect(state.teams).not.toBe(category.teams);
  });

  it('saveRootIntoActive writes a deep clone of root back into the active category', () => {
    const state = { categories: [{ id: 'c1', teams: [], matches: [] }], activeCategoryId: 'c1', teams: [{ id: 't1', nome: 'Edited' }], matches: [] };
    saveRootIntoActive(state);
    expect(state.categories[0].teams).toEqual([{ id: 't1', nome: 'Edited' }]);
    expect(state.categories[0].teams).not.toBe(state.teams);
  });
});

describe('switchCategory', () => {
  it('saves the outgoing category, then loads the target category into root', () => {
    const state = {
      categories: [
        { id: 'c1', nome: 'A', teams: [{ id: 't1', nome: 'Original' }], matches: [] },
        { id: 'c2', nome: 'B', teams: [{ id: 't2', nome: 'Team B' }], matches: [] },
      ],
      activeCategoryId: 'c1',
      teams: [{ id: 't1', nome: 'Edited before switch' }],
      matches: [],
    };
    switchCategory(state, 'c2');
    expect(state.activeCategoryId).toBe('c2');
    expect(state.teams).toEqual([{ id: 't2', nome: 'Team B' }]);
    expect(state.categories[0].teams).toEqual([{ id: 't1', nome: 'Edited before switch' }]);
  });

  it('is a no-op when switching to the already-active category', () => {
    const state = { categories: [{ id: 'c1', teams: [{ id: 't1' }], matches: [] }], activeCategoryId: 'c1', teams: [{ id: 'unsaved-edit' }], matches: [] };
    switchCategory(state, 'c1');
    expect(state.teams).toEqual([{ id: 'unsaved-edit' }]);
  });

  it('is a no-op when the target id does not exist', () => {
    const state = { categories: [{ id: 'c1', teams: [], matches: [] }], activeCategoryId: 'c1', teams: [{ id: 'unsaved-edit' }], matches: [] };
    switchCategory(state, 'ghost');
    expect(state.activeCategoryId).toBe('c1');
    expect(state.teams).toEqual([{ id: 'unsaved-edit' }]);
  });
});

describe('addCategory', () => {
  it('appends a new empty category, saving the outgoing one first, and switches to it', () => {
    const state = { categories: [{ id: 'c1', nome: 'A', teams: [], matches: [] }], activeCategoryId: 'c1', teams: [{ id: 'edited' }], matches: [] };
    addCategory(state);
    expect(state.categories).toHaveLength(2);
    expect(state.categories[0].teams).toEqual([{ id: 'edited' }]);
    expect(state.categories[1].nome).toBe('Categoria 2');
    expect(state.categories[1].teams).toEqual([]);
    expect(state.activeCategoryId).toBe(state.categories[1].id);
    expect(state.teams).toEqual([]);
  });
});

describe('renameCategory', () => {
  it('trims the name', () => {
    const state = { categories: [{ id: 'c1', nome: 'A' }] };
    renameCategory(state, 'c1', '  Sub-15  ');
    expect(state.categories[0].nome).toBe('Sub-15');
  });

  it('falls back to "Categoria" for a blank name', () => {
    const state = { categories: [{ id: 'c1', nome: 'A' }] };
    renameCategory(state, 'c1', '   ');
    expect(state.categories[0].nome).toBe('Categoria');
  });

  it('is a no-op when the id does not exist', () => {
    const state = { categories: [{ id: 'c1', nome: 'A' }] };
    renameCategory(state, 'ghost', 'New name');
    expect(state.categories[0].nome).toBe('A');
  });
});

describe('removeCategory', () => {
  it('refuses to remove the last remaining category', () => {
    const state = { categories: [{ id: 'c1', nome: 'A', teams: [], matches: [] }], activeCategoryId: 'c1', teams: [], matches: [] };
    const result = removeCategory(state, 'c1');
    expect(result).toEqual({ ok: false, reason: 'O campeonato precisa ter pelo menos uma categoria.' });
    expect(state.categories).toHaveLength(1);
  });

  it('removes a non-active category without disturbing root state', () => {
    const state = { categories: [{ id: 'c1', nome: 'A', teams: [], matches: [] }, { id: 'c2', nome: 'B', teams: [], matches: [] }], activeCategoryId: 'c1', teams: [{ id: 'active-edit' }], matches: [] };
    const result = removeCategory(state, 'c2');
    expect(result).toEqual({ ok: true });
    expect(state.categories.map((c) => c.id)).toEqual(['c1']);
    expect(state.activeCategoryId).toBe('c1');
  });

  it('removing the active category switches root to the new first category', () => {
    const state = { categories: [{ id: 'c1', nome: 'A', teams: [{ id: 'from-a' }], matches: [] }, { id: 'c2', nome: 'B', teams: [{ id: 'from-b' }], matches: [] }], activeCategoryId: 'c2', teams: [{ id: 'unsaved' }], matches: [] };
    const result = removeCategory(state, 'c2');
    expect(result).toEqual({ ok: true });
    expect(state.categories.map((c) => c.id)).toEqual(['c1']);
    expect(state.activeCategoryId).toBe('c1');
    expect(state.teams).toEqual([{ id: 'from-a' }]);
  });
});
