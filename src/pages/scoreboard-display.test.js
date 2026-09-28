import { describe, expect, it } from 'vitest';
import { scoreboardFrameHTML, segmentDigit, segmentNumber } from './scoreboard-display.js';
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
    expect(html).toContain('faltas');
  });

  it('shows the server side for a sets match instead of fouls', () => {
    const state = { nome: 'Copa X', modalidade: 'voleibol', scoreType: 'sets', teams: [{ nome: 'A' }, { nome: 'B' }], matches: [{ id: 'm1', home: 0, away: 1, server: 'home' }] };
    const payload = scoreboardPayload(state, 'm1', 'match');
    const html = scoreboardFrameHTML(payload, state.nome);
    expect(html).toContain('Saque');
    expect(html).not.toContain('faltas');
  });

  it('placar de cada equipe fica numa caixa própria (não vira "10")', () => {
    const state = { nome: 'Copa X', modalidade: 'futsal', scoreType: 'goals', teams: [{ nome: '6º MA' }, { nome: '7º ML' }], matches: [{ id: 'm1', home: 0, away: 1, hg: 1, ag: 0 }] };
    const html = scoreboardFrameHTML(scoreboardPayload(state, 'm1', 'match'), state.nome);
    expect(html.match(/class="sb-window"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="6º MA: 1"');
    expect(html).toContain('aria-label="7º ML: 0"');
  });
});

describe('dígitos de 7 segmentos', () => {
  const lit = (svg) => (svg.match(/class="on"/g) || []).length;
  it('acende os segmentos certos', () => {
    expect(lit(segmentDigit('1'))).toBe(2);
    expect(lit(segmentDigit('8'))).toBe(7);
    expect(lit(segmentDigit('0'))).toBe(6);
    expect(lit(segmentDigit(''))).toBe(0);
  });
  it('mantém largura fixa com zeros à esquerda apagados', () => {
    const one = segmentNumber(1, 2);
    expect(one.match(/<svg/g)).toHaveLength(2);
    expect(lit(one)).toBe(2);
    expect(segmentNumber(123, 2).match(/<svg/g)).toHaveLength(3);
  });
});

describe('súmula e intervalo na projeção', () => {
  const state = {
    nome: 'Copa X', modalidade: 'futsal', scoreType: 'goals',
    sponsors: [{ id: 's1', name: 'Padaria Sol', logo: '' }, { id: 's2', name: 'Loja', logo: 'https://x/logo.png' }],
    teams: [
      { id: 'tA', nome: 'Leões', roster: [{ id: 'a1', nome: 'João', numero: '10' }] },
      { id: 'tB', nome: 'Tigres', roster: [{ id: 'b1', nome: 'Pedro' }] },
    ],
    matches: [{ id: 'm1', home: 0, away: 1, hg: 2, ag: 0, events: [
      { type: 'goal', teamId: 'tA', athleteId: 'a1' },
      { type: 'yellow', teamId: 'tB', athleteId: 'b1' },
      { type: 'goal', teamId: 'tA', athleteId: 'a1' },
    ] }],
  };

  it('lista gols agrupados por atleta e cartões do lado certo', () => {
    const payload = scoreboardPayload(state, 'm1', 'match');
    expect(payload.events.map((e) => [e.type, e.side])).toEqual([['goal', 'home'], ['yellow', 'away'], ['goal', 'home']]);
    const html = scoreboardFrameHTML(payload, state.nome);
    expect(html).toContain('10 · João');
    expect(html).toContain('×2');
    expect(html).toContain('sb-ev-card yellow');
    expect(html.indexOf('Casa')).toBeLessThan(html.indexOf('sb-window'));
  });

  it('tela de intervalo mostra placar e patrocinadores', () => {
    const payload = { ...scoreboardPayload(state, 'm1', 'match'), screen: 'intervalo' };
    const html = scoreboardFrameHTML(payload, state.nome);
    expect(html).toContain('Intervalo');
    expect(html).toContain('Padaria Sol');
    expect(html).toContain('src="https://x/logo.png"');
    expect(html).not.toContain('sb-clock');
  });
});
