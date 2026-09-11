import type { Action, ChatSync } from '@/lib/core/types';
import { loadDemo, mutateDemo } from './demo';
import { chatRequest } from './chat-session';
export async function syncConversation(
  me: string,
  other: string,
  demo: boolean,
): Promise<ChatSync> {
  if (!demo) return chatRequest('sync?user=' + other);
  const s = await loadDemo(),
    [a, b] = [me, other].sort();
  return {
    settings: s.chatSettings?.find((c) => c.member_a === a && c.member_b === b) ?? null,
    messages: s.messages.filter(
      (m) =>
        (m.sender_id === me && m.recipient_id === other) ||
        (m.recipient_id === me && m.sender_id === other),
    ),
    states:
      s.messageStates?.filter(
        (m) => [me, other].includes(m.sender_id) && [me, other].includes(m.recipient_id),
      ) ?? [],
    hidden: s.hiddenMessages?.filter((h) => h.user_id === me) ?? [],
  };
}
export async function chatAction(action: Action, demo: boolean) {
  if (demo) {
    await mutateDemo(action);
    return;
  }
  const response = await fetch('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? 'Operazione non riuscita.');
}
