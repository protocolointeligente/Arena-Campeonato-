export const PLAN_DEFINITIONS = {
  free: {
    name: 'Grátis',
    price: 0,
    limits: {
      maxChampionships: 1,
      maxTeams: 16,
      maxAthletes: 200,
      maxStorageMB: 10,
      features: ['Criação de campeonatos', 'Tabela e artilharia', 'Súmula digital', 'Relatórios PDF'],
    },
  },
  pro: {
    name: 'Pro',
    price: 49.9,
    limits: {
      maxChampionships: 10,
      maxTeams: 64,
      maxAthletes: 1000,
      maxStorageMB: 500,
      features: ['Tudo do Grátis', 'Campeonatos ilimitados*', 'Branding personalizado', 'Patrocinadores', 'API de integração', 'Suporte prioritário'],
    },
  },
  enterprise: {
    name: 'Enterprise',
    price: 199.9,
    limits: {
      maxChampionships: 999,
      maxTeams: 999,
      maxAthletes: 9999,
      maxStorageMB: 5000,
      features: ['Tudo do Pro', 'Múltiplos organizadores', 'SSO/SAML', 'SLA garantido', 'Gerente de conta dedicado', 'Auditoria avançada'],
    },
  },
};

export function planCardsHTML(currentPlanId) {
  return Object.entries(PLAN_DEFINITIONS)
    .map(([planId, plan]) => {
      const isCurrent = planId === currentPlanId;
      const featuresHTML = plan.limits.features.map((f) => `<li>${f}</li>`).join('');
      const priceHTML = plan.price === 0 ? 'Grátis' : `R$ ${plan.price.toFixed(2).replace('.', ',')}/mês`;
      return `<article class="card ${isCurrent ? 'current' : ''}" style="position:relative">${isCurrent ? '<span class="tag" style="position:absolute;top:10px;right:10px">Atual</span>' : ''}<h3>${plan.name}</h3><div class="muted" style="font-size:24px;margin:8px 0">${priceHTML}</div><ul style="margin:12px 0;padding-left:18px;font-size:13px">${featuresHTML}</ul><button class="btn ${isCurrent ? 'ghost' : 'primary'}" style="width:100%" data-choose-plan="${planId}">${isCurrent ? 'Plano atual' : plan.price === 0 ? 'Selecionar' : 'Assinar'}</button></article>`;
    })
    .join('');
}

export function planLimitText(planId) {
  const plan = PLAN_DEFINITIONS[planId];
  if (!plan) {return 'Plano desconhecido';}
  const { maxChampionships, maxTeams, maxAthletes, maxStorageMB } = plan.limits;
  return `Até ${maxChampionships === 999 ? 'ilimitados' : maxChampionships} campeonatos · até ${maxTeams === 999 ? 'ilimitados' : maxTeams} times · até ${maxAthletes === 9999 ? 'ilimitados' : maxAthletes} atletas · ${maxStorageMB === 5000 ? '5 GB' : `${maxStorageMB  } MB`} de armazenamento`;
}

export function canCreateChampionship(state, planId) {
  const plan = PLAN_DEFINITIONS[planId];
  if (!plan) {return { ok: false, reason: 'Plano inválido' };}
  const currentCount = (state.championships || []).length;
  if (currentCount >= plan.limits.maxChampionships) {
    return { ok: false, reason: `Limite de ${plan.limits.maxChampionships} campeonatos atingido para o plano ${plan.name}` };
  }
  return { ok: true };
}

export function choosePlan(user, planId) {
  const plan = PLAN_DEFINITIONS[planId];
  if (!plan) {return { ok: false, reason: 'Plano inválido' };}
  if (plan.price === 0) {
    return { ok: true, pending: false };
  }
  return { ok: true, pending: true };
}

export function currentPlan(user) {
  if (!user?.billing?.planId) {return 'free';}
  return user.billing.planId;
}

export function confirmPlanRequest(user, planId) {
  const plan = PLAN_DEFINITIONS[planId];
  if (!plan) {return { ok: false, reason: 'Plano inválido' };}
  if (plan.price === 0) {
    return { ok: true };
  }
  return { ok: true, pending: true };
}

