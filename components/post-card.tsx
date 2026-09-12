'use client';
import { useState } from 'react';
import {
  Heart,
  Bookmark,
  MessageCircle,
  MoreHorizontal,
  Send,
  Flag,
  Trash2,
  LockKeyhole,
} from 'lucide-react';
import type { Post, Snapshot, Action } from '@/lib/core/types';
import { relativeTime } from '@/lib/core/rules';
import { PostNotes } from './community-notes';
import { Avatar, Media, Modal } from './primitives';
export function PostCard({
  post,
  state,
  demo,
  now,
  onAction,
  onProfile,
  onTag,
}: {
  post: Post;
  state: Snapshot;
  demo: boolean;
  now: number;
  onAction: (a: Action) => Promise<boolean>;
  onProfile: (id: string) => void;
  onTag: (tag: string) => void;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const concealed = Boolean(post.content_warning) && !revealed;
  const saved = state.bookmarks.some((b) => b.user_id === state.me.id && b.post_id === post.id);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const [remove, setRemove] = useState(false);
  const [pending, setPending] = useState(false);
  const author = state.profiles.find((p) => p.id === post.author_id);
  const likes = state.likes.filter((l) => l.post_id === post.id);
  const liked = likes.some((l) => l.user_id === state.me.id);
  const comments = state.comments
    .filter((c) => c.post_id === post.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const pollResults = (state.pollResults ?? []).filter((result) => result.poll_id === post.id);
  const selectedOption = pollResults.find((result) => result.selected)?.option_id;
  const pollClosed = Boolean(post.poll?.closes_at && Date.parse(post.poll.closes_at) <= now);
  const showPollResults = Boolean(selectedOption || pollClosed);
  const totalPollVotes = pollResults.reduce((total, result) => total + Number(result.votes), 0);
  const act = async (a: Action) => {
    setPending(true);
    try {
      return await onAction(a);
    } finally {
      setPending(false);
    }
  };
  return (
    <article className="post-card">
      <header className="post-header">
        <button className="person-button" onClick={() => onProfile(post.author_id)}>
          <Avatar person={author} />
          <span>
            <strong>{author?.display_name ?? 'Utente'}</strong>
            <small>
              @{author?.username ?? 'utente'} <span>·</span> {relativeTime(post.created_at)}{' '}
              {author?.is_private && <LockKeyhole size={11} />}
            </small>
          </span>
        </button>
        <div className="post-menu">
          <button
            className="icon-button"
            aria-label="Opzioni del post"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <MoreHorizontal size={21} />
          </button>
          {menu && (
            <div className="popover">
              {post.author_id === state.me.id ? (
                <button
                  onClick={() => {
                    setRemove(true);
                    setMenu(false);
                  }}
                >
                  <Trash2 size={16} />
                  Elimina post
                </button>
              ) : (
                <button
                  onClick={() => {
                    setReport(true);
                    setMenu(false);
                  }}
                >
                  <Flag size={16} />
                  Segnala post
                </button>
              )}
            </div>
          )}
        </div>
      </header>
      {post.content_warning && (
        <div className="content-warning">
          <span>Avviso di contenuto</span>
          <p>{post.content_warning}</p>
          <button
            className="secondary"
            aria-expanded={!concealed}
            aria-controls={`post-content-${post.id}`}
            onClick={() => setRevealed(!revealed)}
          >
            {concealed ? 'Mostra contenuto' : 'Nascondi contenuto'}
          </button>
        </div>
      )}
      <div id={`post-content-${post.id}`}>
        {!concealed && (
          <>
            {post.body && (
              <p className="post-body">
                {post.body.split(/(#[\p{L}\p{N}_]+)/gu).map((part, i) =>
                  part.startsWith('#') ? (
                    <button className="hashtag" key={i} onClick={() => onTag(part)}>
                      {part}
                    </button>
                  ) : (
                    part
                  ),
                )}
              </p>
            )}
            {post.poll && (
              <section className="post-poll" aria-label="Sondaggio">
                {post.poll.options
                  .toSorted((a, b) => a.position - b.position)
                  .map((option) => {
                    const result = pollResults.find((item) => item.option_id === option.id);
                    const percentage = totalPollVotes
                      ? Math.round((Number(result?.votes ?? 0) / totalPollVotes) * 100)
                      : 0;
                    return (
                      <div className="poll-choice" key={option.id}>
                        <button
                          className={selectedOption === option.id ? 'selected' : ''}
                          disabled={pending || Boolean(selectedOption) || pollClosed}
                          aria-pressed={selectedOption === option.id}
                          onClick={() =>
                            act({ type: 'vote-poll', poll_id: post.id, option_id: option.id })
                          }
                        >
                          <span>{option.body}</span>
                          {showPollResults && <small>{percentage}%</small>}
                        </button>
                        {showPollResults && (
                          <progress
                            max={Math.max(totalPollVotes, 1)}
                            value={Number(result?.votes ?? 0)}
                            aria-label={`${option.body}: ${percentage}%`}
                          />
                        )}
                      </div>
                    );
                  })}
                <p className="poll-meta">
                  {selectedOption
                    ? 'Voto registrato'
                    : pollClosed
                      ? 'Sondaggio chiuso'
                      : post.poll.closes_at
                        ? `Si chiude ${new Date(post.poll.closes_at).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })}`
                        : 'Nessuna scadenza'}
                </p>
              </section>
            )}
            <Media post={post} demo={demo} />
            <PostNotes loadedNotes={post.notes} postId={post.id} state={state} onAction={act} />
          </>
        )}
      </div>
      <div className="post-actions">
        <button
          className={liked ? 'liked' : ''}
          aria-label={liked ? 'Togli mi piace' : 'Mi piace'}
          aria-pressed={liked}
          disabled={pending || concealed}
          onClick={() => act({ type: 'like', post_id: post.id })}
        >
          <Heart size={22} fill={liked ? 'currentColor' : 'none'} />
          <span>Mi piace</span>
        </button>
        <button
          onClick={() => setCommentsOpen(!commentsOpen)}
          aria-expanded={commentsOpen}
          aria-label="Commenti"
          disabled={concealed}
        >
          <MessageCircle size={22} />
          <span>{comments.length || 'Commenta'}</span>
        </button>
        <button
          className={saved ? 'saved' : ''}
          aria-label={saved ? 'Rimuovi dai salvati' : 'Salva post'}
          aria-pressed={saved}
          disabled={pending}
          onClick={() => act({ type: 'bookmark', post_id: post.id, saved: !saved })}
        >
          <Bookmark size={21} fill={saved ? 'currentColor' : 'none'} />
          <span>{saved ? 'Salvato' : 'Salva'}</span>
        </button>
        <span className="post-date">
          {new Date(post.created_at).toLocaleDateString('it-IT', {
            day: 'numeric',
            month: 'short',
          })}
        </span>
      </div>
      {post.author_id === state.me.id && likes.length > 0 && (
        <details className="author-interactions">
          <summary>Le interazioni sul tuo post</summary>
          <p>
            {likes.length} {likes.length === 1 ? 'persona ha' : 'persone hanno'} messo mi piace.
            Questo conteggio è visibile qui solo a te.
          </p>
        </details>
      )}
      {!concealed && comments.length > 0 && !commentsOpen && (
        <button className="comment-preview" onClick={() => setCommentsOpen(true)}>
          <strong>
            {state.profiles
              .find((p) => p.id === comments[0].author_id)
              ?.display_name.split(' ')[0] ?? 'Utente'}
          </strong>{' '}
          {comments[0].body}
        </button>
      )}
      {!concealed && commentsOpen && (
        <section className="comments" aria-label="Commenti del post">
          {comments.map((c) => (
            <div className="comment" key={c.id}>
              <Avatar person={state.profiles.find((p) => p.id === c.author_id)} size="small" />
              <p>
                <strong>
                  {state.profiles.find((p) => p.id === c.author_id)?.display_name ?? 'Utente'}
                </strong>
                <span>{c.body}</span>
              </p>
            </div>
          ))}
          <form
            className="comment-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const body = String(new FormData(form).get('body'));
              if (await act({ type: 'comment', post_id: post.id, body })) form.reset();
            }}
          >
            <input
              name="body"
              aria-label="Scrivi un commento"
              placeholder="Aggiungi una risposta…"
              maxLength={1000}
              required
            />
            <button className="icon-button" disabled={pending} aria-label="Invia commento">
              <Send size={18} />
            </button>
          </form>
        </section>
      )}
      {report && (
        <Modal title="Segnala questo post" onClose={() => setReport(false)}>
          <p>La segnalazione sarà letta dal moderatore della beta.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await act({
                  type: 'report',
                  post_id: post.id,
                  reason: String(new FormData(e.currentTarget).get('reason')),
                })
              )
                setReport(false);
            }}
          >
            <label>
              Che cosa non va?
              <textarea name="reason" required minLength={5} maxLength={1000} rows={4} />
            </label>
            <button className="primary" disabled={pending}>
              Invia segnalazione
            </button>
          </form>
        </Modal>
      )}
      {remove && (
        <Modal title="Eliminare il post?" onClose={() => setRemove(false)}>
          <p>Il post e le risposte saranno rimossi. Questa operazione non si può annullare.</p>
          <button
            className="danger"
            disabled={pending}
            onClick={async () => {
              if (await act({ type: 'delete-post', post_id: post.id })) setRemove(false);
            }}
          >
            Elimina post
          </button>
        </Modal>
      )}
    </article>
  );
}
