// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const FIXTURES = [
  { id: 'a', nome: 'Copa do Bairro', formato: 'liga', modalidade: 'futebol', status: 'andamento', cidade: 'Belo Horizonte', estado: 'MG', publicSlug: '', updated: 3 },
  { id: 'b', nome: 'Torneio de Vôlei', formato: 'grupos', modalidade: 'voleibol', status: 'inscricoes', cidade: 'São Paulo', estado: 'SP', publicSlug: 'volei-sp', updated: 2 },
  { id: 'c', nome: 'Liga Encerrada 2025', formato: 'liga', modalidade: 'futebol', status: 'encerrado', cidade: 'Belo Horizonte', estado: 'MG', publicSlug: '', updated: 1 },
  { id: 'd', nome: 'Rascunho Nunca Publicado', formato: 'liga', modalidade: 'futebol', status: 'rascunho', cidade: 'Rio de Janeiro', estado: 'RJ', publicSlug: '', updated: 4 },
];

const { listPublicDirectory } = vi.hoisted(() => ({ listPublicDirectory: vi.fn() }));
vi.mock('../services/championships.js', () => ({ listPublicDirectory }));

const { renderChampionshipsDirectory } = await import('./championships-directory.js');

describe('championships directory', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    listPublicDirectory.mockReset().mockResolvedValue(FIXTURES);
  });

  it('nunca lista rascunhos, mesmo tendo doc público', async () => {
    const root = document.querySelector('#app');
    await renderChampionshipsDirectory(root);
    expect(root.textContent).not.toMatch(/Rascunho Nunca Publicado/);
  });

  it('aba "acontecendo agora" mostra inscrições/andamento, não encerrados', async () => {
    const root = document.querySelector('#app');
    await renderChampionshipsDirectory(root);
    expect(root.textContent).toMatch(/Copa do Bairro/);
    expect(root.textContent).toMatch(/Torneio de Vôlei/);
    expect(root.textContent).not.toMatch(/Liga Encerrada 2025/);
  });

  it('aba "encerrados" mostra só status encerrado', async () => {
    const root = document.querySelector('#app');
    await renderChampionshipsDirectory(root);
    root.querySelector('[data-tab="passado"]').click();
    expect(root.textContent).toMatch(/Liga Encerrada 2025/);
    expect(root.textContent).not.toMatch(/Copa do Bairro/);
  });

  it('filtra por estado, cidade, nome e modalidade combinados', async () => {
    const root = document.querySelector('#app');
    await renderChampionshipsDirectory(root);
    root.querySelector('[data-filter-estado]').value = 'MG';
    root.querySelector('[data-filter-estado]').dispatchEvent(new Event('change'));
    expect(root.textContent).toMatch(/Copa do Bairro/);
    expect(root.textContent).not.toMatch(/Torneio de Vôlei/);

    root.querySelector('[data-filter-nome]').value = 'vôlei';
    root.querySelector('[data-filter-nome]').dispatchEvent(new Event('input'));
    root.querySelector('[data-filter-estado]').value = '';
    root.querySelector('[data-filter-estado]').dispatchEvent(new Event('change'));
    expect(root.textContent).toMatch(/Torneio de Vôlei/);
    expect(root.textContent).not.toMatch(/Copa do Bairro/);
  });

  it('link do card usa a URL de slug quando existe, senão cai pra /publico/:id', async () => {
    const root = document.querySelector('#app');
    await renderChampionshipsDirectory(root);
    expect(root.querySelector('a[href="/c/volei-sp"]')).toBeTruthy();
    expect(root.querySelector('a[href="/publico/a"]')).toBeTruthy();
  });
});
