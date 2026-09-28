import { describe, expect, it } from 'vitest';
import { ROUTE_DEFINITIONS } from './routes.js';

describe('route definitions', () => {
  it('keeps the complete public route table with named parameters', () => {
    expect(ROUTE_DEFINITIONS).toHaveLength(27);
    expect(ROUTE_DEFINITIONS.map((route) => route.pattern)).toEqual([
      '/', '/login', '/register', '/tutorial', '/demo', '/campeonatos/novo',
      '/campeonatos', '/planos', '/superadmin', '/publicacao',
      '/superadmin/auditoria', '/superadmin/seguranca', '/superadmin/privacidade',
      '/superadmin/beta', '/superadmin/planos', '/publicacao/:id', '/inscrever/:id',
      '/publico/:id', '/c/:slug', '/embed/:id', '/equipe/:id/:teamId',
      '/campeonatos/:id', '/placar/:id/:matchId', '/sorteio/:id',
      '/inscrever/:championshipId/status/:registrationId',
      '/termos', '/privacidade',
    ]);
    expect(ROUTE_DEFINITIONS.find((route) => route.pattern === '/equipe/:id/:teamId').params)
      .toEqual(['id', 'teamId']);
  });
});
