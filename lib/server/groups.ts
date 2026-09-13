import 'server-only';
import type { ChatGroupMessagesState, ChatGroupsState } from '@/lib/core/types';
import {
  chatGroupActionInput,
  encryptedGroupMessageInput,
  groupMessageReceiptInput,
  userId,
} from '@/lib/core/rules';
import { ApiError, checked, identity } from './supabase';

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

export async function chatGroupDevices(groupIdInput: unknown) {
  const groupId = userId.parse(groupIdInput);
  const { db } = await identity();
  const members = checked(
    await db.from('chat_group_members').select('user_id').eq('group_id', groupId),
  ) as { user_id: string }[];
  if (!members.length) return [];
  return checked(
    await db
      .from('chat_devices')
      .select('id,user_id,public_key,label')
      .in(
        'user_id',
        members.map((member) => member.user_id),
      ),
  );
}

export async function chatGroupMessages(groupIdInput: unknown): Promise<ChatGroupMessagesState> {
  const groupId = userId.parse(groupIdInput);
  const { db } = await identity();
  const messages = checked(
    await db
      .from('chat_group_messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(50),
  ) as ChatGroupMessagesState['messages'];
  if (!messages.length) return { messages: [], receipts: [] };
  const receipts = checked(
    await db
      .from('chat_group_message_receipts')
      .select('*')
      .in(
        'message_id',
        messages.map((message) => message.id),
      )
      .limit(950),
  ) as ChatGroupMessagesState['receipts'];
  return { messages: messages.reverse(), receipts };
}

export async function sendChatGroupMessage(input: unknown) {
  const value = encryptedGroupMessageInput.parse(input);
  const { db, user } = await identity();
  const context = value.encrypted.context;
  if (context.sender_id !== user.id) throw new ApiError('Accesso negato.', 403);
  return checked(
    await db
      .from('chat_group_messages')
      .insert({
        id: value.id,
        group_id: value.group_id,
        sender_id: user.id,
        encrypted: value.encrypted,
      })
      .select('*')
      .single(),
  );
}

export async function acknowledgeChatGroupMessage(input: unknown) {
  const parsed = groupMessageReceiptInput.parse(input);
  const { db } = await identity();
  checked(
    await db.rpc('acknowledge_group_message', {
      target_message: parsed.messageId,
      mark_read: parsed.read,
    }),
  );
  return { ok: true };
}
