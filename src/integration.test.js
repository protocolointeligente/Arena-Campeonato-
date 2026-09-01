import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable',
});

global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

vi.stubGlobal('navigator', dom.window.navigator);

function setupDOM() {
  document.body.innerHTML = '<div id="app"></div>';
  return document.getElementById('app');
}

describe('Integration Tests - Championship Flows', () => {
  let root;

  beforeEach(() => {
    root = setupDOM();
    vi.clearAllMocks();
  });

  describe('Championship Store - Core Mutations', () => {
    it('should create store with initial state and allow mutations', async () => {
      const { createChampionshipStore } = await import('./app/championship-store.js');
      
      const initial = {
        id: 'test-1',
        nome: 'Test Championship',
        formato: 'liga',
        cfg: { turnos: 1 },
        teams: [],
        matches: [],
        categories: [],
        branding: { accent: '#2fcf6b' },
      };

      const store = createChampionshipStore(initial);
      const state = store.getState();

      expect(state.id).toBe('test-1');
      expect(state.nome).toBe('Test Championship');
      expect(state.teams).toEqual([]);
    });

    it('should add teams and persist state', async () => {
      const { createChampionshipStore } = await import('./app/championship-store.js');
      
      const initial = {
        id: 'test-2',
        nome: 'Test Championship',
        formato: 'liga',
        cfg: { turnos: 1 },
        teams: [],
        matches: [],
        categories: [],
        branding: { accent: '#2fcf6b' },
      };

      const store = createChampionshipStore(initial);
      
      store.addTeam();
      store.addTeam();
      
      let state = store.getState();
      expect(state.teams).toHaveLength(2);
      expect(state.teams[0].nome).toBe('Equipe 1');
      expect(state.teams[1].nome).toBe('Equipe 2');
      
      store.updateTeamName(state.teams[0].id, 'My Team');
      state = store.getState();
      expect(state.teams[0].nome).toBe('My Team');
    });

    it('should return communication mutation results while updating state', async () => {
      const { createChampionshipStore } = await import('./app/championship-store.js');
      const store = createChampionshipStore({ id: 'test-comms', nome: 'Comms', teams: [], matches: [], categories: [] });

      const announcement = store.addAnnouncement({ title: 'Aviso', body: 'Jogo confirmado.' });
      expect(announcement.ok).toBe(true);
      expect(store.getState().announcements).toHaveLength(1);
      expect(store.publishAnnouncement(announcement.announcement.id).ok).toBe(true);

      const poll = store.addPoll({ question: 'Horário?', options: ['18h', '20h'] });
      expect(poll.ok).toBe(true);
      expect(store.publishPoll(poll.poll.id).ok).toBe(true);
      expect(store.votePoll(poll.poll.id, poll.poll.options[0].id, 'device-1').ok).toBe(true);
    });

    it('should manage categories', async () => {
      const { createChampionshipStore } = await import('./app/championship-store.js');
      
      const initial = {
        id: 'test-3',
        nome: 'Test Championship',
        formato: 'liga',
        cfg: { turnos: 1 },
        teams: [],
        matches: [],
        categories: [],
        branding: { accent: '#2fcf6b' },
      };

      const store = createChampionshipStore(initial);
      
      store.addCategory();
      let state = store.getState();
      expect(state.categories).toHaveLength(2);
      
      const catId = state.categories[1].id;
      store.renameCategory(catId, 'Sub-15');
      state = store.getState();
      expect(state.categories[1].nome).toBe('Sub-15');
    });

    it('should manage phases', async () => {
      const { createChampionshipStore } = await import('./app/championship-store.js');
      
      const initial = {
        id: 'test-4',
        nome: 'Test Championship',
        formato: 'liga',
        cfg: { turnos: 1 },
        teams: [],
        matches: [],
        categories: [],
        branding: { accent: '#2fcf6b' },
      };

      const store = createChampionshipStore(initial);
      
      store.addPhase();
      let state = store.getState();
      const category = state.categories[0];
      expect(category.phases).toHaveLength(2);
      
      const phaseId = category.phases[1].id;
      store.renamePhase(phaseId, 'Fase Final');
      state = store.getState();
      expect(state.categories[0].phases[1].nome).toBe('Fase Final');
    });

    it('should generate liga phase matches', async () => {
      const { createChampionshipStore } = await import('./app/championship-store.js');
      
      const initial = {
        id: 'test-5',
        nome: 'Test Championship',
        formato: 'liga',
        cfg: { turnos: 1 },
        teams: [
          { id: 't1', nome: 'Team A', roster: [] },
          { id: 't2', nome: 'Team B', roster: [] },
          { id: 't3', nome: 'Team C', roster: [] },
          { id: 't4', nome: 'Team D', roster: [] },
        ],
        matches: [],
        categories: [],
        branding: { accent: '#2fcf6b' },
      };

      const store = createChampionshipStore(initial);
      const result = store.generateActivePhase();
      
      expect(result.ok).toBe(true);
      const state = store.getState();
      expect(state.matches).toHaveLength(6); // 4 teams, round robin = 6 matches
      expect(state.matches.every(m => m.hg === null && m.ag === null)).toBe(true);
    });

    it('should generate grupos phase matches', async () => {
      const { createChampionshipStore } = await import('./app/championship-store.js');
      
      const initial = {
        id: 'test-6',
        nome: 'Test Championship',
        formato: 'grupos',
        cfg: { turnos: 1, nGrupos: 2 },
        teams: [
          { id: 't1', nome: 'Team A', roster: [] },
          { id: 't2', nome: 'Team B', roster: [] },
          { id: 't3', nome: 'Team C', roster: [] },
          { id: 't4', nome: 'Team D', roster: [] },
        ],
        matches: [],
        categories: [],
        branding: { accent: '#2fcf6b' },
      };

      const store = createChampionshipStore(initial);
      const result = store.generateActivePhase();
      
      expect(result.ok).toBe(true);
      const state = store.getState();
      expect(state.grupos).toHaveLength(2);
      expect(state.matches.length).toBeGreaterThan(0);
      expect(state.matches.every(m => typeof m.grupo === 'number')).toBe(true);
    });

    it('should manage athletes roster', async () => {
      const { createChampionshipStore } = await import('./app/championship-store.js');
      
      const initial = {
        id: 'test-7',
        nome: 'Test Championship',
        formato: 'liga',
        cfg: { turnos: 1 },
        teams: [
          { id: 'team-1', nome: 'Team A', roster: [] },
        ],
        matches: [],
        categories: [],
        branding: { accent: '#2fcf6b' },
      };

      const store = createChampionshipStore(initial);
      
      const result = store.addAthlete('team-1', { nome: 'Player 1', numero: '10' });
      expect(result.ok).toBe(true);
      
      let state = store.getState();
      expect(state.teams[0].roster).toHaveLength(1);
      expect(state.teams[0].roster[0].nome).toBe('Player 1');
      
      const athleteId = state.teams[0].roster[0].id;
      store.updateAthlete('team-1', athleteId, { nome: 'Player 1 Updated' });
      state = store.getState();
      expect(state.teams[0].roster[0].nome).toBe('Player 1 Updated');
      
      store.removeAthlete('team-1', athleteId);
      state = store.getState();
      expect(state.teams[0].roster).toHaveLength(0);
    });

    it('should update match scores', async () => {
      const { createChampionshipStore } = await import('./app/championship-store.js');
      
      const initial = {
        id: 'test-8',
        nome: 'Test Championship',
        formato: 'liga',
        cfg: { turnos: 1, winPts: 3, drawPts: 1, lossPts: 0 },
        teams: [
          { id: 't1', nome: 'Team A', roster: [] },
          { id: 't2', nome: 'Team B', roster: [] },
        ],
        matches: [],
        categories: [],
        branding: { accent: '#2fcf6b' },
      };

      const store = createChampionshipStore(initial);
      store.generateActivePhase();
      
      let state = store.getState();
      const matchId = state.matches[0].id;
      
      const result = store.setScore(matchId, 'hg', 2);
      expect(result.ok).toBe(true);
      expect(result.after.hg).toBe(2);
      
      store.setScore(matchId, 'ag', 1);
      state = store.getState();
      const match = state.matches.find(m => m.id === matchId);
      expect(match.hg).toBe(2);
      expect(match.ag).toBe(1);
    });

    it('should manage branding', async () => {
      const { createChampionshipStore } = await import('./app/championship-store.js');
      
      const initial = {
        id: 'test-9',
        nome: 'Test Championship',
        formato: 'liga',
        cfg: { turnos: 1 },
        teams: [],
        matches: [],
        categories: [],
        branding: { accent: '#2fcf6b' },
        sponsors: [],
      };

      const store = createChampionshipStore(initial);
      
      store.setAccent('#ff0000');
      let state = store.getState();
      expect(state.branding.accent).toBe('#ff0000');
      
      store.setBrandImage('logo', 'https://example.com/logo.png');
      state = store.getState();
      expect(state.branding.logo).toBe('https://example.com/logo.png');
      
      const sponsorResult = store.addSponsor({ name: 'Sponsor 1', url: 'https://sponsor.com' });
      expect(sponsorResult.ok).toBe(true);
      state = store.getState();
      expect(state.sponsors).toHaveLength(1);
    });

    it('should persist custom discipline weights and criterion order', async () => {
      const { createChampionshipStore } = await import('./app/championship-store.js');
      const store = createChampionshipStore({ id: 'test-scoring', nome: 'Test', formato: 'liga', cfg: { turnos: 1 }, teams: [], matches: [], categories: [], branding: { accent: '#2fcf6b' } });
      const result = store.updateScoring({ winPts: 3, drawPts: 1, lossPts: 0, discYellow: 1, discRed: 2, yellowLimit: 3, criterios: ['P', 'DISC', 'SG'], confrontoDireto: true });
      expect(result.ok).toBe(true);
      expect(store.getState().cfg).toMatchObject({ discYellow: 1, discRed: 2, criterios: ['P', 'DISC', 'SG'] });
    });

    it('should manage collaborators', async () => {
      const { createChampionshipStore } = await import('./app/championship-store.js');
      
      const initial = {
        id: 'test-10',
        nome: 'Test Championship',
        formato: 'liga',
        cfg: { turnos: 1 },
        teams: [],
        matches: [],
        categories: [],
        branding: { accent: '#2fcf6b' },
        ownerUid: 'user-1',
        ownerEmail: 'owner@test.com',
        collaborators: [],
      };

      const store = createChampionshipStore(initial);
      const mockUser = { uid: 'user-1', email: 'owner@test.com' };
      
      const result = store.inviteManager(mockUser, { email: 'collab@test.com', role: 'results' });
      expect(result.ok).toBe(true);
      
      let state = store.getState();
      expect(state.collaborators).toHaveLength(1);
      expect(state.collaborators[0].email).toBe('collab@test.com');
      
      store.changeManagerRole(mockUser, state.collaborators[0].id, 'admin');
      state = store.getState();
      expect(state.collaborators[0].role).toBe('admin');
    });
  });

  describe('Standings Computation', () => {
    it('should compute correct standings for liga', async () => {
      const { createChampionshipStore } = await import('./app/championship-store.js');
      const { computeStandings } = await import('./app/standings.js');
      
      const initial = {
        id: 'test-standings',
        nome: 'Test Championship',
        formato: 'liga',
        cfg: { turnos: 1, winPts: 3, drawPts: 1, lossPts: 0 },
        teams: [
          { id: 't1', nome: 'Team A', roster: [] },
          { id: 't2', nome: 'Team B', roster: [] },
          { id: 't3', nome: 'Team C', roster: [] },
        ],
        matches: [],
        categories: [],
        branding: { accent: '#2fcf6b' },
      };

      const store = createChampionshipStore(initial);
      store.generateActivePhase();
      
      let state = store.getState();
      const matches = state.matches;
      
      // Set scores: A beats B 2-0, A beats C 3-1, B beats C 1-0
      const matchAB = matches.find(m => (m.home === 0 && m.away === 1) || (m.home === 1 && m.away === 0));
      const matchAC = matches.find(m => (m.home === 0 && m.away === 2) || (m.home === 2 && m.away === 0));
      const matchBC = matches.find(m => (m.home === 1 && m.away === 2) || (m.home === 2 && m.away === 1));
      
      if (matchAB) {
        if (matchAB.home === 0) { store.setScore(matchAB.id, 'hg', 2); store.setScore(matchAB.id, 'ag', 0); }
        else { store.setScore(matchAB.id, 'hg', 0); store.setScore(matchAB.id, 'ag', 2); }
      }
      if (matchAC) {
        if (matchAC.home === 0) { store.setScore(matchAC.id, 'hg', 3); store.setScore(matchAC.id, 'ag', 1); }
        else { store.setScore(matchAC.id, 'hg', 1); store.setScore(matchAC.id, 'ag', 3); }
      }
      if (matchBC) {
        if (matchBC.home === 1) { store.setScore(matchBC.id, 'hg', 1); store.setScore(matchBC.id, 'ag', 0); }
        else { store.setScore(matchBC.id, 'hg', 0); store.setScore(matchBC.id, 'ag', 1); }
      }
      
      state = store.getState();
      const standings = state.matches.length > 0 ? computeStandings(
        state.teams,
        state.teams.map((_, i) => i),
        state.matches,
        state.cfg
      ) : [];
      
      expect(standings.length).toBe(3);
      expect(standings[0].team).toBe(0); // Team A first (6 pts)
      expect(standings[1].team).toBe(1); // Team B second (3 pts)
      expect(standings[2].team).toBe(2); // Team C third (0 pts)
      expect(standings[0].P).toBe(6);
      expect(standings[1].P).toBe(3);
      expect(standings[2].P).toBe(0);
    });
  });

  describe('Bracket Generation', () => {
    it('should generate bracket for mata phase', async () => {
      const { createChampionshipStore } = await import('./app/championship-store.js');
      
      const initial = {
        id: 'test-bracket',
        nome: 'Test Championship',
        formato: 'mata',
        cfg: { turnos: 1 },
        teams: [
          { id: 't1', nome: 'Team A', roster: [] },
          { id: 't2', nome: 'Team B', roster: [] },
          { id: 't3', nome: 'Team C', roster: [] },
          { id: 't4', nome: 'Team D', roster: [] },
        ],
        matches: [],
        categories: [],
        branding: { accent: '#2fcf6b' },
      };

      const store = createChampionshipStore(initial);
      const result = store.generateActivePhase();
      
      expect(result.ok).toBe(true);
      const state = store.getState();
      expect(state.bracket).toBeTruthy();
      expect(state.bracket.rounds).toHaveLength(2); // 4 teams = 2 rounds
      expect(state.bracket.rounds[0]).toHaveLength(2); // 2 semifinals
      expect(state.bracket.rounds[1]).toHaveLength(1); // 1 final
      expect(state.bracket.third).toBeTruthy();
    });

    it('should advance bracket when scores are set', async () => {
      const { createChampionshipStore } = await import('./app/championship-store.js');
      
      const initial = {
        id: 'test-bracket-advance',
        nome: 'Test Championship',
        formato: 'mata',
        cfg: { turnos: 1, maoUnica: true },
        teams: [
          { id: 't1', nome: 'Team A', roster: [] },
          { id: 't2', nome: 'Team B', roster: [] },
          { id: 't3', nome: 'Team C', roster: [] },
          { id: 't4', nome: 'Team D', roster: [] },
        ],
        matches: [],
        categories: [],
        branding: { accent: '#2fcf6b' },
      };

      const store = createChampionshipStore(initial);
      store.generateActivePhase();
      
      let state = store.getState();
      const semis = state.bracket.rounds[0];
      
      // Set semi-final scores
      const semi1 = semis[0];
      const semi2 = semis[1];
      
      // A beats B 2-0
      store.setTieScore(semi1.id, 'ag1', 2);
      store.setTieScore(semi1.id, 'bg1', 0);
      // C beats D 1-0
      store.setTieScore(semi2.id, 'ag1', 1);
      store.setTieScore(semi2.id, 'bg1', 0);
      
      state = store.getState();
      
      // Get updated ties from new state
      const updatedSemi1 = state.bracket.rounds[0][0];
      const updatedSemi2 = state.bracket.rounds[0][1];
      
      expect(updatedSemi1.winner).toBe(updatedSemi1.a);
      expect(updatedSemi2.winner).toBe(updatedSemi2.a);
      
      const final = state.bracket.rounds[1][0];
      expect(final.a).toBe(semi1.a);
      expect(final.b).toBe(semi2.a);
    });
  });

  describe('Subscription and Reactivity', () => {
    it('should notify subscribers on state change', async () => {
      const { createChampionshipStore } = await import('./app/championship-store.js');
      
      const initial = {
        id: 'test-sub',
        nome: 'Test Championship',
        formato: 'liga',
        cfg: { turnos: 1 },
        teams: [],
        matches: [],
        categories: [],
        branding: { accent: '#2fcf6b' },
      };

      const store = createChampionshipStore(initial);
      const notifications = [];
      const unsubscribe = store.subscribe((state) => notifications.push(state));
      
      store.addTeam();
      store.addTeam();
      store.setAccent('#ff0000');
      
      expect(notifications).toHaveLength(3);
      expect(notifications[2].teams).toHaveLength(2);
      expect(notifications[2].branding.accent).toBe('#ff0000');
      
      unsubscribe();
      store.addTeam();
      expect(notifications).toHaveLength(3); // No new notification
    });
  });
});


