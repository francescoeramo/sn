import { describe, it, expect } from 'vitest';
import { fileKind, hashtags, isActive, postInput } from '../lib/core/rules';
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
