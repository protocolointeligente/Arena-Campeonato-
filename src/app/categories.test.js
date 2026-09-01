import { describe, it, expect } from 'vitest';
import {
  ensureCategories, activeCategory, loadCategoryIntoRoot, saveRootIntoActive,
  switchCategory, addCategory, renameCategory, removeCategory,
} from './categories.js';

function championship(overrides = {}) {
  return { teams: [{ id: 't1', nome: 'Equipe A' }], matches: [{ id: 'm1', home: 0, away: 0 }], formato: 'liga', cfg: { turnos: 1 }, ...overrides };
}

describe('ensureCategories', () => {
  it('migrates flat teams/matches into a first category, with matches folded into its first phase', () => {
    const state = championship();
    ensureCategories(state);
    expect(state.categories).toHaveLength(1);
    expect(state.categories[0].nome).toBe('Categoria principal');
    expect(state.categories[0].teams).toEqual([{ id: 't1', nome: 'Equipe A' }]);
    expect(state.categories[0].matches).toBeUndefined();
    expect(state.categories[0].phases).toHaveLength(1);
    expect(state.categories[0].phases[0].matches).toEqual([{ id: 'm1', home: 0, away: 0 }]);
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

  it('ensures phases on every pre-existing category, not just the active one', () => {
    const state = championship({ categories: [{ id: 'c1', nome: 'A', teams: [], matches: [] }, { id: 'c2', nome: 'B', teams: [], matches: [] }], activeCategoryId: 'c1' });
    ensureCategories(state);
    expect(state.categories[0].phases).toHaveLength(1);
    expect(state.categories[1].phases).toHaveLength(1);
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
  it('loadCategoryIntoRoot copies teams and the active phase\'s matches onto root', () => {
    const category = { id: 'c1', teams: [{ id: 't1', nome: 'A' }], phases: [{ id: 'p1', formato: 'liga', matches: [{ id: 'm1' }] }], activePhaseId: 'p1' };
    const state = { teams: [], matches: [] };
    loadCategoryIntoRoot(state, category);
    expect(state.teams).toEqual(category.teams);
    expect(state.teams).not.toBe(category.teams);
    expect(state.matches).toEqual([{ id: 'm1' }]);
    expect(state.formato).toBe('liga');
  });

  it('saveRootIntoActive writes a deep clone of teams and the phase snapshot back into the active category', () => {
    const category = { id: 'c1', teams: [], phases: [{ id: 'p1', formato: 'liga', matches: [] }], activePhaseId: 'p1' };
    const state = { categories: [category], activeCategoryId: 'c1', teams: [{ id: 't1', nome: 'Edited' }], formato: 'liga', matches: [{ id: 'new-match' }] };
    saveRootIntoActive(state);
    expect(state.categories[0].teams).toEqual([{ id: 't1', nome: 'Edited' }]);
    expect(state.categories[0].teams).not.toBe(state.teams);
    expect(state.categories[0].phases[0].matches).toEqual([{ id: 'new-match' }]);
  });
});

describe('switchCategory', () => {
  it('saves the outgoing category (teams + active phase), then loads the target category into root', () => {
    const state = {
      categories: [
        { id: 'c1', nome: 'A', teams: [{ id: 't1', nome: 'Original' }], phases: [{ id: 'p1', formato: 'liga', matches: [] }], activePhaseId: 'p1' },
        { id: 'c2', nome: 'B', teams: [{ id: 't2', nome: 'Team B' }], phases: [{ id: 'p2', formato: 'liga', matches: [] }], activePhaseId: 'p2' },
      ],
      activeCategoryId: 'c1',
      teams: [{ id: 't1', nome: 'Edited before switch' }],
      formato: 'liga', matches: [],
    };
    switchCategory(state, 'c2');
    expect(state.activeCategoryId).toBe('c2');
    expect(state.teams).toEqual([{ id: 't2', nome: 'Team B' }]);
    expect(state.categories[0].teams).toEqual([{ id: 't1', nome: 'Edited before switch' }]);
  });

  it('is a no-op when switching to the already-active category', () => {
    const state = { categories: [{ id: 'c1', teams: [{ id: 't1' }], phases: [{ id: 'p1', matches: [] }], activePhaseId: 'p1' }], activeCategoryId: 'c1', teams: [{ id: 'unsaved-edit' }], matches: [] };
    switchCategory(state, 'c1');
    expect(state.teams).toEqual([{ id: 'unsaved-edit' }]);
  });

  it('is a no-op when the target id does not exist', () => {
    const state = { categories: [{ id: 'c1', teams: [], phases: [{ id: 'p1', matches: [] }], activePhaseId: 'p1' }], activeCategoryId: 'c1', teams: [{ id: 'unsaved-edit' }], matches: [] };
    switchCategory(state, 'ghost');
    expect(state.activeCategoryId).toBe('c1');
    expect(state.teams).toEqual([{ id: 'unsaved-edit' }]);
  });
});

describe('addCategory', () => {
  it('appends a new category with one blank liga phase, saving the outgoing one first, and switches to it', () => {
    const state = { categories: [{ id: 'c1', nome: 'A', teams: [], phases: [{ id: 'p1', formato: 'liga', matches: [] }], activePhaseId: 'p1' }], activeCategoryId: 'c1', teams: [{ id: 'edited' }], formato: 'liga', cfg: {}, matches: [] };
    addCategory(state);
    expect(state.categories).toHaveLength(2);
    expect(state.categories[0].teams).toEqual([{ id: 'edited' }]);
    expect(state.categories[1].nome).toBe('Categoria 2');
    expect(state.categories[1].teams).toEqual([]);
    expect(state.categories[1].phases).toHaveLength(1);
    expect(state.categories[1].phases[0].nome).toBe('Fase principal');
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
    const state = { categories: [{ id: 'c1', nome: 'A', teams: [], phases: [{ id: 'p1', matches: [] }], activePhaseId: 'p1' }], activeCategoryId: 'c1', teams: [], matches: [] };
    const result = removeCategory(state, 'c1');
    expect(result).toEqual({ ok: false, reason: 'O campeonato precisa ter pelo menos uma categoria.' });
    expect(state.categories).toHaveLength(1);
  });

  it('removes a non-active category without disturbing root state', () => {
    const state = { categories: [{ id: 'c1', nome: 'A', teams: [], phases: [{ id: 'p1', matches: [] }], activePhaseId: 'p1' }, { id: 'c2', nome: 'B', teams: [], phases: [{ id: 'p2', matches: [] }], activePhaseId: 'p2' }], activeCategoryId: 'c1', teams: [{ id: 'active-edit' }], matches: [] };
    const result = removeCategory(state, 'c2');
    expect(result).toEqual({ ok: true });
    expect(state.categories.map((c) => c.id)).toEqual(['c1']);
    expect(state.activeCategoryId).toBe('c1');
  });

  it('removing the active category switches root to the new first category', () => {
    const state = { categories: [{ id: 'c1', nome: 'A', teams: [{ id: 'from-a' }], phases: [{ id: 'p1', formato: 'liga', matches: [] }], activePhaseId: 'p1' }, { id: 'c2', nome: 'B', teams: [{ id: 'from-b' }], phases: [{ id: 'p2', matches: [] }], activePhaseId: 'p2' }], activeCategoryId: 'c2', teams: [{ id: 'unsaved' }], matches: [] };
    const result = removeCategory(state, 'c2');
    expect(result).toEqual({ ok: true });
    expect(state.categories.map((c) => c.id)).toEqual(['c1']);
    expect(state.activeCategoryId).toBe('c1');
    expect(state.teams).toEqual([{ id: 'from-a' }]);
  });
});



