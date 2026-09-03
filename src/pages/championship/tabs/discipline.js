import { cardRanking, suspensionInfo } from '../../../app/standings.js';
import { teamNameById } from '../../../app/roster.js';
import { esc } from '../../../app/utils.ts';
import { icon, cardChip } from '../../../app/icons.js';

export function renderDiscipline(store) {
  const state = store.getState();
  const lim = (state.cfg && state.cfg.yellowLimit) || 3;
  const rows = cardRanking(state);
  const suspended = [];
  (state.teams || []).forEach((team) => (team.roster || []).forEach((athlete) => {
    const info = suspensionInfo(state, athlete.id);
    if (info.suspended) {suspended.push({ athlete, team, info });}
  }));
  
  const suspHTML = suspended.length ? `
    <div class="card" style="margin-bottom:16px;border-color:var(--accent)">
      <h2 style="display:flex;align-items:center;gap:8px;color:var(--danger)">${icon('ban', 22)} Suspensos para o próximo jogo</h2>
      ${suspended.map((x) => `
        <div class="team-row">
          <span style="color:var(--danger)">${icon('ban')}</span>
          <span><strong>${esc(x.athlete.nome)}</strong> <span class="muted">— ${esc(x.team.nome)}</span></span>
          <span class="muted">${esc(x.info.reason)}</span>
        </div>
      `).join('')}
    </div>
  ` : '';
  
  const table = rows.length ? `
    <div class="card">
      <h2>Cartões</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Atleta</th><th>Equipe</th><th>${cardChip('var(--warning)')}</th><th>${cardChip('var(--danger)')}</th></tr></thead>
          <tbody>
            ${rows.map((r, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${esc(r.name)}</td>
                <td>${r.teamId ? esc(teamNameById(state, r.teamId) || '—') : '—'}</td>
                <td>${r.y || ''}</td>
                <td>${r.r || ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  ` : `<div class="card"><p class="muted">Nenhum cartão registrado.</p></div>`;
  
  return `
    <p class="muted" style="margin:0 0 12px;font-size:13px">Regra de suspensão: cartão vermelho ou ${lim} amarelos = 1 jogo de suspensão.</p>
    ${suspHTML}${table}
  `;
}

