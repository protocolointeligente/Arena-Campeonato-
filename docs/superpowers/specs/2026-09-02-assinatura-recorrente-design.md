# Assinatura Recorrente Automática (Mercado Pago + Asaas)

## Objetivo

Trocar o checkout manual atual (usuário copia uma chave Pix fixa e aguarda um superadmin aprovar manualmente no painel) por assinatura recorrente automática: o usuário escolhe o plano e o provedor, paga num link hospedado do provedor (sem o Arena tocar em dado de cartão), a assinatura ativa sozinha via webhook, cobra todo mês sozinha, e expira sozinha (com um período de graça) se parar de pagar.

## Escopo

Dentro:
- Criar assinatura recorrente real no Mercado Pago (`/preapproval`) e no Asaas (`/v3/checkouts` com `subscription`), usuário escolhe o provedor no momento do checkout.
- Ativação, renovação por ciclo, período de graça (`past_due`) e expiração automática via webhook — reaproveitando e estendendo a `billingWebhook` já existente.
- Cancelamento de assinatura iniciado pelo usuário (chama o provedor pra cancelar de verdade, não só apaga localmente).
- Função agendada diária como rede de segurança: ninguém fica `active` além do fim do período pago sem confirmação de renovação.
- Painel do superadmin (`plans-billing.js`) passa a ser só leitura/auditoria + ação manual de emergência (ex.: ativar/desativar na mão se um webhook falhar) — deixa de ser o caminho principal de aprovação.

Fora (não entra agora):
- Troca de plano no meio do ciclo com rateio proporcional — trocar de plano sempre inicia um ciclo novo pelo valor cheio.
- Cartão salvo / cobrança 1-clique fora do fluxo do provedor.
- Split de pagamento pra repassar valor a organizadores terceiros (isso é o item de cobrança de inscrição de equipes, escopo diferente).
- Cupom de desconto, período de teste grátis.

## Modelo de dados

Em `users/{uid}.billing` (substitui o formato atual, mesmo documento):

```js
billing: {
  planId: 'pro' | 'enterprise' | 'free',
  status: 'pending' | 'active' | 'past_due' | 'cancelled' | 'expired',
  provider: 'mercadopago' | 'asaas',
  subscriptionId: string,       // preapproval id (MP) ou subscription id (Asaas)
  checkoutUrl: string,          // init_point (MP) ou link do checkout (Asaas) — usado pra retomar um pagamento pendente
  amount: number,
  currentPeriodEnd: number,     // epoch ms — até quando o período pago atual vale
  requestedAt: number,
  confirmedAt: number,
  cancelledAt: number,
}
```

`billing.status` governa `canCreateChampionship`/`currentPlan` exatamente como hoje — `expired`/`cancelled` tratado como `free` pra fins de limite (mesma regra que já existe pra `status !== 'active'`).

## Arquitetura

**`functions/index.js`** ganha duas funções novas e a `billingWebhook` existente é estendida:

- **`createCheckout`** (`onRequest`, autenticado via `Authorization: Bearer <Firebase ID token>`, verificado com `admin.auth().verifyIdToken`): recebe `{ planId, provider }`, valida o plano contra `PLAN_DEFINITIONS`, cria a assinatura no provedor escolhido com `external_reference`/`metadata` = `JSON.stringify({ userId, planId })` (é esse campo que a `billingWebhook` já usa pra saber quem ativar), grava `users/{uid}.billing` com `status:'pending'` e o `subscriptionId`/`checkoutUrl` recebidos, devolve `{ checkoutUrl }` pro cliente redirecionar.
  - Mercado Pago: `POST https://api.mercadopago.com/preapproval` com `auto_recurring:{frequency:1, frequency_type:'months', transaction_amount, currency_id:'BRL'}`, `back_url` apontando pra `/planos`, `external_reference`. Resposta traz `init_point`.
  - Asaas: `POST https://api.asaas.com/v3/checkouts` com `chargeTypes:['RECURRENT']`, `subscription:{cycle:'MONTHLY', nextDueDate: <amanhã, formato 'YYYY-MM-DD HH:mm:ss'>}`, `items:[{name: plano.name, value: plano.price}]`, `externalReference`. Resposta traz o id do checkout → `https://checkout.asaas.com/{id}`.
  - Novo secret: `ASAAS_ACCESS_TOKEN` (token de API pra criar cobrança — diferente do `ASAAS_WEBHOOK_TOKEN`, que só valida webhook recebido). Mercado Pago reaproveita o `MERCADOPAGO_ACCESS_TOKEN` que já existe.

- **`billingWebhook`** (mesma função, estendida): hoje só entende notificação de pagamento avulso do MP (`data.id` → busca `/v1/payments/{id}`) e do Asaas (`body.payment`). Passa a também entender:
  - MP `type === 'subscription_preapproval'`: busca `GET /preapproval/{data.id}`, lê `status` (`authorized`→`active`, `paused`/`cancelled`→`cancelled`) e `external_reference`.
  - MP `type === 'subscription_authorized_payment'` (cobrança de cada ciclo): busca o payment como hoje, `status:'approved'` renova `currentPeriodEnd` (+1 mês), `status:'rejected'` marca `past_due`.
  - Asaas `event === 'PAYMENT_RECEIVED'`/`'PAYMENT_CONFIRMED'`: `status:'active'`, renova `currentPeriodEnd`.
  - Asaas `event === 'PAYMENT_OVERDUE'`: `status:'past_due'`.
  - Asaas `event === 'SUBSCRIPTION_DELETED'` / MP preapproval `status:'cancelled'`: `status:'cancelled'`, `planId:'free'`.
  - Continua idempotente por `eventId` (já existe) e continua exigindo `reference.userId`/`reference.planId` antes de escrever.

- **`cancelSubscription`** (`onRequest`, autenticado): usuário pede cancelamento. Busca `billing.provider`/`billing.subscriptionId` do próprio usuário, chama `PUT /preapproval/{id}` com `status:'cancelled'` (MP) ou `DELETE /v3/subscriptions/{id}` (Asaas), grava `status:'cancelled'`, `cancelledAt`. Continua ativo até `currentPeriodEnd` (já pago), não corta na hora — texto na UI deixa isso claro.

- **`checkExpiredSubscriptions`** (`onSchedule`, 1x/dia): consulta `users` com `billing.status in ['active','past_due']` e `billing.currentPeriodEnd < agora - 3 dias de graça`, rebaixa pra `status:'expired', planId:'free'`. Rede de segurança pra webhook perdido — o caminho normal é o webhook de renovação/cobrança chegar antes disso.

**Frontend:**
- `src/services/billing.js`: `requestPlan()` sai; entra `createCheckout(planId, provider)` (chama `createCheckout` via `fetch` com o ID token do usuário) e `cancelSubscription()`.
- `src/pages/plans.js`: cada card de plano **pago** (Pro, Enterprise) ganha dois botões, "Pagar com Mercado Pago" e "Pagar com Asaas", em vez do botão único atual. O card Grátis continua com o botão único de sempre (sem provedor, sem pagamento — `choosePlan`/`confirmPlanRequest` client-side, inalterado). Se `billing.status==='pending'`, mostra "Finalizar pagamento" apontando pro `checkoutUrl` salvo em vez de gerar um novo. Se `active`, mostra "Cancelar assinatura" com confirmação.
- `src/pages/plans-billing.js` (superadmin): a lista de "pendentes" e os botões Aprovar/Negar somem — não fazem mais sentido com aprovação automática. Fica só a listagem de todos os usuários/planos (auditoria) e o `select` de alterar plano na mão continua existindo, pra emergência (webhook falhou, suporte manual).

## Validação

- Criar checkout MP e Asaas grava `billing.status:'pending'` com `subscriptionId`/`checkoutUrl` corretos.
- Webhook de ativação (MP `subscription_preapproval` autorizado / Asaas `PAYMENT_RECEIVED`) muda `status` pra `active` e seta `currentPeriodEnd`.
- Webhook de cobrança rejeitada/atrasada muda pra `past_due`, não derruba pra `free` na hora.
- Cancelamento pelo usuário chama o provedor de verdade (não só apaga o campo local) e mantém acesso até `currentPeriodEnd`.
- Função agendada rebaixa quem passou do período de graça sem confirmação.
- `canCreateChampionship`/limites de plano continuam funcionando exatamente como hoje pra qualquer `status` que não seja `active`.
- Webhook continua idempotente por `eventId` e continua rejeitando evento sem `reference.userId`/`planId`.
