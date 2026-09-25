import 'server-only';
import { z } from 'zod';
import {
  LIMITS,
  postInput,
  userId,
  encryptedMessageInput,
  noteInput,
  noteReviewInput,
  bookmarkInput,
  chatSettingsInput,
  receiptInput,
  editMessageInput,
  deleteMessageInput,
  circleInput,
  circleInviteInput,
  circleResponseInput,
  circleIdInput,
  circleMemberInput,
  circleRoleInput,
  circleUpdateInput,
} from '@/lib/core/rules';
import { identity, checked, adminDatabase, ApiError } from './supabase';
import { enqueueFederatedActivity, ensureFederationActorKey, publicPostBy } from './federation';
import { activityPubPlainText, createDocument, deleteDocument } from '@/lib/core/federation';
import type {
  Bookmark,
  FederationBlock,
  ModerationAccount,
  Post,
  RemotePost,
  RemoteReport,
  SavedCursor,
  SavedPage,
} from '@/lib/core/types';

type Database = Awaited<ReturnType<typeof identity>>['db'];
async function bookmarksFor(db: Database): Promise<Bookmark[]> {
  const rows: Bookmark[] = [];
  for (let offset = 0; ; offset += 1000) {
    const batch = checked(
      await db
        .from('bookmarks')
        .select('*')
        .order('post_id')
        .range(offset, offset + 999),
    ) as Bookmark[];
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
}
async function savedPageFor(db: Database, before?: SavedCursor): Promise<SavedPage> {
  let query = db
    .from('bookmarks')
    .select(
      'created_at,post_id,post:posts!inner(*,notes:community_notes(*),poll:polls(*,options:poll_options(*)))',
    )
    .order('created_at', { ascending: false })
    .order('post_id', { ascending: false })
    .limit(40);
  if (before)
    query = query.or(
      `created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},post_id.lt.${before.post_id})`,
    );
  const rows = checked(await query) as unknown as {
    created_at: string;
    post_id: string;
    post: Post;
  }[];
  const last = rows.at(-1);
  return {
    posts: rows.map((r) => r.post),
    nextCursor:
      rows.length === 40 && last ? { created_at: last.created_at, post_id: last.post_id } : null,
  };
}
async function remotePostsFor(userId: string): Promise<RemotePost[]> {
  const db = adminDatabase();
  const [objectResult, hiddenResult] = await Promise.all([
    db
      .from('federation_remote_objects')
      .select('object_id,remote_actor,content,summary,published_at,received_at,updated_at')
      .eq('local_actor_id', userId)
      .is('deleted_at', null)
      .is('hidden_at', null)
      .order('received_at', { ascending: false })
      .limit(40),
    db.from('federation_remote_reports').select('object_id').eq('status', 'hidden'),
  ]);
  const hidden = new Set(
    (checked(hiddenResult) as { object_id: string }[]).map((item) => item.object_id),
  );
  const objects = (
    checked(objectResult) as {
      object_id: string;
      remote_actor: string;
      content: string;
      summary: string | null;
      published_at: string | null;
      received_at: string;
      updated_at: string | null;
    }[]
  ).filter((item) => !hidden.has(item.object_id));
  const actors = [...new Set(objects.map((item) => item.remote_actor))];
  const keys = actors.length
    ? (checked(
        await db
          .from('federation_remote_actor_keys')
          .select('remote_actor,username,display_name,fetched_at')
          .in('remote_actor', actors)
          .order('fetched_at', { ascending: false }),
      ) as {
        remote_actor: string;
        username: string | null;
        display_name: string | null;
        fetched_at: string;
      }[])
    : [];
  const identities = new Map(keys.map((key) => [key.remote_actor, key]));
  return objects.map((item) => {
    const identity = identities.get(item.remote_actor);
    const actor = new URL(item.remote_actor);
    const fallback = actor.pathname.split('/').filter(Boolean).at(-1) ?? actor.hostname;
    return {
      id: item.object_id,
      actor: item.remote_actor,
      username: identity?.username ?? fallback,
      display_name: identity?.display_name ?? identity?.username ?? fallback,
      host: actor.host,
      body: activityPubPlainText(item.content),
      content_warning: activityPubPlainText(item.summary ?? ''),
      created_at: item.published_at ?? item.received_at,
      updated_at: item.updated_at,
    };
  });
}
export async function savedPage(before?: SavedCursor) {
  const { db } = await identity();
  return savedPageFor(db, before);
}

export async function snapshot() {
  const { db, user, profile } = await identity();
  const results = await Promise.all([
    db
      .from('profiles')
      .select('id,username,display_name,bio,is_private,federation_enabled,color,created_at')
      .order('created_at')
      .limit(20),
    db
      .from('posts')
      .select('*, notes:community_notes(*), poll:polls(*,options:poll_options(*))')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(40),
    db.from('comments').select('*').order('created_at', { ascending: false }).limit(300),
    db.from('likes').select('*').limit(1000),
    db.from('follows').select('*'),
    db
      .from('messages')
      .select('*')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(100),
    db.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
    db.from('reports').select('*').order('created_at', { ascending: false }).limit(50),
    db.from('moderation_audit').select('*').order('created_at', { ascending: false }).limit(100),
    db.from('blocks').select('*'),
    db.rpc('my_usage'),
    db
      .from('community_notes')
      .select('*, post:posts(body)')
      .order('created_at', { ascending: false })
      .limit(500),
    db.from('circles').select('*').order('updated_at', { ascending: false }),
    db.from('circle_members').select('*').order('created_at'),
    db.from('circle_posts').select('*').order('created_at', { ascending: false }).limit(500),
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
    moderationAudit,
    blocks,
    usage,
    notes,
    circles,
    circleMembers,
    circlePosts,
  ] = results.map((r) => checked(r));
  const [bookmarks, saved, pollResults, remotePosts] = await Promise.all([
    bookmarksFor(db),
    savedPageFor(db),
    db.rpc('poll_results', { target_polls: posts.map((post: Post) => post.id) }).then(checked),
    remotePostsFor(user.id),
  ]);
  const moderationAccounts = usage.isAdmin
    ? (checked(await db.rpc('moderation_accounts')) as ModerationAccount[])
    : [];
  const remoteReports = usage.isAdmin
    ? (checked(
        await db
          .from('federation_remote_reports')
          .select('*')
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(50),
      ) as RemoteReport[])
    : [];
  const federationBlocks = usage.isAdmin
    ? (checked(await db.rpc('federation_blocked_instances')) as FederationBlock[])
    : [];
  return {
    bookmarks,
    saved,
    circles,
    circleMembers,
    circlePosts,
    notes,
    pollResults,
    me: profile,
    profiles,
    posts,
    remotePosts,
    comments,
    likes,
    follows,
    messages,
    notifications,
    reports,
    moderationAudit,
    moderationAccounts,
    remoteReports,
    federationBlocks,
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
  const { db, user, profile } = await identity();
  const obj = z.object({ type: z.string() }).passthrough().parse(input);
  switch (obj.type) {
    case 'complete-onboarding':
      checked(
        await db
          .from('profiles')
          .update({ onboarded_at: new Date().toISOString() })
          .eq('id', user.id),
      );
      break;
    case 'create-circle': {
      const value = circleInput.parse(obj);
      checked(
        await db.rpc('create_circle', {
          circle_name: value.name,
          circle_description: value.description,
          circle_image: value.image_path,
        }),
      );
      break;
    }
    case 'invite-circle': {
      const value = circleInviteInput.parse(obj);
      checked(
        await db.rpc('invite_circle_member', {
          target_circle: value.circle_id,
          other: value.user_id,
        }),
      );
      break;
    }
    case 'respond-circle': {
      const value = circleResponseInput.parse(obj);
      checked(
        await db.rpc('respond_circle_invite', {
          target_circle: value.circle_id,
          accept_invite: value.accept,
        }),
      );
      break;
    }
    case 'update-circle': {
      const value = circleUpdateInput.parse(obj);
      checked(
        await db.rpc('update_circle', {
          target_circle: value.circle_id,
          circle_name: value.name,
          circle_description: value.description,
          circle_image: value.image_path,
        }),
      );
      break;
    }
    case 'set-circle-role': {
      const value = circleRoleInput.parse(obj);
      checked(
        await db.rpc('set_circle_member_role', {
          target_circle: value.circle_id,
          other: value.user_id,
          new_role: value.role,
        }),
      );
      break;
    }
    case 'remove-circle-member': {
      const value = circleMemberInput.parse(obj);
      checked(
        await db.rpc('remove_circle_member', {
          target_circle: value.circle_id,
          other: value.user_id,
        }),
      );
      break;
    }
    case 'leave-circle': {
      const value = circleIdInput.parse(obj);
      checked(await db.rpc('leave_circle', { target_circle: value.circle_id }));
      break;
    }
    case 'archive-circle': {
      const value = circleIdInput.parse(obj);
      checked(await db.rpc('archive_circle', { target_circle: value.circle_id }));
      break;
    }
    case 'delete-circle': {
      const value = circleIdInput.parse(obj);
      checked(await db.rpc('delete_circle', { target_circle: value.circle_id }));
      break;
    }
    case 'chat-settings': {
      const v = chatSettingsInput.parse(obj);
      checked(
        await db.rpc('set_chat_settings', {
          other: v.user_id,
          temporary: v.temporary,
          duration: v.duration,
        }),
      );
      break;
    }
    case 'chat-receipt': {
      const v = receiptInput.parse(obj);
      checked(
        await db.rpc('chat_receipt', {
          message_id: v.message_id,
          expected_revision: v.revision,
          was_read: v.read,
        }),
      );
      break;
    }
    case 'edit-message': {
      const v = editMessageInput.parse(obj);
      checked(
        await db.rpc('edit_chat_message', {
          message_id: v.message_id,
          packet: v.encrypted,
          media: v.media_path,
        }),
      );
      break;
    }
    case 'delete-message': {
      const v = deleteMessageInput.parse(obj);
      checked(
        await db.rpc('delete_chat_message', { message_id: v.message_id, for_everyone: v.everyone }),
      );
      break;
    }
    case 'propose-note': {
      const value = noteInput.parse(obj);
      checked(await db.from('community_notes').insert({ ...value, author_id: user.id }));
      break;
    }
    case 'review-note': {
      const value = noteReviewInput.parse(obj);
      checked(
        await db.rpc('review_community_note', {
          note_id: value.note_id,
          approve: value.approve,
          reason: value.reason,
        }),
      );
      break;
    }
    case 'post': {
      const v = postInput.parse(obj);
      if (v.circle_ids?.length && v.poll)
        checked(
          await db.rpc('create_circle_poll', {
            target_circles: v.circle_ids,
            question: v.body,
            warning: v.content_warning,
            options: v.poll.options,
            duration_seconds: v.poll.duration,
          }),
        );
      else if (v.circle_ids?.length)
        checked(
          await db.rpc('create_circle_post', {
            target_circles: v.circle_ids,
            post_body: v.body,
            warning: v.content_warning,
            media: v.media_path,
            alternative: v.alt,
          }),
        );
      else if (v.poll)
        checked(
          await db.rpc('create_poll', {
            question: v.body,
            warning: v.content_warning,
            options: v.poll.options,
            duration_seconds: v.poll.duration,
          }),
        );
      else {
        const post = checked(
          await db
            .from('posts')
            .insert({
              author_id: user.id,
              body: v.body,
              content_warning: v.content_warning,
              kind: v.kind,
              media_path: v.media_path,
              alt: v.alt,
            })
            .select('activity_key')
            .single(),
        );
        const federated = await publicPostBy(post.activity_key);
        if (federated && process.env.APP_ORIGIN)
          await enqueueFederatedActivity(
            user.id,
            createDocument(process.env.APP_ORIGIN, federated),
          );
      }
      break;
    }
    case 'vote-poll': {
      checked(
        await db.rpc('vote_poll', {
          target_poll: userId.parse(obj.poll_id),
          target_option: userId.parse(obj.option_id),
        }),
      );
      break;
    }
    case 'bookmark': {
      const value = bookmarkInput.parse(obj);
      checked(
        value.saved
          ? await db
              .from('bookmarks')
              .upsert(
                { user_id: user.id, post_id: value.post_id },
                { onConflict: 'user_id,post_id', ignoreDuplicates: true },
              )
          : await db.from('bookmarks').delete().eq('user_id', user.id).eq('post_id', value.post_id),
      );
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
      const v = encryptedMessageInput.parse(obj);
      checked(
        await db.from('messages').upsert(
          {
            sender_id: user.id,
            recipient_id: v.user_id,
            id: v.id,
            body: '',
            encrypted: v.encrypted,
            media_path: v.media_path ?? null,
            ttl_seconds: v.ttl,
          },
          { onConflict: 'id', ignoreDuplicates: true },
        ),
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
      checked(
        await db
          .from('profiles')
          .update(v.is_private ? { ...v, federation_enabled: false } : v)
          .eq('id', user.id),
      );
      break;
    }
    case 'federation': {
      const { enabled } = z.object({ enabled: z.boolean() }).parse(obj);
      if (enabled && profile.is_private)
        throw new ApiError('Rendi pubblico il profilo prima di attivare la federazione.');
      if (enabled && !(await ensureFederationActorKey(user.id)))
        throw new ApiError('Non è stato possibile preparare la chiave della federazione.', 503);
      checked(await db.from('profiles').update({ federation_enabled: enabled }).eq('id', user.id));
      break;
    }
    case 'read-notifications':
      checked(await db.from('notifications').update({ read: true }).eq('user_id', user.id));
      break;
    case 'delete-post': {
      const id = userId.parse(obj.post_id);
      const post = checked(
        await db
          .from('posts')
          .select('id,activity_key')
          .eq('id', id)
          .eq('author_id', user.id)
          .single(),
      );
      if (!post) throw new ApiError('Post non disponibile.', 404);
      const federated = await publicPostBy(post.activity_key);
      // Delete row first to revoke visibility immediately; maintenance removes the orphaned blob.
      checked(await db.from('posts').delete().eq('id', id).eq('author_id', user.id));
      if (federated && process.env.APP_ORIGIN)
        await enqueueFederatedActivity(
          user.id,
          deleteDocument(process.env.APP_ORIGIN, federated, crypto.randomUUID()),
        );
      break;
    }
    case 'report': {
      const v = z
        .object({ post_id: userId, reason: z.string().trim().min(5).max(1000) })
        .parse(obj);
      checked(await db.from('reports').insert({ ...v, reporter_id: user.id }));
      break;
    }
    case 'report-remote': {
      const v = z
        .object({
          object_id: z.string().url().max(2000),
          reason: z.string().trim().min(5).max(1000),
        })
        .parse(obj);
      checked(
        await db.rpc('report_federated_object', {
          target_object: v.object_id,
          report_reason: v.reason,
        }),
      );
      break;
    }
    case 'moderate': {
      const v = z.object({ report_id: userId, remove: z.boolean() }).parse(obj);
      checked(await db.rpc('moderate_report', { report_id: v.report_id, remove_post: v.remove }));
      break;
    }
    case 'moderate-remote': {
      const v = z.object({ report_id: userId, hide: z.boolean() }).parse(obj);
      checked(
        await db.rpc('moderate_federated_report', {
          target_report: v.report_id,
          hide_object: v.hide,
        }),
      );
      break;
    }
    case 'moderate-instance': {
      const v = z
        .object({
          hostname: z.string().trim().min(1).max(253),
          blocked: z.boolean(),
          reason: z.string().trim().min(10).max(500),
        })
        .parse(obj);
      checked(
        await db.rpc('set_federation_instance_blocked', {
          candidate: v.hostname,
          next_blocked: v.blocked,
          decision_reason: v.reason,
        }),
      );
      break;
    }
    case 'moderate-account': {
      const v = z
        .object({
          user_id: userId,
          disabled: z.boolean(),
          reason: z.string().trim().min(10).max(500),
        })
        .parse(obj);
      checked(
        await db.rpc('set_account_disabled', {
          target: v.user_id,
          next_disabled: v.disabled,
          decision_reason: v.reason,
        }),
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
    ['bookmarks', 'user_id'],
    ['media_assets', 'owner_id'],
    ['notifications', 'user_id'],
    ['reports', 'reporter_id'],
    ['blocks', 'blocker_id'],
    ['follows', ''],
    ['messages', ''],
    ['chat_devices', 'user_id'],
    ['community_notes', 'author_id'],
    ['circles', ''],
    ['circle_members', ''],
    ['circle_posts', ''],
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
                    : table === 'circle_members' || table === 'circle_posts'
                      ? 'circle_id'
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
