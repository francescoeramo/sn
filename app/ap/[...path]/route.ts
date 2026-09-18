import {
  actorDocument,
  createDocument,
  emptyActorCollection,
  federationStatus,
  noteDocument,
  outboxDocument,
  outboxPageDocument,
} from '@/lib/core/federation';
import {
  federationPreviewOrigin,
  publicActorBy,
  publicOutbox,
  publicPostBy,
} from '@/lib/server/federation';

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
export function POST() {
  return Response.json(federationStatus, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
