export type PublicActor = {
  actorKey: string;
  username: string;
  displayName: string;
  bio: string;
};
export type PublicPost = {
  activityKey: string;
  author: PublicActor;
  body: string;
  contentWarning: string;
  published: string;
};

const publicAudience = 'https://www.w3.org/ns/activitystreams#Public';
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );

/** Stable identity plan; wire format and transports belong in a dedicated Fedify adapter. */
export function actorUrl(origin: string, actorKey: string) {
  return new URL(`/ap/actors/${actorKey}`, origin).href;
}
export function activityUrl(origin: string, activityKey: string) {
  return new URL(`/ap/activities/${activityKey}`, origin).href;
}
export function objectUrl(origin: string, activityKey: string) {
  return new URL(`/ap/objects/${activityKey}`, origin).href;
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
  const summary = escapeHtml(actor.bio);
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

export function noteDocument(origin: string, post: PublicPost) {
  const actor = actorUrl(origin, post.author.actorKey);
  const id = objectUrl(origin, post.activityKey);
  const to = [publicAudience];
  const cc = [`${actor}/followers`];
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id,
    type: 'Note',
    attributedTo: actor,
    content: escapeHtml(post.body).replaceAll('\n', '<br>'),
    published: post.published,
    url: id,
    to,
    cc,
    sensitive: Boolean(post.contentWarning),
    summary: post.contentWarning ? escapeHtml(post.contentWarning) : null,
  } as const;
}

export function createDocument(origin: string, post: PublicPost) {
  const actor = actorUrl(origin, post.author.actorKey);
  const object = noteDocument(origin, post);
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: activityUrl(origin, post.activityKey),
    type: 'Create',
    actor,
    published: post.published,
    to: object.to,
    cc: object.cc,
    object,
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
