import { navigate } from '../app/router-v2.js';
import { submitRegistration } from '../services/registrations.js';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase.js';
import { esc } from '../app/utils.ts';
import { toastError } from '../components/Toast.js';
import { registrationLimiter, getClientFingerprint } from '../app/rate-limiter.js';
import { Captcha, CAPTCHA_TYPES } from '../components/Captcha.js';
import { icon } from '../app/icons.js';

export function validateRegistrationForm({ teamName, responsible, phone, email, consent, athletes, rosterMode = 'team', maxRoster = 50 }) {
  if (!teamName || !responsible || !phone || !consent) {return 'Preencha todos os campos obrigatórios.';}
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {return 'E-mail inválido.';}
  if (!Array.isArray(athletes) || athletes.length < 1) {return 'Informe pelo menos um atleta.';}
  const limit = Number.isInteger(maxRoster) && maxRoster > 0 ? Math.min(maxRoster, 50) : 50;
  if (athletes.length > limit) {return `Informe no máximo ${limit} ${rosterMode === 'team' ? 'atletas' : 'participantes'}.`;}
  if (rosterMode === 'individual' && athletes.length !== 1) {return 'Modalidade individual exige exatamente 1 participante.';}
  if (rosterMode === 'dupla' && athletes.length !== 2) {return 'Esta modalidade exige exatamente 2 participantes.';}
  return '';
}

export async function copyRegistrationProtocol(protocol) {
  if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(protocol); return; }
  const input = document.createElement('input'); input.value = protocol; document.body.appendChild(input); input.select(); document.execCommand('copy'); input.remove();
}

export async function renderRegistration(root, id) {
  root.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/">ARENA</a><button class="btn ghost" data-back>← Voltar</button></header><main class="section"><div class="card">Carregando inscrição...</div></main></div>`;
  root.querySelector('[data-back]').onclick = () => navigate(`/publico/${id}`);
  
  const snap = await getDoc(doc(db, 'publicChampionships', id));
  if (!snap.exists()) {
    return root.querySelector('main').innerHTML = '<div class="card"><h2>Campeonato não encontrado</h2></div>';
  }
  
  const data = snap.data();
  let state = {};
  try { state = JSON.parse(data.data || '{}'); } catch { state = {}; }
  const participantLabel = state.rosterMode === 'individual' ? 'atleta' : state.rosterMode === 'dupla' ? 'dupla' : 'equipe';
  const rosterLimit = Number.isInteger(state.cfg?.maxRoster) && state.cfg.maxRoster > 0 ? Math.min(state.cfg.maxRoster, 50) : 50;
  
  // Check if registration is open
  if (data.status === 'arquivado') {
    return root.querySelector('main').innerHTML = '<div class="card"><h2>Inscrições encerradas</h2><p class="muted">Este campeonato não está mais aceitando inscrições.</p></div>';
  }
  
  // Initialize rate limiter for this championship
  const fp = await getClientFingerprint();
  const rateLimitKey = `registration_${id}_${fp}`;
  
  // Initialize CAPTCHA
  const captchaContainer = document.createElement('div');
  captchaContainer.id = 'captcha-container';
  
  const captcha = Captcha({
    type: CAPTCHA_TYPES.HCAPTCHA,
    theme: 'light',
    size: 'normal',
    onVerify: () => {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar inscrição';
    },
    onExpire: () => {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Complete o CAPTCHA';
    },
    onError: (err) => {
      console.error('CAPTCHA error:', err);
      toastError('Erro no CAPTCHA. Tente recarregar a página.');
    },
  });
  
  captchaContainer.appendChild(captcha.element);
  
  root.querySelector('main').innerHTML = `
    <form class="card" style="max-width:760px;margin:auto" novalidate>
      <small>INSCRIÇÃO DE ${participantLabel.toUpperCase()}</small>
      <h1>${esc(state.nome || data.nome)}</h1>
      <p class="muted">Envie os dados da equipe para análise do organizador.</p>
      
      <label class="muted">Nome da ${participantLabel}<input name="teamName" required placeholder="Nome da ${participantLabel}"></label>
      <label class="muted">Responsável<input name="responsible" required></label>
      <label class="muted">Telefone<input name="phone" required></label>
      <label class="muted">E-mail<input name="email" type="email"></label>
      <label class="muted">Técnico/professor<input name="coach"></label>
      <label class="muted">${state.rosterMode === 'individual' ? 'Participante' : state.rosterMode === 'dupla' ? 'Participantes' : 'Atletas'} (máx. ${rosterLimit})<textarea name="athletes" placeholder="${state.rosterMode === 'dupla' ? 'Um nome por linha (2 participantes)' : 'Um nome por linha'}" rows="6"></textarea></label>
      <label class="muted"><input name="consent" type="checkbox" required> Confirmo que posso fornecer estes dados ao organizador.</label>
      
      <div class="captcha-wrapper" style="margin: 16px 0;"></div>
      
      <p class="muted" data-message style="min-height: 24px;"></p>
      <button class="btn primary" type="submit" disabled>Complete o CAPTCHA</button>
    </form>
  `;
  
  // Insert CAPTCHA
  const captchaWrapper = root.querySelector('.captcha-wrapper');
  captchaWrapper.appendChild(captchaContainer);
  
  const form = root.querySelector('form');
  const submitBtn = root.querySelector('button[type="submit"]');
  const messageEl = root.querySelector('[data-message]');
  
  form.onsubmit = async (event) => {
    event.preventDefault();
    
    // Rate limit check
    const rateLimitResult = registrationLimiter.check(rateLimitKey);
    if (!rateLimitResult.allowed) {
      const minutes = Math.ceil(rateLimitResult.retryAfter / 60000);
      toastError(`Muitas tentativas. Tente novamente em ${minutes} minuto(s).`);
      return;
    }
    
    // Verify CAPTCHA
    const captchaToken = captcha.getToken();
    if (!captchaToken) {
      toastError('Por favor, complete o CAPTCHA antes de enviar.');
      return;
    }
    
    const formData = new FormData(form);
    const teamName = formData.get('teamName')?.trim();
    const responsible = formData.get('responsible')?.trim();
    const phone = formData.get('phone')?.trim();
    const email = formData.get('email')?.trim();
    const coach = formData.get('coach')?.trim();
    const athletesText = formData.get('athletes')?.trim() || '';
    const consent = formData.get('consent');
    
    // Client-side validation
    const athletes = athletesText
        .split('\n')
        .map((name) => ({ name: name.trim() }))
        .filter((item) => item.name);
    const validationError = validateRegistrationForm({ teamName, responsible, phone, email, consent, athletes, rosterMode: state.rosterMode, maxRoster: rosterLimit });
    if (validationError) {toastError(validationError); return;}

    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';
    
    try {
      
      const registration = await submitRegistration(id, {
        rosterMode: state.rosterMode || 'team',
        teamName,
        responsible,
        phone,
        email,
        coach,
        athletes,
        captchaToken, // Include CAPTCHA token for server verification
        consent: consent === 'on',
      });
      
      // Reset rate limiter on success
      registrationLimiter.reset(rateLimitKey);
      
      form.innerHTML = `
        <div style="text-align:center;padding:24px">
          <div style="color:var(--success);margin-bottom:16px">${icon('checkCircle', 48)}</div>
          <h2>Inscrição enviada</h2>
          <p class="muted">O organizador analisará os dados antes de confirmar a participação.</p>
          <p>Protocolo: <strong data-protocol>${esc(registration.id)}</strong> <button class="btn ghost sm" type="button" data-copy-protocol>Copiar</button></p>
          <button class="btn primary" style="margin-top:16px" data-track-registration>Acompanhar inscrição e pagamento →</button>
          <button class="btn ghost" style="margin-top:8px" data-back>← Voltar ao campeonato</button>
        </div>
      `;
      root.querySelector('[data-back]').onclick = () => navigate(`/publico/${id}`);
      root.querySelector('[data-track-registration]').onclick = () => navigate(`/inscrever/${id}/status/${registration.id}`);
      root.querySelector('[data-copy-protocol]').onclick = async (event) => {
        try { await copyRegistrationProtocol(registration.id); event.currentTarget.textContent = 'Copiado'; }
        catch { event.currentTarget.textContent = 'Falha ao copiar'; }
      };
      
    } catch (error) {
      messageEl.textContent = error.message || 'Não foi possível enviar a inscrição.';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar inscrição';
      captcha.reset(); // Reset CAPTCHA on error
    }
  };
}

