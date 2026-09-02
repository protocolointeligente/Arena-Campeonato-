import { navigate } from '../app/router-v2.js';
import { toast, modal, closeModal } from '../app/ui.js';
import { auth } from '../services/firebase.js';
import { PLAN_DEFINITIONS, planCardsHTML, planLimitText, currentPlan, choosePlan } from '../app/plans.js';
import { createCheckout, cancelSubscription, getBilling } from '../services/billing.js';

export async function renderPlans(root) {
  root.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/" data-link>ARENA</a><button class="btn ghost" data-back>← Meus campeonatos</button></header><main class="section"><div data-body><div class="card">Carregando planos...</div></div></main></div>`;
  root.querySelector('[data-back]').onclick = () => navigate('/');
  const body = root.querySelector('[data-body]');
  const user = auth.currentUser;
  let billingDoc = null;

  async function load() {
    if (!user) {
      body.innerHTML = `<div class="card"><h2>Faça login</h2><p class="muted">Você precisa estar logado para ver seus planos.</p></div>`;
      return;
    }
    billingDoc = await getBilling();
    renderBody();
  }

  function renderBody() {
    const planId = currentPlan(billingDoc);
    const plan = PLAN_DEFINITIONS[planId] || PLAN_DEFINITIONS.free;
    const billing = billingDoc?.billing || {};
    const statusLabel = billing.status === 'active' ? '✅ Ativo' : billing.status === 'past_due' ? '⚠️ Pagamento atrasado' : billing.status === 'pending' ? '⏳ Pagamento pendente' : billing.status === 'cancelled' ? '🚫 Cancelada (ativa até o fim do período)' : '⚪ Grátis';
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
        if (chosenId === currentPlan(billingDoc)) {return;}
        const result = choosePlan(billingDoc, chosenId);
        if (!result.ok) {return toast(result.reason);}
        if (!result.pending) {
          toast(`Plano ${PLAN_DEFINITIONS[chosenId].name} ativado!`);
          billingDoc = await getBilling();
          return renderBody();
        }
        openProviderModal(chosenId);
      };
    });

    body.querySelector('[data-cancel-subscription]')?.addEventListener('click', async () => {
      if (!confirm('Cancelar sua assinatura? Você continua com acesso até o fim do período já pago.')) {return;}
      try {
        await cancelSubscription();
        toast('Assinatura cancelada.');
        billingDoc = await getBilling();
        renderBody();
      } catch (error) {
        toast(error.message || 'Não foi possível cancelar.');
      }
    });
  }

  function openProviderModal(chosenId) {
    modal(`<h3>Como você quer pagar?</h3><p class="muted">Assinatura mensal do plano ${PLAN_DEFINITIONS[chosenId].name}.</p><div class="row" style="flex-wrap:wrap;margin-top:14px;gap:8px"><button class="btn primary" data-pay="mercadopago">Pagar com Mercado Pago</button><button class="btn primary" data-pay="asaas">Pagar com Asaas</button><button class="btn ghost" data-close-modal>Cancelar</button></div>`);
    const box = document.getElementById('modalBox');
    box.querySelector('[data-close-modal]').onclick = () => closeModal();
    box.querySelectorAll('[data-pay]').forEach((payButton) => {
      payButton.onclick = async () => {
        const provider = payButton.dataset.pay;
        payButton.disabled = true;
        try {
          const { checkoutUrl } = await createCheckout(chosenId, provider);
          window.location.href = checkoutUrl;
        } catch (error) {
          closeModal();
          toast(error.message || 'Não foi possível iniciar o pagamento.');
        }
      };
    });
  }

  await load();
}
