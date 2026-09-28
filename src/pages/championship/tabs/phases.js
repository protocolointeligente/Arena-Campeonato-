import { PHASE_FORMATS, KNOCKOUT_PRESETS, progressionSummary } from '../../../app/phases.js';
import { esc } from '../../../app/utils.ts';
import { icon } from '../../../app/icons.js';

function teamName(state, id) {
  return (state.teams || []).find((team) => team.id === id)?.nome || '—';
}

function drawProgressHTML(state) {
  const draw = state.draw;
  if (draw.formato === 'grupos') {
    return `<div class="row" style="flex-wrap:wrap;gap:16px">${draw.groups.map((group, gi) => `<div style="flex:1;min-width:160px"><strong>Grupo ${String.fromCharCode(65 + gi)}</strong><ul class="public-list">${group.map((id) => `<li>${esc(teamName(state, id))}</li>`).join('') || '<li class="muted">—</li>'}</ul></div>`).join('')}</div>`;
  }
  return `<ol class="public-list">${draw.order.map((id) => `<li>${esc(teamName(state, id))}</li>`).join('') || '<li class="muted">—</li>'}</ol>`;
}

function drawCardHTML(state) {
  if (state.formato !== 'grupos' && state.formato !== 'mata') {return '';}
  const draw = state.draw;
  return `
    <div class="card" style="margin-top:16px">
      <h2 style="display:flex;align-items:center;gap:8px">${icon('shuffle', 22)} Sorteio ao vivo</h2>
      <p class="muted">Sorteia a distribuição das equipes ao vivo, com tela de projeção pro telão.</p>
      ${!draw ? `
        <button class="btn primary" data-start-draw>Iniciar sorteio</button>
      ` : `
        <div class="row" style="justify-content:space-between;flex-wrap:wrap;margin-top:8px">
          <span class="muted">${draw.pool.length} equipe(s) restante(s)</span>
          <div class="row" style="gap:8px">
            <button class="btn ghost" data-open-draw>${icon('monitor', 16)} Abrir tela de projeção</button>
            <button class="btn ghost" data-cancel-draw>Cancelar</button>
          </div>
        </div>
        ${!draw.done ? `<button class="btn primary" style="margin-top:10px" data-reveal-draw>${icon('shuffle', 16)} Revelar próxima equipe</button>` : `<button class="btn primary" style="margin-top:10px" data-apply-draw>${icon('checkCircle', 16)} Aplicar e gerar fase</button>`}
        <div style="margin-top:14px">${drawProgressHTML(state)}</div>
      `}
    </div>
  `;
}

export function renderPhases(store) {
  const state = store.getState();
  const category = state.categories?.find(c => c.id === state.activeCategoryId);
  const phases = category?.phases || [];

  return `
    <div class="card">
      <div class="actions" style="justify-content:space-between">
        <div><h2>Fases</h2><p class="muted">Configure o formato da disputa e a passagem automática dos classificados para a próxima fase.</p></div>
        <button class="btn primary" data-add-phase>+ Nova fase</button>
      </div>
      <div class="row" style="flex-wrap:wrap;gap:8px;margin-top:14px;align-items:center">
        <span class="muted" style="font-size:13px">Adicionar mata-mata a partir de:</span>
        ${KNOCKOUT_PRESETS.map(([size, label]) => `<button class="btn ghost sm" data-add-knockout="${size}" title="${size} equipes — classificados da fase anterior">${icon('bracket', 14)} ${label} (${size})</button>`).join('')}
      </div>
      <p class="muted" style="font-size:12px;margin-top:6px">Os classificados da fase anterior entram automaticamente (por grupo quando possível, cruzando 1º × 2º de grupos diferentes). As rodadas seguintes até a final ficam no mesmo chaveamento. Também funciona digitando o nome da fase (ex.: "Quartas", "Semifinal").</p>
      <div style="margin-top:18px">
        ${phases.map((phase, pi) => {
          const later = phases.filter((_, i) => i > pi);
          const prog = phase.progression || {};
          const _participantsCount = (phase.participantTeamIds && phase.participantTeamIds.length) || (state.teams || []).length;
          return `
            <div style="padding:14px 0;border-bottom:1px solid var(--line)">
              <div class="row" style="flex-wrap:wrap;align-items:flex-end">
                <label class="phase-field" style="flex:1;min-width:180px">Nome da fase
                  <input data-phase-name="${esc(phase.id)}" value="${esc(phase.nome)}" style="font-weight:700">
                </label>
                <label class="phase-field">Formato da disputa
                  <select data-phase-format="${esc(phase.id)}">
                    ${PHASE_FORMATS.map(([key, label]) => `<option value="${key}" ${phase.formato === key ? 'selected' : ''}>${esc(label)}</option>`).join('')}
                  </select>
                </label>
                <label class="phase-field" title="1 = só ida · 2 = ida e volta">Turnos (1 ida · 2 ida e volta)
                  <input type="number" min="1" max="2" data-phase-turnos="${esc(phase.id)}" value="${phase.cfg?.turnos || 1}">
                </label>
                ${phase.formato === 'grupos' ? `<label class="phase-field" title="Em quantos grupos as equipes serão divididas">Quantidade de grupos
                  <input type="number" min="1" data-phase-ngrupos="${esc(phase.id)}" value="${phase.cfg?.nGrupos || 2}">
                </label>` : ''}
                ${phase.formato === 'mata' ? `
                  <label class="muted" style="display:flex;align-items:center;gap:4px">
                    <input type="checkbox" style="display:inline;width:auto;margin-top:0" data-phase-mao-unica="${esc(phase.id)}" ${phase.cfg?.maoUnica ? 'checked' : ''}> Mão única
                  </label>
                  <label class="muted" style="display:flex;align-items:center;gap:4px">
                    <input type="checkbox" style="display:inline;width:auto;margin-top:0" data-phase-terceiro="${esc(phase.id)}" ${phase.cfg?.terceiro !== false ? 'checked' : ''}> 3º lugar
                  </label>
                ` : ''}
                <span class="muted">${phase.status === 'andamento' ? 'Em andamento' : 'Planejada'}</span>
                ${category.activePhaseId === phase.id ? (phase.formato === 'mata'
                  ? ((phase.participantTeamIds || []).length
                    ? `<button class="btn primary" data-generate-phase ${state.bracket ? 'data-confirm-regen' : ''}>${icon('bracket', 16)} ${state.bracket ? 'Refazer chaveamento' : 'Gerar chaveamento'}</button>`
                    : `<button class="btn primary" data-generate-phase data-shuffle ${state.bracket ? 'data-confirm-regen' : ''}>${icon('shuffle', 16)} ${state.bracket ? 'Refazer sorteio' : 'Sortear chaveamento'}</button>`)
                  : `<button class="btn primary" data-generate-phase ${(state.matches || []).length ? 'data-confirm-regen' : ''}>${(state.matches || []).length ? 'Refazer tabela' : 'Gerar tabela'}</button>`) : ''}
                <button class="btn ghost" data-switch-phase="${esc(phase.id)}" ${category.activePhaseId === phase.id ? 'disabled' : ''}>Ativar</button>
                ${phases.length > 1 ? `<button class="btn ghost" data-remove-phase="${esc(phase.id)}">Remover</button>` : ''}
              </div>
              ${later.length ? `
                <div class="row" style="margin-top:10px;flex-wrap:wrap;align-items:flex-end">
                  <span class="muted" style="flex:1 1 100%;font-size:13px">${prog.targetPhaseId ? `Progressão: ${esc(progressionSummary(category, phase))}` : 'Progressão não configurada — escolha para qual fase os classificados avançam.'}</span>
                  <label class="phase-field" style="flex:1;min-width:160px">Classificados vão para
                    <select data-progress-target="${esc(phase.id)}">
                      <option value="">Nenhuma</option>
                      ${later.map((p) => `<option value="${esc(p.id)}" ${prog.targetPhaseId === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
                    </select>
                  </label>
                  ${phase.formato === 'grupos' ? `<label class="phase-field" style="width:150px">Classificação
                    <select data-progress-mode="${esc(phase.id)}">
                      <option value="overall" ${prog.mode !== 'perGroup' ? 'selected' : ''}>Geral</option>
                      <option value="perGroup" ${prog.mode === 'perGroup' ? 'selected' : ''}>Por grupo</option>
                    </select>
                  </label>` : ''}
                  ${phase.formato !== 'mata' ? `<label class="phase-field" style="width:150px">${prog.mode === 'perGroup' && phase.formato === 'grupos' ? 'Classificados por grupo' : 'Nº de classificados'}
                    <input type="number" min="1" data-progress-count="${esc(phase.id)}" value="${prog.count || 2}">
                  </label>` : ''}
                  ${prog.targetPhaseId ? `<button class="btn primary" data-apply-progress="${esc(phase.id)}">Avançar agora</button>` : ''}
                </div>
              ` : ''}
            </div>
          `;
        }).join('') || '<p class="muted">Nenhuma fase configurada.</p>'}
      </div>
    </div>
    ${drawCardHTML(state)}
  `;
}

