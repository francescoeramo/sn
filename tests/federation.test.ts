import { describe, expect, it } from 'vitest';
import {
  actorDocument,
  canonicalOrigin,
  webfingerAccount,
  webfingerDocument,
} from '../lib/core/federation';

const actor = {
  actorKey: '2dfdb22d-e931-4dcb-bc68-65b3414d5b3c',
  username: 'marta',
  displayName: 'Marta',
  bio: 'Fotografie e pane.',
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
});
