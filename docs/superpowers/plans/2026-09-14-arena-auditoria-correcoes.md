# Arena Audit Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir, testar e documentar os problemas que podem ser resolvidos diretamente no repositório após a auditoria do Arena.

**Architecture:** Melhorar a verificação de rotas sem alterar o roteador, adicionando uma fonte única de rotas e testes que validem a tabela declarativa. Fortalecer operações de inscrição e diretório com consultas limitadas/pagináveis, mantendo as regras Firebase como autoridade final. Limpar warnings de lint apenas quando a remoção for comportamentalmente neutra.

**Tech Stack:** Vite, JavaScript ES modules, Vitest, Firebase Firestore, ESLint, Node.js.

## Global Constraints

- Não alterar dados externos nem exigir credenciais de produção.
- Não modificar arquivos não relacionados já presentes no workspace.
- Toda mudança de comportamento terá teste escrito antes da implementação.
- Pagamentos e Firebase real permanecerão documentados como validação manual pendente.

### Task 1: Fortalecer verificação automatizada de rotas

**Files:**
- Create: `src/app/routes.js`
- Modify: `src/app/main.js`
- Create: `src/app/routes.test.js`
- Modify: `scripts/verify-routes.mjs`

- [x] Escrever teste que valide todas as 25 entradas e parâmetros nomeados.
- [x] Executar teste e confirmar falha antes da implementação.
- [x] Extrair a tabela declarativa de rotas para `routes.js` sem duplicar handlers.
- [x] Atualizar o verificador para importar a tabela e rejeitar rota ausente ou parâmetro inválido.
- [x] Executar teste e verificador.

### Task 2: Reduzir risco de inscrições duplicadas e leituras sem limite

**Files:**
- Create: `src/services/registrations.test.js`
- Modify: `src/services/registrations.js`

- [x] Escrever teste para normalização e construção determinística da chave de inscrição.
- [x] Executar teste e confirmar falha.
- [x] Centralizar a chave determinística e proteger novas submissões com transação Firestore.
- [x] Manter a verificação de registros legados antes da barreira atômica.
- [x] Executar os testes do serviço e a suíte completa.

### Task 3: Paginação segura do diretório público

**Files:**
- Create: `src/services/championships.test.js`
- Modify: `src/services/championships.js`

- [x] Escrever teste para o formato estável de página e cursor.
- [x] Executar teste e confirmar falha.
- [x] Implementar `listPublicDirectoryPage({ pageSize, cursor })` mantendo `listPublicDirectory()` compatível.
- [x] Retornar `items` e `nextCursor` de forma estável.
- [x] Conectar a primeira página e o botão "Carregar mais" à API paginada.
- [x] Executar teste, lint e build.

### Task 4: Corrigir warnings de lint sem mudança funcional

**Files:**
- Modify: arquivos indicados pelo ESLint em `src/`

- [x] Reexecutar lint e classificar cada warning como remoção segura ou caso que exige análise.
- [x] Remover somente imports, parâmetros e variáveis realmente mortos.
- [x] Executar lint, typecheck e testes.

### Task 5: Validação final e relatório operacional

**Files:**
- Modify: `docs/superpowers/plans/2026-09-14-arena-auditoria-correcoes.md`

- [x] Executar build, testes frontend, testes Functions, lint, typecheck, verificação de rotas e smoke de produção local.
- [x] Registrar resultados e pendências externas.
- [x] Entregar passo a passo para Firebase staging, sandbox de pagamentos e E2E visual.
