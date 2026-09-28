// Guarda pra onde o visitante queria ir antes de ser mandado pro login.
const KEY = 'arena:login-next';

export function rememberLoginRedirect(path) {
  try { sessionStorage.setItem(KEY, path); } catch { /* storage indisponível: volta pro início */ }
}

export function takeLoginRedirect() {
  try {
    const next = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
  } catch { return null; }
}
