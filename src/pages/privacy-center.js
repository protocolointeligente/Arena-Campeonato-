import { navigate } from '../app/router-v2.js';
import { friendlyError } from '../app/friendly-error.js';
import { esc } from '../app/utils.ts';
import { auth } from '../services/firebase.js';
import { listMine } from '../services/championships.js';
import { privacyPolicyHTML, LEGAL_CONTACT } from './legal.js';
import { icon } from '../app/icons.js';

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
      body.innerHTML = `<div class="card"><h2>Erro</h2><p class="muted">${esc(friendlyError(error))}</p></div>`;
    }
  }

  function renderBody() {
    body.innerHTML = `<div class="grid" style="margin-top:18px"><div class="card"><small>SEU EMAIL</small><h2 style="font-size:16px">${esc(user.email)}</h2></div><div class="card"><small>UID</small><h2 style="font-size:16px">${esc(user.uid)}</h2></div><div class="card"><small>PROVEDOR</small><h2 style="font-size:16px">${esc(user.providerData?.[0]?.providerId || 'password')}</h2></div></div><div class="card" style="margin-top:16px"><h2>Ações LGPD</h2><div class="row" style="flex-wrap:wrap;gap:8px;margin-top:12px"><button class="btn primary" data-export-data>${icon('download', 16)} Exportar meus dados</button><button class="btn ghost" data-request-deletion>${icon('trash', 16)} Solicitar exclusão</button></div></div><div class="card" style="margin-top:16px"><h2>Aviso de Privacidade</h2>${privacyNoticeHTML()}</div>`;
    body.querySelector('[data-export-data]').onclick = async () => {
      try {
        const championships = await listMine();
        const data = { exportedAt: new Date().toISOString(), uid: user.uid, email: user.email, championships };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `dados-${user.uid}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      } catch { alert('Erro ao exportar dados'); }
    };
    body.querySelector('[data-request-deletion]').onclick = async () => {
      // Abre o e-mail do encarregado já preenchido — o pedido precisa chegar a uma pessoa.
      const subject = encodeURIComponent('Solicitação de exclusão de conta (LGPD)');
      const bodyText = encodeURIComponent(`Solicito a exclusão da minha conta e dos dados associados.

E-mail: ${user.email}
UID: ${user.uid}`);
      window.location.href = `mailto:${LEGAL_CONTACT}?subject=${subject}&body=${bodyText}`;
    };
  }

  await load();
}

export function privacyNoticeHTML() {
  return `<div style="font-size:14px;line-height:1.6">${privacyPolicyHTML()}</div>`;
}


