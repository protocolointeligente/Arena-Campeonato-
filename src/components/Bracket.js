import { esc } from '../app/utils.ts';

export function Bracket({ rounds = [], thirdPlace = null, teamNames = {}, onScoreChange, onSumula, showPenalties = true, className = '', readOnly = false }) {
  const container = document.createElement('div');
  container.className = `bracket-container ${className}`.trim();
  container.setAttribute('role', 'region');
  container.setAttribute('aria-label', 'Chaveamento do campeonato');
  
  if (!rounds.length) {
    container.innerHTML = '<p class="muted">Nenhum chaveamento gerado.</p>';
    return container;
  }
  
  const cols = document.createElement('div');
  cols.className = 'bracket-cols';
  cols.setAttribute('role', 'list');
  
  rounds.forEach((round, roundIndex) => {
    const col = document.createElement('div');
    col.className = 'bracket-col';
    col.setAttribute('role', 'listitem');
    
    const size = round.length * 2;
    const roundLabel = getRoundLabel(size);
    
    const header = document.createElement('h3');
    header.className = 'bracket-round-title muted';
    header.textContent = roundLabel;
    col.appendChild(header);
    
    const tiesList = document.createElement('div');
    tiesList.className = 'bracket-ties';
    
    round.forEach((tie, tieIndex) => {
      const tieEl = createTieElement(tie, teamNames, {
        onScoreChange: (field, value) => onScoreChange?.(tie.id, field, value),
        onSumula: () => onSumula?.('tie', tie.id),
        showPenalties,
        readOnly,
      });
      tiesList.appendChild(tieEl);
    });
    
    col.appendChild(tiesList);
    cols.appendChild(col);
  });
  
  if (thirdPlace) {
    const col = document.createElement('div');
    col.className = 'bracket-col';
    col.setAttribute('role', 'listitem');
    
    const header = document.createElement('h3');
    header.className = 'bracket-round-title muted';
    header.textContent = 'Disputa de 3º lugar';
    col.appendChild(header);
    
    const tiesList = document.createElement('div');
    tiesList.className = 'bracket-ties';
    
    const tieEl = createTieElement(thirdPlace, teamNames, {
      onScoreChange: (field, value) => onScoreChange?.(thirdPlace.id, field, value),
      onSumula: () => onSumula?.('tie', thirdPlace.id),
      showPenalties,
      readOnly,
    });
    tiesList.appendChild(tieEl);
    
    col.appendChild(tiesList);
    cols.appendChild(col);
  }
  
  container.appendChild(cols);
  return container;
}

function createTieElement(tie, teamNames, { onScoreChange, onSumula, showPenalties, readOnly }) {
  const homeName = tie.a ? esc(teamNames[tie.a] || tie.a) : 'A definir';
  const awayName = tie.b ? esc(teamNames[tie.b] || tie.b) : 'A definir';
  const canScore = tie.a && tie.b;
  const isDecided = tie.winner != null;
  const single = !tie.ag2 && !tie.bg2 && !tie.apen && !tie.bpen;
  
  const tieEl = document.createElement('div');
  tieEl.className = `bracket-tie ${isDecided ? 'decided' : ''} ${!canScore ? 'pending' : ''}`;
  tieEl.dataset.tieId = tie.id;
  
  let html = `<div class="bracket-match-teams">`;
  html += `<span class="team team-home ${tie.winner === tie.a ? 'winner' : ''}">${homeName}</span>`;
  html += `<span class="team team-away ${tie.winner === tie.b ? 'winner' : ''}">${awayName}</span>`;
  html += `</div>`;
  
  if (canScore && !readOnly) {
    html += `<div class="bracket-scores">`;
    
    // 1st leg
    html += `<div class="score-row">`;
    html += `<input type="number" min="0" class="score-input" data-field="ag1" value="${tie.ag1 ?? ''}" placeholder="—" ${readOnly ? 'disabled' : ''} aria-label="Placar 1ª perna - ${homeName}">`;
    html += `<span class="score-separator">×</span>`;
    html += `<input type="number" min="0" class="score-input" data-field="bg1" value="${tie.bg1 ?? ''}" placeholder="—" ${readOnly ? 'disabled' : ''} aria-label="Placar 1ª perna - ${awayName}">`;
    html += `</div>`;
    
    // 2nd leg (if not single)
    if (!single) {
      html += `<div class="score-row">`;
      html += `<input type="number" min="0" class="score-input" data-field="ag2" value="${tie.ag2 ?? ''}" placeholder="—" ${readOnly ? 'disabled' : ''} aria-label="Placar 2ª perna - ${homeName}">`;
      html += `<span class="score-separator">×</span>`;
      html += `<input type="number" min="0" class="score-input" data-field="bg2" value="${tie.bg2 ?? ''}" placeholder="—" ${readOnly ? 'disabled' : ''} aria-label="Placar 2ª perna - ${awayName}">`;
      html += `</div>`;
    }
    
    // Penalties
    if (showPenalties && tie.ag1 != null && tie.bg1 != null && (single || (tie.ag2 != null && tie.bg2 != null))) {
      html += `<div class="score-row penalties">`;
      html += `<input type="number" min="0" class="score-input" data-field="apen" value="${tie.apen ?? ''}" placeholder="Pên" ${readOnly ? 'disabled' : ''} aria-label="Pênaltis - ${homeName}">`;
      html += `<span class="score-separator">pên</span>`;
      html += `<input type="number" min="0" class="score-input" data-field="bpen" value="${tie.bpen ?? ''}" placeholder="Pên" ${readOnly ? 'disabled' : ''} aria-label="Pênaltis - ${awayName}">`;
      html += `</div>`;
    }
    
    html += `</div>`;
  } else if (canScore && readOnly) {
    // Display scores read-only
    const score1 = tie.ag1 != null && tie.bg1 != null ? `${tie.ag1} × ${tie.bg1}` : '— × —';
    const score2 = !single && tie.ag2 != null && tie.bg2 != null ? `${tie.ag2} × ${tie.bg2}` : '';
    const pens = showPenalties && tie.apen != null && tie.bpen != null ? ` (pên ${tie.apen}×${tie.bpen})` : '';
    
    html += `<div class="bracket-score-display">${score1}${score2 ? ` / ${  score2}` : ''}${pens}</div>`;
  }
  
  // Winner indicator
  if (isDecided) {
    const winnerName = tie.winner ? esc(teamNames[tie.winner] || tie.winner) : '—';
    html += `<div class="bracket-winner" aria-label="Vencedor: ${winnerName}">✓ ${winnerName}</div>`;
  }
  
  // Súmula button
  if (onSumula && canScore) {
    html += `<button type="button" class="btn btn-ghost btn-sm bracket-sumula" data-sumula="${tie.id}" aria-label="Abrir súmula">📋</button>`;
  }
  
  tieEl.innerHTML = html;
  
  if (onScoreChange) {
    tieEl.querySelectorAll('.score-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const value = e.target.value === '' ? null : parseInt(e.target.value, 10);
        onScoreChange(e.target.dataset.field, value);
      });
    });
  }
  
  if (onSumula) {
    tieEl.querySelector('[data-sumula]')?.addEventListener('click', onSumula);
  }
  
  return tieEl;
}

function getRoundLabel(size) {
  const labels = { 2: 'Final', 4: 'Semifinal', 8: 'Quartas de final', 16: 'Oitavas de final', 32: '16-avos' };
  return labels[size] || `${size}-avos`;
}

export function BracketMatch({ home, away, score, winner, onScoreChange, onSumula, className = '' }) {
  const el = document.createElement('div');
  el.className = `bracket-match ${className}`.trim();
  
  el.innerHTML = `
    <div class="match-teams">
      <span class="team home ${winner === home.id ? 'winner' : ''}">${esc(home.name)}</span>
      <span class="team away ${winner === away.id ? 'winner' : ''}">${esc(away.name)}</span>
    </div>
    <div class="match-score">
      ${score ? `<span>${esc(score.home)} × ${esc(score.away)}</span>` : '<span class="muted">— × —</span>'}
      ${onSumula ? `<button type="button" class="btn btn-ghost btn-sm" aria-label="Súmula">📋</button>` : ''}
    </div>
  `;
  
  return el;
}

