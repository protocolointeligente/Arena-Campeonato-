import { allMatchObjs } from './matches.js';
import { athName } from './roster.js';
import { phaseParticipants, phaseComplete, loadPhaseIntoRoot } from './phases.js';
import { saveRootIntoActive } from './categories.js';
import { makeBracketFromOrdered, advanceBracket } from './engine.js';

export const CRIT_LABEL = { P: 'Pontos', V: 'Vitórias', SG: 'Saldo de gols', GP: 'Gols pró', GC: 'Gols contra', DISC: 'Disciplina (fair-play)', CD: 'Confronto direto' };
const CRIT_DIR = { P: 'desc', V: 'desc', SG: 'desc', GP: 'desc', GC: 'asc', DISC: 'desc' };

function emptyStat(i) { return { team: i, P: 0, J: 0, V: 0, E: 0, D: 0, GP: 0, GC: 0, SG: 0, pct: 0 }; }

function h2h(aIdx, bIdx, matches) {
  let pa = 0, pb = 0;
  matches.forEach((m) => {
    if (m.hg == null || m.ag == null) return;
    if (m.home === aIdx && m.away === bIdx) { if (m.hg > m.ag) pa += 3; else if (m.hg < m.ag) pb += 3; else { pa++; pb++; } }
    else if (m.home === bIdx && m.away === aIdx) { if (m.hg > m.ag) pb += 3; else if (m.hg < m.ag) pa += 3; else { pa++; pb++; } }
  });
  return pa - pb;
}

export function computeStandings(teams, idxs, matches, cfg = {}) {
  const map = {};
  idxs.forEach((i) => { map[i] = emptyStat(i); });
  const winPts = cfg.winPts != null ? cfg.winPts : 3;
  const drawPts = cfg.drawPts != null ? cfg.drawPts : 1;
  const lossPts = cfg.lossPts != null ? cfg.lossPts : 0;
  (matches || []).forEach((m) => {
    if (m.hg == null || m.ag == null) return;
    const H = map[m.home], A = map[m.away];
    if (H) { H.J++; H.GP += m.hg; H.GC += m.ag; if (m.hg > m.ag) { H.V++; H.P += winPts; } else if (m.hg < m.ag) { H.D++; H.P += lossPts; } else { H.E++; H.P += drawPts; } }
    if (A) { A.J++; A.GP += m.ag; A.GC += m.hg; if (m.ag > m.hg) { A.V++; A.P += winPts; } else if (m.ag < m.hg) { A.D++; A.P += lossPts; } else { A.E++; A.P += drawPts; } }
  });
  const arr = Object.values(map);
  const yp = cfg.discYellow != null ? cfg.discYellow : 1;
  const rp = cfg.discRed != null ? cfg.discRed : 5;
  const byId = {};
  idxs.forEach((i) => { if (teams[i]) byId[teams[i].id] = map[i]; });
  (matches || []).forEach((m) => (m.events || []).forEach((e) => {
    const s = byId[e.teamId];
    if (!s) return;
    if (e.type === 'yellow') s.CY = (s.CY || 0) + 1;
    else if (e.type === 'red') s.CR = (s.CR || 0) + 1;
  }));
  arr.forEach((s) => { s.SG = s.GP - s.GC; s.pct = s.J && winPts > 0 ? Math.round((s.P / (s.J * winPts)) * 1000) / 10 : 0; s.CY = s.CY || 0; s.CR = s.CR || 0; s.DISC = -(s.CY * yp + s.CR * rp); });
  const order = cfg.criterios || ['P', 'V', 'SG', 'GP'];
  const legacyH2H = !order.includes('CD') && cfg.confrontoDireto !== false;
  arr.sort((a, b) => {
    for (const c of order) {
      if (c === 'CD') { const h = h2h(b.team, a.team, matches || []); if (h !== 0) return h; continue; }
      const dir = CRIT_DIR[c] || 'desc';
      const diff = dir === 'asc' ? a[c] - b[c] : b[c] - a[c];
      if (diff) return diff;
    }
    if (legacyH2H) { const d = h2h(b.team, a.team, matches || []); if (d !== 0) return d; }
    return 0;
  });
  return arr;
}

export function standingsForPhase(state, phase, idxs, matches) {
  return computeStandings(state.teams || [], idxs, matches || phase.matches || [], phase.cfg || state.cfg || {});
}

export function qualifiedFromPhase(state, phase, mode, count) {
  count = Math.max(1, +count || 1);
  const teams = state.teams || [];
  if (phase.formato === 'grupos' && mode === 'perGroup') {
    const out = [];
    (phase.grupos || []).forEach((group, gi) => {
      const idxs = group.map((id) => teams.findIndex((t) => t.id === id)).filter((i) => i >= 0);
      const ms = (phase.matches || []).filter((m) => (m.grupo || 0) === gi);
      standingsForPhase(state, phase, idxs, ms).slice(0, count).forEach((x) => out.push(teams[x.team].id));
    });
    return out;
  }
  if (phase.formato === 'mata' && phase.bracket) {
    const rounds = phase.bracket.rounds || [];
    const last = rounds[rounds.length - 1];
    const winner = last && last[0] && last[0].winner != null ? last[0].winner : null;
    return winner ? [winner] : [];
  }
  const idxs = phaseParticipants(state, phase);
  return standingsForPhase(state, phase, idxs, phase.matches || []).slice(0, count).map((x) => teams[x.team].id);
}

export function applyProgression(state, category, srcId, { force = false } = {}) {
  saveRootIntoActive(state);
  const src = (category.phases || []).find((p) => p.id === srcId);
  if (!src || !src.progression || !src.progression.targetPhaseId) return { ok: false, reason: 'no-target' };
  const target = (category.phases || []).find((p) => p.id === src.progression.targetPhaseId);
  if (!target) return { ok: false, reason: 'target-missing' };
  if (!phaseComplete(src) && !force) return { ok: false, reason: 'incomplete' };
  const ids = qualifiedFromPhase(state, src, src.progression.mode || 'overall', src.progression.count || 2);
  if (!ids.length) return { ok: false, reason: 'no-qualifiers' };
  target.participantTeamIds = [...new Set(ids)];
  target.status = 'planejada';
  target.grupos = [];
  target.matches = [];
  target.bracket = null;
  category.activePhaseId = target.id;
  loadPhaseIntoRoot(state, target);
  return { ok: true, count: ids.length, targetName: target.nome };
}

export function scorerRanking(state) {
  const agg = {};
  allMatchObjs(state).forEach((m) => (m.events || []).forEach((e) => {
    if (e.type !== 'goal') return;
    const key = e.athleteId || `n:${(e.name || '').toLowerCase()}|${e.teamId || ''}`;
    if (!agg[key]) agg[key] = { athleteId: e.athleteId, name: e.athleteId ? athName(state, e.athleteId) : (e.name || '—'), teamId: e.teamId, goals: 0 };
    agg[key].goals++;
  }));
  return Object.values(agg).sort((a, b) => b.goals - a.goals);
}

export function cardRanking(state) {
  const agg = {};
  allMatchObjs(state).forEach((m) => (m.events || []).forEach((e) => {
    if (e.type !== 'yellow' && e.type !== 'red') return;
    const key = e.athleteId || `n:${(e.name || '').toLowerCase()}|${e.teamId || ''}`;
    if (!agg[key]) agg[key] = { athleteId: e.athleteId, name: e.athleteId ? athName(state, e.athleteId) : (e.name || '—'), teamId: e.teamId, y: 0, r: 0 };
    if (e.type === 'yellow') agg[key].y++; else agg[key].r++;
  }));
  return Object.values(agg).filter((r) => r.y || r.r).sort((a, b) => (b.r * 3 + b.y) - (a.r * 3 + a.y));
}

export function standsToRows(teams, st) {
  return st.map((s, i) => [i + 1, teams[s.team].nome, s.P, s.J, s.V, s.E, s.D, s.GP, s.GC, (s.SG > 0 ? '+' : '') + s.SG, s.pct.toFixed(1)]);
}

export function genCross(state) {
  const classificam = (state.cfg && state.cfg.classificam) || 2;
  const byPos = [];
  (state.grupos || []).forEach((group, gi) => {
    const idxs = group.map((id) => state.teams.findIndex((t) => t.id === id)).filter((i) => i >= 0);
    const st = computeStandings(state.teams, idxs, (state.matches || []).filter((m) => m.grupo === gi), state.cfg || {});
    for (let p = 0; p < classificam; p++) {
      byPos[p] = byPos[p] || [];
      byPos[p].push(st[p] ? state.teams[st[p].team].id : null);
    }
  });
  let seedList = [];
  const W = byPos[0] || [], R = byPos[1] || [];
  if (classificam >= 2 && W.length === R.length && W.length > 1) {
    // Legacy's own R[j]-with-R[i]-fallback can assign the same team to two ties at once when a
    // group has fewer teams than `classificam` (R[j] and R[i] can resolve to the same id). Track
    // used ids and fall back to a null bye instead of a duplicate — makeBracketFromOrdered/
    // advanceBracket already treat null slots as byes, so this degrades safely.
    const used = new Set();
    for (let i = 0; i < W.length; i++) {
      const w = W[i];
      const j = i % 2 === 0 ? i + 1 : i - 1;
      let r = R[j] != null ? R[j] : R[i];
      if (r != null && used.has(r)) r = null;
      if (w != null) used.add(w);
      if (r != null) used.add(r);
      seedList.push(w);
      seedList.push(r);
    }
  } else {
    byPos.forEach((arr) => arr.forEach((id) => seedList.push(id)));
  }
  state.bracket = makeBracketFromOrdered(seedList, state.cfg);
  advanceBracket(state.bracket, state.cfg || {});
  return { ok: true };
}

export function suspensionInfo(state, athleteId) {
  const lim = (state.cfg && state.cfg.yellowLimit) || 3;
  let y = 0, r = 0;
  allMatchObjs(state).forEach((m) => (m.events || []).forEach((e) => {
    if (e.athleteId !== athleteId) return;
    if (e.type === 'yellow') y++;
    else if (e.type === 'red') r++;
  }));
  const pending = r > 0 || (lim > 0 && y > 0 && y % lim === 0);
  return { y, r, suspended: pending, reason: r > 0 ? 'vermelho' : (pending ? lim + 'º amarelo' : '') };
}

export function critMove(criterios, i, dir) {
  const tail = (criterios || []).filter((c) => c !== 'P');
  const j = i + dir;
  if (j < 0 || j >= tail.length) return ['P', ...tail];
  [tail[i], tail[j]] = [tail[j], tail[i]];
  return ['P', ...tail];
}

export function critRemove(criterios, i) {
  const tail = (criterios || []).filter((c) => c !== 'P');
  tail.splice(i, 1);
  return ['P', ...tail];
}

export function critAdd(criterios, value) {
  const tail = (criterios || []).filter((c) => c !== 'P');
  if (value && !tail.includes(value)) tail.push(value);
  return ['P', ...tail];
}
