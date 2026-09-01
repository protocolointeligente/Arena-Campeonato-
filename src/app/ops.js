import { uid } from './utils.ts';

export const STAFF_ROLES = [
  ['tecnico', 'Técnico'],
  ['auxiliar', 'Auxiliar técnico'],
  ['preparador', 'Preparador físico'],
  ['medico', 'Médico / Fisioterapeuta'],
];

export function ensureOps(state) {
  state.venues = Array.isArray(state.venues) ? state.venues : [];
  state.officials = Array.isArray(state.officials) ? state.officials : [];
  return state;
}

export function venueById(state, id) {
  return (state.venues || []).find((venue) => venue.id === id) || null;
}

export function officialById(state, id) {
  return (state.officials || []).find((official) => official.id === id) || null;
}

export function addVenue(state, { name, address }) {
  const trimmed = (name || '').trim();
  if (!trimmed) {return { ok: false, reason: 'Informe o nome do local.' };}
  state.venues = state.venues || [];
  const venue = { id: uid(), name: trimmed, address: (address || '').trim() };
  state.venues.push(venue);
  return { ok: true, venue };
}

export function removeVenue(state, id) {
  const before = (state.venues || []).length;
  state.venues = (state.venues || []).filter((venue) => venue.id !== id);
  return { ok: state.venues.length < before };
}

export function addOfficial(state, { name, role, phone }) {
  const trimmed = (name || '').trim();
  if (!trimmed) {return { ok: false, reason: 'Informe o nome do oficial.' };}
  state.officials = state.officials || [];
  const official = { id: uid(), name: trimmed, role: (role || '').trim(), phone: (phone || '').trim() };
  state.officials.push(official);
  return { ok: true, official };
}

export function removeOfficial(state, id) {
  const before = (state.officials || []).length;
  state.officials = (state.officials || []).filter((official) => official.id !== id);
  return { ok: state.officials.length < before };
}

export function setTeamStaff(team, key, value) {
  if (!team) {return { ok: false };}
  team.staff = team.staff || {};
  team.staff[key] = (value || '').trim();
  return { ok: true };
}


