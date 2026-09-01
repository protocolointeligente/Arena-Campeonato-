import { scorerRanking } from '../../../app/standings.js';
import { teamNameById } from '../../../app/roster.js';
import { esc } from '../../../app/utils.ts';

export function renderScorers(store) {
  const state = store.getState();
  const rows = scorerRanking(state);
  if (!rows.length) {return `<div class="card"><p class="muted">Nenhum gol registrado ainda.</p></div>`;}
  return `
    <div class="card">
      <h2>Artilharia</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Atleta</th><th>Equipe</th><th>Gols</th></tr></thead>
          <tbody>
            ${rows.map((r, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${esc(r.name)}</td>
                <td>${r.teamId ? esc(teamNameById(state, r.teamId) || '—') : '—'}</td>
                <td>${r.goals}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

