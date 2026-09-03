// Dev-only: gera os assets de public/landing/ a partir do app rodando de verdade.
// Não roda em CI nem em `npm test` — cria dado real (descartável) no Firebase do projeto.
// Uso: 1) `npm run dev -- --port 5183`  2) `node scripts/capture-landing-screenshots.mjs`
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

// Conta descartável + primeiro campeonato
await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle' });
await page.fill('input[name=email]', email);
await page.fill('input[name=password]', password);
await page.click('button[type=submit]');
await page.waitForSelector('[data-new]');

await page.click('[data-new]');
await page.waitForSelector('input[name=name]');
await page.fill('input[name=name]', 'Copa Aurora 2026');
await page.click('button[type=submit]');
await page.waitForURL(/\/campeonatos\/(?!novo)/, { timeout: 15000 });
await page.waitForSelector('h1');
await page.waitForTimeout(400);
const champId = page.url().split('/campeonatos/')[1];
await shot('dashboard');

// Equipes — data-add-team só adiciona uma linha em branco (store.addTeam()), sem modal.
await page.click('[data-tab="equipes"]');
await page.waitForSelector('[data-add-team]');
for (const team of TEAMS) {
  await page.click('[data-add-team]');
  const inputs = page.locator('[data-team]');
  const last = inputs.nth((await inputs.count()) - 1);
  await last.fill(team);
  await last.dispatchEvent('change');
}
await page.click('[data-save-teams]');
await page.waitForTimeout(400);

// Jogos — "Gerar tabela" cria os confrontos; lança 1 placar pra parecer uma rodada real.
await page.click('[data-tab="jogos"]');
await page.waitForSelector('[data-generate]');
await page.click('[data-generate]');
await page.waitForSelector('[data-score]', { timeout: 10000 });
const firstScoreInputs = page.locator('[data-score]');
await firstScoreInputs.nth(0).fill('3');
await firstScoreInputs.nth(0).dispatchEvent('change');
await firstScoreInputs.nth(1).fill('1');
await firstScoreInputs.nth(1).dispatchEvent('change');
await page.waitForTimeout(400);
const scoreboardTarget = await page.locator('[data-open-scoreboard]').first().getAttribute('data-open-scoreboard');
const matchId = scoreboardTarget.split(':')[1];
await shot('sumula');

// Tabela de classificação
await page.click('[data-tab="classif"]');
await page.waitForSelector('table', { timeout: 10000 });
await page.waitForTimeout(300);
await shot('standings');

// Inscrições — o spec pede o FORMULÁRIO público (o que uma equipe vê), não a lista vazia do
// organizador (que ainda não recebeu nenhuma inscrição real nesta conta de teste).
await page.goto(`${BASE_URL}/inscrever/${champId}`, { waitUntil: 'load' });
await page.waitForSelector('input[name=teamName]', { timeout: 15000 });
await page.waitForTimeout(300);
await shot('registrations');

// Placar eletrônico — a tela de telão de verdade (rota pública), não o painel de controle.
// `networkidle` nunca resolve aqui: a página mantém um onSnapshot (websocket) aberto o tempo
// todo, então troca-se por esperar o elemento real renderizar.
await page.goto(`${BASE_URL}/placar/${champId}/${matchId}?kind=match`, { waitUntil: 'load' });
// `.scoreboard-display` já existe no placeholder "Carregando placar..." — espera o time
// real pintar (só aparece depois que o onSnapshot autenticado resolve, o que numa navegação
// cheia de página pode levar mais que os 500ms de folga dos outros passos).
await page.waitForSelector('.scoreboard-display .team-name', { timeout: 15000 });
await page.waitForTimeout(300);
await shot('scoreboard');

// Portal público do campeonato — mesmo motivo, troca `networkidle` por um seletor real.
await page.goto(`${BASE_URL}/publico/${champId}`, { waitUntil: 'load' });
await page.waitForSelector('.public-hero, .public-grid, h1', { timeout: 15000 });
await page.waitForTimeout(500);
await shot('public-portal');

console.log('done. Revise as imagens em', OUT_DIR, 'antes de usar na landing.');
await browser.close();
