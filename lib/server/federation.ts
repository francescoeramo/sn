import 'server-only';
import { canonicalOrigin, type PublicActor, type PublicPost } from '@/lib/core/federation';
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

export async function publicPostBy(activityKey: string) {
  const db = adminDatabase();
  const { data: post, error } = await db
    .from('posts')
    .select('activity_key,author_id,body,content_warning,created_at,kind,expires_at')
    .eq('activity_key', activityKey)
    .neq('kind', 'story')
    .is('expires_at', null)
    .maybeSingle();
  if (error || !post || !post.body.trim()) return null;
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('actor_key,username,display_name,bio')
    .eq('id', post.author_id)
    .eq('is_private', false)
    .eq('disabled', false)
    .maybeSingle();
  if (profileError || !profile) return null;
  return {
    activityKey: post.activity_key,
    author: {
      actorKey: profile.actor_key,
      username: profile.username,
      displayName: profile.display_name,
      bio: profile.bio,
    },
    body: post.body,
    contentWarning: post.content_warning ?? '',
    published: post.created_at,
  } satisfies PublicPost;
}
