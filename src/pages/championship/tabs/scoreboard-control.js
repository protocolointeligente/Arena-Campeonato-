import { scoreboardPayload, formatClock } from '../../../app/scoreboard.js';
import { esc } from '../../../app/utils.ts';

export function renderScoreboardControl(store, ctx) {
  const target = ctx.placarTarget;
  if (!target) {
    return `<div class="card"><p class="muted">Selecione uma partida nas abas "Jogos" ou "Chaveamento" e clique em "🖥️ Placar" para operar o placar eletrônico.</p></div>`;
  }
  const payload = scoreboardPayload(store.getState(), target.id, target.kind);
  if (!payload) {
    return `<div class="card"><p class="muted">Partida não encontrada.</p></div>`;
  }
  const ref = (...parts) => [target.kind, esc(target.id), ...parts].join(':');
  const counterRow = (label, key, attr) => `
    <div class="scoreboard-counter">
      <span class="muted">${label}</span>
      <div class="row"><span>${esc(payload.homeName)}</span><button class="btn ghost sm" data-${attr}="${ref('home', '-1')}">-</button><strong>${payload[key].home}</strong><button class="btn ghost sm" data-${attr}="${ref('home', '1')}">+</button></div>
      <div class="row"><span>${esc(payload.awayName)}</span><button class="btn ghost sm" data-${attr}="${ref('away', '-1')}">-</button><strong>${payload[key].away}</strong><button class="btn ghost sm" data-${attr}="${ref('away', '1')}">+</button></div>
    </div>`;
  return `
    <div class="card scoreboard-control">
      <div class="actions" style="justify-content:space-between">
        <h2>Placar ao vivo</h2>
        <button class="btn primary" data-scoreboard-open="${ref()}">🖥️ Abrir tela de projeção</button>
      </div>
      <div class="scoreboard-score-row">
        <div>
          <span>${esc(payload.homeName)}</span>
          <div class="row">
            <button class="btn ghost" data-scoreboard-score="${ref(payload.homeField, '-1')}">-</button>
            <strong class="scoreboard-big">${payload.hg ?? 0}</strong>
            <button class="btn ghost" data-scoreboard-score="${ref(payload.homeField, '1')}">+</button>
          </div>
        </div>
        <div>
          <span>${esc(payload.awayName)}</span>
          <div class="row">
            <button class="btn ghost" data-scoreboard-score="${ref(payload.awayField, '-1')}">-</button>
            <strong class="scoreboard-big">${payload.ag ?? 0}</strong>
            <button class="btn ghost" data-scoreboard-score="${ref(payload.awayField, '1')}">+</button>
          </div>
        </div>
      </div>
      <div class="scoreboard-clock-row">
        <strong>${formatClock(payload.clock.elapsedMs)}</strong>
        <button class="btn" data-scoreboard-clock="${ref('toggle')}">${payload.clock.running ? 'Pausar' : 'Iniciar'}</button>
        <button class="btn ghost" data-scoreboard-clock="${ref('reset')}">Zerar</button>
        <span class="muted">${payload.mode === 'sets' ? 'Set' : 'Período'}</span>
        <button class="btn ghost sm" data-scoreboard-period="${ref('-1')}">-</button>
        <strong>${payload.clock.period}</strong>
        <button class="btn ghost sm" data-scoreboard-period="${ref('1')}">+</button>
        ${payload.leg ? '<span class="muted">· 1ª perna</span>' : ''}
      </div>
      ${payload.mode === 'goals' ? `${counterRow('Faltas', 'fouls', 'scoreboard-foul')}${counterRow('Tempos técnicos', 'timeouts', 'scoreboard-timeout')}` : ''}
      ${payload.mode === 'combat' ? counterRow('Penalidades', 'penalties', 'scoreboard-penalty') : ''}
      ${payload.mode === 'sets' ? `<div class="scoreboard-server-row"><span class="muted">Saque</span><button class="btn ghost" data-scoreboard-server="${ref()}">${payload.server === 'home' ? esc(payload.homeName) : payload.server === 'away' ? esc(payload.awayName) : '—'}</button></div>` : ''}
    </div>
  `;
}
