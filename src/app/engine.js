import { uid } from './utils.js';
import { activeCategory, saveRootIntoActive } from './categories.js';
import { ensurePhases, activePhaseOf, phaseParticipants, loadPhaseIntoRoot } from './phases.js';

export function roundRobin(teams) {
  let t = teams.slice();
  const bye = t.length % 2 !== 0;
  if (bye) t.push(-1);
  const n = t.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const g = [];
    for (let i = 0; i < n / 2; i++) {
      let h = t[i], a = t[n - 1 - i];
      if (h !== -1 && a !== -1) {
        if (r % 2 === 1 && i === 0) [h, a] = [a, h];
        g.push([h, a]);
      }
    }
    rounds.push(g);
    t.splice(1, 0, t.pop());
  }
  return rounds;
}

export function buildFixtures(idxs, turnos) {
  let rounds = roundRobin(idxs);
  if (turnos >= 2) rounds = rounds.concat(rounds.map((g) => g.map(([h, a]) => [a, h])));
  const matches = [];
  rounds.forEach((g, ri) => g.forEach(([h, a]) => matches.push({ id: uid(), rodada: ri + 1, home: h, away: a, hg: null, ag: null, info: '', scorers: [] })));
  return matches;
}

export function buildGxg(idxsA, idxsB, turnos) {
  const matches = [];
  idxsA.forEach((a, ai) => idxsB.forEach((b) => matches.push({ id: uid(), rodada: ai + 1, home: a, away: b, hg: null, ag: null, info: '', scorers: [] })));
  if (turnos >= 2) idxsA.forEach((a, ai) => idxsB.forEach((b) => matches.push({ id: uid(), rodada: idxsA.length + ai + 1, home: b, away: a, hg: null, ag: null, info: '', scorers: [] })));
  return matches;
}

export function generateActivePhase(state) {
  saveRootIntoActive(state);
  const category = activeCategory(state);
  ensurePhases(category, state);
  const phase = activePhaseOf(category);
  const participants = phaseParticipants(state, phase);
  if (participants.length < 2) return { ok: false, reason: 'A fase precisa ter pelo menos 2 equipes participantes.' };
  const teams = state.teams || [];
  const turnos = (phase.cfg && phase.cfg.turnos) || 1;
  phase.grupos = [];
  phase.matches = [];
  phase.bracket = null;
  if (phase.formato === 'liga') {
    phase.matches = buildFixtures(participants, turnos);
  } else if (phase.formato === 'grupos') {
    const ng = Math.max(1, Math.min((phase.cfg && phase.cfg.nGrupos) || 2, participants.length));
    phase.grupos = Array.from({ length: ng }, () => []);
    participants.forEach((ti, i) => phase.grupos[i % ng].push(teams[ti].id));
    phase.grupos.forEach((group, gi) => {
      const idxs = group.map((id) => teams.findIndex((t) => t.id === id));
      buildFixtures(idxs, turnos).forEach((match) => { match.grupo = gi; phase.matches.push(match); });
    });
  } else if (phase.formato === 'gxg') {
    if (participants.length < 4) return { ok: false, reason: 'Interzonas precisa de pelo menos 4 equipes.' };
    const groups = [[], []];
    participants.forEach((ti, i) => groups[i % 2].push(teams[ti].id));
    phase.grupos = groups;
    const idxsA = groups[0].map((id) => teams.findIndex((t) => t.id === id));
    const idxsB = groups[1].map((id) => teams.findIndex((t) => t.id === id));
    phase.matches = buildGxg(idxsA, idxsB, turnos);
  } else {
    return { ok: false, reason: 'Este formato ainda não está disponível nesta fase da migração.' };
  }
  phase.status = 'andamento';
  loadPhaseIntoRoot(state, phase);
  return { ok: true };
}
