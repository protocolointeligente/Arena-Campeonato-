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

export function tieObj(a, b) {
  return { id: uid(), a, b, ag1: null, bg1: null, ag2: null, bg2: null, apen: null, bpen: null, winner: null, info1: '', info2: '', scorers: [] };
}

export function nextPow2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function makeBracketFromOrdered(ids, cfg) {
  const list = ids.slice();
  const size = nextPow2(list.length);
  while (list.length < size) list.push(null);
  const rounds = [];
  let cur = [];
  for (let i = 0; i < list.length; i += 2) cur.push(tieObj(list[i], list[i + 1]));
  rounds.push(cur);
  while (cur.length > 1) {
    const next = [];
    for (let i = 0; i < cur.length; i += 2) next.push(tieObj(null, null));
    rounds.push(next);
    cur = next;
  }
  const bracket = { rounds };
  if (ids.length >= 4 && (!cfg || cfg.terceiro !== false)) bracket.third = tieObj(null, null);
  return bracket;
}

export function resolveTie(tie, single, allowBye = true) {
  if (tie.a == null && tie.b == null) { tie.winner = null; return; }
  if (tie.a == null || tie.b == null) { tie.winner = allowBye ? (tie.a || tie.b) : null; return; }
  let ag, bg;
  if (single) { ag = tie.ag1; bg = tie.bg1; }
  else { ag = (tie.ag1 || 0) + (tie.ag2 || 0); bg = (tie.bg1 || 0) + (tie.bg2 || 0); }
  const filled = single ? (tie.ag1 != null && tie.bg1 != null) : (tie.ag1 != null && tie.bg1 != null && tie.ag2 != null && tie.bg2 != null);
  if (!filled) { tie.winner = null; return; }
  if (ag > bg) tie.winner = tie.a;
  else if (bg > ag) tie.winner = tie.b;
  else if (tie.apen != null && tie.bpen != null && tie.apen !== tie.bpen) tie.winner = tie.apen > tie.bpen ? tie.a : tie.b;
  else tie.winner = null;
}

export function winnerOf(tie) {
  return tie && tie.winner != null ? tie.winner : null;
}

export function loserOf(tie) {
  if (tie.winner == null) return null;
  return tie.winner === tie.a ? tie.b : tie.a;
}

export function advanceBracket(bracket, cfg) {
  const rounds = bracket.rounds;
  const single = !!(cfg && cfg.maoUnica);
  // A round-0 tie is structurally empty iff both sides were null at construction (padding).
  // A round r>0 tie is structurally empty iff BOTH of its feeder ties (round r-1) are
  // structurally empty — i.e. no real team can ever reach it. Purely score-independent,
  // so this is safe to recompute every call.
  const empty = [rounds[0].map((tie) => tie.a == null && tie.b == null)];
  for (let r = 1; r < rounds.length; r++) {
    empty.push(rounds[r].map((_, i) => empty[r - 1][2 * i] && empty[r - 1][2 * i + 1]));
  }
  // A tie is allowed to auto-advance a lone present side as a "bye" when it's round 0
  // (a genuine construction-time bye) OR when exactly one of its two feeder ties is
  // structurally empty (that feeder can never produce an opponent — not "pending", "never").
  const allowBye = (r, i) => r === 0 || empty[r - 1][2 * i] !== empty[r - 1][2 * i + 1];
  rounds.forEach((round, r) => round.forEach((tie, i) => resolveTie(tie, single, allowBye(r, i))));
  for (let r = 0; r < rounds.length - 1; r++) {
    rounds[r].forEach((tie, i) => {
      const target = rounds[r + 1][Math.floor(i / 2)];
      target[i % 2 === 0 ? 'a' : 'b'] = tie.winner;
    });
  }
  if (bracket.third && rounds.length >= 2) {
    const semis = rounds[rounds.length - 2];
    if (semis.length === 2) {
      bracket.third.a = loserOf(semis[0]);
      bracket.third.b = loserOf(semis[1]);
    }
  }
  rounds.forEach((round, r) => round.forEach((tie, i) => resolveTie(tie, single, allowBye(r, i))));
  if (bracket.third) resolveTie(bracket.third, single, false);
}

export function findTie(bracket, id) {
  if (!bracket) return null;
  for (const round of bracket.rounds) {
    const tie = round.find((t) => t.id === id);
    if (tie) return tie;
  }
  if (bracket.third && bracket.third.id === id) return bracket.third;
  return null;
}

export function generateActivePhase(state) {
  // root state is the source of truth for the active phase's formato/cfg — mutating phase.formato/cfg
  // without syncing root first is silently discarded by saveRootIntoActive below.
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
  } else if (phase.formato === 'mata') {
    const ids = participants.map((ti) => teams[ti].id);
    phase.bracket = makeBracketFromOrdered(ids, phase.cfg);
  } else {
    return { ok: false, reason: 'Formato de fase desconhecido.' };
  }
  phase.status = 'andamento';
  loadPhaseIntoRoot(state, phase);
  return { ok: true };
}
