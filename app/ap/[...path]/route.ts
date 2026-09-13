import { actorDocument, federationStatus } from '@/lib/core/federation';
import { federationPreviewOrigin, publicActorBy } from '@/lib/server/federation';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ path: string[] }> };

export async function GET(_request: Request, context: Context) {
  const origin = federationPreviewOrigin();
  const { path } = await context.params;
  if (origin && path.length === 2 && path[0] === 'actors') {
    const actor = await publicActorBy('actor_key', path[1]);
    if (!actor) return Response.json({ error: 'Attore non trovato.' }, { status: 404 });
    return Response.json(actorDocument(origin, actor), {
      headers: { 'Content-Type': 'application/activity+json', 'Cache-Control': 'no-store' },
    });
  }
  return Response.json(federationStatus, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
export function POST() {
  return Response.json(federationStatus, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
