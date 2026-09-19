import { createVerify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  actorDocument,
  canonicalOrigin,
  createDocument,
  emptyActorCollection,
  noteDocument,
  objectUrl,
  outboxDocument,
  outboxPageDocument,
  webfingerAccount,
  webfingerDocument,
} from '../lib/core/federation';
import { isPublicFederationAddress } from '../lib/core/federation-network';
import {
  decryptFederationPrivateKey,
  encryptFederationPrivateKey,
  generateFederationKeyPair,
  parseLegacySignature,
  signedFederationHeaders,
  verifyLegacyFederationRequest,
} from '../lib/server/federation-crypto';

const pair = generateFederationKeyPair();

const actor = {
  actorKey: '2dfdb22d-e931-4dcb-bc68-65b3414d5b3c',
  username: 'marta',
  displayName: 'Marta',
  bio: 'Fotografie e pane.',
  publicKeyPem: pair.publicKeyPem,
};
const post = {
  activityKey: '6fbc81f6-b48e-4c0d-b541-3d28e545ce26',
  author: actor,
  body: 'Pane <caldo>\ne fotografie.',
  contentWarning: 'Contiene una sorpresa & farina',
  published: '2026-09-14T10:00:00.000Z',
  media: null,
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
    expect(document.publicKey).toEqual({
      id: `${document.id}#main-key`,
      owner: document.id,
      publicKeyPem: pair.publicKeyPem,
    });
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

  it('descrive un allegato senza esporre il percorso del bucket privato', () => {
    const note = noteDocument('https://sn.example', {
      ...post,
      media: { path: 'privato/non-esporre', type: 'image/webp', alt: 'Pane sul tavolo.' },
    });
    expect(note.attachment).toEqual([
      {
        type: 'Image',
        mediaType: 'image/webp',
        name: 'Pane sul tavolo.',
        url: `https://sn.example/ap/media/${post.activityKey}`,
      },
    ]);
    expect(JSON.stringify(note)).not.toContain('privato/non-esporre');
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

  it('non espone il grafo sociale locale nelle collezioni federate', () => {
    for (const relation of ['followers', 'following'] as const) {
      const collection = emptyActorCollection('https://sn.example', actor, relation);
      expect(collection.id).toBe(`${actorDocument('https://sn.example', actor).id}/${relation}`);
      expect(collection.totalItems).toBe(0);
      expect(collection.orderedItems).toEqual([]);
    }
  });

  it('cifra la chiave privata e rifiuta segreti o dati alterati', () => {
    const secret = Buffer.alloc(32, 7).toString('base64');
    const encrypted = encryptFederationPrivateKey(pair.privateKeyPem, secret);
    expect(encrypted).not.toContain('PRIVATE KEY');
    expect(decryptFederationPrivateKey(encrypted, secret)).toBe(pair.privateKeyPem);
    const altered = `${encrypted.slice(0, -1)}${encrypted.endsWith('A') ? 'B' : 'A'}`;
    expect(() => decryptFederationPrivateKey(altered, secret)).toThrow();
    expect(() => encryptFederationPrivateKey(pair.privateKeyPem, 'corta')).toThrow(
      'Chiave di cifratura',
    );
  });

  it('firma le consegne POST includendo destinazione, data e digest', () => {
    const body = JSON.stringify({ type: 'Follow' });
    const headers = signedFederationHeaders(
      'https://remote.example/inbox?shared=1',
      body,
      'https://sn.example/ap/actors/key#main-key',
      pair.privateKeyPem,
      new Date('2026-09-19T10:00:00Z'),
    );
    const signature = /signature="([^"]+)"/.exec(headers.Signature)?.[1];
    const signingString = `(request-target): post /inbox?shared=1\nhost: remote.example\ndate: ${headers.Date}\ndigest: ${headers.Digest}`;
    const verifier = createVerify('RSA-SHA256');
    verifier.update(signingString);
    verifier.end();
    expect(signature).toBeTruthy();
    expect(verifier.verify(pair.publicKeyPem, signature!, 'base64')).toBe(true);
    expect(() =>
      signedFederationHeaders(
        'http://remote.example/inbox',
        body,
        'https://sn.example/key',
        pair.privateKeyPem,
      ),
    ).toThrow('HTTPS');
  });

  it('verifica la firma ricevuta e rifiuta corpo, data o parametri alterati', () => {
    const body = new TextEncoder().encode(JSON.stringify({ type: 'Follow' }));
    const url = 'https://sn.example/ap/actors/key/inbox';
    const now = new Date('2026-09-19T10:00:00Z');
    const signed = signedFederationHeaders(
      url,
      new TextDecoder().decode(body),
      'https://remote.example/users/marta#main-key',
      pair.privateKeyPem,
      now,
    );
    const headers = new Headers(signed);
    expect(
      verifyLegacyFederationRequest({ method: 'POST', url, headers }, body, pair.publicKeyPem, now),
    ).toBe('https://remote.example/users/marta#main-key');
    expect(() =>
      verifyLegacyFederationRequest(
        { method: 'POST', url, headers },
        new TextEncoder().encode('{"type":"Undo"}'),
        pair.publicKeyPem,
        now,
      ),
    ).toThrow('Digest');
    const wrongHost = new Headers(headers);
    wrongHost.set('host', 'alt.example');
    expect(() =>
      verifyLegacyFederationRequest(
        { method: 'POST', url, headers: wrongHost },
        body,
        pair.publicKeyPem,
        now,
      ),
    ).toThrow('Destinazione');
    headers.set('date', new Date('2026-09-18T10:00:00Z').toUTCString());
    expect(() =>
      verifyLegacyFederationRequest({ method: 'POST', url, headers }, body, pair.publicKeyPem, now),
    ).toThrow('Data');
    expect(() => parseLegacySignature('keyId="https://remote.example/key",keyId="x"')).toThrow(
      'non valida',
    );
  });

  it('impedisce alla risoluzione federata di raggiungere reti interne o riservate', () => {
    for (const address of [
      '127.0.0.1',
      '10.0.0.3',
      '169.254.169.254',
      '192.168.1.2',
      '::1',
      'fd00::1',
      'fe80::1',
      '::ffff:127.0.0.1',
    ])
      expect(isPublicFederationAddress(address)).toBe(false);
    expect(isPublicFederationAddress('93.184.216.34')).toBe(true);
    expect(isPublicFederationAddress('2606:2800:220:1:248:1893:25c8:1946')).toBe(true);
  });
});
