import {
  actorUrl,
  actorDocument,
  createDocument,
  emptyActorCollection,
  federationStatus,
  noteDocument,
  outboxDocument,
  outboxPageDocument,
} from '@/lib/core/federation';
import { BodyTooLarge, readLimited } from '@/lib/core/http';
import {
  federationPreviewOrigin,
  inboxActorByKey,
  inboxPostByActivityKey,
  publicActorBy,
  publicMediaBy,
  publicOutbox,
  publicPostBy,
  recordFederatedActivity,
} from '@/lib/server/federation';
import {
  FederationCryptoError,
  parseLegacySignature,
  verifyLegacyFederationRequest,
} from '@/lib/server/federation-crypto';
import { fetchRemoteActorKey } from '@/lib/server/federation-remote';
import { ApiError } from '@/lib/server/supabase';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: Context) {
  const origin = federationPreviewOrigin();
  const { path } = await context.params;
  if (origin && path.length === 2 && path[0] === 'actors') {
    const actor = await publicActorBy('actor_key', path[1]);
    if (!actor) return Response.json({ error: 'Attore non trovato.' }, { status: 404 });
    return Response.json(actorDocument(origin, actor), {
      headers: { 'Content-Type': 'application/activity+json', 'Cache-Control': 'no-store' },
    });
  }
  if (origin && path.length === 2 && ['activities', 'objects'].includes(path[0])) {
    const post = await publicPostBy(path[1]);
    if (!post) return Response.json({ error: 'Contenuto non trovato.' }, { status: 404 });
    const document =
      path[0] === 'activities' ? createDocument(origin, post) : noteDocument(origin, post);
    return Response.json(document, {
      headers: { 'Content-Type': 'application/activity+json', 'Cache-Control': 'no-store' },
    });
  }
  if (origin && path.length === 2 && path[0] === 'media') {
    const media = await publicMediaBy(path[1]);
    if (!media) return Response.json({ error: 'Allegato non trovato.' }, { status: 404 });
    return new Response(media.data, {
      headers: {
        'Content-Type': media.type,
        'Cache-Control': 'no-store',
        'Content-Disposition': 'inline',
      },
    });
  }
  if (origin && path.length === 3 && path[0] === 'actors' && path[2] === 'outbox') {
    const value = new URL(request.url).searchParams.get('page');
    const page = value === null ? undefined : Number(value);
    if (page !== undefined && (!Number.isSafeInteger(page) || page < 1 || page > 1000))
      return Response.json({ error: 'Pagina non valida.' }, { status: 400 });
    const outbox = await publicOutbox(path[1], page);
    if (!outbox) return Response.json({ error: 'Outbox non trovato.' }, { status: 404 });
    if (page === undefined) {
      return Response.json(outboxDocument(origin, outbox.actor, outbox.totalItems ?? 0), {
        headers: { 'Content-Type': 'application/activity+json', 'Cache-Control': 'no-store' },
      });
    }
    const document = outboxPageDocument(
      origin,
      outbox.actor,
      outbox.posts ?? [],
      page,
      outbox.hasMore ?? false,
    );
    return Response.json(document, {
      headers: { 'Content-Type': 'application/activity+json', 'Cache-Control': 'no-store' },
    });
  }
  if (
    origin &&
    path.length === 3 &&
    path[0] === 'actors' &&
    (path[2] === 'followers' || path[2] === 'following')
  ) {
    const actor = await publicActorBy('actor_key', path[1]);
    if (!actor) return Response.json({ error: 'Collezione non trovata.' }, { status: 404 });
    return Response.json(emptyActorCollection(origin, actor, path[2]), {
      headers: { 'Content-Type': 'application/activity+json', 'Cache-Control': 'no-store' },
    });
  }
  return Response.json(federationStatus, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
const activityUrlValue = z.url({ protocol: /^https$/ }).max(2048);
const embeddedActivity = z
  .object({
    id: activityUrlValue,
    type: z.enum(['Follow', 'Like']),
    actor: activityUrlValue,
    object: activityUrlValue,
  })
  .passthrough();
const inboundActivity = z.discriminatedUnion('type', [
  z
    .object({
      id: activityUrlValue,
      type: z.literal('Follow'),
      actor: activityUrlValue,
      object: activityUrlValue,
    })
    .passthrough(),
  z
    .object({
      id: activityUrlValue,
      type: z.literal('Like'),
      actor: activityUrlValue,
      object: activityUrlValue,
    })
    .passthrough(),
  z
    .object({
      id: activityUrlValue,
      type: z.literal('Undo'),
      actor: activityUrlValue,
      object: embeddedActivity,
    })
    .passthrough(),
  z
    .object({
      id: activityUrlValue,
      type: z.literal('Reject'),
      actor: activityUrlValue,
      object: z.union([activityUrlValue, z.object({ id: activityUrlValue }).passthrough()]),
    })
    .passthrough(),
]);

export async function POST(request: Request, context: Context) {
  try {
    const origin = federationPreviewOrigin();
    const { path } = await context.params;
    if (!origin || path.length !== 3 || path[0] !== 'actors' || path[2] !== 'inbox')
      return Response.json(federationStatus, {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      });
    const contentType = request.headers.get('content-type') ?? '';
    if (
      !contentType.startsWith('application/activity+json') &&
      !contentType.startsWith('application/ld+json')
    )
      throw new ApiError('Formato ActivityPub non valido.', 415);
    const local = await inboxActorByKey(path[1]);
    if (!local) throw new ApiError('Inbox non trovata.', 404);
    const body = await readLimited(request, 131072);
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(body));
    } catch {
      throw new ApiError('Attività non valida.', 400);
    }
    const activity = inboundActivity.parse(parsed);
    const localActor = actorUrl(origin, local.actor.actorKey);
    let targetPostId: string | null = null;
    if (activity.type === 'Follow') {
      if (activity.object !== localActor) throw new ApiError('Destinatario non valido.', 400);
    } else if (activity.type === 'Like') {
      const object = new URL(activity.object);
      const prefix = new URL('/ap/objects/', origin).href;
      if (!object.href.startsWith(prefix)) throw new ApiError('Oggetto Like non valido.', 400);
      targetPostId = await inboxPostByActivityKey(object.href.slice(prefix.length), local.id);
      if (!targetPostId) throw new ApiError('Oggetto Like non trovato.', 404);
    } else if (activity.type === 'Undo') {
      const object = activity.object;
      if (
        object.actor !== activity.actor ||
        (object.type === 'Follow' && object.object !== localActor)
      )
        throw new ApiError('Undo non valido.', 400);
      if (object.type === 'Like') {
        const url = new URL(object.object);
        const prefix = new URL('/ap/objects/', origin).href;
        if (!url.href.startsWith(prefix)) throw new ApiError('Undo non valido.', 400);
        targetPostId = await inboxPostByActivityKey(url.href.slice(prefix.length), local.id);
        if (!targetPostId) throw new ApiError('Oggetto Like non trovato.', 404);
      }
    }
    const { keyId } = parseLegacySignature(request.headers.get('signature'));
    const remote = await fetchRemoteActorKey(keyId, activity.actor);
    verifyLegacyFederationRequest(request, body, remote.publicKeyPem);
    const reply =
      activity.type === 'Follow'
        ? {
            '@context': 'https://www.w3.org/ns/activitystreams',
            id: new URL(`/ap/activities/${crypto.randomUUID()}`, origin).href,
            type: 'Accept',
            actor: localActor,
            object: activity,
          }
        : null;
    await recordFederatedActivity(local.id, activity, remote.inbox, reply, targetPostId);
    return new Response(null, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status =
      error instanceof BodyTooLarge
        ? 413
        : error instanceof ApiError
          ? error.status
          : error instanceof FederationCryptoError
            ? 401
            : error instanceof z.ZodError
              ? 400
              : 500;
    const message =
      status === 413
        ? 'Attività troppo grande.'
        : status === 500
          ? 'Inbox non disponibile.'
          : error instanceof Error
            ? error.message
            : 'Attività non valida.';
    return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
