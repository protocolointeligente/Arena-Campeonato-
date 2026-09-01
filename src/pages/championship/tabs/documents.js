import { viewRelatoriosHTML } from '../../../app/reports.js';

export function renderDocuments(store) {
  const state = store.getState();
  return viewRelatoriosHTML(state);
}

