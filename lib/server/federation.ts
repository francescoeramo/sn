import 'server-only';
import { canonicalOrigin, type PublicActor } from '@/lib/core/federation';
import { adminDatabase } from './supabase';

export function federationPreviewOrigin() {
  if (process.env.NODE_ENV === 'production' || process.env.FEDERATION_DISCOVERY_PREVIEW !== 'true')
    return null;
  return canonicalOrigin(process.env.APP_ORIGIN);
}

export async function publicActorBy(field: 'username' | 'actor_key', value: string) {
  const { data, error } = await adminDatabase()
    .from('profiles')
    .select('actor_key,username,display_name,bio')
    .eq(field, value)
    .eq('is_private', false)
    .eq('disabled', false)
    .maybeSingle();
  if (error || !data) return null;
  return {
    actorKey: data.actor_key,
    username: data.username,
    displayName: data.display_name,
    bio: data.bio,
  } satisfies PublicActor;
}
