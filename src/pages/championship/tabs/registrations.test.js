import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderRegistrations, bindRegistrationSearch, registrationStatusLabel } from './registrations.js';

describe('registration operations', () => {
  it('localizes registration statuses for organizers', () => {
    expect(registrationStatusLabel('pending')).toBe('Pendente');
    expect(registrationStatusLabel('approved')).toBe('Aprovada');
    expect(registrationStatusLabel('rejected')).toBe('Recusada');
  });

  it('shows a payment badge for approved registrations with a fee', () => {
    const dom = new JSDOM('<div id="root"></div>');
    const root = dom.window.document.querySelector('#root');
    root.innerHTML = renderRegistrations({}, { registrations: [
      { id: 'p1', teamName: 'Paga', status: 'approved', feeStatus: 'paid', feeAmount: 50, athletes: [] },
      { id: 'p2', teamName: 'Pendente', status: 'approved', feeStatus: 'pending', feeAmount: 50, athletes: [] },
      { id: 'p3', teamName: 'Sem taxa', status: 'approved', athletes: [] },
    ] });
    const rows = root.querySelectorAll('[data-registration-row]');
    expect(rows[0].textContent).toMatch(/pago/i);
    expect(rows[0].textContent).toMatch(/50/);
    expect(rows[1].textContent).toMatch(/aguardando/i);
    expect(rows[2].textContent).not.toMatch(/pago|aguardando/i);
  });

  it('filters registrations by team, responsible or protocol', () => {
    const dom = new JSDOM('<div id="root"></div>');
    const root = dom.window.document.querySelector('#root');
    root.innerHTML = renderRegistrations({}, { registrations: [
      { id: 'abc', teamName: 'Aurora', responsible: 'Maria', athletes: [] },
      { id: 'xyz', teamName: 'Lobos', responsible: 'Joao', athletes: [] },
    ] });
    bindRegistrationSearch(root);
    const input = root.querySelector('[data-registration-search]');
    input.value = 'lobos';
    input.oninput();
    expect(root.querySelector('[data-registration-row][data-search-text*="lobos"]').hidden).toBe(false);
    expect(root.querySelector('[data-registration-row][data-search-text*="aurora"]').hidden).toBe(true);
    input.value = '';
    const status = root.querySelector('[data-registration-status]');
    status.value = 'approved';
    status.onchange();
    expect(root.querySelector('[data-registration-row][data-search-text*="lobos"]').hidden).toBe(true);
  });
});
