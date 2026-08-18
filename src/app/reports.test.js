import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reportBase, reportName, reportStandingsBlocks } from './reports.js';

vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    internal: { pageSize: { getWidth: () => 595 } },
    autoTable: vi.fn(),
    save: vi.fn(),
    addPage: vi.fn(),
    lastAutoTable: { finalY: 100 },
    setDrawColor: vi.fn(),
    setLineWidth: vi.fn(),
    line: vi.fn(),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    roundedRect: vi.fn(),
    addImage: vi.fn(),
  })),
  autoTable: vi.fn(),
}));

describe('report utilities', () => {
  const mockState = {
    nome: 'Teste Campeonato',
    formato: 'liga',
    cfg: { criterios: ['P', 'V', 'SG', 'GP'], discYellow: 1, discRed: 5, winPts: 3, drawPts: 1, lossPts: 0 },
    teams: [{ id: 't1', nome: 'Time A', roster: [] }, { id: 't2', nome: 'Time B', roster: [] }],
    matches: [],
    grupos: [],
    bracket: null,
    categories: [{ id: 'c1', nome: 'Categoria A', phases: [{ id: 'p1', nome: 'Fase 1', activePhaseId: 'p1' }] }],
    venues: [],
    officials: [],
  };

  it('reportName generates sanitized filename', () => {
    const name = reportName(mockState, 'teste');
    expect(name).toMatch(/^Teste_Campeonato_Categoria_A_teste\.pdf$/);
  });

  it('reportStandingsBlocks returns blocks for liga format', () => {
    const blocks = reportStandingsBlocks(mockState);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].title).toBe('Classificação');
  });

  it('reportStandingsBlocks returns blocks for grupos format', () => {
    const stateGrupos = {
      ...mockState,
      formato: 'grupos',
      grupos: [['t1'], ['t2']],
      matches: [],
    };
    const blocks = reportStandingsBlocks(stateGrupos);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].title).toBe('Grupo A');
    expect(blocks[1].title).toBe('Grupo B');
  });

  it('reportStandingsBlocks returns blocks for gxg format', () => {
    const stateGxg = {
      ...mockState,
      formato: 'gxg',
      grupos: [['t1'], ['t2']],
      matches: [],
    };
    const blocks = reportStandingsBlocks(stateGxg);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].title).toBe('Grupo A');
    expect(blocks[1].title).toBe('Grupo B');
  });

  it('reportBase returns null when jsPDF not available', async () => {
    vi.resetModules();
    vi.doMock('jspdf', () => ({ jsPDF: undefined }));
    const { reportBase: reportBaseNoPdf } = await import('./reports.js');
    const result = await reportBaseNoPdf(mockState, 'Test', 'Sub');
    expect(result).toBeNull();
  });
});