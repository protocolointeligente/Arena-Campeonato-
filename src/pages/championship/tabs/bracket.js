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
  
  // Fase alimentada por classificação (participantTeamIds): a ordem já cruza os grupos
  // (1A×2B…), então gera sem sortear; senão, sorteia entre as equipes inscritas.
  const category = (state.categories || []).find((c) => c.id === state.activeCategoryId);
  const phase = (category?.phases || []).find((p) => p.id === category.activePhaseId);
  const seeded = (phase?.participantTeamIds || []).length > 0;
  if (!state.bracket) {
    return seeded
      ? `<div class="card"><p class="muted" style="margin-bottom:14px">Os classificados da fase anterior já estão definidos. Gere o chaveamento com os cruzamentos.</p><button class="btn primary" data-generate-phase>${icon('bracket', 16)} Gerar chaveamento</button></div>`
      : `<div class="card"><p class="muted" style="margin-bottom:14px">Nenhum chaveamento gerado ainda. Sorteie os confrontos entre as equipes inscritas.</p><button class="btn primary" data-generate-phase data-shuffle>${icon('shuffle', 16)} Sortear e gerar chaveamento</button></div>`;
  }

  // Não chamar store.advanceBracket() aqui: ele dispara notify() -> re-render -> loop infinito.
  // setTieScore() já avança o chaveamento a cada placar.
  const rounds = state.bracket.rounds;

  return `
    <div class="card">
      <div class="actions" style="justify-content:flex-end;margin-bottom:8px">
        ${state.formato === 'grupos' ? '<button class="btn ghost sm" data-regen-cross>↻ Regerar</button>' : (seeded ? `<button class="btn ghost sm" data-generate-phase data-confirm-regen>${icon('bracket', 16)} Refazer chaveamento</button>` : `<button class="btn ghost sm" data-generate-phase data-shuffle data-confirm-regen>${icon('shuffle', 16)} Refazer sorteio</button>`)}
      </div>
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

