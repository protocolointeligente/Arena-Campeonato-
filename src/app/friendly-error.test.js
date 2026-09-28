// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { friendlyError } from './friendly-error.js';
import { rememberLoginRedirect, takeLoginRedirect } from './login-redirect.js';

describe('friendlyError', () => {
  it('traduz códigos do Firebase', () => {
    expect(friendlyError({ code: 'permission-denied', message: 'Missing or insufficient permissions.' })).toMatch(/permissão/);
    expect(friendlyError({ code: 'auth/invalid-credential', message: 'Firebase: Error (auth/invalid-credential).' })).toBe('E-mail ou senha incorretos.');
  });
  it('esconde mensagem técnica em inglês', () => {
    expect(friendlyError(new TypeError("Cannot read properties of undefined (reading 'indexOf')"), 'Falhou.')).toBe('Falhou.');
    expect(friendlyError(new Error('Missing or insufficient permissions.'))).toMatch(/permissão/);
  });
  it('mantém mensagens do próprio app', () => {
    expect(friendlyError(new Error('Campeonato não encontrado.'))).toBe('Campeonato não encontrado.');
  });
});

describe('login redirect', () => {
  it('guarda e consome o destino uma vez', () => {
    rememberLoginRedirect('/campeonatos/abc');
    expect(takeLoginRedirect()).toBe('/campeonatos/abc');
    expect(takeLoginRedirect()).toBeNull();
  });
  it('ignora destino externo', () => {
    rememberLoginRedirect('//evil.com');
    expect(takeLoginRedirect()).toBeNull();
  });
});

describe('router', () => {
  it('chama notFound para rota desconhecida e ignora query/barra final', async () => {
    vi.resetModules();
    const { route, navigate, notFound } = await import('./router-v2.js');
    const hit = vi.fn();
    const miss = vi.fn();
    route('/placar/:id/:matchId', hit);
    notFound(miss);
    navigate('/placar/a/b?kind=tie');
    expect(hit).toHaveBeenCalledWith({ id: 'a', matchId: 'b' });
    navigate('/placar/a/b/');
    expect(hit).toHaveBeenCalledTimes(2);
    navigate('/nao-existe');
    expect(miss).toHaveBeenCalledWith({ path: '/nao-existe' });
  });
});
