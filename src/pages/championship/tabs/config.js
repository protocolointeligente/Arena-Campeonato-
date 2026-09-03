import { ensureBranding } from '../../../app/branding.js';
import { ensureOps } from '../../../app/ops.js';
import { CRIT_LABEL } from '../../../app/standings.js';
import { esc } from '../../../app/utils.ts';
import { icon } from '../../../app/icons.js';

export function renderConfig(store) {
  const state = store.getState();
  ensureBranding(state);
  ensureOps(state);
  const criterios = state.cfg?.criterios || ['P', 'V', 'SG', 'GP'];
  
  return `
    <div class="card">
      <h2>Configurações</h2>
      <label class="muted">Status<select data-status>
        <option value="rascunho">Rascunho</option>
        <option value="inscricoes">Inscrições abertas</option>
        <option value="andamento">Em andamento</option>
        <option value="encerrado">Encerrado</option>
      </select></label>
      <label class="muted">Cor principal<input type="color" data-accent value="${esc(state.branding.accent || '#2fcf6b')}"></label>
      <label class="muted" style="margin-top:12px;display:block">URL personalizada do portal público<input data-public-slug maxlength="60" placeholder="ex: copa-do-bairro-2026" value="${esc(state.publicSlug || '')}"></label>
      <p class="muted" style="font-size:12px;margin-top:4px">Se preenchido, o portal fica em ${esc(location.origin)}/c/&lt;url&gt; em vez do link padrão. Deixe em branco pra usar o link padrão.</p>
      <label class="muted" style="margin-top:12px;display:block">Taxa de inscrição (R$)<input type="number" min="0" step="0.01" data-registration-fee value="${esc(state.registrationFee || '')}"></label>
      <label class="muted" style="margin-top:8px;display:block">Wallet ID Asaas<input data-asaas-wallet-id placeholder="ex: 22e49670-27e4-4e78-a924-000000000000" value="${esc(state.asaasWalletId || '')}"></label>
      <p class="muted" style="font-size:12px;margin-top:4px">Encontre o Wallet ID no painel Asaas em Minha Conta → Integrações. Preencha os dois campos pra cobrar dos times ao aprovar cada inscrição (Arena fica com 8%); deixe em branco pra não cobrar nada.</p>
      <button class="btn primary" data-save-config>Salvar configurações</button>
      <button class="btn ghost" style="margin-top:8px" data-clear-results>↻ Zerar resultados</button>
      <button class="btn ghost" style="margin-top:8px" data-export-json>⬇ Baixar backup (.json)</button>
      <label class="btn ghost" style="margin-top:8px;display:inline-block">Restaurar backup<input type="file" accept="application/json,.json" data-import-json style="display:none"></label>
    </div>
    ${brandingCardHTML(state)}
    <div class="card" style="margin-top:16px">
      <h2>Pontuação e desempate</h2>
      <p class="muted" style="font-size:13px;margin:0 0 12px">Estas configurações valem para a fase ativa.</p>
      <div class="row" style="flex-wrap:wrap">
        <label class="muted" style="flex:1;min-width:120px">Vitória<input type="number" data-win-pts value="${state.cfg?.winPts ?? 3}"></label>
        <label class="muted" style="flex:1;min-width:120px">Empate<input type="number" data-draw-pts value="${state.cfg?.drawPts ?? 1}"></label>
        <label class="muted" style="flex:1;min-width:120px">Derrota<input type="number" data-loss-pts value="${state.cfg?.lossPts ?? 0}"></label>
      </div>
      <div style="margin-top:14px"><span class="muted">Critérios de desempate (ordem)</span>${criteriaEditorHTML(criterios)}</div>
      <div class="row" style="flex-wrap:wrap;margin-top:12px">
        <label class="muted" style="flex:1;min-width:160px">Peso do cartão amarelo<input type="number" min="0" max="20" step="1" data-disc-yellow value="${state.cfg?.discYellow ?? 1}"></label>
        <label class="muted" style="flex:1;min-width:160px">Peso do cartão vermelho<input type="number" min="0" max="20" step="1" data-disc-red value="${state.cfg?.discRed ?? 2}"></label>
      </div>
      <div class="row" style="flex-wrap:wrap;margin-top:12px">
        <label class="muted" style="flex:1;min-width:160px">Máximo de participantes<input type="number" min="1" max="50" step="1" data-max-roster value="${state.cfg?.maxRoster ?? 50}"></label>
        <label class="muted" style="flex:1;min-width:160px">Sets para vencer<input type="number" min="1" max="7" step="1" data-sets-to-win value="${state.cfg?.setsToWin ?? 1}"></label>
        <label class="muted" style="flex:1;min-width:160px">Períodos / etapas<input type="number" min="1" max="6" step="1" data-periods value="${state.cfg?.periods ?? 1}"></label>
      </div>
      <label class="muted" style="margin-top:12px">Amarelos para suspensão<input type="number" min="0" data-yellow-limit value="${state.cfg?.yellowLimit || 3}"></label>
      <button class="btn primary" style="margin-top:12px" data-save-scoring>Salvar pontuação e desempate</button>
    </div>
    <div class="card" style="margin-top:16px">
      <h2>Locais</h2>
      ${(state.venues || []).map((venue) => `
        <div class="team-row">
          <span>${icon('mapPin')}</span>
          <span>${esc(venue.name)}${venue.address ? ` <span class="muted">· ${esc(venue.address)}</span>` : ''}</span>
          <button class="btn ghost" data-remove-venue="${esc(venue.id)}">Remover</button>
        </div>
      `).join('') || '<p class="muted">Nenhum local cadastrado.</p>'}
      <div class="row" style="margin-top:12px;gap:8px">
        <input data-new-venue-name placeholder="Nome do local" style="flex:1">
        <input data-new-venue-address placeholder="Endereço (opcional)" style="flex:1">
        <button class="btn primary" data-add-venue>+ Adicionar</button>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <h2>Árbitros e mesários</h2>
      ${(state.officials || []).map((official) => `
        <div class="team-row">
          <span>${icon('whistle')}</span>
          <span>${esc(official.name)}${official.role ? ` <span class="muted">· ${esc(official.role)}</span>` : ''}</span>
          <button class="btn ghost" data-remove-official="${esc(official.id)}">Remover</button>
        </div>
      `).join('') || '<p class="muted">Nenhum oficial cadastrado.</p>'}
      <div class="row" style="margin-top:12px;gap:8px">
        <input data-new-official-name placeholder="Nome" style="flex:1">
        <input data-new-official-role placeholder="Função" style="width:140px">
        <button class="btn primary" data-add-official>+ Adicionar</button>
      </div>
    </div>
  `;
}

function brandingCardHTML(state) {
  const b = state.branding;
  return `
    <div class="card" style="margin-top:16px">
      <h2>Identidade visual</h2>
      <div class="row" style="flex-wrap:wrap;align-items:flex-start">
        <div>
          ${b.logo ? `<img class="miniphoto" src="${b.logo}" style="width:64px;height:64px;border-radius:10px;object-fit:contain;background:var(--surface-muted)">` : '<span class="muted">Sem logo</span>'}
          <div class="row" style="margin-top:8px">
            <label class="btn ghost sm">Selecionar logo<input type="file" accept="image/*" style="display:none" data-brand-input="logo"></label>
            ${b.logo ? '<button class="btn ghost sm" data-clear-brand="logo">Remover</button>' : ''}
          </div>
        </div>
        <div>
          ${b.cover ? `<img class="miniphoto" src="${b.cover}" style="width:160px;height:80px;border-radius:10px;object-fit:cover;background:var(--surface-muted)">` : '<span class="muted">Sem capa</span>'}
          <div class="row" style="margin-top:8px">
            <label class="btn ghost sm">Selecionar capa<input type="file" accept="image/*" style="display:none" data-brand-input="cover"></label>
            ${b.cover ? '<button class="btn ghost sm" data-clear-brand="cover">Remover</button>' : ''}
          </div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <h2>Patrocinadores</h2>
      ${(state.sponsors || []).map((sponsor) => `
        <div class="team-row">
          ${sponsor.logo ? `<img class="miniphoto" src="${sponsor.logo}" style="width:28px;height:28px;border-radius:5px;object-fit:contain;background:var(--surface-muted)">` : `<span>${icon('image')}</span>`}
          <span>${esc(sponsor.name)}${sponsor.url ? ` <span class="muted">· ${esc(sponsor.url)}</span>` : ''}</span>
          <button class="btn ghost" data-remove-sponsor="${esc(sponsor.id)}">Remover</button>
        </div>
      `).join('') || '<p class="muted">Nenhum patrocinador cadastrado.</p>'}
      <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap">
        <input data-new-sponsor-name placeholder="Nome do patrocinador" style="flex:1;min-width:160px">
        <input data-new-sponsor-url placeholder="Site (opcional)" style="flex:1;min-width:160px">
        <label class="btn ghost sm">Logo<input type="file" accept="image/*" style="display:none" data-new-sponsor-logo></label>
        <button class="btn primary" data-add-sponsor>+ Adicionar</button>
      </div>
    </div>
  `;
}

function criteriaEditorHTML(order) {
  const tail = order.filter((c) => c !== 'P');
  const pool = ['V', 'SG', 'GP', 'GC', 'CD', 'DISC'].filter((c) => !order.includes(c));
  const rows = tail.map((c, i) => `
    <div class="team-row">
      <span>${i + 2}</span>
      <span>${esc(CRIT_LABEL[c] || c)}</span>
      <span class="row">
        <button class="btn ghost sm" data-crit-move="${i}:-1" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn ghost sm" data-crit-move="${i}:1" ${i === tail.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="btn ghost sm" data-crit-remove="${i}">✕</button>
      </span>
    </div>
  `).join('');
  const add = pool.length ? `
    <div class="row" style="margin-top:10px">
      <select data-crit-add-select style="flex:1">${pool.map((c) => `<option value="${esc(c)}">${esc(CRIT_LABEL[c] || c)}</option>`).join('')}</select>
      <button class="btn ghost sm" data-crit-add>+ Incluir</button>
    </div>
  ` : '';
  return `<p class="muted" style="font-size:13px">Pontos é fixo em 1º; use ↑ e ↓ para reordenar os demais.</p><div class="team-row"><span>1</span><span>Pontos</span><span class="muted">fixo</span></div>${rows}${add}`;
}

