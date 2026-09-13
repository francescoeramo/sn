import 'server-only';
import type { ChatGroupsState } from '@/lib/core/types';
import { chatGroupActionInput } from '@/lib/core/rules';
import { checked, identity } from './supabase';

export async function chatGroupsState(): Promise<ChatGroupsState> {
  const { db } = await identity();
  const [groups, members, invites] = await Promise.all([
    db.from('chat_groups').select('*').order('updated_at', { ascending: false }),
    db.from('chat_group_members').select('*').order('joined_at'),
    db.from('chat_group_invites').select('*').gt('expires_at', new Date().toISOString()),
  ]);
  return {
    groups: checked(groups),
    members: checked(members),
    invites: checked(invites),
  } as ChatGroupsState;
}

export async function mutateChatGroup(input: unknown) {
  const value = chatGroupActionInput.parse(input);
  const { db } = await identity();
  if (value.action === 'create')
    checked(await db.rpc('create_chat_group', { group_name: value.name }));
  if (value.action === 'invite')
    checked(
      await db.rpc('invite_chat_group_member', {
        target_group: value.groupId,
        other: value.userId,
      }),
    );
  if (value.action === 'respond')
    checked(
      await db.rpc('respond_chat_group_invite', {
        target_group: value.groupId,
        accept_invite: value.accept,
      }),
    );
  if (value.action === 'rename')
    checked(
      await db.rpc('rename_chat_group', {
        target_group: value.groupId,
        group_name: value.name,
      }),
    );
  if (value.action === 'remove')
    checked(
      await db.rpc('remove_chat_group_member', {
        target_group: value.groupId,
        member: value.userId,
      }),
    );
  if (value.action === 'role')
    checked(
      await db.rpc('set_chat_group_role', {
        target_group: value.groupId,
        member: value.userId,
        next_role: value.role,
      }),
    );
  if (value.action === 'leave')
    checked(await db.rpc('leave_chat_group', { target_group: value.groupId }));
  return chatGroupsState();
}
