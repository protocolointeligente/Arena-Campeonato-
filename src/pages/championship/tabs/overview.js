import { esc } from '../../../app/utils.ts';

export function renderOverview(store) {
  const state = store.getState();
  const matches = state.matches || [];
  const finished = matches.filter((m) => m.hg != null && m.ag != null).length;
  return `
    <div class="grid">
      <div class="card"><small>PROGRESSO</small><h2>${finished}/${matches.length || 0}</h2><p class="muted">jogos encerrados</p></div>
      <div class="card"><small>EQUIPES</small><h2>${(state.teams || []).length}</h2><p class="muted">participantes cadastrados</p></div>
      <div class="card"><small>STATUS</small><h2>${esc(state.status || 'Rascunho')}</h2><p class="muted">situação do campeonato</p></div>
    </div>
    <div class="card" style="margin-top:16px">
      <h2>Próximos passos</h2>
      <p class="muted">Cadastre equipes, organize os jogos e lance os placares. A tabela será recalculada automaticamente.</p>
      <div class="actions">
        <button class="btn primary" data-jump="equipes">Cadastrar equipes</button>
        <button class="btn" data-jump="jogos">Ver jogos</button>
      </div>
    </div>
  `;
}

