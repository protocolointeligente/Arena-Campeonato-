import { describe, expect, it } from 'vitest';
import { drawFrameHTML } from './draw-display.js';

const teams = [{ id: 't1', nome: 'Leões' }, { id: 't2', nome: 'Tigres' }, { id: 't3', nome: 'Águias' }];

describe('drawFrameHTML', () => {
  it('shows a placeholder when no draw is in progress', () => {
    expect(drawFrameHTML({ teams })).toContain('Nenhum sorteio em andamento');
  });

  it('renders group columns with revealed teams, and the last-drawn team as a reveal', () => {
    const state = { nome: 'Copa X', teams, draw: { formato: 'grupos', groups: [['t1'], ['t2']], done: false } };
    const html = drawFrameHTML(state);
    expect(html).toContain('Leões');
    expect(html).toContain('Tigres');
    expect(html).toContain('Grupo A');
    expect(html).toContain('Grupo B');
    expect(html).toContain('class="draw-reveal">Tigres<');
  });

  it('renders a flat order for a mata-mata draw', () => {
    const state = { nome: 'Copa X', teams, draw: { formato: 'mata', order: ['t3', 't1'], done: false } };
    const html = drawFrameHTML(state);
    expect(html).toContain('draw-order');
    expect(html).toContain('Águias');
    expect(html).toContain('class="draw-reveal">Leões<');
  });

  it('marks the draw as concluded once done', () => {
    const state = { nome: 'Copa X', teams, draw: { formato: 'mata', order: ['t1'], done: true } };
    expect(drawFrameHTML(state)).toContain('concluído');
  });
});
