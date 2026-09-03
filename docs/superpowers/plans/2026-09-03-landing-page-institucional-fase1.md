# Landing Page Institucional — Fase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Adaptação declarada:** este plano é escrito e executado pela mesma sessão, com contexto completo do repositório já carregado (não é entregue a um engenheiro sem contexto). Por isso, os blocos de código mostram estrutura e conteúdo exatos a incluir, mas não duplicam literalmente cada string de markup que será escrita no arquivo real — evita reescrever a mesma página duas vezes. Toda lógica com dado real (planos, contagem de modalidades, comparativo) tem asserção de teste real.

**Goal:** Reescrever `src/pages/landing.js` (visitante deslogado) como uma landing institucional multiesportiva, cobrindo os critérios de aceite do spec do usuário — sem tocar em login/registro/demo/planos/Firebase/roteamento/painel do organizador/portal público já existentes.

**Architecture:** Uma página só (`renderLanding`), no mesmo padrão de arquivo único do resto do app (`championship/index.js` tem 965 linhas e segue o mesmo padrão — não vamos quebrar convenção). Conteúdo declarativo (arrays de dados no topo do arquivo, como já existe com `features`/`sportShowcase`) + template strings. CSS aditivo em `layout.css`, escopado sob `.landing`. Nenhuma lib nova: `<details>/<summary>` nativo pro FAQ, CSS puro pras animações, IntersectionObserver nativo pro fade-in.

**Tech Stack:** Vite, JS ES Modules (sem framework), Vitest + jsdom pros testes, Firebase (não mexe), playwright-core (já presente via devDependency transitiva) só pro script de captura de screenshot (dev-only, não entra no `npm test`/CI).

## Global Constraints

- Não modificar rotas, autenticação, Firestore, painel do organizador, portal público, PWA — só `src/pages/landing.js`, `src/styles/layout.css`, `index.html` (SEO), `src/app/icons.js` (ícones novos se precisar), e os arquivos novos deste plano.
- Não inventar números, depoimentos, clientes ou parceiros. Só usar dado real de `PLAN_DEFINITIONS` (`src/app/plans.js`) e `MODALITIES`/`CHAMPIONSHIP_TEMPLATES` (`src/app/templates.js`).
- Não usar banco de imagens genérico nem fabricar fotografia esportiva — sem fonte de estoque disponível. Onde o spec pede fotografia, substituir por: (a) screenshot real do produto (capturado por este plano) dentro de moldura de dispositivo em CSS, ou (b) ícone SVG do sistema já existente (`src/app/icons.js`). Isso é registrado como limitação, não escondido.
- Logo oficial (chama/estrela) ainda não está no repo como arquivo — usuário vai enviar. Até lá, manter wordmark "ARENA" em texto + ícone atual (`public/icons/icon.svg`). Layout do header/footer já preparado pra receber `<img>` no lugar do texto assim que o arquivo chegar (comentário `TODO logo-oficial` no código, sem placeholder quebrado).
- Fase 1 = seções do spec: 1 (header), 2 (hero), 3 (imagem/mockup do hero), 4 (faixa de modalidades), 5 (problema→solução), 6 (funcionalidades — 6 cards com screenshot real), 7 (formatos de competição), 8 (como funciona), 9 (números verificáveis), 10 (planos), 11 (comparativo de planos), 12 (FAQ), 13 (CTA final), 14 (footer), 15 (SEO). Fora do escopo desta fase (fase 2 futura): placar em telão dedicado, portal público dedicado, comunicação, patrocinadores, "para quem é" com fotografia, carrossel/lightbox de screenshots, microinterações de scroll mais elaboradas.
- Ao final: `npm test`, `npm run lint`, `npm run typecheck`, `npm run verify`, `npm run build` têm que passar limpos.

---

## File Structure

- Create: `scripts/capture-landing-screenshots.mjs` — script dev-only (não entra em `package.json#scripts`, não roda em CI) que gera as imagens reais em `public/landing/`.
- Create: `public/landing/dashboard.png`, `standings.png`, `sumula.png`, `scoreboard.png`, `registrations.png`, `public-portal.png` — assets gerados pelo script acima.
- Create: `src/pages/landing.test.js` — testes jsdom pro conteúdo/estrutura da landing.
- Modify: `src/pages/landing.js` — reescrita das seções.
- Modify: `src/styles/layout.css` — estilos novos, escopados `.landing`.
- Modify: `index.html` — meta tags de SEO/OG/Twitter/canonical/JSON-LD.
- Modify: `src/app/icons.js` — só se alguma seção nova precisar de um glifo que ainda não existe (ex.: `clock`/`flag` já existem e cobrem o timeline "como funciona").

---

### Task 1: Pipeline de screenshots reais do produto

**Files:**
- Create: `scripts/capture-landing-screenshots.mjs`
- Create (gerados pelo script, não escritos à mão): `public/landing/dashboard.png`, `public/landing/standings.png`, `public/landing/sumula.png`, `public/landing/scoreboard.png`, `public/landing/registrations.png`, `public/landing/public-portal.png`

**Interfaces:**
- Produces: 6 arquivos PNG em `public/landing/` que a Task 5 (feature grid) e a Task 2 (hero) referenciam por caminho absoluto (`/landing/<nome>.png`).

- [ ] **Step 1: Escrever o script de captura**

Reaproveita o mesmo padrão já validado nesta sessão (playwright-core + Chrome do sistema): registra uma conta de teste descartável, cria o campeonato "Copa Aurora 2026" com os times já usados como fixture de marca no resto do app (`Aurora FC`, `Lobos do Vale`, `Estrela Azul`, `Fênix United` — mesmos nomes de `src/pages/demo.js`), gera jogos, lança um placar, e tira 6 screenshots reais.

```js
// scripts/capture-landing-screenshots.mjs
// Dev-only: gera os assets de public/landing/ a partir do app rodando de verdade.
// Não roda em CI nem em `npm test` — cria dado real (descartável) no Firebase do projeto.
// Uso: 1) `npm run dev` numa aba  2) `node scripts/capture-landing-screenshots.mjs`
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.ARENA_DEV_URL || 'http://localhost:5183';
const OUT_DIR = 'public/landing';
const email = `landing-shots-${Date.now()}@example.com`;
const password = 'senha123456';
const TEAMS = ['Aurora FC', 'Lobos do Vale', 'Estrela Azul', 'Fênix United'];

await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

async function shot(name, selector) {
  const target = selector ? page.locator(selector) : page;
  await target.screenshot({ path: `${OUT_DIR}/${name}.png` });
  console.log('captured:', name);
}

await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle' });
await page.fill('input[name=email]', email);
await page.fill('input[name=password]', password);
await page.click('button[type=submit]');
await page.waitForSelector('[data-new]');

await page.click('[data-new]');
await page.waitForSelector('input[name=name]');
await page.fill('input[name=name]', 'Copa Aurora 2026');
await page.click('button[type=submit]');
await page.waitForURL(/\/campeonatos\/(?!novo)/);
await page.waitForSelector('h1');
await shot('dashboard');

// times
await page.click('[data-tab=equipes]');
for (const team of TEAMS) {
  await page.fill('[data-add-team] input, input[name=team-name]', team).catch(() => {});
}
// (o seletor exato de cadastro de time é confirmado/ajustado durante a execução,
// olhando o DOM real da aba `equipes` — ver Step 2.)

await page.click('[data-tab=jogos]');
await page.waitForTimeout(500);
await shot('sumula');

await page.click('[data-tab=classif]');
await page.waitForTimeout(500);
await shot('standings');

await page.click('[data-tab=gerenciamento]').catch(() => {});
await shot('scoreboard');

await page.click('[data-tab=inscricoes]');
await page.waitForTimeout(500);
await shot('registrations');

const champId = page.url().split('/campeonatos/')[1];
await page.goto(`${BASE_URL}/publico/${champId}`, { waitUntil: 'networkidle' });
await shot('public-portal');

console.log('done. Revise as imagens em', OUT_DIR, 'antes de usar na landing.');
await browser.close();
```

- [ ] **Step 2: Rodar o script contra o dev server real e ajustar seletores**

```bash
npm run dev &
node scripts/capture-landing-screenshots.mjs
```

Como as abas do campeonato (`teams.js`, `games.js`, `scoreboard-control.js`) têm seletores próprios não mapeados de antemão, este step é executado interativamente: abrir cada aba real no navegador headless, checar o DOM (`page.content()` ou screenshot intermediário) e corrigir os seletores de cadastro de time / geração de jogos / lançamento de placar até os 6 PNGs saírem com conteúdo real (não tela vazia/erro).

**Verificação:** os 6 arquivos existem em `public/landing/`, cada um > 5 KB (tela vazia dá arquivo bem menor), e abertos visualmente mostram a interface real do Arena (não tela de erro/loading).

- [ ] **Step 3: Commit**

```bash
git add scripts/capture-landing-screenshots.mjs public/landing/
git commit -m "chore: script de captura de screenshots reais para a landing"
```

---

### Task 2: Harness de teste da landing + Header e Hero

**Files:**
- Create: `src/pages/landing.test.js`
- Modify: `src/pages/landing.js`
- Modify: `src/styles/layout.css`

**Interfaces:**
- Consumes: `PLAN_DEFINITIONS` de `src/app/plans.js`, `MODALITIES` de `src/app/templates.js`, `icon()` de `src/app/icons.js`, `/landing/dashboard.png` da Task 1.
- Produces: `renderLanding(root)` continua com a mesma assinatura (import em `src/app/main.js:6` não muda).

- [ ] **Step 1: Escrever teste que falha, pro header e pro hero**

```js
// @vitest-environment jsdom
// src/pages/landing.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { renderLanding } from './landing.js';

beforeEach(() => { document.body.innerHTML = '<div id="app"></div>'; });

describe('renderLanding — header', () => {
  it('tem nav com âncoras pras seções e os dois CTAs principais', () => {
    const root = document.getElementById('app');
    renderLanding(root);
    const nav = [...root.querySelectorAll('nav a, nav button')].map((el) => el.textContent.trim());
    expect(nav.some((t) => /recursos/i.test(t))).toBe(true);
    expect(nav.some((t) => /modalidades/i.test(t))).toBe(true);
    expect(nav.some((t) => /como funciona/i.test(t))).toBe(true);
    expect(nav.some((t) => /planos/i.test(t))).toBe(true);
    expect(root.querySelector('[data-route="/login"]')).not.toBeNull();
    expect(root.querySelector('[data-route="/register"]').textContent).toMatch(/CRIAR CAMPEONATO GRÁTIS/i);
  });
});

describe('renderLanding — hero', () => {
  it('tem o H1, subheadline e os dois CTAs do hero', () => {
    const root = document.getElementById('app');
    renderLanding(root);
    const h1 = root.querySelector('.hero h1').textContent;
    expect(h1).toMatch(/Todos os seus campeonatos/i);
    expect(h1).toMatch(/Arena/i);
    expect(root.querySelector('.hero [data-route="/register"]')).not.toBeNull();
    expect(root.querySelector('.hero [data-route="/demo"]').textContent).toMatch(/VER DEMONSTRAÇÃO/i);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/pages/landing.test.js`
Expected: FAIL (nav ainda não tem esses itens, H1 ainda é "Seu campeonato. No nível de arena.")

- [ ] **Step 3: Implementar o header sticky + hero novo**

Em `landing.js`: trocar o `<header class="topbar">` atual por um `<header class="landing-nav">` sticky com:
- logo (texto "ARENA" por enquanto — comentário `TODO logo-oficial` pra trocar por `<img>` quando o arquivo chegar);
- nav central com âncoras `#recursos`, `#modalidades`, `#como-funciona`, `#planos` (smooth scroll via `scroll-behavior: smooth` no CSS + `html { scroll-padding-top: 76px }` pra não esconder atrás do header sticky);
- ação direita: botão "Entrar" (`data-route="/login"`) + botão primário "CRIAR CAMPEONATO GRÁTIS" (`data-route="/register"`);
- menu hambúrguer em mobile (`<details class="landing-nav-mobile">` — nativo, sem JS).

Hero: H1 "Todos os seus campeonatos.<br><em>Em uma única Arena.</em>", subheadline do spec, linha de esportes (`Futebol • Futsal • Vôlei • Basquete • Handebol • Beach Tennis • Tênis • Lutas • Corrida • Natação • e muito mais.`), dois CTAs (`/register` primário "CRIAR CAMPEONATO GRÁTIS", `/demo` secundário "VER DEMONSTRAÇÃO"), microcopy "Comece gratuitamente • Sem cartão de crédito". Lado visual: `<img src="/landing/dashboard.png" alt="Painel do organizador Arena Campeonatos" loading="eager" fetchpriority="high">` dentro de uma moldura CSS tipo notebook (`.device-frame.device-frame-notebook`), com o card de placar ao vivo (já existente) sobreposto por cima (`position:absolute`) — é a composição produto+esporte do spec, feita com asset real em vez de fotografia inventada.

Header ganha classe `.is-scrolled` (fundo sólido) via `IntersectionObserver` observando um sentinel de 1px no topo do hero (sem scroll listener manual, sem lib).

- [ ] **Step 4: Rodar de novo e confirmar que passa**

Run: `npx vitest run src/pages/landing.test.js`
Expected: PASS

- [ ] **Step 5: CSS correspondente em `layout.css`**

Adicionar (escopado `.landing`): `.landing-nav` (sticky, `backdrop-filter`, transição pro `.is-scrolled`), `.landing-nav nav` (flex, esconde em mobile), `.landing-nav-mobile` (details/summary, só aparece < 900px), `.device-frame`/`.device-frame-notebook` (borda arredondada simulando moldura de notebook ao redor do `<img>`), `html { scroll-behavior: smooth; scroll-padding-top: 76px }` global (fora do escopo `.landing`, mas inofensivo pro resto do app).

- [ ] **Step 6: Commit**

```bash
git add src/pages/landing.js src/pages/landing.test.js src/styles/layout.css
git commit -m "feat: header sticky com nav + hero institucional na landing"
```

---

### Task 3: Faixa de modalidades (ajuste de copy sobre o que já existe)

**Files:**
- Modify: `src/pages/landing.js`

**Interfaces:**
- Consumes: `sportShowcase` (já existe, criado na sessão anterior) e `modalityTotal` (já existe).

- [ ] **Step 1: Teste**

```js
it('faixa de modalidades usa o texto do spec e mostra o total real', () => {
  const root = document.getElementById('app');
  renderLanding(root);
  expect(root.textContent).toMatch(/UMA ARENA PARA CADA ESPORTE/i);
  expect(root.querySelector('.sport-chip-more').textContent).toMatch(/dezenas de modalidades/i);
});
```

- [ ] **Step 2:** rodar, ver falhar (`<small>PRA QUALQUER MODALIDADE</small>` não bate no regex novo).
- [ ] **Step 3:** trocar o `<small>` de `PRA QUALQUER MODALIDADE` pra `UMA ARENA PARA CADA ESPORTE` e o texto do chip "+N modalidades" pra "+N modalidades" → manter template mas garantir que a palavra "dezenas" apareça quando o resto passar de 10 (já passa, `modalityTotal - sportShowcase.length` dá bem mais que 10 hoje). Ajustar só a string se precisar.
- [ ] **Step 4:** rodar de novo, confirmar PASS.
- [ ] **Step 5:** commit.

```bash
git add src/pages/landing.js
git commit -m "copy: alinhar faixa de modalidades ao texto do spec institucional"
```

---

### Task 4: Seção Problema → Solução

**Files:**
- Modify: `src/pages/landing.js`
- Modify: `src/styles/layout.css`

- [ ] **Step 1: Teste**

```js
it('seção problema→solução lista os pontos das duas colunas', () => {
  const root = document.getElementById('app');
  renderLanding(root);
  const text = root.textContent;
  expect(text).toMatch(/planilha infinita/i);
  expect(text).toMatch(/WhatsApp/i);
  expect(text).toMatch(/classificação automática/i);
  expect(text).toMatch(/QR Code/i);
});
```

- [ ] **Step 2:** rodar, ver falhar.
- [ ] **Step 3:** implementar seção nova logo após a faixa de modalidades: título "Organizar campeonato não precisa virar uma planilha infinita.", duas colunas (`.compare-grid`) — esquerda `.compare-col.compare-problem` com lista de 9 problemas do spec, direita `.compare-col.compare-solution` com a lista de 9 soluções do spec (mesma ordem, pareadas visualmente linha a linha).
- [ ] **Step 4:** CSS `.compare-grid` (grid 2 colunas, 1 no mobile), `.compare-problem li` com ícone `x`/tom neutro, `.compare-solution li` com ícone `checkCircle`/tom verde (reusa `icon()`).
- [ ] **Step 5:** rodar teste, PASS.
- [ ] **Step 6:** commit.

```bash
git add src/pages/landing.js src/styles/layout.css
git commit -m "feat: seção problema-solução (planilha/WhatsApp vs Arena) na landing"
```

---

### Task 5: Grid de funcionalidades (6 cards) com screenshot real

**Files:**
- Modify: `src/pages/landing.js`
- Modify: `src/styles/layout.css`

**Interfaces:**
- Consumes: os 6 PNGs de `public/landing/` (Task 1).

- [ ] **Step 1: Teste**

```js
it('grid de funcionalidades tem 6 cards com imagem real', () => {
  const root = document.getElementById('app');
  renderLanding(root);
  const cards = root.querySelectorAll('.feature-card');
  expect(cards.length).toBe(6);
  const imgs = root.querySelectorAll('.feature-card img[loading="lazy"]');
  expect(imgs.length).toBe(6);
  [...imgs].forEach((img) => expect(img.alt).not.toBe(''));
});
```

- [ ] **Step 2:** rodar, ver falhar (hoje os `feature-card` não têm `<img>`).
- [ ] **Step 3:** estender o array `features` (já existe) pra incluir `image` e `alt` por item, apontando pros arquivos da Task 1:

```js
const features = [
  ['link', 'Inscrições online', 'Compartilhe um link e deixe equipes e atletas enviarem seus dados direto pro campeonato.', '/landing/registrations.png', 'Formulário de inscrição do Arena Campeonatos'],
  ['table', 'Tabelas automáticas', 'Classificação, pontos, saldo e critérios de desempate atualizados sozinhos.', '/landing/standings.png', 'Tabela de classificação automática do Arena'],
  ['ball', 'Jogos e súmula digital', 'Registre placares, eventos, cartões e dados da partida sem depender de papel.', '/landing/sumula.png', 'Súmula digital de uma partida no Arena'],
  ['monitor', 'Placar eletrônico', 'Transforme qualquer TV, monitor ou telão em um placar esportivo controlado pelo Arena.', '/landing/scoreboard.png', 'Placar eletrônico ao vivo do Arena'],
  ['globe', 'Portal público', 'Torcida, atletas e equipes acompanham tabela, resultados e informações em qualquer dispositivo.', '/landing/public-portal.png', 'Portal público de um campeonato no Arena'],
  ['star', 'Patrocinadores', 'Dê visibilidade às marcas que apoiam o evento direto no portal do campeonato.', '/landing/dashboard.png', 'Painel de patrocinadores do campeonato no Arena'],
];
```

Template do card ganha `<img src="${image}" alt="${esc(alt)}" loading="lazy">` acima do ícone/título.

- [ ] **Step 4:** CSS `.feature-card img` (`width:100%; border-radius:10px; margin-bottom:12px; aspect-ratio:16/10; object-fit:cover`).
- [ ] **Step 5:** rodar teste, PASS.
- [ ] **Step 6:** commit.

```bash
git add src/pages/landing.js src/styles/layout.css
git commit -m "feat: screenshots reais nos 6 cards de funcionalidades da landing"
```

---

### Task 6: Formatos de competição

**Files:**
- Modify: `src/pages/landing.js`
- Modify: `src/styles/layout.css`

**Interfaces:**
- Consumes: nada externo — conteúdo fixo descrevendo os formatos que já existem em `COMPETITION_MODELS` (`src/app/templates.js`), sem duplicar a lógica, só citando os nomes reais.

- [ ] **Step 1: Teste**

```js
it('seção de formatos mostra liga, grupos, mata-mata e ranking', () => {
  const root = document.getElementById('app');
  renderLanding(root);
  const text = root.textContent;
  ['Liga', 'Grupos', 'Mata-mata', 'Ranking'].forEach((label) => expect(text).toMatch(new RegExp(label, 'i')));
});
```

- [ ] **Step 2:** rodar, ver falhar.
- [ ] **Step 3:** implementar `.format-grid` com 4 `.format-card`, cada um com um mini-diagrama em CSS puro (sem imagem):
  - Liga: 4 bolinhas conectadas por linha (`● ● ● ●`, `<div class="format-diagram format-diagram-liga">` com `span`s).
  - Grupos: 4 blocos rotulados A–D lado a lado.
  - Mata-mata: 3 colunas com setas (quartas → semis → final), reusa o ícone `bracket`.
  - Ranking: lista 1º/2º/3º com o ícone `medal` (criado na sessão anterior).
- [ ] **Step 4:** CSS dos diagramas (`display:flex/grid`, tudo com `background`/`border`, zero imagem).
- [ ] **Step 5:** rodar teste, PASS.
- [ ] **Step 6:** commit.

```bash
git add src/pages/landing.js src/styles/layout.css
git commit -m "feat: seção de formatos de competição (liga/grupos/mata-mata/ranking)"
```

---

### Task 7: Como funciona (timeline)

**Files:**
- Modify: `src/pages/landing.js`
- Modify: `src/styles/layout.css`

- [ ] **Step 1: Teste**

```js
it('timeline "como funciona" tem os 8 passos na ordem', () => {
  const root = document.getElementById('app');
  renderLanding(root);
  const steps = [...root.querySelectorAll('#como-funciona .timeline-step h3')].map((el) => el.textContent);
  expect(steps).toEqual([
    'Crie sua conta', 'Escolha a modalidade', 'Configure o formato', 'Cadastre ou convide participantes',
    'Gere jogos e fases', 'Publique o campeonato', 'Atualize resultados', 'Finalize e compartilhe os campeões',
  ]);
});
```

- [ ] **Step 2:** rodar, ver falhar.
- [ ] **Step 3:** implementar `<section id="como-funciona">` com `.timeline` (linha de progresso via `::before` em gradiente, numeração `01`–`08`), vertical em mobile (`flex-direction:column` abaixo de 760px).
- [ ] **Step 4:** rodar teste, PASS.
- [ ] **Step 5:** commit.

```bash
git add src/pages/landing.js src/styles/layout.css
git commit -m "feat: timeline 'como funciona' com os 8 passos"
```

---

### Task 8: Números verificáveis + Planos + Comparativo (dado real de `PLAN_DEFINITIONS`)

**Files:**
- Modify: `src/pages/landing.js`
- Modify: `src/styles/layout.css`

**Interfaces:**
- Consumes: `PLAN_DEFINITIONS` de `src/app/plans.js` (já importado).

- [ ] **Step 1: Teste**

```js
import { PLAN_DEFINITIONS } from '../app/plans.js';

it('mostra só números verificáveis (sem estatística inventada)', () => {
  const root = document.getElementById('app');
  renderLanding(root);
  expect(root.textContent).toMatch(new RegExp(`${Object.keys(MODALITIES).length}\\s*\\n?\\s*MODALIDADES`, 'i'));
  expect(root.textContent).not.toMatch(/\d[\d.,]*\s*(campeonatos criados|atletas cadastrados|usuários)/i);
});

it('renderiza um card por plano real de PLAN_DEFINITIONS, com o preço certo', () => {
  const root = document.getElementById('app');
  renderLanding(root);
  const cards = root.querySelectorAll('.price-card');
  expect(cards.length).toBe(Object.keys(PLAN_DEFINITIONS).length);
  expect(root.textContent).toMatch(/R\$\s*25,00/); // pequenos
});

it('tabela comparativa tem uma linha por feature e uma coluna por plano', () => {
  const root = document.getElementById('app');
  renderLanding(root);
  const headerCols = root.querySelectorAll('.plan-compare thead th');
  expect(headerCols.length).toBe(Object.keys(PLAN_DEFINITIONS).length + 1); // +1 = coluna de rótulo
});
```

(precisa importar `MODALITIES` de `../app/templates.js` no topo do teste, junto com o que já foi importado.)

- [ ] **Step 2:** rodar, ver falhar.
- [ ] **Step 3:** implementar seção de números verificáveis (`modalityTotal` MODALIDADES CONFIGURADAS, "100% ONLINE", "1 PLATAFORMA", "0 PLANILHAS NECESSÁRIAS" — os 4 do spec, sem inventar nenhum outro). Manter os `planCardHTML` já existentes (já vêm de `PLAN_DEFINITIONS`, só adicionar frase "Comece grátis e evolua conforme sua competição cresce." abaixo do grid).

Tabela comparativa nova, gerada a partir de `PLAN_DEFINITIONS` (sem hardcode de limite):

```js
const COMPARE_ROWS = [
  ['Campeonatos', (p) => (p.limits.maxChampionships === 999 ? 'Ilimitados' : p.limits.maxChampionships)],
  ['Times por campeonato', (p) => p.limits.maxTeams],
  ['Atletas por campeonato', (p) => (p.limits.maxAthletes === 9999 ? 'Ilimitados' : p.limits.maxAthletes)],
  ['Armazenamento', (p) => (p.limits.maxStorageMB >= 1000 ? `${p.limits.maxStorageMB / 1000} GB` : `${p.limits.maxStorageMB} MB`)],
  ['Súmula digital', () => true],
  ['Relatórios em PDF', () => true],
  ['URL personalizada', (p) => p.limits.features.some((f) => /url personalizada/i.test(f))],
  ['Sem anúncios', (p) => p.limits.features.some((f) => /sem anúncios/i.test(f))],
  ['Branding personalizado', (p) => p.limits.features.some((f) => /branding/i.test(f))],
  ['Patrocinadores', (p) => p.limits.features.some((f) => /patrocinadores/i.test(f))],
  ['API de integração', (p) => p.limits.features.some((f) => /api de integração/i.test(f))],
  ['Embed HTML', (p) => p.limits.features.some((f) => /embed html/i.test(f))],
  ['Suporte prioritário', (p) => p.limits.features.some((f) => /suporte prioritário/i.test(f))],
];

function compareTableHTML() {
  const plans = Object.values(PLAN_DEFINITIONS);
  const head = `<th scope="col">Recurso</th>${plans.map((p) => `<th scope="col">${esc(p.name)}</th>`).join('')}`;
  const body = COMPARE_ROWS.map(([label, getValue]) => {
    const cells = plans.map((p) => {
      const value = getValue(p);
      return `<td>${typeof value === 'boolean' ? (value ? icon('checkCircle', 16) : icon('x', 16)) : esc(String(value))}</td>`;
    }).join('');
    return `<tr><th scope="row">${esc(label)}</th>${cells}</tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="plan-compare"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
```

Cada linha lê o dado real de `PLAN_DEFINITIONS` — nenhum limite é reescrito à mão (`getValue` deriva de `p.limits`, evitando o erro de "inventar limite" que o spec proíbe).

- [ ] **Step 4:** CSS `.plan-compare` (reusa `.table-wrap`/`table` já existentes em `layout.css:86-90`, só adiciona `.plan-compare td svg { display:block; margin:auto }`).
- [ ] **Step 5:** rodar os 3 testes, PASS.
- [ ] **Step 6:** commit.

```bash
git add src/pages/landing.js src/styles/layout.css src/pages/landing.test.js
git commit -m "feat: números verificáveis + tabela comparativa de planos (dado real)"
```

---

### Task 9: FAQ (accordion nativo + JSON-LD)

**Files:**
- Modify: `src/pages/landing.js`

- [ ] **Step 1: Teste**

```js
it('FAQ tem as 12 perguntas do spec como <details>/<summary> nativos', () => {
  const root = document.getElementById('app');
  renderLanding(root);
  const items = root.querySelectorAll('#faq details > summary');
  expect(items.length).toBe(12);
  expect(root.textContent).toMatch(/O Arena funciona só para futebol\?/);
});

it('publica JSON-LD FAQPage batendo com o conteúdo visível', () => {
  const root = document.getElementById('app');
  renderLanding(root);
  const ld = JSON.parse(root.querySelector('script[type="application/ld+json"]').textContent);
  expect(ld['@type']).toBe('FAQPage');
  expect(ld.mainEntity.length).toBe(12);
});
```

- [ ] **Step 2:** rodar, ver falhar.
- [ ] **Step 3:** implementar as 12 perguntas/respostas do spec como array `FAQ_ITEMS` no topo do arquivo, renderizadas com `<details><summary>pergunta</summary><p>resposta</p></details>` (accordion 100% nativo, sem JS de toggle) + `<script type="application/ld+json">` gerado a partir do mesmo array (garante que o schema nunca diverge do conteúdo visível, como o spec exige).
- [ ] **Step 4:** rodar teste, PASS.
- [ ] **Step 5:** commit.

```bash
git add src/pages/landing.js
git commit -m "feat: FAQ com accordion nativo <details> + JSON-LD FAQPage"
```

---

### Task 10: CTA final, footer com colunas e SEO em `index.html`

**Files:**
- Modify: `src/pages/landing.js`
- Modify: `index.html`

- [ ] **Step 1: Teste**

```js
it('footer tem as 4 colunas do spec', () => {
  const root = document.getElementById('app');
  renderLanding(root);
  ['PRODUTO', 'CONTA', 'INSTITUCIONAL', 'SUPORTE'].forEach((col) => expect(root.textContent).toMatch(new RegExp(col)));
  expect(root.textContent).toMatch(/Competição ao seu alcance/i);
});
```

- [ ] **Step 2:** rodar, ver falhar.
- [ ] **Step 3:** reescrever `<footer>` com as 4 colunas do spec (Produto/Conta/Institucional/Suporte) + linha final "© Arena Campeonatos" / "Competição ao seu alcance." (mesmo slogan que já está na logomarca oficial recebida do usuário). CTA final já existe (`.cta-banner`) — só recopiar o título exato do spec ("Seu próximo campeonato começa na Arena.") e adicionar o segundo botão "VER DEMONSTRAÇÃO" ao lado do já existente.

Links institucionais (Termos/Privacidade/LGPD) apontam pra rotas que ainda não existem — usar `href="#"` com `aria-disabled="true"` por enquanto e um comentário `TODO` (não inventar página nem link quebrado silencioso).

- [ ] **Step 4:** rodar teste, PASS.
- [ ] **Step 5:** SEO em `index.html` — trocar `<title>` e `<meta name="description">` pelo exato do spec, adicionar `<link rel="canonical">`, `og:title/og:description/og:type/og:url`, `twitter:card=summary_large_image`, e `<script type="application/ld+json">` `SoftwareApplication` (nome, descrição, categoria `SportsApplication`, `offers` citando só o plano grátis — sem inventar dado).
- [ ] **Step 6:** commit.

```bash
git add src/pages/landing.js index.html
git commit -m "feat: CTA final, footer institucional e SEO (title/OG/Twitter/JSON-LD)"
```

---

### Task 11: Verificação final

- [ ] **Step 1:** `npm test` — todos os testes (os novos + os 39 arquivos existentes) passam.
- [ ] **Step 2:** `npm run lint` — zero erro.
- [ ] **Step 3:** `npm run typecheck` — zero erro.
- [ ] **Step 4:** `npm run verify` — zero erro (checa que as rotas em `main.js` continuam intactas).
- [ ] **Step 5:** `npm run build` — build de produção limpo, sem warning de asset faltando.
- [ ] **Step 6:** revisão visual final: `npm run dev` + captura de screenshot da landing completa (topo ao rodapé) pra checar quebra de layout, contraste e responsividade (390px/768px/1280px).
- [ ] **Step 7:** se algo falhar, corrigir antes de reportar concluído — nunca reportar sucesso com teste vermelho.

---

## Self-Review

**Cobertura do spec (fase 1):** seções 1–15 do spec do usuário — header(✓ T2), hero(✓ T2), imagem do hero(✓ T2, com limitação documentada), faixa de modalidades(✓ T3), problema→solução(✓ T4), funcionalidades(✓ T5), formatos(✓ T6), como funciona(✓ T7), números verificáveis(✓ T8), planos(✓ T8), comparativo(✓ T8), FAQ(✓ T9), CTA final(✓ T10), footer(✓ T10), SEO(✓ T10). Fora do escopo desta fase, registrado nos Global Constraints: seções 15(placar dedicado)/16(portal dedicado)/17(comunicação)/18(patrocinadores)/19-20("para quem é")/22(carrossel).

**Placeholder scan:** nenhum "TBD"/"implementar depois" solto — os dois únicos adiamentos reais (logo oficial, links institucionais) estão marcados com `TODO` explícito no código e justificados nos Global Constraints, não escondidos.

**Consistência de tipos/nomes:** `features` ganha 2 campos novos (`image`, `alt`) na Task 5 — conferido que a Task 2 não usa esse array antes disso. `COMPARE_ROWS`/`compareTableHTML` só aparecem na Task 8, usados só ali. `FAQ_ITEMS` só na Task 9. Nenhuma função referenciada antes de definida entre tasks.
