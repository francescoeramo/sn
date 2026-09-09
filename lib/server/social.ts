import 'server-only';
import { z } from 'zod';
import { LIMITS, postInput, userId } from '@/lib/core/rules';
import { identity, checked, adminDatabase, ApiError } from './supabase';

export async function snapshot() {
  const { db, user, profile } = await identity();
  const results = await Promise.all([
    db
      .from('profiles')
      .select('id,username,display_name,bio,is_private,color,created_at')
      .order('created_at')
      .limit(20),
    db
      .from('posts')
      .select('*')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(40),
    db.from('comments').select('*').order('created_at', { ascending: false }).limit(300),
    db.from('likes').select('*').limit(1000),
    db.from('follows').select('*'),
    db.from('messages').select('*').order('created_at', { ascending: false }).limit(100),
    db.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
    db.from('reports').select('*').order('created_at', { ascending: false }).limit(50),
    db.from('blocks').select('*'),
    db.rpc('my_usage'),
  ]);
  const [
    profiles,
    posts,
    comments,
    likes,
    follows,
    messages,
    notifications,
    reports,
    blocks,
    usage,
  ] = results.map((r) => checked(r));
  return {
    me: profile,
    profiles,
    posts,
    comments,
    likes,
    follows,
    messages,
    notifications,
    reports,
    blocks,
    usage: {
      bytes: usage.bytes,
      total_bytes: usage.total_bytes,
      members: usage.members,
      max_members: LIMITS.members,
      uploads_enabled: usage.uploads_enabled,
    },
    isAdmin: usage.isAdmin,
    user_id: user.id,
    nextCursor: posts.length === 40 ? posts.at(-1).created_at : null,
  };
}

export async function mutate(input: unknown) {
  const { db, user } = await identity();
  const obj = z.object({ type: z.string() }).passthrough().parse(input);
  switch (obj.type) {
    case 'post': {
      const v = postInput.parse(obj);
      checked(await db.from('posts').insert({ ...v, author_id: user.id }));
      break;
    }
    case 'like': {
      const id = userId.parse(obj.post_id);
      const existing = checked(
        await db.from('likes').select('*').eq('post_id', id).eq('user_id', user.id),
      );
      checked(
        existing.length
          ? await db.from('likes').delete().eq('post_id', id).eq('user_id', user.id)
          : await db.from('likes').insert({ post_id: id, user_id: user.id }),
      );
      break;
    }
    case 'comment': {
      const v = z.object({ post_id: userId, body: z.string().trim().min(1).max(1000) }).parse(obj);
      checked(await db.from('comments').insert({ ...v, author_id: user.id }));
      break;
    }
    case 'follow': {
      const id = userId.parse(obj.user_id);
      const existing = checked(
        await db.from('follows').select('*').eq('follower_id', user.id).eq('following_id', id),
      );
      checked(
        existing.length
          ? await db.from('follows').delete().eq('follower_id', user.id).eq('following_id', id)
          : await db.from('follows').insert({ follower_id: user.id, following_id: id }),
      );
      break;
    }
    case 'accept': {
      const id = userId.parse(obj.user_id);
      checked(
        z.boolean().parse(obj.accept)
          ? await db
              .from('follows')
              .update({ accepted: true })
              .eq('follower_id', id)
              .eq('following_id', user.id)
          : await db.from('follows').delete().eq('follower_id', id).eq('following_id', user.id),
      );
      break;
    }
    case 'message': {
      const v = z.object({ user_id: userId, body: z.string().trim().min(1).max(2000) }).parse(obj);
      checked(
        await db
          .from('messages')
          .insert({ sender_id: user.id, recipient_id: v.user_id, body: v.body }),
      );
      break;
    }
    case 'profile': {
      const v = z
        .object({
          display_name: z.string().trim().min(1).max(60),
          bio: z.string().trim().max(300),
          is_private: z.boolean(),
        })
        .parse(obj);
      checked(await db.from('profiles').update(v).eq('id', user.id));
      break;
    }
    case 'read-notifications':
      checked(await db.from('notifications').update({ read: true }).eq('user_id', user.id));
      break;
    case 'delete-post': {
      const id = userId.parse(obj.post_id);
      const post = checked(
        await db.from('posts').select('id').eq('id', id).eq('author_id', user.id).single(),
      );
      if (!post) throw new ApiError('Post non disponibile.', 404);
      // Delete row first to revoke visibility immediately; maintenance removes the orphaned blob.
      checked(await db.from('posts').delete().eq('id', id).eq('author_id', user.id));
      break;
    }
    case 'report': {
      const v = z
        .object({ post_id: userId, reason: z.string().trim().min(5).max(1000) })
        .parse(obj);
      checked(await db.from('reports').insert({ ...v, reporter_id: user.id }));
      break;
    }
    case 'moderate': {
      const v = z.object({ report_id: userId, remove: z.boolean() }).parse(obj);
      const usage = checked(await db.rpc('my_usage'));
      if (!usage.isAdmin) throw new ApiError('Accesso negato.', 403);
      const report = checked(await db.from('reports').select('*').eq('id', v.report_id).single());
      if (v.remove && report.post_id)
        checked(await db.from('posts').delete().eq('id', report.post_id));
      checked(
        await db
          .from('reports')
          .update({ status: v.remove ? 'removed' : 'dismissed' })
          .eq('id', v.report_id),
      );
      break;
    }
    case 'block': {
      const id = userId.parse(obj.user_id);
      const existing = checked(
        await db.from('blocks').select('*').eq('blocker_id', user.id).eq('blocked_id', id),
      );
      checked(
        existing.length
          ? await db.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', id)
          : await db.from('blocks').insert({ blocker_id: user.id, blocked_id: id }),
      );
      break;
    }
    default:
      throw new ApiError('Operazione non riconosciuta.');
  }
  return snapshot();
}

export async function exportData() {
  const { db, user, profile } = await identity();
  const all: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    profile,
    email: user.email,
  };
  for (const [table, column] of [
    ['posts', 'author_id'],
    ['comments', 'author_id'],
    ['likes', 'user_id'],
    ['media_assets', 'owner_id'],
    ['notifications', 'user_id'],
    ['reports', 'reporter_id'],
    ['blocks', 'blocker_id'],
    ['follows', ''],
    ['messages', ''],
  ]) {
    const rows: unknown[] = [];
    for (let offset = 0; ; offset += 500) {
      let query = db.from(table).select('*');
      if (column) query = query.eq(column, user.id);
      const batch = checked(
        await query
          .order(
            table === 'follows'
              ? 'follower_id'
              : table === 'likes'
                ? 'post_id'
                : table === 'media_assets'
                  ? 'path'
                  : table === 'blocks'
                    ? 'blocked_id'
                    : 'id',
          )
          .range(offset, offset + 499),
      );
      rows.push(...batch);
      if (batch.length < 500) break;
    }
    all[table] = rows;
  }
  return all;
}

export async function deleteAccount(password: string) {
  const { db, user } = await identity();
  if (!user.email) throw new ApiError('Email non disponibile.');
  const reauth = await db.auth.signInWithPassword({ email: user.email, password });
  if (reauth.error) throw new ApiError('Password non corretta.', 403);
  const admin = adminDatabase();
  const token = reauth.data.session.access_token;
  checked(await admin.auth.admin.signOut(token, 'global'));
  // Disable database access before cleanup, including tokens issued before this request.
  checked(await admin.from('profiles').update({ disabled: true }).eq('id', user.id));
  const assets = checked(await admin.from('media_assets').select('path').eq('owner_id', user.id));
  for (let i = 0; i < assets.length; i += 100)
    checked(await admin.storage.from('media').remove(assets.slice(i, i + 100).map((a) => a.path)));
  checked(await admin.auth.admin.deleteUser(user.id));
  await db.auth.signOut({ scope: 'local' });
  return { ok: true };
}
