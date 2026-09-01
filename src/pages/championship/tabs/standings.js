import { computeStandings, CRIT_LABEL } from '../../../app/standings.js';
import { esc } from '../../../app/utils.ts';

export function renderStandings(store) {
  const state = store.getState();
  
  if (state.formato === 'mata') {
    return `<div class="card"><p class="muted">Esta fase usa chaveamento. Veja e registre os placares na aba "Chaveamento".</p></div>`;
  }
  
  const criteriaLine = `<p class="muted" style="margin:0 0 12px;font-size:13px">Desempate: ${(state.cfg?.criterios || ['P', 'V', 'SG', 'GP']).map((c) => CRIT_LABEL[c] || c).join(' › ')}${state.cfg?.confrontoDireto !== false && !(state.cfg?.criterios || []).includes('CD') ? ' › Confronto direto' : ''}</p>`;
  
  if (state.formato === 'grupos') {
    if (!(state.grupos || []).length) {return `<div class="card"><p class="muted">Nenhum grupo gerado ainda.</p></div>`;}
    return state.grupos.map((group, gi) => {
      const idxs = group.map((id) => state.teams.findIndex((t) => t.id === id)).filter((i) => i >= 0);
      const st = computeStandings(state.teams, idxs, (state.matches || []).filter((m) => m.grupo === gi), state.cfg || {});
      return `<div class="card" style="margin-top:${gi ? '16px' : '0'}"><h2>Grupo ${String.fromCharCode(65 + gi)}</h2>${standingsTableHTML(st, state.cfg?.classificam || 2, state)}</div>`;
    }).join('');
  }
  
  if (state.formato === 'gxg') {
    const A = (state.grupos?.[0] || []).map((id) => state.teams.findIndex((t) => t.id === id)).filter((i) => i >= 0);
    const B = (state.grupos?.[1] || []).map((id) => state.teams.findIndex((t) => t.id === id)).filter((i) => i >= 0);
    const stA = computeStandings(state.teams, A, state.matches || [], state.cfg || {});
    const stB = computeStandings(state.teams, B, state.matches || [], state.cfg || {});
    return `<div class="card"><h2>Grupo A</h2>${standingsTableHTML(stA, 0, state)}</div><div class="card" style="margin-top:16px"><h2>Grupo B</h2>${standingsTableHTML(stB, 0, state)}</div>`;
  }
  
  const st = computeStandings(state.teams || [], (state.teams || []).map((_, i) => i), state.matches || [], state.cfg || {});
  return `<div class="card"><h2>Tabela de classificação</h2>${criteriaLine}${standingsTableHTML(st, 0, state)}</div>`;
}

function standingsTableHTML(st, highlight, state) {
  const showDisc = !!(state.cfg && state.cfg.criterios && state.cfg.criterios.includes('DISC'));
  const showSets = state.scoreType === 'sets';
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th><th>Equipe</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th>${showSets ? '<th>SP</th><th>SC</th><th>SS</th>' : '<th>GP</th><th>GC</th><th>SG</th>'}<th>%</th>
            ${showDisc ? '<th>DISC</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${st.map((s, i) => `
            <tr${highlight && i < highlight ? ' style="background:var(--surface-muted)"' : ''}>
              <td>${i + 1}</td>
              <td><strong>${esc(state.teams[s.team].nome)}</strong></td>
              <td>${s.P}</td><td>${s.J}</td><td>${s.V}</td><td>${s.E}</td><td>${s.D}</td>
              ${showSets ? `<td>${s.GP}</td><td>${s.GC}</td><td>${s.SG > 0 ? '+' : ''}${s.SG}</td>` : `<td>${s.GP}</td><td>${s.GC}</td><td>${s.SG > 0 ? '+' : ''}${s.SG}</td>`}
              <td>${s.pct.toFixed(1)}</td>
              ${showDisc ? `<td>${s.DISC}</td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

