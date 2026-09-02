import { describe, expect, it } from 'vitest';
import { registrationStatusHTML } from './registration-status.js';

describe('registrationStatusHTML', () => {
  it('shows just the status when no fee is configured', () => {
    const html = registrationStatusHTML({ championshipName: 'Copa Teste', registration: { teamName: 'Aurora', status: 'approved' } });
    expect(html).toContain('Aurora');
    expect(html).toContain('Aprovada');
    expect(html).not.toContain('data-pay-fee');
  });

  it('shows a pay button when approved with a pending fee', () => {
    const html = registrationStatusHTML({ championshipName: 'Copa Teste', registration: { teamName: 'Aurora', status: 'approved', feeStatus: 'pending', feeAmount: 49.9 } });
    expect(html).toContain('data-pay-fee');
    expect(html).toContain('49.90');
  });

  it('shows a paid confirmation when the fee is already paid', () => {
    const html = registrationStatusHTML({ championshipName: 'Copa Teste', registration: { teamName: 'Aurora', status: 'approved', feeStatus: 'paid', feeAmount: 49.9 } });
    expect(html).not.toContain('data-pay-fee');
    expect(html).toMatch(/pagamento confirmado/i);
  });

  it('shows a processing message instead of the pay button right after returning from checkout', () => {
    const html = registrationStatusHTML({ championshipName: 'Copa Teste', registration: { teamName: 'Aurora', status: 'approved', feeStatus: 'pending', feeAmount: 49.9 }, justPaid: true });
    expect(html).not.toContain('data-pay-fee');
    expect(html).toMatch(/processamento/i);
  });

  it('never shows a pay button before approval, even with a fee configured', () => {
    const html = registrationStatusHTML({ championshipName: 'Copa Teste', registration: { teamName: 'Aurora', status: 'pending', feeAmount: 49.9 } });
    expect(html).not.toContain('data-pay-fee');
  });
});
