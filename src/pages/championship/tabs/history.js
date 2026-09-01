import { esc } from '../../../app/utils.ts';
import { verifyAuditChain } from '../../../app/audit-integrity.js';

export function renderHistory(store, { auditRows }) {
  const integrity = verifyAuditChain(auditRows || []);
  const integrityHTML = integrity.ok
    ? '<div class="notice success" role="status"><strong>Integridade verificada:</strong> cadeia de auditoria consistente.</div>'
    : `<div class="notice warning" role="alert"><strong>Integridade comprometida:</strong> ${esc(integrity.reason)} Registro: ${esc(integrity.id || 'desconhecido')}.</div>`;
  return `
    <div class="card">
      <h2>Histórico de alterações</h2>
      ${integrityHTML}
      ${auditRows.length ? auditRows.map((item) => `
        <div class="registration-row">
          <div>
            <strong>${esc(item.summary || item.action)}</strong>
            <p class="muted">${esc(item.actorEmail || '')} · ${new Date(item.createdAtMs || Date.now()).toLocaleString('pt-BR')}</p>
          </div>
        </div>
      `).join('') : '<p class="muted">Nenhuma alteração registrada.</p>'}
    </div>
  `;
}

