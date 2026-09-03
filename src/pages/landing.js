import { navigate } from '../app/router-v2.js';
import { toggleTheme } from '../app/theme.js';
import { esc } from '../app/utils.ts';
import { PLAN_DEFINITIONS } from '../app/plans.js';
import { MODALITIES } from '../app/templates.js';
import { icon } from '../app/icons.js';

const modalityTotal = Object.keys(MODALITIES).length;

// Amostra deliberada (não as N primeiras do objeto) pra provar em 1 olhar que a plataforma
// não é só futebol — um ícone por família de esporte em vez de fotos de estoque, seguindo o
// mesmo sistema de ícones SVG já usado no resto do app (sem banco de imagens genérico).
const sportShowcase = [
  ['ball', 'Futebol & Futsal'],
  ['basketball', 'Basquete'],
  ['whistle', 'Vôlei, Handebol & Rugby'],
  ['racket', 'Tênis, Padel & Beach tennis'],
  ['medal', 'Lutas & Ginástica'],
  ['flag', 'Atletismo & Ciclismo'],
];

// Card 1 (inscrições) e os demais usam screenshot REAL do produto, capturado por
// scripts/capture-landing-screenshots.mjs — nenhuma interface inventada.
const features = [
  ['link', 'Inscrições online', 'Compartilhe um link e deixe equipes e atletas enviarem seus dados direto pro campeonato.', '/landing/registrations.png', 'Formulário de inscrição pública do Arena Campeonatos'],
  ['table', 'Tabelas automáticas', 'Classificação, pontos, saldo e critérios de desempate atualizados sozinhos.', '/landing/standings.png', 'Tabela de classificação automática no Arena Campeonatos'],
  ['ball', 'Jogos e súmula digital', 'Registre placares, eventos, cartões e dados da partida sem depender de papel.', '/landing/sumula.png', 'Súmula digital de uma rodada no Arena Campeonatos'],
  ['monitor', 'Placar eletrônico', 'Transforme qualquer TV, monitor ou telão em um placar esportivo controlado pelo Arena.', '/landing/scoreboard.png', 'Placar eletrônico ao vivo do Arena Campeonatos'],
  ['globe', 'Portal público', 'Torcida, atletas e equipes acompanham tabela, resultados e informações em qualquer dispositivo.', '/landing/public-portal.png', 'Portal público de um campeonato no Arena Campeonatos'],
  ['star', 'Patrocinadores', 'Dê visibilidade às marcas que apoiam o evento direto no portal do campeonato.', '/landing/dashboard.png', 'Painel do organizador do Arena Campeonatos'],
];

const PROBLEMS = [
  'Equipes enviando dados pelo WhatsApp',
  'Planilhas diferentes pra cada coisa',
  'Tabela atualizada manualmente',
  'Erros de classificação',
  'Documentos espalhados',
  'Súmulas em papel',
  'Dificuldade de divulgar resultados',
  'Patrocinadores sem exposição',
  'Torcida perguntando resultado toda hora',
];

const SOLUTIONS = [
  'Inscrições centralizadas',
  'Participantes organizados',
  'Classificação automática',
  'Jogos programados',
  'Súmulas digitais',
  'Portal público',
  'QR Code e links de acesso',
  'Placar eletrônico',
  'Comunicação centralizada',
];

const FORMATS = [
  ['Liga', 'Todo mundo joga contra todo mundo — pontos corridos clássicos.', () => `<div class="format-diagram format-diagram-liga">${'<span></span>'.repeat(4)}</div>`],
  ['Grupos', 'Divida em chaves e classifique os melhores de cada uma.', () => `<div class="format-diagram format-diagram-grupos">${['A', 'B', 'C', 'D'].map((l) => `<span>${l}</span>`).join('')}</div>`],
  ['Mata-mata', 'Chaveamento eliminatório até a grande final.', () => `<div class="format-diagram format-diagram-mata">${icon('bracket', 22)}<span>Quartas</span>${icon('flag', 14)}<span>Semis</span>${icon('flag', 14)}<span>Final</span></div>`],
  ['Ranking', 'Classificação individual por pontuação ou tempo.', () => `<div class="format-diagram format-diagram-ranking">${icon('medal', 22)}<span>1º · 2º · 3º</span></div>`],
];

const SCOREBOARD_TAGS = ['AO VIVO', 'CRONÔMETRO', 'PLACAR', 'PERÍODO / SET', 'EQUIPES', 'CONTROLE PELO ORGANIZADOR'];

const PORTAL_ITEMS = ['Tabela', 'Classificação', 'Jogos', 'Resultados', 'Elenco/equipes', 'Informações', 'Comunicados', 'Patrocinadores', 'Enquetes'];

const COMMS_CARDS = [
  ['megaphone', 'Comunicados', 'Publique avisos para equipes e torcida.'],
  ['inbox', 'Mensagens para equipes', 'Envie informações exclusivas para uma equipe.'],
  ['clipboard', 'Enquetes', 'Crie perguntas para participantes e público.'],
  ['link', 'QR Code e links', 'Compartilhe acessos rapidamente.'],
];

// Sem foto real de cada público (nenhum banco de imagens disponível) e sem depoimento —
// mesmo ícone SVG usado no resto da página, um por card.
const AUDIENCES = [
  ['trophy', 'Organizadores de campeonatos', 'Quem organiza copas e ligas amadoras sem perder tempo com planilha.'],
  ['layers', 'Ligas esportivas', 'Vários campeonatos, categorias e temporadas numa gestão só.'],
  ['flag', 'Prefeituras e secretarias de esporte', 'Jogos públicos organizados com transparência pro cidadão.'],
  ['shield', 'Federações', 'Estrutura profissional pra competições oficiais.'],
  ['users', 'Escolas e universidades', 'Jogos internos e interclasses sem dor de cabeça.'],
  ['shieldCheck', 'Clubes e associações', 'Times e categorias de base, tudo num só lugar.'],
  ['star', 'Empresas e eventos corporativos', 'Campeonatos internos que fortalecem times de verdade.'],
  ['zap', 'Organizadores independentes', 'Comece sozinho, sem estrutura fixa e sem custo inicial.'],
];

// As mesmas 6 capturas reais usadas nos cards de funcionalidades, reaproveitadas como galeria
// em vez de duplicar o pipeline de screenshot.
const GALLERY = [
  ['/landing/dashboard.png', 'Painel do organizador'],
  ['/landing/registrations.png', 'Formulário de inscrição'],
  ['/landing/standings.png', 'Tabela de classificação'],
  ['/landing/sumula.png', 'Jogos e súmula digital'],
  ['/landing/scoreboard.png', 'Placar eletrônico'],
  ['/landing/public-portal.png', 'Portal público'],
];

const HOW_IT_WORKS = [
  'Crie sua conta',
  'Escolha a modalidade',
  'Configure o formato',
  'Cadastre ou convide participantes',
  'Gere jogos e fases',
  'Publique o campeonato',
  'Atualize resultados',
  'Finalize e compartilhe os campeões',
];

// Cada linha lê o dado real de PLAN_DEFINITIONS — nenhum limite é reescrito à mão aqui, então
// a tabela nunca diverge do que os planos realmente oferecem.
const COMPARE_ROWS = [
  ['Campeonatos', (p) => (p.limits.maxChampionships >= 999 ? 'Ilimitados' : p.limits.maxChampionships)],
  ['Times por campeonato', (p) => p.limits.maxTeams],
  ['Atletas por campeonato', (p) => (p.limits.maxAthletes >= 9999 ? 'Ilimitados' : p.limits.maxAthletes)],
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

const FAQ_ITEMS = [
  ['O Arena funciona só para futebol?', 'Não. O Arena foi feito pra futebol, futsal, vôlei, basquete, tênis, beach tennis, lutas, corrida e dezenas de outras modalidades — o formato de disputa se adapta a cada uma.'],
  ['Quais modalidades são suportadas?', `Mais de ${modalityTotal} modalidades configuradas, de esportes coletivos a lutas, raquetes e endurance. Veja a lista completa na seção "Modalidades" acima.`],
  ['Preciso instalar algum programa?', 'Não. O Arena roda direto no navegador, no computador ou no celular — sem instalação.'],
  ['Posso usar pelo celular?', 'Sim. O painel do organizador e o portal público funcionam em qualquer smartphone.'],
  ['Consigo compartilhar meu campeonato com o público?', 'Sim. Todo campeonato ganha um portal público com tabela, jogos e resultados em tempo real, pronto pra compartilhar por link.'],
  ['As equipes conseguem se inscrever sozinhas?', 'Sim. Você compartilha um link de inscrição e as equipes enviam os dados direto pelo formulário público.'],
  ['O Arena gera a classificação automaticamente?', 'Sim. Pontos, saldo, vitórias e critérios de desempate são recalculados automaticamente a cada resultado lançado.'],
  ['Existe súmula digital?', 'Sim. Placares, eventos, cartões e dados da partida ficam registrados na súmula digital de cada jogo.'],
  ['Posso usar um telão como placar?', 'Sim. O placar eletrônico do Arena pode ser projetado em qualquer TV, monitor ou telão.'],
  ['Consigo inserir patrocinadores?', 'Sim — a partir do plano Intermediários você pode exibir patrocinadores no portal público do campeonato.'],
  ['Existe plano grátis?', 'Sim, o plano Grátis é permanente e não pede cartão de crédito.'],
  ['Posso mudar de plano depois?', 'Sim, você pode evoluir de plano a qualquer momento conforme sua competição cresce.'],
];

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
  return `<article class="card price-card${highlight}">${highlight ? '<span class="price-tag">Mais escolhido</span>' : ''}<h3>${esc(plan.name)}</h3><div class="price-value">${priceHTML(plan)}</div><p class="muted">Até ${plan.limits.maxAthletes >= 9999 ? 'ilimitados' : plan.limits.maxAthletes} atletas por campeonato</p><button class="btn ${id === 'free' ? 'ghost' : 'primary'}" data-route="/register">${id === 'free' ? 'Selecionar' : 'Assinar'}</button></article>`;
}

function compareTableHTML() {
  const plans = Object.values(PLAN_DEFINITIONS);
  const head = `<th scope="col">Recurso</th>${plans.map((p) => `<th scope="col">${esc(p.name)}</th>`).join('')}`;
  const body = COMPARE_ROWS.map(([label, getValue]) => {
    const cells = plans.map((p) => {
      const value = getValue(p);
      const cell = typeof value === 'boolean' ? icon(value ? 'checkCircle' : 'x', 16) : esc(String(value));
      return `<td>${cell}</td>`;
    }).join('');
    return `<tr><th scope="row">${esc(label)}</th>${cells}</tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="plan-compare"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function faqJSONLD() {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map(([question, answer]) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  });
}

export function renderLanding(root) {
  ensureLandingFont();
  root.innerHTML = `<div class="landing">
    <header class="landing-nav" data-header>
      <div class="shell landing-nav-inner">
        <a class="logo" href="/" data-link><img src="/brand/arena-icon.png" alt="" width="28" height="28">ARENA</a>
        <nav class="landing-nav-links" aria-label="Seções da página">
          <a href="#recursos">Recursos</a>
          <a href="#modalidades">Modalidades</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#para-quem">Para quem</a>
          <a href="#planos">Planos</a>
        </nav>
        <div class="landing-nav-actions">
          <button class="btn ghost icon-only" data-theme aria-label="Alternar tema">${icon('sun', 18)}</button>
          <button class="btn ghost" data-route="/login">Entrar</button>
          <button class="btn primary" data-route="/register">CRIAR CAMPEONATO GRÁTIS</button>
        </div>
        <details class="landing-nav-mobile">
          <summary aria-label="Abrir menu">${icon('sliders', 20)}</summary>
          <div class="landing-nav-mobile-menu">
            <a href="#recursos">Recursos</a>
            <a href="#modalidades">Modalidades</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#para-quem">Para quem</a>
            <a href="#planos">Planos</a>
            <button class="btn ghost" data-route="/login">Entrar</button>
            <button class="btn primary" data-route="/register">CRIAR CAMPEONATO GRÁTIS</button>
          </div>
        </details>
      </div>
    </header>
    <div data-header-sentinel></div>
    <div class="shell">
    <main>
    <section class="hero">
      <div>
        <small>GESTÃO MULTIESPORTIVA DE CAMPEONATOS</small>
        <h1>Todos os seus campeonatos.<br><em>Em uma única Arena.</em></h1>
        <p>Crie, organize e publique competições profissionais com inscrições online, tabelas automáticas, súmulas digitais, placar eletrônico e portal público.</p>
        <p class="hero-sports muted">Futebol • Futsal • Vôlei • Basquete • Handebol • Beach Tennis • Tênis • Lutas • Corrida • Natação • e muito mais.</p>
        <div class="actions">
          <button class="btn primary" data-route="/register">CRIAR CAMPEONATO GRÁTIS</button>
          <button class="btn ghost" data-route="/demo">VER DEMONSTRAÇÃO</button>
        </div>
        <p class="no-card">Comece gratuitamente • Sem cartão de crédito</p>
      </div>
      <div class="hero-visual">
        <div class="device-frame device-frame-notebook">
          <img src="/landing/dashboard.png" alt="Painel do organizador do Arena Campeonatos" loading="eager" fetchpriority="high">
        </div>
        <div class="card score-card floating-score">
          <span class="live-badge"><span class="live-dot"></span>AO VIVO · 32' 2º TEMPO</span>
          <h2>Aurora FC <em>3 × 1</em> Lobos do Vale</h2>
          <p>Classificação atualizada automaticamente.</p>
        </div>
      </div>
    </section>

    <section class="section modalities" id="modalidades">
      <small>UMA ARENA PARA CADA ESPORTE</small>
      <h2>Do campo à quadra.<br><em>Você escolhe o esporte.</em></h2>
      <div class="sport-grid">
        ${sportShowcase.map(([iconName, label]) => `<div class="sport-chip"><div class="sport-chip-icon">${icon(iconName, 24)}</div><span>${esc(label)}</span></div>`).join('')}
        <div class="sport-chip sport-chip-more"><div class="sport-chip-icon">${icon('layers', 24)}</div><span>+${modalityTotal - sportShowcase.length} · dezenas de modalidades</span></div>
      </div>
    </section>

    <section class="section">
      <small>O PROBLEMA</small>
      <h2>Organizar campeonato não precisa virar uma planilha infinita.</h2>
      <div class="compare-grid">
        <div class="compare-col compare-problem">
          <h3>Sem o Arena</h3>
          <ul>${PROBLEMS.map((item) => `<li>${icon('x', 16)}<span>${esc(item)}</span></li>`).join('')}</ul>
        </div>
        <div class="compare-col compare-solution">
          <h3>Com o Arena</h3>
          <ul>${SOLUTIONS.map((item) => `<li>${icon('checkCircle', 16)}<span>${esc(item)}</span></li>`).join('')}</ul>
        </div>
      </div>
    </section>

    <section class="section" id="recursos">
      <small>DO PRIMEIRO INSCRITO À FINAL</small>
      <h2>Esqueça a planilha.<br><em>Entre em campo.</em></h2>
      <div class="grid feature-grid">
        ${features.map(([iconName, title, text, image, alt]) => `<article class="card feature-card"><img src="${image}" alt="${esc(alt)}" loading="lazy"><div class="feature-icon">${icon(iconName, 26)}</div><h3>${title}</h3><p class="muted">${text}</p></article>`).join('')}
      </div>
    </section>

    <section class="section">
      <small>FORMATOS</small>
      <h2>O formato é seu.<br><em>O Arena organiza.</em></h2>
      <div class="grid format-grid">
        ${FORMATS.map(([title, text, diagram]) => `<article class="card format-card"><h3>${esc(title)}</h3>${diagram()}<p class="muted">${esc(text)}</p></article>`).join('')}
      </div>
    </section>

    <section class="section section-dark" id="placar">
      <small>PLACAR ELETRÔNICO</small>
      <h2>Da tela do computador <em>direto pro telão.</em></h2>
      <p class="muted">Controle o placar pelo Arena e projete a partida em uma segunda tela, TV ou telão.</p>
      <div class="scoreboard-tags">${SCOREBOARD_TAGS.map((tag) => `<span class="tag-pill">${esc(tag)}</span>`).join('')}</div>
      <div class="device-frame device-frame-tv"><img src="/landing/scoreboard.png" alt="Placar eletrônico ao vivo do Arena Campeonatos projetado em telão" loading="lazy"></div>
    </section>

    <section class="section" id="portal">
      <small>PORTAL PÚBLICO</small>
      <h2>Seu campeonato também ganha <em>uma casa na internet.</em></h2>
      <div class="portal-layout">
        <ul class="check-list">${PORTAL_ITEMS.map((item) => `<li>${icon('checkCircle', 16)}<span>${esc(item)}</span></li>`).join('')}</ul>
        <div class="device-frame device-frame-notebook"><img src="/landing/public-portal.png" alt="Portal público de um campeonato no Arena Campeonatos" loading="lazy"></div>
      </div>
      <button class="btn ghost" data-route="/demo">Veja como o público acompanha</button>
    </section>

    <section class="section" id="comunicacao">
      <small>COMUNICAÇÃO</small>
      <h2>Informação certa <em>pra quem precisa.</em></h2>
      <div class="grid comm-grid">
        ${COMMS_CARDS.map(([iconName, title, text]) => `<article class="card comm-card"><div class="feature-icon">${icon(iconName, 26)}</div><h3>${esc(title)}</h3><p class="muted">${esc(text)}</p></article>`).join('')}
      </div>
    </section>

    <section class="section" id="patrocinadores">
      <small>PATROCINADORES</small>
      <h2>Seu patrocinador <em>merece aparecer.</em></h2>
      <p class="muted">Transforme a plataforma em mais um ativo comercial do campeonato.</p>
      <div class="sponsor-mock">
        <div class="sponsor-slot sponsor-slot-master">Patrocinador master</div>
        <div class="sponsor-slot">Apoio</div>
        <div class="sponsor-slot">Apoio</div>
        <div class="sponsor-slot">Apoio</div>
      </div>
      <p class="no-card center">Mais valor pra quem apoia. Mais possibilidades de receita pra quem organiza.</p>
    </section>

    <section class="section" id="para-quem">
      <small>PARA QUEM É</small>
      <h2>O Arena é pra <em>quem organiza de verdade.</em></h2>
      <div class="grid audience-grid">
        ${AUDIENCES.map(([iconName, title, text]) => `<article class="card audience-card"><div class="feature-icon">${icon(iconName, 24)}</div><h3>${esc(title)}</h3><p class="muted">${esc(text)}</p></article>`).join('')}
      </div>
    </section>

    <section class="section" id="como-funciona">
      <small>COMO FUNCIONA</small>
      <h2>Seu campeonato online <em>em poucos minutos.</em></h2>
      <ol class="timeline">
        ${HOW_IT_WORKS.map((title, i) => `<li class="timeline-step"><span class="timeline-number">${String(i + 1).padStart(2, '0')}</span><h3>${esc(title)}</h3></li>`).join('')}
      </ol>
    </section>

    <section class="section" id="galeria">
      <small>NA PRÁTICA</small>
      <h2>O Arena funcionando <em>na prática.</em></h2>
      <div class="gallery-grid">
        ${GALLERY.map(([src, alt]) => `<button type="button" class="gallery-thumb" data-gallery-item data-src="${src}" data-alt="${esc(alt)}"><img src="${src}" alt="${esc(alt)}" loading="lazy"><span>${esc(alt)}</span></button>`).join('')}
      </div>
      <dialog class="lightbox" data-lightbox>
        <button type="button" class="btn ghost lightbox-close" data-lightbox-close aria-label="Fechar">${icon('x', 18)}</button>
        <img data-lightbox-img alt="">
      </dialog>
    </section>

    <section class="section" id="planos">
      <div class="grid stats-grid">
        <div class="stat-tile"><strong>${modalityTotal}</strong><span>MODALIDADES CONFIGURADAS</span></div>
        <div class="stat-tile"><strong>100%</strong><span>ONLINE</span></div>
        <div class="stat-tile"><strong>1</strong><span>PLATAFORMA</span></div>
        <div class="stat-tile"><strong>0</strong><span>PLANILHAS NECESSÁRIAS</span></div>
      </div>
      <small>PREÇOS</small>
      <h2>Um plano <em>pro tamanho do seu campeonato.</em></h2>
      <div class="grid price-grid">${Object.entries(PLAN_DEFINITIONS).map(([id, plan]) => planCardHTML(id, plan)).join('')}</div>
      <p class="no-card center">Comece grátis e evolua conforme sua competição cresce.</p>
      ${compareTableHTML()}
    </section>

    <section class="section" id="faq">
      <small>DÚVIDAS</small>
      <h2>Perguntas <em>frequentes.</em></h2>
      <div class="faq-list">
        ${FAQ_ITEMS.map(([question, answer]) => `<details><summary>${esc(question)}</summary><p class="muted">${esc(answer)}</p></details>`).join('')}
      </div>
      <script type="application/ld+json">${faqJSONLD()}</script>
    </section>

    <section class="section"><div class="card cta-banner"><h2>Seu próximo campeonato <em>começa na Arena.</em></h2><p class="muted">Crie sua conta gratuitamente e organize sua competição com uma estrutura profissional desde o primeiro jogo.</p><div class="actions center"><button class="btn primary" data-route="/register">CRIAR CAMPEONATO GRÁTIS</button><button class="btn ghost" data-route="/demo">VER DEMONSTRAÇÃO</button></div></div></section>
    </main>
    <footer class="landing-footer">
      <div class="landing-footer-top">
        <img src="/brand/arena-logo.png" alt="Arena Campeonatos" class="footer-logo">
        <div class="footer-col"><h4>PRODUTO</h4><a href="#recursos">Recursos</a><a href="#modalidades">Modalidades</a><a href="#planos">Planos</a><button class="btn-link" data-route="/demo">Demonstração</button></div>
        <div class="footer-col"><h4>CONTA</h4><button class="btn-link" data-route="/register">Criar conta</button><button class="btn-link" data-route="/login">Entrar</button></div>
        <div class="footer-col"><h4>INSTITUCIONAL</h4><a href="#" aria-disabled="true">Termos</a><a href="#" aria-disabled="true">Privacidade</a><a href="#" aria-disabled="true">LGPD</a></div>
        <div class="footer-col"><h4>SUPORTE</h4><button class="btn-link" data-route="/tutorial">Tutorial</button></div>
      </div>
      <div class="landing-footer-bottom"><span>© Arena Campeonatos</span><span>Competição ao seu alcance.</span></div>
    </footer>
    </div></div>`;
  bind(root);
}

function bind(root) {
  root.querySelectorAll('[data-route]').forEach((b) => { b.onclick = () => navigate(b.dataset.route); });
  root.querySelector('[data-theme]').onclick = toggleTheme;

  // Fundo sólido no header só depois que o hero rola pra trás dele — observa um sentinel de
  // 1px logo abaixo do header em vez de escutar `scroll` a cada frame.
  const header = root.querySelector('[data-header]');
  const sentinel = root.querySelector('[data-header-sentinel]');
  if (header && sentinel && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => header.classList.toggle('is-scrolled', !entry.isIntersecting)).observe(sentinel);
  }

  // Menu mobile fecha sozinho ao navegar por uma âncora ou botão — <details> nativo não faz
  // isso por padrão.
  const mobileMenu = root.querySelector('.landing-nav-mobile');
  mobileMenu?.querySelectorAll('a, button').forEach((el) => el.addEventListener('click', () => { mobileMenu.open = false; }));

  // Lightbox da galeria — <dialog> nativo (Esc e clique no backdrop já vêm de graça),
  // um só reaproveitado pras 6 miniaturas em vez de um modal por imagem.
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
