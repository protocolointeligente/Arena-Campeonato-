import { activeCategory } from './categories.js';
import { activePhaseOf } from './phases.js';
import { generateActivePhase } from './engine.js';

// Fisher-Yates. rng is injectable so callers (and tests) can get a deterministic result;
// production calls always use the default Math.random.
export function shuffle(array, rng = Math.random) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Starts a live draw over every team in the championship's active category, in a freshly
// shuffled order. Doesn't touch the real grupos/bracket yet — that only happens on applyDraw,
// once every team has been revealed (or the organizer cancels).
export function startDraw(state, { formato, nGrupos } = {}) {
  const teams = state.teams || [];
  if (teams.length < 2) {return { ok: false, reason: 'É preciso pelo menos 2 equipes para sortear.' };}
  const targetFormato = formato || state.formato;
  const pool = shuffle(teams.map((team) => team.id));
  const ng = targetFormato === 'grupos' ? Math.max(1, Math.min(nGrupos || state.cfg?.nGrupos || 2, teams.length)) : null;
  state.draw = {
    formato: targetFormato,
    nGrupos: ng,
    pool,
    groups: targetFormato === 'grupos' ? Array.from({ length: ng }, () => []) : null,
    order: targetFormato === 'grupos' ? null : [],
    done: false,
  };
  return { ok: true };
}

// Reveals the next team in the shuffled pool. For a group draw, it goes into whichever group
// currently has the fewest teams (ties broken by lowest group index) — this is what makes
// interleaveGroups() below able to reconstruct the exact same groups through the ordinary
// i % nGrupos distribution generateActivePhase() already does.
export function revealNext(state) {
  const draw = state.draw;
  if (!draw || draw.done) {return { ok: false, reason: 'Nenhum sorteio em andamento.' };}
  if (!draw.pool.length) {draw.done = true; return { ok: false, reason: 'Sorteio já concluído.' };}
  const teamId = draw.pool.shift();
  if (draw.formato === 'grupos') {
    let smallest = 0;
    draw.groups.forEach((group, i) => { if (group.length < draw.groups[smallest].length) {smallest = i;} });
    draw.groups[smallest].push(teamId);
  } else {
    draw.order.push(teamId);
  }
  if (!draw.pool.length) {draw.done = true;}
  return { ok: true, teamId };
}

// Reads drawn groups back out row-by-row (g0[0], g1[0], g0[1], g1[1], ...) instead of block by
// block, because generateActivePhase() reconstructs groups from a flat participant list via
// `i % nGrupos` — this is the inverse of that, so applyDraw() reproduces exactly the groups the
// draw revealed, not a re-shuffled approximation of them.
function interleaveGroups(groups) {
  const maxLen = Math.max(...groups.map((g) => g.length));
  const result = [];
  for (let row = 0; row < maxLen; row++) {
    groups.forEach((group) => { if (group[row] != null) {result.push(group[row]);} });
  }
  return result;
}

// Commits a finished draw: sets it as the active phase's participant order and runs the
// existing generateActivePhase() over it, exactly as if the organizer had typed that order in
// by hand. Clears state.draw once applied.
export function applyDraw(state) {
  const draw = state.draw;
  if (!draw || !draw.done) {return { ok: false, reason: 'Conclua o sorteio primeiro.' };}
  const category = activeCategory(state);
  const phase = activePhaseOf(category);
  phase.participantTeamIds = draw.formato === 'grupos' ? interleaveGroups(draw.groups) : draw.order;
  const result = generateActivePhase(state);
  if (result.ok) {state.draw = null;}
  return result;
}

export function cancelDraw(state) {
  state.draw = null;
  return { ok: true };
}
