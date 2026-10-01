'use client';
import { useState } from 'react';
import { ImagePlus, Film, Send, X, Plus, Trash2 } from 'lucide-react';
import type { Action, Circle, Profile, Post } from '@/lib/core/types';
import { prepareMedia, asDataURL } from '@/lib/client/media';
import { Avatar, Modal } from './primitives';
export function Composer({
  me,
  demo,
  initialKind = 'post',
  circles = [],
  onClose,
  onPost,
  getLastError,
}: {
  me: Profile;
  demo: boolean;
  initialKind?: Post['kind'];
  circles?: Circle[];
  onClose: () => void;
  onPost: (action: Action) => Promise<boolean>;
  getLastError: () => string;
}) {
  const [mode, setMode] = useState<Post['kind'] | 'poll'>(initialKind);
  const kind: Post['kind'] = mode === 'poll' ? 'post' : mode;
  const [body, setBody] = useState('');
  const [warning, setWarning] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollDuration, setPollDuration] = useState<number | null>(null);
  const [circleIds, setCircleIds] = useState<string[]>([]);
  const [mediaItems, setMediaItems] = useState<Array<{ file: File; caption: string; alt: string }>>(
    [],
  );
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title="Crea un post"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="composer-person">
        <Avatar person={me} />
        <div>
          <strong data-user-copy>{me.display_name}</strong>
          <small>
            {circleIds.length
              ? circleIds.length === 1
                ? 'Solo nel canale scelto'
                : `Solo in ${circleIds.length} canali`
              : me.is_private
                ? 'Solo i follower approvati'
                : 'Visibile nella community'}
          </small>
        </div>
      </div>
      <div className="segmented">
        {(['post', 'poll', 'story', 'reel'] as const).map((k) => (
          <button
            key={k}
            aria-pressed={mode === k}
            className={mode === k ? 'selected' : ''}
            onClick={() => {
              setMode(k);
              if (k === 'poll') setMediaItems([]);
              if ((k === 'story' || k === 'reel') && mediaItems.length > 1)
                setMediaItems((current) => current.slice(0, 1));
              if (k === 'story' || k === 'reel') setCircleIds([]);
            }}
          >
            {k === 'post'
              ? 'Post'
              : k === 'poll'
                ? 'Sondaggio'
                : k === 'story'
                  ? 'Storia · 24 h'
                  : 'Reel'}
          </button>
        ))}
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setStatus('');
          try {
            const uploaded = [];
            for (const [index, item] of mediaItems.entries()) {
              setStatus(`Preparazione allegato ${index + 1} di ${mediaItems.length}…`);
              const prepared = await prepareMedia(item.file, setStatus);
              let path: string;
              if (demo) path = await asDataURL(prepared);
              else {
                setStatus(`Caricamento allegato ${index + 1} di ${mediaItems.length}…`);
                const form = new FormData();
                form.append('file', prepared);
                const response = await fetch('/api/upload', { method: 'POST', body: form });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                path = result.path;
              }
              uploaded.push({
                media_path: path,
                media_type: prepared.type,
                alt: item.alt,
                caption: item.caption,
              });
            }
            const ok = await onPost({
              type: 'post',
              body,
              kind,
              media_path: uploaded[0]?.media_path ?? null,
              alt: uploaded[0]?.alt ?? '',
              media: uploaded.length ? uploaded : undefined,
              content_warning: warning,
              poll: mode === 'poll' ? { options: pollOptions, duration: pollDuration } : undefined,
              circle_ids: circleIds.length ? circleIds : undefined,
            });
            if (ok) onClose();
            else setStatus(getLastError());
          } catch (error) {
            setStatus(
              error instanceof Error
                ? error.message
                : 'File non preparato. Scegli un altro file e riprova.',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="sr-only" htmlFor="post-body">
          Testo del post
        </label>
        <textarea
          id="post-body"
          className="compose-text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={mode === 'story' ? 128 : 2200}
          placeholder="Descrizione"
          rows={5}
        />
        <small className="counter">
          {body.length} / {mode === 'story' ? 128 : 2200}
        </small>
        {(mode === 'post' || mode === 'poll') && circles.length > 0 && (
          <fieldset className="destination-picker">
            <legend>Destinazione</legend>
            <p>
              {circleIds.length
                ? 'Il post sarà visibile soltanto ai membri dei canali selezionati, fino a cinque.'
                : 'Il post comparirà nella Home con la privacy del profilo.'}
            </p>
            <label className="destination-public">
              <input
                type="checkbox"
                checked={!circleIds.length}
                onChange={() => setCircleIds([])}
                disabled={busy}
              />
              <span>
                <strong>Home</strong>
                <small>{me.is_private ? 'Follower approvati' : 'Community SN'}</small>
              </span>
            </label>
            <div className="destination-circles">
              {circles.map((circle) => (
                <label key={circle.id}>
                  <input
                    type="checkbox"
                    checked={circleIds.includes(circle.id)}
                    onChange={(event) =>
                      setCircleIds((current) =>
                        event.target.checked
                          ? [...current, circle.id]
                          : current.filter((id) => id !== circle.id),
                      )
                    }
                    disabled={busy || (!circleIds.includes(circle.id) && circleIds.length >= 5)}
                  />
                  <span className="circle-mark" aria-hidden="true">
                    {circle.name.slice(0, 2).toLocaleUpperCase('it')}
                  </span>
                  <span>
                    <strong data-user-copy>{circle.name}</strong>
                    <small>Solo membri</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {mode === 'poll' && (
          <fieldset className="poll-editor">
            <legend>Opzioni</legend>
            {pollOptions.map((option, index) => (
              <div className="poll-option-editor" key={index}>
                <label>
                  <span className="sr-only">Opzione {index + 1}</span>
                  <input
                    value={option}
                    onChange={(event) =>
                      setPollOptions((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? event.target.value : item,
                        ),
                      )
                    }
                    maxLength={100}
                    placeholder={`Opzione ${index + 1}`}
                    required
                    disabled={busy}
                  />
                </label>
                {pollOptions.length > 2 && (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Rimuovi opzione ${index + 1}`}
                    onClick={() =>
                      setPollOptions((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            ))}
            {pollOptions.length < 4 && (
              <button
                type="button"
                className="text-button"
                onClick={() => setPollOptions((current) => [...current, ''])}
              >
                <Plus size={16} /> Aggiungi opzione
              </button>
            )}
            <label>
              Chiusura
              <select
                value={pollDuration ?? ''}
                onChange={(event) =>
                  setPollDuration(event.target.value ? Number(event.target.value) : null)
                }
                disabled={busy}
              >
                <option value="">Nessuna scadenza</option>
                <option value="3600">Tra 1 ora</option>
                <option value="86400">Tra 24 ore</option>
                <option value="259200">Tra 3 giorni</option>
                <option value="604800">Tra 1 settimana</option>
              </select>
            </label>
          </fieldset>
        )}
        <label>
          Avviso di contenuto (facoltativo)
          <input
            value={warning}
            onChange={(e) => setWarning(e.target.value)}
            maxLength={160}
            placeholder="Es. Spoiler sul finale"
            aria-describedby="warning-help"
            disabled={busy}
          />
          <small id="warning-help">
            Testo e media restano nascosti finché chi legge sceglie di aprirli. L’avviso non cambia
            la privacy del post né le regole della community.
          </small>
        </label>
        {mode !== 'poll' && (
          <label className="file-picker">
            <ImagePlus size={21} />
            <span data-user-copy={mediaItems.length ? true : undefined}>
              {mediaItems.length
                ? `${mediaItems.length} contenut${mediaItems.length === 1 ? 'o' : 'i'} selezionat${mediaItems.length === 1 ? 'o' : 'i'}`
                : 'Aggiungi foto o video'}
            </span>
            <Film size={19} />
            <input
              type="file"
              multiple={mode === 'post'}
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,image/gif,video/mp4,video/webm,video/quicktime,.heic,.heif,.mov"
              onChange={(e) => {
                const selected = Array.from(e.target.files ?? []);
                setMediaItems(
                  selected.slice(0, mode === 'post' ? 10 : 1).map((file) => ({
                    file,
                    caption: '',
                    alt: '',
                  })),
                );
              }}
              disabled={busy}
            />
          </label>
        )}
        {mediaItems.length > 0 && (
          <div className="composer-media-list" aria-label="Contenuti del post">
            {mediaItems.map((item, index) => (
              <section className="composer-media-item" key={`${item.file.name}-${index}`}>
                <div>
                  <strong>
                    {index + 1}. <span data-user-copy>{item.file.name}</span>
                  </strong>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Rimuovi ${item.file.name}`}
                    onClick={() =>
                      setMediaItems((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    <X size={16} />
                  </button>
                </div>
                <label>
                  Descrizione
                  <textarea
                    value={item.caption}
                    onChange={(event) =>
                      setMediaItems((current) =>
                        current.map((entry, itemIndex) =>
                          itemIndex === index ? { ...entry, caption: event.target.value } : entry,
                        ),
                      )
                    }
                    maxLength={2200}
                    rows={2}
                    placeholder="Descrivi questo elemento"
                  />
                </label>
                <label>
                  Testo alternativo
                  <input
                    value={item.alt}
                    onChange={(event) =>
                      setMediaItems((current) =>
                        current.map((entry, itemIndex) =>
                          itemIndex === index ? { ...entry, alt: event.target.value } : entry,
                        ),
                      )
                    }
                    maxLength={300}
                    placeholder="Es. Due persone sedute al mare"
                  />
                </label>
              </section>
            ))}
          </div>
        )}
        <p className="muted fine">
          {mode === 'poll'
            ? 'Il voto è unico e non può essere modificato dopo l’invio.'
            : 'Immagini compresse prima dell’invio. Video fino a 20 secondi e 3 MB dopo la compressione. Le storie scompaiono dopo 24 ore.'}
        </p>
        {status && (
          <p role="status" className="form-message">
            {status}
          </p>
        )}
        <button
          className="primary full"
          disabled={
            busy ||
            (!body.trim() && !mediaItems.length) ||
            (kind !== 'post' && !mediaItems.length) ||
            (mode === 'story' && body.length > 128) ||
            (mode === 'poll' && pollOptions.some((option) => !option.trim()))
          }
        >
          {busy ? 'Preparazione…' : 'Pubblica'}
          <Send size={17} />
        </button>
      </form>
    </Modal>
  );
}
