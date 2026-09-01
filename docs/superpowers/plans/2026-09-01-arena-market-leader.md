# Arena Market Leader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Tornar o Arena um gestor nacional de competicoes confiavel, seguro e superior ao Copa Facil nos fluxos de organizacao, operacao, publicacao e acompanhamento.

**Architecture:** Preservar o frontend Vite vanilla existente, consolidar os modulos de estado, regras de negocio e paginas atuais, e usar Firebase como backend. Cada fase sera fechada com testes automatizados e verificacao de build antes da seguinte.

**Tech Stack:** Vite, JavaScript/TypeScript, Vitest, Firebase Auth/Firestore/Storage, Zod, jsPDF.

## Global Constraints

- Nao desativar lint, typecheck ou testes para mascarar falhas.
- Toda correcao de comportamento deve ter teste de regressao.
- Regras de autorizacao devem ser aplicadas no Firebase, nao apenas no frontend.
- Manter compatibilidade com os dados existentes e evitar migracoes destrutivas.

## Fases

### P0 - Estabilidade e seguranca

- Corrigir sintaxe e contratos compartilhados.
- Corrigir todos os erros de lint sem apagar funcionalidades.
- Definir fronteira real do typecheck e tipar os modulos criticos.
- Adicionar validacao automatica das regras Firebase.
- Fechar build, testes, lint e typecheck como gates de CI.

### P1 - Operacao essencial

- Fechar criacao, categorias, equipes, atletas e inscricoes.
- Fechar fases, geracao de jogos, sumula, resultados, classificacao e artilharia.
- Fechar publicacao responsiva, exportacao PDF e compartilhamento.
- Adicionar testes de fluxo ponta a ponta dos cenarios principais.

### P2 - Diferenciais de produto

- Notificacoes, comunicados, enquetes e portal de equipes.
- Punicoes, suspensoes, estatisticas e partidas ao vivo.
- Convites por link/QR, templates e validacoes de conflitos.
- Branding, artes sociais e experiencia mobile/PWA.

### P3 - Producao e escala

- Billing idempotente e limites por plano.
- LGPD, backup/restauracao e auditoria imutavel.
- Observabilidade, performance, code splitting e offline operacional.
- Hardening final, acessibilidade e testes de carga.

## Gates de fase

Cada fase so avanca quando `npm test`, `npm run build`, `npm run lint`, `npm run typecheck` e as verificacoes especificas da fase estiverem verdes, ou quando uma limitacao residual estiver documentada e isolada sem risco funcional.
