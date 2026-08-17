import { uid } from './utils.js';

export function ensureBranding(state) {
  state.branding = state.branding || {};
  if (!state.branding.accent) state.branding.accent = '#2fcf6b';
  if (!Array.isArray(state.sponsors)) state.sponsors = [];
  return state.branding;
}

export function setAccent(state, value) {
  ensureBranding(state);
  state.branding.accent = value || '#2fcf6b';
  return { ok: true };
}

export function setBrandImage(state, kind, url) {
  ensureBranding(state);
  if (kind !== 'logo' && kind !== 'cover') return { ok: false, reason: 'Tipo inválido.' };
  state.branding[kind] = url || '';
  return { ok: true };
}

export function clearBrandImage(state, kind) {
  return setBrandImage(state, kind, '');
}

export function addSponsor(state, { name, url, logo } = {}) {
  ensureBranding(state);
  const trimmed = (name || '').trim();
  if (!trimmed) return { ok: false, reason: 'Informe o nome do patrocinador.' };
  const sponsor = { id: uid(), name: trimmed, url: (url || '').trim(), logo: logo || '' };
  state.sponsors.push(sponsor);
  return { ok: true, sponsor };
}

export function removeSponsor(state, id) {
  ensureBranding(state);
  const before = state.sponsors.length;
  state.sponsors = state.sponsors.filter((sponsor) => sponsor.id !== id);
  return { ok: state.sponsors.length < before };
}
