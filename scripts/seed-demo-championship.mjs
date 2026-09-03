// One-time (re-runnable) setup: creates/refreshes the single permanent public demo
// championship the marketing site links to ("Ver demonstração" -> /c/demo). Not wired into
// npm test/CI — run manually against prod when the demo needs a refresh:
//   1) npm run dev -- --port 5183
//   2) node scripts/seed-demo-championship.mjs
// Credentials for the demo account are printed at the end — save them if you want to log
// back in and edit the demo championship by hand later.
import { chromium } from 'playwright-core';

const BASE_URL = process.env.ARENA_DEV_URL || 'http://localhost:5183';
const email = process.env.DEMO_EMAIL || `arena-demo-${Date.now()}@example.com`;
const password = process.env.DEMO_PASSWORD || 'senha123456demo';
const TEAMS = ['Aurora FC', 'Lobos do Vale', 'Estrela Azul', 'Fênix United'];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

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
const champId = page.url().split('/campeonatos/')[1];

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
await page.screenshot({ path: 'public/landing/equipes.png' });
console.log('captured: equipes');

await page.click('[data-tab="jogos"]');
await page.waitForSelector('[data-generate]');
await page.click('[data-generate]');
await page.waitForSelector('[data-score]', { timeout: 10000 });
const scoreInputs = page.locator('[data-score]');
await scoreInputs.nth(0).fill('3');
await scoreInputs.nth(0).dispatchEvent('change');
await scoreInputs.nth(1).fill('1');
await scoreInputs.nth(1).dispatchEvent('change');
await page.waitForTimeout(400);

// Deixa "em andamento" (não rascunho) e fixa a URL pública em /c/demo — permanente, o
// marketing site (landing.js / demo.js) referencia esse slug direto.
await page.click('[data-tab="config"]');
try {
  await page.waitForSelector('[data-status]', { timeout: 15000 });
} catch (error) {
  console.log('URL no momento da falha:', page.url());
  console.log('trecho do body:', (await page.locator('main').innerText().catch(() => '(sem main)')).slice(0, 500));
  await page.screenshot({ path: 'seed-debug-fail.png' });
  throw error;
}
await page.selectOption('[data-status]', 'andamento');
await page.fill('[data-public-slug]', 'demo');
await page.click('[data-save-config]');
await page.waitForTimeout(600);

console.log('\n=== Campeonato demo pronto ===');
console.log('id:', champId);
console.log('portal público: /c/demo');
console.log('conta (guarde se quiser editar depois manualmente):', email, password);

await browser.close();
