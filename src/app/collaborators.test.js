import { describe, it, expect } from 'vitest';
import {
  COLLAB_ROLES, ensureCollaborators, isOwner, myCollaborator, myRole, can,
  roleLabel, inviteManager, removeManager, changeManagerRole, mutationPermission,
} from './collaborators.js';

const OWNER = { uid: 'owner-1', email: 'owner@example.com' };
const OTHER = { uid: 'other-1', email: 'other@example.com' };

describe('mutation permissions', () => {
  it('maps operational tabs to narrow permissions', () => {
    expect(mutationPermission('jogos')).toBe('results');
    expect(mutationPermission('placar')).toBe('results');
    expect(mutationPermission('chave')).toBe('results');
    expect(mutationPermission('inscricoes')).toBe('registrations');
    expect(mutationPermission('equipes')).toBe('admin');
  });
});

function championship(overrides = {}) {
  return { ownerUid: OWNER.uid, ownerEmail: OWNER.email, collaborators: [], ...overrides };
}

describe('ensureCollaborators', () => {
  it('initializes a missing collaborators array', () => {
    const state = { ownerUid: OWNER.uid };
    ensureCollaborators(state);
    expect(state.collaborators).toEqual([]);
  });

  it('leaves an existing array untouched', () => {
    const state = championship({ collaborators: [{ id: 'c1', email: 'x@x.com', role: 'admin', status: 'active' }] });
    ensureCollaborators(state);
    expect(state.collaborators).toHaveLength(1);
  });

  // Regression: a real ChampionshipStore returns Immer's frozen finalized state. persist()
  // and every permission check in championship/index.js call can()/myRole() directly on
  // store.getState() — never inside store.produce() — so ensureCollaborators must not try to
  // write `state.collaborators = []` there; every existing test above uses a plain object,
  // which never exercised the frozen path.
  it('does not throw on frozen state, and still returns a usable array', () => {
    const state = Object.freeze({ ownerUid: OWNER.uid });
    expect(() => ensureCollaborators(state)).not.toThrow();
    expect(ensureCollaborators(state)).toEqual([]);
  });
});

describe('isOwner', () => {
  it('is true when user.uid matches state.ownerUid', () => {
    expect(isOwner(championship(), OWNER)).toBe(true);
  });

  it('is false for a non-owner', () => {
    expect(isOwner(championship(), OTHER)).toBe(false);
  });

  it('is false for no user', () => {
    expect(isOwner(championship(), null)).toBe(false);
  });
});

describe('myCollaborator / myRole / can', () => {
  it('owner gets role "owner" and can do everything', () => {
    const state = championship();
    expect(myRole(state, OWNER)).toBe('owner');
    expect(can(state, OWNER, 'admin')).toBe(true);
    expect(can(state, OWNER, 'view')).toBe(true);
  });

  it('a stranger with no collaborator entry gets role "none" and no permission', () => {
    const state = championship();
    expect(myCollaborator(state, OTHER)).toBeNull();
    expect(myRole(state, OTHER)).toBe('none');
    expect(can(state, OTHER, 'view')).toBe(false);
  });

  it('an active collaborator gets their assigned role', () => {
    const state = championship({ collaborators: [{ id: 'c1', email: OTHER.email, role: 'results', status: 'active' }] });
    expect(myRole(state, OTHER)).toBe('results');
    expect(can(state, OTHER, 'results')).toBe(true);
    expect(can(state, OTHER, 'view')).toBe(true);
    expect(can(state, OTHER, 'admin')).toBe(false);
    expect(can(state, OTHER, 'registrations')).toBe(false);
  });

  it('a revoked collaborator is treated as having no role', () => {
    const state = championship({ collaborators: [{ id: 'c1', email: OTHER.email, role: 'admin', status: 'revoked' }] });
    expect(myCollaborator(state, OTHER)).toBeNull();
    expect(myRole(state, OTHER)).toBe('none');
  });

  it('email match is case-insensitive', () => {
    const state = championship({ collaborators: [{ id: 'c1', email: 'OTHER@EXAMPLE.COM', role: 'viewer', status: 'active' }] });
    expect(myRole(state, OTHER)).toBe('viewer');
  });

  it('does not throw when checking a non-owner on frozen state with no collaborators array (the real persist() crash path)', () => {
    const state = Object.freeze({ ownerUid: OWNER.uid, ownerEmail: OWNER.email });
    expect(() => can(state, OTHER, 'results')).not.toThrow();
    expect(can(state, OTHER, 'results')).toBe(false);
  });

  it('viewer can only view; registrations role covers view+registrations', () => {
    const state = championship({ collaborators: [{ id: 'c1', email: OTHER.email, role: 'registrations', status: 'active' }] });
    expect(can(state, OTHER, 'view')).toBe(true);
    expect(can(state, OTHER, 'registrations')).toBe(true);
    expect(can(state, OTHER, 'results')).toBe(false);
  });
});

describe('roleLabel', () => {
  it('labels the owner', () => {
    expect(roleLabel(championship(), OWNER)).toBe('Proprietário');
  });

  it('labels a named role from COLLAB_ROLES', () => {
    const state = championship({ collaborators: [{ id: 'c1', email: OTHER.email, role: 'admin', status: 'active' }] });
    expect(roleLabel(state, OTHER)).toBe(COLLAB_ROLES.admin.name);
  });

  it('labels a stranger as having no access', () => {
    expect(roleLabel(championship(), OTHER)).toBe('Sem acesso');
  });
});

describe('inviteManager', () => {
  it('rejects when the caller is neither owner nor admin', () => {
    const state = championship();
    const result = inviteManager(state, OTHER, { email: 'new@x.com', role: 'viewer' });
    expect(result.ok).toBe(false);
  });

  it('rejects an invalid email', () => {
    const state = championship();
    const result = inviteManager(state, OWNER, { email: 'not-an-email', role: 'viewer' });
    expect(result.ok).toBe(false);
  });

  it('rejects inviting the owner\'s own email', () => {
    const state = championship();
    const result = inviteManager(state, OWNER, { email: OWNER.email, role: 'admin' });
    expect(result.ok).toBe(false);
  });

  it('adds a new active collaborator', () => {
    const state = championship();
    const result = inviteManager(state, OWNER, { email: 'new@x.com', role: 'results' });
    expect(result.ok).toBe(true);
    expect(state.collaborators).toHaveLength(1);
    expect(state.collaborators[0]).toMatchObject({ email: 'new@x.com', role: 'results', status: 'active' });
  });

  it('re-inviting an existing email updates role and reactivates it', () => {
    const state = championship({ collaborators: [{ id: 'c1', email: 'new@x.com', role: 'viewer', status: 'revoked' }] });
    const result = inviteManager(state, OWNER, { email: 'new@x.com', role: 'admin' });
    expect(result.ok).toBe(true);
    expect(state.collaborators).toHaveLength(1);
    expect(state.collaborators[0]).toMatchObject({ role: 'admin', status: 'active' });
  });

  it('an admin collaborator (not just the owner) can invite', () => {
    const state = championship({ collaborators: [{ id: 'c1', email: OTHER.email, role: 'admin', status: 'active' }] });
    const result = inviteManager(state, OTHER, { email: 'third@x.com', role: 'viewer' });
    expect(result.ok).toBe(true);
  });
});

describe('changeManagerRole', () => {
  it('rejects when the caller is not the owner', () => {
    const state = championship({ collaborators: [{ id: 'c1', email: OTHER.email, role: 'viewer', status: 'active' }] });
    const result = changeManagerRole(state, OTHER, 'c1', 'admin');
    expect(result.ok).toBe(false);
    expect(state.collaborators[0].role).toBe('viewer');
  });

  it('owner changes a collaborator role', () => {
    const state = championship({ collaborators: [{ id: 'c1', email: OTHER.email, role: 'viewer', status: 'active' }] });
    const result = changeManagerRole(state, OWNER, 'c1', 'admin');
    expect(result.ok).toBe(true);
    expect(state.collaborators[0].role).toBe('admin');
  });

  it('no-ops for an unknown id', () => {
    const state = championship();
    const result = changeManagerRole(state, OWNER, 'ghost', 'admin');
    expect(result.ok).toBe(false);
  });
});

describe('removeManager', () => {
  it('rejects when the caller is not the owner', () => {
    const state = championship({ collaborators: [{ id: 'c1', email: OTHER.email, role: 'viewer', status: 'active' }] });
    const result = removeManager(state, OTHER, 'c1');
    expect(result.ok).toBe(false);
    expect(state.collaborators).toHaveLength(1);
  });

  it('owner removes a collaborator', () => {
    const state = championship({ collaborators: [{ id: 'c1', email: OTHER.email, role: 'viewer', status: 'active' }] });
    const result = removeManager(state, OWNER, 'c1');
    expect(result.ok).toBe(true);
    expect(state.collaborators).toHaveLength(0);
  });

  it('no-ops for an unknown id with a reason', () => {
    const state = championship();
    const result = removeManager(state, OWNER, 'ghost');
    expect(result).toEqual({ ok: false, reason: 'Colaborador não encontrado.' });
  });
});



