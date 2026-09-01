import { produce } from 'immer';
import { appState } from './state.js';
import { applyTheme } from './theme.js';

const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getAppState() {
  return appState;
}

export function setTheme(theme) {
  appState.theme = theme;
  localStorage.setItem('arena_theme', theme);
  applyTheme(theme);
  notify();
}

export function setUser(user) {
  appState.user = user;
  notify();
}

export function produceState(fn) {
  return produce(fn);
}

export function produceChampionship(championship, fn) {
  return produce(championship, fn);
}

