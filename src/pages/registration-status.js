import { navigate } from '../app/router-v2.js';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase.js';
import { esc } from '../app/utils.ts';
import { toastError } from '../components/Toast.js';
import { createRegistrationCheckout } from '../services/billing.js';
import { registrationStatusLabel } from './championship/tabs/registrations.js';

export function registrationStatusHTML({ championshipName, registration }) {
  const feeAmount = Number(registration.feeAmount || 0);
  const showPay = registration.status === 'approved' && registration.feeStatus === 'pending' && feeAmount > 0;
  const paid = registration.status === 'approved' && registration.feeStatus === 'paid';
  return `
    <div class="card" style="max-width:520px;margin:40px auto">
      <small>ACOMPANHAMENTO DE INSCRIÇÃO</small>
      <h1>${esc(championshipName)}</h1>
      <p><strong>${esc(registration.teamName || 'Equipe')}</strong></p>
      <p class="muted">Status: <strong>${registrationStatusLabel(registration.status)}</strong></p>
      ${paid ? `<p class="muted">✅ Pagamento confirmado — R$ ${feeAmount.toFixed(2)}</p>` : ''}
      ${showPay ? `<button class="btn primary" data-pay-fee style="margin-top:12px">Pagar inscrição (R$ ${feeAmount.toFixed(2)})</button>` : ''}
      <button class="btn ghost" style="margin-top:16px" data-back>← Voltar ao campeonato</button>
    </div>
  `;
}

export async function renderRegistrationStatus(root, championshipId, registrationId) {
  root.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/">ARENA</a></header><main class="section"><div class="card">Carregando...</div></main></div>`;

  const [champSnap, regSnap] = await Promise.all([
    getDoc(doc(db, 'publicChampionships', championshipId)),
    getDoc(doc(db, 'championships', championshipId, 'registrations', registrationId)),
  ]);
  if (!regSnap.exists()) {
    root.querySelector('main').innerHTML = '<div class="card"><h2>Inscrição não encontrada</h2></div>';
    return;
  }
  const championshipName = champSnap.exists() ? (champSnap.data().nome || 'Campeonato') : 'Campeonato';
  const registration = { id: regSnap.id, ...regSnap.data() };

  root.querySelector('main').innerHTML = registrationStatusHTML({ championshipName, registration });
  root.querySelector('[data-back]').onclick = () => navigate(`/publico/${championshipId}`);
  const payBtn = root.querySelector('[data-pay-fee]');
  if (payBtn) {
    payBtn.onclick = async () => {
      payBtn.disabled = true;
      payBtn.textContent = 'Gerando pagamento...';
      try {
        const { checkoutUrl } = await createRegistrationCheckout(championshipId, registrationId);
        window.location.href = checkoutUrl;
      } catch (error) {
        toastError(error.message || 'Não foi possível gerar o pagamento.');
        payBtn.disabled = false;
        payBtn.textContent = `Pagar inscrição (R$ ${Number(registration.feeAmount || 0).toFixed(2)})`;
      }
    };
  }
}
