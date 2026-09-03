import { PHASE_FORMATS, progressionSummary } from '../../../app/phases.js';
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
      <div style="margin-top:18px">
        ${phases.map((phase, pi) => {
          const later = phases.filter((_, i) => i > pi);
          const prog = phase.progression || {};
          const participantsCount = (phase.participantTeamIds && phase.participantTeamIds.length) || (state.teams || []).length;
          return `
            <div style="padding:14px 0;border-bottom:1px solid var(--line)">
              <div class="row" style="flex-wrap:wrap">
                <input data-phase-name="${esc(phase.id)}" value="${esc(phase.nome)}" style="flex:1;min-width:180px;font-weight:700">
                <select data-phase-format="${esc(phase.id)}">
                  ${PHASE_FORMATS.map(([key, label]) => `<option value="${key}" ${phase.formato === key ? 'selected' : ''}>${esc(label)}</option>`).join('')}
                </select>
                <input type="number" min="1" max="2" data-phase-turnos="${esc(phase.id)}" value="${phase.cfg?.turnos || 1}" style="width:60px" title="Turnos">
                ${phase.formato === 'grupos' ? `<input type="number" min="1" data-phase-ngrupos="${esc(phase.id)}" value="${phase.cfg?.nGrupos || 2}" style="width:60px" title="Grupos">` : ''}
                ${phase.formato === 'mata' ? `
                  <label class="muted" style="display:flex;align-items:center;gap:4px">
                    <input type="checkbox" style="display:inline;width:auto;margin-top:0" data-phase-mao-unica="${esc(phase.id)}" ${phase.cfg?.maoUnica ? 'checked' : ''}> Mão única
                  </label>
                  <label class="muted" style="display:flex;align-items:center;gap:4px">
                    <input type="checkbox" style="display:inline;width:auto;margin-top:0" data-phase-terceiro="${esc(phase.id)}" ${phase.cfg?.terceiro !== false ? 'checked' : ''}> 3º lugar
                  </label>
                ` : ''}
                <span class="muted">${phase.status === 'andamento' ? 'Em andamento' : 'Planejada'}</span>
                <button class="btn ghost" data-switch-phase="${esc(phase.id)}" ${category.activePhaseId === phase.id ? 'disabled' : ''}>Ativar</button>
                ${phases.length > 1 ? `<button class="btn ghost" data-remove-phase="${esc(phase.id)}">Remover</button>` : ''}
              </div>
              ${phase.progression?.targetPhaseId ? `
                <div class="row" style="margin-top:8px;flex-wrap:wrap">
                  <span class="muted" style="flex:1;min-width:200px">Progressão: ${progressionSummary(category, phase)}</span>
                  <select data-progress-target="${esc(phase.id)}" style="flex:1;min-width:160px">
                    <option value="">Fase de destino</option>
                    ${later.map((p) => `<option value="${esc(p.id)}" ${prog.targetPhaseId === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
                  </select>
                  <select data-progress-mode="${esc(phase.id)}" style="width:140px">
                    <option value="overall" ${prog.mode === 'overall' ? 'selected' : ''}>Geral</option>
                    <option value="perGroup" ${prog.mode === 'perGroup' ? 'selected' : ''}>Por grupo</option>
                  </select>
                  <input type="number" min="1" data-progress-count="${esc(phase.id)}" value="${prog.count || 2}" style="width:60px" title="Classificados">
                  <button class="btn primary" data-apply-progress="${esc(phase.id)}">Avançar agora</button>
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

