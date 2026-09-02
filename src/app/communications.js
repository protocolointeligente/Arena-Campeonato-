import { uid } from './utils.ts';

export function ensureCommunications(state) {
  state.announcements = Array.isArray(state.announcements) ? state.announcements : [];
  state.polls = Array.isArray(state.polls) ? state.polls : [];
  return state;
}

export function addAnnouncement(state, { title, body, mediaUrl, mediaType } = {}) {
  ensureCommunications(state);
  if (!String(title || '').trim() || !String(body || '').trim()) {return { ok: false, reason: 'Título e conteúdo são obrigatórios.' };}
  const validMediaType = mediaType === 'photo' || mediaType === 'video';
  const announcement = {
    id: uid(), title: String(title).trim(), body: String(body).trim(), status: 'draft', created: Date.now(), updated: Date.now(),
    mediaUrl: validMediaType && mediaUrl ? String(mediaUrl).trim() : '',
    mediaType: validMediaType && mediaUrl ? mediaType : '',
  };
  state.announcements.unshift(announcement);
  return { ok: true, announcement };
}

export function ensureTeamMessages(state) {
  state.teamMessages = Array.isArray(state.teamMessages) ? state.teamMessages : [];
  return state;
}

// A direct message to one team's own portal — unlike addAnnouncement, never shown on the
// public championship-wide portal, only on that team's /equipe/... page.
export function addTeamMessage(state, { teamId, title, body } = {}) {
  ensureTeamMessages(state);
  if (!teamId) {return { ok: false, reason: 'Selecione a equipe.' };}
  if (!String(title || '').trim() || !String(body || '').trim()) {return { ok: false, reason: 'Título e conteúdo são obrigatórios.' };}
  const message = { id: uid(), teamId, title: String(title).trim(), body: String(body).trim(), created: Date.now() };
  state.teamMessages.unshift(message);
  return { ok: true, message };
}

export function teamMessagesFor(state, teamId) {
  ensureTeamMessages(state);
  return state.teamMessages.filter((item) => item.teamId === teamId).slice().sort((a, b) => b.created - a.created);
}

const YOUTUBE_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/;
const VIMEO_RE = /vimeo\.com\/(\d+)/;

// Turns a pasted YouTube/Vimeo link into an embeddable iframe src, or null if it's neither —
// the public portal only ever embeds a URL this returns, never the raw pasted link, so an
// arbitrary/malicious URL can't end up as an iframe src.
export function videoEmbedUrl(url) {
  const value = String(url || '');
  const youtube = YOUTUBE_RE.exec(value);
  if (youtube) {return `https://www.youtube.com/embed/${youtube[1]}`;}
  const vimeo = VIMEO_RE.exec(value);
  if (vimeo) {return `https://player.vimeo.com/video/${vimeo[1]}`;}
  return null;
}

export function publishAnnouncement(state, id, published = true) {
  ensureCommunications(state);
  const item = state.announcements.find((announcement) => announcement.id === id);
  if (!item) {return { ok: false, reason: 'Comunicado não encontrado.' };}
  item.status = published ? 'published' : 'draft';
  item.updated = Date.now();
  return { ok: true, announcement: item };
}

export function publicAnnouncements(state) {
  ensureCommunications(state);
  return state.announcements.filter((item) => item.status === 'published').slice().sort((a, b) => b.updated - a.updated);
}

export function addPoll(state, { question, options } = {}) {
  ensureCommunications(state);
  const cleanOptions = (options || []).map((option) => String(option || '').trim()).filter(Boolean);
  if (!String(question || '').trim() || cleanOptions.length < 2 || cleanOptions.length > 8) {return { ok: false, reason: 'Informe uma pergunta e entre 2 e 8 opções.' };}
  const poll = { id: uid(), question: String(question).trim(), options: cleanOptions.map((label) => ({ id: uid(), label, votes: 0 })), status: 'draft', created: Date.now(), updated: Date.now() };
  state.polls.unshift(poll);
  return { ok: true, poll };
}

export function publishPoll(state, id, published = true) {
  ensureCommunications(state);
  const poll = state.polls.find((item) => item.id === id);
  if (!poll) {return { ok: false, reason: 'Enquete não encontrada.' };}
  poll.status = published ? 'published' : 'draft';
  poll.updated = Date.now();
  return { ok: true, poll };
}

export function votePoll(state, pollId, optionId, voterKey) {
  ensureCommunications(state);
  const poll = state.polls.find((item) => item.id === pollId && item.status === 'published');
  const option = poll?.options.find((item) => item.id === optionId);
  if (!poll || !option || !voterKey) {return { ok: false, reason: 'Voto inválido.' };}
  poll.voters = poll.voters || {};
  if (poll.voters[voterKey]) {return { ok: false, reason: 'Você já votou nesta enquete.' };}
  poll.voters[voterKey] = optionId;
  option.votes = (option.votes || 0) + 1;
  return { ok: true, poll };
}

export function publicPolls(state) {
  ensureCommunications(state);
  return state.polls.filter((poll) => poll.status === 'published').slice().sort((a, b) => b.updated - a.updated);
}
