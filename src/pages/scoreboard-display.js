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

// Faltas/tempos (ou penalidades, ou saque) numa tabela casa | rótulo | visitante sob o relógio.
function centerStats(payload) {
  const row = (home, label, away) => `<div class="sb-stat"><b>${home}</b><span>${label}</span><b>${away}</b></div>`;
  const plural = (a, b, one, many) => (a === 1 && b === 1 ? one : many);
  if (payload.mode === 'goals') {
    return row(payload.fouls.home, plural(payload.fouls.home, payload.fouls.away, 'falta', 'faltas'), payload.fouls.away)
      + row(payload.timeouts.home, plural(payload.timeouts.home, payload.timeouts.away, 'tempo', 'tempos'), payload.timeouts.away);
  }
  if (payload.mode === 'combat') {
    return row(payload.penalties.home, 'penalidades', payload.penalties.away);
  }
  if (payload.mode === 'sets') {
    const dot = (side) => `<i class="sb-serve-dot${payload.server === side ? ' on' : ''}" aria-hidden="true"></i>`;
    const who = payload.server === 'home' ? payload.homeName : payload.server === 'away' ? payload.awayName : 'ninguém';
    return `<div class="sb-stat" aria-label="Saque: ${esc(who)}">${dot('home')}<span>saque</span>${dot('away')}</div>`;
  }
  return '';
}

const BALL = '<svg class="sb-ev-ball" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 7l4 3-1.5 4.5h-5L8 10z"/></svg>';
const CARD = (type) => `<i class="sb-ev-card ${type}" aria-hidden="true"></i>`;

// Súmula do lado: gols agrupados por atleta (João ×2) e cartões, na ordem em que aconteceram.
function sideEvents(payload, side) {
  const rows = [];
  const goals = new Map();
  (payload.events || []).filter((event) => event.side === side).forEach((event) => {
    const who = event.name ? `${event.number ? `${event.number} · ` : ''}${event.name}` : '';
    if (event.type === 'goal') {
      const key = who || '—';
      if (goals.has(key)) {goals.get(key).count++; return;}
      const entry = { kind: 'goal', who: who || 'Gol', count: 1 };
      goals.set(key, entry);
      rows.push(entry);
    } else {
      rows.push({ kind: event.type, who: who || (event.type === 'red' ? 'Cartão vermelho' : 'Cartão amarelo') });
    }
  });
  if (!rows.length) {return '';}
  const MAX = 6;
  const shown = rows.slice(-MAX);
  const hidden = rows.length - shown.length;
  return `<ul class="sb-events">${hidden ? `<li class="sb-ev-more">+${hidden} lance${hidden > 1 ? 's' : ''}</li>` : ''}${shown.map((row) => `<li class="sb-ev-${row.kind}">${row.kind === 'goal' ? BALL : CARD(row.kind)}<span>${esc(row.who)}</span>${row.count > 1 ? `<b>×${row.count}</b>` : ''}</li>`).join('')}</ul>`;
}

function intervalHTML(payload, championshipName) {
  const sponsors = payload.sponsors || [];
  const logos = sponsors.map((sponsor) => `<li class="sb-sponsor">${sponsor.logo ? `<img src="${esc(sponsor.logo)}" alt="${esc(sponsor.name || 'Patrocinador')}" loading="eager">` : `<span>${esc(sponsor.name)}</span>`}</li>`).join('');
  return `
    <div class="scoreboard-display">
      <button class="btn fullscreen-btn" data-scoreboard-fullscreen type="button" aria-label="Tela cheia">⛶ Tela cheia</button>
      <div class="sb-board sb-interval" role="region" aria-label="Intervalo">
        <div class="sb-lamps" aria-hidden="true"><span></span><span></span></div>
        <header class="sb-title">${esc(championshipName || 'Placar')}</header>
        <h1 class="sb-interval-title">Intervalo</h1>
        <div class="sb-interval-score" aria-label="${esc(payload.homeName)} ${payload.hg ?? 0} a ${payload.ag ?? 0} ${esc(payload.awayName)}">
          <span class="sb-interval-team">${esc(payload.homeName)}</span>
          <span class="sb-interval-digits">${segmentNumber(payload.hg ?? 0, 1)}</span>
          <span class="sb-interval-x">×</span>
          <span class="sb-interval-digits">${segmentNumber(payload.ag ?? 0, 1)}</span>
          <span class="sb-interval-team">${esc(payload.awayName)}</span>
        </div>
        ${sponsors.length ? `<div class="sb-sponsors-label">Patrocinadores</div><ul class="sb-sponsors${sponsors.length > 8 ? ' many' : ''}">${logos}</ul>` : ''}
      </div>
    </div>
  `;
}

export function scoreboardFrameHTML(payload, championshipName, { bump = {} } = {}) {
  if (!payload) {
    return `<div class="scoreboard-display"><p class="sb-message">Partida não encontrada.</p></div>`;
  }
  if (payload.screen === 'intervalo') {return intervalHTML(payload, championshipName);}
  const unit = payload.mode === 'sets' ? 'Set' : 'Período';
  const periodLabel = `${payload.clock.period}º ${unit.toLowerCase()}${payload.leg ? ` · jogo ${payload.leg}` : ''}`;
  const digits = payload.mode === 'points' ? 3 : 2;
  const side = (key, name, value, tag) => `
    <section class="sb-side sb-${key}${bump[key] ? ' sb-bump' : ''}" aria-label="${esc(name)}: ${value ?? 0}">
      <div class="sb-head"><div class="sb-tag">${tag}</div><h2 class="sb-team" title="${esc(name)}">${esc(name)}</h2></div>
      <div class="sb-window"><div class="sb-digits">${segmentNumber(value ?? 0, digits)}</div><span class="sr-only">${value ?? 0}</span></div>
      ${sideEvents(payload, key)}
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
            <div class="sb-center-stats">${centerStats(payload)}</div>
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
