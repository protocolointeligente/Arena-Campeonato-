import { pathToRegexp } from 'path-to-regexp';

const routes = [];
let notFoundHandler = null;

// Chamado quando nenhuma rota casa (senão a tela fica em branco).
export function notFound(handler) {
  notFoundHandler = handler;
}

export function route(pattern, handler) {
  // path-to-regexp v8 returns { regexp, keys } and never mutates an argument — passing a
  // mutable array as a 2nd arg (the old Express-style API) is silently ignored, so `keys` here
  // must come from the returned object, never from an outer array. Getting this wrong doesn't
  // error: dispatch() just always calls the handler with an empty params object.
  const compiled = pathToRegexp(pattern);
  const regex = compiled.regexp || compiled;
  const keys = compiled.keys || [];
  routes.push({ pattern, regex, keys, handler });
}

export function navigate(path) {
  history.pushState({}, '', path);
  dispatch(path);
}

export function replace(path) {
  history.replaceState({}, '', path);
  dispatch(path);
}

function dispatch(rawPath) {
  // Só o pathname entra no match: "/placar/a/b?kind=tie" não casaria com nenhuma rota.
  let path = String(rawPath).split(/[?#]/)[0] || '/';
  if (path.length > 1 && path.endsWith('/')) {path = path.slice(0, -1);}
  for (const { regex, keys, handler } of routes) {
    const match = regex.exec(path);
    if (match) {
      const params = {};
      keys.forEach((key, i) => { params[key.name] = match[i + 1]; });
      handler(params);
      return true;
    }
  }
  if (notFoundHandler) {notFoundHandler({ path });}
  return false;
}

export function start() {
  window.addEventListener('popstate', () => dispatch(window.location.pathname));
  dispatch(window.location.pathname);
}

