import { roundLabel, tieRow } from '../../../app/bracket-utils.js';
import { icon } from '../../../app/icons.js';

export function renderBracket(store) {
  const state = store.getState();
  
  if (state.formato === 'grupos') {
    if (!(state.grupos || []).length) {return `<div class="card"><p class="muted">Gere os jogos da fase primeiro, na aba "Fases".</p></div>`;}
    if (!state.bracket) {return `<div class="card"><p class="muted" style="margin-bottom:14px">Gere o mata-mata cruzando os classificados de cada grupo.</p><button class="btn primary" data-gen-cross>${icon('bracket', 16)} Gerar mata-mata</button></div>`;}
  } else if (state.formato !== 'mata') {
    return `<div class="card"><p class="muted">Esta fase não usa chaveamento. Troque o formato da fase ativa para "Mata-Mata" na aba Fases.</p></div>`;
  }
  
  if (!state.bracket) {return `<div class="card"><p class="muted">Nenhum chaveamento gerado ainda. Use "Gerar/Refazer" na aba Fases.</p></div>`;}
  
  store.advanceBracket();
  const rounds = state.bracket.rounds;
  
  return `
    <div class="card">
      ${state.formato === 'grupos' ? '<div class="actions" style="justify-content:flex-end;margin-bottom:8px"><button class="btn ghost sm" data-regen-cross>↻ Regerar</button></div>' : ''}
      <h2>Chaveamento</h2>
      <div class="bracket-cols">
        ${rounds.map((round) => `
          <div class="bcol">
            <h3 class="muted">${roundLabel(round.length * 2)}</h3>
            ${round.map((tie) => tieRow(tie, state)).join('')}
          </div>
        `).join('')}
        ${state.bracket.third ? `<div class="bcol"><h3 class="muted">Disputa de 3º lugar</h3>${tieRow(state.bracket.third, state)}</div>` : ''}
      </div>
    </div>
  `;
}

