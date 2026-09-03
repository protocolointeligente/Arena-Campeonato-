import { navigate } from '../app/router-v2.js';
import { icon } from '../app/icons.js';
import { esc } from '../app/utils.ts';

// Mesmas capturas reais usadas na landing (scripts/capture-landing-screenshots.mjs) mais o
// roster de equipes (scripts/seed-demo-championship.mjs) — nenhuma interface inventada aqui
// também. O campeonato "Copa Aurora 2026" é permanente e público de verdade em /c/demo.
const TOUR = [
  ['/landing/dashboard.png', 'Painel do organizador', 'Progresso, próximos passos e engajamento do portal público num só lugar.'],
  ['/landing/equipes.png', 'Equipes', 'Cadastre times e elenco em poucos cliques.'],
  ['/landing/registrations.png', 'Inscrições online', 'O formulário que as equipes preenchem sozinhas, sem trabalho manual seu.'],
  ['/landing/sumula.png', 'Jogos e súmula digital', 'Lance placares, gols e cartões direto pelo celular ou notebook.'],
  ['/landing/standings.png', 'Tabela automática', 'Classificação, saldo e desempates recalculados a cada resultado.'],
  ['/landing/scoreboard.png', 'Placar eletrônico', 'Projete a partida ao vivo em qualquer TV, monitor ou telão.'],
  ['/landing/public-portal.png', 'Portal público', 'O que a torcida vê — confira ao vivo no botão acima.'],
];

export function renderDemo(root) {
  root.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/">ARENA</a><button class="btn ghost" data-back>← Voltar</button></header>
    <main class="section">
      <small class="muted">AMBIENTE DEMONSTRATIVO</small>
      <h1>Veja o Arena por dentro.</h1>
      <p class="muted" style="max-width:640px">Nada aqui é mockup: são telas reais do produto e um campeonato de demonstração publicado de verdade — abra o portal abaixo sem precisar de login.</p>

      <div class="card demo-live-card">
        <h2>Copa Aurora 2026</h2>
        <p class="muted">Portal público ao vivo — tabela, jogos e resultados reais, atualizados de verdade.</p>
        <button class="btn primary" data-open-live>Ver portal ao vivo →</button>
      </div>

      <h2 style="margin-top:40px">Cada funcionalidade, por dentro</h2>
      <div class="gallery-grid demo-tour-grid">
        ${TOUR.map(([src, title, text]) => `
          <div class="demo-tour-item">
            <button type="button" class="gallery-thumb" data-gallery-item data-src="${src}" data-alt="${esc(title)}"><img src="${src}" alt="${esc(title)}" loading="lazy"><span>${esc(title)}</span></button>
            <p class="muted">${esc(text)}</p>
          </div>
        `).join('')}
      </div>
      <dialog class="lightbox" data-lightbox>
        <button type="button" class="btn ghost lightbox-close" data-lightbox-close aria-label="Fechar">${icon('x', 18)}</button>
        <img data-lightbox-img alt="">
      </dialog>

      <div class="actions" style="margin-top:32px">
        <button class="btn primary" data-route="/register">Criar meu campeonato grátis</button>
      </div>
    </main>
  </div>`;

  root.querySelector('[data-back]').onclick = () => navigate('/');
  root.querySelectorAll('[data-route]').forEach((b) => { b.onclick = () => navigate(b.dataset.route); });
  root.querySelector('[data-open-live]').onclick = () => navigate('/c/demo');

  // Lightbox nativo (<dialog>) — mesmo padrão da galeria da landing (src/pages/landing.js),
  // duplicado em vez de extraído pra um helper comum pra não mexer num arquivo que já tem
  // edição concorrente em andamento.
  const lightbox = root.querySelector('[data-lightbox]');
  const lightboxImg = root.querySelector('[data-lightbox-img]');
  root.querySelectorAll('[data-gallery-item]').forEach((thumb) => {
    thumb.onclick = () => {
      lightboxImg.src = thumb.dataset.src;
      lightboxImg.alt = thumb.dataset.alt;
      lightbox.showModal();
    };
  });
  root.querySelector('[data-lightbox-close]')?.addEventListener('click', () => lightbox.close());
  lightbox?.addEventListener('click', (event) => { if (event.target === lightbox) {lightbox.close();} });
}
