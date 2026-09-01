# Billing em producao

O projeto aceita dois provedores de pagamento pelo Cloud Function `billingWebhook`.

## Segredos

Configure os segredos no Firebase Functions:

```bash
firebase functions:secrets:set ASAAS_WEBHOOK_TOKEN
firebase functions:secrets:set MERCADOPAGO_WEBHOOK_SECRET
firebase functions:secrets:set MERCADOPAGO_ACCESS_TOKEN
```

Depois publique a funcao:

```bash
firebase deploy --only functions:billingWebhook
```

## URLs

Use as URLs abaixo no painel de cada provedor:

```text
https://<regiao>-<projeto>.cloudfunctions.net/billingWebhook?provider=asaas
https://<regiao>-<projeto>.cloudfunctions.net/billingWebhook?provider=mercadopago
```

O endpoint aceita apenas `POST`, valida o segredo/assinatura, rejeita eventos sem identificador e usa idempotencia por evento.

## Metadados obrigatorios

O pagamento precisa carregar uma referencia JSON com `userId` e `planId`.

No Asaas, envie essa referencia em `externalReference`. No Mercado Pago, o evento deve incluir `metadata.userId` e `metadata.planId`; para notificacoes que tragam apenas o ID do pagamento, a integracao deve consultar a API do provedor antes de ativar o plano.

## Homologacao

1. Crie uma solicitacao para um usuario de teste.
2. Envie um evento aprovado e confirme `users/{uid}.billing.status == active`.
3. Reenvie o mesmo evento e confirme que ele nao duplica a ativacao.
4. Envie assinatura invalida e confirme HTTP 401.
5. Envie cancelamento/reembolso e confirme status `denied`.
6. Verifique `billingWebhookEvents/{eventId}` no Firestore.
