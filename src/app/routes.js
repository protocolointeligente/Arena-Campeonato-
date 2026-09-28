export const ROUTE_DEFINITIONS = [
  '/', '/login', '/register', '/tutorial', '/demo', '/campeonatos/novo',
  '/campeonatos', '/planos', '/superadmin', '/publicacao',
  '/superadmin/auditoria', '/superadmin/seguranca', '/superadmin/privacidade',
  '/superadmin/beta', '/superadmin/planos', '/publicacao/:id', '/inscrever/:id',
  '/publico/:id', '/c/:slug', '/embed/:id', '/equipe/:id/:teamId',
  '/campeonatos/:id', '/placar/:id/:matchId', '/sorteio/:id',
  '/inscrever/:championshipId/status/:registrationId',
  '/termos', '/privacidade',
].map((pattern) => ({
  pattern,
  params: [...pattern.matchAll(/:([A-Za-z0-9_]+)/g)].map((match) => match[1]),
}));
