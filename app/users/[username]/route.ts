import { actorDocument, federationStatus } from '@/lib/core/federation';
import { federationPreviewOrigin, publicActorBy } from '@/lib/server/federation';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ username: string }> };

export async function GET(_request: Request, context: Context) {
  const origin = federationPreviewOrigin();
  if (!origin)
    return Response.json(federationStatus, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  const { username } = await context.params;
  const actor = await publicActorBy('username', username);
  if (!actor) return Response.json({ error: 'Profilo non trovato.' }, { status: 404 });
  return Response.json(actorDocument(origin, actor), {
    headers: { 'Content-Type': 'application/activity+json', 'Cache-Control': 'no-store' },
  });
}
