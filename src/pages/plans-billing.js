import { navigate } from '../app/router-v2.js';
import { esc } from '../app/utils.ts';
import { db } from '../services/firebase.js';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { PLAN_DEFINITIONS } from '../app/plans.js';
import { toast } from '../app/ui.js';

export async function renderPlansBilling(root) {
  root.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/">ARENA</a><button class="btn ghost" data-back>← Superadmin</button></header><main class="section"><div class="hero" style="padding-top:10px;min-height:0"><h1>PLANOS E <em>COBRANÇA</em></h1><p class="muted">Gerencie assinaturas de todos os usuários.</p></div><div data-body><div class="card">Carregando cobrança...</div></div></main></div>`;
  root.querySelector('[data-back]').onclick = () => navigate('/superadmin');
  const body = root.querySelector('[data-body]');

  async function load() {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderBody(users);
    } catch (error) {
      body.innerHTML = `<div class="card"><h2>Erro</h2><p class="muted">${esc(error.message)}</p></div>`;
    }
  }

  function renderBody(users) {
    const pending = users.filter((u) => u.billing?.status === 'pending');
    const pastDue = users.filter((u) => u.billing?.status === 'past_due');
    body.innerHTML = `<div class="grid" style="margin-top:18px"><div class="card"><small>TOTAL DE USUÁRIOS</small><h2>${users.length}</h2></div>${Object.entries(PLAN_DEFINITIONS).map(([pid, p]) => `<div class="card"><small>${esc(p.name.toUpperCase())}</small><h2>${users.filter((u) => (u.billing?.planId || 'free') === pid).length}</h2></div>`).join('')}<div class="card"><small>PENDENTES</small><h2>${pending.length}</h2></div><div class="card"><small>PAGAMENTO ATRASADO</small><h2>${pastDue.length}</h2></div></div><div class="card" style="margin-top:16px"><h2>Todos os usuários</h2><p class="muted">Ativação/renovação agora é automática via webhook do Mercado Pago/Asaas. O seletor abaixo é só pra correção manual de emergência (ex.: webhook falhou).</p>${users.length ? users.map((item) => `<div class="row" style="padding:10px 0;border-bottom:1px solid var(--line)"><span style="flex:1;min-width:200px"><strong>${esc(item.email || item.id)}</strong><br><span class="muted">Plano: ${esc(item.billing?.planId || 'free')} · ${esc(item.billing?.status || 'none')} · ${esc(item.billing?.provider || '—')}</span></span><select data-change-plan="${esc(item.id)}" style="width:140px">${Object.entries(PLAN_DEFINITIONS).map(([pid, p]) => `<option value="${pid}" ${item.billing?.planId === pid ? 'selected' : ''}>${p.name}</option>`).join('')}</select><button class="btn ghost sm" data-set-plan="${esc(item.id)}">Alterar</button></div>`).join('') : '<p class="muted">Nenhum usuário.</p>'}</div>`;
    body.querySelectorAll('[data-set-plan]').forEach((button) => {
      button.onclick = async () => {
        const userId = button.dataset.setPlan;
        const select = body.querySelector(`[data-change-plan="${userId}"]`);
        const planId = select.value;
        try {
          await updateDoc(doc(db, 'users', userId), { 'billing.planId': planId, 'billing.status': 'active', 'billing.updatedAt': Date.now() });
          toast(`Plano alterado para ${planId}`);
          load();
        } catch { toast('Erro ao alterar plano'); }
      };
    });
  }

  await load();
}


