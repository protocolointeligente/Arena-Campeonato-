import { describe, expect, it } from 'vitest';
import { renderScoreboardControl } from './scoreboard-control.js';

const goalsState = { modalidade: 'futebol', scoreType: 'goals', teams: [{ nome: 'Leões' }, { nome: 'Tigres' }], matches: [{ id: 'm1', home: 0, away: 1, hg: 1, ag: 0 }] };
const setsState = { modalidade: 'voleibol', scoreType: 'sets', teams: [{ nome: 'A' }, { nome: 'B' }], matches: [{ id: 'm1', home: 0, away: 1 }] };
const combatState = { modalidade: 'judô', scoreType: 'points', teams: [{ nome: 'A' }, { nome: 'B' }], matches: [{ id: 'm1', home: 0, away: 1 }] };

describe('renderScoreboardControl', () => {
  it('shows a placeholder when no match is selected', () => {
    const html = renderScoreboardControl({ getState: () => goalsState }, { placarTarget: null });
    expect(html).toContain('Selecione uma partida');
  });

  it('shows a not-found message for a stale target', () => {
    const html = renderScoreboardControl({ getState: () => goalsState }, { placarTarget: { id: 'ghost', kind: 'match' } });
    expect(html).toContain('não encontrada');
  });

  it('renders team names, score buttons, and fouls/timeouts for a goals-mode match', () => {
    const html = renderScoreboardControl({ getState: () => goalsState }, { placarTarget: { id: 'm1', kind: 'match' } });
    expect(html).toContain('Leões');
    expect(html).toContain('Faltas');
    expect(html).toContain('Tempos técnicos');
    expect(html).toContain('data-scoreboard-score="match:m1:hg:1"');
    expect(html).toContain('data-scoreboard-open="match:m1"');
  });

  it('renders a server toggle for a sets-mode match, without fouls', () => {
    const html = renderScoreboardControl({ getState: () => setsState }, { placarTarget: { id: 'm1', kind: 'match' } });
    expect(html).toContain('Saque');
    expect(html).not.toContain('Faltas');
  });

  it('renders penalties for a combat-mode match, without a server toggle', () => {
    const html = renderScoreboardControl({ getState: () => combatState }, { placarTarget: { id: 'm1', kind: 'match' } });
    expect(html).toContain('Penalidades');
    expect(html).not.toContain('Saque');
  });

  it('renders period controls for a tie target too, not just a static leg number', () => {
    const tieState = { modalidade: 'judô', scoreType: 'points', teams: [{ id: 'a', nome: 'A' }, { id: 'b', nome: 'B' }], bracket: { rounds: [[{ id: 't1', a: 'a', b: 'b', ag1: null, bg1: null }]], third: null } };
    const html = renderScoreboardControl({ getState: () => tieState }, { placarTarget: { id: 't1', kind: 'tie' } });
    expect(html).toContain('data-scoreboard-period="tie:t1:1"');
    expect(html).toContain('1ª perna');
  });
});
