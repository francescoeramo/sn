'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
  Clock3,
  Paperclip,
  Send,
  X,
  Settings,
  Check,
  CheckCheck,
  Pencil,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import type { Action, Message, Profile, ChatSync } from '@/lib/core/types';
import { EPHEMERAL_OPTIONS, isActive, relativeTime } from '@/lib/core/rules';
import { seal } from '@/lib/crypto/chat';
import { prepareSession, readConversation, type DecryptedMessage } from '@/lib/client/chat-session';
import { rememberDevices, keepMessages } from '@/lib/client/chat-store';
import { asDataURL, prepareChatMedia } from '@/lib/client/media';
import { syncConversation, chatAction } from '@/lib/client/chat-lifecycle';
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
  const [sync, setSync] = useState<ChatSync | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editing, setEditing] = useState<DecryptedMessage | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const pendingPacket = useRef<{ action: Action; row: Message } | null>(null);
  const receipts = useRef(new Set<string>());
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
    let cancelled = false,
      running = false;
    const refresh = async () => {
      if (running || sending.current || document.hidden) return;
      running = true;
      try {
        const data = await syncConversation(me.id, person.id, demo);
        const value = await readConversation(
          session.device,
          person.id,
          data.messages,
          demo,
          data.states,
          data.hidden,
        );
        if (!cancelled) {
          setSync(data);
          setTtl(data.settings?.duration ?? 86400);
          setDecoded(value);
          setKeyError('');
        }
        for (const m of value) {
          const state = data.states.find((v) => v.id === m.id);
          const key = m.id + ':' + (m.encrypted?.context.revision ?? 0) + ':delivered';
          if (
            m.recipient_id === me.id &&
            !m.warning &&
            !state?.delivered_at &&
            !receipts.current.has(key)
          ) {
            receipts.current.add(key);
            try {
              await chatAction(
                {
                  type: 'chat-receipt',
                  message_id: m.id,
                  revision: m.encrypted?.context.revision ?? 0,
                  read: false,
                },
                demo,
              );
            } catch {
              receipts.current.delete(key);
            }
          }
        }
      } catch (error) {
        if (!cancelled)
          setKeyError(error instanceof Error ? error.message : 'Aggiornamento non riuscito.');
      } finally {
        running = false;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 2500);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [session, person.id, me.id, messages, demo, refreshKey]);
  useEffect(() => {
    const root = log.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (
            !entry.isIntersecting ||
            entry.intersectionRect.height < Math.min(entry.boundingClientRect.height * 0.6, 120) ||
            document.hidden ||
            !document.hasFocus()
          )
            continue;
          const id = (entry.target as HTMLElement).dataset.messageId;
          const m = decoded.find((m) => m.id === id);
          if (!m || m.sender_id === me.id || m.warning) continue;
          const revision = m.encrypted?.context.revision ?? 0,
            key = m.id + ':' + revision + ':read';
          if (receipts.current.has(key) || sync?.states.find((v) => v.id === m.id)?.read_at)
            continue;
          receipts.current.add(key);
          void chatAction({ type: 'chat-receipt', message_id: m.id, revision, read: true }, demo)
            .then(() => setRefreshKey((k) => k + 1))
            .catch(() => receipts.current.delete(key));
        }
      },
      { root, threshold: [0, 0.1, 0.25, 0.6, 1] },
    );
    root.querySelectorAll('[data-message-id]').forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [decoded, me.id, sync, demo]);
  const temporary = sync?.settings?.temporary ?? false;
  async function settingsChange(enabled: boolean, duration: number) {
    setSettingsBusy(true);
    setStatus('');
    try {
      await chatAction(
        { type: 'chat-settings', user_id: person.id, temporary: enabled, duration },
        demo,
      );
      setRefreshKey((k) => k + 1);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Impostazioni non salvate.');
    } finally {
      setSettingsBusy(false);
    }
  }
  async function deleteMessage(id: string, everyone: boolean) {
    try {
      await chatAction({ type: 'delete-message', message_id: id, everyone }, demo);
      setRefreshKey((k) => k + 1);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Eliminazione non riuscita.');
    }
  }
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
        <button
          type="button"
          className="icon-button chat-settings-button"
          aria-label="Impostazioni della chat"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen(!settingsOpen)}
        >
          <Settings size={21} />
        </button>
      </div>
      <div className="chat-mode">
        <button
          type="button"
          className="secondary"
          aria-pressed={temporary}
          disabled={!allowed || !sync || settingsBusy || busy}
          onClick={() => settingsChange(!temporary, ttl)}
        >
          <Clock3 size={17} />
          Chat temporanea {temporary ? 'attiva' : 'disattivata'}
        </button>
        <p>
          {temporary
            ? `I nuovi messaggi si eliminano dopo ${EPHEMERAL_OPTIONS.find((o) => o.seconds === ttl)?.label}.`
            : 'I messaggi restano finché non li elimini.'}
        </p>
      </div>
      {settingsOpen && (
        <section className="chat-settings" aria-label="Impostazioni della chat">
          <label>
            Durata della chat temporanea
            <select
              aria-label="Scadenza dei messaggi"
              value={ttl}
              disabled={settingsBusy || busy || !allowed}
              onChange={(e) => void settingsChange(temporary, Number(e.target.value))}
            >
              {EPHEMERAL_OPTIONS.map((o) => (
                <option key={o.seconds} value={o.seconds}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <p>
            La durata vale per i nuovi messaggi quando «Chat temporanea» è attiva. Entrambi potete
            cambiare queste impostazioni; i messaggi già inviati mantengono la loro scadenza.
          </p>
          <label>
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
          <p>
            Le chiavi sono in questo browser. Se cancelli i dati del browser o perdi il dispositivo,
            lo storico cifrato può diventare irrecuperabile. Un nuovo browser riceve solo i messaggi
            futuri.
          </p>
        </section>
      )}
      <div className="chat-log" role="log" aria-label="Messaggi della conversazione" ref={log}>
        {!visible.length && (
          <Empty title="Il primo messaggio è tuo.">
            Scrivi qualcosa o condividi un allegato. Puoi attivare «Chat temporanea» quando vuoi.
          </Empty>
        )}
        {visible.map((m) => {
          const src = m.media_path
            ? demo || !!m.encrypted
              ? m.media_path
              : `/api/media?path=${encodeURIComponent(m.media_path)}`
            : '';
          const lifecycle = sync?.states.find((v) => v.id === m.id);
          const own = m.sender_id === me.id;
          const canEdit =
            own && !m.warning && !lifecycle?.read_at && now < Date.parse(m.created_at) + 1800000;
          const stateLabel = lifecycle?.read_at
            ? 'Letto'
            : lifecycle?.delivered_at
              ? 'Consegnato, non letto'
              : 'Inviato';
          return (
            <div
              data-message-id={m.id}
              className={`chat-bubble ${m.sender_id === me.id ? 'own' : ''}`}
              key={m.id}
            >
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
                {lifecycle?.edited_at && <span>Modificato</span>}
                {own && (
                  <span
                    className={lifecycle?.read_at ? 'message-state read' : 'message-state'}
                    role="img"
                    aria-label={stateLabel}
                    title={stateLabel}
                  >
                    {lifecycle?.delivered_at ? <CheckCheck size={16} /> : <Check size={16} />}
                  </span>
                )}
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
              <details className="message-options">
                <summary>Opzioni del messaggio</summary>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      removeFile();
                      setEditing(m);
                      setBody(m.body);
                      pendingPacket.current = null;
                      setFailed(false);
                    }}
                  >
                    <Pencil size={14} />
                    Modifica messaggio
                  </button>
                )}
                <button type="button" onClick={() => void deleteMessage(m.id, false)}>
                  <Trash2 size={14} />
                  Elimina per me
                </button>
                {own && (
                  <button type="button" onClick={() => void deleteMessage(m.id, true)}>
                    <Trash2 size={14} />
                    Elimina per tutti
                  </button>
                )}
              </details>
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
            setFailed(false);
            try {
              if (pendingPacket.current && !editing) {
                const pending = pendingPacket.current;
                if (!(await onSend(pending.action)))
                  throw new Error('Invio non riuscito. Puoi riprovare.');
                if (!demo && pending.row.encrypted?.context.retention === 'device')
                  await keepMessages(me.id, [pending.row]);
                pendingPacket.current = null;
                setBody('');
                removeFile();
                setRefreshKey((k) => k + 1);
                return;
              }
              // Refresh devices immediately before sealing to detect additions and revocations.
              const current = await prepareSession(me.id, person.id, demo);
              if (!current.trusted) {
                setSession(current);
                throw new Error('Controlla i nuovi codici di sicurezza prima di inviare.');
              }
              let prepared = file ? await prepareChatMedia(file, setStatus) : null;
              if (editing?.media_path) {
                const blob = await (await fetch(editing.media_path)).blob();
                prepared = new File([blob], 'allegato', { type: editing.media_type ?? blob.type });
              }
              if (prepared && prepared.size > 3 * 1024 * 1024 - 16)
                throw new Error(
                  'L’allegato deve lasciare 16 byte per la cifratura: scegli un file leggermente più piccolo.',
                );
              const context = {
                id: editing?.id ?? crypto.randomUUID(),
                sender_id: me.id,
                recipient_id: person.id,
                expires_at: editing
                  ? editing.expires_at
                  : temporary
                    ? new Date(Date.now() + ttl * 1000).toISOString()
                    : null,
                retention: editing?.encrypted?.context.retention ?? retention,
                revision: editing ? (editing.encrypted?.context.revision ?? 0) + 1 : 0,
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
              const row: Message = {
                id: context.id,
                sender_id: me.id,
                recipient_id: person.id,
                body: '',
                encrypted: encrypted.sealed,
                media_path: path,
                media_type: encrypted.attachment?.type ?? null,
                local_media: encrypted.attachment ? await asDataURL(encrypted.attachment) : null,
                created_at: editing?.created_at ?? new Date().toISOString(),
                expires_at: context.expires_at,
              };
              let ok: boolean;
              if (editing) {
                await chatAction(
                  {
                    type: 'edit-message',
                    message_id: editing.id,
                    encrypted: encrypted.sealed,
                    media_path: path,
                  },
                  demo,
                );
                ok = true;
              } else {
                const action: Action = {
                  type: 'message',
                  id: context.id,
                  user_id: person.id,
                  body: '',
                  encrypted: encrypted.sealed,
                  media_path: path,
                  ttl: temporary ? ttl : 0,
                };
                pendingPacket.current = { action, row };
                ok = await onSend(action);
              }
              if (ok && !demo && context.retention === 'device') await keepMessages(me.id, [row]);
              if (ok) {
                pendingPacket.current = null;
                setEditing(null);
                setRefreshKey((k) => k + 1);
                setBody('');
                removeFile();
                setStatus('Messaggio salvato.');
              } else {
                setFailed(true);
                setStatus('Non inviato. Il testo e l’allegato sono ancora qui: premi Riprova.');
              }
            } catch (error) {
              setFailed(true);
              setStatus(error instanceof Error ? error.message : 'Invio non riuscito.');
            } finally {
              setBusy(false);
              sending.current = false;
            }
          }}
        >
          {!session && !keyError && <p role="status">Preparo le chiavi di questo browser…</p>}
          {session && !session.devices.some((d) => d.user_id === person.id) && (
            <p role="status">
              {person.display_name} deve aprire Messaggi per attivare il suo browser.
            </p>
          )}
          <div className="chat-options">
            <label className="chat-attach">
              <Paperclip size={17} />
              <span>Allega</span>
              <input
                ref={input}
                type="file"
                aria-label="Allega alla chat"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,audio/webm,audio/ogg,audio/mp4"
                disabled={busy || !!editing}
                onChange={(e) => {
                  pendingPacket.current = null;
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
          {editing && (
            <div className="editing-message">
              <span>Modifica del messaggio · entro 30 minuti e prima della lettura</span>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setEditing(null);
                  setBody('');
                  setFailed(false);
                }}
              >
                Annulla modifica
              </button>
            </div>
          )}
          {(busy || failed) && (
            <div className="outbox-state" role="status" aria-label="Non inviato">
              {failed ? <AlertCircle size={17} /> : <Clock3 size={17} />}Non inviato ·{' '}
              {failed ? 'riprova quando sei pronto' : 'invio in corso'}
            </div>
          )}
          <div className="chat-form">
            <input
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                pendingPacket.current = null;
              }}
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
              aria-label={editing ? 'Salva modifica' : failed ? 'Riprova invio' : 'Invia messaggio'}
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
          consultabile; i messaggi temporanei mantengono la loro scadenza.
        </p>
      )}
    </>
  );
}
