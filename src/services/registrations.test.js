import { describe, expect, it } from 'vitest';
import { registrationDocId, registrationPageSize, registrationTeamKey } from './registrations.js';

describe('registration identity', () => {
  it('creates a stable, distinct Firestore-safe id from the normalized team name', () => {
    expect(registrationDocId(registrationTeamKey(' Águias  FC '))).toBe(registrationDocId('aguias fc'));
    expect(registrationDocId('aguias fc')).not.toBe(registrationDocId('tubaroes fc'));
    expect(registrationDocId('aguias fc')).toMatch(/^team_[a-z0-9]+$/);
  });
});

describe('registration pagination', () => {
  it('clamps page sizes to a safe Firestore range', () => {
    expect(registrationPageSize()).toBe(500);
    expect(registrationPageSize(20)).toBe(20);
    expect(registrationPageSize(9999)).toBe(500);
    expect(registrationPageSize(0)).toBe(1);
  });
});
