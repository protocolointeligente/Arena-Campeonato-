import { teamNameById } from './roster.js';
import { esc } from './utils.ts';

export function roundLabel(size) {
  return { 2: 'Final', 4: 'Semifinal', 8: 'Quartas de final', 16: 'Oitavas de final', 32: '16-avos' }[size] || `${size}-avos`;
}

export function tieRow(tie, state) {
  const homeName = tie.a != null ? esc(teamNameById(state, tie.a) || '—') : 'A definir';
  const awayName = tie.b != null ? esc(teamNameById(state, tie.b) || '—') : 'A definir';
  const canScore = tie.a != null && tie.b != null;
  const single = !!state.cfg?.maoUnica;
  const winnerText = tie.winner != null ? ` <span class="muted">· vencedor: ${esc(teamNameById(state, tie.winner) || '—')}</span>` : '';
  const showPen = canScore && tie.ag1 != null && tie.bg1 != null && (single || (tie.ag2 != null && tie.bg2 != null));
  
  return `
    <div class="row" style="flex-wrap:wrap;padding:8px 0;border-bottom:1px solid var(--line)">
      <span style="flex:1">${homeName} <span class="muted">×</span> ${awayName}${winnerText}</span>
      ${canScore ? `
        <input type="number" min="0" data-tie-score="${tie.id}:ag1" value="${tie.ag1 ?? ''}" style="width:50px" title="Placar 1ª perna — ${homeName}">
        <input type="number" min="0" data-tie-score="${tie.id}:bg1" value="${tie.bg1 ?? ''}" style="width:50px" title="Placar 1ª perna — ${awayName}">
        ${!single ? `
          <input type="number" min="0" data-tie-score="${tie.id}:ag2" value="${tie.ag2 ?? ''}" style="width:50px" title="Placar 2ª perna — ${homeName}">
          <input type="number" min="0" data-tie-score="${tie.id}:bg2" value="${tie.bg2 ?? ''}" style="width:50px" title="Placar 2ª perna — ${awayName}">
        ` : ''}
        ${showPen ? `
          <input type="number" min="0" data-tie-score="${tie.id}:apen" value="${tie.apen ?? ''}" style="width:50px" title="Pênaltis — ${homeName}">
          <input type="number" min="0" data-tie-score="${tie.id}:bpen" value="${tie.bpen ?? ''}" style="width:50px" title="Pênaltis — ${awayName}">
        ` : ''}
        <button class="btn ghost sm" data-sumula="tie:${esc(tie.id)}">📋 Súmula</button>
        <button class="btn ghost sm" data-open-scoreboard="tie:${esc(tie.id)}">🖥️ Placar</button>
      ` : ''}
    </div>
  `;
}

