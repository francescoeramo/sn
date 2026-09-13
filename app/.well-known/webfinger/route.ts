import { federationStatus, webfingerAccount, webfingerDocument } from '@/lib/core/federation';
import { federationPreviewOrigin, publicActorBy } from '@/lib/server/federation';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const origin = federationPreviewOrigin();
  if (!origin)
    return Response.json(federationStatus, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  const username = webfingerAccount(new URL(request.url).searchParams.get('resource'), origin);
  if (!username) return Response.json({ error: 'Account non valido.' }, { status: 400 });
  const actor = await publicActorBy('username', username);
  if (!actor) return Response.json({ error: 'Account non trovato.' }, { status: 404 });
  return Response.json(webfingerDocument(origin, actor), {
    headers: { 'Content-Type': 'application/jrd+json', 'Cache-Control': 'no-store' },
  });
}
