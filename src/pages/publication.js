import { navigate } from '../app/router-v2.js';
import QRCode from 'qrcode';
import { getPublicSlug } from '../services/championships.js';

export async function shareLink(url, title = 'Campeonato ARENA') {
  if (navigator.share) {
    await navigator.share({ title, url });
    return 'Link compartilhado';
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return 'Link copiado';
  }
  const input = document.createElement('input');
  input.value = url;
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
  return 'Link copiado';
}

export async function createQrDataUrl(url) {
  return QRCode.toDataURL(url, { width: 420, margin: 2, errorCorrectionLevel: 'M' });
}

export function downloadSocialCard(name, url) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext('2d');
  if (!context) {throw new Error('Canvas indisponível');}
  context.fillStyle = '#10231a';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#2fcf6b';
  context.fillRect(0, 0, 22, canvas.height);
  context.fillStyle = '#ffffff';
  context.font = 'bold 34px sans-serif';
  context.fillText('ARENA CAMPEONATOS', 82, 112);
  context.font = 'bold 64px sans-serif';
  context.fillText(String(name || 'Meu campeonato').slice(0, 32), 82, 260);
  context.font = '28px sans-serif';
  context.fillStyle = '#b7d7c2';
  context.fillText('Acompanhe jogos, resultados e classificação', 82, 330);
  context.fillText(url, 82, 520);
  const link = document.createElement('a');
  link.download = 'arena-campeonato.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export function downloadMatchCard(championshipName, homeTeam, homeScore, awayTeam, awayScore) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext('2d');
  if (!context) {throw new Error('Canvas indisponível');}
  context.fillStyle = '#10231a';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#2fcf6b';
  context.fillRect(0, 0, 22, canvas.height);
  context.fillStyle = '#ffffff';
  context.font = 'bold 30px sans-serif';
  context.fillText(String(championshipName || 'ARENA CAMPEONATOS').toUpperCase().slice(0, 40), 82, 100);
  context.font = 'bold 46px sans-serif';
  context.fillText(String(homeTeam || 'Time A').slice(0, 22), 82, 220);
  context.font = 'bold 120px sans-serif';
  context.fillStyle = '#2fcf6b';
  context.fillText(`${homeScore ?? 0} × ${awayScore ?? 0}`, 82, 380);
  context.fillStyle = '#ffffff';
  context.font = 'bold 46px sans-serif';
  context.fillText(String(awayTeam || 'Time B').slice(0, 22), 82, 470);
  context.font = '26px sans-serif';
  context.fillStyle = '#b7d7c2';
  context.fillText('Resultado final', 82, 560);
  const link = document.createElement('a');
  link.download = 'arena-resultado.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function actionFeedback(button, message) {
  const original = button.textContent;
  button.textContent = message;
  setTimeout(() => { button.textContent = original; }, 1800);
}

export async function renderPublication(root, id) {
  root.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/">ARENA</a><button class="btn ghost" data-back>← Voltar</button></header><main class="section"><div class="card">Carregando...</div></main></div>`;
  root.querySelector('[data-back]').onclick = () => navigate(`/campeonatos/${id}`);
  let slug = '';
  try { slug = await getPublicSlug(id); } catch { /* mantém o link padrão baseado no id */ }
  const publicUrl = slug ? `${location.origin}/c/${slug}` : `${location.origin}/publico/${id}`;
  const registrationUrl = `${location.origin}/inscrever/${id}`;
  root.querySelector('main').innerHTML = `<small>PUBLICAÇÃO</small><h1>Compartilhe seu campeonato</h1><div class="grid"><div class="card"><h2>Portal público</h2><p class="muted">Envie este link para a torcida acompanhar resultados e equipes.${slug ? ' URL personalizada configurada em Configurações.' : ''}</p><code class="pix-key">${publicUrl}</code><div class="actions"><button class="btn primary" data-copy="${publicUrl}">Copiar link</button><button class="btn" data-share="${publicUrl}">Compartilhar</button><button class="btn ghost" data-open="${publicUrl}">Abrir portal</button><button class="btn ghost" data-social-card>Baixar card</button><button class="btn ghost" data-qr="${publicUrl}" data-qr-name="portal">Baixar QR</button></div></div><div class="card"><h2>Inscrições</h2><p class="muted">Use este link para receber equipes e atletas.</p><code class="pix-key">${registrationUrl}</code><div class="actions"><button class="btn primary" data-copy="${registrationUrl}">Copiar link</button><button class="btn" data-share="${registrationUrl}">Compartilhar</button><button class="btn ghost" data-open="${registrationUrl}">Abrir formulário</button><button class="btn ghost" data-qr="${registrationUrl}" data-qr-name="inscricoes">Baixar QR</button></div></div></div>`;
  root.querySelectorAll('[data-copy]').forEach((button) => button.onclick = async () => {
    try { await shareLink(button.dataset.copy); actionFeedback(button, 'Link copiado'); }
    catch { actionFeedback(button, 'Falha ao copiar'); }
  });
  root.querySelectorAll('[data-share]').forEach((button) => button.onclick = async () => {
    try { actionFeedback(button, await shareLink(button.dataset.share)); }
    catch { actionFeedback(button, 'Falha ao compartilhar'); }
  });
  root.querySelectorAll('[data-open]').forEach((button) => button.onclick = () => window.open(button.dataset.open, '_blank', 'noopener,noreferrer'));
  root.querySelector('[data-social-card]').onclick = () => {
    try { downloadSocialCard(document.title.replace(/^ARENA\s*—\s*/i, '') || 'Meu campeonato', publicUrl); }
    catch { actionFeedback(root.querySelector('[data-social-card]'), 'Falha ao gerar'); }
  };
  root.querySelectorAll('[data-qr]').forEach((button) => button.onclick = async () => {
    try {
      const dataUrl = await createQrDataUrl(button.dataset.qr);
      const link = document.createElement('a'); link.href = dataUrl; link.download = `arena-${button.dataset.qrName}-qr.png`; link.click();
    } catch { actionFeedback(button, 'Falha ao gerar'); }
  });
}
