import { navigate } from '../app/router-v2.js';
import { toast } from '../app/ui.js';
import { auth } from '../services/firebase.js';
import { PLAN_DEFINITIONS, planCardsHTML, planLimitText, currentPlan, choosePlan } from '../app/plans.js';
import { createCheckout, cancelSubscription } from '../services/billing.js';

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
    const billing = user.billing || {};
    const statusLabel = billing.status === 'active' ? '✅ Ativo' : billing.status === 'past_due' ? '⚠️ Pagamento atrasado' : billing.status === 'pending' ? '⏳ Pagamento pendente' : '⚪ Grátis';
    const pendingResume = billing.status === 'pending' && billing.checkoutUrl
      ? `<p class="muted" style="margin-top:8px"><a href="${billing.checkoutUrl}" target="_blank" rel="noopener">Finalizar pagamento pendente →</a></p>`
      : '';
    const cancelButton = billing.status === 'active'
      ? '<button class="btn ghost" style="margin-top:10px" data-cancel-subscription>Cancelar assinatura</button>'
      : '';
    body.innerHTML = `<div class="hero" style="padding-top:10px;min-height:0"><h1>PLANOS E <em>COBRANÇA</em></h1><p class="muted">Gerencie sua assinatura e veja os limites do seu plano.</p></div><div class="card" style="margin-top:18px"><h2>Plano atual: ${plan.name}</h2><p class="muted">${planLimitText(planId)}</p><p class="muted" style="margin-top:8px">Status: ${statusLabel}</p>${pendingResume}${cancelButton}</div><div class="card" style="margin-top:16px"><h2>Escolha seu plano</h2><div class="grid" style="margin-top:12px">${planCardsHTML(planId)}</div></div>`;

    body.querySelectorAll('[data-choose-plan]').forEach((button) => {
      button.onclick = async () => {
        const chosenId = button.dataset.choosePlan;
        if (chosenId === currentPlan(user)) {return;}
        const result = choosePlan(user, chosenId);
        if (!result.ok) {return toast(result.reason);}
        if (!result.pending) {
          toast(`Plano ${PLAN_DEFINITIONS[chosenId].name} ativado!`);
          return renderBody();
        }
        const provider = confirm('OK para pagar com Mercado Pago, Cancelar para pagar com Asaas.') ? 'mercadopago' : 'asaas';
        button.disabled = true;
        try {
          const { checkoutUrl } = await createCheckout(chosenId, provider);
          window.location.href = checkoutUrl;
        } catch (error) {
          toast(error.message || 'Não foi possível iniciar o pagamento.');
          button.disabled = false;
        }
      };
    });

    body.querySelector('[data-cancel-subscription]')?.addEventListener('click', async () => {
      if (!confirm('Cancelar sua assinatura? Você continua com acesso até o fim do período já pago.')) {return;}
      try {
        await cancelSubscription();
        toast('Assinatura cancelada.');
        renderBody();
      } catch (error) {
        toast(error.message || 'Não foi possível cancelar.');
      }
    });
  }

  await load();
}


