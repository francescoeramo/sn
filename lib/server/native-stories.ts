import 'server-only';
import { checked, type identityFrom } from './supabase';
import type { z } from 'zod';
import type { postCursorInput } from '@/lib/core/rules';

type Identity = Awaited<ReturnType<typeof identityFrom>>;
type Cursor = z.infer<typeof postCursorInput>;

/** Independent story window: own/followed authors, with visibility enforced by RLS. */
export async function nativeStoriesPage({ db, user }: Identity, cursor?: Cursor) {
  const follows = checked(
    await db.from('follows').select('following_id').eq('follower_id', user.id).eq('accepted', true),
  );
  const authors = [...new Set([user.id, ...follows.map((row) => row.following_id)])];
  let query = db
    .from('posts')
    .select(
      'id,author_id,body,kind,media_path,media_type,alt,content_warning,created_at,expires_at,author:profiles!posts_author_id_fkey(id,username,display_name),media:post_media(id,media_path,media_type,alt,position)',
    )
    .eq('kind', 'story')
    .in('author_id', authors)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(41);
  if (cursor)
    query = query.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.post_id})`,
    );
  const rows = checked(await query);
  const stories = rows.slice(0, 40);
  const viewed = stories.length
    ? checked(
        await db
          .from('story_views')
          .select('story_id')
          .eq('viewer_id', user.id)
          .in(
            'story_id',
            stories.map((story) => story.id),
          ),
      )
    : [];
  const viewedIds = new Set(viewed.map((row) => row.story_id));
  const last = stories.at(-1);
  return {
    stories: stories.map((story) => ({ ...story, viewed: viewedIds.has(story.id) })),
    nextCursor: rows.length > 40 && last ? { created_at: last.created_at, post_id: last.id } : null,
  };
}
