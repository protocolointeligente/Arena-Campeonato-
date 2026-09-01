import { navigate } from '../app/router-v2.js';
import { esc } from '../app/utils.ts';
import { db } from '../services/firebase.js';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';

export async function renderBetaHardening(root) {
  root.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/">ARENA</a><button class="btn ghost" data-back>← Superadmin</button></header><main class="section"><div class="hero" style="padding-top:10px;min-height:0"><h1>BETA & <em>HARDENING</em></h1><p class="muted">Gerenciamento de feature flags e programas beta.</p></div><div data-body><div class="card">Carregando beta...</div></div></main></div>`;
  root.querySelector('[data-back]').onclick = () => navigate('/superadmin');
  const body = root.querySelector('[data-body]');

  async function load() {
    try {
      const featuresSnap = await getDocs(collection(db, 'betaFeatures'));
      const features = featuresSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderBody(features);
    } catch (error) {
      body.innerHTML = `<div class="card"><h2>Erro</h2><p class="muted">${esc(error.message || 'Não foi possível carregar feature flags.')}</p></div>`;
    }
  }

  function renderBody(features) {
    body.innerHTML = `<div class="grid" style="margin-top:18px"><div class="card"><small>FLAGS ATIVAS</small><h2>${features.filter((f) => f.enabled).length}</h2></div><div class="card"><small>TOTAL</small><h2>${features.length}</h2></div><div class="card"><small>EM ROLLOUT</small><h2>${features.filter((f) => f.rollout && f.rollout > 0 && f.rollout < 100).length}</h2></div></div><div class="card" style="margin-top:16px"><h2>Feature Flags</h2>${features.length ? features.map((item) => `<div class="row" style="padding:10px 0;border-bottom:1px solid var(--line)"><div style="flex:1;min-width:200px"><strong>${esc(item.name || item.id)}</strong><br><span class="muted">${esc(item.description || '')}</span></div><div class="row" style="gap:8px;align-items:center"><label style="display:flex;align-items:center;gap:6px"><input type="checkbox" data-toggle="${esc(item.id)}" ${item.enabled ? 'checked' : ''}> Ativo</label><select data-rollout="${esc(item.id)}" style="width:100px"><option value="0" ${item.rollout === 0 ? 'selected' : ''}>Desligado</option><option value="10" ${item.rollout === 10 ? 'selected' : ''}>10%</option><option value="25" ${item.rollout === 25 ? 'selected' : ''}>25%</option><option value="50" ${item.rollout === 50 ? 'selected' : ''}>50%</option><option value="100" ${item.rollout === 100 ? 'selected' : ''}>100%</option></select></div><button class="btn ghost sm" data-edit="${esc(item.id)}">Editar</button></div>`).join('') : '<p class="muted">Nenhuma feature flag. Crie uma no Firestore (coleção betaFeatures).</p>'}</div>`;
    body.querySelectorAll('[data-toggle]').forEach((checkbox) => {
      checkbox.onchange = async () => {
        const id = checkbox.dataset.toggle;
        try {
          await updateDoc(doc(db, 'betaFeatures', id), { enabled: checkbox.checked, updatedAt: Date.now() });
        } catch { checkbox.checked = !checkbox.checked; alert('Erro ao atualizar flag'); }
      };
    });
    body.querySelectorAll('[data-rollout]').forEach((select) => {
      select.onchange = async () => {
        const id = select.dataset.rollout;
        try {
          await updateDoc(doc(db, 'betaFeatures', id), { rollout: Number(select.value), updatedAt: Date.now() });
        } catch { alert('Erro ao atualizar rollout'); }
      };
    });
    body.querySelectorAll('[data-edit]').forEach((button) => {
      button.onclick = () => alert('Edição detalhada: implemente modal com targeting (emails, grupos, % rollout).');
    });
  }

  await load();
}


