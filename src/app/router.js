const routes = new Map();
let currentRoute = null;

export function route(path, render) { routes.set(path, render); }

export function navigate(path) {
  history.pushState({}, '', path);
  renderRoute();
}

export function replace(path) {
  history.replaceState({}, '', path);
  renderRoute();
}

export function renderRoute() {
  if (typeof window.__arenaRenderRoute === 'function') return window.__arenaRenderRoute();
  const path = window.location.pathname;
  currentRoute = routes.get(path) || routes.get('/');
  currentRoute?.();
}

export function getCurrentRoute() { return currentRoute; }

window.addEventListener('popstate', renderRoute);
