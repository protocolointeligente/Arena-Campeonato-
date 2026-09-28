// @vitest-environment jsdom
// Varredura do painel do campeonato: abre cada aba e aciona cada botão/campo, falhando se
// qualquer ação lançar exceção (síncrona, promise rejeitada ou erro global). Pega a classe de
// bug que derrubava a tela inteira ("Algo deu errado") ao clicar em ações como "Remover fase".
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

vi.mock('../../services/firebase.js', () => ({
  auth: { currentUser: { uid: 'owner', email: 'owner@arena.test' } },
  db: {},
  storage: {},
}));
vi.mock('../../services/championships.js', () => ({
  getChampionship: vi.fn(),
  saveChampionship: vi.fn(async () => {}),
  checkSlugAvailable: vi.fn(async () => true),
  getEngagementStats: vi.fn(async () => ({ views: 0, sponsorClicks: {} })),
}));
vi.mock('../../services/registrations.js', () => ({
  listRegistrationsPage: vi.fn(async () => ({ items: [], nextCursor: null })),
  updateRegistration: vi.fn(async () => {}),
}));
vi.mock('../../services/audit.js', () => ({
  addAudit: vi.fn(async () => {}),
  listAudit: vi.fn(async () => []),
}));
vi.mock('../../services/pdf.js', () => ({ downloadChampionshipPDF: vi.fn(async () => {}) }));
vi.mock('../../services/superadmin.js', () => ({ isSuperadmin: vi.fn(async () => false) }));
vi.mock('../../services/storage.js', () => ({
  uploadBrandImage: vi.fn(), uploadSponsorLogo: vi.fn(), deleteImageByUrl: vi.fn(),
  uploadAthletePhoto: vi.fn(), uploadTeamLogo: vi.fn(), uploadAnnouncementPhoto: vi.fn(),
}));

let currentAction = '(montagem)';
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function championshipFixture() {
  const teams = Array.from({ length: 8 }, (_, i) => ({
    id: `t${i}`, nome: `Equipe ${i + 1}`,
    roster: [{ id: `a${i}`, nome: `Atleta ${i + 1}`, numero: String(i + 1) }],
    staff: { tecnico: `Técnico ${i + 1}` },
  }));
  return {
    id: 'camp1', nome: 'Interclasse', modalidade: 'futsal', modelo: 'grupos', formato: 'grupos',
    status: 'andamento', ownerUid: 'owner', ownerEmail: 'owner@arena.test', collaborators: [],
    cfg: { turnos: 1, nGrupos: 2, winPts: 3, drawPts: 1, lossPts: 0, criterios: ['P', 'V', 'SG', 'GP'] },
    teams, matches: [], categories: [], branding: { accent: '#2fcf6b' },
  };
}

// Estado realista: 2 categorias, fase de grupos com jogos e placares + semifinal ligada.
async function richFixture() {
  const { createChampionshipStore } = await import('../../app/championship-store.js');
  const store = createChampionshipStore(championshipFixture());
  store.generateActivePhase();
  store.getState().matches.slice(0, 4).forEach((m) => { store.setScore(m.id, 'hg', '2'); store.setScore(m.id, 'ag', '1'); });
  store.addKnockoutPhase(4);
  store.addCategory();
  store.switchCategory(store.getState().categories[0].id);
  return JSON.parse(JSON.stringify(store.getState()));
}

describe('varredura do painel do campeonato', () => {
  const failures = [];
  let onError;
  let onRejection;

  beforeAll(() => {
    window.confirm = () => true;
    window.alert = () => {};
    window.prompt = () => 'Teste';
    window.open = () => null;
    window.scrollTo = () => {};
    URL.createObjectURL = () => 'blob:x';
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function () {};
    HTMLCanvasElement.prototype.getContext = () => null;
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });
    const short = (stack) => stack?.split('\n').slice(0, 3).join(' | ');
    onError = (event) => failures.push(`${currentAction}: erro global: ${short(event.error?.stack) || event.message}`);
    onRejection = (reason) => failures.push(`${currentAction}: promise rejeitada: ${short(reason?.stack) || reason}`);
    window.addEventListener('error', onError);
    process.on('unhandledRejection', onRejection);
  });

  afterAll(() => {
    window.removeEventListener('error', onError);
    process.off('unhandledRejection', onRejection);
  });

  // Mesmo campeonato já na semifinal (fase mata-mata ativa, chaveamento gerado).
  async function knockoutFixture() {
    const { createChampionshipStore } = await import('../../app/championship-store.js');
    const store = createChampionshipStore(await richFixture());
    const cat = () => store.getState().categories.find((c) => c.id === store.getState().activeCategoryId);
    store.getState().matches.forEach((m) => { store.setScore(m.id, 'hg', '1'); store.setScore(m.id, 'ag', '0'); });
    store.applyProgression(cat().phases[0].id, true);
    store.generateActivePhase();
    return JSON.parse(JSON.stringify(store.getState()));
  }

  it.each([
    ['fase de grupos', () => richFixture(), null],
    ['fase mata-mata', () => knockoutFixture(), ['overview', 'placar', 'fases', 'jogos', 'chave', 'classif', 'documentos']],
  ])('nenhuma aba ou ação lança erro (%s)', async (_name, makeFixture, onlyTabs) => {
    failures.length = 0;
    const { getChampionship } = await import('../../services/championships.js');
    const { renderChampionship } = await import('./index.js');
    const jspdf = await import('../../app/pdf-utils.js');
    const jsPDF = await jspdf.getJsPDF();
    jsPDF.API.save = () => {};

    window.history.replaceState({}, '', '/campeonatos/camp1');
    const fixture = await makeFixture();
    let root;
    // Remonta do zero antes de cada ação: uma ação destrutiva (remover categoria/fase) não
    // pode esvaziar os dados das próximas.
    const openTab = async (key) => {
      document.body.innerHTML = '<main id="main-content"></main>';
      root = document.getElementById('main-content');
      getChampionship.mockResolvedValue(JSON.parse(JSON.stringify(fixture)));
      await renderChampionship(root, 'camp1');
      await flush();
      root.querySelector(`.championship-tabs [data-tab="${key}"]`)?.click();
      await flush();
    };

    await openTab('overview');
    const allTabs = [...new Set([...root.querySelectorAll('[data-tab]')].map((b) => b.dataset.tab))];
    expect(allTabs.length).toBeGreaterThan(10);
    const tabs = onlyTabs || allTabs;

    const act = async (el, label) => {
      currentAction = label;
      try {
        if (el.matches('input[type="checkbox"], input[type="radio"]')) {
          el.checked = !el.checked;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (el.matches('input[type="file"]')) {
          return;
        } else if (el.matches('input, textarea')) {
          el.value = el.type === 'number' ? '2' : el.type === 'date' ? '2026-10-01' : el.type === 'time' ? '10:00' : el.type === 'color' ? '#123456' : 'Teste';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (el.matches('select')) {
          const opt = [...el.options].find((o) => o.value && !o.selected) || el.options[0];
          if (opt) {el.value = opt.value;}
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          el.click();
        }
        await flush();
        await flush();
      } catch (error) {
        failures.push(`${label}: ${error?.stack || error}`);
      }
    };

    const describeEl = (el) => {
      const data = [...el.attributes].filter((a) => a.name.startsWith('data-')).map((a) => `${a.name}=${a.value}`).join(' ');
      return `${el.tagName.toLowerCase()}[${data}] "${(el.textContent || '').trim().slice(0, 30)}"`;
    };

    const actions = [];
    const seen = new Map();
    for (const key of tabs) {
      await openTab(key);
      const content = root.querySelector('[data-content]');
      const count = content.querySelectorAll('button, input, select, textarea').length;
      for (let i = 0; i < count; i++) {
        await openTab(key);
        const el = root.querySelector('[data-content]').querySelectorAll('button, input, select, textarea')[i];
        if (!el || el.disabled) {continue;}
        // Mesmo tipo de controle (mesmos atributos data-*) repetido por partida/equipe: 2 bastam.
        const kind = `${key}|${el.tagName}|${[...el.attributes].map((a) => a.name).filter((n) => n.startsWith('data-')).sort().join(',')}|${el.getAttribute('type') || ''}`;
        seen.set(kind, (seen.get(kind) || 0) + 1);
        if (seen.get(kind) > 2) {continue;}
        const label = `aba ${key} → ${describeEl(el)}`;
        actions.push(label);
        await act(el, label);
        // botões dentro de modal aberto pela ação
        const modalSel = '#modalBg.open #modalBox button, #modalBg.open #modalBox input, #modalBg.open #modalBox select';
        const modalCount = document.querySelectorAll(modalSel).length;
        for (let j = 0; j < modalCount; j++) {
          const current = document.querySelectorAll(modalSel)[j];
          if (current && !current.disabled) {await act(current, `${label} ⟶ modal ${describeEl(current)}`);}
        }
      }
    }

    if (process.env.SWEEP_LOG) {process.stdout.write(`${actions.join('\n')}\n`);}
    expect(actions.length).toBeGreaterThan(onlyTabs ? 10 : 60);
    expect(failures, failures.join('\n\n')).toEqual([]);
  }, 600000);
});
