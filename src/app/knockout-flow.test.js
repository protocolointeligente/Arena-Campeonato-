import { describe, it, expect, vi } from 'vitest';
import { createChampionshipStore } from './championship-store.js';
import { renderBracket } from '../pages/championship/tabs/bracket.js';
import { renderPhases } from '../pages/championship/tabs/phases.js';
import { getJsPDF } from './pdf-utils.js';
import { exportScheduleReport } from './reports.js';

function knockoutStore(n = 8) {
  return createChampionshipStore({
    id: 'ko',
    nome: 'Copa',
    formato: 'mata',
    cfg: { turnos: 1 },
    teams: Array.from({ length: n }, (_, i) => ({ id: `t${i}`, nome: `Time ${i}`, roster: [] })),
    matches: [],
    categories: [],
    branding: { accent: '#2fcf6b' },
  });
}

describe('mata-mata: gerar, sortear, exibir e imprimir', () => {
  it('aba Fases oferece botão para gerar o chaveamento da fase ativa', () => {
    const store = knockoutStore();
    expect(renderPhases(store)).toContain('data-generate-phase');
  });

  it('aba Chaveamento oferece botão de sortear quando ainda não há chave', () => {
    const store = knockoutStore();
    expect(renderBracket(store)).toContain('data-generate-phase');
  });

  it('gerar com sorteio embaralha a ordem das equipes', () => {
    const store = knockoutStore(16);
    const orders = new Set();
    for (let i = 0; i < 5; i++) {
      store.generateActivePhase({ shuffle: true });
      orders.add(store.getState().bracket.rounds[0].map((t) => `${t.a}-${t.b}`).join(','));
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it('sorteio não fixa participantTeamIds (novas equipes continuam entrando)', () => {
    const store = knockoutStore(4);
    store.generateActivePhase({ shuffle: true });
    const state = store.getState();
    const phase = state.categories[0].phases.find((p) => p.id === state.categories[0].activePhaseId);
    expect(phase.participantTeamIds || []).toHaveLength(0);
  });

  it('renderizar a aba Chaveamento não re-renderiza em loop', () => {
    const store = knockoutStore(4);
    store.generateActivePhase();
    const listener = vi.fn(() => renderBracket(store));
    store.subscribe(listener);
    expect(() => renderBracket(store)).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });

  it('jsPDF carregado pelo app tem o plugin autoTable', async () => {
    const jsPDF = await getJsPDF();
    expect(typeof new jsPDF().autoTable).toBe('function');
  });

  it('Tabela oficial de mata-mata lista os confrontos do chaveamento', async () => {
    const store = knockoutStore(4);
    store.generateActivePhase();
    const jsPDF = await getJsPDF();
    const calls = [];
    const orig = jsPDF.API.autoTable;
    const save = jsPDF.API.save;
    jsPDF.API.autoTable = function (opts) { calls.push(opts); return orig.call(this, opts); };
    jsPDF.API.save = () => {};
    try {
      await exportScheduleReport(store.getState());
    } finally {
      jsPDF.API.autoTable = orig;
      jsPDF.API.save = save;
    }
    const body = calls.flatMap((c) => c.body || []);
    expect(body.some((row) => row.join(' ').includes('Time 0'))).toBe(true);
  });
});
