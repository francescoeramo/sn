'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Clock3, Paperclip, Send, X } from 'lucide-react';
import type { Action, Message, Profile } from '@/lib/core/types';
import { EPHEMERAL_OPTIONS, isActive, relativeTime } from '@/lib/core/rules';
import { seal } from '@/lib/crypto/chat';
import { prepareSession, readConversation, type DecryptedMessage } from '@/lib/client/chat-session';
import { rememberDevices, keepMessages } from '@/lib/client/chat-store';
import { asDataURL, prepareChatMedia } from '@/lib/client/media';
import { Avatar, Empty } from './primitives';

export function ChatConversation({
  me,
  person,
  messages,
  demo,
  allowed,
  onSend,
}: {
  me: Profile;
  person: Profile;
  messages: Message[];
  demo: boolean;
  allowed: boolean;
  onSend: (action: Action) => Promise<boolean>;
}) {
  const [session, setSession] = useState<Awaited<ReturnType<typeof prepareSession>> | null>(null);
  const [decoded, setDecoded] = useState<DecryptedMessage[]>([]);
  const [keyError, setKeyError] = useState('');
  const [retention, setRetention] = useState<'synced' | 'device'>('synced');
  const [body, setBody] = useState('');
  const [ttl, setTtl] = useState(86400);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const sending = useRef(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  useEffect(() => {
    let cancelled = false;
    prepareSession(me.id, person.id, demo)
      .then((value) => {
        if (!cancelled) setSession(value);
      })
      .catch((error) => {
        if (!cancelled) setKeyError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [me.id, person.id, demo]);
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    readConversation(session.device, person.id, messages, demo)
      .then((value) => {
        if (!cancelled) setDecoded(value);
      })
      .catch((error) => {
        if (!cancelled) setKeyError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [session, person.id, messages, demo]);
  const visible = decoded
    .filter((m) => isActive(m, now))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const lastId = visible.at(-1)?.id;
  useEffect(() => {
    const element = log.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [lastId]);
  function removeFile() {
    setFile(null);
    setPreview('');
    if (input.current) input.current.value = '';
  }
  return (
    <>
      <div className="chat-heading">
        <Avatar person={person} />
        <div>
          <strong>{person.display_name}</strong>
          <small>@{person.username}</small>
        </div>
      </div>
      <div className="chat-log" role="log" aria-label="Messaggi della conversazione" ref={log}>
        {!visible.length && (
          <Empty title="Il primo messaggio è tuo.">
            Scrivi qualcosa o condividi un allegato. I nuovi messaggi scadono dopo il tempo scelto.
          </Empty>
        )}
        {visible.map((m) => {
          const src = m.media_path
            ? demo || !!m.encrypted
              ? m.media_path
              : `/api/media?path=${encodeURIComponent(m.media_path)}`
            : '';
          return (
            <div className={`chat-bubble ${m.sender_id === me.id ? 'own' : ''}`} key={m.id}>
              {src &&
                (m.media_type?.startsWith('audio/') ? (
                  <audio controls preload="none" src={src} aria-label="Nota audio" />
                ) : m.media_type?.startsWith('video/') ? (
                  <video
                    controls
                    playsInline
                    preload="metadata"
                    src={src}
                    aria-label="Video nella chat"
                  >
                    <track kind="captions" />
                  </video>
                ) : (
                  <Image src={src} alt="Immagine nella chat" width={480} height={360} unoptimized />
                ))}
              {m.warning ? <p role="status">{m.warning}</p> : m.body && <p>{m.body}</p>}
              {!m.encrypted && <small className="muted">Storico non cifrato</small>}
              <div className="chat-meta">
                <time dateTime={m.created_at}>{relativeTime(m.created_at)}</time>
                {m.expires_at && (
                  <span title={new Date(m.expires_at).toLocaleString('it-IT')}>
                    <Clock3 size={11} /> Scade tra{' '}
                    {Math.max(1, Math.ceil((Date.parse(m.expires_at) - now) / 60000)) < 60
                      ? `${Math.max(1, Math.ceil((Date.parse(m.expires_at) - now) / 60000))} min`
                      : `${Math.ceil((Date.parse(m.expires_at) - now) / 3600000)} h`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {keyError && <p role="alert">{keyError}</p>}
      {session && (
        <details className="chat-security">
          <summary>Browser e codici di sicurezza</summary>
          <p className="fine">
            Confrontate questi codici di persona o attraverso un altro canale. Ogni nuovo browser
            riceve i messaggi successivi alla sua autorizzazione.
          </p>
          {session.devices.map((d, i) => (
            <p key={d.id} className="fine">
              <strong>
                {d.user_id === me.id ? 'Tu' : person.display_name} · {d.id.slice(0, 8)}
              </strong>
              <code>{session.prints[i]}</code>
            </p>
          ))}
          {!session.trusted && (
            <button
              type="button"
              className="secondary"
              onClick={async () => {
                await rememberDevices(me.id, person.id, session.prints, demo, true);
                setSession({ ...session, trusted: true });
              }}
            >
              Ho confrontato i codici: autorizza questi browser
            </button>
          )}
        </details>
      )}
      {session && !session.trusted && (
        <p role="alert">
          I browser autorizzati sono cambiati. Controlla i codici prima di inviare.
        </p>
      )}
      {allowed ? (
        <form
          className="chat-compose"
          onSubmit={async (e) => {
            e.preventDefault();
            if (sending.current || !session?.trusted || (!body.trim() && !file)) return;
            sending.current = true;
            setBusy(true);
            setStatus('');
            try {
              // Refresh devices immediately before sealing to detect additions and revocations.
              const current = await prepareSession(me.id, person.id, demo);
              if (!current.trusted) {
                setSession(current);
                throw new Error('Controlla i nuovi codici di sicurezza prima di inviare.');
              }
              const prepared = file ? await prepareChatMedia(file, setStatus) : null;
              if (prepared && prepared.size > 3 * 1024 * 1024 - 16)
                throw new Error(
                  'L’allegato deve lasciare 16 byte per la cifratura: scegli un file leggermente più piccolo.',
                );
              const context = {
                id: crypto.randomUUID(),
                sender_id: me.id,
                recipient_id: person.id,
                expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
                retention,
              };
              setStatus('Cifro il messaggio…');
              const encrypted = await seal(
                current.device,
                current.devices,
                context,
                body,
                prepared,
              );
              let path: string | null = null;
              if (encrypted.attachment) {
                if (demo) path = await asDataURL(encrypted.attachment);
                else {
                  const form = new FormData();
                  form.append('file', encrypted.attachment);
                  form.append('scope', 'encrypted-chat');
                  const response = await fetch('/api/upload', { method: 'POST', body: form });
                  const value = await response.json();
                  if (!response.ok) throw new Error(value.error);
                  path = value.path;
                }
              }
              const ok = await onSend({
                type: 'message',
                id: context.id,
                user_id: person.id,
                body: '',
                encrypted: encrypted.sealed,
                media_path: path,
                ttl,
              });
              if (ok && !demo && retention === 'device')
                await keepMessages(me.id, [
                  {
                    id: context.id,
                    sender_id: me.id,
                    recipient_id: person.id,
                    body: '',
                    encrypted: encrypted.sealed,
                    media_path: path,
                    media_type: encrypted.attachment?.type ?? null,
                    local_media: encrypted.attachment
                      ? await asDataURL(encrypted.attachment)
                      : null,
                    created_at: new Date().toISOString(),
                    expires_at: context.expires_at,
                  },
                ]);
              if (ok) {
                setBody('');
                removeFile();
                setStatus('Messaggio inviato.');
              } else setStatus('Invio non riuscito. Il testo e l’allegato sono ancora qui.');
            } catch (error) {
              setStatus(error instanceof Error ? error.message : 'Invio non riuscito.');
            } finally {
              setBusy(false);
              sending.current = false;
            }
          }}
        >
          <label className="chat-retention">
            Conservazione
            <select
              aria-label="Conservazione messaggi"
              value={retention}
              disabled={busy}
              onChange={(e) => setRetention(e.target.value as 'synced' | 'device')}
            >
              <option value="synced">Sincronizzati sui browser autorizzati</option>
              <option value="device">Solo sul dispositivo dopo la consegna</option>
            </select>
          </label>
          {!session && !keyError && <p role="status">Preparo le chiavi di questo browser…</p>}
          {session && !session.devices.some((d) => d.user_id === person.id) && (
            <p role="status">
              {person.display_name} deve aprire Messaggi per attivare il suo browser.
            </p>
          )}
          <div className="chat-options">
            <label>
              <Clock3 size={15} /> Elimina dopo{' '}
              <select
                aria-label="Scadenza dei messaggi"
                value={ttl}
                disabled={busy}
                onChange={(e) => setTtl(Number(e.target.value))}
              >
                {EPHEMERAL_OPTIONS.map((option) => (
                  <option key={option.seconds} value={option.seconds}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="chat-attach">
              <Paperclip size={17} />
              <span>Allega</span>
              <input
                ref={input}
                type="file"
                aria-label="Allega alla chat"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,audio/webm,audio/ogg,audio/mp4"
                disabled={busy}
                onChange={(e) => {
                  const selected = e.target.files?.[0] ?? null;
                  setFile(selected);
                  setPreview(selected ? URL.createObjectURL(selected) : '');
                  setStatus('');
                }}
              />
            </label>
          </div>
          {file && (
            <div className="chat-attachment">
              {preview && file.type.startsWith('image/') && (
                <Image src={preview} alt="Anteprima allegato" width={56} height={56} unoptimized />
              )}
              <span>
                {file.name}
                <small>
                  {file.type.startsWith('audio/')
                    ? 'Audio · massimo 60 secondi'
                    : file.type.startsWith('video/')
                      ? 'Video · massimo 20 secondi'
                      : 'L’immagine verrà compressa'}
                </small>
              </span>
              <button
                type="button"
                className="icon-button"
                aria-label="Rimuovi allegato"
                onClick={removeFile}
                disabled={busy}
              >
                <X size={18} />
              </button>
            </div>
          )}
          <div className="chat-form">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Scrivi un messaggio…"
              aria-label="Scrivi un messaggio"
              maxLength={2000}
              disabled={busy}
            />
            <button
              className="primary"
              disabled={
                busy ||
                !session?.trusted ||
                !session.devices.some((d) => d.user_id === person.id) ||
                (!body.trim() && !file)
              }
              aria-label="Invia messaggio"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="fine muted" role="status">
            {status || 'Foto, video fino a 20 s e audio fino a 60 s. Massimo 3 MB per allegato.'}
          </p>
        </form>
      ) : (
        <p className="privacy-note">
          Potete scrivervi quando vi seguite a vicenda. La conversazione precedente resta
          consultabile fino alla scadenza.
        </p>
      )}
    </>
  );
}
