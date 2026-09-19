import 'server-only';
import { canonicalOrigin, type PublicActor, type PublicPost } from '@/lib/core/federation';
import { adminDatabase, ApiError } from './supabase';
import { encryptFederationPrivateKey, generateFederationKeyPair } from './federation-crypto';

async function actorPublicKey(actorId: string) {
  const { data, error } = await adminDatabase()
    .from('federation_actor_keys')
    .select('public_key_pem')
    .eq('actor_id', actorId)
    .maybeSingle();
  return error || !data ? null : data.public_key_pem;
}

export async function ensureFederationActorKey(actorId: string) {
  const db = adminDatabase();
  const existing = await actorPublicKey(actorId);
  if (existing) return existing;
  const pair = generateFederationKeyPair();
  let privateKeyEncrypted: string;
  try {
    privateKeyEncrypted = encryptFederationPrivateKey(
      pair.privateKeyPem,
      process.env.FEDERATION_KEY_SECRET,
    );
  } catch {
    throw new ApiError('Chiave di cifratura della federazione non configurata.', 503);
  }
  const { error } = await db.from('federation_actor_keys').upsert(
    {
      actor_id: actorId,
      public_key_pem: pair.publicKeyPem,
      private_key_encrypted: privateKeyEncrypted,
    },
    { onConflict: 'actor_id', ignoreDuplicates: true },
  );
  if (error) return null;
  return actorPublicKey(actorId);
}

export function federationPreviewOrigin() {
  if (process.env.NODE_ENV === 'production' || process.env.FEDERATION_DISCOVERY_PREVIEW !== 'true')
    return null;
  return canonicalOrigin(process.env.APP_ORIGIN);
}

export async function publicActorBy(field: 'username' | 'actor_key', value: string) {
  const { data, error } = await adminDatabase()
    .from('profiles')
    .select('id,actor_key,username,display_name,bio')
    .eq(field, value)
    .eq('is_private', false)
    .eq('federation_enabled', true)
    .eq('disabled', false)
    .maybeSingle();
  if (error || !data) return null;
  const publicKeyPem = await actorPublicKey(data.id);
  if (!publicKeyPem) return null;
  return {
    actorKey: data.actor_key,
    username: data.username,
    displayName: data.display_name,
    bio: data.bio,
    publicKeyPem,
  } satisfies PublicActor;
}

export async function publicPostBy(activityKey: string) {
  const db = adminDatabase();
  const { data: post, error } = await db
    .from('posts')
    .select(
      'activity_key,author_id,body,content_warning,created_at,kind,expires_at,media_path,media_type,alt',
    )
    .eq('activity_key', activityKey)
    .neq('kind', 'story')
    .is('expires_at', null)
    .maybeSingle();
  if (error || !post || !post.body.trim()) return null;
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('id,actor_key,username,display_name,bio')
    .eq('id', post.author_id)
    .eq('is_private', false)
    .eq('federation_enabled', true)
    .eq('disabled', false)
    .maybeSingle();
  if (profileError || !profile) return null;
  const publicKeyPem = await actorPublicKey(profile.id);
  if (!publicKeyPem) return null;
  return {
    activityKey: post.activity_key,
    author: {
      actorKey: profile.actor_key,
      username: profile.username,
      displayName: profile.display_name,
      bio: profile.bio,
      publicKeyPem,
    },
    body: post.body,
    contentWarning: post.content_warning ?? '',
    published: post.created_at,
    media:
      post.media_path && post.media_type
        ? { path: post.media_path, type: post.media_type, alt: post.alt }
        : null,
  } satisfies PublicPost;
}

export async function publicMediaBy(activityKey: string) {
  const post = await publicPostBy(activityKey);
  if (!post?.media) return null;
  const { data, error } = await adminDatabase().storage.from('media').download(post.media.path);
  if (error || !data) return null;
  return { data, type: post.media.type };
}

const outboxPageSize = 20;

export async function publicOutbox(actorKey: string, page?: number) {
  const db = adminDatabase();
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('id,actor_key,username,display_name,bio')
    .eq('actor_key', actorKey)
    .eq('is_private', false)
    .eq('federation_enabled', true)
    .eq('disabled', false)
    .maybeSingle();
  if (profileError || !profile) return null;

  const publicKeyPem = await actorPublicKey(profile.id);
  if (!publicKeyPem) return null;
  const actor = {
    actorKey: profile.actor_key,
    username: profile.username,
    displayName: profile.display_name,
    bio: profile.bio,
    publicKeyPem,
  } satisfies PublicActor;
  const baseQuery = () =>
    db
      .from('posts')
      .select('activity_key,body,content_warning,created_at,media_path,media_type,alt', {
        count: 'exact',
      })
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
          media:
            post.media_path && post.media_type
              ? { path: post.media_path, type: post.media_type, alt: post.alt }
              : null,
        }) satisfies PublicPost,
    );
  return { actor, posts, hasMore: from + data.length < (count ?? 0) };
}
