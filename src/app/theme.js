import { appState } from './state.js';

export function applyTheme(theme = appState.theme) {
  appState.theme = theme;
  localStorage.setItem('arena_theme', theme);
  document.documentElement.dataset.theme = theme;
}

export function toggleTheme() {
  applyTheme(appState.theme === 'light' ? 'dark' : 'light');
}
