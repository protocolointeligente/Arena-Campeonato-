import '../styles/tokens.css';
import '../styles/layout.css';
import { route, navigate, start, notFound } from './router-v2.js';
import { applyTheme } from './theme.js';
import { ensureUiRoot } from './ui.js';
import { renderLanding } from '../pages/landing.js';
import { renderDemo } from '../pages/demo.js';
import { renderAuth } from '../pages/auth.js';
import { renderTutorial } from '../pages/tutorial.js';
import { observeAuth } from '../services/firebase.js';
import { renderHome } from '../pages/home.js';
import { renderNewChampionship } from '../pages/new-championship.js';
import { renderChampionshipsDirectory } from '../pages/championships-directory.js';
import { renderChampionship } from '../pages/championship/index.js';
import { renderPlans } from '../pages/plans.js';
import { renderPublicChampionship, renderTeamPortal, renderPublicChampionshipBySlug, renderEmbedWidget } from '../pages/public-championship.js';
import { renderRegistration } from '../pages/registration.js';
import { renderSuperadmin } from '../pages/superadmin.js';
import { renderLegal } from '../pages/legal.js';
import { renderAuditCenter } from '../pages/audit-center.js';
import { renderSecurityCenter } from '../pages/security-center.js';
import { renderPrivacyCenter } from '../pages/privacy-center.js';
import { renderBetaHardening } from '../pages/beta-hardening.js';
import { renderPlansBilling } from '../pages/plans-billing.js';
import { renderPublication } from '../pages/publication.js';
import { renderScoreboardDisplay } from '../pages/scoreboard-display.js';
import { renderDrawDisplay } from '../pages/draw-display.js';
import { renderRegistrationStatus } from '../pages/registration-status.js';
import { setUser, getAppState } from './store.js';
import { ErrorBoundary, setupGlobalErrorHandlers } from '../components/ErrorBoundary.js';
import { getErrorLogger } from '../services/error-logger.js';
import { ROUTE_DEFINITIONS } from './routes.js';
import { rememberLoginRedirect, takeLoginRedirect } from './login-redirect.js';
import { watchForUpdates } from './update-check.js';

const root = document.querySelector('#app');
applyTheme();
ensureUiRoot();

// Initialize error boundary
const errorBoundary = new ErrorBoundary({
  onError: (error, info) => {
    console.error('[Global Error]', error, info);
  },
  logErrors: true,
});

// Setup global error handlers
setupGlobalErrorHandlers(errorBoundary);

// Initialize error logger
getErrorLogger({
  endpoint: import.meta.env?.VITE_ERROR_ENDPOINT || null,
  onAlert: (alert) => console.warn('[Observability]', alert.type, alert.count),
});

// Add main landmark and content id for skip link
root.innerHTML = '<main id="main-content" role="main"></main>';
const mainContent = root.querySelector('#main-content');

// Wrap route handlers with error boundary
const safeRoute = (handler) => (params) => {
  try {
    mainContent.__publicUnsubscribe?.();
    mainContent.__publicUnsubscribe = null;
    handler(params);
  } catch (error) {
    errorBoundary.handleError(error, { route: window.location.pathname });
  }
};

if (ROUTE_DEFINITIONS.length !== 27) {
  throw new Error(`Tabela de rotas incompleta: esperadas 27, encontradas ${ROUTE_DEFINITIONS.length}`);
}

const registerRoute = (pattern, handler) => {
  if (!ROUTE_DEFINITIONS.some((definition) => definition.pattern === pattern)) {
    throw new Error(`Rota não declarada na tabela: ${pattern}`);
  }
  route(pattern, handler);
};

registerRoute('/', safeRoute(() => (getAppState().user ? renderHome(mainContent) : renderLanding(mainContent))));
registerRoute('/login', safeRoute(() => renderAuth(mainContent, 'login')));
registerRoute('/register', safeRoute(() => renderAuth(mainContent, 'register')));
registerRoute('/tutorial', safeRoute(() => renderTutorial(mainContent)));
registerRoute('/demo', safeRoute(() => renderDemo(mainContent)));
registerRoute('/campeonatos/novo', safeRoute(() => renderNewChampionship(mainContent)));
registerRoute('/campeonatos', safeRoute(() => renderChampionshipsDirectory(mainContent)));
registerRoute('/planos', safeRoute(() => renderPlans(mainContent)));
registerRoute('/superadmin', safeRoute(() => renderSuperadmin(mainContent)));
registerRoute('/publicacao', safeRoute(() => renderLanding(mainContent)));
registerRoute('/superadmin/auditoria', safeRoute(() => renderAuditCenter(mainContent)));
registerRoute('/superadmin/seguranca', safeRoute(() => renderSecurityCenter(mainContent)));
registerRoute('/superadmin/privacidade', safeRoute(() => renderPrivacyCenter(mainContent)));
registerRoute('/superadmin/beta', safeRoute(() => renderBetaHardening(mainContent)));
registerRoute('/superadmin/planos', safeRoute(() => renderPlansBilling(mainContent)));
registerRoute('/publicacao/:id', safeRoute((params) => renderPublication(mainContent, params.id)));
registerRoute('/inscrever/:id', safeRoute((params) => renderRegistration(mainContent, params.id)));
registerRoute('/publico/:id', safeRoute((params) => renderPublicChampionship(mainContent, params.id)));
registerRoute('/c/:slug', safeRoute((params) => renderPublicChampionshipBySlug(mainContent, params.slug)));
registerRoute('/embed/:id', safeRoute((params) => renderEmbedWidget(mainContent, params.id)));
registerRoute('/equipe/:id/:teamId', safeRoute((params) => renderTeamPortal(mainContent, params.id, params.teamId)));
registerRoute('/campeonatos/:id', safeRoute((params) => renderChampionship(mainContent, params.id)));
registerRoute('/placar/:id/:matchId', safeRoute((params) => {
  const kind = new URLSearchParams(window.location.search).get('kind') || 'match';
  renderScoreboardDisplay(mainContent, params.id, params.matchId, kind);
}));
registerRoute('/sorteio/:id', safeRoute((params) => renderDrawDisplay(mainContent, params.id)));
registerRoute('/inscrever/:championshipId/status/:registrationId', safeRoute((params) => renderRegistrationStatus(mainContent, params.championshipId, params.registrationId)));
registerRoute('/termos', safeRoute(() => renderLegal(mainContent, 'termos')));
registerRoute('/privacidade', safeRoute(() => renderLegal(mainContent, 'privacidade')));

notFound(safeRoute(() => {
  mainContent.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/">ARENA</a></header><main class="section"><div class="card" style="max-width:560px;margin:40px auto;text-align:center"><h1 style="font-size:28px">Página não encontrada</h1><p class="muted">O endereço pode estar incorreto ou a página foi removida.</p><div class="row" style="justify-content:center;gap:8px;margin-top:16px"><button class="btn primary" data-go="/">Ir para o início</button><button class="btn ghost" data-go="/campeonatos">Ver campeonatos</button></div></div></main></div>`;
  mainContent.querySelectorAll('[data-go]').forEach((button) => { button.onclick = () => navigate(button.dataset.go); });
}));

start();

// Deploy novo: telas de projeção (telão ligado por horas) recarregam sozinhas; no resto do
// app aparece um aviso pra pessoa atualizar quando quiser, sem perder o que está digitando.
watchForUpdates(() => {
  if (/^\/(placar|sorteio|embed)\//.test(window.location.pathname)) {
    window.location.reload();
    return;
  }
  if (document.getElementById('arena-update-banner')) {return;}
  const banner = document.createElement('div');
  banner.id = 'arena-update-banner';
  banner.className = 'update-banner';
  banner.setAttribute('role', 'status');
  banner.innerHTML = '<span>Nova versão do Arena disponível.</span><button class="btn primary sm" type="button">Atualizar agora</button>';
  banner.querySelector('button').onclick = () => window.location.reload();
  document.body.appendChild(banner);
});

if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
  navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('[PWA] Service worker indisponível', error));
}

// Listen for error reset
window.addEventListener('arena:error-reset', () => {
  // Re-initialize current route
  const path = window.location.pathname;
  window.history.replaceState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
});

// Rotas que só fazem sentido logado. Visitante é mandado pro login e volta pra cá depois.
const isPrivatePath = (path) => path.startsWith('/campeonatos/') || path.startsWith('/publicacao/') || path === '/superadmin' || path.startsWith('/superadmin/');

observeAuth((user) => {
  setUser(user);
  const path = window.location.pathname;
  if (user && ['/login', '/register'].includes(path)) {
    const next = takeLoginRedirect();
    if (next) {navigate(next);} else { window.history.replaceState({}, '', '/'); renderHome(mainContent); }
    return;
  }
  if (user && path === '/') {renderHome(mainContent);}
  if (!user && isPrivatePath(path)) {
    rememberLoginRedirect(path + window.location.search);
    navigate('/login');
  }
});


