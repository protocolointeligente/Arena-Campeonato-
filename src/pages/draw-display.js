import { subscribeChampionship } from '../services/championships.js';
import { esc } from '../app/utils.ts';

function teamName(state, id) {
  return (state.teams || []).find((team) => team.id === id)?.nome || '—';
}

export function drawFrameHTML(state) {
  const draw = state?.draw;
  if (!draw) {
    return `<div class="draw-display"><p>Nenhum sorteio em andamento.</p></div>`;
  }
  const drawnSoFar = draw.formato === 'grupos' ? draw.groups.flat() : draw.order;
  const lastTeamId = drawnSoFar[drawnSoFar.length - 1];
  const reveal = lastTeamId ? `<div class="draw-reveal">${esc(teamName(state, lastTeamId))}</div>` : '';
  const body = draw.formato === 'grupos'
    ? `<div class="draw-groups">${draw.groups.map((group, gi) => `<div class="draw-group"><h3>Grupo ${String.fromCharCode(65 + gi)}</h3><ol>${group.map((id) => `<li>${esc(teamName(state, id))}</li>`).join('')}</ol></div>`).join('')}</div>`
    : `<ol class="draw-order">${draw.order.map((id) => `<li>${esc(teamName(state, id))}</li>`).join('')}</ol>`;
  return `<div class="draw-display"><small>${esc(state.nome || '')} · Sorteio ao vivo${draw.done ? ' · concluído' : ''}</small>${reveal}${body}</div>`;
}

export function renderDrawDisplay(root, championshipId) {
  root.__publicUnsubscribe?.();
  root.innerHTML = `<div class="draw-display"><p>Carregando...</p></div>`;
  root.__publicUnsubscribe = subscribeChampionship(championshipId, (state) => {
    if (!state) {
      root.innerHTML = `<div class="draw-display"><p>Faça login para ver este sorteio.</p></div>`;
      return;
    }
    root.innerHTML = drawFrameHTML(state);
  });
}
