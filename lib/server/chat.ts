import 'server-only';
import { identity, checked } from './supabase';
import type { ChatSync, ChatSettings, Message, MessageState } from '@/lib/core/types';
// Explicit pagination avoids silently dropping older receipts at the Data API row limit.
export async function syncChat(other: string): Promise<ChatSync> {
  const { db, user } = await identity();
  const a = [user.id, other].sort();
  const pair = `and(sender_id.eq.${user.id},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${user.id})`;
  const settings = await db
    .from('chat_settings')
    .select('*')
    .eq('member_a', a[0])
    .eq('member_b', a[1])
    .maybeSingle();
  const hidden: { message_id: string }[] = [];
  for (let offset = 0; ; offset += 500) {
    const batch = checked(
      await db
        .from('hidden_messages')
        .select('message_id')
        .eq('user_id', user.id)
        .order('message_id')
        .range(offset, offset + 499),
    );
    hidden.push(...batch);
    if (batch.length < 500) break;
  }
  const states: MessageState[] = [],
    messages: Message[] = [];
  for (let offset = 0; ; offset += 500) {
    const batch = checked(
      await db
        .from('message_states')
        .select(
          'id,sender_id,recipient_id,created_at,expires_at,revision,delivered_at,read_at,edited_at,deleted_at',
        )
        .or(pair)
        .order('id')
        .range(offset, offset + 499),
    ) as MessageState[];
    states.push(...batch);
    if (batch.length < 500) break;
  }
  for (let offset = 0; ; offset += 500) {
    const batch = checked(
      await db
        .from('messages')
        .select('*')
        .or(pair)
        .order('created_at')
        .order('id')
        .range(offset, offset + 499),
    ) as Message[];
    messages.push(...batch);
    if (batch.length < 500) break;
  }
  return {
    settings: checked(settings) as ChatSettings | null,
    hidden,
    states,
    messages,
  };
}
