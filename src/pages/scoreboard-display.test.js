import { describe, expect, it } from 'vitest';
import { scoreboardFrameHTML } from './scoreboard-display.js';
import { scoreboardPayload } from '../app/scoreboard.js';

describe('scoreboardFrameHTML', () => {
  it('shows a not-found message when there is no payload', () => {
    expect(scoreboardFrameHTML(null, 'Copa X')).toContain('não encontrada');
  });

  it('renders team names, score, clock and modality-specific extras for a goals match', () => {
    const state = { nome: 'Copa X', modalidade: 'futebol', scoreType: 'goals', teams: [{ nome: 'Leões' }, { nome: 'Tigres' }], matches: [{ id: 'm1', home: 0, away: 1, hg: 2, ag: 1 }] };
    const payload = scoreboardPayload(state, 'm1', 'match');
    const html = scoreboardFrameHTML(payload, state.nome);
    expect(html).toContain('Leões');
    expect(html).toContain('Tigres');
    expect(html).toContain('>2<');
    expect(html).toContain('00:00');
    expect(html).toContain('Faltas');
  });

  it('shows the server side for a sets match instead of fouls', () => {
    const state = { nome: 'Copa X', modalidade: 'voleibol', scoreType: 'sets', teams: [{ nome: 'A' }, { nome: 'B' }], matches: [{ id: 'm1', home: 0, away: 1, server: 'home' }] };
    const payload = scoreboardPayload(state, 'm1', 'match');
    const html = scoreboardFrameHTML(payload, state.nome);
    expect(html).toContain('Saque');
    expect(html).not.toContain('Faltas');
  });
});
