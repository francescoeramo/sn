'use client';
import { useState } from 'react';
import { ExternalLink, Globe2 } from 'lucide-react';
import type { RemotePost } from '@/lib/core/types';
import { initials, relativeTime } from '@/lib/core/rules';

export function RemotePostCard({ post }: { post: RemotePost }) {
  const [revealed, setRevealed] = useState(false);
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
      </footer>
    </article>
  );
}
