import { describe, it, expect } from 'vitest';
import {
  fileKind,
  hashtags,
  isActive,
  postInput,
  messageInput,
  noteInput,
  localMediaInfo,
} from '../lib/core/rules';
import { applyDemo, seed } from '../lib/client/demo';
describe('Regole condivise', () => {
  it('la demo accetta allegati locali oltre 200 caratteri senza allargare le API', () => {
    const media = 'data:image/webp;base64,' + 'AAAA'.repeat(100);
    const next = applyDemo(seed(), {
      type: 'post',
      body: 'Foto',
      kind: 'story',
      media_path: media,
      alt: 'Prova',
    });
    expect(next.posts[0].media_path).toBe(media);
    expect(
      postInput.safeParse({ body: 'Foto', kind: 'post', media_path: media, alt: '' }).success,
    ).toBe(false);
  });
  it('la demo rifiuta URL remoti e allegati oltre quota', () => {
    expect(() =>
      applyDemo(seed(), {
        type: 'post',
        body: 'Foto',
        kind: 'post',
        media_path: 'https://example.com/photo.jpg',
        alt: '',
      }),
    ).toThrow('3 MB');
    expect(() =>
      applyDemo(seed(), {
        type: 'post',
        body: 'Foto',
        kind: 'post',
        media_path: 'data:image/webp;base64,' + 'AAAA'.repeat(1024 * 1024 + 1),
        alt: '',
      }),
    ).toThrow('3 MB');
  });
  it('accetta solo le sei scadenze previste e usa 24 ore come valore iniziale', () => {
    const input = { user_id: seed().profiles[1].id, body: 'Ciao' };
    expect(messageInput.parse(input).ttl).toBe(86400);
    for (const ttl of [0, 42, -1, null, 2592001])
      expect(messageInput.safeParse({ ...input, ttl }).success).toBe(false);
  });
  it('i messaggi demo supportano audio e scadenza senza fidarsi del MIME dichiarato', () => {
    const s = seed();
    const next = applyDemo(s, {
      type: 'message',
      user_id: s.profiles[1].id,
      body: '',
      media_path: 'data:audio/webm;base64,AAAA',
      media_type: 'image/png',
      ttl: 3600,
    });
    const message = next.messages.at(-1)!;
    expect(message.media_type).toBe('audio/webm');
    expect(Date.parse(message.expires_at!) - Date.parse(message.created_at)).toBe(3600000);
    expect(next.usage.bytes).toBe(3);
    expect(() => localMediaInfo('data:audio/webm;base64,AAAA')).toThrow();
  });
  it('rimuove dalla demo i messaggi scaduti con i loro allegati', () => {
    const s = seed();
    s.messages[0].expires_at = '2020-01-01T00:00:00Z';
    const next = applyDemo(s, { type: 'read-notifications' });
    expect(next.messages).toHaveLength(0);
  });
  it('le note richiedono fonti HTTPS e restano nascoste fino alla revisione', () => {
    const state = seed(),
      input = {
        post_id: state.posts[0].id,
        body: 'Questa affermazione richiede più contesto.',
        sources: ['https://example.org/fonte'],
      };
    for (const sources of [
      [],
      ['javascript:alert(1)'],
      ['https://user:pass@example.org'],
      ['http://example.org'],
    ])
      expect(noteInput.safeParse({ ...input, sources }).success).toBe(false);
    const proposed = applyDemo(state, { type: 'propose-note', ...input });
    expect(proposed.notes[0].status).toBe('pending');
    expect(proposed.posts).toEqual(state.posts);
    expect(() =>
      applyDemo(
        { ...proposed, isAdmin: false },
        {
          type: 'review-note',
          note_id: proposed.notes[0].id,
          approve: true,
          reason: 'Fonte verificata e pertinente.',
        },
      ),
    ).toThrow('Accesso negato');
    const approved = applyDemo(proposed, {
      type: 'review-note',
      note_id: proposed.notes[0].id,
      approve: true,
      reason: 'Fonte verificata e pertinente.',
    });
    expect(approved.notes[0].status).toBe('approved');
    expect(approved.posts).toEqual(state.posts);
    expect(() =>
      applyDemo(approved, {
        type: 'review-note',
        note_id: approved.notes[0].id,
        approve: false,
        reason: 'Cambio non ammesso.',
      }),
    ).toThrow('già esaminata');
  });
  it('estrae hashtag italiani senza duplicati', () =>
    expect(hashtags('Ciao #caffè #Musica #musica')).toEqual(['caffè', 'musica']));
  it('rifiuta SVG e HTML negli upload', () => {
    expect(fileKind('image/svg+xml')).toBeNull();
    expect(fileKind('text/html')).toBeNull();
  });
  it('rende invisibili le storie esattamente alla scadenza', () =>
    expect(
      isActive({ expires_at: '2026-01-01T00:00:00Z' }, Date.parse('2026-01-01T00:00:00Z')),
    ).toBe(false));
  it('rifiuta post vuoti e storie senza allegato', () => {
    expect(
      postInput.safeParse({ body: ' ', kind: 'post', media_path: null, alt: '' }).success,
    ).toBe(false);
    expect(
      postInput.safeParse({ body: 'Ciao', kind: 'story', media_path: null, alt: '' }).success,
    ).toBe(false);
  });
  it('la demo conserva il post originale quando si aggiunge un like', () => {
    const state = seed();
    const next = applyDemo(state, { type: 'like', post_id: state.posts[0].id });
    expect(next.likes).toHaveLength(state.likes.length + 1);
    expect(next.posts).toEqual(state.posts);
    expect(state.likes).toHaveLength(3);
  });
  it('la demo richiede follow reciproco per inviare messaggi', () => {
    const s = seed();
    expect(() =>
      applyDemo(s, { type: 'message', user_id: s.profiles[4].id, body: 'Ciao' }),
    ).toThrow('a vicenda');
  });
  it('il blocco interrompe entrambi i follow', () => {
    const s = seed();
    const next = applyDemo(s, { type: 'block', user_id: s.profiles[1].id });
    expect(
      next.follows.some(
        (f) => f.follower_id === s.profiles[1].id || f.following_id === s.profiles[1].id,
      ),
    ).toBe(false);
  });
});

describe('Salvataggi e avvisi nella demo', () => {
  it('salva senza duplicati o notifiche, rimuove senza toccare il post', () => {
    const state = seed();
    const action = { type: 'bookmark' as const, post_id: state.posts[0].id, saved: true };
    const saved = applyDemo(applyDemo(state, action), action);
    expect(saved.bookmarks).toHaveLength(1);
    expect(saved.notifications).toEqual(state.notifications);
    const removed = applyDemo(saved, { ...action, saved: false });
    expect(removed.bookmarks).toHaveLength(0);
    expect(removed.posts).toEqual(state.posts);
  });
  it('nega salvataggi senza accesso, di storie e di post scaduti', () => {
    const state = seed();
    const action = { type: 'bookmark' as const, post_id: state.posts[0].id, saved: true };
    state.profiles[1].is_private = true;
    state.follows = [];
    expect(() => applyDemo(state, action)).toThrow('non disponibile');
    state.profiles[1].is_private = false;
    state.posts[0].expires_at = new Date(0).toISOString();
    expect(() => applyDemo(state, action)).toThrow('non disponibile');
    expect(() =>
      applyDemo(state, { ...action, post_id: state.posts.find((p) => p.kind === 'story')!.id }),
    ).toThrow('non disponibile');
  });
  it('conserva l’avviso e respinge input troppo lunghi senza perdere la bozza', () => {
    const state = seed();
    const action = {
      type: 'post' as const,
      body: 'Il finale',
      kind: 'post' as const,
      media_path: null,
      alt: '',
      content_warning: ' Spoiler ',
    };
    expect(applyDemo(state, action).posts[0].content_warning).toBe('Spoiler');
    expect(() => applyDemo(state, { ...action, content_warning: 'x'.repeat(161) })).toThrow();
    expect(state.posts).toHaveLength(6);
  });
});
