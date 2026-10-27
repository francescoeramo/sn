import 'server-only';
import { checked, type identityFrom } from './supabase';

type Identity = Awaited<ReturnType<typeof identityFrom>>;

/** M1 reads only feed/profile data using the already verified user's RLS client. */
export async function nativeFeedSnapshot({ db, user, profile }: Identity) {
  const [profileResult, postResult, followResult] = await Promise.all([
    db.from('profiles').select('id,username,display_name,bio').order('created_at').limit(20),
    db
      .from('posts')
      .select(
        'id,author_id,body,kind,media_path,media_type,alt,created_at,content_warning,media:post_media(id,media_path,media_type,alt,position),circle_links:circle_posts(post_id)',
      )
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(40),
    db.from('follows').select('follower_id,following_id,accepted').eq('follower_id', user.id),
  ]);
  const posts = checked(postResult);
  const last = posts.at(-1);
  return {
    user_id: user.id,
    me: { id: profile.id, username: profile.username, display_name: profile.display_name },
    profiles: checked(profileResult),
    posts,
    follows: checked(followResult),
    nextCursor: posts.length === 40 && last ? last.created_at : null,
    nextPostId: posts.length === 40 && last ? last.id : null,
  };
}
