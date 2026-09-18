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

const outboxPageSize = 20;

export async function publicOutbox(actorKey: string, page?: number) {
  const db = adminDatabase();
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('id,actor_key,username,display_name,bio')
    .eq('actor_key', actorKey)
    .eq('is_private', false)
    .eq('disabled', false)
    .maybeSingle();
  if (profileError || !profile) return null;

  const actor = {
    actorKey: profile.actor_key,
    username: profile.username,
    displayName: profile.display_name,
    bio: profile.bio,
  } satisfies PublicActor;
  const baseQuery = () =>
    db
      .from('posts')
      .select('activity_key,body,content_warning,created_at', { count: 'exact' })
      .eq('author_id', profile.id)
      .neq('kind', 'story')
      .is('expires_at', null)
      .neq('body', '');

  if (page === undefined) {
    const { count, error } = await baseQuery().limit(0);
    return error ? null : { actor, totalItems: count ?? 0 };
  }

  const from = (page - 1) * outboxPageSize;
  const { data, count, error } = await baseQuery()
    .order('created_at', { ascending: false })
    .order('activity_key', { ascending: false })
    .range(from, from + outboxPageSize - 1);
  if (error || !data) return null;
  const posts = data
    .filter((post) => post.body.trim())
    .map(
      (post) =>
        ({
          activityKey: post.activity_key,
          author: actor,
          body: post.body,
          contentWarning: post.content_warning ?? '',
          published: post.created_at,
        }) satisfies PublicPost,
    );
  return { actor, posts, hasMore: from + data.length < (count ?? 0) };
}
