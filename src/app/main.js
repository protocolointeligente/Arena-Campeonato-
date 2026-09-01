import '../styles/tokens.css';
import '../styles/layout.css';
import { route, navigate, start } from './router-v2.js';
import { applyTheme } from './theme.js';
import { ensureUiRoot } from './ui.js';
import { renderLanding } from '../pages/landing.js';
import { renderDemo } from '../pages/demo.js';
import { renderAuth } from '../pages/auth.js';
import { renderTutorial } from '../pages/tutorial.js';
import { observeAuth } from '../services/firebase.js';
import { renderHome } from '../pages/home.js';
import { renderNewChampionship } from '../pages/new-championship.js';
import { renderChampionship } from '../pages/championship/index.js';
import { renderPlans } from '../pages/plans.js';
import { renderPublicChampionship, renderTeamPortal } from '../pages/public-championship.js';
import { renderRegistration } from '../pages/registration.js';
import { renderSuperadmin } from '../pages/superadmin.js';
import { renderAuditCenter } from '../pages/audit-center.js';
import { renderSecurityCenter } from '../pages/security-center.js';
import { renderPrivacyCenter } from '../pages/privacy-center.js';
import { renderBetaHardening } from '../pages/beta-hardening.js';
import { renderPlansBilling } from '../pages/plans-billing.js';
import { renderPublication } from '../pages/publication.js';
import { setUser } from './store.js';
import { ErrorBoundary, setupGlobalErrorHandlers } from '../components/ErrorBoundary.js';
import { getErrorLogger } from '../services/error-logger.js';

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

route('/', safeRoute(() => renderLanding(mainContent)));
route('/login', safeRoute(() => renderAuth(mainContent, 'login')));
route('/register', safeRoute(() => renderAuth(mainContent, 'register')));
route('/tutorial', safeRoute(() => renderTutorial(mainContent)));
route('/demo', safeRoute(() => renderDemo(mainContent)));
route('/campeonatos/novo', safeRoute(() => renderNewChampionship(mainContent)));
route('/planos', safeRoute(() => renderPlans(mainContent)));
route('/superadmin', safeRoute(() => renderSuperadmin(mainContent)));
route('/publicacao', safeRoute(() => renderLanding(mainContent)));
route('/superadmin/auditoria', safeRoute(() => renderAuditCenter(mainContent)));
route('/superadmin/seguranca', safeRoute(() => renderSecurityCenter(mainContent)));
route('/superadmin/privacidade', safeRoute(() => renderPrivacyCenter(mainContent)));
route('/superadmin/beta', safeRoute(() => renderBetaHardening(mainContent)));
route('/superadmin/planos', safeRoute(() => renderPlansBilling(mainContent)));
route('/publicacao/:id', safeRoute((params) => renderPublication(mainContent, params.id)));
route('/inscrever/:id', safeRoute((params) => renderRegistration(mainContent, params.id)));
route('/publico/:id', safeRoute((params) => renderPublicChampionship(mainContent, params.id)));
route('/equipe/:id/:teamId', safeRoute((params) => renderTeamPortal(mainContent, params.id, params.teamId)));
route('/campeonatos/:id', safeRoute((params) => renderChampionship(mainContent, params.id)));

start();

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

observeAuth((user) => { setUser(user); if (user && ['/login', '/register'].includes(window.location.pathname)) { window.history.replaceState({}, '', '/'); renderHome(mainContent); } if (user && window.location.pathname === '/') {renderHome(mainContent);} if (!user && window.location.pathname.startsWith('/campeonatos/')) {navigate('/login');} });


