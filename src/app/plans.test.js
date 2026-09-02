import { describe, it, expect } from 'vitest';
import { PLAN_DEFINITIONS, planCardsHTML, planLimitText, canCreateChampionship, choosePlan, currentPlan, confirmPlanRequest } from './plans.js';
import { isSamePendingRequest } from '../services/billing.js';

describe('plans', () => {
  it('recognizes repeated pending requests as idempotent', () => {
    expect(isSamePendingRequest({ status: 'pending', planId: 'pro' }, 'pro')).toBe(true);
    expect(isSamePendingRequest({ status: 'pending', planId: 'free' }, 'pro')).toBe(false);
    expect(isSamePendingRequest({ status: 'active', planId: 'pro' }, 'pro')).toBe(false);
  });
  describe('PLAN_DEFINITIONS', () => {
    it('has free, pro, enterprise plans', () => {
      expect(PLAN_DEFINITIONS.free).toBeDefined();
      expect(PLAN_DEFINITIONS.pro).toBeDefined();
      expect(PLAN_DEFINITIONS.enterprise).toBeDefined();
    });

    it('each plan has required fields', () => {
      Object.values(PLAN_DEFINITIONS).forEach((plan) => {
        expect(plan.name).toBeTypeOf('string');
        expect(plan.price).toBeTypeOf('number');
        expect(plan.limits).toBeDefined();
        expect(plan.limits.maxChampionships).toBeTypeOf('number');
        expect(plan.limits.maxTeams).toBeTypeOf('number');
        expect(plan.limits.maxAthletes).toBeTypeOf('number');
        expect(plan.limits.maxStorageMB).toBeTypeOf('number');
        expect(Array.isArray(plan.limits.features)).toBe(true);
      });
    });
  });

  describe('planCardsHTML', () => {
    it('generates HTML for all plans', () => {
      const html = planCardsHTML('free');
      expect(html).toContain('Grátis');
      expect(html).toContain('Pro');
      expect(html).toContain('Enterprise');
    });

    it('marks current plan', () => {
      const html = planCardsHTML('pro');
      expect(html).toContain('Atual');
      expect(html).toContain('Plano atual');
    });

    it('shows "Plano atual" for current plan', () => {
      const html = planCardsHTML('free');
      expect(html).toContain('Plano atual');
    });

    it('shows "Selecionar" for free plan when not current', () => {
      const html = planCardsHTML('pro');
      expect(html).toContain('Selecionar');
    });

    it('shows price for paid plans', () => {
      const html = planCardsHTML('free');
      expect(html).toContain('R$ 49,90');
      expect(html).toContain('R$ 199,90');
    });
  });

  describe('planLimitText', () => {
    it('returns formatted limits for free plan', () => {
      const text = planLimitText('free');
      expect(text).toContain('1 campeonatos');
      expect(text).toContain('16 times');
      expect(text).toContain('200 atletas');
      expect(text).toContain('10 MB');
    });

    it('shows "ilimitados" for enterprise', () => {
      const text = planLimitText('enterprise');
      expect(text).toContain('ilimitados');
      expect(text).toContain('5 GB');
    });

    it('returns fallback for unknown plan', () => {
      expect(planLimitText('unknown')).toBe('Plano desconhecido');
    });
  });

  describe('canCreateChampionship', () => {
    it('allows when under limit', () => {
      const state = { championships: [] };
      const result = canCreateChampionship(state, 'free');
      expect(result.ok).toBe(true);
    });

    it('blocks when at limit', () => {
      const state = { championships: Array(1).fill({}) };
      const result = canCreateChampionship(state, 'free');
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('Limite');
    });

    it('allows unlimited for enterprise', () => {
      const state = { championships: Array(100).fill({}) };
      const result = canCreateChampionship(state, 'enterprise');
      expect(result.ok).toBe(true);
    });

    it('rejects invalid plan', () => {
      const result = canCreateChampionship({}, 'invalid');
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('Plano inválido');
    });
  });

  describe('choosePlan', () => {
    it('returns non-pending for free plan', () => {
      const result = choosePlan({}, 'free');
      expect(result.ok).toBe(true);
      expect(result.pending).toBe(false);
    });

    it('returns pending for pro plan', () => {
      const result = choosePlan({}, 'pro');
      expect(result.ok).toBe(true);
      expect(result.pending).toBe(true);
    });

    it('returns pending for enterprise plan', () => {
      const result = choosePlan({}, 'enterprise');
      expect(result.ok).toBe(true);
      expect(result.pending).toBe(true);
    });

    it('rejects invalid plan', () => {
      const result = choosePlan({}, 'invalid');
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('Plano inválido');
    });
  });

  describe('currentPlan', () => {
    it('returns free for user without billing', () => {
      expect(currentPlan({})).toBe('free');
      expect(currentPlan(null)).toBe('free');
      expect(currentPlan(undefined)).toBe('free');
    });

    it('returns planId from user.billing when status is active', () => {
      expect(currentPlan({ billing: { planId: 'pro', status: 'active' } })).toBe('pro');
      expect(currentPlan({ billing: { planId: 'enterprise', status: 'active' } })).toBe('enterprise');
    });

    it('returns free when billing.status is not active, even with a paid planId already set', () => {
      expect(currentPlan({ billing: { planId: 'pro', status: 'pending' } })).toBe('free');
      expect(currentPlan({ billing: { planId: 'enterprise', status: 'cancelled' } })).toBe('free');
      expect(currentPlan({ billing: { planId: 'pro' } })).toBe('free');
    });
  });

  describe('confirmPlanRequest', () => {
    it('returns ok for free plan', () => {
      const result = confirmPlanRequest({}, 'free');
      expect(result.ok).toBe(true);
      expect(result.pending).toBeUndefined();
    });

    it('returns pending for pro plan', () => {
      const result = confirmPlanRequest({}, 'pro');
      expect(result.ok).toBe(true);
      expect(result.pending).toBe(true);
    });

    it('rejects invalid plan', () => {
      const result = confirmPlanRequest({}, 'invalid');
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('Plano inválido');
    });
  });
});


