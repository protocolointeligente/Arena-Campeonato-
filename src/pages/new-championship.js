import { navigate } from '../app/router-v2.js';
import { saveChampionship } from '../services/championships.js';
import { uid } from '../app/utils.ts';
import { CHAMPIONSHIP_TEMPLATES, COMPETITION_MODELS, templateConfig } from '../app/templates.js';

export function renderNewChampionship(root) {
  root.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/" data-link>ARENA</a><button class="btn ghost" data-back>← Voltar</button></header><main class="section"><form class="card" style="max-width:700px;margin:auto"><small>NOVO CAMPEONATO</small><h1>Vamos começar</h1><label class="muted">Nome<input name="name" required maxlength="100" style="display:block;width:100%;margin:8px 0 16px;padding:12px" placeholder="Ex.: Copa do Bairro 2026"></label><label class="muted">Modalidade<select name="template" style="display:block;width:100%;margin:8px 0 16px;padding:12px">${Object.entries(CHAMPIONSHIP_TEMPLATES).map(([key, value]) => `<option value="${key}">${value.label}</option>`).join('')}</select></label><label class="muted">Sistema de disputa<select name="model" style="display:block;width:100%;margin:8px 0 16px;padding:12px"><option value="">Padrão da modalidade</option>${Object.entries(COMPETITION_MODELS).map(([key, value]) => `<option value="${key}">${value.label}</option>`).join('')}</select></label><p class="muted" data-error></p><button class="btn primary" type="submit">Criar campeonato</button></form></main></div>`;
  root.querySelector('[data-back]').onclick = () => navigate('/');
  root.querySelector('form').onsubmit = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = {
      id: uid(), created: Date.now(), updated: Date.now(), nome: data.get('name'), modalidade: templateConfig(data.get('template'), data.get('model')).modalidade, modelo: templateConfig(data.get('template'), data.get('model')).modelo, scoreType: templateConfig(data.get('template'), data.get('model')).scoreType, rosterMode: templateConfig(data.get('template'), data.get('model')).rosterMode, formato: templateConfig(data.get('template'), data.get('model')).formato, status: 'rascunho', publico: true,
      branding: { accent: '#2fcf6b' }, collaborators: [], teams: [], categories: [], matches: [], grupos: [],
      cfg: templateConfig(data.get('template'), data.get('model')).cfg,
    };
    try { await saveChampionship(value); navigate(`/campeonatos/${value.id}`); }
    catch (error) { root.querySelector('[data-error]').textContent = error.message || 'Não foi possível criar.'; }
  };
}
