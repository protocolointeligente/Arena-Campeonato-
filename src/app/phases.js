import { clone, uid } from './utils.ts';

export const PHASE_FORMATS = [
  ['liga', 'Pontos Corridos'],
  ['grupos', 'Fase de Grupos'],
  ['gxg', 'Grupo × Grupo'],
  ['mata', 'Mata-Mata'],
];

function blankPhase(state, nome, ordem) {
  return {
    id: uid(),
    nome,
    ordem,
    status: 'planejada',
    formato: 'liga',
    modelo: state.modelo || 'liga',
    scoreType: state.scoreType || 'goals',
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
      modelo: state.modelo || 'liga',
      scoreType: state.scoreType || 'goals',
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
  state.modelo = phase.modelo || state.modelo || 'liga';
  state.scoreType = phase.scoreType || state.scoreType || 'goals';
  state.cfg = clone(phase.cfg || {});
  state.grupos = clone(phase.grupos || []);
  state.matches = clone(phase.matches || []);
  state.bracket = phase.bracket ? clone(phase.bracket) : null;
}

export function saveRootIntoPhase(state, phase) {
  if (!phase) {return;}
  const keepParticipants = phase.participantTeamIds;
  const keepProgression = phase.progression;
  phase.formato = state.formato || 'liga';
  phase.modelo = state.modelo || phase.modelo || 'liga';
  phase.scoreType = state.scoreType || phase.scoreType || 'goals';
  phase.cfg = clone(state.cfg || {});
  phase.grupos = clone(state.grupos || []);
  phase.matches = clone(state.matches || []);
  phase.bracket = state.bracket ? clone(state.bracket) : null;
  phase.participantTeamIds = keepParticipants || null;
  phase.progression = keepProgression || null;
}

// Immer-compatible version
export function saveRootIntoPhaseImmer(draft, category) {
  if (!category || !category.phases?.length) {return;}
  const phase = category.phases.find((p) => p.id === category.activePhaseId) || category.phases[0];
  if (!phase) {return;}
  const keepParticipants = phase.participantTeamIds;
  const keepProgression = phase.progression;
  phase.formato = draft.formato || 'liga';
  phase.modelo = draft.modelo || phase.modelo || 'liga';
  phase.scoreType = draft.scoreType || phase.scoreType || 'goals';
  phase.cfg = clone(draft.cfg || {});
  phase.grupos = clone(draft.grupos || []);
  phase.matches = clone(draft.matches || []);
  phase.bracket = draft.bracket ? clone(draft.bracket) : null;
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
  if (!phase) {return false;}
  if (phase.formato === 'mata') {
    if (!phase.bracket) {return false;}
    const rounds = phase.bracket.rounds || [];
    const last = rounds[rounds.length - 1];
    return !!(last && last[0] && last[0].winner != null);
  }
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
  if (!phase) {return { ok: false };}
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
  if (category.activePhaseId === id) {return category;}
  const phase = (category.phases || []).find((p) => p.id === id);
  if (!phase) {return category;}
  saveRootIntoPhase(state, activePhaseOf(category));
  category.activePhaseId = id;
  loadPhaseIntoRoot(state, phase);
  return category;
}

export function setPhaseFormat(state, category, id, fmt) {
  saveRootIntoPhase(state, activePhaseOf(category));
  const phase = (category.phases || []).find((p) => p.id === id);
  if (!phase) {return { ok: false };}
  phase.formato = fmt;
  phase.grupos = [];
  phase.matches = [];
  phase.bracket = null;
  if (fmt !== 'grupos' && phase.progression && phase.progression.mode === 'perGroup') {phase.progression.mode = 'overall';}
  if (category.activePhaseId === id) {loadPhaseIntoRoot(state, phase);}
  return { ok: true };
}

export function setProgressTarget(category, srcId, targetId) {
  const phase = (category.phases || []).find((p) => p.id === srcId);
  if (!phase) {return { ok: false };}
  phase.progression = phase.progression || {};
  phase.progression.targetPhaseId = targetId || null;
  return { ok: true };
}

export function setProgressMode(category, srcId, mode) {
  const phase = (category.phases || []).find((p) => p.id === srcId);
  if (!phase) {return { ok: false };}
  phase.progression = phase.progression || {};
  phase.progression.mode = mode;
  phase.progression.count = phase.progression.count || 2;
  return { ok: true };
}

export function setProgressCount(category, srcId, count) {
  const phase = (category.phases || []).find((p) => p.id === srcId);
  if (!phase) {return { ok: false };}
  phase.progression = phase.progression || {};
  phase.progression.count = Math.max(1, +count || 1);
  return { ok: true };
}

export function progressionSummary(category, phase) {
  if (!phase.progression || !phase.progression.targetPhaseId) {return 'Progressão não configurada';}
  const target = (category.phases || []).find((p) => p.id === phase.progression.targetPhaseId);
  const mode = phase.progression.mode === 'perGroup' ? 'por grupo' : 'geral';
  return `${phase.progression.count || 2} classificado(s) ${mode} → ${target ? target.nome : 'fase removida'}`;
}



const KNOCKOUT_NAMES = { 32: '16-avos de final', 16: 'Oitavas de final', 8: 'Quartas de final', 4: 'Semifinal', 2: 'Final' };
export const KNOCKOUT_PRESETS = [[16, 'Oitavas'], [8, 'Quartas'], [4, 'Semifinal'], [2, 'Final']];

// "Oitavas", "quartas de final", "seminfinal", "Grande Final"… → nº de equipes que a fase recebe.
export function knockoutSizeFromName(name) {
  const n = String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/16\s*-?\s*avos|dezesseis/.test(n)) {return 32;}
  if (/oitava/.test(n)) {return 16;}
  if (/quarta/.test(n)) {return 8;}
  if (/semi/.test(n)) {return 4;}
  if (/final/.test(n)) {return 2;}
  return null;
}

// Classificados por grupo ([[1A,2A],[1B,2B],…]) → ordem da chave que cruza os grupos:
// 1A×2B, 1C×2D… num lado e 1B×2A, 1D×2C… no outro, pra ninguém reencontrar o próprio
// grupo antes da final. Sem pares de grupos completos, cai no seed geral (1º×último).
export function crossSeedGroups(groups) {
  const k = Math.max(0, ...groups.map((g) => g.length));
  if (k <= 1) {return groups.map((g) => g[0]).filter((id) => id != null);}
  if (groups.length % 2 === 0 && groups.every((g) => g.length === k) && k % 2 === 0) {
    const top = [], bottom = [];
    for (let i = 0; i < groups.length; i += 2) {
      const a = groups[i], b = groups[i + 1];
      for (let p = 0; p < k / 2; p++) {
        top.push(a[p], b[k - 1 - p]);
        bottom.push(b[p], a[k - 1 - p]);
      }
    }
    return top.concat(bottom);
  }
  const seeds = [];
  for (let p = 0; p < k; p++) {groups.forEach((g) => { if (g[p] != null) {seeds.push(g[p]);} });}
  const out = [];
  for (let i = 0, j = seeds.length - 1; i <= j; i++, j--) {out.push(seeds[i]); if (i !== j) {out.push(seeds[j]);}}
  return out;
}

// Transforma a fase em mata-mata para `size` equipes e faz a fase anterior mandar os
// classificados pra ela: por grupo quando a divisão é exata (8 equipes, 2 grupos → 4 por
// grupo), senão pela classificação geral. Mata-mata anterior entrega só o campeão, então
// não é ligado. Um único mata-mata já contém as rodadas seguintes (quartas → semi → final).
export function configureKnockout(state, category, phaseId, size) {
  const idx = (category.phases || []).findIndex((p) => p.id === phaseId);
  if (idx < 0) {return { ok: false };}
  const phase = category.phases[idx];
  if (category.activePhaseId === phaseId) {saveRootIntoPhase(state, phase);}
  if (phase.formato !== 'mata') {
    phase.formato = 'mata';
    phase.grupos = [];
    phase.matches = [];
    phase.bracket = null;
  }
  phase.cfg = { ...(phase.cfg || {}), knockoutSize: size };
  if (category.activePhaseId === phaseId) {loadPhaseIntoRoot(state, phase);}
  const prev = category.phases[idx - 1];
  if (!prev || prev.formato === 'mata') {return { ok: true, size, linked: false };}
  if (category.activePhaseId === prev.id) {saveRootIntoPhase(state, prev);}
  const nGroups = prev.formato === 'grupos' ? ((prev.grupos || []).length || prev.cfg?.nGrupos || 2) : 0;
  prev.progression = nGroups && size % nGroups === 0 && size / nGroups >= 1
    ? { targetPhaseId: phase.id, mode: 'perGroup', count: size / nGroups }
    : { targetPhaseId: phase.id, mode: 'overall', count: size };
  return { ok: true, size, linked: true, source: prev.nome, mode: prev.progression.mode, count: prev.progression.count };
}

// Cria a fase de mata-mata já configurada, sem trocar a fase ativa (os grupos seguem em jogo).
export function addKnockoutPhase(state, category, size) {
  ensurePhases(category, state);
  saveRootIntoPhase(state, activePhaseOf(category));
  const phase = blankPhase(state, KNOCKOUT_NAMES[size] || `Mata-mata (${size})`, category.phases.length + 1);
  category.phases.push(phase);
  return { ...configureKnockout(state, category, phase.id, size), phaseId: phase.id };
}
