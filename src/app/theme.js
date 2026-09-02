import { getAppState, setTheme } from './store.js';

export function applyTheme(theme = getAppState().theme) {
  setTheme(theme);
}

export function toggleTheme() {
  applyTheme(getAppState().theme === 'light' ? 'dark' : 'light');
}


