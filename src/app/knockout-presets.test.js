// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createChampionshipStore } from './championship-store.js';
import { knockoutSizeFromName, crossSeedGroups } from './phases.js';
import { renderPhases } from '../pages/championship/tabs/phases.js';

function groupStore(nTeams = 8, nGrupos = 2) {
  const store = createChampionshipStore({
    id: 'g',
    nome: 'Interclasse',
    formato: 'grupos',
    cfg: { turnos: 1, nGrupos },
    teams: Array.from({ length: nTeams }, (_, i) => ({ id: `t${i}`, nome: `Time ${i}`, roster: [] })),
    matches: [],
    categories: [],
    branding: { accent: '#2fcf6b' },
  });
  store.generateActivePhase();
  return store;
}

const cat = (store) => store.getState().categories[0];

describe('updateScoring aceita atualização parcial', () => {
  it('mudar só turnos não gera erro e é salvo', () => {
    const store = groupStore();
    expect(store.updateScoring({ turnos: 2 }).ok).toBe(true);
    expect(store.getState().cfg.turnos).toBe(2);
  });

  it('nGrupos, maoUnica e terceiro não são descartados', () => {
    const store = groupStore();
    store.updateScoring({ nGrupos: 4 });
    store.updateScoring({ maoUnica: true });
    store.updateScoring({ terceiro: false });
    const { cfg } = store.getState();
    expect(cfg.nGrupos).toBe(4);
    expect(cfg.maoUnica).toBe(true);
    expect(cfg.terceiro).toBe(false);
  });

  it('continua rejeitando valor inválido', () => {
    const store = groupStore();
    expect(store.updateScoring({ winPts: -1 }).ok).toBe(false);
  });
});

describe('knockoutSizeFromName', () => {
  it.each([
    ['Oitavas de final', 16],
    ['quartas', 8],
    ['Semifinal', 4],
    ['seminfinal', 4],
    ['semi-final', 4],
    ['Final', 2],
    ['GRANDE FINAL', 2],
    ['Fase 2', null],
    ['Fase principal', null],
  ])('%s → %s', (name, size) => {
    expect(knockoutSizeFromName(name)).toBe(size);
  });
});

describe('crossSeedGroups', () => {
  it('2 grupos, 2 por grupo: 1A×2B e 1B×2A', () => {
    expect(crossSeedGroups([['A1', 'A2'], ['B1', 'B2']])).toEqual(['A1', 'B2', 'B1', 'A2']);
  });

  it('4 grupos, 2 por grupo: mesmos grupos em lados opostos da chave', () => {
    expect(crossSeedGroups([['A1', 'A2'], ['B1', 'B2'], ['C1', 'C2'], ['D1', 'D2']]))
      .toEqual(['A1', 'B2', 'C1', 'D2', 'B1', 'A2', 'D1', 'C2']);
  });

  it('1 por grupo: ordem dos grupos', () => {
    expect(crossSeedGroups([['A1'], ['B1'], ['C1'], ['D1']])).toEqual(['A1', 'B1', 'C1', 'D1']);
  });
});

describe('fase de mata-mata pré-configurada', () => {
  it('addKnockoutPhase(4) após grupos cria Semifinal e liga 2 por grupo', () => {
    const store = groupStore(8, 2);
    const result = store.addKnockoutPhase(4);
    expect(result.ok).toBe(true);
    const c = cat(store);
    const [groups, semi] = c.phases;
    expect(semi.nome).toBe('Semifinal');
    expect(semi.formato).toBe('mata');
    expect(groups.progression).toEqual({ targetPhaseId: semi.id, mode: 'perGroup', count: 2 });
    // não troca a fase ativa: os grupos continuam sendo jogados
    expect(c.activePhaseId).toBe(groups.id);
    expect(store.getState().formato).toBe('grupos');
  });

  it('Quartas com 2 grupos: 4 por grupo', () => {
    const store = groupStore(10, 2);
    store.addKnockoutPhase(8);
    expect(cat(store).phases[0].progression).toMatchObject({ mode: 'perGroup', count: 4 });
  });

  it('Final com 4 grupos (não divisível) usa classificação geral', () => {
    const store = groupStore(8, 4);
    store.addKnockoutPhase(2);
    expect(cat(store).phases[0].progression).toMatchObject({ mode: 'overall', count: 2 });
  });

  it('renomear fase para "Quartas" configura mata-mata automaticamente', () => {
    const store = groupStore(10, 2);
    store.addPhase();
    const second = cat(store).phases[1];
    const result = store.renamePhase(second.id, 'Quartas de final');
    expect(result.knockoutSize).toBe(8);
    const c = cat(store);
    expect(c.phases[1].formato).toBe('mata');
    expect(c.phases[0].progression).toMatchObject({ targetPhaseId: second.id, mode: 'perGroup', count: 4 });
  });

  it('avançar grupos → semifinal gera chave cruzada sem rematch de grupo', () => {
    const store = groupStore(8, 2);
    store.addKnockoutPhase(4);
    const c0 = cat(store);
    const [groups] = c0.phases;
    store.getState().matches.forEach((m) => {
      store.setScore(m.id, 'hg', String(m.home < m.away ? 2 : 0));
      store.setScore(m.id, 'ag', String(m.home < m.away ? 0 : 2));
    });
    expect(store.applyProgression(groups.id).ok).toBe(true);
    expect(store.generateActivePhase().ok).toBe(true);
    const state = store.getState();
    const grupoDe = {};
    cat(store).phases[0].grupos.forEach((g, gi) => g.forEach((id) => { grupoDe[id] = gi; }));
    const semis = state.bracket.rounds[0];
    expect(semis).toHaveLength(2);
    semis.forEach((tie) => expect(grupoDe[tie.a]).not.toBe(grupoDe[tie.b]));
  });

  it('aba Fases mostra progressão configurável quando há fase seguinte', () => {
    const store = groupStore();
    store.addPhase();
    store.switchPhase(cat(store).phases[0].id);
    expect(renderPhases(store)).toContain('data-progress-target');
  });

  it('aba Fases oferece atalhos de mata-mata', () => {
    const html = renderPhases(groupStore());
    expect(html).toContain('data-add-knockout="16"');
    expect(html).toContain('data-add-knockout="2"');
  });
});

describe('ações do store que devolvem resultado não quebram o immer', () => {
  it('removePhase remove e devolve ok', () => {
    const store = groupStore();
    store.addKnockoutPhase(4);
    const id = cat(store).phases[1].id;
    expect(store.removePhase(id)).toEqual({ ok: true });
    expect(cat(store).phases).toHaveLength(1);
  });

  it('removePhase da fase ativa volta para a primeira', () => {
    const store = groupStore();
    store.addPhase();
    const active = cat(store).activePhaseId;
    expect(store.removePhase(active).ok).toBe(true);
    expect(cat(store).activePhaseId).toBe(cat(store).phases[0].id);
  });

  it('removeCategory devolve ok', () => {
    const store = groupStore();
    store.addCategory();
    const id = store.getState().categories[1].id;
    expect(store.removeCategory(id).ok).toBe(true);
    expect(store.getState().categories).toHaveLength(1);
  });

  it('genCross devolve ok', () => {
    const store = groupStore();
    expect(store.genCross().ok).toBe(true);
    expect(store.getState().bracket).toBeTruthy();
  });
});

describe('súmula e elenco gravam no estado congelado', () => {
  it('addMatchEvent/removeMatchEvent com objeto vindo de getState()', () => {
    const store = groupStore();
    const match = store.getState().matches[0];
    expect(Object.isFrozen(match)).toBe(true);
    expect(store.addMatchEvent(match, { type: 'goal', teamId: 't0', athleteId: null }).ok).toBe(true);
    expect(store.getState().matches[0].events).toHaveLength(1);
    expect(store.removeMatchEvent(store.getState().matches[0], 0).ok).toBe(true);
    expect(store.getState().matches[0].events).toHaveLength(0);
  });

  it('elenco: adicionar e editar atleta pelo id da equipe', () => {
    const store = groupStore();
    expect(store.addAthlete('t0', { nome: 'Novo Atleta' }).ok).toBe(true);
    const athlete = store.getState().teams[0].roster.at(-1);
    expect(athlete.nome).toBe('Novo Atleta');
    expect(store.updateAthlete('t0', athlete.id, { nome: 'Editado', numero: '9' }).ok).toBe(true);
    expect(store.getState().teams[0].roster.at(-1).nome).toBe('Editado');
  });
});
