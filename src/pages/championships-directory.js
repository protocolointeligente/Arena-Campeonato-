import { navigate } from '../app/router-v2.js';
import { esc } from '../app/utils.ts';
import { listPublicDirectory } from '../services/championships.js';
import { MODALITIES } from '../app/templates.js';
import { UF_LIST } from './championship/tabs/config.js';

const CURRENT_STATUSES = ['inscricoes', 'andamento'];
const STATUS_LABEL = { inscricoes: 'Inscrições abertas', andamento: 'Em andamento', encerrado: 'Encerrado' };

export async function renderChampionshipsDirectory(root) {
  root.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/" data-link>ARENA</a><button class="btn ghost" data-back>← Voltar</button></header><main class="section"><div class="hero" style="padding-top:10px;min-height:0"><h1>CAMPEONATOS</h1><p class="muted">Encontre campeonatos acontecendo agora ou já encerrados.</p></div><div data-body><div class="card">Carregando campeonatos...</div></div></main></div>`;
  root.querySelector('[data-back]').onclick = () => navigate('/');
  const body = root.querySelector('[data-body]');

  // rascunho nunca aparece aqui — é um estado interno do organizador, não um campeonato público.
  let all = [];
  try { all = (await listPublicDirectory()).filter((c) => c.status !== 'rascunho'); }
  catch { body.innerHTML = '<div class="card">Não foi possível carregar os campeonatos.</div>'; return; }

  let tab = 'atual';
  const filters = { nome: '', estado: '', cidade: '', modalidade: '' };

  function matches(item) {
    const bucket = tab === 'atual' ? CURRENT_STATUSES.includes(item.status) : item.status === 'encerrado';
    if (!bucket) {return false;}
    if (filters.nome && !item.nome?.toLowerCase().includes(filters.nome.toLowerCase())) {return false;}
    if (filters.estado && item.estado !== filters.estado) {return false;}
    if (filters.cidade && !item.cidade?.toLowerCase().includes(filters.cidade.toLowerCase())) {return false;}
    if (filters.modalidade && item.modalidade !== filters.modalidade) {return false;}
    return true;
  }

  function cardHTML(item) {
    const href = item.publicSlug ? `/c/${item.publicSlug}` : `/publico/${item.id}`;
    const local = [item.cidade, item.estado].filter(Boolean).join(' - ');
    const modalityLabel = MODALITIES[item.modalidade]?.label || '';
    return `<article class="card"><h3>${esc(item.nome || 'Campeonato')}</h3><p class="muted">${[modalityLabel, local].filter(Boolean).map(esc).join(' · ')}</p><p class="muted" style="font-size:13px">${esc(STATUS_LABEL[item.status] || item.status)}</p><a class="btn ghost" style="width:100%;margin-top:8px" href="${esc(href)}" data-link>Ver campeonato</a></article>`;
  }

  function renderBody() {
    const results = all.filter(matches);
    body.innerHTML = `
      <div class="card">
        <div class="row" style="gap:8px">
          <button class="btn ${tab === 'atual' ? 'primary' : 'ghost'}" data-tab="atual">Acontecendo agora</button>
          <button class="btn ${tab === 'passado' ? 'primary' : 'ghost'}" data-tab="passado">Encerrados</button>
        </div>
        <div class="row" style="flex-wrap:wrap;margin-top:14px;gap:8px">
          <input data-filter-nome placeholder="Nome do campeonato" style="flex:2;min-width:180px" value="${esc(filters.nome)}">
          <input data-filter-cidade placeholder="Cidade" style="flex:1;min-width:140px" value="${esc(filters.cidade)}">
          <select data-filter-estado style="min-width:100px"><option value="">Estado (todos)</option>${UF_LIST.map((uf) => `<option value="${uf}" ${filters.estado === uf ? 'selected' : ''}>${uf}</option>`).join('')}</select>
          <select data-filter-modalidade style="min-width:160px"><option value="">Modalidade (todas)</option>${Object.entries(MODALITIES).map(([id, m]) => `<option value="${id}" ${filters.modalidade === id ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select>
        </div>
      </div>
      <div class="grid" style="margin-top:16px">${results.map(cardHTML).join('') || '<p class="muted">Nenhum campeonato encontrado com esses filtros.</p>'}</div>
    `;

    body.querySelectorAll('[data-tab]').forEach((button) => {
      button.onclick = () => { tab = button.dataset.tab; renderBody(); };
    });
    body.querySelector('[data-filter-nome]').oninput = (event) => { filters.nome = event.target.value; renderResultsOnly(); };
    body.querySelector('[data-filter-cidade]').oninput = (event) => { filters.cidade = event.target.value; renderResultsOnly(); };
    body.querySelector('[data-filter-estado]').onchange = (event) => { filters.estado = event.target.value; renderResultsOnly(); };
    body.querySelector('[data-filter-modalidade]').onchange = (event) => { filters.modalidade = event.target.value; renderResultsOnly(); };
  }

  // Reaplica só a grade de resultados (sem recriar os campos de filtro) pra não perder o foco
  // do input a cada tecla digitada.
  function renderResultsOnly() {
    const grid = body.querySelector('.grid');
    const results = all.filter(matches);
    grid.innerHTML = results.map(cardHTML).join('') || '<p class="muted">Nenhum campeonato encontrado com esses filtros.</p>';
  }

  renderBody();
}
