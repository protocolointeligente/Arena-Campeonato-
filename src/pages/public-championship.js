import { collection, doc, getDoc, getDocs, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase.js';
import { navigate } from '../app/router-v2.js';
import { esc } from '../app/utils.ts';
import { computeStandings, scorerRanking, cardRanking, athleteStats } from '../app/standings.js';
import { publicAnnouncements, publicPolls, videoEmbedUrl, teamMessagesFor } from '../app/communications.js';
import { getChampionshipIdBySlug } from '../services/championships.js';

function activeCategory(state) {
  return (state.categories || []).find((category) => category.id === state.activeCategoryId)
    || (state.categories || [])[0]
    || state;
}

function activePhase(category) {
  return (category.phases || []).find((phase) => phase.id === category.activePhaseId)
    || (category.phases || [])[0]
    || category;
}

function teamName(teams, index) {
  return teams[index]?.nome || 'A definir';
}

export function publicStandings(category, state) {
  const phase = activePhase(category);
  const teams = category.teams || state.teams || [];
  const matches = phase.matches || category.matches || state.matches || [];
  const indexes = (phase.participantTeamIds || teams.map((team) => team.id))
    .map((id) => teams.findIndex((team) => team.id === id))
    .filter((index) => index >= 0);
  return computeStandings(teams, indexes, matches, phase.cfg || category.cfg || state.cfg || {})
    .map((row, index) => ({ ...row, position: index + 1, name: teamName(teams, row.team) }));
}

export function teamPortalData(category, state, teamId) {
  const teams = category.teams || state.teams || [];
  const team = teams.find((item) => item.id === teamId);
  if (!team) {return null;}
  const index = teams.indexOf(team);
  const matches = matchRows(category, state).filter((match) => match.home === index || match.away === index);
  const standing = publicStandings(category, state).find((row) => row.team === index);
  const goals = scorerRanking({ ...state, matches }).filter((row) => row.teamId === teamId);
  return { team, matches, standing, goals };
}

export function teamPortalPath(championshipId, teamId) {
  return `/equipe/${encodeURIComponent(championshipId)}/${encodeURIComponent(teamId)}`;
}

export async function enablePublicNotifications() {
  if (!('Notification' in globalThis)) {return 'unsupported';}
  return Notification.requestPermission();
}

export function liveUpdateKey(category, state) {
  return liveMatchRows(category, state).map((match) => `${match.id}:${match.hg ?? ''}-${match.ag ?? ''}-${match.meta?.status || ''}`).join('|');
}

export function publicUpdateKey(state) {
  const announcements = (state.announcements || []).filter((item) => item.status === 'published').map((item) => `a:${item.id}:${item.updated || item.body || ''}`);
  const polls = (state.polls || []).filter((item) => item.status === 'published').map((item) => `p:${item.id}:${item.updated || item.question || ''}`);
  return [...announcements, ...polls].join('|');
}

export function notifyPublicUpdate(state, championshipId) {
  if (!('Notification' in globalThis) || Notification.permission !== 'granted') {return false;}
  const key = publicUpdateKey(state);
  const storageKey = `arena_public_${championshipId}`;
  const previous = localStorage.getItem(storageKey);
  localStorage.setItem(storageKey, key);
  if (!previous || previous === key || !key) {return false;}
  new Notification(`Novidade: ${state.nome || 'Campeonato'}`, { body: 'Há um novo comunicado ou enquete publicada.' });
  return true;
}

export function notifyLiveUpdate(category, state, championshipId) {
  if (!('Notification' in globalThis) || Notification.permission !== 'granted') {return false;}
  const key = liveUpdateKey(category, state);
  const storageKey = `arena_live_${championshipId}`;
  const previous = localStorage.getItem(storageKey);
  localStorage.setItem(storageKey, key);
  if (!previous || previous === key || !key) {return false;}
  new Notification(`Atualização: ${state.nome || 'Campeonato'}`, { body: 'O placar de uma partida ao vivo foi atualizado.' });
  return true;
}

export function matchRows(category, state) {
  const phase = activePhase(category);
  const teams = category.teams || state.teams || [];
  return (phase.matches || category.matches || state.matches || [])
    .slice()
    .sort((a, b) => String(a.meta?.date || '').localeCompare(String(b.meta?.date || '')))
    .map((match) => ({
      ...match,
      homeName: teamName(teams, match.home),
      awayName: teamName(teams, match.away),
    }));
}

export function liveMatchRows(category, state) {
  return matchRows(category, state).filter((match) => match.meta?.status === 'live');
}

export function disciplineRows(category, state) {
  const phase = activePhase(category);
  return cardRanking({ ...state, matches: phase.matches || category.matches || state.matches || [] }).slice(0, 5);
}

function disciplinePanel(category, state) {
  const rows = disciplineRows(category, state);
  if (!rows.length) {return '';}
  return `<section class="card public-discipline"><h2>Disciplina</h2><ul class="public-list">${rows.map((row, index) => `<li><span>${index + 1}. ${esc(row.name)}</span><strong>${row.y || 0}🟨 ${row.r || 0}🟥</strong></li>`).join('')}</ul></section>`;
}

function announcementMedia(item) {
  if (item.mediaType === 'photo' && item.mediaUrl) {
    return `<img src="${esc(item.mediaUrl)}" alt="" style="max-width:100%;border-radius:8px;margin-top:8px">`;
  }
  if (item.mediaType === 'video' && item.mediaUrl) {
    const embed = videoEmbedUrl(item.mediaUrl);
    return embed
      ? `<iframe src="${esc(embed)}" style="width:100%;aspect-ratio:16/9;border:0;border-radius:8px;margin-top:8px" allowfullscreen loading="lazy" title="${esc(item.title)}"></iframe>`
      : `<p style="margin-top:8px"><a href="${esc(item.mediaUrl)}" target="_blank" rel="noopener">Assistir vídeo →</a></p>`;
  }
  return '';
}

function announcementsPanel(state) {
  const items = publicAnnouncements(state);
  if (!items.length) {return '';}
  return `<section class="card public-announcements"><h2>Comunicados</h2>${items.slice(0, 5).map((item) => `<article><h3>${esc(item.title)}</h3><p>${esc(item.body)}</p>${announcementMedia(item)}</article>`).join('')}</section>`;
}

function pollsPanel(state, id) {
  const polls = publicPolls(state);
  if (!polls.length) {return '';}
  const voterKey = localStorage.getItem(`arena_voter_${id}`) || (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
  localStorage.setItem(`arena_voter_${id}`, voterKey);
  return `<section class="card public-polls"><h2>Enquetes</h2>${polls.slice(0, 3).map((poll) => `<article><h3>${esc(poll.question)}</h3>${poll.options.map((option) => `<button class="btn ghost sm" data-vote-poll="${esc(poll.id)}:${esc(option.id)}">${esc(option.label)} <span>(${option.votes || 0})</span></button>`).join(' ')}</article>`).join('')}</section>`;
}

export function mergePollVotes(state, votes) {
  const polls = (state.polls || []).map((poll) => ({
    ...poll,
    options: (poll.options || []).map((option) => ({ ...option, votes: 0 })),
  }));
  const pollById = new Map(polls.map((poll) => [poll.id, poll]));
  const votersByPoll = new Map();
  votes.forEach((data) => {
    const poll = pollById.get(data.pollId);
    const option = poll?.options.find((item) => item.id === data.optionId);
    const voterKey = String(data.voterKey || '');
    const voters = votersByPoll.get(data.pollId) || new Set();
    if (option && voterKey && !voters.has(voterKey)) {
      voters.add(voterKey);
      votersByPoll.set(data.pollId, voters);
      option.votes += 1;
    }
  });
  return { ...state, polls };
}

async function stateWithPollVotes(state, id) {
  if (!(state.polls || []).length) {return mergePollVotes(state, []);}
  const snapshot = await getDocs(collection(db, 'publicChampionships', id, 'pollVotes'));
  const votes = [];
  snapshot.forEach((vote) => votes.push(vote.data()));
  return mergePollVotes(state, votes);
}

function livePanel(category, state) {
  const live = liveMatchRows(category, state);
  if (!live.length) {return '';}
  return `<section class="card public-live" aria-live="polite"><div class="row"><h2>Ao vivo</h2><span class="tag">ATUALIZAÇÃO AUTOMÁTICA</span></div>${live.map((match) => `<div class="game-row public-live-game"><span>${esc(match.homeName)}</span><strong>${match.hg ?? 0} x ${match.ag ?? 0}</strong><span>${esc(match.awayName)}</span><small>${(match.events || []).length} lance(s)</small></div>`).join('')}</section>`;
}

function publicPanel(category, state) {
  const standings = publicStandings(category, state);
  const matches = matchRows(category, state);
  const scorers = scorerRanking({ ...state, matches }).slice(0, 5);
  const upcoming = matches.filter((match) => match.hg == null || match.ag == null).slice(0, 8);
  const results = matches.filter((match) => match.hg != null && match.ag != null).slice().reverse().slice(0, 8);
  const showSets = state.scoreType === 'sets';
  const rows = standings.map((row) => { const team = (category.teams || state.teams || [])[row.team]; const link = state.publicId && team?.id ? `<a href="${teamPortalPath(state.publicId, team.id)}" data-link><strong>${esc(row.name)}</strong></a>` : `<strong>${esc(row.name)}</strong>`; const scoreCells = `<td>${row.GP}</td><td>${row.GC}</td><td>${row.SG > 0 ? '+' : ''}${row.SG}</td>`; return `<tr><td>${row.position}</td><td>${link}</td><td>${row.P}</td><td>${row.J}</td><td>${row.V}</td>${scoreCells}<td>${row.DISC ?? 0}</td></tr>`; }).join('');
  const games = (items) => items.map((match) => `<div class="game-row"><span>${esc(match.homeName)}</span><strong>${match.hg != null && match.ag != null ? `${match.hg} x ${match.ag}` : 'vs'}</strong><span>${esc(match.awayName)}</span><small>${esc(match.meta?.date || match.info || 'Data a definir')}</small></div>`).join('');
  const scorerRows = scorers.map((scorer, index) => `<li><span>${index + 1}. ${esc(scorer.name)}</span><strong>${scorer.goals}</strong></li>`).join('');
  const setHeaders = showSets ? '<th>SP</th><th>SC</th><th>SS</th>' : '<th>GP</th><th>GC</th><th>SG</th>';
  return `<div class="public-board"><div class="public-hero"><div class="row" style="justify-content:space-between;align-items:flex-start;gap:16px"><div><small>${esc(state.modalidade || 'CAMPEONATO').toUpperCase()}</small><h1>${esc(state.nome || category.nome || 'Campeonato')}</h1><p>${esc(state.subtitulo || 'Acompanhe classificação, jogos e resultados em tempo real.')}</p><span class="tag">${esc(state.modelo || state.formato || 'liga')}</span></div><div class="actions"><button class="btn ghost" type="button" data-copy-public-link>Compartilhar</button><button class="btn ghost" type="button" data-enable-notifications>Notificar placares</button></div></div></div><div class="public-stats"><div><strong>${standings.length}</strong><span>equipes</span></div><div><strong>${matches.length}</strong><span>jogos</span></div><div><strong>${results.length}</strong><span>resultados</span></div></div><div class="public-grid"><section class="card"><div class="row"><h2>Classificação</h2><span class="muted">${esc(activePhase(category).nome || 'Fase atual')}</span></div><div class="table-wrap"><table><thead><tr><th>#</th><th>Equipe</th><th>PTS</th><th>J</th><th>V</th>${setHeaders}<th>DISC</th></tr></thead><tbody>${rows || '<tr><td colspan="7">Nenhuma equipe cadastrada.</td></tr>'}</tbody></table></div></section><section class="card"><h2>Próximos jogos</h2>${games(upcoming) || '<p class="muted">Nenhum jogo programado.</p>'}</section><section class="card"><h2>Últimos resultados</h2>${games(results) || '<p class="muted">Nenhum resultado publicado.</p>'}</section><section class="card"><h2>Artilharia</h2><ul class="public-list">${scorerRows || '<li class="muted">Nenhum gol registrado.</li>'}</ul></section></div></div>`;
}

export async function renderPublicChampionshipBySlug(root, slug) {
  root.__publicUnsubscribe?.();
  root.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/">ARENA</a><button class="btn ghost" data-back>← Voltar</button></header><main class="section"><div class="card">Carregando campeonato...</div></main></div>`;
  root.querySelector('[data-back]').onclick = () => navigate('/');
  try {
    const id = await getChampionshipIdBySlug(slug);
    if (!id) {
      root.querySelector('main').innerHTML = '<div class="card"><h2>Campeonato não encontrado</h2></div>';
      return;
    }
    await renderPublicChampionship(root, id);
  } catch (error) {
    root.querySelector('main').innerHTML = `<div class="card"><h2>Não foi possível carregar o campeonato</h2><p class="muted">${esc(error?.message || 'Tente novamente em instantes.')}</p></div>`;
  }
}

export async function renderPublicChampionship(root, id) {
  root.__publicUnsubscribe?.();
  root.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/">ARENA</a><button class="btn ghost" data-back>← Voltar</button></header><main class="section"><div class="card">Carregando campeonato...</div></main></div>`;
  root.querySelector('[data-back]').onclick = () => navigate('/');
  try {
    const ref = doc(db, 'publicChampionships', id);
    root.__publicUnsubscribe = onSnapshot(ref, async (snapshot) => {
    if (!snapshot.exists()) {
      root.querySelector('main').innerHTML = '<div class="card"><h2>Campeonato não encontrado</h2></div>';
      return;
    }
    const data = snapshot.data();
    let state = {};
    try { state = JSON.parse(data.data || '{}'); } catch { state = {}; }
    try {
    state = { ...(await stateWithPollVotes(state, id)), publicId: id };
    } catch {
      state = mergePollVotes(state, []);
    }
    const category = activeCategory(state);
    notifyLiveUpdate(category, state, id);
    notifyPublicUpdate(state, id);
    root.querySelector('main').innerHTML = publicPanel(category, state);
    const panel = livePanel(category, state);
    if (panel) {root.querySelector('main').firstElementChild.insertAdjacentHTML('afterbegin', panel);}
    const discipline = disciplinePanel(category, state);
    if (discipline) {root.querySelector('main').firstElementChild.insertAdjacentHTML('beforeend', discipline);}
    const announcements = announcementsPanel(state);
    if (announcements) {root.querySelector('main').firstElementChild.insertAdjacentHTML('afterbegin', announcements);}
    const polls = pollsPanel(state, id);
    if (polls) {
      root.querySelector('main').firstElementChild.insertAdjacentHTML('afterbegin', polls);
      root.querySelectorAll('[data-vote-poll]').forEach((button) => button.onclick = async () => {
        const [pollId, optionId] = button.dataset.votePoll.split(':');
        const voterKey = localStorage.getItem(`arena_voter_${id}`);
        button.disabled = true;
        try { await setDoc(doc(collection(db, 'publicChampionships', id, 'pollVotes'), `${pollId}_${voterKey}`), { pollId, optionId, voterKey, created: Date.now() }); button.textContent = 'Voto registrado'; }
        catch { button.disabled = false; button.textContent = 'Falha ao votar'; }
      });
    }
    root.querySelector('[data-copy-public-link]')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      const url = window.location.href;
      let shared = false;
      try {
        if (navigator.share) {
          await navigator.share({ title: data.nome || 'Campeonato', text: 'Acompanhe este campeonato no ARENA', url });
          shared = true;
        } else {
          await navigator.clipboard.writeText(url);
          shared = true;
        }
      } catch {
        if (!navigator.share) {
          const input = document.createElement('input');
          input.value = url;
          document.body.appendChild(input);
          input.select();
          document.execCommand('copy');
          input.remove();
          shared = true;
        }
      }
      if (shared) {button.textContent = navigator.share ? 'Compartilhado' : 'Link copiado';}
      setTimeout(() => { button.textContent = 'Compartilhar'; }, 2000);
    });
    root.querySelector('[data-enable-notifications]')?.addEventListener('click', async (event) => {
      const result = await enablePublicNotifications();
      event.currentTarget.textContent = result === 'granted' ? 'Notificações ativas' : result === 'denied' ? 'Notificações bloqueadas' : 'Indisponível';
      if (result === 'granted') {localStorage.setItem(`arena_live_${id}`, liveUpdateKey(category, state)); localStorage.setItem(`arena_public_${id}`, publicUpdateKey(state));}
    });
    }, (error) => {
      root.querySelector('main').innerHTML = `<div class="card"><h2>Não foi possível atualizar o campeonato</h2><p class="muted">${esc(error?.message || 'Tente novamente em instantes.')}</p></div>`;
    });
  } catch (error) {
    root.querySelector('main').innerHTML = `<div class="card"><h2>Não foi possível carregar o campeonato</h2><p class="muted">${esc(error?.message || 'Tente novamente em instantes.')}</p></div>`;
  }
}

export async function renderTeamPortal(root, championshipId, teamId) {
  root.innerHTML = '<div class="shell"><main class="section"><div class="card">Carregando equipe...</div></main></div>';
  try {
    const snapshot = await getDoc(doc(db, 'publicChampionships', championshipId));
    if (!snapshot.exists()) {throw new Error('Campeonato não encontrado.');}
    const data = snapshot.data();
    const state = JSON.parse(data.data || '{}');
    const category = activeCategory(state);
    const view = teamPortalData(category, state, teamId);
    if (!view) {throw new Error('Equipe não encontrada.');}
    const matchText = view.matches.map((match) => `<li>${esc(match.homeName)} <strong>${match.hg != null && match.ag != null ? `${match.hg} x ${match.ag}` : 'vs'}</strong> ${esc(match.awayName)} <span class="muted">${esc(match.meta?.date || '')}</span></li>`).join('');
    const scorerText = view.goals.map((row) => `<li>${esc(row.name)} <strong>${row.goals}</strong></li>`).join('');
    const athleteText = (view.team.roster || []).map((athlete) => { const stats = athleteStats(state, athlete.id) || { matches: 0, goals: 0, yellow: 0, red: 0, discipline: 0 }; return `<li><strong>${esc(athlete.nome)}</strong><span class="muted">${stats.matches} jogos · ${stats.goals} gols · ${stats.yellow} amarelos · ${stats.red} vermelhos</span></li>`; }).join('');
    const messages = teamMessagesFor(state, teamId);
    const messagesPanel = messages.length
      ? `<section class="card"><h2>Mensagens da organização</h2><ul class="public-list">${messages.map((item) => `<li><strong>${esc(item.title)}</strong><br><span class="muted">${esc(item.body)}</span></li>`).join('')}</ul></section>`
      : '';
    root.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/">ARENA</a><button class="btn ghost" data-back>← Campeonato</button></header><main class="section"><div class="public-hero"><small>EQUIPE</small><h1>${esc(view.team.nome)}</h1><p class="muted">${esc(state.nome || 'Campeonato')}</p></div><div class="public-stats"><div><strong>${view.standing?.P || 0}</strong><span>pontos</span></div><div><strong>${view.standing?.J || 0}</strong><span>jogos</span></div><div><strong>${view.standing?.DISC || 0}</strong><span>disciplina</span></div></div><div class="public-grid">${messagesPanel}<section class="card"><h2>Jogos da equipe</h2><ul class="public-list">${matchText || '<li class="muted">Nenhum jogo registrado.</li>'}</ul></section><section class="card"><h2>Estatísticas dos atletas</h2><ul class="public-list">${athleteText || '<li class="muted">Elenco não publicado.</li>'}</ul></section><section class="card"><h2>Goleadores</h2><ul class="public-list">${scorerText || '<li class="muted">Nenhum gol registrado.</li>'}</ul></section></div></main></div>`;
    root.querySelector('[data-back]').onclick = () => navigate(`/publico/${championshipId}`);
  } catch (error) {
    root.innerHTML = `<div class="shell"><main class="section"><div class="card"><h2>Não foi possível carregar</h2><p class="muted">${esc(error.message || 'Tente novamente.')}</p></div></main></div>`;
  }
}
