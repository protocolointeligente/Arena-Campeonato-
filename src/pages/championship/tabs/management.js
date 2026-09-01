import { COLLAB_ROLES, ensureCollaborators, isOwner, can, roleLabel, inviteManager, removeManager, changeManagerRole } from '../../../app/collaborators.js';
import { auth } from '../../../services/firebase.js';
import { esc } from '../../../app/utils.ts';

export function renderManagement(store, { superadmin }) {
  const state = store.getState();
  ensureCollaborators(state);
  if (!superadmin && !isOwner(state, auth.currentUser) && !can(state, auth.currentUser, 'admin')) {
    return '<div class="card"><p class="muted">Sem permissão para gerenciar acessos.</p></div>';
  }
  
  const editable = isOwner(state, auth.currentUser) || superadmin;
  const rows = state.collaborators.map((c) => editable
    ? `<div class="row" style="padding:10px 0;border-bottom:1px solid var(--line)">
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.email)}</span>
        <select data-mgr-role="${esc(c.id)}">${Object.entries(COLLAB_ROLES).map(([key, meta]) => `<option value="${esc(key)}" ${c.role === key ? 'selected' : ''}>${esc(meta.name)}</option>`).join('')}</select>
        <button class="btn ghost" data-mgr-remove="${esc(c.id)}">Remover</button>
      </div>`
    : `<div class="row" style="padding:10px 0;border-bottom:1px solid var(--line)">
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.email)}</span>
        <span class="muted">${esc(COLLAB_ROLES[c.role]?.name || c.role)}</span>
      </div>`
  ).join('') || '<p class="muted">Nenhum colaborador adicionado.</p>';
  
  return `
    <div class="card">
      <h2>Gerenciamento de acesso</h2>
      <p class="muted">Convide pessoas para ajudar a operar este campeonato com um papel específico.</p>
      <div style="margin-top:18px">${rows}</div>
      ${editable ? `
        <div class="row" style="margin-top:12px;gap:8px">
          <input data-new-mgr-email placeholder="E-mail" type="email" style="flex:1">
          <select data-new-mgr-role>${Object.entries(COLLAB_ROLES).map(([key, meta]) => `<option value="${esc(key)}">${esc(meta.name)}</option>`).join('')}</select>
          <button class="btn primary" data-add-mgr>+ Convidar</button>
        </div>
      ` : ''}
    </div>
  `;
}

