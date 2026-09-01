import { readFile } from 'node:fs/promises'

const rules = await readFile('firestore.rules', 'utf8')
const functionSource = await readFile('functions/index.js', 'utf8')
const checks = [
  ['regras negam acesso por padrao', /allow read, write: if false/],
  ['campeonato exige autenticacao', /match \/championships\/{championshipId}[\s\S]*?signedIn\(\)/],
  ['limite de plano no backend', /withinPlanLimits\(\)/],
  ['billing ativo imutavel pelo cliente', /request\.resource\.data\.billing == resource\.data\.billing/],
  ['webhook rejeita metodos diferentes de POST', /req\.method !== 'POST'/],
  ['webhook possui idempotencia', /billingWebhookEvents/],
  ['webhook valida segredo Asaas', /asaas-access-token/],
  ['webhook valida assinatura Mercado Pago', /x-signature/],
]

const failures = checks.filter(([, pattern]) => !pattern.test(`${rules}\n${functionSource}`))
for (const [label] of checks) console.log(`${failures.some(([failed]) => failed === label) ? 'FAIL' : 'PASS'} ${label}`)
if (failures.length) process.exit(1)
