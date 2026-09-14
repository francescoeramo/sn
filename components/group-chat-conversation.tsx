'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCheck, KeyRound, Send } from 'lucide-react';
import type { ChatGroupMember, ChatGroupMessagesState, Profile } from '@/lib/core/types';
import {
  fingerprint,
  publicDevice,
  sealGroup,
  unsealGroup,
  type Device,
  type LocalDevice,
} from '@/lib/crypto/chat';
import { deviceFor, rememberDevices } from '@/lib/client/chat-store';
import { relativeTime } from '@/lib/core/rules';
import { Avatar, Empty } from './primitives';

type OpenGroupMessage = ChatGroupMessagesState['messages'][number] & {
  body: string;
  warning?: string;
};

async function groupRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    `/api/chat/groups/${path}`,
    body === undefined
      ? { cache: 'no-store' }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? 'Chat di gruppo non disponibile.');
  return value as T;
}

async function openMessages(
  device: LocalDevice,
  state: ChatGroupMessagesState,
  trustedPrints: string[],
) {
  const opened: OpenGroupMessage[] = [];
  for (const row of state.messages) {
    try {
      const context = row.encrypted.context;
      if (
        context.id !== row.id ||
        context.group_id !== row.group_id ||
        context.sender_id !== row.sender_id
      )
        throw new Error('Identità del messaggio non valida.');
      if (!trustedPrints.includes(await fingerprint(row.encrypted.sender)))
        throw new Error('La chiave del mittente non è autorizzata. Controlla i codici.');
      const clear = await unsealGroup(device, context, row.encrypted);
      opened.push({ ...row, body: clear.body });
    } catch (error) {
      opened.push({
        ...row,
        body: '',
        warning: error instanceof Error ? error.message : 'Messaggio non leggibile.',
      });
    }
  }
  return opened;
}

export function GroupChatConversation({
  groupId,
  demo,
  me,
  members,
  profiles,
  onNotice,
}: {
  groupId: string;
  demo: boolean;
  me: Profile;
  members: ChatGroupMember[];
  profiles: Profile[];
  onNotice: (message: string) => void;
}) {
  const [device, setDevice] = useState<LocalDevice | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [prints, setPrints] = useState<string[]>([]);
  const [trusted, setTrusted] = useState(true);
  const [messages, setMessages] = useState<OpenGroupMessage[]>([]);
  const [receipts, setReceipts] = useState<ChatGroupMessagesState['receipts']>([]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sentReceipts = useRef(new Set<string>());
  const demoMessages = useRef<ChatGroupMessagesState>({ messages: [], receipts: [] });
  const log = useRef<HTMLDivElement>(null);
  const recipientIds = useMemo(
    () => [...new Set(members.map((member) => member.user_id))].sort(),
    [members],
  );

  const prepare = useCallback(async () => {
    const ownDevice = await deviceFor(me.id, demo);
    let groupDevices: Device[];
    if (demo) {
      groupDevices = await Promise.all(
        recipientIds.map(async (userId) => publicDevice(await deviceFor(userId, true))),
      );
    } else {
      await fetch('/api/chat/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(publicDevice(ownDevice)),
      }).then(async (response) => {
        if (!response.ok) {
          const value = await response.json();
          throw new Error(value.error ?? 'Registrazione del browser non riuscita.');
        }
      });
      groupDevices = await groupRequest<Device[]>(`devices?group=${encodeURIComponent(groupId)}`);
    }
    const nextPrints = await Promise.all(groupDevices.map(fingerprint));
    let nextTrusted = true;
    try {
      await rememberDevices(me.id, `group:${groupId}`, nextPrints, demo);
    } catch {
      nextTrusted = false;
    }
    setDevice(ownDevice);
    setDevices(groupDevices);
    setPrints(nextPrints);
    setTrusted(nextTrusted);
  }, [demo, groupId, me.id, recipientIds]);

  const refresh = useCallback(async () => {
    if (!device || document.hidden) return;
    const next = demo
      ? demoMessages.current
      : await groupRequest<ChatGroupMessagesState>(`messages?group=${encodeURIComponent(groupId)}`);
    const opened = await openMessages(device, next, prints);
    setMessages(opened);
    setReceipts(next.receipts);
    for (const message of opened) {
      if (message.sender_id === me.id || message.warning || sentReceipts.current.has(message.id))
        continue;
      sentReceipts.current.add(message.id);
      try {
        if (!demo) await groupRequest('receipt', { messageId: message.id, read: true });
      } catch {
        sentReceipts.current.delete(message.id);
      }
    }
  }, [demo, device, groupId, me.id, prints]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void prepare().catch((cause) => {
        if (!cancelled)
          setError(
            cause instanceof Error ? cause.message : 'Preparazione della chat non riuscita.',
          );
      });
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [prepare]);

  useEffect(() => {
    if (!device) return;
    const initial = window.setTimeout(
      () =>
        void refresh().catch((cause) =>
          setError(cause instanceof Error ? cause.message : 'Aggiornamento non riuscito.'),
        ),
    );
    const timer = setInterval(
      () =>
        void refresh().catch((cause) =>
          setError(cause instanceof Error ? cause.message : 'Aggiornamento non riuscito.'),
        ),
      2500,
    );
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [device, refresh]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages]);

  const missingMembers = recipientIds.filter(
    (userId) => !devices.some((entry) => entry.user_id === userId),
  );
  const isAlone = recipientIds.length < 2;

  const send = async () => {
    const text = body.trim();
    if (!text || !device || busy || !trusted || missingMembers.length || isAlone) return;
    setBusy(true);
    setError('');
    try {
      const id = crypto.randomUUID();
      const encrypted = await sealGroup(
        device,
        devices,
        {
          id,
          sender_id: me.id,
          group_id: groupId,
          recipient_ids: recipientIds,
          expires_at: null,
        },
        text,
      );
      if (demo)
        demoMessages.current = {
          ...demoMessages.current,
          messages: [
            ...demoMessages.current.messages,
            {
              id,
              group_id: groupId,
              sender_id: me.id,
              encrypted,
              created_at: new Date().toISOString(),
            },
          ],
        };
      else await groupRequest('message', { id, group_id: groupId, encrypted });
      setBody('');
      await refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Invio non riuscito.';
      setError(message);
      onNotice(`${message} Il testo è ancora qui.`);
    } finally {
      setBusy(false);
    }
  };

  if (!device && !error) return <p className="fine group-chat-loading">Apro la chat cifrata…</p>;

  return (
    <section className="group-conversation" aria-label="Messaggi del gruppo">
      {messages.length ? (
        <div className="group-message-log" role="log" aria-live="polite" ref={log}>
          {messages.map((message) => {
            const author = profiles.find((profile) => profile.id === message.sender_id);
            const own = message.sender_id === me.id;
            const messageReceipts = receipts.filter((receipt) => receipt.message_id === message.id);
            const readCount = messageReceipts.filter(
              (receipt) => receipt.user_id !== me.id && receipt.read_at,
            ).length;
            const deliveredCount = messageReceipts.filter(
              (receipt) => receipt.user_id !== me.id && receipt.delivered_at,
            ).length;
            const stateLabel = readCount
              ? `Letto da ${readCount}`
              : deliveredCount
                ? `Consegnato a ${deliveredCount}`
                : 'Inviato';
            return (
              <article className={`group-message ${own ? 'own' : ''}`} key={message.id}>
                {!own && <Avatar person={author} size="small" />}
                <div>
                  {!own && <strong>{author?.display_name ?? 'Membro del gruppo'}</strong>}
                  {message.warning ? (
                    <p className="group-message-warning" role="alert">
                      {message.warning}
                    </p>
                  ) : (
                    <p>{message.body}</p>
                  )}
                  <footer>
                    <time dateTime={message.created_at}>{relativeTime(message.created_at)}</time>
                    {own && (
                      <span aria-label={stateLabel} title={stateLabel}>
                        {deliveredCount ? <CheckCheck size={15} /> : <Check size={15} />}
                        {readCount > 0 && <span>{readCount}</span>}
                      </span>
                    )}
                  </footer>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty title="Nessun messaggio nel gruppo." kind="messages">
          Scrivi qualcosa quando hai davvero qualcosa da condividere.
        </Empty>
      )}

      {missingMembers.length > 0 && (
        <p className="group-key-notice" role="status">
          <KeyRound size={16} /> Tutti devono aprire SN da un browser prima del primo messaggio.
        </p>
      )}
      {isAlone && (
        <p className="group-key-notice" role="status">
          Invita almeno una persona prima di scrivere nel gruppo.
        </p>
      )}
      {!trusted && (
        <div className="group-key-notice" role="alert">
          <KeyRound size={16} />
          <p>I browser del gruppo sono cambiati. Confronta i codici prima di continuare.</p>
          <button
            className="secondary"
            onClick={async () => {
              await rememberDevices(me.id, `group:${groupId}`, prints, demo, true);
              setTrusted(true);
            }}
          >
            Autorizza i nuovi browser
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <form
        className="group-message-form"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label className="sr-only" htmlFor={`group-message-${groupId}`}>
          Scrivi al gruppo
        </label>
        <input
          id={`group-message-${groupId}`}
          value={body}
          maxLength={2000}
          placeholder="Scrivi al gruppo…"
          disabled={!device || busy || !trusted || missingMembers.length > 0 || isAlone}
          onChange={(event) => setBody(event.target.value)}
        />
        <button
          className="icon-button"
          aria-label="Invia al gruppo"
          disabled={
            !body.trim() || !device || busy || !trusted || missingMembers.length > 0 || isAlone
          }
        >
          <Send size={18} />
        </button>
      </form>
      <details className="group-security">
        <summary>Codici di sicurezza del gruppo</summary>
        <p>Confrontali di persona o attraverso un altro canale.</p>
        {devices.map((entry, index) => {
          const person = profiles.find((profile) => profile.id === entry.user_id);
          return (
            <p key={entry.id}>
              <strong>{entry.user_id === me.id ? 'Tu' : (person?.display_name ?? 'Membro')}</strong>
              <code>{prints[index]}</code>
            </p>
          );
        })}
      </details>
    </section>
  );
}
