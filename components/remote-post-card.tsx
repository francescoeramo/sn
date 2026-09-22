'use client';
import { useState } from 'react';
import { ExternalLink, Flag, Globe2 } from 'lucide-react';
import type { Action, RemotePost } from '@/lib/core/types';
import { initials, relativeTime } from '@/lib/core/rules';
import { Modal } from './primitives';

export function RemotePostCard({
  post,
  busy,
  onAction,
}: {
  post: RemotePost;
  busy: boolean;
  onAction: (action: Action) => Promise<boolean>;
}) {
  const [revealed, setRevealed] = useState(false);
  const [reporting, setReporting] = useState(false);
  const concealed = Boolean(post.content_warning) && !revealed;
  return (
    <article className="post-card remote-post">
      <header className="post-header">
        <div className="person-button">
          <span aria-hidden="true" className="avatar sage">
            {initials(post.display_name)}
          </span>
          <span>
            <strong>{post.display_name}</strong>
            <small>
              @{post.username}@{post.host} <span>·</span> {relativeTime(post.created_at)}
            </small>
          </span>
        </div>
        <span className="federated-mark">
          <Globe2 size={14} /> Fediverso
        </span>
      </header>
      {post.content_warning && (
        <div className="content-warning">
          <span>Avviso di contenuto</span>
          <p>{post.content_warning}</p>
          <button
            className="secondary"
            aria-expanded={!concealed}
            aria-controls={`remote-content-${encodeURIComponent(post.id)}`}
            onClick={() => setRevealed(!revealed)}
          >
            {concealed ? 'Mostra contenuto' : 'Nascondi contenuto'}
          </button>
        </div>
      )}
      <div
        id={`remote-content-${encodeURIComponent(post.id)}`}
        className={!concealed ? 'post-content revealed' : ''}
      >
        {!concealed && <p className="post-body">{post.body}</p>}
      </div>
      <footer className="remote-post-footer">
        <p>
          Ricevuto tramite la federazione. Le interazioni restano sul server d’origine.
          {post.updated_at && <span> Modificato.</span>}
        </p>
        <a href={post.id} target="_blank" rel="noreferrer">
          Apri origine <ExternalLink size={14} />
        </a>
        <button className="utility-link" onClick={() => setReporting(true)}>
          Segnala <Flag size={14} />
        </button>
      </footer>
      {reporting && (
        <Modal title="Segnala questo contenuto" onClose={() => setReporting(false)}>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const sent = await onAction({
                type: 'report-remote',
                object_id: post.id,
                reason: String(data.get('reason') ?? ''),
              });
              if (sent) setReporting(false);
            }}
          >
            <label htmlFor="remote-report-reason">Cosa dobbiamo controllare?</label>
            <textarea
              id="remote-report-reason"
              name="reason"
              minLength={5}
              maxLength={1000}
              required
            />
            <p className="fine muted">
              La segnalazione resta su SN. Non viene inviata al server d’origine.
            </p>
            <div className="button-row">
              <button className="primary" disabled={busy} type="submit">
                Invia segnalazione
              </button>
              <button className="secondary" type="button" onClick={() => setReporting(false)}>
                Annulla
              </button>
            </div>
          </form>
        </Modal>
      )}
    </article>
  );
}
