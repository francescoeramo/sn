'use client';
import { useState } from 'react';
import { ImagePlus, Film, Send, X, LockKeyhole } from 'lucide-react';
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
  const [kind, setKind] = useState<Post['kind']>(initialKind);
  const [body, setBody] = useState('');
  const [alt, setAlt] = useState('');
  const [warning, setWarning] = useState('');
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
        {(['post', 'story', 'reel'] as const).map((k) => (
          <button
            key={k}
            aria-pressed={kind === k}
            className={kind === k ? 'selected' : ''}
            onClick={() => setKind(k)}
          >
            {k === 'post' ? 'Post' : k === 'story' ? 'Storia · 24 h' : 'Reel'}
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
          placeholder="Che cosa succede dalle tue parti?"
          rows={5}
        />
        <small className="counter">{body.length} / 2200</small>
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
          Immagini compresse prima dell’invio. Video fino a 20 secondi e 3 MB dopo la compressione.
          Le storie scompaiono dopo 24 ore.
        </p>
        {status && (
          <p role="status" className="form-message">
            {status}
          </p>
        )}
        <button
          className="primary full"
          disabled={busy || (!body.trim() && !file) || (kind !== 'post' && !file)}
        >
          {busy ? 'Preparazione…' : 'Pubblica'}
          <Send size={17} />
        </button>
      </form>
    </Modal>
  );
}
