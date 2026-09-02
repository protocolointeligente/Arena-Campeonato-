import { findTie } from './engine.js';
import { teamNameById } from './roster.js';
import { MODALITIES } from './templates.js';

const SIDES = ['home', 'away'];

export function findScoreboardObj(state, id, kind) {
  if (kind === 'tie') {return findTie(state.bracket, id);}
  return (state.matches || []).find((m) => m.id === id) || null;
}

function ensureScoreboard(obj) {
  obj.clock = obj.clock || { running: false, startedAt: null, elapsedMs: 0, period: 1 };
  obj.fouls = obj.fouls || { home: 0, away: 0 };
  obj.timeouts = obj.timeouts || { home: 0, away: 0 };
  obj.penalties = obj.penalties || { home: 0, away: 0 };
  if (obj.server === undefined) {obj.server = null;}
  return obj;
}

export function currentElapsedMs(obj) {
  const clock = obj?.clock;
  if (!clock) {return 0;}
  if (clock.running && clock.startedAt != null) {return (clock.elapsedMs || 0) + (Date.now() - clock.startedAt);}
  return clock.elapsedMs || 0;
}

export function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function clockToggle(obj) {
  ensureScoreboard(obj);
  if (obj.clock.running) {
    obj.clock.elapsedMs = currentElapsedMs(obj);
    obj.clock.running = false;
    obj.clock.startedAt = null;
  } else {
    obj.clock.running = true;
    obj.clock.startedAt = Date.now();
  }
  return { ok: true };
}

export function clockReset(obj) {
  ensureScoreboard(obj);
  obj.clock.running = false;
  obj.clock.startedAt = null;
  obj.clock.elapsedMs = 0;
  return { ok: true };
}

export function setPeriod(obj, delta) {
  ensureScoreboard(obj);
  const next = (obj.clock.period || 1) + delta;
  if (next < 1 || next > 20) {return { ok: false, reason: 'Período fora do intervalo.' };}
  obj.clock.period = next;
  return { ok: true };
}

function adjustCounter(obj, key, side, delta) {
  if (!SIDES.includes(side)) {return { ok: false, reason: 'Lado inválido.' };}
  ensureScoreboard(obj);
  const next = (obj[key][side] || 0) + delta;
  if (next < 0 || next > 99) {return { ok: false, reason: 'Valor fora do intervalo.' };}
  obj[key][side] = next;
  return { ok: true };
}

export function adjustFoul(obj, side, delta) {return adjustCounter(obj, 'fouls', side, delta);}
export function adjustTimeout(obj, side, delta) {return adjustCounter(obj, 'timeouts', side, delta);}
export function adjustPenalty(obj, side, delta) {return adjustCounter(obj, 'penalties', side, delta);}

export function toggleServer(obj) {
  ensureScoreboard(obj);
  obj.server = obj.server === 'home' ? 'away' : obj.server === 'away' ? null : 'home';
  return { ok: true };
}

export function adjustScore(obj, field, delta) {
  const next = Math.max(0, (obj[field] || 0) + delta);
  obj[field] = next;
  return { ok: true, value: next };
}

export function scoreboardMode(state) {
  const category = MODALITIES[state.modalidade]?.category;
  if (state.scoreType === 'sets') {return 'sets';}
  if (state.scoreType === 'points') {return category === 'lutas' ? 'combat' : 'points';}
  return 'goals';
}

export function scoreboardPayload(state, id, kind) {
  const obj = findScoreboardObj(state, id, kind);
  if (!obj) {return null;}
  const clock = obj.clock || { running: false, startedAt: null, elapsedMs: 0, period: 1 };
  const fouls = obj.fouls || { home: 0, away: 0 };
  const timeouts = obj.timeouts || { home: 0, away: 0 };
  const penalties = obj.penalties || { home: 0, away: 0 };
  // The live scoreboard only ever operates leg 1 of a bracket tie — leg 2 of a two-leg
  // tie is entered manually via the Chaveamento tab, never through this live control.
  const homeField = kind === 'tie' ? 'ag1' : 'hg';
  const awayField = kind === 'tie' ? 'bg1' : 'ag';
  const homeName = kind === 'tie' ? (teamNameById(state, obj.a) || 'A definir') : (state.teams?.[obj.home]?.nome || 'A definir');
  const awayName = kind === 'tie' ? (teamNameById(state, obj.b) || 'A definir') : (state.teams?.[obj.away]?.nome || 'A definir');
  return {
    id, kind, leg: kind === 'tie' ? 1 : null,
    homeField, awayField, homeName, awayName,
    hg: obj[homeField] ?? null, ag: obj[awayField] ?? null,
    mode: scoreboardMode(state),
    clock: { running: !!clock.running, period: clock.period || 1, elapsedMs: currentElapsedMs({ clock }) },
    fouls, timeouts, penalties, server: obj.server ?? null,
  };
}
