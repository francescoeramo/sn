'use client';
import Image from 'next/image';
import { useEffect, useId, useRef } from 'react';
import {
  Bell,
  Bookmark,
  Clapperboard,
  MessageCircle,
  SearchX,
  ShieldCheck,
  Sprout,
  X,
} from 'lucide-react';
import type { Profile, Post } from '@/lib/core/types';
import { initials } from '@/lib/core/rules';
export function Avatar({
  person,
  size = 'normal',
}: {
  person?: Profile;
  size?: 'small' | 'normal' | 'large';
}) {
  return (
    <span aria-hidden="true" className={`avatar ${person?.color ?? 'lilac'} ${size}`}>
      {initials(person?.display_name ?? '?')}
    </span>
  );
}
export function Media({ post, demo = false }: { post: Post; demo?: boolean }) {
  if (!post.media_path) return null;
  const src = demo ? post.media_path : `/api/media?path=${encodeURIComponent(post.media_path)}`;
  return post.media_type?.startsWith('video/') ? (
    <video
      className="post-media video"
      controls
      preload="none"
      playsInline
      src={src}
      aria-label={post.alt || 'Video del post'}
    >
      <track kind="captions" />
    </video>
  ) : (
    <Image
      className="post-media"
      src={src}
      alt={post.alt || 'Immagine condivisa'}
      width={960}
      height={660}
      unoptimized
    />
  );
}
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
    const el = ref.current;
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <header>
          <h2 id={titleId}>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Chiudi">
            <X size={22} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
const emptyIcons = {
  feed: Sprout,
  search: SearchX,
  messages: MessageCircle,
  notifications: Bell,
  moderation: ShieldCheck,
  saved: Bookmark,
  media: Clapperboard,
} as const;
export function Empty({
  title,
  children,
  kind = 'feed',
}: {
  title: string;
  children: React.ReactNode;
  kind?: keyof typeof emptyIcons;
}) {
  const Icon = emptyIcons[kind];
  return (
    <div className="empty">
      <span className={`empty-art ${kind}`} aria-hidden="true">
        <i />
        <Icon size={30} strokeWidth={1.6} />
        <i />
      </span>
      <h2>{title}</h2>
      <div className="empty-copy">{children}</div>
    </div>
  );
}

export function LoadingShell() {
  return (
    <main className="loading-screen" aria-busy="true">
      <p className="sr-only" role="status">
        Apriamo la piazza…
      </p>
      <div className="loading-shell" aria-hidden="true">
        <header>
          <span className="wordmark">
            sn<span>●</span>
          </span>
          <span className="skeleton-line short" />
        </header>
        <div className="skeleton-stories">
          {Array.from({ length: 5 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
        {[0, 1].map((item) => (
          <article className="skeleton-post" key={item}>
            <div className="skeleton-author">
              <span />
              <p>
                <i />
                <i />
              </p>
            </div>
            <span className="skeleton-line" />
            <span className="skeleton-line medium" />
            {item === 0 && <div className="skeleton-media" />}
          </article>
        ))}
      </div>
    </main>
  );
}
