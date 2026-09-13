export type PublicActor = {
  actorKey: string;
  username: string;
  displayName: string;
  bio: string;
};

/** Stable identity plan; wire format and transports belong in a dedicated Fedify adapter. */
export function actorUrl(origin: string, actorKey: string) {
  return new URL(`/ap/actors/${actorKey}`, origin).href;
}
export function activityUrl(origin: string, activityKey: string) {
  return new URL(`/ap/activities/${activityKey}`, origin).href;
}
export const federationStatus = {
  enabled: false,
  reason: 'La federazione non è attiva nella beta privata.',
} as const;

export function canonicalOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function webfingerAccount(resource: string | null, origin: string) {
  if (!resource?.startsWith('acct:')) return null;
  const account = resource.slice(5);
  const separator = account.lastIndexOf('@');
  if (separator < 1) return null;
  const username = account.slice(0, separator);
  const host = account.slice(separator + 1).toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(username) || host !== new URL(origin).host.toLowerCase())
    return null;
  return username;
}

export function actorDocument(origin: string, actor: PublicActor) {
  const id = actorUrl(origin, actor.actorKey);
  const summary = actor.bio.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id,
    type: 'Person',
    preferredUsername: actor.username,
    name: actor.displayName,
    summary,
    url: new URL(`/users/${actor.username}`, origin).href,
    inbox: `${id}/inbox`,
    outbox: `${id}/outbox`,
    followers: `${id}/followers`,
    following: `${id}/following`,
  } as const;
}

export function webfingerDocument(origin: string, actor: PublicActor) {
  return {
    subject: `acct:${actor.username}@${new URL(origin).host}`,
    aliases: [new URL(`/users/${actor.username}`, origin).href],
    links: [
      {
        rel: 'self',
        type: 'application/activity+json',
        href: actorUrl(origin, actor.actorKey),
      },
    ],
  } as const;
}
