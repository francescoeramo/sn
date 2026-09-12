'use client';
import { useState } from 'react';
import { ImagePlus, Film, Send, X, LockKeyhole, Plus, Trash2 } from 'lucide-react';
import type { Action, Profile, Post } from '@/lib/core/types';
import { prepareMedia, asDataURL } from '@/lib/client/media';
import { Avatar, Modal } from './primitives';
export function Composer({
  me,
  demo,
  initialKind = 'post',
  onClose,
  onPost,
}: {
  me: Profile;
  demo: boolean;
  initialKind?: Post['kind'];
  onClose: () => void;
  onPost: (action: Action) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<Post['kind'] | 'poll'>(initialKind);
  const kind: Post['kind'] = mode === 'poll' ? 'post' : mode;
  const [body, setBody] = useState('');
  const [alt, setAlt] = useState('');
  const [warning, setWarning] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollDuration, setPollDuration] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title="Qualcosa da condividere"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="composer-person">
        <Avatar person={me} />
        <div>
          <strong>{me.display_name}</strong>
          <small>
            <LockKeyhole size={12} />
            {me.is_private ? 'Solo i follower approvati' : 'Visibile nella community'}
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
              if (k === 'poll') setFile(null);
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
            let path: string | null = null;
            if (file) {
              const prepared = await prepareMedia(file, setStatus);
              if (demo) path = await asDataURL(prepared);
              else {
                setStatus('Caricamento…');
                const form = new FormData();
                form.append('file', prepared);
                const response = await fetch('/api/upload', { method: 'POST', body: form });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                path = result.path;
              }
            }
            const ok = await onPost({
              type: 'post',
              body,
              kind,
              media_path: path,
              alt,
              content_warning: warning,
              poll: mode === 'poll' ? { options: pollOptions, duration: pollDuration } : undefined,
            });
            if (ok) onClose();
            else setStatus('Il post non è stato pubblicato. La bozza è ancora qui.');
          } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Caricamento non riuscito.');
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
          maxLength={2200}
          placeholder={
            mode === 'poll' ? 'Che cosa vuoi chiedere?' : 'Che cosa succede dalle tue parti?'
          }
          rows={5}
        />
        <small className="counter">{body.length} / 2200</small>
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
            <span>{file ? file.name : 'Aggiungi foto o video'}</span>
            <Film size={19} />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={busy}
            />
          </label>
        )}
        {file && (
          <>
            <button className="text-button" type="button" onClick={() => setFile(null)}>
              <X size={14} /> Rimuovi allegato
            </button>
            <label>
              Descrivi il contenuto
              <input
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                maxLength={300}
                placeholder="Una descrizione per chi non vede l’immagine"
                required={file.type.startsWith('image/')}
              />
            </label>
          </>
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
            (!body.trim() && !file) ||
            (kind !== 'post' && !file) ||
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
