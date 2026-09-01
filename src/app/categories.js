import { clone, uid } from './utils.ts';
import { ensurePhases, loadPhaseIntoRoot, saveRootIntoPhase, activePhaseOf } from './phases.js';

export function ensureCategories(state) {
  if (!state) {return state;}
  if (!Array.isArray(state.categories) || !state.categories.length) {
    const category = {
      id: uid(),
      nome: 'Categoria principal',
      ordem: 1,
      teams: clone(state.teams || []),
      matches: clone(state.matches || []),
    };
    state.categories = [category];
    state.activeCategoryId = category.id;
  }
  if (!state.activeCategoryId || !state.categories.some((category) => category.id === state.activeCategoryId)) {
    state.activeCategoryId = state.categories[0].id;
  }
  state.categories.forEach((category) => {
    if (!Array.isArray(category.teams)) {category.teams = clone(state.teams || []);}
    ensurePhases(category, state);
  });
  return state;
}

export function activeCategory(state) {
  return (state.categories || []).find((category) => category.id === state.activeCategoryId) || (state.categories || [])[0];
}

export function loadCategoryIntoRoot(state, category) {
  ensurePhases(category, state);
  state.teams = clone(category.teams || []);
  loadPhaseIntoRoot(state, activePhaseOf(category));
}

export function saveRootIntoActive(state) {
  const category = activeCategory(state);
  if (!category) {return;}
  ensurePhases(category, state);
  category.teams = clone(state.teams || []);
  saveRootIntoPhase(state, activePhaseOf(category));
}

export function switchCategory(state, id) {
  if (!state || state.activeCategoryId === id) {return state;}
  const category = state.categories.find((item) => item.id === id);
  if (!category) {return state;}
  saveRootIntoActive(state);
  state.activeCategoryId = id;
  loadCategoryIntoRoot(state, category);
  return state;
}

export function addCategory(state) {
  saveRootIntoActive(state);
  const phase = {
    id: uid(),
    nome: 'Fase principal',
    ordem: 1,
    status: 'planejada',
    formato: 'liga',
    cfg: clone(state.cfg || {}),
    grupos: [],
    matches: [],
    bracket: null,
    participantTeamIds: null,
    progression: null,
  };
  const category = {
    id: uid(),
    nome: `Categoria ${state.categories.length + 1}`,
    ordem: state.categories.length + 1,
    teams: [],
    phases: [phase],
    activePhaseId: phase.id,
  };
  state.categories.push(category);
  state.activeCategoryId = category.id;
  loadCategoryIntoRoot(state, category);
  return state;
}

export function renameCategory(state, id, name) {
  const category = state.categories.find((item) => item.id === id);
  if (!category) {return state;}
  category.nome = (name || '').trim() || 'Categoria';
  return state;
}

export function removeCategory(state, id) {
  if (state.categories.length <= 1) {
    return { ok: false, reason: 'O campeonato precisa ter pelo menos uma categoria.' };
  }
  saveRootIntoActive(state);
  state.categories = state.categories.filter((category) => category.id !== id);
  if (state.activeCategoryId === id) {
    state.activeCategoryId = state.categories[0].id;
    loadCategoryIntoRoot(state, state.categories[0]);
  }
  return { ok: true };
}


