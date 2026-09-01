import { describe, expect, it } from 'vitest';
import { renderGames } from './games.js';

describe('games presentation', () => {
  it('uses modality-specific score labels and accessible inputs', () => {
    const html = renderGames({ getState: () => ({ scoreType: 'sets', formato: 'liga', teams: [{ nome: 'A' }, { nome: 'B' }], matches: [{ id: 'm1', home: 0, away: 1 }] }) });
    expect(html).toContain('Registre os placares em sets.');
    expect(html).toContain('aria-label="A sets"');
  });
});
