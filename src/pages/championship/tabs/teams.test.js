import { describe, expect, it } from 'vitest';
import { participantLabels } from './teams.js';

describe('participant labels', () => {
  it('uses modality-appropriate participant terminology', () => {
    expect(participantLabels('team').plural).toBe('Equipes');
    expect(participantLabels('dupla').roster).toBe('Participantes');
    expect(participantLabels('individual').plural).toBe('Atletas');
  });
});
