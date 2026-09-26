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
  SmilePlus,
  Share2,
  CornerDownRight,
} from 'lucide-react';
import type { Post, Snapshot, Action } from '@/lib/core/types';
import { relativeTime, REACTIONS } from '@/lib/core/rules';
import { PostNotes } from './community-notes';
import { Avatar, Media, Modal } from './primitives';
export function PostCard({
  post,
  state,
  demo,
  priority = false,
  now,
  onAction,
  onProfile,
  onTag,
}: {
  post: Post;
  state: Snapshot;
  demo: boolean;
  priority?: boolean;
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
  const [shareOpen, setShareOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string; quote: string } | null>(null);
  const [shareDestination, setShareDestination] = useState('');
  const [shareNote, setShareNote] = useState('');
  const [pending, setPending] = useState(false);
  const author = state.profiles.find((p) => p.id === post.author_id);
  const likes = state.likes.filter((l) => l.post_id === post.id);
  const liked = likes.some((l) => l.user_id === state.me.id);
  const comments = state.comments
    .filter((c) => c.post_id === post.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const roots = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);
  const myReaction = (state.reactions ?? []).find(
    (item) => item.user_id === state.me.id && item.target_type === 'post' && item.target_id === post.id,
  )?.emoji;
  const shareDestinations = [
    ...state.follows
      .filter(
        (follow) =>
          follow.follower_id === state.me.id &&
          follow.accepted &&
          state.follows.some(
            (back) =>
              back.follower_id === follow.following_id &&
              back.following_id === state.me.id &&
              back.accepted,
          ),
      )
      .map((follow) => ({
        value: `chat:${follow.following_id}`,
        label: `Chat con ${
          state.profiles.find((p) => p.id === follow.following_id)?.display_name ?? 'una persona'
        }`,
      })),
    ...(state.circles ?? [])
      .filter(
        (circle) =>
          !circle.archived_at &&
          (state.circleMembers ?? []).some(
            (member) =>
              member.circle_id === circle.id &&
              member.user_id === state.me.id &&
              member.status === 'active',
          ),
      )
      .map((circle) => ({ value: `circle:${circle.id}`, label: `Cerchia ${circle.name}` })),
  ];
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
      <div id={`post-content-${post.id}`} className={!concealed ? 'post-content revealed' : ''}>
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
            <Media post={post} demo={demo} priority={priority} />
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
          <Heart
            key={liked ? 'liked' : 'plain'}
            className={liked ? 'like-pulse' : undefined}
            size={22}
            fill={liked ? 'currentColor' : 'none'}
          />
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
        <button
          aria-label="Condividi internamente"
          disabled={pending || concealed}
          onClick={() => setShareOpen(true)}
        >
          <Share2 size={20} />
          <span>Condividi</span>
        </button>
        <span className="post-date">
          {new Date(post.created_at).toLocaleDateString('it-IT', {
            day: 'numeric',
            month: 'short',
          })}
        </span>
      </div>
      {!concealed && (
        <div className="reaction-row" aria-label="Reazioni private">
          <SmilePlus size={16} aria-hidden="true" />
          {REACTIONS.map((emoji) => {
            const active = myReaction === emoji;
            return (
              <button
                key={emoji}
                className={active ? 'reaction active' : 'reaction'}
                aria-label={`Reazione ${emoji}`}
                aria-pressed={active}
                disabled={pending}
                onClick={() =>
                  act({
                    type: 'react',
                    target_type: 'post',
                    target_id: post.id,
                    emoji: active ? null : emoji,
                  })
                }
              >
                {emoji}
              </button>
            );
          })}
          <span className="muted fine">Solo tu vedi le tue reazioni.</span>
        </div>
      )}
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
          {roots.map((comment) => (
            <div className="comment-thread" key={comment.id}>
              <div className="comment">
                <Avatar
                  person={state.profiles.find((p) => p.id === comment.author_id)}
                  size="small"
                />
                <p>
                  <strong>
                    {state.profiles.find((p) => p.id === comment.author_id)?.display_name ??
                      'Utente'}
                  </strong>
                  <span>{comment.body}</span>
                </p>
                <button
                  className="text-button"
                  aria-label="Rispondi a questo commento"
                  disabled={pending}
                  onClick={() =>
                    setReplyTo({
                      id: comment.id,
                      name:
                        state.profiles.find((p) => p.id === comment.author_id)?.display_name ??
                        'Utente',
                      quote: comment.body.slice(0, 180),
                    })
                  }
                >
                  <CornerDownRight size={14} /> Rispondi
                </button>
              </div>
              {repliesOf(comment.id).map((reply) => (
                <div className="comment comment-reply" key={reply.id}>
                  <Avatar
                    person={state.profiles.find((p) => p.id === reply.author_id)}
                    size="small"
                  />
                  <p>
                    <strong>
                      {state.profiles.find((p) => p.id === reply.author_id)?.display_name ??
                        'Utente'}
                    </strong>
                    {reply.quote && <span className="comment-quote">{reply.quote}</span>}
                    <span>{reply.body}</span>
                  </p>
                </div>
              ))}
            </div>
          ))}
          <form
            className="comment-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const body = String(new FormData(form).get('body'));
              const ok = await act({
                type: 'comment',
                post_id: post.id,
                body,
                parent_id: replyTo?.id ?? null,
                quote: replyTo?.quote ?? '',
              });
              if (ok) {
                form.reset();
                setReplyTo(null);
              }
            }}
          >
            {replyTo && (
              <p className="comment-reply-hint">
                Risposta a {replyTo.name} · {replyTo.quote.slice(0, 60)}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setReplyTo(null)}
                >
                  Annulla
                </button>
              </p>
            )}
            <input
              name="body"
              aria-label="Scrivi un commento"
              placeholder={replyTo ? `Rispondi a ${replyTo.name}…` : 'Aggiungi una risposta…'}
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
      {shareOpen && (
        <Modal title="Condividi internamente" onClose={() => setShareOpen(false)}>
          <p className="muted">
            La condivisione resta privata: nessuna copia pubblica e nessun contatore.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const [kind, id] = shareDestination.split(':');
              if (!kind || !id) return;
              const ok = await act({
                type: 'share',
                target_type: 'post',
                target_id: post.id,
                destination_type: kind === 'chat' ? 'chat' : 'circle',
                destination_id: id,
                note: shareNote,
              });
              if (ok) {
                setShareOpen(false);
                setShareDestination('');
                setShareNote('');
              }
            }}
          >
            <label>
              Destinazione
              <select
                value={shareDestination}
                required
                onChange={(e) => setShareDestination(e.target.value)}
              >
                <option value="">Scegli dove condividere</option>
                {shareDestinations.map((destination) => (
                  <option key={destination.value} value={destination.value}>
                    {destination.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nota personale
              <textarea
                value={shareNote}
                maxLength={280}
                rows={2}
                onChange={(e) => setShareNote(e.target.value)}
              />
            </label>
            <button className="primary" disabled={pending || !shareDestination}>
              Condividi
            </button>
          </form>
        </Modal>
      )}
    </article>
  );
}
