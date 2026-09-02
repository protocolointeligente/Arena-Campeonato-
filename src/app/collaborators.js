import { uid } from './utils.ts';
import { STAFF_ROLES } from './ops.js';

export { STAFF_ROLES };

export const COLLAB_ROLES = {
  admin: { name: 'Administrador', desc: 'Pode gerenciar praticamente todo o campeonato.' },
  results: { name: 'Resultados e súmulas', desc: 'Pode operar partidas, placares, eventos e consultar competição.' },
  registrations: { name: 'Inscrições', desc: 'Pode analisar inscrições, equipes e atletas.' },
  viewer: { name: 'Leitura interna', desc: 'Pode acessar o painel sem editar dados.' },
};

// A real ChampionshipStore's state is Immer's finalized, deeply frozen output. persist() and
// every permission check in championship/index.js call can()/myRole() straight on
// store.getState() — never inside store.produce() — so this must not try to write
// `state.collaborators = []` there. It always returns a usable array either way; only when
// `state` isn't frozen (a produce() draft, or a plain object in a test) does it also attach
// that array back onto state, which the mutating callers below (inviteManager and friends,
// always called inside store.produce()) rely on.
export function ensureCollaborators(state) {
  if (Array.isArray(state.collaborators)) {return state.collaborators;}
  const collaborators = [];
  if (!Object.isFrozen(state)) {state.collaborators = collaborators;}
  return collaborators;
}

// NOTE: legacy also OR's in isPlatformSuperadmin() here so platform superadmins can
// manage any championship. isSuperadmin() (src/services/superadmin.js) is async, and
// this module must stay synchronous/pure, so that override lives in the page layer
// instead — see championship.js's persist()/managementView() gates.
export function isOwner(state, user) {
  return !!(state && user && state.ownerUid === user.uid);
}

export function myCollaborator(state, user) {
  const collaborators = ensureCollaborators(state);
  const email = (user?.email || '').toLowerCase();
  if (!email) {return null;}
  return collaborators.find((c) => (c.email || '').toLowerCase() === email && c.status !== 'revoked') || null;
}

export function myRole(state, user) {
  if (isOwner(state, user)) {return 'owner';}
  const collaborator = myCollaborator(state, user);
  return collaborator ? collaborator.role : 'none';
}

export function can(state, user, permission) {
  const role = myRole(state, user);
  if (role === 'owner' || role === 'admin') {return true;}
  if (role === 'results') {return ['view', 'results'].includes(permission);}
  if (role === 'registrations') {return ['view', 'registrations'].includes(permission);}
  if (role === 'viewer') {return permission === 'view';}
  return false;
}

export function mutationPermission(tab) {
  if (['jogos', 'chave', 'placar'].includes(tab)) {return 'results';}
  if (tab === 'inscricoes') {return 'registrations';}
  return 'admin';
}

export function roleLabel(state, user) {
  const role = myRole(state, user);
  if (role === 'owner') {return 'Proprietário';}
  return COLLAB_ROLES[role]?.name || 'Sem acesso';
}

export function inviteManager(state, user, { email, role }) {
  if (!isOwner(state, user) && !can(state, user, 'admin')) {return { ok: false, reason: 'Sem permissão.' };}
  const trimmedEmail = (email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {return { ok: false, reason: 'Informe um e-mail válido.' };}
  if (trimmedEmail === (state.ownerEmail || '').toLowerCase()) {return { ok: false, reason: 'Este e-mail já é o proprietário.' };}
  const chosenRole = COLLAB_ROLES[role] ? role : 'viewer';
  const collaborators = ensureCollaborators(state);
  const existing = collaborators.find((c) => (c.email || '').toLowerCase() === trimmedEmail);
  if (existing) {
    existing.role = chosenRole;
    existing.status = 'active';
    return { ok: true, collaborator: existing };
  }
  const collaborator = { id: uid(), email: trimmedEmail, role: chosenRole, status: 'active', createdAt: Date.now() };
  collaborators.push(collaborator);
  return { ok: true, collaborator };
}

export function changeManagerRole(state, user, id, role) {
  if (!isOwner(state, user)) {return { ok: false, reason: 'Sem permissão.' };}
  const collaborators = ensureCollaborators(state);
  const collaborator = collaborators.find((c) => c.id === id);
  if (!collaborator) {return { ok: false, reason: 'Colaborador não encontrado.' };}
  collaborator.role = COLLAB_ROLES[role] ? role : collaborator.role;
  return { ok: true };
}

export function removeManager(state, user, id) {
  if (!isOwner(state, user)) {return { ok: false, reason: 'Sem permissão.' };}
  const collaborators = ensureCollaborators(state);
  const before = collaborators.length;
  state.collaborators = collaborators.filter((c) => c.id !== id);
  if (state.collaborators.length === before) {return { ok: false, reason: 'Colaborador não encontrado.' };}
  return { ok: true };
}


