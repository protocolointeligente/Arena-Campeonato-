// Detecta deploy novo comparando o id deste bundle com /version.json (servido sem cache).
const CURRENT = import.meta.env?.VITE_BUILD_ID || null;

export async function fetchLatestBuild(fetchImpl = fetch) {
  const response = await fetchImpl(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) {return null;}
  const data = await response.json();
  return data?.build || null;
}

export function isOutdated(current, latest) {
  return Boolean(current && latest && current !== latest);
}

export function watchForUpdates(onUpdate, { intervalMs = 60000, current = CURRENT, fetchImpl = fetch } = {}) {
  if (!current) {return () => {};} // dev/testes: sem id de build
  let notified = false;
  const check = async () => {
    if (notified) {return;}
    try {
      if (isOutdated(current, await fetchLatestBuild(fetchImpl))) { notified = true; onUpdate(); }
    } catch { /* offline: tenta de novo no próximo ciclo */ }
  };
  const timer = setInterval(check, intervalMs);
  const onVisible = () => { if (document.visibilityState === 'visible') {check();} };
  document.addEventListener('visibilitychange', onVisible);
  return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
}
