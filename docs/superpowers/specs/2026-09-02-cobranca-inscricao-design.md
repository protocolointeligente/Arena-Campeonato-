# Cobrança de Inscrição das Equipes (Split via Asaas)

## Objetivo

Deixar o organizador cobrar uma taxa de inscrição de cada equipe aprovada, com o dinheiro caindo direto na conta Asaas do PRÓPRIO organizador (não na do Arena) — Arena fica só com uma comissão fixa por inscrição paga. Sem OAuth, sem conta gerenciada pelo Arena: o organizador só cola o Wallet ID da própria conta Asaas já existente.

## Decisões já tomadas

- **Só Asaas** — split via `walletId` (o organizador copia da própria conta, sem conectar nada). Mercado Pago com split fica de fora (exigiria OAuth completo, escopo bem maior).
- **Comissão do Arena: 8%** de cada inscrição paga (organizador fica com 92%).
- **Cobrança só depois de aprovada** — organizador analisa a inscrição normalmente (fluxo de hoje, inalterado); só ao aprovar é que a cobrança fica disponível para o time. Nenhum risco de estorno por inscrição recusada, porque nada é cobrado antes da aprovação.
- **Taxa fixa por campeonato**, em R$, configurada pelo organizador — não varia por categoria. Campo vazio/zero = recurso desligado, tudo continua como hoje (sem cobrança).

## Escopo

Dentro:
- Organizador configura, em Configurações: valor da taxa (R$) e Wallet ID Asaas.
- Ao aprovar uma inscrição, se a taxa estiver configurada, o time passa a poder pagar.
- Nova página pública `/inscrever/:championshipId/status/:registrationId` — o time acompanha o status da própria inscrição (usando o protocolo já recebido no envio) e, uma vez aprovada, vê o botão de pagamento.
- Checkout criado sob demanda (não pré-gerado) quando o time clica em pagar — evita link expirado.
- Webhook dedicado confirma o pagamento e marca a inscrição como paga.
- Painel do organizador (aba Inscrições) mostra o status de pagamento de cada inscrição aprovada.

Fora:
- Mercado Pago com split (OAuth) — pode entrar depois, como opção adicional, se for pedido.
- Taxa variável por categoria/modalidade.
- Cobrança antes da aprovação, com estorno automático em caso de recusa.
- Reembolso pelo Arena em caso de cancelamento (fica combinado direto entre organizador e time, fora do sistema — o Arena não é parte na transação).

## Modelo de dados

Em `championships/{id}` (documento privado, já existente):
```js
registrationFee: number,      // valor em R$; 0 ou ausente = recurso desligado
asaasWalletId: string,        // Wallet ID Asaas do organizador; obrigatório se registrationFee > 0
```

Em cada `championships/{id}/registrations/{registrationId}` (já existente), campos novos:
```js
feeStatus: 'pending' | 'paid' | null,   // null = sem taxa configurada nesta inscrição no momento da aprovação
feeAmount: number,                       // valor cobrado desta equipe, congelado no momento da aprovação
feeCheckoutUrl: string,                  // último checkout gerado (só informativo/retomada; não é a fonte da verdade de status)
```

`feeStatus` só é definido no momento em que a inscrição é aprovada (congela o valor da taxa vigente naquele momento — se o organizador mudar o valor depois, não afeta quem já foi aprovado).

## Arquitetura

**`functions/index.js`** ganha duas funções novas:

- **`createRegistrationCheckout`** (`onRequest`, sem autenticação — mesmo nível de confiança do envio de inscrição, que também é anônimo): recebe `{championshipId, registrationId}`. Busca a inscrição (`championships/{championshipId}/registrations/{registrationId}`) e o campeonato; confirma `status === 'approved'` e `feeStatus !== 'paid'`; cria um checkout Asaas (`POST /v3/checkouts`) com `split: [{walletId: asaasWalletId, percentualValue: 92}]`, `externalReference: JSON.stringify({championshipId, registrationId})`; grava `feeCheckoutUrl` na inscrição; devolve `{checkoutUrl}`. Preço sempre lido do campeonato (`registrationFee`), nunca do cliente.

- **`registrationFeeWebhook`** (`onRequest`, autenticado pelo header `asaas-access-token` — reaproveita o mesmo secret `ASAAS_WEBHOOK_TOKEN` já usado pela `billingWebhook`): em `PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED`, lê `externalReference` (`{championshipId, registrationId}`), marca a inscrição correspondente `feeStatus: 'paid'`. Idempotente por `eventId`, em coleção própria (`registrationFeeWebhookEvents`) — separada da `billingWebhookEvents` das assinaturas, para não misturar os dois domínios.

**Frontend:**
- `src/pages/championship/tabs/config.js`: campos "Taxa de inscrição (R$)" e "Wallet ID Asaas" (com texto de ajuda: onde achar no painel Asaas).
- `src/pages/registration.js`: tela de confirmação do envio ganha um link "Acompanhar inscrição e pagamento →" para a nova página de status.
- `src/pages/registration-status.js` (novo): busca a inscrição pelo id, mostra status (pendente/aprovada/recusada) e, se aprovada e com taxa configurada e não paga, botão "Pagar inscrição (R$ X)" que chama `createRegistrationCheckout` e redireciona pro checkout.
- `src/pages/championship/tabs/registrations.js`: lista de inscrições do organizador ganha uma coluna/badge de status de pagamento nas aprovadas.

**`firestore.rules`**: a regra de `registrations/{registrationId}` (hoje `allow read, update, delete: if canManageChampionship();`) vira `allow get: if true;` (leitura de UM documento específico, por quem já tem o id/protocolo — mesmo modelo de confiança que um link de confirmação por e-mail) mais `allow list, update, delete: if canManageChampionship();` (continua exigindo ser o organizador pra listar todas ou alterar).

## Validação

- Sem taxa configurada (`registrationFee` vazio/zero): aprovação de inscrição funciona exatamente como hoje, sem nenhum botão de pagamento aparecendo.
- Com taxa configurada: aprovar uma inscrição não cobra nada sozinho — só libera o botão de pagamento pro time.
- Recusar uma inscrição nunca gera cobrança nem precisa de estorno.
- `createRegistrationCheckout` rejeita se a inscrição não estiver aprovada, ou já estiver paga, ou o campeonato não tiver `asaasWalletId` configurado.
- O split é sempre 92% pro Wallet ID do organizador — nunca lido de entrada do cliente.
- Uma inscrição só pode ser lida publicamente por id exato (`get`) — não dá pra listar todas as inscrições de um campeonato sem ser o organizador.
- `registrationFeeWebhook` é idempotente e não confunde eventos de taxa de inscrição com eventos de assinatura (coleções de idempotência separadas).
