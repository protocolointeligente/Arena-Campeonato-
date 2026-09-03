// localStorage.getItem pode lançar (não só retornar null) em ambientes que bloqueiam storage
// — navegação privada em Safari mais antigo, storage desabilitado nas configurações do
// navegador, alguns contextos de iframe — e isso rodava direto no carregamento do módulo,
// sem try/catch, derrubando o app inteiro antes de qualquer coisa renderizar.
function readStoredTheme() {
  try { return localStorage.getItem('arena_theme') || 'light'; }
  catch { return 'light'; }
}

export const appState = {
  theme: readStoredTheme(),
  user: null,
};


