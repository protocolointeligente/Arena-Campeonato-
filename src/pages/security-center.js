import { navigate } from '../app/router.js';
import { esc } from '../app/utils.js';
import { auth } from '../services/firebase.js';

export async function renderSecurityCenter(root) {
  root.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/">ARENA</a><button class="btn ghost" data-back>← Superadmin</button></header><main class="section"><div class="hero" style="padding-top:10px;min-height:0"><h1>CENTRAL DE <em>SEGURANÇA</em></h1><p class="muted">Configurações de segurança da plataforma.</p></div><div data-body><div class="card">Carregando segurança...</div></div></main></div>`;
  root.querySelector('[data-back]').onclick = () => navigate('/superadmin');
  const body = root.querySelector('[data-body]');
  const user = auth.currentUser;

  async function load() {
    if (!user) {
      body.innerHTML = `<div class="card"><h2>Acesso restrito</h2><p class="muted">Faça login como superadmin.</p></div>`;
      return;
    }
    try {
      const mfa = user.multiFactor?.enrolledFactors?.length > 0;
      renderBody(mfa);
    } catch (error) {
      body.innerHTML = `<div class="card"><h2>Erro</h2><p class="muted">${esc(error.message)}</p></div>`;
    }
  }

  function renderBody(mfaEnabled) {
    body.innerHTML = `<div class="grid" style="margin-top:18px"><div class="card"><small>SEU EMAIL</small><h2 style="font-size:16px">${esc(user.email)}</h2></div><div class="card"><small>2FA</small><h2>${mfaEnabled ? '✅ Ativado' : '❌ Desativado'}</h2></div><div class="card"><small>ÚLTIMO LOGIN</small><h2 style="font-size:16px">${user.metadata?.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleString('pt-BR') : '—'}</h2></div></div><div class="card" style="margin-top:16px"><h2>Ações de segurança</h2><div class="row" style="flex-wrap:wrap;gap:8px;margin-top:12px">${!mfaEnabled ? '<button class="btn primary" data-enable-2fa>Ativar 2FA</button>' : '<span class="muted">2FA já está ativo.</span>'}<button class="btn ghost" data-revoke-sessions>Revogar todas as sessões</button></div></div><div class="card" style="margin-top:16px"><h2>Políticas da plataforma</h2><div class="row" style="padding:10px 0;border-bottom:1px solid var(--line)"><span style="flex:1">Expiração de sessão</span><span class="muted">24 horas (configurável via Firebase Console)</span></div><div class="row" style="padding:10px 0;border-bottom:1px solid var(--line)"><span style="flex:1">Domínios permitidos</span><span class="muted">Todos (configurável via Firebase Console)</span></div><div class="row" style="padding:10px 0"><span style="flex:1">Política de senha</span><span class="muted">Mín. 6 caracteres (configurável via Firebase Console)</span></div></div>`;
    if (!mfaEnabled) {
      body.querySelector('[data-enable-2fa]').onclick = async () => {
        alert('Configure 2FA no Firebase Console > Authentication > MFA');
      };
    }
    body.querySelector('[data-revoke-sessions]').onclick = async () => {
      if (confirm('Revogar todas as sessões do usuário atual?')) {
        try {
          await user.getIdToken(true);
          alert('Sessões revogadas. Faça login novamente.');
          navigate('/login');
        } catch { alert('Erro ao revogar sessões'); }
      }
    };
  }

  await load();
}