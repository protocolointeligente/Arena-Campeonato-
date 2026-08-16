import { fmtDateBR } from './format.js';
import { venueById, officialById } from './ops.js';
import { advanceBracket } from './engine.js';

export function toISODate(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
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
  if (!info) return { data: '', hora: '', local: '' };
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
  if (!match) return { ok: false };
  const before = { hg: match.hg, ag: match.ag };
  match[field] = value === '' || value == null ? null : Number(value);
  const after = { hg: match.hg, ag: match.ag };
  return { ok: true, before, after };
}

export function saveMatchOps(state, matchId, { date, time, venueId, refereeId, tableOfficialId, status, notes } = {}) {
  const match = (state.matches || []).find((m) => m.id === matchId);
  if (!match) return { ok: false };
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
  (state.matches || []).forEach((match) => { match.hg = null; match.ag = null; match.scorers = []; });
  if (state.bracket) {
    const resetTie = (tie) => { tie.ag1 = tie.bg1 = tie.ag2 = tie.bg2 = tie.apen = tie.bpen = null; tie.winner = null; tie.scorers = []; };
    (state.bracket.rounds || []).forEach((round) => round.forEach(resetTie));
    if (state.bracket.third) resetTie(state.bracket.third);
    advanceBracket(state.bracket, state.cfg);
  }
  return { ok: true };
}
