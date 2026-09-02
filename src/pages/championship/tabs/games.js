import { metaLine, matchMeta, scheduleConflicts } from '../../../app/matches.js';
import { esc } from '../../../app/utils.ts';

export function renderGames(store) {
  const state = store.getState();
  const scoreLabel = state.scoreType === 'sets' ? 'sets' : state.scoreType === 'points' ? 'pontos' : 'gols';
  const scoreLimit = state.scoreType === 'points' ? 999 : 99;
  const conflicts = scheduleConflicts(state);
  
  if (state.formato === 'mata') {
    return `<div class="card"><p class="muted">Esta fase usa chaveamento. Veja e registre os placares na aba "Chaveamento".</p></div>`;
  }
  
  return `
    <div class="card">
      <div class="actions" style="justify-content:space-between">
        <div><h2>Jogos</h2><p class="muted">Registre os placares em ${scoreLabel}.</p></div>
        <button class="btn" data-generate>Gerar tabela</button>
      </div>
      <div style="margin-top:18px">
        ${conflicts.length ? `<div class="notice warning" role="alert"><strong>Atenção:</strong> ${conflicts.length} conflito(s) de agenda detectado(s). Verifique equipes, local, árbitro ou mesário nas partidas com o mesmo horário.</div>` : ''}
        ${(state.matches || []).map((match) => {
          const home = state.teams?.[match.home]?.nome || 'A definir';
          const away = state.teams?.[match.away]?.nome || 'A definir';
          const line = metaLine(state, match);
          const meta = matchMeta(match);
          const status = meta.status;
          const statusText = status === 'live' ? 'AO VIVO' : status === 'postponed' ? 'Adiada' : status === 'cancelled' ? 'Cancelada' : '';
          return `
            <div class="game-row">
              <strong>${esc(home)}</strong>
              <input type="number" min="0" max="${scoreLimit}" aria-label="${esc(home)} ${scoreLabel}" data-score="${match.id}:hg" value="${match.hg ?? ''}">
              <span>×</span>
              <input type="number" min="0" max="${scoreLimit}" aria-label="${esc(away)} ${scoreLabel}" data-score="${match.id}:ag" value="${match.ag ?? ''}">
              <strong>${esc(away)}</strong>
            </div>
            <div class="row" style="flex-wrap:wrap;padding:2px 0 12px">
              <span class="muted" style="flex:1">${statusText ? `<strong>${statusText}</strong> · ` : ''}${esc(line)}</span>
              <button class="btn ghost sm" data-match-ops="${esc(match.id)}">Dados da partida</button>
              <button class="btn ghost sm" data-sumula="match:${esc(match.id)}">📋 Súmula</button>
              <button class="btn ghost sm" data-open-scoreboard="match:${esc(match.id)}">🖥️ Placar</button>
              ${match.hg != null && match.ag != null ? `<button class="btn ghost sm" data-result-card="match:${esc(match.id)}">🖼️ Card do resultado</button>` : ''}
            </div>
          `;
        }).join('') || '<p class="muted">Nenhum jogo gerado ainda.</p>'}
      </div>
    </div>
  `;
}

