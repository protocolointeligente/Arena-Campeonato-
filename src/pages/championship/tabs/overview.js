import { esc } from '../../../app/utils.ts';

function mostVotedPoll(state) {
  let best = null;
  (state.polls || []).filter((poll) => poll.status === 'published').forEach((poll) => {
    (poll.options || []).forEach((option) => {
      if (!best || (option.votes || 0) > best.votes) {best = { question: poll.question, label: option.label, votes: option.votes || 0 };}
    });
  });
  return best;
}

function engagementCardHTML(state, engagement) {
  if (!engagement) {return '';}
  const sponsors = state.sponsors || [];
  const topSponsor = Object.entries(engagement.sponsorClicks || {}).sort((a, b) => b[1] - a[1])[0];
  const topSponsorName = topSponsor ? sponsors.find((s) => s.id === topSponsor[0])?.name : null;
  const poll = mostVotedPoll(state);
  return `
    <div class="card" style="margin-top:16px">
      <h2>📈 Engajamento do portal público</h2>
      <div class="grid" style="margin-top:12px">
        <div><small>VISUALIZAÇÕES</small><h2>${engagement.views}</h2><p class="muted">acessos ao portal público</p></div>
        <div><small>PATROCINADOR MAIS CLICADO</small><h2>${topSponsorName ? esc(topSponsorName) : '—'}</h2><p class="muted">${topSponsor ? `${topSponsor[1]} clique(s)` : sponsors.length ? 'ainda sem cliques' : 'nenhum patrocinador cadastrado'}</p></div>
        <div><small>ENQUETE MAIS VOTADA</small><h2>${poll ? esc(poll.label) : '—'}</h2><p class="muted">${poll ? `${poll.votes} voto(s) em "${esc(poll.question)}"` : 'nenhuma enquete publicada'}</p></div>
      </div>
    </div>
  `;
}

export function renderOverview(store, ctx = {}) {
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
    ${engagementCardHTML(state, ctx.engagement)}
  `;
}

