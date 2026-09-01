import { esc } from '../../../app/utils.ts';

export function registrationStatusLabel(status) {
  return { pending: 'Pendente', approved: 'Aprovada', rejected: 'Recusada' }[status] || 'Pendente';
}

export function renderRegistrations(store, { registrations }) {
  return `
    <div class="card">
      <h2>Inscrições recebidas</h2>
      <p class="muted">Analise as equipes enviadas pelo formulário público.</p>
      ${registrations.length ? `<div class="row" style="margin:10px 0 14px;gap:8px"><input type="search" data-registration-search placeholder="Buscar equipe, responsável ou protocolo" aria-label="Buscar inscrição" style="flex:1;padding:10px"><select data-registration-status aria-label="Filtrar por status"><option value="">Todos os status</option><option value="pending">Pendentes</option><option value="approved">Aprovadas</option><option value="rejected">Recusadas</option></select></div>${registrations.map((item) => `
        <div class="registration-row" data-registration-row data-registration-state="${esc(item.status || 'pending')}" data-search-text="${esc(`${item.teamName || ''} ${item.responsible || ''} ${item.id || ''}`.toLowerCase())}">
          <div>
            <strong>${esc(item.teamName || 'Equipe')}</strong>
            <p class="muted">${esc(item.responsible || '')} · ${esc(item.phone || '')} · ${(item.athletes || []).length} atleta(s) · protocolo ${esc(item.id || '')}</p>
          </div>
          <span class="tag">${registrationStatusLabel(item.status)}</span>
          ${item.status === 'pending' ? `
            <button class="btn primary" data-approve-registration="${item.id}">Aprovar</button>
            <button class="btn ghost" data-reject-registration="${item.id}">Recusar</button>
          ` : ''}
        </div>
      `).join('')}` : '<p class="muted">Nenhuma inscrição recebida.</p>'}
    </div>
  `;
}

export function bindRegistrationSearch(root) {
  const input = root.querySelector('[data-registration-search]');
  const status = root.querySelector('[data-registration-status]');
  if (!input || !status) {return;}
  const apply = () => {
    const query = input.value.trim().toLowerCase();
    const selectedStatus = status.value;
    root.querySelectorAll('[data-registration-row]').forEach((row) => {
      row.hidden = (query && !row.dataset.searchText.includes(query)) || (selectedStatus && row.dataset.registrationState !== selectedStatus);
    });
  };
  input.oninput = apply;
  status.onchange = apply;
}

