'use client';

import Image from 'next/image';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import type { Post, Profile } from '@/lib/core/types';
import { Avatar, Modal } from './primitives';

export function StoryPlayer({
  stories,
  startId,
  profiles,
  demo,
  onClose,
}: {
  stories: Post[];
  startId: string;
  profiles: Profile[];
  demo: boolean;
  onClose: () => void;
}) {
  // Freeze this viewing session so feed refreshes do not reorder the stories being watched.
  const [sequence] = useState(() => {
    const authors = [...new Set(stories.map((s) => s.author_id))];
    return authors.flatMap((author) =>
      stories
        .filter((s) => s.author_id === author)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    );
  });
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      sequence.findIndex(
        (s) => s.author_id === sequence.find((start) => start.id === startId)?.author_id,
      ),
    ),
  );
  const current = sequence[index];
  const person = profiles.find((p) => p.id === current?.author_id);
  const next = useCallback(() => {
    if (index + 1 < sequence.length) setIndex(index + 1);
    else onClose();
  }, [index, sequence.length, onClose]);
  const previous = useCallback(() => setIndex((n) => Math.max(0, n - 1)), []);
  if (!current) return null;
  return (
    <Modal title={person?.display_name ?? 'Storia'} onClose={onClose}>
      <StoryFrame
        key={current.id}
        post={current}
        person={person}
        demo={demo}
        authorStories={sequence.filter((s) => s.author_id === current.author_id)}
        onNext={next}
        onPrevious={previous}
        first={index === 0}
      />
    </Modal>
  );
}

function StoryFrame({
  post,
  person,
  demo,
  authorStories,
  onNext,
  onPrevious,
  first,
}: {
  post: Post;
  person?: Profile;
  demo: boolean;
  authorStories: Post[];
  onNext: () => void;
  onPrevious: () => void;
  first: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const elapsed = useRef(0);
  const pressedAt = useRef<number | null>(null);
  const completed = useRef(false);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [muted, setMuted] = useState(true);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const isVideo = post.media_type?.startsWith('video/') ?? false;
  const src = demo ? post.media_path! : `/api/media?path=${encodeURIComponent(post.media_path!)}`;
  const stopped = paused || holding || hidden || blocked || !ready || Boolean(error);
  const advance = useEffectEvent(() => {
    if (!completed.current) {
      completed.current = true;
      onNext();
    }
  });
  const activeIndex = authorStories.findIndex((s) => s.id === post.id);

  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    const blur = () => {
      setHolding(false);
      pressedAt.current = null;
    };
    window.addEventListener('blur', blur);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', blur);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      if (post.expires_at && Date.now() >= Date.parse(post.expires_at)) {
        advance();
        return;
      }
      if (!stopped) {
        if (isVideo && video.current) {
          const duration = Math.min(20, video.current.duration || 20);
          setProgress(Math.min(1, video.current.currentTime / duration));
          if (video.current.ended || video.current.currentTime >= duration) {
            advance();
            return;
          }
        } else {
          elapsed.current += Math.min(now - last, 250);
          setProgress(Math.min(1, elapsed.current / 5000));
          if (elapsed.current >= 5000) {
            advance();
            return;
          }
        }
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isVideo, stopped, post.expires_at]);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (stopped) element.pause();
    else void element.play().catch(() => setBlocked(true));
  }, [stopped]);

  const navigate = (direction: 'previous' | 'next') => {
    if (direction === 'previous') onPrevious();
    else onNext();
  };
  return (
    <section
      className="story-viewer"
      aria-label="Lettore delle storie"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          onNext();
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onPrevious();
        }
        if (e.key === ' ' && e.target === e.currentTarget) {
          e.preventDefault();
          setPaused((p) => !p);
        }
      }}
      tabIndex={0}
    >
      <div
        className="story-segments"
        aria-label={`${authorStories.length} storie di ${person?.display_name ?? 'questo utente'}`}
      >
        {authorStories.map((s, i) => (
          <progress
            key={s.id}
            aria-label={`Storia ${i + 1} di ${authorStories.length}`}
            max={1}
            value={i < activeIndex ? 1 : i === activeIndex ? progress : 0}
          />
        ))}
      </div>
      <div className="story-toolbar">
        <span className="person-button">
          <Avatar person={person} size="small" />
          <small>
            {activeIndex + 1} / {authorStories.length}
          </small>
        </span>
        <span className="story-controls">
          {isVideo && (
            <button
              className="icon-button"
              aria-label={muted ? 'Attiva audio' : 'Disattiva audio'}
              onClick={() => setMuted(!muted)}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          )}
          <button
            className="icon-button"
            aria-label={paused || blocked ? 'Riprendi storia' : 'Metti in pausa la storia'}
            onClick={() => {
              if (blocked) {
                const element = video.current;
                if (element)
                  void element
                    .play()
                    .then(() => {
                      setBlocked(false);
                      setPaused(false);
                    })
                    .catch(() => setError('Riproduzione non disponibile in questo browser.'));
              } else setPaused((p) => !p);
            }}
          >
            {paused || blocked ? <Play size={18} /> : <Pause size={18} />}
          </button>
        </span>
      </div>
      <div className="story-stage">
        {isVideo ? (
          <video
            ref={video}
            src={src}
            playsInline
            muted={muted}
            preload="auto"
            aria-label={post.alt || 'Video della storia'}
            onLoadedData={() => setReady(true)}
            onEnded={onNext}
            onError={() =>
              setError('Questo video non si è caricato. Puoi passare alla storia successiva.')
            }
          >
            <track kind="captions" />
          </video>
        ) : (
          <Image
            src={src}
            alt={post.alt || 'Immagine della storia'}
            width={960}
            height={1280}
            unoptimized
            onLoad={() => setReady(true)}
            onError={() =>
              setError('Questa immagine non si è caricata. Puoi passare alla storia successiva.')
            }
          />
        )}
        {!ready && !error && (
          <span className="story-state" role="status">
            Caricamento…
          </span>
        )}
        {(paused || holding || blocked) && (
          <span className="story-state" role="status">
            {blocked ? 'Premi Riprendi per avviare il video' : 'In pausa'}
          </span>
        )}
        {(['previous', 'next'] as const).map((direction) => (
          <button
            key={direction}
            className={`story-tap-zone ${direction}`}
            aria-label={direction === 'next' ? 'Storia successiva' : 'Storia precedente'}
            aria-disabled={direction === 'previous' && first}
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              pressedAt.current = performance.now();
              setHolding(true);
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerUp={(e) => {
              const started = pressedAt.current;
              pressedAt.current = null;
              setHolding(false);
              if (e.currentTarget.hasPointerCapture(e.pointerId))
                e.currentTarget.releasePointerCapture(e.pointerId);
              if (started !== null && performance.now() - started < 220) navigate(direction);
            }}
            onPointerCancel={() => {
              pressedAt.current = null;
              setHolding(false);
            }}
            onLostPointerCapture={() => {
              pressedAt.current = null;
              setHolding(false);
            }}
            onClick={(e) => {
              if (e.detail === 0) navigate(direction);
            }}
          >
            <span>
              {direction === 'next' ? <ChevronRight size={24} /> : <ChevronLeft size={24} />}
            </span>
          </button>
        ))}
      </div>
      {error && (
        <p className="form-message" role="alert">
          {error}
        </p>
      )}
      <p className="story-caption">{post.body}</p>
      <p className="fine muted">Tocca ai lati per cambiare storia. Tieni premuto per fermarla.</p>
    </section>
  );
}
