'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Clock3, Paperclip, Send, X } from 'lucide-react';
import type { Action, Message, Profile } from '@/lib/core/types';
import { EPHEMERAL_OPTIONS, isActive, relativeTime } from '@/lib/core/rules';
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
  const visible = messages
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
            ? demo
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
              {m.body && <p>{m.body}</p>}
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
      {allowed ? (
        <form
          className="chat-compose"
          onSubmit={async (e) => {
            e.preventDefault();
            if (sending.current || (!body.trim() && !file)) return;
            sending.current = true;
            setBusy(true);
            setStatus('');
            try {
              let path: string | null = null,
                mime: string | null = null;
              if (file) {
                const prepared = await prepareChatMedia(file, setStatus);
                mime = prepared.type;
                if (demo) path = await asDataURL(prepared);
                else {
                  setStatus('Carico l’allegato…');
                  const form = new FormData();
                  form.append('file', prepared);
                  form.append('scope', 'chat');
                  const response = await fetch('/api/upload', { method: 'POST', body: form });
                  const result = await response.json();
                  if (!response.ok) throw new Error(result.error);
                  path = result.path;
                }
              }
              const ok = await onSend({
                type: 'message',
                user_id: person.id,
                body,
                media_path: path,
                media_type: mime,
                ttl,
              });
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
              disabled={busy || (!body.trim() && !file)}
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
