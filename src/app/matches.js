import { fmtDateBR } from './format.js';
import { venueById, officialById } from './ops.js';
import { advanceBracket } from './engine.js';
import { uid } from './utils.ts';
import { validate, schemas } from './schemas.js';

export function toISODate(value) {
  if (!value) {return '';}
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {return value;}
  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (brMatch) {return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;}
  return '';
}

export function matchMeta(match) {
  match.meta = match.meta || {};
  if (match.info && !match.meta._migrated) {
    const parts = splitInfo(match.info);
    match.meta.date = match.meta.date || toISODate(parts.data);
    match.meta.time = match.meta.time || parts.hora;
    match.meta.venueText = match.meta.venueText || parts.local;
    match.meta._migrated = true;
  }
  return match.meta;
}

export function splitInfo(info) {
  if (!info) {return { data: '', hora: '', local: '' };}
  const parts = info.split(/[·|]/).map((s) => s.trim());
  return { data: parts[0] || '', hora: parts[1] || '', local: parts.slice(2).join(' · ') || '' };
}

export function metaLine(state, match) {
  const meta = matchMeta(match);
  const venue = venueById(state, meta.venueId);
  const official = officialById(state, meta.refereeId);
  return [fmtDateBR(meta.date), meta.time, (venue && venue.name) || meta.venueText, official && `Árbitro: ${official.name}`]
    .filter(Boolean)
    .join(' · ');
}

export function setScore(state, matchId, field, value) {
  const match = (state.matches || []).find((m) => m.id === matchId);
  if (!match) {return { ok: false };}
  if (!['hg', 'ag'].includes(field)) {return { ok: false, reason: 'Placar inválido.' };}
  const limit = state.scoreType === 'points' ? 999 : 99;
  if (value !== '' && value != null) {
    const numeric = Number(value);
    if (!Number.isInteger(numeric) || numeric < 0 || numeric > limit) {return { ok: false, reason: `O placar deve ser um número inteiro entre 0 e ${limit}.` };}
  }
  const before = { hg: match.hg, ag: match.ag };
  match[field] = value === '' || value == null ? null : Number(value);
  const setsToWin = Number(state.cfg?.setsToWin);
  if (state.scoreType === 'sets' && Number.isInteger(setsToWin) && setsToWin > 0 && match.hg != null && match.ag != null) {
    const winner = Math.max(match.hg, match.ag);
    const loser = Math.min(match.hg, match.ag);
    if (winner !== setsToWin || loser >= setsToWin) {
      match[field] = before[field];
      return { ok: false, reason: `Placar inválido: a vitória exige exatamente ${setsToWin} sets.` };
    }
  }
  if (state.scoreType !== 'goals' && match.hg != null && match.ag != null && match.hg === match.ag) {
    match[field] = before[field];
    return { ok: false, reason: 'Esta modalidade não permite empate no resultado final.' };
  }
  match.meta = match.meta || {};
  if (match.hg != null && match.ag != null) {
    match.meta.status = 'finished';
  } else if (match.meta.status === 'finished') {
    match.meta.status = 'scheduled';
  }
  const after = { hg: match.hg, ag: match.ag };
  return { ok: true, before, after };
}

export function saveMatchOps(state, matchId, { date, time, venueId, refereeId, tableOfficialId, status, notes } = {}) {
  const match = (state.matches || []).find((m) => m.id === matchId);
  if (!match) {return { ok: false };}
  const validation = validate(schemas.match.ops, { matchId, date, time, venueId, refereeId, tableOfficialId, status, notes });
  if (!validation.ok) {return { ok: false, reason: validation.errors };}
  ({ date, time, venueId, refereeId, tableOfficialId, status, notes } = validation.data);
  const meta = matchMeta(match);
  const before = { ...meta };
  meta.date = date || '';
  meta.time = time || '';
  meta.venueId = venueId || '';
  meta.venueText = '';
  meta.refereeId = refereeId || '';
  meta.tableOfficialId = tableOfficialId || '';
  meta.status = status || 'scheduled';
  meta.notes = notes || '';
  match.info = metaLine(state, match);
  return { ok: true, before, after: { ...meta } };
}

export function clearResults(state) {
  (state.matches || []).forEach((match) => { match.hg = null; match.ag = null; match.scorers = []; match.events = []; match.meta = match.meta || {}; if (match.meta.status === 'finished') {match.meta.status = 'scheduled';} });
  if (state.bracket) {
    const resetTie = (tie) => { tie.ag1 = tie.bg1 = tie.ag2 = tie.bg2 = tie.apen = tie.bpen = null; tie.winner = null; tie.scorers = []; tie.events = []; };
    (state.bracket.rounds || []).forEach((round) => round.forEach(resetTie));
    if (state.bracket.third) {resetTie(state.bracket.third);}
    advanceBracket(state.bracket, state.cfg);
  }
  return { ok: true };
}

export function allMatchObjs(state) {
  const out = [...(state.matches || [])];
  if (state.bracket) {
    (state.bracket.rounds || []).forEach((round) => out.push(...round));
    if (state.bracket.third) {out.push(state.bracket.third);}
  }
  return out;
}

export function scheduleConflicts(state) {
  const groups = new Map();
  (state.matches || []).forEach((match) => {
    const meta = matchMeta(match);
    if (!meta.date || !meta.time) {return;}
    const slot = `${meta.date}|${meta.time}`;
    const resources = [['venueId', meta.venueId], ['refereeId', meta.refereeId], ['tableOfficialId', meta.tableOfficialId]];
    const teams = state.teams || [];
    [match.home, match.away].forEach((teamIndex) => {
      if (teamIndex == null) {return;}
      const team = teams[teamIndex];
      resources.push(['teamId', team?.id || teamIndex]);
    });
    resources.forEach(([kind, value]) => {
      if (value == null || value === '') {return;}
      const key = `${slot}|${kind}|${value}`;
      const ids = groups.get(key) || [];
      ids.push(match.id);
      groups.set(key, ids);
    });
  });
  return [...groups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, matchIds]) => ({ key, matchIds, resource: key.split('|')[2] }));
}

const EVENT_TYPES = ['goal', 'yellow', 'red'];

export function addMatchEvent(obj, { type, teamId, athleteId, name } = {}) {
  if (!obj || !EVENT_TYPES.includes(type)) {return { ok: false };}
  if (teamId == null || teamId === '') {return { ok: false, reason: 'Equipe do lance é obrigatória.' };}
  if (athleteId != null && athleteId === '') {return { ok: false, reason: 'Atleta inválido.' };}
  obj.events = obj.events || [];
  const event = { id: uid(), type, teamId, athleteId: athleteId || null, name: name || '' };
  obj.events.push(event);
  return { ok: true, event };
}

export function removeMatchEvent(obj, index) {
  if (!obj || !Array.isArray(obj.events) || !Number.isInteger(index) || index < 0 || index >= obj.events.length) {return { ok: false };}
  obj.events.splice(index, 1);
  return { ok: true };
}


