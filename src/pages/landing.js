import { navigate } from '../app/router-v2.js';
import { toggleTheme } from '../app/theme.js';
import { esc } from '../app/utils.ts';
import { PLAN_DEFINITIONS } from '../app/plans.js';
import { MODALITIES } from '../app/templates.js';
import { icon } from '../app/icons.js';

const features = [
  ['table', 'Tabelas automáticas', 'Classificação, saldo de gols e desempates sem trabalho manual.'],
  ['monitor', 'Placar eletrônico', 'Placar digital ao vivo, projetável em telão — igual estádio de verdade.'],
  ['link', 'Inscrições por link', 'Receba equipes e atletas em um formulário simples.'],
  ['ball', 'Jogos e súmulas', 'Registre placares, eventos, cartões e resultados.'],
  ['globe', 'Portal público', 'Tabela, artilharia e resultados que sua torcida acompanha em tempo real.'],
  ['star', 'Patrocinadores', 'Exponha marcas no portal público e mostre quem apoia o campeonato.'],
];

const modalityPreview = Object.values(MODALITIES).slice(0, 12).map((m) => m.label);
const modalityTotal = Object.keys(MODALITIES).length;

// Fonte de destaque só pra landing (visitante) — carregada sob demanda pra não pesar as
// páginas internas do app, que nunca usam esse visual.
function ensureLandingFont() {
  if (document.getElementById('landing-font')) {return;}
  const link = document.createElement('link');
  link.id = 'landing-font';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap';
  document.head.appendChild(link);
}

function priceHTML(plan) {
  return plan.price === 0 ? 'Grátis' : `R$ ${plan.price.toFixed(2).replace('.', ',')}<span>/mês</span>`;
}

function planCardHTML(id, plan) {
  const highlight = id === 'intermediarios' ? ' highlight' : '';
  return `<article class="card price-card${highlight}">${highlight ? '<span class="price-tag">Mais escolhido</span>' : ''}<h3>${esc(plan.name)}</h3><div class="price-value">${priceHTML(plan)}</div><p class="muted">Até ${plan.limits.maxAthletes === 9999 ? 'ilimitados' : plan.limits.maxAthletes} atletas por campeonato</p><button class="btn ${id === 'free' ? 'ghost' : 'primary'}" data-route="/register">Começar</button></article>`;
}

export function renderLanding(root) {
  ensureLandingFont();
  root.innerHTML = `<div class="landing"><div class="shell">
    <header class="topbar"><a class="logo" href="/" data-link>ARENA</a><div class="actions"><button class="btn ghost" data-theme>◐</button><button class="btn ghost" data-route="/tutorial">Tutorial</button><button class="btn ghost" data-route="/login">Entrar</button></div></header>
    <main>
    <section class="hero"><div><small>GESTÃO ESPORTIVA PROFISSIONAL</small><h1>Seu campeonato.<br><em>No nível de arena.</em></h1><p>Tabelas automáticas, inscrições online, súmulas digitais, placar eletrônico ao vivo e portal público — tudo em um só lugar, para mais de ${modalityTotal} modalidades.</p><div class="actions"><button class="btn primary" data-route="/register">Começar grátis</button><button class="btn ghost" data-route="/demo">Ver demonstração ao vivo</button></div><p class="no-card">Sem cartão de crédito · Pronto em minutos</p></div><div class="card score-card"><span class="live-badge"><span class="live-dot"></span>AO VIVO · 32' 2º TEMPO</span><h2>Aurora FC <em>3 × 1</em> Lobos do Vale</h2><p>Classificação atualizada automaticamente.</p></div></section>

    <section class="section modalities"><small>PRA QUALQUER MODALIDADE</small><h2>Do campo à quadra.<br><em>Você escolhe o esporte.</em></h2><div class="chip-row">${modalityPreview.map((label) => `<span class="chip">${esc(label)}</span>`).join('')}<span class="chip chip-more">+${modalityTotal - modalityPreview.length} modalidades</span></div></section>

    <section class="section"><small>TUDO QUE VOCÊ PRECISA</small><h2>Menos planilha.<br><em>Mais campeonato.</em></h2><div class="grid feature-grid">${features.map(([iconName, title, text]) => `<article class="card feature-card"><div class="feature-icon">${icon(iconName, 26)}</div><h3>${title}</h3><p class="muted">${text}</p></article>`).join('')}</div></section>

    <section class="section"><small>PREÇOS</small><h2>Um plano <em>pro tamanho do seu campeonato.</em></h2><div class="grid price-grid">${Object.entries(PLAN_DEFINITIONS).map(([id, plan]) => planCardHTML(id, plan)).join('')}</div></section>

    <section class="section"><div class="card cta-banner"><h2>Seu próximo campeonato <em>começa aqui.</em></h2><button class="btn primary" data-route="/register">Criar minha conta</button><p class="no-card">Grátis pra sempre no plano inicial.</p></div></section>
    </main>
    <footer>ARENA · Gestão de campeonatos feita para quem faz o esporte acontecer.</footer></div></div>`;
  bind(root);
}

function bind(root) { root.querySelectorAll('[data-route]').forEach(b => b.onclick = () => navigate(b.dataset.route)); root.querySelector('[data-theme]').onclick = toggleTheme; }
