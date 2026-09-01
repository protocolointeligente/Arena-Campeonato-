import { subscribeChampionship } from '../services/championships.js';
import { scoreboardPayload, formatClock } from '../app/scoreboard.js';
import { esc } from '../app/utils.ts';
import { navigate } from '../app/router-v2.js';

export function scoreboardFrameHTML(payload, championshipName) {
  if (!payload) {
    return `<div class="scoreboard-display"><p>Partida não encontrada.</p></div>`;
  }
  const periodLabel = payload.mode === 'sets' ? `Set ${payload.clock.period}` : payload.leg ? `${payload.leg}ª perna` : `Período ${payload.clock.period}`;
  const extra = payload.mode === 'goals'
    ? `<div class="meta-row"><span>Faltas ${payload.fouls.home} × ${payload.fouls.away}</span><span>Tempos técnicos ${payload.timeouts.home} × ${payload.timeouts.away}</span></div>`
    : payload.mode === 'combat'
    ? `<div class="meta-row"><span>Penalidades ${payload.penalties.home} × ${payload.penalties.away}</span></div>`
    : payload.mode === 'sets'
    ? `<div class="meta-row"><span>Saque: ${payload.server === 'home' ? esc(payload.homeName) : payload.server === 'away' ? esc(payload.awayName) : '—'}</span></div>`
    : '';
  return `
    <div class="scoreboard-display">
      <button class="btn fullscreen-btn" data-scoreboard-fullscreen type="button">⛶ Tela cheia</button>
      <small>${esc(championshipName || '')} · ${periodLabel}</small>
      <div class="teams">
        <div><div class="team-name">${esc(payload.homeName)}</div><div class="team-score">${payload.hg ?? 0}</div></div>
        <div><div class="team-name">${esc(payload.awayName)}</div><div class="team-score">${payload.ag ?? 0}</div></div>
      </div>
      <div class="clock">${formatClock(payload.clock.elapsedMs)}</div>
      ${extra}
    </div>
  `;
}

export function renderScoreboardDisplay(root, championshipId, matchId, kind = 'match') {
  root.__publicUnsubscribe?.();
  root.innerHTML = `<div class="scoreboard-display"><p>Carregando placar...</p></div>`;
  let latestState = null;

  function bindFullscreen() {
    root.querySelector('[data-scoreboard-fullscreen]')?.addEventListener('click', () => {
      document.documentElement.requestFullscreen?.();
    });
  }

  function paint() {
    if (!latestState) {return;}
    root.innerHTML = scoreboardFrameHTML(scoreboardPayload(latestState, matchId, kind), latestState.nome);
    bindFullscreen();
  }

  const unsubscribe = subscribeChampionship(championshipId, (state) => {
    if (!state) {
      root.innerHTML = `<div class="scoreboard-display"><p>Faça login para ver este placar.</p><button class="btn" data-scoreboard-login type="button">Entrar</button></div>`;
      root.querySelector('[data-scoreboard-login]')?.addEventListener('click', () => navigate('/login'));
      return;
    }
    latestState = state;
    paint();
  });
  const tick = setInterval(paint, 1000);
  root.__publicUnsubscribe = () => { unsubscribe(); clearInterval(tick); };
}
