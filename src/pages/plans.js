import { navigate } from '../app/router.js';
import { esc } from '../app/utils.js';
import { toast } from '../app/ui.js';
import { auth } from '../services/firebase.js';
import { planCardsHTML, planLimitText, currentPlan, choosePlan, confirmPlanRequest } from '../app/plans.js';

export async function renderPlans(root) {
  root.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/" data-link>ARENA</a><button class="btn ghost" data-back>← Meus campeonatos</button></header><main class="section"><div data-body><div class="card">Carregando planos...</div></div></main></div>`;
  root.querySelector('[data-back]').onclick = () => navigate('/');
  const body = root.querySelector('[data-body]');
  const user = auth.currentUser;

  async function load() {
    if (!user) {
      body.innerHTML = `<div class="card"><h2>Faça login</h2><p class="muted">Você precisa estar logado para ver seus planos.</p></div>`;
      return;
    }
    renderBody();
  }

  function renderBody() {
    const planId = currentPlan(user);
    const plan = PLAN_DEFINITIONS[planId] || PLAN_DEFINITIONS.free;
    body.innerHTML = `<div class="hero" style="padding-top:10px;min-height:0"><h1>PLANOS E <em>COBRANÇA</em></h1><p class="muted">Gerencie sua assinatura e veja os limites do seu plano.</p></div><div class="card" style="margin-top:18px"><h2>Plano atual: ${plan.name}</h2><p class="muted">${planLimitText(planId)}</p><p class="muted" style="margin-top:8px">Status: ${user.billing?.status === 'active' ? '✅ Ativo' : user.billing?.status === 'pending' ? '⏳ Pendente' : '⚪ Grátis'}</p></div><div class="card" style="margin-top:16px"><h2>Escolha seu plano</h2><div class="grid" style="margin-top:12px">${planCardsHTML(planId)}</div></div>`;
    body.querySelectorAll('[data-choose-plan]').forEach((button) => {
      button.onclick = async () => {
        const planId = button.dataset.choosePlan;
        if (planId === currentPlan(user)) return;
        const result = choosePlan(user, planId);
        if (!result.ok) return toast(result.reason);
        if (result.pending) {
          const confirmed = confirmPlanRequest(user, planId);
          if (!confirmed.ok) return toast(confirmed.reason);
          toast('Solicitação de upgrade enviada! Aguarde aprovação do superadmin.');
        } else {
          toast(`Plano ${PLAN_DEFINITIONS[planId].name} ativado!`);
        }
        renderBody();
      };
    });
  }

  await load();
}