import { describe, it, expect, vi } from 'vitest';
import { validateRegistrationForm, copyRegistrationProtocol } from './registration.js';

const valid = { teamName: 'Arena FC', responsible: 'Maria', phone: '11999999999', email: 'maria@example.com', rosterMode: 'team', consent: 'on', athletes: [{ name: 'Joao' }] };

describe('registration validation', () => {
  it('copies a registration protocol using the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await copyRegistrationProtocol('protocol-123');
    expect(writeText).toHaveBeenCalledWith('protocol-123');
  });

  it('enforces participant count by modality', () => {
    expect(validateRegistrationForm({ ...valid, rosterMode: 'individual', athletes: [{ name: 'A' }, { name: 'B' }] })).toContain('exatamente 1');
    expect(validateRegistrationForm({ ...valid, rosterMode: 'dupla', athletes: [{ name: 'A' }] })).toContain('exatamente 2');
    expect(validateRegistrationForm({ ...valid, rosterMode: 'dupla', athletes: [{ name: 'A' }, { name: 'B' }] })).toBe('');
  });
  it('accepts a complete registration', () => {
    expect(validateRegistrationForm(valid)).toBe('');
  });

  it('respects the modality roster limit when provided', () => {
    expect(validateRegistrationForm({ ...valid, maxRoster: 2, athletes: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] })).toMatch(/2 atletas/);
  });

  it('requires at least one athlete and rejects more than 50', () => {
    expect(validateRegistrationForm({ ...valid, athletes: [] })).toMatch(/pelo menos um atleta/i);
    expect(validateRegistrationForm({ ...valid, athletes: Array.from({ length: 51 }, (_, i) => ({ name: `A${i}` })) })).toMatch(/50 atletas/i);
  });

  it('rejects missing consent and malformed email', () => {
    expect(validateRegistrationForm({ ...valid, consent: false })).toMatch(/obrigatórios/i);
    expect(validateRegistrationForm({ ...valid, email: 'invalid' })).toMatch(/e-mail inválido/i);
  });
});
