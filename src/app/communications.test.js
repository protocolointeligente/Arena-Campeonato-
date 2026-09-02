import { describe, it, expect } from 'vitest';
import { ensureCommunications, addAnnouncement, publishAnnouncement, publicAnnouncements, addPoll, publishPoll, votePoll, publicPolls, videoEmbedUrl, addTeamMessage, teamMessagesFor } from './communications.js';

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

  it('stores an optional photo or video on an announcement', () => {
    const state = {};
    const withPhoto = addAnnouncement(state, { title: 'Confraternização', body: 'Fotos do encerramento.', mediaUrl: 'https://example.com/foto.jpg', mediaType: 'photo' });
    expect(withPhoto.announcement).toMatchObject({ mediaUrl: 'https://example.com/foto.jpg', mediaType: 'photo' });
    const withoutMedia = addAnnouncement(state, { title: 'Aviso', body: 'Sem mídia' });
    expect(withoutMedia.announcement).toMatchObject({ mediaUrl: '', mediaType: '' });
  });

  it('rejects an unrecognized mediaType, storing no media', () => {
    const state = {};
    const result = addAnnouncement(state, { title: 'Aviso', body: 'x', mediaUrl: 'https://example.com/x', mediaType: 'audio' });
    expect(result.announcement).toMatchObject({ mediaUrl: '', mediaType: '' });
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

describe('team messages', () => {
  it('rejects a message with no team, or missing title/body', () => {
    const state = {};
    expect(addTeamMessage(state, { title: 'x', body: 'y' }).ok).toBe(false);
    expect(addTeamMessage(state, { teamId: 't1', title: '', body: 'y' }).ok).toBe(false);
    expect(addTeamMessage(state, { teamId: 't1', title: 'x', body: '' }).ok).toBe(false);
  });

  it('addresses a message to one specific team, invisible to others', () => {
    const state = {};
    addTeamMessage(state, { teamId: 't1', title: 'Horário alterado', body: 'Jogo de sábado às 15h.' });
    addTeamMessage(state, { teamId: 't2', title: 'Outro assunto', body: 'Só pro time 2.' });
    expect(teamMessagesFor(state, 't1')).toHaveLength(1);
    expect(teamMessagesFor(state, 't1')[0].title).toBe('Horário alterado');
    expect(teamMessagesFor(state, 't2')).toHaveLength(1);
    expect(teamMessagesFor(state, 't3')).toEqual([]);
  });

  it('lists a team\'s messages newest first', () => {
    const state = {};
    addTeamMessage(state, { teamId: 't1', title: 'Primeira', body: 'a' });
    addTeamMessage(state, { teamId: 't1', title: 'Segunda', body: 'b' });
    expect(teamMessagesFor(state, 't1').map((m) => m.title)).toEqual(['Segunda', 'Primeira']);
  });
});

describe('videoEmbedUrl', () => {
  it('recognizes youtube.com/watch links', () => {
    expect(videoEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
  });

  it('recognizes youtu.be short links', () => {
    expect(videoEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
  });

  it('recognizes vimeo.com links', () => {
    expect(videoEmbedUrl('https://vimeo.com/76979871')).toBe('https://player.vimeo.com/video/76979871');
  });

  it('returns null for an unrecognized or empty link', () => {
    expect(videoEmbedUrl('https://example.com/video.mp4')).toBeNull();
    expect(videoEmbedUrl('')).toBeNull();
    expect(videoEmbedUrl(undefined)).toBeNull();
  });
});
