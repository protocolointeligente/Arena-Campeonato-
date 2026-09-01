import { navigate } from '../app/router-v2.js';
const steps = ['Crie sua conta', 'Crie o campeonato', 'Cadastre equipes e atletas', 'Gere os jogos', 'Lance resultados', 'Publique para a torcida', 'Escolha seu plano e pague via Pix'];
export function renderTutorial(root) { root.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/" data-link>ARENA</a><button class="btn ghost" data-back>← Voltar</button></header><main class="section"><small>GUIA ARENA</small><h1>Como organizar seu <em>campeonato</em></h1><div class="grid">${steps.map((x,i)=>`<article class="card"><b>0${i+1}</b><h3>${x}</h3><p class="muted">Siga esta etapa no painel para avançar com segurança.</p></article>`).join('')}</div></main></div>`; root.querySelector('[data-back]').onclick = () => navigate('/'); }


