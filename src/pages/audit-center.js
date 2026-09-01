import { navigate } from '../app/router-v2.js';
import { esc } from '../app/utils.ts';
import { listAudit } from '../services/audit.js';

export async function renderAuditCenter(root) {
  root.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/">ARENA</a><button class="btn ghost" data-back>← Superadmin</button></header><main class="section"><div class="hero" style="padding-top:10px;min-height:0"><h1>CENTRAL DE <em>AUDITORIA</em></h1><p class="muted">Log de ações em toda a plataforma.</p></div><div data-body><div class="card">Carregando auditoria...</div></div></main></div>`;
  root.querySelector('[data-back]').onclick = () => navigate('/superadmin');
  const body = root.querySelector('[data-body]');

  async function load() {
    try {
      const logs = await listAudit();
      renderBody(logs);
    } catch (error) {
      body.innerHTML = `<div class="card"><h2>Erro</h2><p class="muted">${esc(error.message || 'Não foi possível carregar a auditoria.')}</p></div>`;
    }
  }

  function renderBody(logs) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = logs.filter((l) => l.ts && new Date(l.ts) >= today).length;
    const users = new Set(logs.map((l) => l.user).filter(Boolean)).size;

    body.innerHTML = `<div class="grid" style="margin-top:18px"><div class="card"><small>TOTAL DE LOGS</small><h2>${logs.length}</h2></div><div class="card"><small>HOJE</small><h2>${todayCount}</h2></div><div class="card"><small>USUÁRIOS ÚNICOS</small><h2>${users}</h2></div></div><div class="card" style="margin-top:16px"><h2>Logs recentes</h2>${logs.length ? logs.slice(0, 100).map((item) => `<div class="row" style="padding:10px 0;border-bottom:1px solid var(--line)"><span style="flex:1;min-width:180px"><strong>${esc(item.action || '—')}</strong><br><span class="muted">${esc(item.user || 'sistema')} · ${item.ts ? new Date(item.ts).toLocaleString('pt-BR') : '—'}</span></span><span style="flex:1;min-width:200px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.summary || '')}</span><button class="btn ghost sm" data-detail="${esc(JSON.stringify(item).replace(/"/g, '"'))}">Detalhes</button></div>`).join('') : '<p class="muted">Nenhum log de auditoria.</p>'}</div>`;
    body.querySelectorAll('[data-detail]').forEach((button) => button.onclick = () => {
      try {
        const detail = JSON.parse(button.dataset.detail);
        alert(JSON.stringify(detail, null, 2));
      } catch { alert('Erro ao exibir detalhes'); }
    });
  }

  await load();
}


