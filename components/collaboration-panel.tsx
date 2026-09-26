'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ImagePlus, Lock, Plus, UserPlus, X } from 'lucide-react';
import type { Action, Snapshot } from '@/lib/core/types';
import { asDataURL, prepareMedia } from '@/lib/client/media';
import { Empty } from './primitives';

type Props = {
  state: Snapshot;
  demo: boolean;
  busy: boolean;
  onAction: (action: Action) => Promise<boolean>;
};

export function CollaborationPanel({ state, demo, busy, onAction }: Props) {
  const albums = (state.collaborativePosts ?? []).filter(
    (album) =>
      album.owner_id === state.me.id ||
      (state.collaborators ?? []).some(
        (member) => member.post_id === album.post_id && member.user_id === state.me.id,
      ),
  );
  const ownedOpenPosts = state.posts.filter(
    (post) =>
      post.author_id === state.me.id &&
      post.kind === 'post' &&
      !albums.some((album) => album.post_id === post.id),
  );
  const [inviteFor, setInviteFor] = useState<string | null>(null);
  const [invitee, setInvitee] = useState('');
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [status, setStatus] = useState<Record<string, string>>({});

  function mutualContacts() {
    const outgoing = new Set(
      state.follows
        .filter((follow) => follow.follower_id === state.me.id && follow.accepted)
        .map((follow) => follow.following_id),
    );
    return state.profiles.filter((profile) =>
      state.follows.some(
        (follow) =>
          follow.follower_id === profile.id &&
          follow.following_id === state.me.id &&
          follow.accepted &&
          outgoing.has(profile.id),
      ),
    );
  }
  const contacts = mutualContacts();
  const postById = (id: string) => state.posts.find((post) => post.id === id);
  const profileName = (id: string) =>
    state.profiles.find((profile) => profile.id === id)?.display_name ?? 'Persona';

  async function addItem(postId: string) {
    const file = files[postId];
    if (!file) return;
    try {
      if (!file.type.startsWith('image/'))
        throw new Error('Scegli un’immagine JPEG, PNG o WebP.');
      const prepared = await prepareMedia(file, (text) =>
        setStatus((current) => ({ ...current, [postId]: text })),
      );
      let media_path: string;
      if (demo) {
        media_path = await asDataURL(prepared);
      } else {
        setStatus((current) => ({ ...current, [postId]: 'Caricamento…' }));
        const form = new FormData();
        form.append('file', prepared);
        const response = await fetch('/api/upload', { method: 'POST', body: form });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        media_path = result.path as string;
      }
      if (
        await onAction({
          type: 'add-album-item',
          post_id: postId,
          media_path,
          caption: captions[postId] ?? '',
        })
      ) {
        setFiles((current) => ({ ...current, [postId]: null }));
        setCaptions((current) => ({ ...current, [postId]: '' }));
        setStatus((current) => ({ ...current, [postId]: '' }));
      }
    } catch (error) {
      setStatus((current) => ({
        ...current,
        [postId]: error instanceof Error ? error.message : 'Caricamento non riuscito.',
      }));
    }
  }

  if (albums.length === 0 && ownedOpenPosts.length === 0)
    return (
      <Empty title="Nessuna collaborazione">
        <p className="muted">Apri un post per invitare un contatto.</p>
      </Empty>
    );

  return (
    <div className="collaboration-list">
      {ownedOpenPosts.length > 0 && (
        <section className="panel">
          <h2>Apri le collaborazioni</h2>
          <p className="muted">
            Scegli un tuo post e invita un contatto reciproco ad aggiungere media e didascalie. Tu
            resti l’unico a poter pubblicare, occultare, revocare o archiviare.
          </p>
          <ul className="group-members">
            {ownedOpenPosts.map((post) => (
              <li key={post.id}>
                <span>{post.body.slice(0, 80) || 'Post senza testo'}</span>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => void onAction({ type: 'open-collaboration', post_id: post.id })}
                >
                  <Plus size={15} /> Apri
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {albums.map((album) => {
        const post = postById(album.post_id);
        if (!post) return null;
        const members = (state.collaborators ?? []).filter(
          (member) => member.post_id === album.post_id,
        );
        const mine = members.find((member) => member.user_id === state.me.id);
        const isOwner = album.owner_id === state.me.id;
        const items = (state.albumItems ?? []).filter((item) => item.post_id === album.post_id);
        const canContribute =
          !album.album_closed_at && (isOwner || (mine?.status === 'active' && mine.can_media));
        return (
          <article className="panel" key={album.post_id}>
            <h2>{isOwner ? 'Il tuo post collaborativo' : 'Collaborazione'}</h2>
            <p>{post.body.slice(0, 200) || 'Post senza testo'}</p>
            {mine?.status === 'invited' && (
              <div className="button-row">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    void onAction({
                      type: 'respond-collaboration',
                      post_id: album.post_id,
                      accept: true,
                    })
                  }
                >
                  Accetta
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    void onAction({
                      type: 'respond-collaboration',
                      post_id: album.post_id,
                      accept: false,
                    })
                  }
                >
                  Rifiuta
                </button>
              </div>
            )}
            {isOwner && (
              <>
                <div className="button-row">
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      setInviteFor(inviteFor === album.post_id ? null : album.post_id);
                      setInvitee('');
                    }}
                  >
                    <UserPlus size={15} /> Invita un contatto
                  </button>
                  <button
                    className="text-button"
                    disabled={busy || !!album.album_closed_at}
                    onClick={() => void onAction({ type: 'close-album', post_id: album.post_id })}
                  >
                    <Lock size={15} /> Chiudi album
                  </button>
                </div>
                {inviteFor === album.post_id && (
                  <form
                    className="group-add"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (!invitee) return;
                      if (
                        await onAction({
                          type: 'invite-collaborator',
                          post_id: album.post_id,
                          user_id: invitee,
                        })
                      ) {
                        setInvitee('');
                        setInviteFor(null);
                      }
                    }}
                  >
                    <label>
                      <span className="sr-only">Contatto da invitare</span>
                      <select value={invitee} onChange={(e) => setInvitee(e.target.value)}>
                        <option value="">Scegli un contatto</option>
                        {contacts
                          .filter(
                            (contact) =>
                              !members.some((member) => member.user_id === contact.id),
                          )
                          .map((contact) => (
                            <option key={contact.id} value={contact.id}>
                              @{contact.username}
                            </option>
                          ))}
                      </select>
                    </label>
                    <button className="secondary" disabled={busy || !invitee}>
                      Invita
                    </button>
                  </form>
                )}
                <ul className="group-members">
                  {members.map((member) => (
                    <li key={member.user_id}>
                      <span>
                        <strong>{profileName(member.user_id)}</strong>
                        <small>
                          {member.status === 'active' ? 'Collaboratore' : 'In attesa di risposta'}
                        </small>
                      </span>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() =>
                          void onAction({
                            type: 'remove-collaborator',
                            post_id: album.post_id,
                            user_id: member.user_id,
                          })
                        }
                      >
                        <X size={15} /> Rimuovi
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {mine?.status === 'active' && !isOwner && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  void onAction({
                    type: 'remove-collaborator',
                    post_id: album.post_id,
                    user_id: state.me.id,
                  })
                }
              >
                Esci dalla collaborazione
              </button>
            )}
            <h3>Album condiviso</h3>
            {album.album_closed_at && <p className="muted fine">Album chiuso dall’autore.</p>}
            {items.length > 0 && (
              <div className="event-album-grid">
                {items.map((item) => (
                  <figure key={item.id}>
                    <Image
                      src={
                        demo
                          ? item.media_path
                          : `/api/media?path=${encodeURIComponent(item.media_path)}`
                      }
                      alt={item.caption || `Media condiviso da ${profileName(item.added_by)}`}
                      width={320}
                      height={320}
                      unoptimized
                    />
                    <figcaption>
                      <span>{profileName(item.added_by)}</span>
                      {item.caption && <p>{item.caption}</p>}
                      {(item.added_by === state.me.id || isOwner) && (
                        <button
                          className="text-button danger-text"
                          disabled={busy}
                          onClick={() => void onAction({ type: 'remove-album-item', item_id: item.id })}
                        >
                          Rimuovi
                        </button>
                      )}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
            {canContribute ? (
              <form
                className="event-album-add"
                onSubmit={(event) => {
                  event.preventDefault();
                  void addItem(album.post_id);
                }}
              >
                <label>
                  <span className="sr-only">Aggiungi un media all’album condiviso</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(input) =>
                      setFiles((current) => ({
                        ...current,
                        [album.post_id]: input.target.files?.[0] ?? null,
                      }))
                    }
                  />
                </label>
                <label>
                  <span className="sr-only">Didascalia facoltativa</span>
                  <input
                    value={captions[album.post_id] ?? ''}
                    maxLength={240}
                    onChange={(input) =>
                      setCaptions((current) => ({
                        ...current,
                        [album.post_id]: input.target.value,
                      }))
                    }
                    placeholder="Didascalia facoltativa"
                  />
                </label>
                <button className="secondary" disabled={busy || !files[album.post_id]}>
                  <ImagePlus size={16} /> Aggiungi
                </button>
              </form>
            ) : (
              !album.album_closed_at &&
              !isOwner && (
                <p className="event-album-hint">Attendi l’invito accettato per aggiungere media.</p>
              )
            )}
            {status[album.post_id] && <p className="event-album-status">{status[album.post_id]}</p>}
          </article>
        );
      })}
    </div>
  );
}
