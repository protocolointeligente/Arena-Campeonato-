import { esc } from '../../../app/utils.ts';

export function participantLabels(rosterMode = 'team') {
  if (rosterMode === 'individual') {return { plural: 'Atletas', singular: 'atleta', roster: 'Perfil' };}
  if (rosterMode === 'dupla') {return { plural: 'Duplas', singular: 'dupla', roster: 'Participantes' };}
  return { plural: 'Equipes', singular: 'equipe', roster: 'Elenco' };
}

export function renderTeams(store) {
  const state = store.getState();
  const labels = participantLabels(state.rosterMode);
  return `
    <div class="card">
      <div class="actions" style="justify-content:space-between">
        <div><h2>${labels.plural}</h2><p class="muted">Edite os nomes dos participantes da modalidade.</p></div>
        <button class="btn primary" data-add-team>+ Adicionar ${labels.singular}</button>
      </div>
      <div style="margin-top:18px">
        ${(state.teams || []).map((team, index) => `
          <div class="team-row">
            ${team.logo ? 
              `<img class="miniphoto" data-pick-logo="${esc(team.id)}" src="${team.logo}" style="width:28px;height:28px;border-radius:5px;object-fit:cover;cursor:pointer">` : 
              `<span data-pick-logo="${esc(team.id)}" style="cursor:pointer">${index + 1}</span>`
            }
            <input data-team="${esc(team.id)}" value="${esc(team.nome)}">
            <button class="btn ghost" data-roster="${esc(team.id)}">${labels.roster} (${(team.roster || []).length})</button>
            <button class="btn ghost" data-remove-team="${esc(team.id)}">Remover ${labels.singular}</button>
          </div>
        `).join('') || '<p class="muted">Nenhuma equipe cadastrada.</p>'}
      </div>
      <button class="btn primary" style="margin-top:18px" data-save-teams>Salvar ${labels.plural.toLowerCase()}</button>
    </div>
  `;
}

