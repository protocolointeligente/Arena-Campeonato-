import { pathToRegexp } from 'path-to-regexp';

const routes = [];

export function route(pattern, handler) {
  const keys = [];
  const compiled = pathToRegexp(pattern, keys);
  const regex = compiled.regexp || compiled;
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

function dispatch(path) {
  for (const { regex, keys, handler } of routes) {
    const match = regex.exec(path);
    if (match) {
      const params = {};
      keys.forEach((key, i) => { params[key.name] = match[i + 1]; });
      handler(params);
      return true;
    }
  }
  return false;
}

export function start() {
  window.addEventListener('popstate', () => dispatch(window.location.pathname));
  dispatch(window.location.pathname);
}

