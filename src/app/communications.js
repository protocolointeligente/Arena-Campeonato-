import { uid } from './utils.ts';

export function ensureCommunications(state) {
  state.announcements = Array.isArray(state.announcements) ? state.announcements : [];
  state.polls = Array.isArray(state.polls) ? state.polls : [];
  return state;
}

export function addAnnouncement(state, { title, body } = {}) {
  ensureCommunications(state);
  if (!String(title || '').trim() || !String(body || '').trim()) {return { ok: false, reason: 'Título e conteúdo são obrigatórios.' };}
  const announcement = { id: uid(), title: String(title).trim(), body: String(body).trim(), status: 'draft', created: Date.now(), updated: Date.now() };
  state.announcements.unshift(announcement);
  return { ok: true, announcement };
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
