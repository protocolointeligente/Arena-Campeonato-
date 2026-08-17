import { navigate } from '../app/router.js';
import { esc } from '../app/utils.js';
import { platformOverview, approvePayment } from '../services/superadmin.js';

export async function renderSuperadmin(root) {
  root.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/">ARENA</a><button class="btn ghost" data-back>← Voltar</button></header><main class="section"><div class="hero" style="padding-top:10px;min-height:0"><h1>PAINEL <em>SUPERADMIN</em></h1><p class="muted">Visão operacional da plataforma ARENA.</p></div><div data-body><div class="card">Carregando plataforma...</div></div></main></div>`;
  root.querySelector('[data-back]').onclick = () => navigate('/');
  const body = root.querySelector('[data-body]');

  async function load() {
    try {
      const overview = await platformOverview();
      renderBody(overview);
    } catch (error) {
      body.innerHTML = `<div class="card"><h2>Acesso restrito</h2><p class="muted">${esc(error.message || 'Você não possui permissão de superadmin.')}</p></div>`;
    }
  }

  function renderBody(overview) {
    body.innerHTML = `<div class="grid" style="margin-top:18px"><div class="card"><small>CAMPEONATOS</small><h2>${overview.totalChampionships}</h2></div><div class="card"><small>USUÁRIOS</small><h2>${overview.totalUsers}</h2></div><div class="card"><small>EM ANDAMENTO</small><h2>${overview.inProgress}</h2></div><div class="card"><small>PAGAMENTOS PENDENTES</small><h2>${overview.pending.length}</h2></div></div><div class="card" style="margin-top:16px"><h2>Navegação</h2><div class="row" style="flex-wrap:wrap;gap:8px"><button class="btn ghost" data-nav="/superadmin/auditoria">📋 Auditoria</button><button class="btn ghost" data-nav="/superadmin/seguranca">🔒 Segurança</button><button class="btn ghost" data-nav="/superadmin/privacidade">🛡️ Privacidade</button><button class="btn ghost" data-nav="/superadmin/planos">💳 Planos e Cobrança</button><button class="btn ghost" data-nav="/superadmin/beta">🧪 Beta & Hardening</button></div></div><div class="card" style="margin-top:16px"><h2>Pagamentos pendentes</h2>${overview.pending.length ? overview.pending.map((item) => `<div class="row" style="padding:10px 0;border-bottom:1px solid var(--line)"><span style="flex:1"><strong>${esc(item.email || item.id)}</strong><br><span class="muted">${esc(item.billing?.planId || 'Plano')} · R$ ${Number(item.billing?.amount || 0).toFixed(2).replace('.', ',')}</span></span><button class="btn primary" data-approve="${esc(item.id)}">Liberar acesso</button></div>`).join('') : '<p class="muted">Nenhum pagamento pendente.</p>'}</div><div class="card" style="margin-top:16px"><h2>Campeonatos recentes</h2>${overview.championships.length ? overview.championships.map((item) => `<div class="row" style="padding:10px 0;border-bottom:1px solid var(--line)"><span style="flex:1"><strong>${esc(item.nome || item.id)}</strong><br><span class="muted">${esc(item.ownerEmail || '')} · ${esc(item.status || '')}</span></span><button class="btn ghost" data-open="${esc(item.id)}">Abrir</button></div>`).join('') : '<p class="muted">Nenhum campeonato.</p>'}</div>`;
    body.querySelectorAll('[data-nav]').forEach((button) => button.onclick = () => navigate(button.dataset.nav));
    body.querySelectorAll('[data-approve]').forEach((button) => button.onclick = async () => { await approvePayment(button.dataset.approve); await load(); });
    body.querySelectorAll('[data-open]').forEach((button) => button.onclick = () => navigate(`/campeonatos/${button.dataset.open}`));
  }

  await load();
}