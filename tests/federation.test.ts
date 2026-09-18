import { describe, expect, it } from 'vitest';
import {
  actorDocument,
  canonicalOrigin,
  createDocument,
  noteDocument,
  objectUrl,
  outboxDocument,
  outboxPageDocument,
  webfingerAccount,
  webfingerDocument,
} from '../lib/core/federation';

const actor = {
  actorKey: '2dfdb22d-e931-4dcb-bc68-65b3414d5b3c',
  username: 'marta',
  displayName: 'Marta',
  bio: 'Fotografie e pane.',
};
const post = {
  activityKey: '6fbc81f6-b48e-4c0d-b541-3d28e545ce26',
  author: actor,
  body: 'Pane <caldo>\ne fotografie.',
  contentWarning: 'Contiene una sorpresa & farina',
  published: '2026-09-14T10:00:00.000Z',
};

describe('discovery ActivityPub', () => {
  it('usa solo una origine canonica sicura', () => {
    expect(canonicalOrigin('https://sn.example/path')).toBe('https://sn.example');
    expect(canonicalOrigin('javascript:alert(1)')).toBeNull();
    expect(canonicalOrigin('https://user:pass@sn.example')).toBeNull();
  });

  it('accetta soltanto account locali validi', () => {
    expect(webfingerAccount('acct:marta@sn.example', 'https://sn.example')).toBe('marta');
    expect(webfingerAccount('acct:marta@alt.example', 'https://sn.example')).toBeNull();
    expect(webfingerAccount('https://sn.example/users/marta', 'https://sn.example')).toBeNull();
  });

  it('collega WebFinger e attore alla stessa identità stabile', () => {
    const document = actorDocument('https://sn.example', actor);
    const webfinger = webfingerDocument('https://sn.example', actor);
    expect(document.id).toBe(webfinger.links[0].href);
    expect(document.url).toBe('https://sn.example/users/marta');
    expect(document.inbox).toBe(`${document.id}/inbox`);
  });

  it('non inserisce markup arbitrario nella biografia federata', () => {
    expect(
      actorDocument('https://sn.example', { ...actor, bio: '<b>Pane & foto</b>' }).summary,
    ).toBe('&lt;b&gt;Pane &amp; foto&lt;/b&gt;');
  });

  it('espone un post pubblico come Note senza eseguire markup del testo', () => {
    const note = noteDocument('https://sn.example', post);
    expect(note.id).toBe(objectUrl('https://sn.example', post.activityKey));
    expect(note.attributedTo).toBe(actorDocument('https://sn.example', actor).id);
    expect(note.content).toBe('Pane &lt;caldo&gt;<br>e fotografie.');
    expect(note.summary).toBe('Contiene una sorpresa &amp; farina');
    expect(note.to).toEqual(['https://www.w3.org/ns/activitystreams#Public']);
  });

  it('copia lo stesso pubblico dalla Note alla Create', () => {
    const activity = createDocument('https://sn.example', post);
    expect(activity.object.id).toBe(objectUrl('https://sn.example', post.activityKey));
    expect(activity.to).toEqual(activity.object.to);
    expect(activity.cc).toEqual(activity.object.cc);
  });

  it('espone un outbox paginato senza duplicare i documenti', () => {
    const collection = outboxDocument('https://sn.example', actor, 21);
    const page = outboxPageDocument('https://sn.example', actor, [post], 1, true);
    expect(collection.totalItems).toBe(21);
    expect(collection.first).toBe(`${collection.id}?page=1`);
    expect(page.partOf).toBe(collection.id);
    expect(page.orderedItems[0]).toEqual(createDocument('https://sn.example', post));
    expect(page.next).toBe(`${collection.id}?page=2`);
    expect(page).not.toHaveProperty('prev');
  });

  it('collega le pagine successive dell’outbox', () => {
    const page = outboxPageDocument('https://sn.example', actor, [], 2, false);
    expect(page.prev).toBe(`${page.partOf}?page=1`);
    expect(page).not.toHaveProperty('next');
  });
});
