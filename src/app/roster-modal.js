import { esc } from './utils.ts';
import { STAFF_ROLES } from './ops.js';
import { icon } from './icons.js';

export function rosterModalHTML(team) {
  team.roster = team.roster || [];
  const rosterHTML = team.roster.map((athlete) => `
    <div class="ath-row">
      <span>${athlete.foto ? `<img class="miniphoto" src="${athlete.foto}" style="width:28px;height:28px;border-radius:50%;object-fit:cover">` : icon('user')}</span>
      <input data-athlete-name="${esc(athlete.id)}" value="${esc(athlete.nome)}" placeholder="Nome" style="flex:1">
      <input type="number" data-athlete-numero="${esc(athlete.id)}" value="${esc(athlete.numero || '')}" placeholder="Nº" style="width:70px">
      <button class="btn ghost sm" data-athlete-photo="${esc(athlete.id)}">${icon('camera', 16)}</button>
      <button class="btn ghost sm" data-athlete-remove="${esc(athlete.id)}">${icon('trash', 16)}</button>
    </div>
  `).join('') || '<p class="muted">Nenhum atleta cadastrado.</p>';
  
  const staffHTML = STAFF_ROLES.map(([key, label]) => `
    <div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)">
      <span style="flex:1">${esc(label)}</span>
      <input data-staff="${esc(team.id)}:${key}" value="${esc((team.staff || {})[key] || '')}" placeholder="Nome" style="flex:1">
    </div>
  `).join('');
  
  return `<h3>Elenco — ${esc(team.nome)}</h3>
  <div style="margin-top:12px">${rosterHTML}</div>
  <h3 style="margin-top:18px">Comissão técnica</h3>
  <div style="margin-top:8px">${staffHTML}</div>
  <div class="row" style="margin-top:12px;gap:8px">
    <input data-new-athlete-name placeholder="Nome do novo atleta" style="flex:1">
    <button class="btn primary" data-add-athlete="${esc(team.id)}">+ Adicionar</button>
  </div>
  <div class="row" style="justify-content:flex-end;margin-top:14px">
    <button class="btn ghost" data-close-modal>Fechar</button>
  </div>`;
}

