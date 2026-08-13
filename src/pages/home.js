import { navigate } from '../app/router.js';
import { listMine, removeChampionship } from '../services/championships.js';
import { logout } from '../services/firebase.js';

export async function renderHome(root) {
  root.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/" data-link>ARENA</a><div class="actions"><button class="btn ghost" data-tutorial>Tutorial</button><button class="btn ghost" data-logout>Sair</button></div></header><main class="section"><div class="actions" style="justify-content:space-between"><div><small>PAINEL DO ORGANIZADOR</small><h1>Meus campeonatos</h1></div><button class="btn primary" data-new>+ Criar campeonato</button></div><div data-list class="grid" style="margin-top:24px"><div class="card">Carregando campeonatos...</div></div></main></div>`;
  root.querySelector('[data-logout]').onclick = async () => { await logout(); navigate('/'); };
  root.querySelector('[data-tutorial]').onclick = () => navigate('/tutorial');
  root.querySelector('[data-new]').onclick = () => navigate('/campeonatos/novo');
  const list = root.querySelector('[data-list]');
  try { const championships = await listMine(); list.innerHTML = championships.length ? championships.map((item) => `<article class="card"><small>${item.formato || 'liga'}</small><h3>${item.nome}</h3><p class="muted">${item.status === 'encerrado' ? 'Encerrado' : 'Ativo'} · atualizado em ${new Date(item.updated || Date.now()).toLocaleDateString('pt-BR')}</p><div class="actions"><button class="btn primary" data-open="${item.id}">Abrir</button><button class="btn ghost" data-delete="${item.id}">Excluir</button></div></article>`).join('') : '<div class="card"><h3>Nenhum campeonato ainda</h3><p class="muted">Crie seu primeiro campeonato para começar.</p></div>'; list.querySelectorAll('[data-open]').forEach((button) => button.onclick = () => navigate(`/campeonatos/${button.dataset.open}`)); list.querySelectorAll('[data-delete]').forEach((button) => button.onclick = async () => { if (confirm('Excluir este campeonato?')) { await removeChampionship(button.dataset.delete); renderHome(root); } }); } catch (error) { list.innerHTML = `<div class="card"><p>Não foi possível carregar seus campeonatos.</p><p class="muted">${error.message || error}</p></div>`; }
}
