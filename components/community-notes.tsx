'use client';
import { useState } from 'react';
import type { Action, CommunityNote, Snapshot } from '@/lib/core/types';
import { Modal } from './primitives';
function sourceHost(source: string) {
  try {
    return new URL(source).hostname;
  } catch {
    return 'Link della fonte';
  }
}
function Sources({ sources }: { sources: string[] }) {
  return (
    <ul className="note-sources">
      {sources.map((source, i) => (
        <li key={source}>
          <a href={source} target="_blank" rel="noopener noreferrer">
            Fonte {i + 1} · {sourceHost(source)}
          </a>
        </li>
      ))}
    </ul>
  );
}
export function PostNotes({
  postId,
  state,
  onAction,
  loadedNotes,
}: {
  loadedNotes?: CommunityNote[];
  postId: string;
  state: Snapshot;
  onAction: (action: Action) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState('');
  const notes = (loadedNotes ?? state.notes ?? []).filter((n) => n.post_id === postId);
  const mine = notes.filter((n) => n.author_id === state.me.id && n.status !== 'approved');
  const waiting = mine.some((n) => n.status === 'pending');
  return (
    <section className="post-notes" aria-label="Note della comunità">
      {notes
        .filter((n) => n.status === 'approved')
        .map((note) => (
          <aside className="context-note" key={note.id}>
            <strong>Nota della comunità</strong>
            <p>{note.body}</p>
            <Sources sources={note.sources} />
            <details>
              <summary>Decisione del moderatore</summary>
              <p>{note.review_reason}</p>
            </details>
          </aside>
        ))}
      {mine.map((note) => (
        <details key={note.id} className="my-note">
          <summary>
            {note.status === 'pending'
              ? 'La tua nota è in revisione'
              : 'La tua nota non è stata approvata'}
          </summary>
          <p>{note.body}</p>
          <Sources sources={note.sources} />
          {note.review_reason && <p>Motivo: {note.review_reason}</p>}
        </details>
      ))}
      <button className="text-button" disabled={waiting} onClick={() => setOpen(true)}>
        {waiting ? 'Nota inviata al moderatore' : 'Aggiungi contesto e fonti'}
      </button>
      {open && (
        <Modal
          title="Proponi una nota"
          onClose={() => {
            if (!pending) setOpen(false);
          }}
        >
          <p>
            Aggiungi informazioni verificabili su un’affermazione del post. Le opinioni e il
            dibattito politico sono ammessi. La nota sarà pubblicata solo dopo la revisione manuale.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              setPending(true);
              setError('');
              try {
                const ok = await onAction({
                  type: 'propose-note',
                  post_id: postId,
                  body: String(data.get('body')),
                  sources: String(data.get('sources'))
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                });
                if (ok) setOpen(false);
                else setError('La nota non è stata inviata. Il testo è ancora qui.');
              } finally {
                setPending(false);
              }
            }}
          >
            <label>
              Quale contesto manca?
              <textarea
                name="body"
                required
                minLength={20}
                maxLength={1200}
                rows={4}
                disabled={pending}
              />
            </label>
            <label>
              Fonti HTTPS, una per riga
              <textarea
                name="sources"
                required
                rows={3}
                maxLength={1502}
                placeholder="https://…"
                disabled={pending}
              />
            </label>
            <p className="fine muted">
              Da 1 a 3 fonti. I link vengono aperti solo quando li scegli.
            </p>
            {error && <p role="alert">{error}</p>}
            <button className="primary" disabled={pending}>
              {pending ? 'Invio…' : 'Invia alla revisione'}
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
function ReviewNote({
  note,
  postBody,
  onAction,
}: {
  note: CommunityNote;
  postBody: string;
  onAction: (action: Action) => Promise<boolean>;
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState('');
  return (
    <article className="note-review">
      <blockquote>{postBody}</blockquote>
      <h3>Contesto proposto</h3>
      <p>{note.body}</p>
      <Sources sources={note.sources} />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setPending(true);
          setError('');
          try {
            if (
              !(await onAction({
                type: 'review-note',
                note_id: note.id,
                approve: form.get('decision') === 'approve',
                reason: String(form.get('reason')),
              }))
            )
              setError('Decisione non salvata. Riprova.');
          } finally {
            setPending(false);
          }
        }}
      >
        <label>
          Decisione
          <select name="decision" disabled={pending}>
            <option value="approve">Approva e mostra sotto il post</option>
            <option value="reject">Non approvare</option>
          </select>
        </label>
        <label>
          Motivo della decisione
          <textarea
            name="reason"
            required
            minLength={10}
            maxLength={500}
            rows={2}
            disabled={pending}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="primary" disabled={pending}>
          {pending ? 'Salvataggio…' : 'Salva decisione'}
        </button>
      </form>
    </article>
  );
}
export function NotesReview({
  state,
  onAction,
}: {
  state: Snapshot;
  onAction: (action: Action) => Promise<boolean>;
}) {
  const notes = (state.notes ?? []).filter((n) => n.status === 'pending');
  if (!state.isAdmin) return null;
  return (
    <section className="notes-review" aria-label="Revisione note">
      <h2>Note da verificare</h2>
      <p className="muted">
        Leggi il post e controlla le fonti. L’approvazione aggiunge contesto senza rimuovere il post
        originale.
      </p>
      {!notes.length ? (
        <p>Nessuna nota in attesa.</p>
      ) : (
        notes.map((note) => (
          <ReviewNote
            key={note.id}
            note={note}
            postBody={
              state.posts.find((p) => p.id === note.post_id)?.body ??
              note.post?.body ??
              'Post non presente nel feed caricato. Aprilo prima di decidere.'
            }
            onAction={onAction}
          />
        ))
      )}
    </section>
  );
}
