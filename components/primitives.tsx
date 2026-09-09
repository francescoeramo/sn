'use client';
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { X, Sprout } from 'lucide-react';
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
  useEffect(() => {
    ref.current?.showModal();
    const el = ref.current;
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <header>
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Chiudi">
            <X size={22} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Sprout size={32} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
