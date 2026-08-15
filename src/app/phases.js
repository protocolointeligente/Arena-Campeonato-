import { clone, uid } from './utils.js';

export const PHASE_FORMATS = [
  ['liga', 'Pontos Corridos'],
  ['grupos', 'Fase de Grupos'],
  ['gxg', 'Grupo × Grupo'],
];

function blankPhase(state, nome, ordem) {
  return {
    id: uid(),
    nome,
    ordem,
    status: 'planejada',
    formato: 'liga',
    cfg: clone(state.cfg || {}),
    grupos: [],
    matches: [],
    bracket: null,
    participantTeamIds: null,
    progression: null,
  };
}

export function ensurePhases(category, state) {
  if (!Array.isArray(category.phases) || !category.phases.length) {
    const phase = {
      id: uid(),
      nome: 'Fase principal',
      ordem: 1,
      status: 'planejada',
      formato: state.formato || 'liga',
      cfg: clone(state.cfg || {}),
      grupos: [],
      matches: clone(category.matches || []),
      bracket: null,
      participantTeamIds: null,
      progression: null,
    };
    category.phases = [phase];
    category.activePhaseId = phase.id;
    delete category.matches;
  }
  if (!category.activePhaseId || !category.phases.some((p) => p.id === category.activePhaseId)) {
    category.activePhaseId = category.phases[0].id;
  }
  return category;
}

export function loadPhaseIntoRoot(state, phase) {
  state.formato = phase.formato || 'liga';
  state.cfg = clone(phase.cfg || {});
  state.grupos = clone(phase.grupos || []);
  state.matches = clone(phase.matches || []);
  state.bracket = phase.bracket ? clone(phase.bracket) : null;
}

export function saveRootIntoPhase(state, phase) {
  if (!phase) return;
  const keepParticipants = phase.participantTeamIds;
  const keepProgression = phase.progression;
  phase.formato = state.formato || 'liga';
  phase.cfg = clone(state.cfg || {});
  phase.grupos = clone(state.grupos || []);
  phase.matches = clone(state.matches || []);
  phase.bracket = state.bracket ? clone(state.bracket) : null;
  phase.participantTeamIds = keepParticipants || null;
  phase.progression = keepProgression || null;
}

export function activePhaseOf(category) {
  return (category.phases || []).find((p) => p.id === category.activePhaseId) || (category.phases || [])[0];
}

export function phaseParticipants(state, phase) {
  const ids = phase && Array.isArray(phase.participantTeamIds) && phase.participantTeamIds.length
    ? phase.participantTeamIds
    : null;
  const teams = state.teams || [];
  return ids
    ? ids.map((id) => teams.findIndex((t) => t.id === id)).filter((i) => i >= 0)
    : teams.map((_, i) => i);
}

export function phaseComplete(phase) {
  if (!phase) return false;
  // mata (bracket) completion needs winnerOf/tieObj — Phase 3a/3b. Unreachable today:
  // the format picker never offers 'mata' yet (see this plan's Rescope note).
  if (phase.formato === 'mata') return false;
  return (phase.matches || []).length > 0 && (phase.matches || []).every((m) => m.hg != null && m.ag != null);
}

export function addPhase(state, category) {
  ensurePhases(category, state);
  saveRootIntoPhase(state, activePhaseOf(category));
  const ordem = category.phases.length + 1;
  const phase = blankPhase(state, `Fase ${ordem}`, ordem);
  category.phases.push(phase);
  category.activePhaseId = phase.id;
  loadPhaseIntoRoot(state, phase);
  return phase;
}

export function renamePhase(category, id, name) {
  const phase = (category.phases || []).find((p) => p.id === id);
  if (!phase) return { ok: false };
  phase.nome = (name || '').trim() || 'Fase';
  return { ok: true };
}

export function removePhase(state, category, id) {
  if (category.phases.length <= 1) {
    return { ok: false, reason: 'A categoria precisa ter pelo menos uma fase.' };
  }
  saveRootIntoPhase(state, activePhaseOf(category));
  category.phases = category.phases.filter((p) => p.id !== id);
  if (category.activePhaseId === id) {
    category.activePhaseId = category.phases[0].id;
    loadPhaseIntoRoot(state, category.phases[0]);
  }
  return { ok: true };
}

export function switchPhase(state, category, id) {
  if (category.activePhaseId === id) return category;
  const phase = (category.phases || []).find((p) => p.id === id);
  if (!phase) return category;
  saveRootIntoPhase(state, activePhaseOf(category));
  category.activePhaseId = id;
  loadPhaseIntoRoot(state, phase);
  return category;
}

export function setPhaseFormat(state, category, id, fmt) {
  saveRootIntoPhase(state, activePhaseOf(category));
  const phase = (category.phases || []).find((p) => p.id === id);
  if (!phase) return { ok: false };
  phase.formato = fmt;
  phase.grupos = [];
  phase.matches = [];
  phase.bracket = null;
  if (category.activePhaseId === id) loadPhaseIntoRoot(state, phase);
  return { ok: true };
}

export function setProgressTarget(category, srcId, targetId) {
  const phase = (category.phases || []).find((p) => p.id === srcId);
  if (!phase) return { ok: false };
  phase.progression = phase.progression || {};
  phase.progression.targetPhaseId = targetId || null;
  return { ok: true };
}

export function setProgressMode(category, srcId, mode) {
  const phase = (category.phases || []).find((p) => p.id === srcId);
  if (!phase) return { ok: false };
  phase.progression = phase.progression || {};
  phase.progression.mode = mode;
  phase.progression.count = phase.progression.count || 2;
  return { ok: true };
}

export function setProgressCount(category, srcId, count) {
  const phase = (category.phases || []).find((p) => p.id === srcId);
  if (!phase) return { ok: false };
  phase.progression = phase.progression || {};
  phase.progression.count = Math.max(1, +count || 1);
  return { ok: true };
}

export function progressionSummary(category, phase) {
  if (!phase.progression || !phase.progression.targetPhaseId) return 'Progressão não configurada';
  const target = (category.phases || []).find((p) => p.id === phase.progression.targetPhaseId);
  const mode = phase.progression.mode === 'perGroup' ? 'por grupo' : 'geral';
  return `${phase.progression.count || 2} classificado(s) ${mode} → ${target ? target.nome : 'fase removida'}`;
}
