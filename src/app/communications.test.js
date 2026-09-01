import { describe, it, expect } from 'vitest';
import { ensureCommunications, addAnnouncement, publishAnnouncement, publicAnnouncements, addPoll, publishPoll, votePoll, publicPolls } from './communications.js';

describe('communications', () => {
  it('initializes communication collections', () => {
    const state = {};
    ensureCommunications(state);
    expect(state).toMatchObject({ announcements: [], polls: [] });
  });

  it('creates drafts and publishes only valid announcements', () => {
    const state = {};
    expect(addAnnouncement(state, { title: '', body: 'x' }).ok).toBe(false);
    const result = addAnnouncement(state, { title: 'Tabela atualizada', body: 'Jogos de sábado confirmados.' });
    expect(result.ok).toBe(true);
    expect(publicAnnouncements(state)).toEqual([]);
    publishAnnouncement(state, result.announcement.id);
    expect(publicAnnouncements(state)[0].title).toBe('Tabela atualizada');
  });

  it('can unpublish an announcement', () => {
    const state = {};
    const { announcement } = addAnnouncement(state, { title: 'Aviso', body: 'Conteúdo' });
    publishAnnouncement(state, announcement.id);
    publishAnnouncement(state, announcement.id, false);
    expect(publicAnnouncements(state)).toEqual([]);
  });

  it('creates, publishes and prevents duplicate votes in polls', () => {
    const state = {};
    const result = addPoll(state, { question: 'Melhor horário?', options: ['Manhã', 'Noite'] });
    expect(result.ok).toBe(true);
    publishPoll(state, result.poll.id);
    const option = result.poll.options[0];
    expect(votePoll(state, result.poll.id, option.id, 'device-1').ok).toBe(true);
    expect(votePoll(state, result.poll.id, option.id, 'device-1').ok).toBe(false);
    expect(publicPolls(state)[0].options[0].votes).toBe(1);
  });
});
