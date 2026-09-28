import { subscribeChampionship } from '../services/championships.js';
import { scoreboardPayload, formatClock } from '../app/scoreboard.js';
import { esc } from '../app/utils.ts';
import { navigate } from '../app/router-v2.js';

// ── Dígito de 7 segmentos em SVG ─────────────────────────────────────────────
// Desenha sempre os 7 segmentos: os apagados ficam visíveis bem fracos ("8 fantasma"), como
// num painel de estádio real. É isso que separa visualmente "1 0" de "10".
const T = 9; // espessura do segmento (viewBox 60×100)
const hSeg = (y, x1 = 11, x2 = 49) => `${x1},${y} ${x1 + T / 2},${y - T / 2} ${x2 - T / 2},${y - T / 2} ${x2},${y} ${x2 - T / 2},${y + T / 2} ${x1 + T / 2},${y + T / 2}`;
const vSeg = (x, y1, y2) => `${x},${y1} ${x + T / 2},${y1 + T / 2} ${x + T / 2},${y2 - T / 2} ${x},${y2} ${x - T / 2},${y2 - T / 2} ${x - T / 2},${y1 + T / 2}`;
const SEGMENTS = {
  a: hSeg(6), g: hSeg(50), d: hSeg(94),
  f: vSeg(6, 10, 46), b: vSeg(54, 10, 46),
  e: vSeg(6, 54, 90), c: vSeg(54, 54, 90),
};
const DIGIT_SEGMENTS = {
  0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc',
  5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
};

export function segmentDigit(char) {
  const lit = DIGIT_SEGMENTS[char] || '';
  const polys = Object.entries(SEGMENTS)
    .map(([name, points]) => `<polygon points="${points}" class="${lit.includes(name) ? 'on' : 'off'}"/>`)
    .join('');
  return `<svg class="seg-digit" viewBox="-2 -2 64 104" aria-hidden="true"><g>${polys}</g></svg>`;
}

// Placar com largura fixa: 1 gol vira [apagado][1], nunca "1" solto encostado no placar do lado.
export function segmentNumber(value, minDigits = 2) {
  const text = value == null ? '' : String(Math.max(0, Math.trunc(value)));
  const width = Math.max(minDigits, text.length);
  return Array.from({ length: width }, (_, i) => segmentDigit(text[i - (width - text.length)] ?? '')).join('');
}

function segmentClock(text) {
  return [...text].map((ch) => (ch === ':' ? '<span class="seg-colon" aria-hidden="true"><i></i><i></i></span>' : segmentDigit(ch))).join('');
}

function sideStats(payload, side) {
  const count = (n, one, many) => `<span><b>${n}</b> ${n === 1 ? one : many}</span>`;
  if (payload.mode === 'goals') {
    return count(payload.fouls[side], 'falta', 'faltas') + count(payload.timeouts[side], 'tempo', 'tempos');
  }
  if (payload.mode === 'combat') {
    return count(payload.penalties[side], 'penalidade', 'penalidades');
  }
  if (payload.mode === 'sets') {
    return payload.server === side ? '<span class="sb-serve">● Saque</span>' : '<span class="sb-serve-off">Saque</span>';
  }
  return '';
}

export function scoreboardFrameHTML(payload, championshipName, { bump = {} } = {}) {
  if (!payload) {
    return `<div class="scoreboard-display"><p class="sb-message">Partida não encontrada.</p></div>`;
  }
  const unit = payload.mode === 'sets' ? 'Set' : 'Período';
  const periodLabel = `${payload.clock.period}º ${unit.toLowerCase()}${payload.leg ? ` · jogo ${payload.leg}` : ''}`;
  const digits = payload.mode === 'points' ? 3 : 2;
  const score = (value) => `<div class="sb-digits">${segmentNumber(value ?? 0, digits)}</div>`;
  const sr = (value) => `<span class="sr-only">${value ?? 0}</span>`;
  const side = (key, name, value, tag) => `
    <section class="sb-side sb-${key}${bump[key] ? ' sb-bump' : ''}" aria-label="${esc(name)}: ${value ?? 0}">
      <h2 class="sb-team" title="${esc(name)}">${esc(name)}</h2>
      <div class="sb-window">${score(value)}${sr(value)}</div>
      <div class="sb-tag">${tag}</div>
      <div class="sb-stats">${sideStats(payload, key)}</div>
    </section>`;
  return `
    <div class="scoreboard-display">
      <button class="btn fullscreen-btn" data-scoreboard-fullscreen type="button" aria-label="Tela cheia">⛶ Tela cheia</button>
      <div class="sb-board" role="region" aria-label="Placar ao vivo">
        <div class="sb-lamps" aria-hidden="true"><span></span><span></span></div>
        <header class="sb-title">${esc(championshipName || 'Placar')}</header>
        <div class="sb-main">
          ${side('home', payload.homeName, payload.hg, 'Casa')}
          <div class="sb-center">
            <div class="sb-clock-label">Tempo</div>
            <div class="sb-clock${payload.clock.running ? ' running' : ''}" aria-label="Tempo ${formatClock(payload.clock.elapsedMs)}">${segmentClock(formatClock(payload.clock.elapsedMs))}</div>
            <div class="sb-period">${periodLabel}${payload.clock.running ? '' : ' · <span class="sb-paused">pausado</span>'}</div>
          </div>
          ${side('away', payload.awayName, payload.ag, 'Visitante')}
        </div>
      </div>
    </div>
  `;
}

const CHAKRA_HREF = 'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;700&display=swap';
function ensureScoreboardFont() {
  if (document.querySelector(`link[href="${CHAKRA_HREF}"]`)) {return;}
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = CHAKRA_HREF;
  document.head.appendChild(link);
}

export function renderScoreboardDisplay(root, championshipId, matchId, kind = 'match') {
  root.__publicUnsubscribe?.();
  ensureScoreboardFont();
  root.innerHTML = `<div class="scoreboard-display"><p class="sb-message">Carregando placar...</p></div>`;
  let latestState = null;
  let lastHTML = '';
  let lastScore = null;
  const bumpUntil = { home: 0, away: 0 };

  function bindFullscreen() {
    root.querySelector('[data-scoreboard-fullscreen]')?.addEventListener('click', () => {
      if (document.fullscreenElement) {document.exitFullscreen?.();} else {document.documentElement.requestFullscreen?.();}
    });
  }

  function paint() {
    if (!latestState) {return;}
    const payload = scoreboardPayload(latestState, matchId, kind);
    const now = Date.now();
    if (payload && lastScore) {
      if ((payload.hg ?? 0) > (lastScore.hg ?? 0)) {bumpUntil.home = now + 1600;}
      if ((payload.ag ?? 0) > (lastScore.ag ?? 0)) {bumpUntil.away = now + 1600;}
    }
    if (payload) {lastScore = { hg: payload.hg, ag: payload.ag };}
    const html = scoreboardFrameHTML(payload, latestState.nome, { bump: { home: bumpUntil.home > now, away: bumpUntil.away > now } });
    // Só troca o DOM quando algo muda (o relógio muda 1×/s) — evita piscar o botão e o foco.
    if (html === lastHTML) {return;}
    lastHTML = html;
    root.innerHTML = html;
    bindFullscreen();
  }

  const unsubscribe = subscribeChampionship(championshipId, (state) => {
    if (!state) {
      latestState = null;
      lastHTML = '';
      root.innerHTML = `<div class="scoreboard-display"><p class="sb-message">Faça login para ver este placar.</p><button class="btn" data-scoreboard-login type="button">Entrar</button></div>`;
      root.querySelector('[data-scoreboard-login]')?.addEventListener('click', () => navigate('/login'));
      return;
    }
    latestState = state;
    paint();
  });
  const tick = setInterval(paint, 500);
  root.__publicUnsubscribe = () => { unsubscribe(); clearInterval(tick); };
}
