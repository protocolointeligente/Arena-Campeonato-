import { navigate } from '../app/router-v2.js';
import { listMine, removeChampionship, saveChampionship } from '../services/championships.js';
import { logout } from '../services/firebase.js';
import { parseChampionshipImport } from '../app/exports.js';
import { toast } from '../app/ui.js';
import { isSuperadmin } from '../services/superadmin.js';
import { icon } from '../app/icons.js';

const ONBOARDING_STEPS = [
  ['Crie o campeonato', 'Clique em "+ Criar meu primeiro campeonato" abaixo. Escolha nome, modalidade e sistema de disputa (liga, grupos, mata-mata...).'],
  ['Configure', 'Na aba "Configurações" (barra lateral), ajuste pontuação, critérios de desempate e, se for cobrar, a taxa de inscrição.'],
  ['Cadastre as equipes', 'Na aba "Equipes", adicione os times você mesmo — ou abra a aba "Inscrições" e mande o link público pros times se inscreverem sozinhos.'],
  ['Gere os jogos', 'Na aba "Fases", gere o calendário automaticamente a partir das equipes cadastradas.'],
  ['Lance os placares', 'Na aba "Jogos", registre o resultado de cada partida conforme acontece — a tabela se atualiza sozinha.'],
  ['Publique pra torcida', 'Na aba "Publicação", copie o link do portal público e compartilhe — todo mundo acompanha em tempo real, sem precisar de login.'],
];

function onboardingHTML() {
  return `<div class="card onboarding-card">
    <small>PRIMEIROS PASSOS</small>
    <h2>Vamos criar seu primeiro campeonato</h2>
    <p class="muted">Leva menos de 5 minutos. Siga a ordem abaixo.</p>
    <ol class="onboarding-steps">${ONBOARDING_STEPS.map(([title, text], i) => `<li><span class="onboarding-num">${i + 1}</span><div><strong>${title}</strong><p class="muted">${text}</p></div></li>`).join('')}</ol>
    <button class="btn primary" data-new>+ Criar meu primeiro campeonato</button>
  </div>`;
}

export async function renderHome(root) {
  root.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/" data-link>ARENA</a><div class="actions"><button class="btn ghost" data-explorar>${icon('globe', 16)} Campeonatos</button><button class="btn ghost" data-import-json>⬆ Importar .json</button><button class="btn ghost" data-planos>${icon('creditCard', 16)} Planos</button><button class="btn ghost" data-tutorial>Tutorial</button><button class="btn ghost" data-logout>Sair</button></div></header><main class="section"><div class="actions" style="justify-content:space-between"><div><small>PAINEL DO ORGANIZADOR</small><h1>Meus campeonatos</h1></div><button class="btn primary" data-new>+ Criar campeonato</button></div><div data-list class="grid" style="margin-top:24px"><div class="card">Carregando campeonatos...</div></div></main></div>`;
  root.querySelector('[data-logout]').onclick = async () => { await logout(); navigate('/'); };
  root.querySelector('[data-explorar]').onclick = () => navigate('/campeonatos');
  root.querySelector('[data-tutorial]').onclick = () => navigate('/tutorial');
  root.querySelectorAll('[data-new]').forEach((button) => button.onclick = () => navigate('/campeonatos/novo'));
  root.querySelector('[data-import-json]').onclick = () => { const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json'; input.onchange = () => { const file = input.files[0]; if (!file) {return;} const reader = new FileReader(); reader.onload = async () => { const result = parseChampionshipImport(String(reader.result)); if (!result.ok) {return toast('Arquivo inválido');} try { await saveChampionship(result.value); toast('Importado para sua conta'); navigate(`/campeonatos/${result.value.id}`); } catch (error) { toast(error.message || 'Não foi possível importar'); } }; reader.readAsText(file); }; input.click(); };
  root.querySelector('[data-planos]').onclick = () => navigate('/planos');
  const list = root.querySelector('[data-list]');
  try { const championships = await listMine(); list.innerHTML = championships.length ? championships.map((item) => `<article class="card"><small>${item.formato || 'liga'}</small><h3>${item.nome}</h3><p class="muted">${item.status === 'encerrado' ? 'Encerrado' : 'Ativo'} · atualizado em ${new Date(item.updated || Date.now()).toLocaleDateString('pt-BR')}</p><div class="actions"><button class="btn primary" data-open="${item.id}">Abrir</button><button class="btn ghost" data-delete="${item.id}">Excluir</button></div></article>`).join('') : onboardingHTML(); list.querySelectorAll('[data-new]').forEach((button) => button.onclick = () => navigate('/campeonatos/novo')); list.querySelectorAll('[data-open]').forEach((button) => button.onclick = () => navigate(`/campeonatos/${button.dataset.open}`)); list.querySelectorAll('[data-delete]').forEach((button) => button.onclick = async () => { if (confirm('Excluir este campeonato?')) { await removeChampionship(button.dataset.delete); renderHome(root); } }); } catch (error) { list.innerHTML = `<div class="card"><p>Não foi possível carregar seus campeonatos.</p><p class="muted">${error.message || error}</p></div>`; }
  isSuperadmin().then((value) => { if (!value) {return;} const actions = root.querySelector('.topbar .actions'); if (!actions) {return;} actions.insertAdjacentHTML('afterbegin', `<button class="btn ghost" data-superadmin>${icon('zap', 16)} Superadmin</button>`); root.querySelector('[data-superadmin]').onclick = () => navigate('/superadmin'); }).catch(() => {});
}


