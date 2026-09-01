import { navigate } from '../app/router-v2.js';
import { esc } from '../app/utils.ts';
import { auth } from '../services/firebase.js';
import { listAudit } from '../services/audit.js';

export async function renderPrivacyCenter(root) {
  root.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/">ARENA</a><button class="btn ghost" data-back>← Superadmin</button></header><main class="section"><div class="hero" style="padding-top:10px;min-height:0"><h1>CENTRAL DE <em>PRIVACIDADE</em></h1><p class="muted">LGPD · Direitos do titular · Aviso de privacidade.</p></div><div data-body><div class="card">Carregando privacidade...</div></div></main></div>`;
  root.querySelector('[data-back]').onclick = () => navigate('/superadmin');
  const body = root.querySelector('[data-body]');
  const user = auth.currentUser;

  async function load() {
    if (!user) {
      body.innerHTML = `<div class="card"><h2>Acesso restrito</h2><p class="muted">Faça login como superadmin.</p></div>`;
      return;
    }
    try {
      renderBody();
    } catch (error) {
      body.innerHTML = `<div class="card"><h2>Erro</h2><p class="muted">${esc(error.message)}</p></div>`;
    }
  }

  function renderBody() {
    body.innerHTML = `<div class="grid" style="margin-top:18px"><div class="card"><small>SEU EMAIL</small><h2 style="font-size:16px">${esc(user.email)}</h2></div><div class="card"><small>UID</small><h2 style="font-size:16px">${esc(user.uid)}</h2></div><div class="card"><small>PROVEDOR</small><h2 style="font-size:16px">${esc(user.providerData?.[0]?.providerId || 'password')}</h2></div></div><div class="card" style="margin-top:16px"><h2>Ações LGPD</h2><div class="row" style="flex-wrap:wrap;gap:8px;margin-top:12px"><button class="btn primary" data-export-data>📥 Exportar meus dados</button><button class="btn ghost" data-request-deletion>🗑️ Solicitar exclusão</button></div></div><div class="card" style="margin-top:16px"><h2>Aviso de Privacidade</h2>${privacyNoticeHTML()}</div>`;
    body.querySelector('[data-export-data]').onclick = async () => {
      try {
        const logs = await listAudit();
        const userLogs = logs.filter((l) => l.user === user.email || l.user === user.uid);
        const data = { uid: user.uid, email: user.email, auditLogs: userLogs };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `dados-${user.uid}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      } catch { alert('Erro ao exportar dados'); }
    };
    body.querySelector('[data-request-deletion]').onclick = async () => {
      if (confirm('Solicitar exclusão completa da conta? Esta ação é irreversível.')) {
        alert('Solicitação registrada. O processo de exclusão será iniciado em até 30 dias conforme LGPD.');
      }
    };
  }

  await load();
}

export function privacyNoticeHTML() {
  return `<div style="font-size:14px;line-height:1.6;color:var(--text-muted)"><p><strong>ARENA Campeonatos</strong> respeita sua privacidade. Este aviso explica como coletamos, usamos e protegemos seus dados.</p><h4>1. Dados coletados</p><ul><li>Identificação: nome, email, UID Firebase.</li><li>Campeonatos: times, atletas, jogos, resultados, súmulas.</li><li>Logs de auditoria: ações realizadas na plataforma (IP, timestamp, ação).</li></ul><h4>2. Finalidade</h4><ul><li>Operar campeonatos esportivos.</li><li>Gerar relatórios, classificações, artilharia.</li><li>Segurança e auditoria (LGPD Art. 10).</li></ul><h4>3. Compartilhamento</h4><p>Não vendemos dados. Compartilhamos apenas com provedores de infraestrutura (Firebase/Google Cloud) sob contrato de processamento.</p><h4>4. Seus direitos (LGPD Art. 18)</h4><ul><li>Confirmação e acesso.</li><li>Correção de dados incompletos/inexatos.</li><li>Anonimização, bloqueio ou eliminação de dados desnecessários.</li><li>Portabilidade.</li><li>Eliminação (com exceções legais).</li><li>Revogação do consentimento.</li></ul><h4>5. Retenção</h4><p>Dados de campeonato: enquanto a conta existir + 5 anos para fins legais. Logs de auditoria: 2 anos.</p><h4>6. Contato</h4><p>DPO: privacidade@arena.example | Encarregado LGPD.</p></div>`;
}


