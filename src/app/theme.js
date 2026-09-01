import { getAppState, setTheme as storeSetTheme } from './store.js';

export function applyTheme(theme = getAppState().theme) {
  storeSetTheme(theme);
}

export function toggleTheme() {
  applyTheme(getAppState().theme === 'light' ? 'dark' : 'light');
}


