import { esc } from '../../../app/utils.ts';
import { icon } from '../../../app/icons.js';

export function renderPublication(store) {
  const state = store.getState();
  const announcements = state.announcements || [];
  const teamMessages = state.teamMessages || [];
  const championshipId = encodeURIComponent(state.id || '');
  const teamInvites = (state.teams || []).map((team) => {
    const url = `${location.origin}/equipe/${championshipId}/${encodeURIComponent(team.id)}`;
    return `<div class="team-row"><span style="flex:1"><strong>${esc(team.nome)}</strong><br><code class="pix-key">${esc(url)}</code></span><button class="btn ghost sm" data-team-invite-copy="${esc(url)}">Copiar</button><button class="btn ghost sm" data-team-invite-qr="${esc(url)}" data-team-invite-name="${esc(team.nome)}">QR</button></div>`;
  }).join('');
  return `
    <div class="card">
      <h2>Publicação</h2>
      <p class="muted">Copie os links públicos para divulgar o campeonato.</p>
      <button class="btn primary" data-publication>Abrir central de publicação</button>
    </div>
    <div class="card" style="margin-top:16px">
      <h2>Convites das equipes</h2>
      <p class="muted">Envie o portal individual para cada equipe acompanhar jogos, classificação e elenco.</p>
      ${teamInvites || '<p class="muted">Cadastre equipes para gerar convites.</p>'}
    </div>
    <div class="card" style="margin-top:16px">
      <h2>Comunicados</h2>
      <p class="muted">Publique avisos para equipes e torcida no portal público.</p>
      <input data-announcement-title maxlength="120" placeholder="Título do comunicado">
      <textarea data-announcement-body maxlength="1000" placeholder="Mensagem" rows="4" style="width:100%;margin-top:8px"></textarea>
      <div class="row" style="flex-wrap:wrap;margin-top:8px;gap:12px">
        <label class="muted" style="flex:1;min-width:200px">Foto (opcional)<input type="file" accept="image/*" data-announcement-photo style="display:block;margin-top:4px"></label>
        <label class="muted" style="flex:1;min-width:200px">Ou link de vídeo (YouTube/Vimeo)<input type="url" data-announcement-video placeholder="https://youtube.com/watch?v=..." style="display:block;margin-top:4px;width:100%"></label>
      </div>
      <button class="btn primary" data-add-announcement style="margin-top:8px">Publicar comunicado</button>
      <div style="margin-top:16px">${announcements.map((item) => `<div class="team-row"><span style="flex:1"><strong>${esc(item.title)}</strong>${item.mediaType === 'photo' ? ` ${icon('camera', 14)}` : item.mediaType === 'video' ? ` ${icon('video', 14)}` : ''}<br><span class="muted">${esc(item.body)}</span></span><span class="tag">${item.status === 'published' ? 'Publicado' : 'Rascunho'}</span><button class="btn ghost sm" data-toggle-announcement="${esc(item.id)}">${item.status === 'published' ? 'Retirar' : 'Publicar'}</button></div>`).join('') || '<p class="muted">Nenhum comunicado criado.</p>'}</div>
    </div>
    <div class="card" style="margin-top:16px">
      <h2>Mensagem direta pra uma equipe</h2>
      <p class="muted">Aparece só no portal daquela equipe — não sai no portal público geral.</p>
      <select data-team-message-team style="width:100%">${(state.teams || []).map((team) => `<option value="${esc(team.id)}">${esc(team.nome)}</option>`).join('') || '<option value="">Cadastre uma equipe primeiro</option>'}</select>
      <input data-team-message-title maxlength="120" placeholder="Título" style="margin-top:8px">
      <textarea data-team-message-body maxlength="1000" placeholder="Mensagem" rows="3" style="width:100%;margin-top:8px"></textarea>
      <button class="btn primary" data-add-team-message style="margin-top:8px">Enviar pra equipe</button>
      <div style="margin-top:16px">${teamMessages.slice(0, 10).map((item) => `<div class="team-row"><span style="flex:1"><strong>${esc(item.title)}</strong> <span class="muted">· ${esc((state.teams || []).find((team) => team.id === item.teamId)?.nome || 'Equipe removida')}</span><br><span class="muted">${esc(item.body)}</span></span></div>`).join('') || '<p class="muted">Nenhuma mensagem enviada ainda.</p>'}</div>
    </div>
    <div class="card" style="margin-top:16px">
      <h2>Enquetes</h2>
      <p class="muted">Crie perguntas rápidas para equipes e torcida.</p>
      <input data-poll-question maxlength="200" placeholder="Pergunta da enquete">
      <textarea data-poll-options maxlength="800" rows="4" placeholder="Uma opção por linha" style="width:100%;margin-top:8px"></textarea>
      <button class="btn primary" data-add-poll style="margin-top:8px">Criar enquete</button>
      <div style="margin-top:16px">${(store.getState().polls || []).map((poll) => `<div class="team-row"><span style="flex:1"><strong>${esc(poll.question)}</strong><br><span class="muted">${poll.options.map((option) => `${esc(option.label)} (${option.votes || 0})`).join(' · ')}</span></span><span class="tag">${poll.status === 'published' ? 'Publicada' : 'Rascunho'}</span><button class="btn ghost sm" data-toggle-poll="${esc(poll.id)}">${poll.status === 'published' ? 'Encerrar' : 'Publicar'}</button></div>`).join('') || '<p class="muted">Nenhuma enquete criada.</p>'}</div>
    </div>
  `;
}

