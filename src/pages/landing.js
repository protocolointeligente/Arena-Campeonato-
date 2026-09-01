import { navigate } from '../app/router-v2.js';
import { toggleTheme } from '../app/theme.js';

const features = [
  ['🏆', 'Tabelas automáticas', 'Classificação, saldo de gols e desempates sem trabalho manual.'],
  ['📝', 'Inscrições por link', 'Receba equipes e atletas em um formulário simples.'],
  ['⚽', 'Jogos e súmulas', 'Registre placares, eventos, cartões e resultados.'],
];

export function renderLanding(root) {
  root.innerHTML = `<div class="shell">
    <header class="topbar"><a class="logo" href="/" data-link>ARENA</a><div class="actions"><button class="btn ghost" data-theme>◐</button><button class="btn ghost" data-route="/tutorial">Tutorial</button><button class="btn ghost" data-route="/login">Entrar</button></div></header>
    <main><section class="hero"><div><small>GESTÃO ESPORTIVA</small><h1>Organize campeonatos.<br><em>Encante sua torcida.</em></h1><p>Do primeiro cadastro ao resultado final: tabelas, inscrições, jogos e portal público em um só lugar.</p><div class="actions"><button class="btn primary" data-route="/register">Começar agora</button><button class="btn" data-route="/demo">Explorar demonstração</button></div></div><div class="card"><small>CAMPEONATO AO VIVO</small><h2>Aurora FC <em>3 × 1</em> Lobos do Vale</h2><p class="muted">Classificação atualizada automaticamente.</p></div></section>
    <section class="section"><small>TUDO QUE VOCÊ PRECISA</small><h2>Menos planilhas.<br><em>Mais campeonato.</em></h2><div class="grid">${features.map(([icon,title,text])=>`<article class="card"><div style="font-size:30px">${icon}</div><h3>${title}</h3><p class="muted">${text}</p></article>`).join('')}</div></section>
    <section class="section"><div class="card"><h2>Seu próximo campeonato <em>começa aqui.</em></h2><button class="btn primary" data-route="/register">Criar minha conta</button></div></section></main>
    <footer>ARENA · Gestão de campeonatos feita para quem faz o esporte acontecer.</footer></div>`;
  bind(root);
}

function bind(root) { root.querySelectorAll('[data-route]').forEach(b => b.onclick = () => navigate(b.dataset.route)); root.querySelector('[data-theme]').onclick = toggleTheme; }


